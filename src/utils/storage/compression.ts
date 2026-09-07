/**
 * Compression du contenu stocké.
 *
 * Le code source se compresse d'un facteur 3 à 5 : à quota constant, l'utilisateur
 * peut conserver bien plus de fichiers. `CompressionStream` est disponible sur les
 * navigateurs récents ; sinon on stocke en clair, sans rien casser.
 *
 * Format retenu : les entrées compressées sont des `Uint8Array`, les entrées en clair
 * restent des `string`. IndexedDB sait stocker les deux, et un projet écrit par une
 * version antérieure (tout en `string`) reste lisible sans migration.
 */

const hasCompressionStream = (): boolean =>
  typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

/** Compresse en gzip ; renvoie la chaîne d'origine si l'API est indisponible ou échoue. */
export const compressText = async (text: string): Promise<Uint8Array | string> => {
  if (!hasCompressionStream() || text.length === 0) return text;

  try {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    const buffer = await new Response(stream).arrayBuffer();
    const compressed = new Uint8Array(buffer);

    // Sur un contenu très court, l'en-tête gzip coûte plus qu'il ne rapporte.
    return compressed.byteLength < text.length ? compressed : text;
  } catch {
    return text;
  }
};

/** Décompresse une entrée ; accepte aussi les entrées stockées en clair. */
export const decompressEntry = async (value: unknown): Promise<string | null> => {
  if (typeof value === 'string') return value;
  if (!(value instanceof Uint8Array) && !(value instanceof ArrayBuffer)) return null;

  const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
  if (!hasCompressionStream()) {
    console.warn('H Editor : contenu compressé illisible (DecompressionStream indisponible).');
    return null;
  }

  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  } catch {
    return null;
  }
};

export const isCompressionSupported = hasCompressionStream;
