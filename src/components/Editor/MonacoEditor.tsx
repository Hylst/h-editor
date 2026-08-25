import { forwardRef, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import type { MonacoEditorProps, MonacoEditorRef } from './MonacoEditorInner';

export type { MonacoEditorRef, MonacoEditorProps };

/**
 * Monaco (~2 Mo, désormais embarqué et non plus chargé depuis un CDN) est
 * scindé dans son propre chunk : la coquille de l'application s'affiche
 * immédiatement, l'éditeur arrive juste après.
 */
const MonacoEditorInner = lazy(() => import('./MonacoEditorInner'));

const EditorSkeleton = () => (
  <div className="flex h-full w-full items-center justify-center bg-editor-background">
    <div className="flex items-center gap-3 text-editor-text-muted">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span className="text-sm">Chargement de l’éditeur…</span>
    </div>
  </div>
);

const MonacoEditor = forwardRef<MonacoEditorRef, MonacoEditorProps>((props, ref) => (
  <Suspense fallback={<EditorSkeleton />}>
    <MonacoEditorInner {...props} ref={ref} />
  </Suspense>
));

MonacoEditor.displayName = 'MonacoEditor';

export default MonacoEditor;
