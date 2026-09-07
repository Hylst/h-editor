/**
 * Import / export du projet au format JSON.
 *
 * La persistance de l'espace de travail vit désormais dans
 * `utils/storage/workspace.ts` (localStorage + IndexedDB, tolérant au quota).
 */

import type { EditorFile, EditorFolder, FileSystemStructure } from '@/types/editor';
import { getLanguageFromFilename } from './fileSystem';

export const exportToJSON = (files: EditorFile[], folders: EditorFolder[]): string =>
  JSON.stringify(
    {
      version: 2,
      exportedAt: new Date().toISOString(),
      files: files.map(({ id, name, language, content, parentId, binary }) => ({
        id,
        name,
        language,
        content,
        parentId,
        ...(binary ? { binary: true } : {}),
      })),
      folders,
    },
    null,
    2
  );

/** Import défensif : un JSON étranger ou tronqué ne doit jamais casser l'application. */
export const importFromJSON = (jsonString: string): FileSystemStructure | null => {
  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed?.files) || !Array.isArray(parsed?.folders)) return null;

    const folders: EditorFolder[] = parsed.folders
      .filter((f: unknown): f is EditorFolder => !!f && typeof (f as EditorFolder).id === 'string')
      .map((f: EditorFolder) => ({
        id: f.id,
        name: typeof f.name === 'string' && f.name ? f.name : 'dossier',
        parentId: f.parentId,
        expanded: f.expanded ?? true,
      }));

    const knownFolderIds = new Set(folders.map((f) => f.id));

    const files: EditorFile[] = parsed.files
      .filter((f: unknown): f is EditorFile => !!f && typeof (f as EditorFile).id === 'string')
      .map((f: EditorFile) => {
        const name = typeof f.name === 'string' && f.name ? f.name : 'sans-nom.txt';
        return {
          id: f.id,
          name,
          language: typeof f.language === 'string' ? f.language : getLanguageFromFilename(name),
          content: typeof f.content === 'string' ? f.content : '',
          modified: false,
          ...(f.binary ? { binary: true } : {}),
          // Un parent inconnu remonterait le fichier dans un dossier fantôme : on le rapatrie à la racine.
          parentId: f.parentId && knownFolderIds.has(f.parentId) ? f.parentId : undefined,
        };
      });

    // Un parent de dossier inconnu produirait une branche invisible.
    folders.forEach((folder) => {
      if (folder.parentId && !knownFolderIds.has(folder.parentId)) folder.parentId = undefined;
    });

    return { files, folders };
  } catch {
    return null;
  }
};

export type JSONImportAnalysis =
  | { kind: 'project'; structure: FileSystemStructure }
  | { kind: 'file'; content: string }
  | { kind: 'invalid' };

/**
 * Analyse un JSON importé, qui peut être trois choses :
 *
 * - une sauvegarde de projet (format « Exporter en JSON ») → importée telle quelle ;
 * - un JSON valide quelconque (config, données…) → ajouté au projet comme fichier
 *   ordinaire : le rejeter sous prétexte qu'il n'est pas un projet était trompeur ;
 * - du texte illisible → signalé à l'utilisateur.
 */
export const analyzeJSONImport = (jsonString: string): JSONImportAnalysis => {
  const structure = importFromJSON(jsonString);
  if (structure) return { kind: 'project', structure };

  try {
    JSON.parse(jsonString);
    return { kind: 'file', content: jsonString };
  } catch {
    return { kind: 'invalid' };
  }
};

export const downloadJSON = (files: EditorFile[], folders: EditorFolder[]): void => {
  const blob = new Blob([exportToJSON(files, folders)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `editorx-projet-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
