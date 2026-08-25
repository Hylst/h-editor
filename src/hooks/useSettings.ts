import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  persistSettings,
  sanitizeSettings,
  type EditorSettings,
} from '@/types/settings';

/** Applique le thème d'interface au <html> (classe `dark` consommée par Tailwind). */
const applyUiTheme = (uiTheme: EditorSettings['uiTheme']) => {
  const root = document.documentElement;
  const prefersDark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = uiTheme === 'dark' || (uiTheme === 'system' && prefersDark);

  root.classList.toggle('dark', dark);
  root.classList.toggle('light', !dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
};

export const useSettings = () => {
  const [settings, setSettingsState] = useState<EditorSettings>(() => loadSettings());

  // Toute écriture passe par la validation : impossible de persister un NaN
  // (l'ancien `parseInt('')` enregistrait `fontSize: null` et cassait l'éditeur).
  const setSettings = useCallback((next: EditorSettings | ((prev: EditorSettings) => EditorSettings)) => {
    setSettingsState((prev) => sanitizeSettings(typeof next === 'function' ? next(prev) : next));
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<EditorSettings>) => setSettings((prev) => ({ ...prev, ...patch })),
    [setSettings]
  );

  const resetSettings = useCallback(() => setSettingsState({ ...DEFAULT_SETTINGS }), []);

  useEffect(() => {
    persistSettings(settings);
    applyUiTheme(settings.uiTheme);
  }, [settings]);

  // Suivi du thème système quand l'utilisateur a choisi « système »
  useEffect(() => {
    if (settings.uiTheme !== 'system' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyUiTheme('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [settings.uiTheme]);

  return { settings, setSettings, updateSettings, resetSettings };
};
