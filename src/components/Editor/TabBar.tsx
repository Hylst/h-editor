import { memo, useRef, useState } from 'react';
import { Circle, X } from 'lucide-react';
import type { EditorFile, EditorTab } from '@/types/editor';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface TabBarProps {
  tabs: EditorTab[];
  files: EditorFile[];
  onTabClick: (fileId: string) => void;
  onTabClose: (fileId: string) => void;
  onCloseOthers: (fileId: string) => void;
  onCloseAll: () => void;
  onReorder: (fromFileId: string, toFileId: string) => void;
}

const TabBar = ({
  tabs,
  files,
  onTabClick,
  onTabClose,
  onCloseOthers,
  onCloseAll,
  onReorder,
}: TabBarProps) => {
  const [dragOverFileId, setDragOverFileId] = useState<string | null>(null);
  const draggedFileId = useRef<string | null>(null);

  if (tabs.length === 0) return null;

  return (
    <div
      className="flex h-10 items-center overflow-x-auto border-b border-editor-border bg-editor-tab-inactive"
      role="tablist"
      aria-label="Fichiers ouverts"
    >
      {tabs.map((tab) => {
        const file = files.find((f) => f.id === tab.fileId);
        if (!file) return null;

        return (
          <ContextMenu key={tab.id}>
            <ContextMenuTrigger asChild>
              <div
                role="tab"
                aria-selected={tab.active}
                tabIndex={tab.active ? 0 : -1}
                draggable
                onDragStart={() => {
                  draggedFileId.current = file.id;
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggedFileId.current && draggedFileId.current !== file.id) {
                    setDragOverFileId(file.id);
                  }
                }}
                onDragLeave={() => setDragOverFileId((id) => (id === file.id ? null : id))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedFileId.current && draggedFileId.current !== file.id) {
                    onReorder(draggedFileId.current, file.id);
                  }
                  draggedFileId.current = null;
                  setDragOverFileId(null);
                }}
                onDragEnd={() => {
                  draggedFileId.current = null;
                  setDragOverFileId(null);
                }}
                onClick={() => onTabClick(file.id)}
                onAuxClick={(e) => {
                  // Clic milieu : fermeture rapide, comme dans un navigateur.
                  if (e.button === 1) {
                    e.preventDefault();
                    onTabClose(file.id);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onTabClick(file.id);
                  }
                }}
                className={`group flex h-full cursor-pointer items-center gap-2 border-r border-editor-border px-3 transition-colors ${
                  tab.active
                    ? 'bg-editor-tab-active text-editor-text'
                    : 'bg-editor-tab-inactive text-editor-text-muted hover:bg-editor-tab-active/50'
                } ${dragOverFileId === file.id ? 'border-l-2 border-l-primary' : ''}`}
                title={file.name}
              >
                <span className="max-w-[150px] truncate text-sm font-medium">{file.name}</span>
                {file.modified && (
                  <Circle
                    className="h-2 w-2 flex-shrink-0 fill-primary text-primary"
                    aria-label="Non enregistré sur le disque"
                  />
                )}
                {/* Toujours visible au clavier et au tactile (auparavant opacity-0 au repos). */}
                <button
                  type="button"
                  className="ml-1 rounded p-0.5 text-editor-text-muted opacity-60 transition-opacity hover:bg-editor-background hover:text-editor-text focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(file.id);
                  }}
                  aria-label={`Fermer l'onglet ${file.name}`}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => onTabClose(file.id)}>Fermer</ContextMenuItem>
              <ContextMenuItem onClick={() => onCloseOthers(file.id)}>Fermer les autres</ContextMenuItem>
              <ContextMenuItem onClick={onCloseAll}>Tout fermer</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
    </div>
  );
};

/** La barre d'onglets ne dépend que des noms et du drapeau « modifié ». */
const sameTabs = (prev: TabBarProps, next: TabBarProps): boolean => {
  if (prev.tabs.length !== next.tabs.length) return false;

  for (let i = 0; i < prev.tabs.length; i++) {
    const a = prev.tabs[i];
    const b = next.tabs[i];
    if (a.id !== b.id || a.fileId !== b.fileId || a.active !== b.active) return false;

    const fa = prev.files.find((f) => f.id === a.fileId);
    const fb = next.files.find((f) => f.id === b.fileId);
    if (fa?.name !== fb?.name || fa?.modified !== fb?.modified) return false;
  }

  return true;
};

export default memo(TabBar, sameTabs);
