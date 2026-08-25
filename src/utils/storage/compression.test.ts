// @vitest-environment node
// jsdom ne fournit pas CompressionStream : ces tests s'exécutent donc sous Node,
// où l'API existe réellement.

import { describe, expect, it } from 'vitest';
import { compressText, decompressEntry, isCompressionSupported } from './compression';

describe('compression', () => {
  it("dispose de l'API dans cet environnement", () => {
    expect(isCompressionSupported()).toBe(true);
  });

  it('réduit nettement un contenu répétitif', async () => {
    const source = 'export const valeur = 42;\n'.repeat(2000);
    const compressed = await compressText(source);

    expect(compressed).toBeInstanceOf(Uint8Array);
    expect((compressed as Uint8Array).byteLength).toBeLessThan(source.length / 5);
  });

  it('restitue le contenu à l’identique', async () => {
    const source = 'const accentué = "chaîne à écrire — avec des caractères Unicode ✅";\n'.repeat(50);
    const restored = await decompressEntry(await compressText(source));
    expect(restored).toBe(source);
  });

  it('préserve les caractères multi-octets', async () => {
    const source = '日本語のテキスト — emoji 🎉🚀 — accents éàüç';
    expect(await decompressEntry(await compressText(source))).toBe(source);
  });

  it('laisse en clair un contenu trop court pour être rentable', async () => {
    // L'en-tête gzip coûterait plus que le gain.
    const result = await compressText('ok');
    expect(typeof result).toBe('string');
  });

  it('laisse une chaîne vide inchangée', async () => {
    expect(await compressText('')).toBe('');
  });

  it('relit une valeur déjà stockée en clair (format antérieur)', async () => {
    expect(await decompressEntry('contenu hérité')).toBe('contenu hérité');
  });

  it('renvoie null sur une entrée illisible plutôt que de lever', async () => {
    expect(await decompressEntry(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(await decompressEntry(null)).toBeNull();
    expect(await decompressEntry(42)).toBeNull();
  });

  it('accepte un ArrayBuffer (relecture depuis IndexedDB)', async () => {
    const compressed = (await compressText('a'.repeat(500))) as Uint8Array;
    const asBuffer = compressed.buffer.slice(
      compressed.byteOffset,
      compressed.byteOffset + compressed.byteLength
    );
    expect(await decompressEntry(asBuffer)).toBe('a'.repeat(500));
  });
});
