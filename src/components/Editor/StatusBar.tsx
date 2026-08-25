import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, FileText, Loader2, MapPin, Settings, X } from 'lucide-react';
import type { EditorFile } from '@/types/editor';
import type { StorageStatus } from '@/hooks/useWorkspace';
import type { StorageUsage } from '@/services/workspace';
import type { SplitView } from '@/hooks/useSplitLayout';
import { Button } from '@/components/ui/button';
import { APP_VERSION } from '@/utils/appInfo';

interface StatusBarProps {
  activeFile: EditorFile | null;
  splitView: SplitView;
  onCloseSplit: () => void;
  cursorPosition: { line: number; column: number };
  selectionLength: number;
  storageStatus: StorageStatus;
  usage: StorageUsage | null;
  fileCount: number;
  onOpenSettings: () => void;
}

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

const StorageIndicator = ({ status }: { status: StorageStatus }) => {
  // Évite le clignotement « Enregistrement… » sur chaque frappe.
  const [visible, setVisible] = useState(status);
  useEffect(() => {
    if (status.kind !== 'saving') {
      setVisible(status);
      return;
    }
    const timer = setTimeout(() => setVisible(status), 400);
    return () => clearTimeout(timer);
  }, [status]);

  if (visible.kind === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-destructive" title={visible.message}>
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        Stockage saturé
      </span>
    );
  }
  if (visible.kind === 'saving') {
    return (
      <span className="flex items-center gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Enregistrement…
      </span>
    );
  }
  if (visible.kind === 'saved') {
    return (
      <span className="flex items-center gap-1.5" title="Sauvegarde automatique dans le navigateur">
        <Check className="h-3 w-3 text-primary" aria-hidden="true" />
        Enregistré à {formatTime(visible.at)}
      </span>
    );
  }
  return null;
};

const StatusBar = ({
  activeFile,
  splitView,
  onCloseSplit,
  cursorPosition,
  selectionLength,
  storageStatus,
  usage,
  fileCount,
  onOpenSettings,
}: StatusBarProps) => {
  const stats = useMemo(() => {
    if (!activeFile) return null;
    // Compter « mots » et « lignes » sur du base64 n'aurait aucun sens.
    if (activeFile.binary) {
      return { binary: true, bytes: Math.floor((activeFile.content.length * 3) / 4) } as const;
    }
    const content = activeFile.content;
    return {
      binary: false as const,
      lines: content.length === 0 ? 1 : content.split('\n').length,
      characters: content.length,
      words: content.trim() ? content.trim().split(/\s+/).length : 0,
    };
  }, [activeFile]);

  return (
    <footer
      className="flex h-7 items-center justify-between gap-4 overflow-x-auto border-t border-editor-border bg-primary/10 px-4 text-xs text-editor-text-muted"
      aria-label="Barre d'état"
    >
      <div className="flex items-center gap-3">
        {activeFile ? (
          <>
            <span className="flex items-center gap-1.5">
              <FileText className="h-3 w-3" aria-hidden="true" />
              {activeFile.name}
              {activeFile.modified && (
                <span className="text-primary" title="Non enregistré sur le disque">
                  ●
                </span>
              )}
            </span>
            <span className="h-3 w-px bg-editor-border" aria-hidden="true" />
            <span className="uppercase">{activeFile.language}</span>
            {stats && (
              <>
                <span className="h-3 w-px bg-editor-border" aria-hidden="true" />
                <span>
                  {stats.binary
                    ? `binaire · ${formatBytes(stats.bytes)}`
                    : `${stats.lines} lignes · ${stats.words} mots · ${stats.characters} car.`}
                </span>
              </>
            )}
          </>
        ) : (
          <span>{fileCount} fichier(s) dans le projet</span>
        )}

        {splitView !== 'none' && (
          <>
            <span className="h-3 w-px bg-editor-border" aria-hidden="true" />
            <span className="font-medium text-primary">
              Division {splitView === 'vertical' ? 'horizontale' : 'verticale'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCloseSplit}
              className="-my-1 h-5 px-2 text-xs hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="mr-1 h-3 w-3" aria-hidden="true" />
              Fermer
            </Button>
          </>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-3">
        {usage && usage.workspaceBytes > 0 && (
          <>
            <span
              className="hidden lg:inline"
              title={
                usage.quota > 0
                  ? `Projet : ${formatBytes(usage.workspaceBytes)} — origine : ${formatBytes(usage.usage)} sur ${formatBytes(usage.quota)} disponibles`
                  : `Projet : ${formatBytes(usage.workspaceBytes)}`
              }
            >
              {formatBytes(usage.workspaceBytes)}
            </span>
            <span className="hidden h-3 w-px bg-editor-border lg:inline-block" aria-hidden="true" />
          </>
        )}
        <StorageIndicator status={storageStatus} />
        <span className="h-3 w-px bg-editor-border" aria-hidden="true" />
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3" aria-hidden="true" />
          Ln {cursorPosition.line}, Col {cursorPosition.column}
          {selectionLength > 0 && ` (${selectionLength} sél.)`}
        </span>
        <span className="h-3 w-px bg-editor-border" aria-hidden="true" />
        <span>UTF-8</span>
        <span className="h-3 w-px bg-editor-border" aria-hidden="true" />
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-1 hover:text-editor-text"
          aria-label="Ouvrir les paramètres"
        >
          <Settings className="h-3 w-3" aria-hidden="true" />
          EditorX v{APP_VERSION}
        </button>
      </div>
    </footer>
  );
};

export default StatusBar;
