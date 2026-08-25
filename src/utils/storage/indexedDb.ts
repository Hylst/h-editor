/**
 * Wrapper IndexedDB minimal (sans dépendance externe).
 *
 * Sert à stocker le CONTENU des fichiers, qui dépasse largement le quota de
 * localStorage (~5 Mo). Les métadonnées restent en localStorage : elles sont
 * petites et doivent être lisibles de façon synchrone au démarrage.
 */

const DB_NAME = 'editorx';
const DB_VERSION = 1;
const STORE_CONTENT = 'file-content';

let dbPromise: Promise<IDBDatabase | null> | null = null;

/** IndexedDB peut être absent (vieux navigateur) ou bloqué (navigation privée, iframe). */
export const isIndexedDbAvailable = (): boolean => {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
};

const openDb = (): Promise<IDBDatabase | null> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    if (!isIndexedDbAvailable()) {
      resolve(null);
      return;
    }

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_CONTENT)) {
        db.createObjectStore(STORE_CONTENT);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
};

/** Exécute une transaction et attend sa validation complète. */
const runTransaction = async (
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => void
): Promise<boolean> => {
  const db = await openDb();
  if (!db) return false;

  return new Promise((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE_CONTENT, mode);
    } catch {
      resolve(false);
      return;
    }

    try {
      work(tx.objectStore(STORE_CONTENT));
    } catch {
      resolve(false);
      return;
    }

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
};

/** Valeur stockée : texte brut, ou binaire compressé (gzip). */
export type StoredValue = string | Uint8Array;

export const idbGet = async (key: string): Promise<StoredValue | null> => {
  const db = await openDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE_CONTENT, 'readonly').objectStore(STORE_CONTENT).get(key);
      request.onsuccess = () => resolve((request.result as StoredValue) ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
};

export const idbGetAll = async (): Promise<Record<string, StoredValue>> => {
  const db = await openDb();
  if (!db) return {};

  return new Promise((resolve) => {
    const result: Record<string, StoredValue> = {};
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE_CONTENT, 'readonly');
    } catch {
      resolve({});
      return;
    }
    const request = tx.objectStore(STORE_CONTENT).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        result[String(cursor.key)] = cursor.value as StoredValue;
        cursor.continue();
      } else {
        resolve(result);
      }
    };
    request.onerror = () => resolve(result);
    tx.onabort = () => resolve(result);
  });
};

/** Écrit uniquement les entrées fournies (sauvegarde incrémentale). */
export const idbPutMany = (entries: Record<string, StoredValue>): Promise<boolean> =>
  runTransaction('readwrite', (store) => {
    for (const [key, value] of Object.entries(entries)) store.put(value, key);
  });

/** Supprime les entrées des fichiers retirés du projet. */
export const idbDeleteMany = (keys: string[]): Promise<boolean> =>
  runTransaction('readwrite', (store) => {
    for (const key of keys) store.delete(key);
  });

/** Remplace intégralement le contenu du store (première sauvegarde, import). */
export const idbReplaceAll = (entries: Record<string, StoredValue>): Promise<boolean> =>
  runTransaction('readwrite', (store) => {
    store.clear();
    for (const [key, value] of Object.entries(entries)) store.put(value, key);
  });

/** Liste les clés présentes, pour repérer d'éventuels orphelins. */
export const idbKeys = async (): Promise<string[]> => {
  const db = await openDb();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const request = db
        .transaction(STORE_CONTENT, 'readonly')
        .objectStore(STORE_CONTENT)
        .getAllKeys();
      request.onsuccess = () => resolve((request.result as IDBValidKey[]).map(String));
      request.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
};
