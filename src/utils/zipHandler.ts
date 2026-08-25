import type JSZipType from 'jszip';
import type { EditorFile, EditorFolder, FileSystemStructure } from '@/types/editor';
import { getLanguageFromFilename } from './fileSystem';
import { createId } from './ids';

/**
 * JSZip (~96 Ko) est chargé **à la demande**.
 *
 * En import statique, son chunk était requis au démarrage : exclu du précache
 * du service worker, son échec empêchait l'application entière de démarrer hors
 * ligne (`#root` restait vide). L'import dynamique règle les deux problèmes :
 * démarrage plus léger, et hors ligne réellement fonctionnel.
 */
const loadJSZip = async (): Promise<typeof JSZipType> => {
  const module = await import('jszip');
  return module.default ?? (module as unknown as typeof JSZipType);
};

/** Au-delà, l'import est refusé : le projet ne tiendrait pas dans le stockage du navigateur. */
export const MAX_ZIP_CONTENT_BYTES = 50 * 1024 * 1024;

/** Un binaire plus lourd que cela n'est pas conservé (il gonflerait le stockage pour rien). */
export const MAX_BINARY_BYTES = 2 * 1024 * 1024;

/** Extensions traitées comme binaires : lues en texte, elles seraient corrompues. */
const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'avif', 'tiff',
  'pdf', 'zip', 'gz', 'tar', 'rar', '7z', 'bz2', 'xz',
  'mp3', 'mp4', 'wav', 'ogg', 'webm', 'avi', 'mov', 'flac',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'exe', 'dll', 'so', 'dylib', 'bin', 'class', 'jar', 'wasm',
  'sqlite', 'db', 'psd', 'ai', 'blend',
]);

const isBinaryFilename = (name: string): boolean => {
  const ext = name.split('.').pop()?.toLowerCase();
  return ext ? BINARY_EXTENSIONS.has(ext) : false;
};

export interface ZipImportResult extends FileSystemStructure {
  /** Fichiers réellement ignorés (trop volumineux) pour information à l'utilisateur. */
  skipped: string[];
  /** Binaires conservés tels quels (non éditables), restitués à l'export. */
  preservedBinaries: string[];
}

export interface ZipProgress {
  processed: number;
  total: number;
  currentFile: string;
}

export const downloadAsZip = async (files: EditorFile[], folders: EditorFolder[]): Promise<void> => {
  const JSZip = await loadJSZip();
  const zip = new JSZip();

  folders.forEach((folder) => {
    zip.folder(getFolderPath(folder, folders));
  });

  // Deux fichiers de même chemin s'écraseraient dans l'archive : on garantit l'unicité.
  const usedPaths = new Set<string>();
  files.forEach((file) => {
    let path = getFilePath(file, folders);
    if (usedPaths.has(path)) {
      const dot = path.lastIndexOf('.');
      const base = dot > 0 ? path.slice(0, dot) : path;
      const ext = dot > 0 ? path.slice(dot) : '';
      let i = 2;
      while (usedPaths.has(`${base} (${i})${ext}`)) i++;
      path = `${base} (${i})${ext}`;
    }
    usedPaths.add(path);
    // Un binaire est stocké en base64 : on le réécrit tel quel dans l'archive,
    // sinon l'aller-retour import → export le corromprait.
    if (file.binary) zip.file(path, file.content, { base64: true });
    else zip.file(path, file.content);
  });

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `editorx-projet-${new Date().toISOString().split('T')[0]}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importFromZip = async (
  file: File,
  onProgress?: (progress: ZipProgress) => void
): Promise<ZipImportResult | null> => {
  try {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(file);
    const files: EditorFile[] = [];
    const folders: EditorFolder[] = [];
    const skipped: string[] = [];
    const preservedBinaries: string[] = [];
    const folderIdByPath = new Map<string, string>();

    /**
     * Crée (à la demande) toute la chaîne de dossiers d'un chemin.
     * Ne dépend pas de la présence ni de l'ordre des entrées « dossier » de l'archive :
     * certains outils n'en écrivent aucune.
     */
    const ensureFolder = (path: string): string | undefined => {
      if (!path) return undefined;
      const existing = folderIdByPath.get(path);
      if (existing) return existing;

      const parts = path.split('/');
      const name = parts[parts.length - 1];
      const parentId = ensureFolder(parts.slice(0, -1).join('/'));

      const id = createId();
      folders.push({ id, name, parentId, expanded: true });
      folderIdByPath.set(path, id);
      return id;
    };

    const entries: { path: string; entry: JSZipType.JSZipObject }[] = [];
    zip.forEach((relativePath, entry) => {
      // On ignore les métadonnées macOS et les entrées hors arborescence.
      if (relativePath.startsWith('__MACOSX/') || relativePath.includes('/../')) return;
      entries.push({ path: relativePath, entry });
    });

    const fileEntries = entries.filter((e) => !e.entry.dir);
    entries.filter((e) => e.entry.dir).forEach((e) => ensureFolder(e.path.replace(/\/+$/, '')));

    let totalBytes = 0;
    let processed = 0;

    for (const { path, entry } of fileEntries) {
      processed++;
      const parts = path.split('/');
      const name = parts[parts.length - 1];
      if (!name) continue;

      onProgress?.({ processed, total: fileEntries.length, currentFile: name });

      if (isBinaryFilename(name)) {
        // Lu en texte, un binaire serait corrompu. On le conserve en base64 :
        // il n'est pas éditable, mais il survit à l'aller-retour import → export.
        const bytes = await entry.async('uint8array');
        if (bytes.byteLength > MAX_BINARY_BYTES) {
          skipped.push(name);
          continue;
        }

        totalBytes += bytes.byteLength;
        if (totalBytes > MAX_ZIP_CONTENT_BYTES) {
          skipped.push(name);
          continue;
        }

        files.push({
          id: createId(),
          name,
          language: 'plaintext',
          content: await entry.async('base64'),
          modified: false,
          binary: true,
          parentId: ensureFolder(parts.slice(0, -1).join('/')),
        });
        preservedBinaries.push(name);
        continue;
      }

      const content = await entry.async('string');
      totalBytes += content.length;
      if (totalBytes > MAX_ZIP_CONTENT_BYTES) {
        skipped.push(name);
        continue;
      }

      files.push({
        id: createId(),
        name,
        language: getLanguageFromFilename(name),
        content,
        modified: false,
        parentId: ensureFolder(parts.slice(0, -1).join('/')),
      });

      // Laisse respirer le thread principal sur les grosses archives.
      if (processed % 25 === 0) await new Promise((r) => setTimeout(r, 0));
    }

    return { files, folders, skipped, preservedBinaries };
  } catch (error) {
    console.error('Erreur lors de l’import ZIP :', error);
    return null;
  }
};

const getFolderPath = (folder: EditorFolder, allFolders: EditorFolder[]): string => {
  const parts: string[] = [folder.name];
  let current = folder;
  const seen = new Set<string>([folder.id]); // garde-fou contre une boucle de parents

  while (current.parentId && !seen.has(current.parentId)) {
    const parent = allFolders.find((f) => f.id === current.parentId);
    if (!parent) break;
    seen.add(parent.id);
    parts.unshift(parent.name);
    current = parent;
  }

  return parts.join('/');
};

const getFilePath = (file: EditorFile, folders: EditorFolder[]): string => {
  if (!file.parentId) return file.name;
  const folder = folders.find((f) => f.id === file.parentId);
  if (!folder) return file.name;
  return `${getFolderPath(folder, folders)}/${file.name}`;
};
