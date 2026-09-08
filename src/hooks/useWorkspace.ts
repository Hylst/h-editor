import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { EditorFile, EditorFolder, EditorTab } from '@/types/editor';
import { getLanguageFromFilename } from '@/utils/fileSystem';
import {
  getCopyName,
  getNewFileName,
  getNewFolderName,
  getUniqueName,
  validateName,
} from '@/utils/fileNames';
import { getWorkspaceStore, type StorageUsage, type WorkspaceSnapshot } from '@/services/workspace';
import { createWelcomeFile } from '@/utils/welcomeFile';
import {
  journalClear,
  journalClearAll,
  journalPendingEntries,
  journalWrite,
} from '@/utils/storage/recoveryJournal';
import { createId } from '@/utils/ids';

const SAVE_DEBOUNCE_MS = 600;

export type StorageStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

export interface DeletedSnapshot {
  id: string;
  files: EditorFile[];
  folders: EditorFolder[];
  label: string;
  at: number;
}

/** Profondeur de la corbeille : au-delà, les plus anciennes entrées sont oubliées. */
const TRASH_DEPTH = 20;

/** Ids de tous les descendants d'un dossier (dossiers et fichiers). */
const collectBranch = (folderId: string, folders: EditorFolder[], files: EditorFile[]) => {
  const folderIds = new Set<string>([folderId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const folder of folders) {
      if (folder.parentId && folderIds.has(folder.parentId) && !folderIds.has(folder.id)) {
        folderIds.add(folder.id);
        grew = true;
      }
    }
  }
  const fileIds = files.filter((f) => f.parentId && folderIds.has(f.parentId)).map((f) => f.id);
  return { folderIds, fileIds };
};

/**
 * Source de vérité des fichiers et dossiers, et persistance associée.
 *
 * Extrait de `EditorLayout` (1 494 lignes à l'origine) pour que l'affichage
 * n'ait plus à connaître le stockage.
 */
export const useWorkspace = () => {
  const store = useMemo(() => getWorkspaceStore(), []);

  const [files, setFiles] = useState<EditorFile[]>([]);
  const [folders, setFolders] = useState<EditorFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>({ kind: 'idle' });
  const [restoredTabs, setRestoredTabs] = useState<EditorTab[]>([]);
  const [tabsSignature, setTabsSignature] = useState('');
  const [usage, setUsage] = useState<StorageUsage | null>(null);

  /**
   * Corbeille : pile des suppressions annulables (fichiers, dossiers, imports).
   * Auparavant limitée à la dernière action, ce qui rendait une suppression en
   * série irrécupérable dès la seconde.
   */
  const [trash, setTrash] = useState<DeletedSnapshot[]>([]);
  const pushTrash = useCallback((entry: Omit<DeletedSnapshot, 'id' | 'at'>) => {
    setTrash((prev) => [{ ...entry, id: createId(), at: Date.now() }, ...prev].slice(0, TRASH_DEPTH));
  }, []);
  const tabsRef = useRef<EditorTab[]>([]);
  const quotaWarned = useRef(false);
  const conflictWarned = useRef(false);

  // Contenu deja present dans le stockage : permet de n'ecrire que le delta.
  const persistedContent = useRef(new Map<string, string>());
  // Dernier instantane connu, pour pouvoir sauvegarder hors du cycle de rendu.
  const latest = useRef<WorkspaceSnapshot>({ files: [], folders: [], tabs: [] });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const externalChangeNotified = useRef(false);

  /** `EditorLayout` publie l'état des onglets ici pour qu'il soit persisté avec le projet. */
  const syncTabs = useCallback((tabs: EditorTab[]) => {
    tabsRef.current = tabs;
    setTabsSignature(tabs.map((t) => `${t.fileId}:${t.active ? 1 : 0}`).join('|'));
  }, []);

  // ── Chargement initial (asynchrone : IndexedDB) ───────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const snapshot = await store.load();
      if (cancelled) return;

      if (snapshot && (snapshot.files.length > 0 || snapshot.folders.length > 0)) {
        setFiles(snapshot.files);
        setFolders(snapshot.folders);
        setRestoredTabs(snapshot.tabs);
        // Ce qui vient d'être lu est, par définition, déjà persisté.
        persistedContent.current = new Map(snapshot.files.map((f) => [f.id, f.content]));

        // Un plantage a-t-il laissé des modifications non enregistrées ?
        const pending = journalPendingEntries(
          snapshot.files.map((f) => ({ id: f.id, content: f.content }))
        );

        if (pending.length > 0) {
          const noms = pending.slice(0, 3).map((e) => e.fileName).join(', ');
          const reste = pending.length - 3;
          toast.warning('Modifications non enregistrées retrouvées', {
            description: `${noms}${reste > 0 ? ` et ${reste} autre(s)` : ''}. La session précédente s’est interrompue avant la sauvegarde.`,
            duration: Infinity,
            action: {
              label: 'Restaurer',
              onClick: () => {
                setFiles((prev) =>
                  prev.map((f) => {
                    const entry = pending.find((e) => e.fileId === f.id);
                    return entry ? { ...f, content: entry.content, modified: true } : f;
                  })
                );
                journalClearAll();
                toast.success(`${pending.length} fichier(s) restauré(s)`);
              },
            },
            cancel: {
              label: 'Ignorer',
              onClick: () => journalClearAll(),
            },
          });
        }

        if (snapshot.missingContent && snapshot.missingContent.length > 0) {
          const names = snapshot.missingContent.slice(0, 3).join(', ');
          const extra = snapshot.missingContent.length - 3;
          toast.warning('Contenu introuvable dans le stockage du navigateur', {
            description: `${names}${extra > 0 ? ` et ${extra} autre(s)` : ''}. Ces fichiers sont vides. Le stockage a probablement été effacé.`,
            duration: 12000,
          });
        }
      } else if (!store.hasBeenInitialized()) {
        // Première visite uniquement : un espace vidé volontairement doit le rester.
        const welcome = createWelcomeFile();
        setFiles([welcome]);
        setRestoredTabs([{ id: createId(), fileId: welcome.id, active: true }]);
      }

      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [store]);

  // ── Sauvegarde incrémentale, différée, jamais fatale ──────────────────────

  /** Écrit l'état courant ; seuls les contenus réellement modifiés sont persistés. */
  const persistNow = useCallback(async () => {
    const snapshot = latest.current;
    const known = persistedContent.current;

    const changedFileIds = snapshot.files
      .filter((f) => known.get(f.id) !== f.content)
      .map((f) => f.id);
    const presentIds = new Set(snapshot.files.map((f) => f.id));
    const removedFileIds = [...known.keys()].filter((id) => !presentIds.has(id));
    const first = known.size === 0 && snapshot.files.length > 0;

    const result = await store.save(snapshot, { changedFileIds, removedFileIds, full: first });

    if (result.ok) {
      quotaWarned.current = false;
      persistedContent.current = new Map(snapshot.files.map((f) => [f.id, f.content]));
      // Ce qui est persisté n'a plus besoin d'être journalisé.
      journalClear(snapshot.files.map((f) => f.id));
      setStorageStatus({ kind: 'saved', at: Date.now() });
      void store.estimate(snapshot.files).then(setUsage);
    } else if (result.reason === 'conflict') {
      // On n'écrase pas : l'utilisateur tranche.
      setStorageStatus({ kind: 'error', message: result.message ?? 'Conflit détecté' });
      if (!conflictWarned.current) {
        conflictWarned.current = true;
        toast.warning('Modifications concurrentes détectées', {
          description: result.message,
          duration: Infinity,
          action: { label: 'Recharger', onClick: () => window.location.reload() },
          cancel: {
            label: 'Garder ma version',
            onClick: () => {
              conflictWarned.current = false;
              void store.save(latest.current, { full: true, overwriteConflict: true }).then((r) => {
                if (r.ok) {
                  persistedContent.current = new Map(
                    latest.current.files.map((f) => [f.id, f.content])
                  );
                  setStorageStatus({ kind: 'saved', at: Date.now() });
                  toast.success('Votre version a été conservée');
                }
              });
            },
          },
        });
      }
    } else {
      const message = result.message ?? 'Sauvegarde locale impossible';
      setStorageStatus({ kind: 'error', message });
      if (!quotaWarned.current) {
        quotaWarned.current = true; // un seul avertissement par épisode
        toast.error(message, { duration: 8000 });
      }
    }

    return result;
  }, [store]);

  useEffect(() => {
    latest.current = { files, folders, tabs: tabsRef.current };
    if (isLoading) return;

    setStorageStatus({ kind: 'saving' });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persistNow(), SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [files, folders, tabsSignature, isLoading, persistNow]);

  /**
   * Écriture immédiate quand la page passe en arrière-plan ou se ferme : sans
   * cela, les 600 ms d'anti-rebond constituaient une vraie fenêtre de perte
   * (fermer l'onglet juste après une frappe perdait la dernière modification).
   */
  useEffect(() => {
    if (isLoading) return;

    const flush = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      void persistNow();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [isLoading, persistNow]);

  /**
   * Un autre onglet a écrit : on prévient tout de suite, sans attendre que
   * l'utilisateur tape quelque chose. La sauvegarde, elle, sera de toute façon
   * refusée tant que le conflit n'est pas tranché (voir `persistNow`).
   */
  useEffect(() => {
    return store.onExternalChange(() => {
      if (externalChangeNotified.current) return;
      externalChangeNotified.current = true;

      toast.info('Projet modifié dans un autre onglet', {
        description: 'Rechargez pour récupérer ces modifications.',
        duration: 10000,
        action: { label: 'Recharger', onClick: () => window.location.reload() },
        onDismiss: () => {
          externalChangeNotified.current = false;
        },
      });
    });
  }, [store]);

  // ── Fichiers ──────────────────────────────────────────────────────────────

  /** Renvoie l'id du fichier créé (le nom définitif est calculé dans le réducteur). */
  const createFile = useCallback((parentId?: string, name?: string, content = ''): string => {
    const id = createId();

    setFiles((prev) => {
      const finalName = name ? getUniqueName(name, parentId, prev) : getNewFileName(prev, parentId);
      return [
        ...prev,
        {
          id,
          name: finalName,
          language: getLanguageFromFilename(finalName),
          content,
          modified: false,
          parentId,
        },
      ];
    });

    return id;
  }, []);

  const createFolder = useCallback((parentId?: string): string => {
    const id = createId();
    setFolders((prev) => [
      ...prev,
      { id, name: getNewFolderName(prev, parentId), parentId, expanded: true },
    ]);
    return id;
  }, []);

  const updateFileContent = useCallback((fileId: string, content: string) => {
    setFiles((prev) => {
      const next = prev.map((f) => (f.id === fileId ? { ...f, content, modified: true } : f));
      // Écriture immédiate au journal : un plantage brutal (ni `pagehide` ni
      // `visibilitychange` émis) ne doit pas emporter la dernière seconde de frappe.
      const target = next.find((f) => f.id === fileId);
      if (target && !target.binary) journalWrite(fileId, target.name, content);
      return next;
    });
  }, []);

  const markFileSaved = useCallback(
    (fileId: string, fileHandle?: FileSystemFileHandle, name?: string, diskModifiedAt?: number) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? {
                ...f,
                modified: false,
                fileHandle: fileHandle ?? f.fileHandle,
                name: name ?? f.name,
                language: name ? getLanguageFromFilename(name) : f.language,
                diskModifiedAt: diskModifiedAt ?? f.diskModifiedAt,
              }
            : f
        )
      );
    },
    []
  );

  const renameFile = useCallback((fileId: string, rawName: string): boolean => {
    const check = validateName(rawName);
    if (!check.valid) {
      toast.error(check.error);
      return false;
    }

    const wanted = rawName.trim();
    setFiles((prev) => {
      const target = prev.find((f) => f.id === fileId);
      if (!target || target.name === wanted) return prev;

      const name = getUniqueName(wanted, target.parentId, prev, fileId);
      return prev.map((f) =>
        f.id === fileId
          ? // Renommer ne touche pas au contenu : le fichier ne doit pas devenir « non sauvegardé ».
            { ...f, name, language: getLanguageFromFilename(name) }
          : f
      );
    });
    return true;
  }, []);

  const renameFolder = useCallback((folderId: string, rawName: string): boolean => {
    const check = validateName(rawName);
    if (!check.valid) {
      toast.error(check.error);
      return false;
    }

    const wanted = rawName.trim();
    setFolders((prev) => {
      const target = prev.find((f) => f.id === folderId);
      if (!target || target.name === wanted) return prev;
      const name = getUniqueName(wanted, target.parentId, prev, folderId);
      return prev.map((f) => (f.id === folderId ? { ...f, name } : f));
    });
    return true;
  }, []);

  const duplicateFile = useCallback((fileId: string): string | null => {
    const source = files.find((f) => f.id === fileId);
    if (!source) return null;

    const id = createId();
    setFiles((prev) => {
      const original = prev.find((f) => f.id === fileId);
      if (!original) return prev;
      return [
        ...prev,
        {
          ...original,
          id,
          name: getCopyName(original.name, original.parentId, prev),
          modified: false,
          fileHandle: undefined,
        },
      ];
    });
    return id;
  }, [files]);

  /** Supprime un fichier et renvoie les ids concernés (pour nettoyer onglets et panneaux). */
  const deleteFile = useCallback(
    (fileId: string): string[] => {
      const target = files.find((f) => f.id === fileId);
      if (!target) return [];

      pushTrash({ files: [target], folders: [], label: target.name });
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      return [fileId];
    },
    [files, pushTrash]
  );

  const deleteFolder = useCallback(
    (folderId: string): string[] => {
      const { folderIds, fileIds } = collectBranch(folderId, folders, files);

      pushTrash({
        files: files.filter((f) => fileIds.includes(f.id)),
        folders: folders.filter((f) => folderIds.has(f.id)),
        label: folders.find((f) => f.id === folderId)?.name ?? 'dossier',
      });

      setFolders((prev) => prev.filter((f) => !folderIds.has(f.id)));
      setFiles((prev) => prev.filter((f) => !fileIds.includes(f.id)));
      return fileIds;
    },
    [files, folders, pushTrash]
  );

  /** Restaure une entrée précise de la corbeille, ou la plus récente par défaut. */
  const restoreFromTrash = useCallback((entryId?: string): string | null => {
    let restored: DeletedSnapshot | null = null;

    setTrash((prev) => {
      const snapshot = entryId ? prev.find((e) => e.id === entryId) : prev[0];
      if (!snapshot) return prev;
      restored = snapshot;
      return prev.filter((e) => e.id !== snapshot.id);
    });

    if (!restored) return null;
    const snapshot: DeletedSnapshot = restored;

    setFiles((prev) => [...prev, ...snapshot.files.filter((f) => !prev.some((p) => p.id === f.id))]);
    setFolders((prev) => [
      ...prev,
      ...snapshot.folders.filter((f) => !prev.some((p) => p.id === f.id)),
    ]);
    return snapshot.label;
  }, []);

  /** Compatibilité : annule la dernière suppression. */
  const undoDelete = useCallback((): string | null => restoreFromTrash(), [restoreFromTrash]);

  const emptyTrash = useCallback(() => setTrash([]), []);

  const moveFile = useCallback((fileId: string, newParentId?: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === fileId);
      if (!file || file.parentId === newParentId) return prev;
      const name = getUniqueName(file.name, newParentId, prev, fileId);
      return prev.map((f) => (f.id === fileId ? { ...f, name, parentId: newParentId } : f));
    });
  }, []);

  const moveFolder = useCallback(
    (folderId: string, newParentId?: string): boolean => {
      if (folderId === newParentId) return false;

      // Un dossier ne peut pas devenir son propre descendant.
      let cursor = newParentId;
      const guard = new Set<string>();
      while (cursor) {
        if (cursor === folderId || guard.has(cursor)) return false;
        guard.add(cursor);
        cursor = folders.find((f) => f.id === cursor)?.parentId;
      }

      setFolders((prev) => {
        const folder = prev.find((f) => f.id === folderId);
        if (!folder || folder.parentId === newParentId) return prev;
        const name = getUniqueName(folder.name, newParentId, prev, folderId);
        return prev.map((f) => (f.id === folderId ? { ...f, name, parentId: newParentId } : f));
      });
      return true;
    },
    [folders]
  );

  const toggleFolder = useCallback((folderId: string) => {
    setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, expanded: !f.expanded } : f)));
  }, []);

  /** Import de fichiers (glisser-déposer, sélecteur). Renvoie les ids créés. */
  const addFiles = useCallback(
    (incoming: Omit<EditorFile, 'id' | 'parentId'>[], parentId?: string): string[] => {
      const ids = incoming.map(() => createId());

      setFiles((prev) => {
        const next = [...prev];
        incoming.forEach((file, index) => {
          const name = getUniqueName(file.name, parentId, next);
          next.push({
            ...file,
            id: ids[index],
            name,
            // Un binaire garde son langage neutre : il n'est pas coloré.
            language: file.binary ? 'plaintext' : getLanguageFromFilename(name),
            parentId,
          });
        });
        return next;
      });

      return ids;
    },
    []
  );

  const replaceWorkspace = useCallback(
    (nextFiles: EditorFile[], nextFolders: EditorFolder[]) => {
      if (files.length > 0 || folders.length > 0) {
        pushTrash({ files, folders, label: 'projet précédent' });
      }
      setFiles(nextFiles);
      setFolders(nextFolders);
    },
    [files, folders, pushTrash]
  );

  return {
    files,
    folders,
    isLoading,
    storageStatus,
    usage,
    persistNow,
    restoredTabs,
    syncTabs,
    createFile,
    createFolder,
    updateFileContent,
    markFileSaved,
    renameFile,
    renameFolder,
    duplicateFile,
    deleteFile,
    deleteFolder,
    undoDelete,
    trash,
    restoreFromTrash,
    emptyTrash,
    moveFile,
    moveFolder,
    toggleFolder,
    addFiles,
    replaceWorkspace,
  };
};
