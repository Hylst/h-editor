import { useState } from 'react';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { formatShortcut, type KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';

export interface PaletteCommand {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: KeyboardShortcut;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: PaletteCommand[];
}

const CommandPalette = ({ open, onOpenChange, commands }: CommandPaletteProps) => {
  const [search, setSearch] = useState('');

  const close = () => {
    onOpenChange(false);
    setSearch('');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setSearch('');
      }}
    >
      <DialogContent className="max-w-2xl gap-0 overflow-hidden border-editor-border bg-editor-sidebar p-0">
        <DialogTitle className="sr-only">Palette de commandes</DialogTitle>
        <DialogDescription className="sr-only">Recherchez et exécutez une commande de l’éditeur.</DialogDescription>
        <Command className="bg-transparent" label="Palette de commandes">
          <div className="flex items-center border-b border-editor-border px-3">
            <Search className="mr-2 h-4 w-4 text-editor-text-muted" aria-hidden="true" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Rechercher une commande…"
              className="flex-1 border-0 bg-transparent py-3 text-sm text-editor-text outline-none placeholder:text-editor-text-muted"
            />
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-editor-text-muted">
              Aucune commande trouvée.
            </Command.Empty>
            <Command.Group>
              {commands.map((command) => (
                <Command.Item
                  key={command.id}
                  value={command.label}
                  onSelect={() => {
                    command.action();
                    close();
                  }}
                  className="flex cursor-pointer items-center justify-between rounded px-3 py-2 text-editor-text transition-colors hover:bg-editor-tab-active/50 data-[selected=true]:bg-editor-tab-active"
                >
                  <span className="flex items-center gap-3">
                    {command.icon}
                    <span className="text-sm">{command.label}</span>
                  </span>
                  {command.shortcut && (
                    <kbd className="rounded bg-muted px-2 py-1 text-xs text-editor-text-muted">
                      {formatShortcut(command.shortcut)}
                    </kbd>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
};

export default CommandPalette;
