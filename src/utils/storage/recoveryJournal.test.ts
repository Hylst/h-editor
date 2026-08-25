import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  journalClear,
  journalClearAll,
  journalPendingEntries,
  journalWrite,
} from './recoveryJournal';

describe('journal de reprise', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('ne signale rien quand tout est déjà persisté', () => {
    journalWrite('a', 'a.txt', 'contenu');
    expect(journalPendingEntries([{ id: 'a', content: 'contenu' }])).toEqual([]);
  });

  it('signale une modification que la sauvegarde n’a pas reçue', () => {
    // Cas d'un plantage : la frappe est journalisée, la sauvegarde n'a pas suivi.
    journalWrite('a', 'a.txt', 'frappe la plus récente');

    const pending = journalPendingEntries([{ id: 'a', content: 'version enregistrée' }]);
    expect(pending).toHaveLength(1);
    expect(pending[0].fileName).toBe('a.txt');
    expect(pending[0].content).toBe('frappe la plus récente');
  });

  it('ignore un fichier supprimé depuis', () => {
    journalWrite('disparu', 'disparu.txt', 'contenu');
    expect(journalPendingEntries([{ id: 'autre', content: 'x' }])).toEqual([]);
  });

  it('oublie les fichiers dont la sauvegarde est confirmée', () => {
    journalWrite('a', 'a.txt', 'non enregistré');
    journalWrite('b', 'b.txt', 'non enregistré non plus');

    journalClear(['a']);

    const pending = journalPendingEntries([
      { id: 'a', content: 'autre' },
      { id: 'b', content: 'autre' },
    ]);
    expect(pending.map((e) => e.fileId)).toEqual(['b']);
  });

  it('vide entièrement le journal', () => {
    journalWrite('a', 'a.txt', 'x');
    journalClearAll();
    expect(journalPendingEntries([{ id: 'a', content: 'y' }])).toEqual([]);
  });

  it('n’inscrit pas les contenus trop volumineux (coût synchrone)', () => {
    journalWrite('gros', 'gros.txt', 'x'.repeat(600 * 1024));
    expect(journalPendingEntries([{ id: 'gros', content: 'autre' }])).toEqual([]);
  });

  it('survit à un sessionStorage corrompu', () => {
    sessionStorage.setItem('editorx-journal', '{ pas du json');
    expect(journalPendingEntries([{ id: 'a', content: 'x' }])).toEqual([]);
  });

  it('survit à un sessionStorage indisponible', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    try {
      // Ne doit pas lever : le journal est un confort, pas une garantie.
      expect(() => journalWrite('a', 'a.txt', 'x')).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it('conserve la dernière version écrite pour un même fichier', () => {
    journalWrite('a', 'a.txt', 'v1');
    journalWrite('a', 'a.txt', 'v2');
    journalWrite('a', 'a.txt', 'v3');

    const pending = journalPendingEntries([{ id: 'a', content: 'enregistré' }]);
    expect(pending).toHaveLength(1);
    expect(pending[0].content).toBe('v3');
  });
});
