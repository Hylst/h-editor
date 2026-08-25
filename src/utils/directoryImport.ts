/**
 * Ouverture d'un dossier réel du disque (`showDirectoryPicker`).
 *
 * Chaque fichier texte conserve son `FileSystemFileHandle` : `Ctrl+S` réécrit
 * ensuite directement sur le disque, sans sélecteur. Les binaires sont
 * conservés en base64 comme à l'import ZIP.
 */

import type { EditorFile, EditorFolder } from '@/types/editor';
import { createId } from '@/utils/ids';
import { getLanguageFromFilename } from '@/utils/fileSystem';

/** Dossiers systématiquement ignorés : ils feraient exploser le projet. */
const IGNORED_DIRECTORIES = new Set([
  'node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out', '.next',
  '.nuxt', '.cache', '.turbo', 'coverage', '.venv', '__pycache__', 'target',
  'vendor', '.idea', '.vscode', 'test-results', 'playwright-report',
]);

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'avif', 'tiff',
  'pdf', 'zip', 'gz', 'tar', 'rar', '7z', 'mp3', 'mp4', 'wav', 'ogg', 'webm',
  'woff', 'woff2', 'ttf', 'otf', 'eot', 'exe', 'dll', 'so', 'wasm', 'psd',
]);

const MAX_FILES = 2000;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_BINARY_BYTES = 2 * 1024 * 1024;

export interface DirectoryImportResult {
  files: EditorFile[];
  folders: EditorFolder[];
  skipped: string[];
  /** true si la limite de fichiers a été atteinte (import partiel). */
  truncated: boolean;
  rootName: string;
}

export interface DirectoryProgress {
  processed: number;
  currentPath: string;
}

const isBinary = (name: string): boolean => {
  const ext = name.split('.').pop()?.toLowerCase();
  return ext ? BINARY_EXTENSIONS.has(ext) : false;
};

const toBase64 = async (file: File): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  // Par tranches : `String.fromCharCode(...bytes)` dépasse la pile sur un gros fichier.
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
};

export const isDirectoryPickerSupported = (): boolean => {
  try {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  } catch {
    return false;
  }
};

/** Ouvre un dossier et en importe l'arborescence ; null si l'utilisateur annule. */
export const importDirectory = async (
  onProgress?: (progress: DirectoryProgress) => void
): Promise<DirectoryImportResult | null> => {
  if (!isDirectoryPickerSupported()) return null;

  let root: FileSystemDirectoryHandle;
  try {
    root = await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch (error) {
    if ((error as Error)?.name !== 'AbortError') console.error('Ouverture du dossier :', error);
    return null;
  }

  const files: EditorFile[] = [];
  const folders: EditorFolder[] = [];
  const skipped: string[] = [];
  let processed = 0;
  let truncated = false;

  const walk = async (
    directory: FileSystemDirectoryHandle,
    parentId: string | undefined,
    path: string
  ): Promise<void> => {
    if (truncated) return;

    // `entries()` n'est pas encore dans les typages DOM standard.
    const iterable = directory as unknown as AsyncIterable<[string, FileSystemHandle]>;

    for await (const [name, handle] of iterable) {
      if (truncated) return;

      if (handle.kind === 'directory') {
        if (IGNORED_DIRECTORIES.has(name) || name.startsWith('.')) {
          skipped.push(`${path}${name}/`);
          continue;
        }
        const id = createId();
        folders.push({ id, name, parentId, expanded: false });
        await walk(handle as FileSystemDirectoryHandle, id, `${path}${name}/`);
        continue;
      }

      if (files.length >= MAX_FILES) {
        truncated = true;
        return;
      }

      const fileHandle = handle as FileSystemFileHandle;
      let file: File;
      try {
        file = await fileHandle.getFile();
      } catch {
        skipped.push(`${path}${name}`);
        continue;
      }

      processed++;
      onProgress?.({ processed, currentPath: `${path}${name}` });

      if (isBinary(name)) {
        if (file.size > MAX_BINARY_BYTES) {
          skipped.push(`${path}${name}`);
          continue;
        }
        files.push({
          id: createId(),
          name,
          language: 'plaintext',
          content: await toBase64(file),
          modified: false,
          binary: true,
          parentId,
          fileHandle,
          diskModifiedAt: file.lastModified,
        });
        continue;
      }

      if (file.size > MAX_TEXT_BYTES) {
        skipped.push(`${path}${name}`);
        continue;
      }

      files.push({
        id: createId(),
        name,
        language: getLanguageFromFilename(name),
        content: await file.text(),
        modified: false,
        parentId,
        // Le handle permet un vrai Ctrl+S ensuite, sans sélecteur.
        fileHandle,
        diskModifiedAt: file.lastModified,
      });
    }
  };

  await walk(root, undefined, '');

  return { files, folders, skipped, truncated, rootName: root.name };
};
