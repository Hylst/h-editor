import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EditorFile } from '@/types/editor';

export type SplitView = 'none' | 'horizontal' | 'vertical';
export type SplitPanel = 'topLeft' | 'bottomRight';

const STORAGE_KEY = 'editorx-split-state';

interface PersistedSplit {
  splitView: SplitView;
  topLeftFileId: string | null;
  bottomRightFileId: string | null;
}

const readPersisted = (): PersistedSplit => {
  const fallback: PersistedSplit = {
    splitView: 'none',
    topLeftFileId: null,
    bottomRightFileId: null,
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      splitView: ['none', 'horizontal', 'vertical'].includes(parsed?.splitView)
        ? parsed.splitView
        : 'none',
      topLeftFileId: typeof parsed?.topLeftFileId === 'string' ? parsed.topLeftFileId : null,
      bottomRightFileId:
        typeof parsed?.bottomRightFileId === 'string' ? parsed.bottomRightFileId : null,
    };
  } catch {
    // JSON corrompu : ne doit pas empêcher le démarrage de l'application.
    return fallback;
  }
};

export const useSplitLayout = (files: EditorFile[], isLoading: boolean) => {
  const [state, setState] = useState<PersistedSplit>(() => readPersisted());
  const [activePanel, setActivePanel] = useState<SplitPanel>('topLeft');

  const { splitView, topLeftFileId, bottomRightFileId } = state;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* préférence d'affichage : perte acceptable */
    }
  }, [state]);

  // Ids présents, recalculés seulement quand la composition du projet change
  // (et non à chaque frappe, où `files` est pourtant un nouveau tableau).
  const fileIdsSignature = useMemo(() => files.map((f) => f.id).join('|'), [files]);

  // Un id persistant peut désigner un fichier supprimé entre deux sessions.
  useEffect(() => {
    if (isLoading) return;
    const known = new Set(fileIdsSignature ? fileIdsSignature.split('|') : []);
    setState((prev) => {
      const exists = (id: string | null) => !!id && known.has(id);
      const topLeft = exists(prev.topLeftFileId) ? prev.topLeftFileId : null;
      const bottomRight = exists(prev.bottomRightFileId) ? prev.bottomRightFileId : null;
      if (topLeft === prev.topLeftFileId && bottomRight === prev.bottomRightFileId) return prev;
      return { ...prev, topLeftFileId: topLeft, bottomRightFileId: bottomRight };
    });
  }, [fileIdsSignature, isLoading]);

  const toggleSplit = useCallback((direction: Exclude<SplitView, 'none'>, activeFileId?: string) => {
    setState((prev) =>
      prev.splitView === direction
        ? { splitView: 'none', topLeftFileId: null, bottomRightFileId: null }
        : {
            splitView: direction,
            topLeftFileId: prev.topLeftFileId ?? activeFileId ?? null,
            bottomRightFileId: prev.bottomRightFileId ?? activeFileId ?? null,
          }
    );
    setActivePanel('topLeft');
  }, []);

  const closeSplit = useCallback(() => {
    setState({ splitView: 'none', topLeftFileId: null, bottomRightFileId: null });
    setActivePanel('topLeft');
  }, []);

  const openInPanel = useCallback((panel: SplitPanel, fileId: string) => {
    setState((prev) =>
      panel === 'topLeft' ? { ...prev, topLeftFileId: fileId } : { ...prev, bottomRightFileId: fileId }
    );
    setActivePanel(panel);
  }, []);

  const isSplit = splitView !== 'none';
  const activePanelFileId = activePanel === 'topLeft' ? topLeftFileId : bottomRightFileId;

  return {
    splitView,
    isSplit,
    topLeftFileId,
    bottomRightFileId,
    activePanel,
    activePanelFileId,
    setActivePanel,
    toggleSplit,
    closeSplit,
    openInPanel,
  };
};
