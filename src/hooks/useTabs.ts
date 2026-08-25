import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EditorFile, EditorTab } from '@/types/editor';
import { createId } from '@/utils/ids';

/**
 * Gestion des onglets.
 *
 * Règle fondamentale corrigée ici : **fermer un onglet ne supprime pas le fichier**.
 * L'ancienne implémentation retirait le fichier de l'espace de travail et du
 * stockage — une perte de données définitive et silencieuse.
 */
export const useTabs = (files: EditorFile[], restoredTabs: EditorTab[]) => {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const restored = useRef(false);

  /** Historique des onglets fermés, pour Ctrl+Maj+T. */
  const closedStack = useRef<string[]>([]);

  useEffect(() => {
    if (restored.current || restoredTabs.length === 0) return;
    restored.current = true;
    setTabs(restoredTabs);
  }, [restoredTabs]);

  /**
   * Signature de la composition du projet (ids seulement).
   *
   * Le tableau `files` est recréé à **chaque frappe** : un effet qui en dépend
   * s'exécuterait donc à chaque caractère saisi, alors que seuls les ajouts et
   * suppressions de fichiers nous intéressent ici.
   */
  const fileIdsSignature = useMemo(() => files.map((f) => f.id).join('|'), [files]);

  // Un fichier supprimé ailleurs (explorateur, import) ne doit pas laisser d'onglet fantôme.
  useEffect(() => {
    const aliveIds = new Set(fileIdsSignature ? fileIdsSignature.split('|') : []);
    setTabs((prev) => {
      const alive = prev.filter((tab) => aliveIds.has(tab.fileId));
      if (alive.length === prev.length) return prev;
      if (alive.length > 0 && !alive.some((t) => t.active)) alive[0] = { ...alive[0], active: true };
      return alive;
    });
  }, [fileIdsSignature]);

  const activeTab = useMemo(() => tabs.find((t) => t.active) ?? null, [tabs]);
  const activeFile = useMemo(
    () => files.find((f) => f.id === activeTab?.fileId) ?? null,
    [files, activeTab]
  );

  const openTab = useCallback((fileId: string) => {
    setTabs((prev) => {
      if (prev.some((t) => t.fileId === fileId)) {
        return prev.map((t) => ({ ...t, active: t.fileId === fileId }));
      }
      return [
        ...prev.map((t) => ({ ...t, active: false })),
        { id: createId(), fileId, active: true },
      ];
    });
  }, []);

  const activateTab = useCallback((fileId: string) => {
    setTabs((prev) => prev.map((t) => ({ ...t, active: t.fileId === fileId })));
  }, []);

  const closeTab = useCallback((fileId: string) => {
    setTabs((prev) => {
      const index = prev.findIndex((t) => t.fileId === fileId);
      if (index === -1) return prev;

      const wasActive = prev[index].active;
      const next = prev.filter((t) => t.fileId !== fileId);
      closedStack.current = [fileId, ...closedStack.current.filter((id) => id !== fileId)].slice(0, 20);

      // On active le voisin (comportement attendu d'un IDE), sans muter l'état précédent.
      if (wasActive && next.length > 0) {
        const neighbour = Math.min(index, next.length - 1);
        return next.map((tab, i) => ({ ...tab, active: i === neighbour }));
      }
      return next;
    });
  }, []);

  const closeOtherTabs = useCallback((fileId: string) => {
    setTabs((prev) => {
      closedStack.current = [
        ...prev.filter((t) => t.fileId !== fileId).map((t) => t.fileId),
        ...closedStack.current,
      ].slice(0, 20);
      return prev.filter((t) => t.fileId === fileId).map((t) => ({ ...t, active: true }));
    });
  }, []);

  const closeAllTabs = useCallback(() => {
    setTabs((prev) => {
      closedStack.current = [...prev.map((t) => t.fileId), ...closedStack.current].slice(0, 20);
      return [];
    });
  }, []);

  // Lecture via une ref : garde `reopenLastTab` stable d'un rendu à l'autre.
  const filesRef = useRef(files);
  filesRef.current = files;

  /** Rouvre le dernier onglet fermé s'il existe toujours dans l'espace de travail. */
  const reopenLastTab = useCallback((): boolean => {
    while (closedStack.current.length > 0) {
      const fileId = closedStack.current.shift()!;
      if (filesRef.current.some((f) => f.id === fileId)) {
        openTab(fileId);
        return true;
      }
    }
    return false;
  }, [openTab]);

  const moveTab = useCallback((fromFileId: string, toFileId: string) => {
    setTabs((prev) => {
      const from = prev.findIndex((t) => t.fileId === fromFileId);
      const to = prev.findIndex((t) => t.fileId === toFileId);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  return {
    tabs,
    activeTab,
    activeFile,
    openTab,
    activateTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    reopenLastTab,
    moveTab,
  };
};
