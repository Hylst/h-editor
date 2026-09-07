/**
 * Implémentation locale du `WorkspaceStore` — 100 % navigateur.
 *
 * Répartition :
 *  - **localStorage** : métadonnées (arborescence, onglets, noms, langages).
 *    Petit, lisible de façon synchrone au démarrage, et écrit intégralement à
 *    chaque sauvegarde (quelques kilo-octets).
 *  - **IndexedDB** : contenu des fichiers, écrit **de façon incrémentale**
 *    (seuls les fichiers modifiés ou supprimés sont touchés).
 *
 * Aucune méthode ne lève : un quota dépassé devient un `SaveOutcome` en échec.
 */

import type { EditorFile, EditorFolder, EditorTab } from '@/types/editor';
import { createId } from '@/utils/ids';
import {
  idbDeleteMany,
  idbGetAll,
  idbPutMany,
  idbReplaceAll,
  isIndexedDbAvailable,
  type StoredValue,
} from '@/utils/storage/indexedDb';
import { compressText, decompressEntry } from '@/utils/storage/compression';
import type {
  ExternalChange,
  SaveOptions,
  SaveOutcome,
  StorageUsage,
  WorkspaceSnapshot,
  WorkspaceStore,
} from './types';

const META_KEY = 'editorx-workspace';
const LEGACY_KEY = 'editorx-filesystem';
const INITIALIZED_KEY = 'editorx-initialized';

interface StoredFileMeta {
  id: string;
  name: string;
  language: string;
  parentId?: string;
  /** Contenu inline : uniquement en mode dégradé (sans IndexedDB). */
  content?: string;
  /** Fichier binaire conservé en base64, non éditable. */
  binary?: boolean;
}

interface StoredMeta {
  version: 3;
  files: StoredFileMeta[];
  folders: EditorFolder[];
  tabs: EditorTab[];
  contentInIdb: boolean;
  /** Qui a écrit, et quand — sert à repérer les écritures d'un autre onglet. */
  writerId: string;
  at: number;
  /**
   * Compteur incrémenté à chaque écriture. Plus fiable qu'un horodatage :
   * deux sauvegardes peuvent tomber dans la même milliseconde, et l'horloge
   * système peut reculer.
   */
  revision: number;
}

const isQuotaError = (error: unknown): boolean =>
  error instanceof DOMException &&
  (error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22);

const safeGetItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetItem = (key: string, value: string): true | 'quota' | 'unavailable' => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    return isQuotaError(error) ? 'quota' : 'unavailable';
  }
};

export class LocalWorkspaceStore implements WorkspaceStore {
  readonly kind = 'local';

  /** Identifie cette instance (onglet) pour ignorer nos propres écritures. */
  private readonly writerId = createId();

  /** Révision de l'état que cette instance connaît (lue ou écrite par elle). */
  private knownRevision = -1;

  /** Lit l'entête de version présent dans le stockage. */
  private readStoredStamp(): { writerId: string; revision: number } | null {
    const raw = safeGetItem(META_KEY);
    if (!raw) return null;
    try {
      const meta = JSON.parse(raw) as StoredMeta;
      return { writerId: meta.writerId ?? '', revision: meta.revision ?? 0 };
    } catch {
      return null;
    }
  }

  hasBeenInitialized(): boolean {
    return safeGetItem(INITIALIZED_KEY) === 'true';
  }

  private markInitialized(): void {
    safeSetItem(INITIALIZED_KEY, 'true');
  }

  /** Migration depuis le format v1/v2 (tout le contenu en localStorage). */
  private readLegacy(): WorkspaceSnapshot | null {
    const raw = safeGetItem(LEGACY_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.files) || !Array.isArray(parsed?.folders)) return null;
      return {
        files: parsed.files.map((f: EditorFile) => ({ ...f, modified: false })),
        folders: parsed.folders,
        tabs: [],
      };
    } catch {
      return null;
    }
  }

  async load(): Promise<WorkspaceSnapshot | null> {
    const raw = safeGetItem(META_KEY);

    if (!raw) {
      const legacy = this.readLegacy();
      if (legacy) this.markInitialized();
      return legacy;
    }

    let meta: StoredMeta;
    try {
      meta = JSON.parse(raw);
    } catch {
      // Métadonnées corrompues : on ne bloque pas le démarrage.
      console.error('H Editor : métadonnées illisibles, tentative de restauration héritée.');
      return this.readLegacy();
    }

    if (!Array.isArray(meta?.files) || !Array.isArray(meta?.folders)) return this.readLegacy();

    // On mémorise ce qu'on a lu : toute écriture postérieure venue d'ailleurs
    // sera détectée avant que nous ne l'écrasions.
    this.knownRevision = meta.revision ?? 0;

    const contents = meta.contentInIdb ? await idbGetAll() : {};

    const missingContent: string[] = [];

    const files: EditorFile[] = await Promise.all(
      meta.files.map(async (f) => {
        let content = f.content;

        if (content === undefined && meta.contentInIdb) {
          const stored = contents[f.id];
          // Le contenu devrait exister : son absence signale une base amputée.
          if (stored === undefined) missingContent.push(f.name);
          else content = (await decompressEntry(stored)) ?? undefined;
          if (content === undefined && stored !== undefined) missingContent.push(f.name);
        }

        return {
          id: f.id,
          name: f.name,
          language: f.language,
          parentId: f.parentId,
          content: content ?? '',
          modified: false,
          binary: f.binary,
        };
      })
    );

    const validIds = new Set(files.map((f) => f.id));
    const tabs = (Array.isArray(meta.tabs) ? meta.tabs : []).filter((t) => validIds.has(t.fileId));

    return { files, folders: meta.folders, tabs, missingContent };
  }

  async save(snapshot: WorkspaceSnapshot, options: SaveOptions = {}): Promise<SaveOutcome> {
    const { files, folders, tabs } = snapshot;

    // Un autre onglet a-t-il écrit depuis notre dernière lecture/écriture ?
    if (!options.overwriteConflict) {
      const stored = this.readStoredStamp();
      if (stored && stored.writerId !== this.writerId && stored.revision !== this.knownRevision) {
        return {
          ok: false,
          reason: 'conflict',
          message:
            'Ce projet a été modifié dans un autre onglet. Rechargez pour récupérer ces modifications, ou forcez l’enregistrement pour les remplacer.',
        };
      }
    }

    const useIdb = isIndexedDbAvailable();

    let contentSaved = false;
    let writtenFiles = 0;

    if (useIdb) {
      if (options.full || !options.changedFileIds) {
        const entries: Record<string, StoredValue> = {};
        for (const file of files) entries[file.id] = await compressText(file.content);
        contentSaved = await idbReplaceAll(entries);
        writtenFiles = contentSaved ? files.length : 0;
      } else {
        // Écriture incrémentale : sur un projet de plusieurs Mo, réécrire tout
        // le contenu à chaque frappe saturerait le disque pour rien.
        const changed = new Set(options.changedFileIds);
        const entries: Record<string, StoredValue> = {};
        for (const file of files) {
          if (changed.has(file.id)) entries[file.id] = await compressText(file.content);
        }

        const written = Object.keys(entries).length > 0 ? await idbPutMany(entries) : true;
        const removed =
          options.removedFileIds && options.removedFileIds.length > 0
            ? await idbDeleteMany(options.removedFileIds)
            : true;

        contentSaved = written && removed;
        writtenFiles = Object.keys(entries).length;
      }
    }

    const at = Date.now();
    // On repart de la révision présente dans le stockage : en cas d'écrasement
    // forcé, le compteur reste strictement croissant pour les autres instances.
    const revision = (this.readStoredStamp()?.revision ?? this.knownRevision) + 1;

    const meta: StoredMeta = {
      version: 3,
      files: files.map((f) => ({
        id: f.id,
        name: f.name,
        language: f.language,
        parentId: f.parentId,
        ...(f.binary ? { binary: true } : {}),
        ...(contentSaved ? {} : { content: f.content }),
      })),
      folders,
      tabs,
      contentInIdb: contentSaved,
      writerId: this.writerId,
      at,
      revision,
    };

    const result = safeSetItem(META_KEY, JSON.stringify(meta));

    if (result === true) {
      try {
        localStorage.removeItem(LEGACY_KEY); // migration terminée
      } catch {
        /* sans conséquence */
      }
      this.markInitialized();
      this.knownRevision = revision;
      return { ok: true, degraded: !contentSaved, writtenFiles };
    }

    if (result === 'quota') {
      return {
        ok: false,
        reason: 'quota',
        message: contentSaved
          ? "Espace de stockage saturé : l'arborescence n'a pas pu être enregistrée."
          : 'Espace de stockage saturé : votre projet dépasse la limite du navigateur. Exportez-le en ZIP pour ne rien perdre.',
      };
    }

    return {
      ok: false,
      reason: 'unavailable',
      message:
        'Stockage local indisponible (navigation privée ?) : les modifications ne survivront pas à la fermeture.',
    };
  }

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(META_KEY);
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* rien à faire */
    }
    await idbReplaceAll({});
  }

  async estimate(files: EditorFile[]): Promise<StorageUsage | null> {
    const workspaceBytes = files.reduce((total, f) => total + f.content.length + f.name.length, 0);

    try {
      if (!navigator.storage?.estimate) return { usage: 0, quota: 0, workspaceBytes };
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return { usage, quota, workspaceBytes };
    } catch {
      return { usage: 0, quota: 0, workspaceBytes };
    }
  }

  onExternalChange(listener: (change: ExternalChange) => void): () => void {
    const handler = (event: StorageEvent) => {
      if (event.key !== META_KEY || !event.newValue) return;
      try {
        const meta = JSON.parse(event.newValue) as StoredMeta;
        // On ignore nos propres écritures (l'événement ne les émet pas, mais
        // un rechargement d'onglet peut réutiliser le même stockage).
        if (meta.writerId === this.writerId) return;
        listener({ writerId: meta.writerId, at: meta.at });
      } catch {
        /* écriture illisible : rien à signaler */
      }
    };

    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }
}
