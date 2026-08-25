import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Fenêtrage d'une longue liste, sans dépendance externe.
 *
 * Au-delà de quelques centaines d'entrées, garder tous les nœuds dans le DOM
 * coûte cher à chaque rendu : mesuré à 146 ms par caractère saisi avec 2 000
 * fichiers dans l'explorateur. On ne rend alors que la portion visible.
 *
 * En dessous du seuil, la liste est rendue intégralement : le fenêtrage
 * n'apporterait rien et compliquerait le défilement.
 */
export interface VirtualWindow {
  /** Index du premier élément à rendre. */
  start: number;
  /** Index (exclu) du dernier élément à rendre. */
  end: number;
  /** Hauteur de l'espaceur au-dessus, en pixels. */
  paddingTop: number;
  /** Hauteur de l'espaceur en dessous, en pixels. */
  paddingBottom: number;
  /** true si le fenêtrage est actif (au-delà du seuil). */
  active: boolean;
}

export interface UseVirtualListOptions {
  itemCount: number;
  itemHeight: number;
  /** En dessous, la liste est rendue en entier. */
  threshold?: number;
  /** Nombre d'éléments rendus en marge, de part et d'autre. */
  overscan?: number;
}

export const useVirtualList = <T extends HTMLElement>({
  itemCount,
  itemHeight,
  threshold = 300,
  overscan = 12,
}: UseVirtualListOptions) => {
  const containerRef = useRef<T | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const active = itemCount > threshold;

  const measure = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;
    setScrollTop(element.scrollTop);
    setViewportHeight(element.clientHeight);
  }, []);

  useEffect(() => {
    if (!active) return;
    const element = containerRef.current;
    if (!element) return;

    measure();
    element.addEventListener('scroll', measure, { passive: true });

    // La hauteur change avec le repli de la barre latérale ou la fenêtre.
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(element);

    return () => {
      element.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [active, measure]);

  if (!active) {
    return {
      containerRef,
      window: { start: 0, end: itemCount, paddingTop: 0, paddingBottom: 0, active: false },
    };
  }

  // Une hauteur nulle (premier rendu) ne doit pas masquer toute la liste.
  const height = viewportHeight || 600;
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visible = Math.ceil(height / itemHeight) + overscan * 2;
  const end = Math.min(itemCount, start + visible);

  return {
    containerRef,
    window: {
      start,
      end,
      paddingTop: start * itemHeight,
      paddingBottom: Math.max(0, (itemCount - end) * itemHeight),
      active: true,
    } satisfies VirtualWindow,
  };
};
