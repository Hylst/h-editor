import { useMemo, useState } from 'react';
import { Command } from 'cmdk';
import { FileCode, FileText, Search } from 'lucide-react';
import type { EditorFile, EditorFolder } from '@/types/editor';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

interface QuickOpenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: EditorFile[];
  folders: EditorFolder[];
  onSelect: (fileId: string) => void;
}

/** Chemin complet d'un fichier, affiché en gris à côté de son nom. */
const buildPath = (file: EditorFile, folders: EditorFolder[]): string => {
  const parts: string[] = [];
  let cursor = file.parentId;
  const guard = new Set<string>();

  while (cursor && !guard.has(cursor)) {
    guard.add(cursor);
    const folder = folders.find((f) => f.id === cursor);
    if (!folder) break;
    parts.unshift(folder.name);
    cursor = folder.parentId;
  }

  return parts.join('/');
};

/**
 * « Aller à un fichier » (Ctrl+P) — le raccourci le plus utilisé d'un IDE,
 * absent de la version précédente.
 */
const QuickOpen = ({ open, onOpenChange, files, folders, onSelect }: QuickOpenProps) => {
  const [search, setSearch] = useState('');

  const entries = useMemo(
    () =>
      files
        .map((file) => ({ file, path: buildPath(file, folders) }))
        .sort((a, b) => a.file.name.localeCompare(b.file.name)),
    [files, folders]
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setSearch('');
      }}
    >
      <DialogContent className="max-w-xl gap-0 overflow-hidden border-editor-border bg-editor-sidebar p-0">
        <DialogTitle className="sr-only">Aller à un fichier</DialogTitle>
        <DialogDescription className="sr-only">Recherchez un fichier du projet par son nom.</DialogDescription>
        <Command className="bg-transparent" label="Aller à un fichier">
          <div className="flex items-center border-b border-editor-border px-3">
            <Search className="mr-2 h-4 w-4 text-editor-text-muted" aria-hidden="true" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Nom du fichier…"
              className="flex-1 border-0 bg-transparent py-3 text-sm text-editor-text outline-none placeholder:text-editor-text-muted"
            />
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-editor-text-muted">
              Aucun fichier trouvé.
            </Command.Empty>
            {entries.map(({ file, path }) => (
              <Command.Item
                key={file.id}
                value={`${path}/${file.name}`}
                onSelect={() => {
                  onSelect(file.id);
                  onOpenChange(false);
                  setSearch('');
                }}
                className="flex cursor-pointer items-center gap-3 rounded px-3 py-2 text-editor-text transition-colors hover:bg-editor-tab-active/50 data-[selected=true]:bg-editor-tab-active"
              >
                {file.language === 'markdown' ? (
                  <FileText className="h-4 w-4 flex-shrink-0 text-lang-markdown" aria-hidden="true" />
                ) : (
                  <FileCode className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="truncate text-sm">{file.name}</span>
                {path && <span className="truncate text-xs text-editor-text-muted">{path}</span>}
                {file.modified && <span className="ml-auto text-xs text-primary">●</span>}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
};

export default QuickOpen;
