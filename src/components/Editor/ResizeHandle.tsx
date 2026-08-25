import { useCallback, useEffect, useRef } from 'react';

interface ResizeHandleProps {
  /** Largeur courante du panneau, en pixels. */
  width: number;
  onWidthChange: (width: number) => void;
  min?: number;
  max?: number;
  /** Côté du panneau où se trouve la poignée. */
  side?: 'right' | 'left';
  label: string;
}

/**
 * Poignée de redimensionnement d'un panneau latéral.
 *
 * Volontairement autonome plutôt que basée sur `ResizablePanelGroup` : envelopper
 * la mise en page principale dans un groupe de panneaux changerait la structure
 * du DOM et l'ordre de focus, alors que la seule chose demandée ici est de
 * pouvoir tirer un bord.
 *
 * Accessible au clavier : flèches gauche/droite, ±16 px (±64 px avec Maj).
 */
const ResizeHandle = ({
  width,
  onWidthChange,
  min = 180,
  max = 640,
  side = 'right',
  label,
}: ResizeHandleProps) => {
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(width);

  const clamp = useCallback(
    (value: number) => Math.min(max, Math.max(min, Math.round(value))),
    [min, max]
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging.current) return;
      const delta = event.clientX - startX.current;
      onWidthChange(clamp(startWidth.current + (side === 'right' ? delta : -delta)));
    };

    const onPointerUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      // Rétablit la sélection de texte et le curseur, neutralisés pendant le glissement.
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [clamp, onWidthChange, side]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={(event) => {
        event.preventDefault();
        dragging.current = true;
        startX.current = event.clientX;
        startWidth.current = width;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      }}
      onDoubleClick={() => onWidthChange(side === 'right' ? 256 : 320)}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 64 : 16;
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          onWidthChange(clamp(width - step));
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          onWidthChange(clamp(width + step));
        } else if (event.key === 'Home') {
          event.preventDefault();
          onWidthChange(side === 'right' ? 256 : 320);
        }
      }}
      // Zone de saisie large (5 px) mais trait fin : confortable sans être visible.
      className="group relative w-1 flex-shrink-0 cursor-col-resize bg-editor-border transition-colors hover:bg-primary focus-visible:bg-primary"
      title={`${label} — double-clic pour réinitialiser`}
    >
      <span className="absolute inset-y-0 -left-1 -right-1" aria-hidden="true" />
    </div>
  );
};

export default ResizeHandle;
