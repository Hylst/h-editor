// IndexedDB n'existe pas dans jsdom : on fournit une implémentation en mémoire.
import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorFile } from '@/types/editor';
import { LocalWorkspaceStore } from './localStore';
import { idbDeleteMany, idbGetAll, idbKeys, idbPutMany } from '@/utils/storage/indexedDb';

const file = (id: string, name: string, content: string): EditorFile => ({
  id,
  name,
  language: 'plaintext',
  content,
  modified: false,
});

const snapshot = (files: EditorFile[]) => ({ files, folders: [], tabs: [] });

describe('LocalWorkspaceStore', () => {
  beforeEach(async () => {
    localStorage.clear();
    await new LocalWorkspaceStore().clear();
  });

  it('fait un aller-retour complet', async () => {
    const store = new LocalWorkspaceStore();
    const files = [file('a', 'a.txt', 'Alpha'), file('b', 'b.txt', 'Bravo')];

    const result = await store.save(snapshot(files), { full: true });
    expect(result.ok).toBe(true);
    expect(result.degraded).toBe(false); // le contenu est bien allé dans IndexedDB

    const loaded = await store.load();
    expect(loaded!.files.map((f) => [f.name, f.content])).toEqual([
      ['a.txt', 'Alpha'],
      ['b.txt', 'Bravo'],
    ]);
    // Un fichier rechargé n'est jamais « modifié »
    expect(loaded!.files.every((f) => f.modified === false)).toBe(true);
  });

  it('garde les métadonnées légères en localStorage (le contenu part en IndexedDB)', async () => {
    const store = new LocalWorkspaceStore();
    const gros = 'x'.repeat(200_000);

    await store.save(snapshot([file('a', 'gros.txt', gros)]), { full: true });

    const meta = localStorage.getItem('editorx-workspace')!;
    expect(meta.length).toBeLessThan(1000); // ~200 Ko de contenu, mais métadonnées minuscules
    expect(meta).not.toContain(gros);
    expect((await idbGetAll())['a']).toBe(gros);
  });

  it("n'écrit que les fichiers réellement modifiés", async () => {
    const store = new LocalWorkspaceStore();
    const files = [file('a', 'a.txt', 'Alpha'), file('b', 'b.txt', 'Bravo')];
    await store.save(snapshot(files), { full: true });

    const modifies = [files[0], { ...files[1], content: 'Bravo modifié' }];
    const result = await store.save(snapshot(modifies), { changedFileIds: ['b'] });

    expect(result.ok).toBe(true);
    expect(result.writtenFiles).toBe(1); // et non 2
    expect((await idbGetAll())['b']).toBe('Bravo modifié');
  });

  it('supprime le contenu des fichiers retirés du projet', async () => {
    const store = new LocalWorkspaceStore();
    await store.save(snapshot([file('a', 'a.txt', 'A'), file('b', 'b.txt', 'B')]), { full: true });

    await store.save(snapshot([file('a', 'a.txt', 'A')]), {
      changedFileIds: [],
      removedFileIds: ['b'],
    });

    expect(await idbKeys()).toEqual(['a']); // pas d'orphelin
  });

  it('signale un quota dépassé au lieu de lever', async () => {
    const store = new LocalWorkspaceStore();
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    try {
      const result = await store.save(snapshot([file('a', 'a.txt', 'A')]), { full: true });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('quota');
      expect(result.message).toMatch(/saturé/i);
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it('survit à un localStorage totalement indisponible', async () => {
    const store = new LocalWorkspaceStore();
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn(() => {
      throw new Error('SecurityError');
    });

    try {
      const result = await store.save(snapshot([file('a', 'a.txt', 'A')]), { full: true });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('unavailable');
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it('ne renvoie rien quand aucun espace de travail n’existe', async () => {
    expect(await new LocalWorkspaceStore().load()).toBeNull();
  });

  it('migre un projet enregistré dans l’ancien format', async () => {
    localStorage.setItem(
      'editorx-filesystem',
      JSON.stringify({
        files: [{ id: 'x', name: 'vieux.txt', language: 'plaintext', content: 'hérité' }],
        folders: [],
      })
    );

    const loaded = await new LocalWorkspaceStore().load();
    expect(loaded!.files[0].content).toBe('hérité');
  });

  it('ignore un contenu de métadonnées corrompu sans lever', async () => {
    localStorage.setItem('editorx-workspace', '{ ceci n est pas du json');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await new LocalWorkspaceStore().load()).toBeNull();
    spy.mockRestore();
  });

  it('signale l’écriture d’un autre onglet, pas la sienne', async () => {
    const store = new LocalWorkspaceStore();
    const listener = vi.fn();
    const unsubscribe = store.onExternalChange(listener);

    const foreign = JSON.stringify({ version: 3, files: [], folders: [], tabs: [], writerId: 'autre-onglet', at: Date.now() });
    window.dispatchEvent(new StorageEvent('storage', { key: 'editorx-workspace', newValue: foreign }));
    expect(listener).toHaveBeenCalledTimes(1);

    // Une écriture portant notre propre identifiant ne doit rien déclencher.
    await store.save(snapshot([file('a', 'a.txt', 'A')]), { full: true });
    const mine = localStorage.getItem('editorx-workspace')!;
    window.dispatchEvent(new StorageEvent('storage', { key: 'editorx-workspace', newValue: mine }));
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    window.dispatchEvent(new StorageEvent('storage', { key: 'editorx-workspace', newValue: foreign }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('signale les contenus introuvables au lieu de rendre des fichiers vides en silence', async () => {
    const store = new LocalWorkspaceStore();
    await store.save(snapshot([file('a', 'a.txt', 'Alpha'), file('b', 'b.txt', 'Bravo')]), {
      full: true,
    });

    // Simule une base IndexedDB amputée (éviction navigateur, effacement manuel).
    await idbDeleteMany(['b']);

    const loaded = await store.load();
    expect(loaded!.missingContent).toEqual(['b.txt']);
    expect(loaded!.files.find((f) => f.name === 'a.txt')!.content).toBe('Alpha');
  });

  it('restitue fidèlement un contenu volumineux', async () => {
    const store = new LocalWorkspaceStore();
    // Un contenu répétitif : gzip doit le réduire nettement.
    const source = ('export const valeur = 42;' + String.fromCharCode(10)).repeat(2000);

    await store.save(snapshot([file('a', 'gros.ts', source)]), { full: true });

    // jsdom ne fournit pas CompressionStream : le contenu est alors stocké en
    // clair. Ce qui compte ici est que l'aller-retour soit fidèle dans les deux
    // cas ; le gain de compression est vérifié dans `compression.test.ts`.
    expect((await idbGetAll())['a']).toBeDefined();

    const loaded = await store.load();
    expect(loaded!.files[0].content).toBe(source);
  });

  it('relit un contenu écrit en clair par une version antérieure', async () => {
    const store = new LocalWorkspaceStore();
    await store.save(snapshot([file('a', 'a.txt', 'peu importe')]), { full: true });
    // Simule l'ancien format : valeur stockée en chaîne, non compressée.
    await idbPutMany({ a: 'contenu hérité en clair' });

    const loaded = await store.load();
    expect(loaded!.files[0].content).toBe('contenu hérité en clair');
  });

  it('refuse d’écraser une écriture plus récente venue d’un autre onglet', async () => {
    const mine = new LocalWorkspaceStore();
    await mine.save(snapshot([file('a', 'a.txt', 'ma version')]), { full: true });

    // Un autre onglet écrit après nous.
    const other = new LocalWorkspaceStore();
    await other.load();
    await other.save(snapshot([file('b', 'b.txt', 'sa version')]), { full: true });

    const refused = await mine.save(snapshot([file('a', 'a.txt', 'ma version modifiée')]));
    expect(refused.ok).toBe(false);
    expect(refused.reason).toBe('conflict');

    // L'utilisateur peut trancher en faveur de sa version.
    const forced = await mine.save(snapshot([file('a', 'a.txt', 'ma version modifiée')]), {
      full: true,
      overwriteConflict: true,
    });
    expect(forced.ok).toBe(true);
  });

  it('n’invente pas de conflit avec ses propres écritures successives', async () => {
    const store = new LocalWorkspaceStore();
    await store.save(snapshot([file('a', 'a.txt', 'v1')]), { full: true });
    const second = await store.save(snapshot([file('a', 'a.txt', 'v2')]), { changedFileIds: ['a'] });
    expect(second.ok).toBe(true);
  });

  it('filtre les onglets pointant vers des fichiers disparus', async () => {
    const store = new LocalWorkspaceStore();
    await store.save(
      {
        files: [file('a', 'a.txt', 'A')],
        folders: [],
        tabs: [
          { id: 't1', fileId: 'a', active: true },
          { id: 't2', fileId: 'fantome', active: false },
        ],
      },
      { full: true }
    );

    const loaded = await store.load();
    expect(loaded!.tabs.map((t) => t.fileId)).toEqual(['a']);
  });
});
