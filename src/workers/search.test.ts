import { describe, expect, it } from 'vitest';
import { buildPattern, runSearch, type SearchableFile } from './search.worker';

const files: SearchableFile[] = [
  { id: 'a', name: 'a.ts', content: 'const alpha = 1;\nconst beta = 2;\nalpha += 3;' },
  { id: 'b', name: 'b.md', content: '# Titre\n\nAlpha en début de ligne.' },
];

const search = (query: string, options = { caseSensitive: false, wholeWord: false, useRegex: false }) =>
  runSearch({ query, options, files, maxHitsPerFile: 200 });

describe('runSearch', () => {
  it('trouve les occurrences dans tous les fichiers', () => {
    const { groups, total, error } = search('alpha');
    expect(error).toBeNull();
    expect(total).toBe(3); // deux dans a.ts, une dans b.md
    expect(groups.map((g) => g.fileName).sort()).toEqual(['a.ts', 'b.md']);
  });

  it('respecte la casse quand demandé', () => {
    expect(search('Alpha', { caseSensitive: true, wholeWord: false, useRegex: false }).total).toBe(1);
    expect(search('Alpha', { caseSensitive: false, wholeWord: false, useRegex: false }).total).toBe(3);
  });

  it('gère le mot entier', () => {
    const partiel = search('alph', { caseSensitive: false, wholeWord: false, useRegex: false });
    const entier = search('alph', { caseSensitive: false, wholeWord: true, useRegex: false });
    expect(partiel.total).toBe(3);
    expect(entier.total).toBe(0);
  });

  it('accepte les expressions régulières', () => {
    const { total } = search('const \\w+', { caseSensitive: false, wholeWord: false, useRegex: true });
    expect(total).toBe(2);
  });

  it('échappe les métacaractères en recherche littérale', () => {
    const cible: SearchableFile[] = [{ id: 'c', name: 'c.txt', content: 'prix: 3.50 et 3x50' }];
    const litteral = runSearch({
      query: '3.50',
      options: { caseSensitive: false, wholeWord: false, useRegex: false },
      files: cible,
      maxHitsPerFile: 200,
    });
    // Sans échappement, « . » matcherait aussi « 3x50 ».
    expect(litteral.total).toBe(1);
  });

  it('signale une expression régulière invalide au lieu de l’ignorer', () => {
    const { error, groups } = search('([a-z', { caseSensitive: false, wholeWord: false, useRegex: true });
    expect(error).toBeTruthy();
    expect(groups).toEqual([]);
  });

  it('renvoie les bonnes coordonnées ligne/colonne', () => {
    const { groups } = search('beta');
    const hit = groups[0].hits[0];
    expect(hit.line).toBe(2);
    expect(hit.column).toBe(7); // "const beta" → b en 7e colonne
    expect(hit.matchText).toBe('beta');
  });

  it('tronque au-delà du plafond et le signale', () => {
    const gros: SearchableFile[] = [{ id: 'g', name: 'g.txt', content: 'x\n'.repeat(500) }];
    const { groups } = runSearch({
      query: 'x',
      options: { caseSensitive: false, wholeWord: false, useRegex: false },
      files: gros,
      maxHitsPerFile: 200,
    });
    expect(groups[0].hits).toHaveLength(200);
    expect(groups[0].truncated).toBe(true);
  });

  it('ne boucle pas sur une correspondance de longueur nulle', () => {
    const { total } = search('a*', { caseSensitive: false, wholeWord: false, useRegex: true });
    expect(Number.isFinite(total)).toBe(true);
  });

  it('renvoie un résultat vide sur une requête vide', () => {
    expect(search('   ')).toEqual({ groups: [], total: 0, error: null });
  });
});

describe('buildPattern', () => {
  it('construit un motif insensible à la casse par défaut', () => {
    expect(buildPattern('abc', { caseSensitive: false, wholeWord: false, useRegex: false }).flags).toBe('gi');
  });

  it('construit un motif sensible à la casse sur demande', () => {
    expect(buildPattern('abc', { caseSensitive: true, wholeWord: false, useRegex: false }).flags).toBe('g');
  });
});
