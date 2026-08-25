import { describe, expect, it } from 'vitest';
import { getCopyName, getNewFileName, getUniqueName, validateName } from './fileNames';

const items = (...names: string[]) =>
  names.map((name, index) => ({ id: `id-${index}`, name, parentId: undefined }));

describe('getUniqueName', () => {
  it('conserve un nom libre', () => {
    expect(getUniqueName('notes.md', undefined, items('autre.md'))).toBe('notes.md');
  });

  it('numérote un nom déjà pris', () => {
    expect(getUniqueName('notes.md', undefined, items('notes.md'))).toBe('notes (2).md');
    expect(getUniqueName('notes.md', undefined, items('notes.md', 'notes (2).md'))).toBe(
      'notes (3).md'
    );
  });

  it('ignore la casse', () => {
    expect(getUniqueName('Notes.md', undefined, items('notes.md'))).toBe('Notes (2).md');
  });

  it('ne compare que dans le même dossier', () => {
    const list = [{ id: '1', name: 'notes.md', parentId: 'dossier' }];
    expect(getUniqueName('notes.md', undefined, list)).toBe('notes.md');
    expect(getUniqueName('notes.md', 'dossier', list)).toBe('notes (2).md');
  });

  it('permet de renommer un élément sans conflit avec lui-même', () => {
    const list = [{ id: 'a', name: 'notes.md', parentId: undefined }];
    expect(getUniqueName('notes.md', undefined, list, 'a')).toBe('notes.md');
  });

  it('gère les fichiers sans extension', () => {
    expect(getUniqueName('LICENSE', undefined, items('LICENSE'))).toBe('LICENSE (2)');
  });
});

describe('getNewFileName', () => {
  it('ne réutilise jamais un nom existant (régression : doublons après suppression)', () => {
    // Reproduit le scénario : 3 fichiers créés, le n°2 fermé, un nouveau créé.
    const remaining = items('nouveau-fichier-1.txt', 'nouveau-fichier-3.txt');
    const next = getNewFileName(remaining);
    expect(next).toBe('nouveau-fichier-2.txt');
    expect(remaining.map((f) => f.name)).not.toContain(next);
  });
});

describe('getCopyName', () => {
  it('ajoute « - copie » avant l’extension', () => {
    expect(getCopyName('app.tsx', undefined, items('app.tsx'))).toBe('app - copie.tsx');
  });

  it('numérote les copies successives', () => {
    expect(getCopyName('app.tsx', undefined, items('app.tsx', 'app - copie.tsx'))).toBe(
      'app - copie (2).tsx'
    );
  });
});

describe('validateName', () => {
  it('refuse un nom vide', () => {
    expect(validateName('   ').valid).toBe(false);
  });

  it('refuse les caractères de chemin', () => {
    expect(validateName('src/app.ts').valid).toBe(false);
    expect(validateName('a:b').valid).toBe(false);
  });

  it('accepte un nom normal', () => {
    expect(validateName('mon-fichier.test.ts').valid).toBe(true);
  });
});
