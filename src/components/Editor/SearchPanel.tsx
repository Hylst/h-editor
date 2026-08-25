import { useCallback, useState } from 'react';
import { AlertCircle, CaseSensitive, ChevronDown, ChevronRight, FileText, Loader2, Regex, Replace, Search, WholeWord, X } from 'lucide-react';
import type { EditorFile } from '@/types/editor';
import { useSearch } from '@/hooks/useSearch';
import { buildPattern, type SearchHit, type SearchOptions } from '@/workers/search.worker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface SearchPanelProps {
  files: EditorFile[];
  /** Largeur en pixels, pilotée par la poignée de redimensionnement. */
  width: number;
  onClose: () => void;
  onResultClick: (fileId: string, line: number, column: number) => void;
  onReplace: (replacements: { fileId: string; content: string }[]) => void;
}

const SearchPanel = ({ files, width, onClose, onResultClick, onReplace }: SearchPanelProps) => {
  const [query, setQuery] = useState('');
  const [replaceValue, setReplaceValue] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [options, setOptions] = useState<SearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    useRegex: false,
  });
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());

  // Le calcul vit dans un Web Worker : l'interface ne se fige plus sur un gros
  // projet (2,1 s de blocage mesurées à 1 500 fichiers avant cette bascule).
  const { groups, total, error, pending } = useSearch(files, query, options);

  const toggleCollapsed = useCallback((fileId: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }, []);

  const replaceIn = useCallback(
    (fileIds: string[]) => {
      if (!query.trim() || error) return;

      let pattern: RegExp;
      try {
        pattern = buildPattern(query, options);
      } catch {
        return;
      }

      const replacements = fileIds
        .map((fileId) => {
          const file = files.find((f) => f.id === fileId);
          if (!file || file.binary) return null; // jamais de regex sur du base64
          pattern.lastIndex = 0;
          const content = file.content.replace(pattern, replaceValue);
          return content === file.content ? null : { fileId, content };
        })
        .filter((r): r is { fileId: string; content: string } => r !== null);

      if (replacements.length > 0) onReplace(replacements);
    },
    [query, options, replaceValue, files, error, onReplace]
  );

  const highlight = (hit: SearchHit) => {
    const start = Math.max(0, hit.column - 1);
    const end = start + hit.matchText.length;
    // Contexte tronqué à gauche pour les lignes très longues
    const offset = start > 40 ? start - 30 : 0;
    const prefix = hit.lineContent.slice(offset, start);
    const suffix = hit.lineContent.slice(end, end + 80);

    return (
      <>
        {offset > 0 && <span className="text-editor-text-muted">…</span>}
        <span className="text-editor-text-muted">{prefix}</span>
        <mark className="rounded bg-search-match-bg px-0.5 font-medium text-search-match-text">
          {hit.matchText}
        </mark>
        <span className="text-editor-text-muted">{suffix}</span>
      </>
    );
  };

  return (
    <aside
      className="flex h-full flex-shrink-0 flex-col bg-editor-sidebar"
      style={{ width }}
      aria-label="Recherche dans les fichiers"
    >
      <div className="flex items-center justify-between border-b border-editor-border p-3">
        <span className="flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="text-sm font-medium text-editor-text">Rechercher</span>
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} aria-label="Fermer la recherche">
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="space-y-2 border-b border-editor-border p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-editor-text-muted"
            aria-hidden="true"
          />
          <Input
            placeholder="Rechercher dans les fichiers…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-editor-border bg-editor-background pl-8 text-sm text-editor-text"
            aria-label="Terme à rechercher"
            autoFocus
          />
        </div>

        <div className="flex items-center gap-1">
          {(
            [
              { key: 'caseSensitive', icon: CaseSensitive, label: 'Respecter la casse' },
              { key: 'wholeWord', icon: WholeWord, label: 'Mot entier' },
              { key: 'useRegex', icon: Regex, label: 'Expression régulière' },
            ] as const
          ).map(({ key, icon: Icon, label }) => (
            <Tooltip key={key} delayDuration={300}>
              <TooltipTrigger asChild>
                <Toggle
                  pressed={options[key]}
                  onPressedChange={(pressed) => setOptions((prev) => ({ ...prev, [key]: pressed }))}
                  size="sm"
                  className="h-7 w-7 p-0 data-[state=on]:bg-primary/20"
                  aria-label={label}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}

          <span className="flex-1" />

          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => setShowReplace((v) => !v)}
            aria-expanded={showReplace}
          >
            <Replace className="h-3 w-3" aria-hidden="true" />
            Remplacer
          </Button>
        </div>

        {showReplace && (
          <div className="space-y-2">
            <div className="relative">
              <Replace
                className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-editor-text-muted"
                aria-hidden="true"
              />
              <Input
                placeholder="Remplacer par…"
                value={replaceValue}
                onChange={(e) => setReplaceValue(e.target.value)}
                className="border-editor-border bg-editor-background pl-8 text-sm text-editor-text"
                aria-label="Texte de remplacement"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => replaceIn(groups.map((g) => g.fileId))}
              disabled={total === 0}
            >
              Tout remplacer ({total})
            </Button>
          </div>
        )}

        {error && (
          <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
            <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>

      {query && !error && (
        <p
          className="flex items-center gap-1.5 border-b border-editor-border px-3 py-2 text-xs text-editor-text-muted"
          aria-live="polite"
        >
          {pending ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              Recherche…
            </>
          ) : (
            <>
              {total} résultat{total !== 1 ? 's' : ''} dans {groups.length} fichier
              {groups.length !== 1 ? 's' : ''}
            </>
          )}
        </p>
      )}

      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {groups.map((group) => {
            const collapsed = collapsedFiles.has(group.fileId);
            return (
              <div key={group.fileId}>
                <button
                  type="button"
                  onClick={() => toggleCollapsed(group.fileId)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-editor-tab-hover"
                  aria-expanded={!collapsed}
                >
                  {collapsed ? (
                    <ChevronRight className="h-3 w-3 flex-shrink-0 text-editor-text-muted" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-3 w-3 flex-shrink-0 text-editor-text-muted" aria-hidden="true" />
                  )}
                  <FileText className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                  <span className="flex-1 truncate text-sm text-editor-text">{group.fileName}</span>
                  <span className="rounded bg-editor-background px-1.5 py-0.5 text-xs text-editor-text-muted">
                    {group.hits.length}
                    {group.truncated ? '+' : ''}
                  </span>
                </button>

                {!collapsed && (
                  <div className="ml-5 border-l border-editor-border">
                    {group.hits.map((hit, index) => (
                      <button
                        type="button"
                        key={`${group.fileId}-${hit.line}-${hit.column}-${index}`}
                        className="block w-full truncate px-3 py-1 text-left font-mono text-xs hover:bg-editor-tab-hover"
                        onClick={() => onResultClick(group.fileId, hit.line, hit.column)}
                      >
                        <span className="mr-2 text-editor-text-muted">L{hit.line}</span>
                        {highlight(hit)}
                      </button>
                    ))}
                    {showReplace && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-full text-xs"
                        onClick={() => replaceIn([group.fileId])}
                      >
                        Remplacer dans ce fichier
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {query && !error && !pending && groups.length === 0 && (
            <p className="py-8 text-center text-sm text-editor-text-muted">Aucun résultat</p>
          )}
          {!query && (
            <p className="py-8 text-center text-sm text-editor-text-muted">
              Tapez pour rechercher dans tous les fichiers
            </p>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
};

export default SearchPanel;
