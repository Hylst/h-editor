import Editor, { type OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import type { EditorFile } from '@/types/editor';
import { DEFAULT_SETTINGS, type EditorSettings } from '@/types/settings';
// Configure Monaco en mode auto-hébergé (aucun appel au CDN jsDelivr).
import '@/utils/monacoSetup';
import { registerSnippets } from '@/utils/snippets';

export interface MonacoEditorRef {
  triggerFind: () => void;
  triggerFindReplace: () => void;
  goToPosition: (line: number, column: number) => void;
  focus: () => void;
}

export interface MonacoEditorProps {
  file: EditorFile | null;
  onChange: (value: string | undefined) => void;
  settings?: EditorSettings;
  onCursorPositionChange?: (line: number, column: number) => void;
  onSelectionChange?: (selectedCharacters: number) => void;
  onFocus?: () => void;
  /** Formatage Prettier, déclenché depuis Monaco (Alt+Maj+F) ou l'application. */
  onRequestFormat?: () => void;
  /** Étiquette lue par les technologies d'assistance. */
  ariaLabel?: string;
}

const MonacoEditorInner = forwardRef<MonacoEditorRef, MonacoEditorProps>(
  (
    {
      file,
      onChange,
      settings = DEFAULT_SETTINGS,
      onCursorPositionChange,
      onSelectionChange,
      onFocus,
      onRequestFormat,
      ariaLabel,
    },
    ref
  ) => {
    const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
    // Les callbacks changent à chaque rendu : on les lit via une ref pour ne pas
    // ré-attacher les écouteurs Monaco (et ne pas remonter l'éditeur).
    const handlers = useRef({ onCursorPositionChange, onSelectionChange, onFocus, onRequestFormat });
    handlers.current = { onCursorPositionChange, onSelectionChange, onFocus, onRequestFormat };

    useImperativeHandle(
      ref,
      () => ({
        triggerFind: () => editorRef.current?.getAction('actions.find')?.run(),
        triggerFindReplace: () =>
          editorRef.current?.getAction('editor.action.startFindReplaceAction')?.run(),
        goToPosition: (line: number, column: number) => {
          const editor = editorRef.current;
          if (!editor) return;
          editor.setPosition({ lineNumber: line, column });
          editor.revealLineInCenter(line);
          editor.focus();
        },
        focus: () => editorRef.current?.focus(),
      }),
      []
    );

    const handleEditorMount: OnMount = useCallback((editor) => {
      editorRef.current = editor;

      // Extraits de code par langage (idempotent : un seul enregistrement global).
      registerSnippets(monaco);

      editor.onDidChangeCursorPosition((e) => {
        handlers.current.onCursorPositionChange?.(e.position.lineNumber, e.position.column);
      });

      editor.onDidChangeCursorSelection(() => {
        const model = editor.getModel();
        const selection = editor.getSelection();
        if (!model || !selection || selection.isEmpty()) {
          handlers.current.onSelectionChange?.(0);
          return;
        }
        handlers.current.onSelectionChange?.(model.getValueInRange(selection).length);
      });

      editor.onDidFocusEditorText(() => handlers.current.onFocus?.());

      // Monaco possède sa propre commande « Format Document » sur Alt+Maj+F et
      // arrête l'événement avant la fenêtre : le raccourci lançait donc le
      // formateur interne (sans point-virgule ni règles Prettier) au lieu de
      // celui de l'application. On enregistre l'action dans Monaco, ce qui a
      // priorité sur son propre raccourci.
      editor.addAction({
        id: 'editorx.format-document',
        label: 'Formater le document (Prettier)',
        keybindings: [monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
        contextMenuGroupId: 'modification',
        contextMenuOrder: 1,
        run: () => {
          handlers.current.onRequestFormat?.();
        },
      });
    }, []);

    if (file?.binary) {
      // Éditer du base64 comme du texte ne mènerait qu'à corrompre le fichier.
      return (
        <div className="flex h-full items-center justify-center bg-editor-background p-6">
          <div className="max-w-sm space-y-3 text-center">
            <p className="text-lg font-medium text-editor-text">{file.name}</p>
            <p className="text-sm text-editor-text-muted">
              Fichier binaire — conservé intact dans le projet et restitué à l’export ZIP, mais non
              éditable comme du texte.
            </p>
          </div>
        </div>
      );
    }

    if (!file) {
      return (
        <div className="flex h-full items-center justify-center bg-editor-background">
          <div className="space-y-4 text-center px-6">
            <div className="bg-gradient-to-r from-primary to-accent bg-clip-text text-4xl font-bold text-transparent">
              H Editor
            </div>
            <p className="text-editor-text-muted">
              Ouvrez un fichier pour commencer, ou créez-en un avec Ctrl+N
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full w-full" onFocus={onFocus}>
        <Editor
          height="100%"
          path={file.id}
          language={file.language}
          value={file.content}
          onChange={onChange}
          onMount={handleEditorMount}
          theme={settings.theme}
          options={{
            fontSize: settings.fontSize,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontLigatures: true,
            minimap: { enabled: settings.minimap.enabled },
            scrollbar: {
              horizontal: settings.scrollbar.horizontal,
              horizontalScrollbarSize: settings.scrollbar.horizontalScrollbarSize,
              verticalScrollbarSize: 10,
              useShadows: true,
              handleMouseWheel: true,
              alwaysConsumeMouseWheel: false,
            },
            scrollBeyondLastLine: false,
            wordWrap: settings.wordWrap,
            automaticLayout: true,
            tabSize: settings.tabSize,
            insertSpaces: settings.insertSpaces,
            formatOnPaste: true,
            formatOnType: true,
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            renderWhitespace: 'selection',
            lineNumbers: settings.lineNumbers,
            glyphMargin: true,
            folding: true,
            bracketPairColorization: { enabled: true },
            ariaLabel: ariaLabel ?? `Éditeur de code — ${file.name}`,
            accessibilitySupport: 'auto',
          }}
        />
      </div>
    );
  }
);

MonacoEditorInner.displayName = 'MonacoEditorInner';

export default MonacoEditorInner;
