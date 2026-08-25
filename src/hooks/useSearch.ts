import { useEffect, useMemo, useRef, useState } from 'react';
import type { EditorFile } from '@/types/editor';
import {
  runSearch,
  type SearchGroup,
  type SearchOptions,
  type SearchRequest,
  type SearchResponse,
} from '@/workers/search.worker';

/** Au-delà, l'affichage devient inutilisable et coûteux. */
export const MAX_HITS_PER_FILE = 200;
const DEBOUNCE_MS = 200;

export interface SearchState {
  groups: SearchGroup[];
  total: number;
  error: string | null;
  /** true tant que le worker calcule : permet d'afficher un état d'attente. */
  pending: boolean;
}

const createWorker = (): Worker | null => {
  try {
    if (typeof Worker === 'undefined') return null;
    return new Worker(new URL('../workers/search.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    // Navigateur sans worker de module, ou contexte restreint : on calculera
    // sur le thread principal plutôt que de priver l'utilisateur de recherche.
    return null;
  }
};

/**
 * Recherche globale, déportée dans un Web Worker.
 *
 * Repli synchrone si les workers sont indisponibles : le comportement reste
 * identique, seule la fluidité change.
 */
export const useSearch = (files: EditorFile[], query: string, options: SearchOptions): SearchState => {
  const [state, setState] = useState<SearchState>({
    groups: [],
    total: 0,
    error: null,
    pending: false,
  });

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  // Les binaires (base64) sont exclus : les fouiller n'a pas de sens et un
  // remplacement y détruirait le fichier.
  const searchable = useMemo(
    () => files.filter((f) => !f.binary).map((f) => ({ id: f.id, name: f.name, content: f.content })),
    [files]
  );

  useEffect(() => {
    workerRef.current = createWorker();
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      requestIdRef.current++; // invalide toute réponse en vol
      setState({ groups: [], total: 0, error: null, pending: false });
      return;
    }

    const requestId = ++requestIdRef.current;
    setState((prev) => ({ ...prev, pending: true }));

    const timer = setTimeout(() => {
      const request: SearchRequest = {
        requestId,
        query,
        options,
        files: searchable,
        maxHitsPerFile: MAX_HITS_PER_FILE,
      };

      const worker = workerRef.current;
      if (!worker) {
        const result = runSearch(request);
        if (requestId === requestIdRef.current) setState({ ...result, pending: false });
        return;
      }

      const onMessage = (event: MessageEvent<SearchResponse>) => {
        // Une frappe plus récente a pris le relais : réponse périmée.
        if (event.data.requestId !== requestIdRef.current) return;
        worker.removeEventListener('message', onMessage);
        setState({
          groups: event.data.groups,
          total: event.data.total,
          error: event.data.error,
          pending: false,
        });
      };

      worker.addEventListener('message', onMessage);
      worker.postMessage(request);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, options, searchable]);

  return state;
};
