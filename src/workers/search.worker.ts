/**
 * Recherche globale, exécutée hors du thread principal.
 *
 * Mesuré avant : 2 146 ms de blocage sur un projet de 1 500 fichiers — pendant
 * lesquels l'interface ne répondait plus. Le calcul vit désormais ici ; le
 * thread principal ne fait plus qu'envoyer la requête et afficher le résultat.
 */

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
}

export interface SearchableFile {
  id: string;
  name: string;
  content: string;
}

export interface SearchHit {
  line: number;
  column: number;
  matchText: string;
  lineContent: string;
}

export interface SearchGroup {
  fileId: string;
  fileName: string;
  hits: SearchHit[];
  /** true si le plafond par fichier a été atteint (résultats tronqués). */
  truncated: boolean;
}

export interface SearchRequest {
  /** Identifie la requête : les réponses tardives d'une frappe antérieure sont ignorées. */
  requestId: number;
  query: string;
  options: SearchOptions;
  files: SearchableFile[];
  maxHitsPerFile: number;
}

export interface SearchResponse {
  requestId: number;
  groups: SearchGroup[];
  total: number;
  error: string | null;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildPattern = (query: string, options: SearchOptions): RegExp => {
  const source = options.useRegex ? query : escapeRegExp(query);
  const body = options.wholeWord && !options.useRegex ? `\\b${source}\\b` : source;
  return new RegExp(body, options.caseSensitive ? 'g' : 'gi');
};

/** Cœur de la recherche, partagé avec le repli synchrone (voir `useSearch`). */
export const runSearch = (request: Omit<SearchRequest, 'requestId'>): Omit<SearchResponse, 'requestId'> => {
  const { query, options, files, maxHitsPerFile } = request;

  if (!query.trim()) return { groups: [], total: 0, error: null };

  let pattern: RegExp;
  try {
    pattern = buildPattern(query, options);
  } catch (error) {
    return {
      groups: [],
      total: 0,
      error: error instanceof Error ? error.message : 'Expression régulière invalide',
    };
  }

  const groups: SearchGroup[] = [];
  let total = 0;

  for (const file of files) {
    const hits: SearchHit[] = [];
    const lines = file.content.split('\n');
    let truncated = false;

    for (let i = 0; i < lines.length; i++) {
      if (hits.length >= maxHitsPerFile) {
        truncated = true;
        break;
      }

      const line = lines[i];
      pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(line)) !== null) {
        hits.push({
          line: i + 1,
          column: match.index + 1,
          matchText: match[0],
          lineContent: line,
        });
        if (match[0].length === 0) pattern.lastIndex++;
        if (hits.length >= maxHitsPerFile) {
          truncated = true;
          break;
        }
      }
    }

    if (hits.length > 0) {
      total += hits.length;
      groups.push({ fileId: file.id, fileName: file.name, hits, truncated });
    }
  }

  return { groups, total, error: null };
};

// Le module sert aussi de source au repli synchrone : on n'installe l'écouteur
// que lorsqu'il est réellement instancié comme worker.
if (typeof self !== 'undefined' && typeof (self as unknown as Worker).postMessage === 'function') {
  self.onmessage = (event: MessageEvent<SearchRequest>) => {
    const { requestId } = event.data;
    const result = runSearch(event.data);
    (self as unknown as Worker).postMessage({ requestId, ...result } satisfies SearchResponse);
  };
}
