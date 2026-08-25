import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import type { EditorFile, EditorFolder } from '@/types/editor';
import { downloadAsZip, importFromZip, MAX_BINARY_BYTES } from './zipHandler';

const toFile = async (zip: JSZip, name = 'projet.zip'): Promise<File> => {
  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], name, { type: 'application/zip' });
};

describe('importFromZip', () => {
  it('reconstruit l’arborescence même sans entrées de dossier explicites', async () => {
    const zip = new JSZip();
    zip.file('src/utils/helper.js', 'export const a = 1;');
    zip.file('README.md', '# projet');

    const result = await importFromZip(await toFile(zip));
    expect(result).not.toBeNull();

    const helper = result!.files.find((f) => f.name === 'helper.js')!;
    const utils = result!.folders.find((f) => f.id === helper.parentId)!;
    const src = result!.folders.find((f) => f.id === utils.parentId)!;

    expect(utils.name).toBe('utils');
    expect(src.name).toBe('src');
    expect(src.parentId).toBeUndefined();
    expect(result!.files.find((f) => f.name === 'README.md')!.parentId).toBeUndefined();
  });

  it('preserve les fichiers binaires sans les corrompre', async () => {
    // Regression : `entry.async("string")` transformait 12 octets binaires en 18.
    const octets = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff, 0xfe, 0x00, 0x01]);
    const zip = new JSZip();
    zip.file('image.png', octets);
    zip.file('note.txt', 'texte');

    const result = await importFromZip(await toFile(zip));

    const image = result!.files.find((f) => f.name === 'image.png')!;
    expect(image.binary).toBe(true);
    expect(result!.preservedBinaries).toContain('image.png');
    expect(result!.skipped).toHaveLength(0);

    // Le base64 stocke doit redonner exactement les octets d'origine.
    const decoded = Uint8Array.from(atob(image.content), (c) => c.charCodeAt(0));
    expect(Array.from(decoded)).toEqual(Array.from(octets));

    // Et le fichier texte reste un fichier texte editable.
    const note = result!.files.find((f) => f.name === 'note.txt')!;
    expect(note.binary).toBeUndefined();
    expect(note.content).toBe('texte');
  });

  it('fait un aller-retour import -> export sans alterer un binaire', async () => {
    const octets = new Uint8Array([0x00, 0xff, 0x10, 0x80, 0x7f, 0x01, 0xfe]);
    const source = new JSZip();
    source.file('assets/logo.png', octets);

    const imported = (await importFromZip(await toFile(source)))!;

    // On rejoue ce que fait downloadAsZip pour un fichier binaire.
    const rebuilt = new JSZip();
    const image = imported.files.find((f) => f.name === 'logo.png')!;
    rebuilt.file('logo.png', image.content, { base64: true });

    const roundTripped = await JSZip.loadAsync(await rebuilt.generateAsync({ type: 'nodebuffer' }));
    const bytes = await roundTripped.file('logo.png')!.async('uint8array');
    expect(Array.from(bytes)).toEqual(Array.from(octets));
  });

  it('ignore un binaire trop volumineux', async () => {
    const zip = new JSZip();
    zip.file('enorme.bin', new Uint8Array(MAX_BINARY_BYTES + 1024));

    const result = await importFromZip(await toFile(zip));
    expect(result!.files).toHaveLength(0);
    expect(result!.skipped).toContain('enorme.bin');
  });

  it('ignore les métadonnées macOS', async () => {
    const zip = new JSZip();
    zip.file('__MACOSX/._note.txt', 'parasite');
    zip.file('note.txt', 'texte');

    const result = await importFromZip(await toFile(zip));
    expect(result!.files.map((f) => f.name)).toEqual(['note.txt']);
  });

  it('détecte le langage à partir de l’extension', async () => {
    const zip = new JSZip();
    zip.file('app.tsx', 'export default null;');

    const result = await importFromZip(await toFile(zip));
    expect(result!.files[0].language).toBe('typescript');
  });

  it('renvoie null sur une archive illisible', async () => {
    const bogus = new File(['ceci n’est pas un zip'], 'faux.zip');
    expect(await importFromZip(bogus)).toBeNull();
  });
});

describe('downloadAsZip', () => {
  it('n’écrase pas deux fichiers de même chemin', async () => {
    // Deux fichiers homonymes existaient après le bug de collision de noms.
    const folders: EditorFolder[] = [];
    const files: EditorFile[] = [
      { id: '1', name: 'notes.txt', language: 'plaintext', content: 'A', modified: false },
      { id: '2', name: 'notes.txt', language: 'plaintext', content: 'B', modified: false },
    ];

    const captured: Record<string, string> = {};
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = () => 'blob:test';
    URL.revokeObjectURL = () => undefined;

    const originalFile = JSZip.prototype.file;
    JSZip.prototype.file = function (this: JSZip, path: string, data?: unknown, ...rest: unknown[]) {
      if (typeof path === 'string' && typeof data === 'string') captured[path] = data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return originalFile.call(this, path as any, data as any, ...(rest as any));
    } as typeof JSZip.prototype.file;

    try {
      await downloadAsZip(files, folders);
    } finally {
      JSZip.prototype.file = originalFile;
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }

    expect(Object.keys(captured).sort()).toEqual(['notes (2).txt', 'notes.txt']);
    expect(Object.values(captured).sort()).toEqual(['A', 'B']);
  });
});
