import { useEffect, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** Le raccourci reste actif quand le focus est dans un champ de saisie (Ctrl+S, Échap…). */
  allowInInput?: boolean;
  /** Renvoyer false pour laisser l'événement suivre son cours (pas de preventDefault). */
  handler: () => void | boolean | Promise<void>;
  description: string;
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName;
  const isField =
    tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  if (!isField) return false;

  // Monaco place le curseur dans un textarea : c'est la zone de travail normale,
  // les raccourcis de l'IDE doivent y fonctionner. En revanche les champs de
  // l'interface (renommage, recherche globale) ne doivent pas les déclencher —
  // taper Ctrl+F dans le champ de recherche ouvrait le widget « find » de Monaco.
  return target.closest('.monaco-editor') === null;
};

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[], enabled = true) => {
  // Une ref évite de ré-attacher l'écouteur à chaque rendu (les handlers changent en permanence).
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      const editable = isEditableTarget(event.target);

      const match = shortcutsRef.current.find((shortcut) => {
        // Un raccourci sans modificateur ne doit jamais se déclencher pendant la saisie,
        // sauf s'il est explicitement marqué comme global (Échap, F11…).
        if (editable && !shortcut.allowInInput) return false;

        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl
          ? event.ctrlKey || event.metaKey
          : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;

        return keyMatch && ctrlMatch && shiftMatch && altMatch;
      });

      if (!match) return;

      // preventDefault seulement si le handler a réellement agi : sinon Échap
      // (par exemple) était intercepté à chaque appui, même sans effet.
      const handled = match.handler();
      if (handled !== false) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
};

const isMacPlatform = (): boolean => {
  // `navigator.platform` est déprécié : on privilégie userAgentData quand il existe.
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  const platform = uaData?.platform ?? navigator.userAgent;
  return /mac|iphone|ipad|ipod/i.test(platform);
};

const KEY_LABELS: Record<string, string> = {
  ' ': 'Espace',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  escape: 'Échap',
  '\\': '\\',
};

export const formatShortcut = (shortcut: KeyboardShortcut): string => {
  const parts: string[] = [];
  const mac = isMacPlatform();

  if (shortcut.ctrl) parts.push(mac ? '⌘' : 'Ctrl');
  if (shortcut.shift) parts.push(mac ? '⇧' : 'Shift');
  if (shortcut.alt) parts.push(mac ? '⌥' : 'Alt');
  parts.push(KEY_LABELS[shortcut.key.toLowerCase()] ?? shortcut.key.toUpperCase());

  return parts.join('+');
};
