import { describe, expect, it } from 'vitest';
import type { EditorFile, EditorFolder } from '@/types/editor';
import { analyzeJSONImport, exportToJSON, importFromJSON } from './fileStorage';
import { getLanguageFromFilename } from './fileSystem';
import { canFormat, formatCode } from './formatter';

const files: EditorFile[] = [
  { id: 'f1', name: 'app.ts', language: 'typescript', content: 'const a = 1;', modified: true },
  { id: 'f2', name: 'style.css', language: 'css', content: 'a{color:red}', modified: false, parentId: 'd1' },
];
const folders: EditorFolder[] = [{ id: 'd1', name: 'src', expanded: true }];

describe('export / import JSON', () => {
  it('fait un aller-retour sans perte', () => {
    const imported = importFromJSON(exportToJSON(files, folders))!;
    expect(imported.files).toHaveLength(2);
    expect(imported.files[0].content).toBe('const a = 1;');
    expect(imported.files[1].parentId).toBe('d1');
    // Un fichier importé n'est pas « modifié » tant qu'on n'y touche pas.
    expect(imported.files.every((f) => f.modified === false)).toBe(true);
  });

  it('rejette un JSON qui n’est pas un projet', () => {
    expect(importFromJSON('{"foo":1}')).toBeNull();
    expect(importFromJSON('pas du json')).toBeNull();
    expect(importFromJSON('[]')).toBeNull();
  });

  it('rapatrie à la racine les fichiers au parent inconnu', () => {
    const json = JSON.stringify({
      files: [{ id: 'x', name: 'perdu.txt', content: 'a', parentId: 'fantome' }],
      folders: [],
    });
    expect(importFromJSON(json)!.files[0].parentId).toBeUndefined();
  });

  it('tolère les champs manquants', () => {
    const json = JSON.stringify({ files: [{ id: 'x', name: 'a.py' }], folders: [] });
    const file = importFromJSON(json)!.files[0];
    expect(file.content).toBe('');
    expect(file.language).toBe('python');
  });
});

describe('analyzeJSONImport', () => {
  it('reconnaît une sauvegarde de projet', () => {
    const result = analyzeJSONImport(exportToJSON(files, folders));
    expect(result.kind).toBe('project');
    if (result.kind === 'project') expect(result.structure.files).toHaveLength(2);
  });

  it('traite un JSON valide non projet comme un fichier à ajouter', () => {
    // Avant : tout JSON valide qui n'était pas un projet était rejeté « invalide ».
    expect(analyzeJSONImport('{"foo":1}').kind).toBe('file');
    expect(analyzeJSONImport('[]').kind).toBe('file');
    expect(analyzeJSONImport('[1, 2, 3]').kind).toBe('file');
  });

  it('signale un JSON illisible', () => {
    expect(analyzeJSONImport('pas du json').kind).toBe('invalid');
    expect(analyzeJSONImport('{"files": [').kind).toBe('invalid');
  });
});

describe('getLanguageFromFilename', () => {
  it('reconnaît les extensions courantes', () => {
    expect(getLanguageFromFilename('index.tsx')).toBe('typescript');
    expect(getLanguageFromFilename('script.py')).toBe('python');
    expect(getLanguageFromFilename('notes.md')).toBe('markdown');
    expect(getLanguageFromFilename('conf.yml')).toBe('yaml');
  });

  it('gère les fichiers sans extension', () => {
    expect(getLanguageFromFilename('Dockerfile')).toBe('dockerfile');
    expect(getLanguageFromFilename('.env')).toBe('ini');
    expect(getLanguageFromFilename('LISEZMOI')).toBe('plaintext');
  });
});

describe('formatCode', () => {
  it('déclare formatables uniquement les langages réellement pris en charge', () => {
    expect(canFormat('typescript')).toBe(true);
    expect(canFormat('yaml')).toBe(true);
    expect(canFormat('python')).toBe(false);
  });

  it('formate réellement le YAML (le plugin manquait auparavant)', async () => {
    const formatted = await formatCode('a:   1\nb:  [1,2]\n', 'yaml');
    expect(formatted).toBe('a: 1\nb: [1, 2]\n');
  });

  it('formate le TypeScript avec la taille de tabulation demandée', async () => {
    const formatted = await formatCode('const a = {b:1}', 'typescript', 4);
    expect(formatted).toBe('const a = { b: 1 };\n');
  });

  it('remonte un message explicite en cas d’erreur de syntaxe', async () => {
    await expect(formatCode('const = ;', 'typescript')).rejects.toThrow(/Formatage impossible/);
  });
});
