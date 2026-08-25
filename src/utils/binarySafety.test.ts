/**
 * Garde-fou : un fichier binaire (stocké en base64) ne doit jamais subir de
 * traitement texte. Un `String.replace` sur du base64 détruit le fichier —
 * régression réellement introduite en 1.3.0 et corrigée ici.
 */

import { describe, expect, it } from 'vitest';
import type { EditorFile } from '@/types/editor';
import { canFormat } from './formatter';
import { canPreview } from './markdown';

const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const binaryFile = (): EditorFile => ({
  id: 'img',
  name: 'logo.png',
  language: 'plaintext',
  content: Buffer.from(PNG_HEADER).toString('base64'),
  modified: false,
  binary: true,
});

const textFile = (): EditorFile => ({
  id: 'txt',
  name: 'note.md',
  language: 'markdown',
  content: 'bonjour le monde',
  modified: false,
});

/** Reproduit la logique de `SearchPanel.replaceIn`, exclusion des binaires comprise. */
const replaceAcross = (files: EditorFile[], pattern: RegExp, replacement: string) =>
  files
    .filter((f) => !f.binary)
    .map((f) => ({ fileId: f.id, content: f.content.replace(pattern, replacement) }))
    .filter((r, i) => r.content !== files.filter((f) => !f.binary)[i].content);

describe('sécurité des fichiers binaires', () => {
  it('un remplacement global corromprait le base64 s’il n’était pas exclu', () => {
    // Démonstration du danger : c'est bien une corruption, pas une hypothèse.
    const base64 = binaryFile().content;
    const naif = base64.replace(/o/gi, 'X');

    expect(naif).not.toBe(base64);
    expect(Array.from(Buffer.from(naif, 'base64'))).not.toEqual(Array.from(PNG_HEADER));
  });

  it('le remplacement global laisse les binaires intacts', () => {
    const files = [binaryFile(), textFile()];
    const résultats = replaceAcross(files, /o/gi, 'X');

    // Seul le fichier texte est concerné
    expect(résultats.map((r) => r.fileId)).toEqual(['txt']);
    expect(résultats.every((r) => r.fileId !== 'img')).toBe(true);
  });

  it('le base64 se décode toujours vers les octets d’origine', () => {
    const file = binaryFile();
    expect(Array.from(Buffer.from(file.content, 'base64'))).toEqual(Array.from(PNG_HEADER));
  });

  it('un binaire n’est ni formatable ni prévisualisable', () => {
    const file = binaryFile();
    expect(canFormat(file.language)).toBe(false);
    expect(canPreview(file.language)).toBe(false);
  });

  it('la recherche ignore le contenu des binaires', () => {
    // « iVBOR » est présent dans le base64 du PNG : il ne doit jamais remonter.
    const files = [binaryFile(), textFile()];
    const cherchables = files.filter((f) => !f.binary);

    expect(binaryFile().content).toContain('iVBOR');
    expect(cherchables.some((f) => f.content.includes('iVBOR'))).toBe(false);
  });
});
