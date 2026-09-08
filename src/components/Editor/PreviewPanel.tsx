import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  EyeOff,
  FileCode2,
  Maximize2,
  Minimize2,
  Monitor,
  RefreshCw,
  Smartphone,
  Tablet,
  Terminal,
  Trash2,
} from 'lucide-react';
import type { EditorFile, EditorFolder } from '@/types/editor';
import { Button } from '@/components/ui/button';
import { renderMarkdown } from '@/utils/markdown';
import {
  assembleSite,
  buildFilePath,
  describeMissing,
  findSourceFile,
  isHtmlEntry,
  type MissingResource,
} from '@/utils/sitePreview';
import {
  injectConsoleBridge,
  parseConsoleMessage,
  PREVIEW_EVAL_CHANNEL,
  type ConsoleEntry,
} from '@/utils/previewConsole';
import { Input } from '@/components/ui/input';

interface PreviewPanelProps {
  content: string;
  language: string;
  onClose: () => void;
  /** Fichier prévisualisé : sert de point d'entrée à l'assemblage du site. */
  file?: EditorFile | null;
  /** Projet complet : permet de résoudre les CSS, scripts et images liés. */
  files?: EditorFile[];
  folders?: EditorFolder[];
  /** Aperçu occupant toute la fenêtre. */
  fullScreen?: boolean;
  onToggleFullScreen?: () => void;
  /** Ouvre un fichier du projet dans l'éditeur (depuis la liste des manques). */
  onOpenFile?: (fileId: string) => void;
}

/** Au-delà, les entrées les plus anciennes sont oubliées (une page peut boucler). */
const MAX_CONSOLE_ENTRIES = 200;

const LEVEL_STYLES: Record<ConsoleEntry['level'], string> = {
  error: 'text-destructive',
  warn: 'text-amber-500 dark:text-amber-400',
  info: 'text-primary',
  debug: 'text-editor-text-muted',
  log: 'text-editor-text',
  input: 'text-editor-text-muted',
  result: 'text-primary',
};

const LEVEL_MARKS: Record<ConsoleEntry['level'], string> = {
  error: '✕',
  warn: '!',
  info: 'i',
  debug: '·',
  log: '›',
  input: '❯',
  result: '←',
};

/** Formats d'écran proposés pour éprouver le responsive. */
const VIEWPORTS = [
  { id: 'desktop', label: 'Bureau', icon: Monitor, width: null },
  { id: 'tablet', label: 'Tablette', icon: Tablet, width: 768 },
  { id: 'mobile', label: 'Mobile', icon: Smartphone, width: 375 },
] as const;

type ViewportId = (typeof VIEWPORTS)[number]['id'];

/**
 * Aperçu Markdown et HTML.
 *
 * - Le Markdown est désinfecté (DOMPurify) avant injection : un fichier importé
 *   par ZIP/JSON ne peut pas exécuter de script dans l'origine de l'application.
 * - Le HTML est rendu dans une iframe `sandbox` sans `allow-same-origin` : les
 *   scripts de la page s'exécutent, mais dans une origine opaque, sans accès au
 *   stockage d'H Editor. Leur `console.*` est relayée via `postMessage`.
 */
const PreviewPanel = ({
  content,
  language,
  onClose,
  file = null,
  files = [],
  folders = [],
  fullScreen = false,
  onToggleFullScreen,
  onOpenFile,
}: PreviewPanelProps) => {
  const [debounced, setDebounced] = useState(content);
  const [consoleOpen, setConsoleOpen] = useState(false);
  /** Page actuellement affichée dans l'aperçu (navigation entre pages du site). */
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const [viewport, setViewport] = useState<ViewportId>('desktop');
  const [missingOpen, setMissingOpen] = useState(false);
  /** Expression en cours de saisie dans la console. */
  const [expression, setExpression] = useState('');
  /** Historique des expressions, parcouru aux flèches haut/bas. */
  const commandHistory = useRef<string[]>([]);
  const historyIndex = useRef(-1);
  const nextId = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const isHtml = language === 'html';

  // L'aperçu ne doit pas être recalculé à chaque frappe sur un gros document.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(content), 150);
    return () => clearTimeout(timer);
  }, [content]);

  const html = useMemo(
    () => (language === 'markdown' ? renderMarkdown(debounced) : ''),
    [debounced, language]
  );

  /** Fichier réellement affiché : celui édité, ou la page vers laquelle on a navigué. */
  const displayedFile = useMemo(() => {
    if (!isHtml) return null;
    if (currentPageId) return files.find((f) => f.id === currentPageId) ?? file;
    return file;
  }, [isHtml, currentPageId, files, file]);

  /**
   * Document servi à l'iframe.
   *
   * Le site est assemblé à partir du projet : feuilles de styles, scripts,
   * modules et images sont résolus en contenu inline ou en `data:` URI.
   * Le pont de console est ajouté par-dessus.
   */
  const { srcDoc, missing } = useMemo(() => {
    if (!isHtml) return { srcDoc: '', missing: [] as MissingResource[] };

    if (displayedFile && files.length > 0) {
      // Le contenu en cours d'édition prime sur la version enregistrée.
      const live =
        displayedFile.id === file?.id ? { ...displayedFile, content: debounced } : displayedFile;
      const assembled = assembleSite(
        files.map((f) => (f.id === live.id ? live : f)),
        folders,
        live.id
      );
      if (assembled) {
        return { srcDoc: injectConsoleBridge(assembled.html), missing: assembled.missing };
      }
    }

    // Repli : fichier isolé, sans projet autour.
    return { srcDoc: injectConsoleBridge(debounced), missing: [] as MissingResource[] };
  }, [isHtml, displayedFile, files, folders, debounced, file]);

  // Chaque nouveau rendu repart d'une console vierge.
  useEffect(() => {
    if (isHtml) setEntries([]);
  }, [srcDoc, isHtml]);

  useEffect(() => {
    if (!isHtml) return;

    const onMessage = (event: MessageEvent) => {
      const parsed = parseConsoleMessage(event.data);
      if (!parsed) return;

      setEntries((prev) => {
        const next = [...prev, { ...parsed, id: nextId.current++, at: Date.now() }];
        return next.length > MAX_CONSOLE_ENTRIES ? next.slice(-MAX_CONSOLE_ENTRIES) : next;
      });
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [isHtml]);

  // Navigation entre les pages du site prévisualisé.
  useEffect(() => {
    if (!isHtml) return;

    const onNavigate = (event: MessageEvent) => {
      const data = event.data as { channel?: string; href?: string } | null;
      if (!data || data.channel !== 'editorx-preview-navigate' || !data.href) return;

      const from = displayedFile ? buildFilePath(displayedFile, folders) : '';
      const targetPath = from
        ? // Résolution relative à la page courante.
          [...from.split('/').slice(0, -1), ...data.href.split('/')]
            .reduce<string[]>((stack, segment) => {
              if (segment === '' || segment === '.') return stack;
              if (segment === '..') return stack.slice(0, -1);
              return [...stack, segment];
            }, [])
            .join('/')
        : data.href;

      const page = files.find((f) => buildFilePath(f, folders) === targetPath && isHtmlEntry(f));
      if (!page) {
        setEntries((prev) => [
          ...prev,
          {
            id: nextId.current++,
            level: 'warn',
            text: `Page introuvable : ${data.href}`,
            at: Date.now(),
          },
        ]);
        return;
      }

      setHistory((prev) => [...prev, displayedFile?.id ?? '']);
      setCurrentPageId(page.id);
    };

    window.addEventListener('message', onNavigate);
    return () => window.removeEventListener('message', onNavigate);
  }, [isHtml, displayedFile, files, folders]);

  // Revenir au fichier édité quand on change d'onglet.
  useEffect(() => {
    setCurrentPageId(null);
    setHistory([]);
  }, [file?.id]);

  useEffect(() => {
    if (consoleOpen) logEndRef.current?.scrollIntoView({ block: 'end' });
  }, [entries, consoleOpen]);

  const errorCount = entries.filter((e) => e.level === 'error').length;

  /** Ajoute une entrée à la console, en respectant le plafond. */
  const pushEntry = useCallback((level: ConsoleEntry['level'], text: string) => {
    setEntries((prev) => {
      const next = [...prev, { id: nextId.current++, level, text, at: Date.now() }];
      return next.length > MAX_CONSOLE_ENTRIES ? next.slice(-MAX_CONSOLE_ENTRIES) : next;
    });
  }, []);

  /** Évalue une expression dans la page prévisualisée. */
  const runExpression = useCallback(() => {
    const code = expression.trim();
    if (!code) return;

    const frame = frameRef.current?.contentWindow;
    if (!frame) {
      pushEntry('error', 'Aperçu indisponible');
      return;
    }

    pushEntry('input', code);
    commandHistory.current = [code, ...commandHistory.current.filter((c) => c !== code)].slice(0, 50);
    historyIndex.current = -1;
    setExpression('');

    // L'évaluation a lieu dans l'iframe : le résultat revient par le pont console.
    frame.postMessage({ channel: PREVIEW_EVAL_CHANNEL, code }, '*');
  }, [expression, pushEntry]);

  const refresh = useCallback(() => {
    // Un espace en fin de document suffit à forcer un nouveau `srcDoc`.
    setDebounced((prev) => (prev.endsWith(' ') ? prev.slice(0, -1) : `${prev} `));
  }, []);

  return (
    <div className="flex h-full w-full flex-col border-l border-editor-border bg-card">
      <div className="flex h-10 items-center justify-between border-b border-editor-border bg-editor-tab-inactive px-4">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-editor-text">
          <FileCode2 className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">
            {isHtml ? 'Aperçu HTML' : 'Aperçu Markdown'}
            {currentPageId && displayedFile ? ` (${displayedFile.name})` : ''}
          </span>
          {missing.length > 0 && (
            <button
              type="button"
              onClick={() => setMissingOpen((open) => !open)}
              className="flex flex-shrink-0 items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-600 hover:bg-amber-500/25 dark:text-amber-400"
              aria-expanded={missingOpen}
              aria-label={`${missing.length} ressource(s) introuvable(s)`}
              title={missing.map(describeMissing).join('\n')}
            >
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              {missing.length}
            </button>
          )}
        </span>
        <div className="flex items-center gap-1">
          {isHtml && history.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setHistory((prev) => {
                  const precedent = prev[prev.length - 1];
                  setCurrentPageId(precedent || null);
                  return prev.slice(0, -1);
                });
              }}
              aria-label="Page précédente"
              title="Page précédente"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          {isHtml &&
            VIEWPORTS.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant="ghost"
                size="icon"
                className={`h-7 w-7 ${viewport === id ? 'bg-primary/15 text-primary' : ''}`}
                onClick={() => setViewport(id)}
                aria-pressed={viewport === id}
                aria-label={`Format ${label}`}
                title={`Format ${label}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </Button>
            ))}
          {isHtml && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={() => setConsoleOpen((open) => !open)}
                aria-pressed={consoleOpen}
                aria-label="Afficher la console"
              >
                <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
                Console
                {entries.length > 0 && (
                  <span
                    className={`rounded px-1 text-[10px] ${
                      errorCount > 0
                        ? 'bg-destructive text-destructive-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {entries.length}
                  </span>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={refresh}
                aria-label="Rafraîchir l’aperçu"
                title="Rafraîchir l’aperçu"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </Button>
            </>
          )}
          {onToggleFullScreen && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onToggleFullScreen}
              aria-label={fullScreen ? 'Quitter l’aperçu plein écran' : 'Aperçu plein écran'}
              title={`${fullScreen ? 'Quitter le plein écran' : 'Aperçu plein écran'} (Ctrl+Maj+V)`}
            >
              {fullScreen ? (
                <Minimize2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
            aria-label="Masquer l’aperçu"
            title="Masquer l’aperçu"
          >
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {isHtml ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Liste des ressources introuvables, ouvrable d'un clic sur le compteur. */}
          {missingOpen && missing.length > 0 && (
            <section
              className="max-h-40 overflow-auto border-b border-editor-border bg-amber-500/5 p-2"
              aria-label="Ressources introuvables"
            >
              {missing.map((manque: MissingResource, index) => {
                const source = findSourceFile(manque, files, folders);
                return (
                  <button
                    key={`${manque.sourcePath}-${manque.reference}-${index}`}
                    type="button"
                    disabled={!source || !onOpenFile}
                    onClick={() => source && onOpenFile?.(source.id)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs text-editor-text hover:bg-editor-tab-hover disabled:cursor-default disabled:opacity-70"
                    title={source ? `Ouvrir ${manque.sourcePath}` : undefined}
                  >
                    <AlertTriangle
                      className="h-3 w-3 flex-shrink-0 text-amber-600 dark:text-amber-400"
                      aria-hidden="true"
                    />
                    <span className="truncate">{describeMissing(manque)}</span>
                    {source && onOpenFile && (
                      <ChevronRight className="ml-auto h-3 w-3 flex-shrink-0" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </section>
          )}

          <div
            className={`flex min-h-0 flex-1 justify-center ${
              viewport === 'desktop' ? '' : 'overflow-auto bg-editor-background p-3'
            }`}
          >
            <iframe
              ref={frameRef}
              title="Aperçu HTML"
              className={`bg-white ${
                viewport === 'desktop'
                  ? 'h-full w-full'
                  : 'h-full flex-shrink-0 rounded border border-editor-border shadow-lg'
              }`}
              style={
                viewport === 'desktop'
                  ? undefined
                  : { width: VIEWPORTS.find((v) => v.id === viewport)!.width! }
              }
              sandbox="allow-scripts allow-forms allow-popups allow-modals"
              srcDoc={srcDoc}
            />
          </div>

          {consoleOpen && (
            <section
              className="flex h-48 flex-col border-t border-editor-border bg-editor-background"
              aria-label="Console de l’aperçu"
            >
              <div className="flex items-center justify-between border-b border-editor-border px-3 py-1">
                <span className="text-xs font-medium text-editor-text-muted">
                  Console ({entries.length} message{entries.length !== 1 ? 's' : ''})
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setEntries([])}
                  aria-label="Vider la console"
                  title="Vider la console"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>

              <div className="flex-1 overflow-auto p-2 font-mono text-xs" aria-live="polite">
                {entries.length === 0 ? (
                  <p className="p-2 text-editor-text-muted">
                    Les appels à <code>console.log</code> de votre page apparaîtront ici.
                  </p>
                ) : (
                  entries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`whitespace-pre-wrap border-b border-editor-border/40 px-1 py-0.5 ${LEVEL_STYLES[entry.level]}`}
                    >
                      <span className="mr-2 select-none opacity-50">
                        {LEVEL_MARKS[entry.level]}
                      </span>
                      {entry.text}
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>

              {/* Saisie d'expressions : évaluées dans la page, comme une console. */}
              <form
                className="flex items-center gap-2 border-t border-editor-border px-2 py-1.5"
                onSubmit={(event) => {
                  event.preventDefault();
                  runExpression();
                }}
              >
                <span className="select-none font-mono text-xs text-primary" aria-hidden="true">
                  ❯
                </span>
                <Input
                  value={expression}
                  onChange={(event) => setExpression(event.target.value)}
                  onKeyDown={(event) => {
                    // Historique des commandes, comme dans un terminal.
                    if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      const suivant = Math.min(
                        historyIndex.current + 1,
                        commandHistory.current.length - 1
                      );
                      if (suivant >= 0) {
                        historyIndex.current = suivant;
                        setExpression(commandHistory.current[suivant]);
                      }
                    } else if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      const precedent = historyIndex.current - 1;
                      historyIndex.current = precedent;
                      setExpression(precedent >= 0 ? commandHistory.current[precedent] : '');
                    }
                  }}
                  placeholder="Expression JavaScript…"
                  aria-label="Expression à évaluer dans la page"
                  className="h-7 border-editor-border bg-editor-background font-mono text-xs"
                />
              </form>
            </section>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-6">
          <article
            className="prose prose-sm max-w-none dark:prose-invert"
            // Contenu désinfecté par DOMPurify dans renderMarkdown().
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}
    </div>
  );
};

export default PreviewPanel;
