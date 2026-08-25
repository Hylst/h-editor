export type EditorTheme = 'vs-dark' | 'vs-light' | 'hc-black';
export type UiTheme = 'dark' | 'light' | 'system';

export interface EditorSettings {
  autoSave: {
    enabled: boolean;
    interval: number; // en millisecondes
  };
  theme: EditorTheme;
  /** Thème de l'interface (indépendant du thème Monaco, mais synchronisé par défaut) */
  uiTheme: UiTheme;
  fontSize: number;
  tabSize: number;
  wordWrap: 'on' | 'off';
  minimap: {
    enabled: boolean;
  };
  scrollbar: {
    horizontal: 'auto' | 'visible' | 'hidden';
    horizontalScrollbarSize: number;
  };
  lineNumbers: 'on' | 'off' | 'relative';
  insertSpaces: boolean;
  /** Aperçu (Markdown / HTML) affiché à côté de l'éditeur */
  previewVisible: boolean;
  /** Largeur de l'explorateur, en pixels */
  sidebarWidth: number;
  /** Largeur du panneau de recherche, en pixels */
  searchPanelWidth: number;
}

export const DEFAULT_SETTINGS: EditorSettings = {
  autoSave: {
    enabled: true,
    interval: 5000, // 5 secondes
  },
  theme: 'vs-dark',
  uiTheme: 'dark',
  fontSize: 14,
  tabSize: 2,
  wordWrap: 'on',
  minimap: {
    enabled: true,
  },
  scrollbar: {
    horizontal: 'auto',
    horizontalScrollbarSize: 10,
  },
  lineNumbers: 'on',
  insertSpaces: true,
  previewVisible: false,
  sidebarWidth: 256,
  searchPanelWidth: 320,
};

export const SETTINGS_STORAGE_KEY = 'editorx-settings';

export const SETTINGS_LIMITS = {
  fontSize: { min: 8, max: 40 },
  tabSize: { min: 1, max: 8 },
  autoSaveInterval: { min: 1000, max: 300_000 },
  panelWidth: { min: 180, max: 640 },
} as const;

type RawRecord = Record<string, unknown>;

const nested = (input: RawRecord, key: string): RawRecord =>
  (input[key] && typeof input[key] === 'object' ? (input[key] as RawRecord) : {});

const clampNumber = (value: unknown, fallback: number, min: number, max: number): number => {
  // '' , null, [] etc. se convertissent en 0 avec Number() : on les traite comme absents.
  if (value === '' || value === null || value === undefined || typeof value === 'boolean') {
    return fallback;
  }
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

/**
 * Fusionne des réglages arbitraires (localStorage, version antérieure, JSON corrompu)
 * avec les valeurs par défaut, en validant chaque champ.
 *
 * Corrige : `parseInt('')` → NaN → `fontSize: null` persisté → éditeur illisible,
 * et l'absence de champ après ajout d'une option (ancien format).
 */
export const sanitizeSettings = (raw: unknown): EditorSettings => {
  const input: RawRecord = raw && typeof raw === 'object' ? (raw as RawRecord) : {};
  const autoSave = nested(input, 'autoSave');
  const minimap = nested(input, 'minimap');
  const scrollbar = nested(input, 'scrollbar');
  const d = DEFAULT_SETTINGS;

  return {
    autoSave: {
      enabled: asBoolean(autoSave.enabled, d.autoSave.enabled),
      interval: clampNumber(
        autoSave.interval,
        d.autoSave.interval,
        SETTINGS_LIMITS.autoSaveInterval.min,
        SETTINGS_LIMITS.autoSaveInterval.max
      ),
    },
    theme: oneOf<EditorTheme>(input.theme, ['vs-dark', 'vs-light', 'hc-black'], d.theme),
    uiTheme: oneOf<UiTheme>(input.uiTheme, ['dark', 'light', 'system'], d.uiTheme),
    fontSize: clampNumber(
      input.fontSize,
      d.fontSize,
      SETTINGS_LIMITS.fontSize.min,
      SETTINGS_LIMITS.fontSize.max
    ),
    tabSize: clampNumber(
      input.tabSize,
      d.tabSize,
      SETTINGS_LIMITS.tabSize.min,
      SETTINGS_LIMITS.tabSize.max
    ),
    wordWrap: oneOf(input.wordWrap, ['on', 'off'] as const, d.wordWrap),
    minimap: { enabled: asBoolean(minimap.enabled, d.minimap.enabled) },
    scrollbar: {
      horizontal: oneOf(
        scrollbar.horizontal,
        ['auto', 'visible', 'hidden'] as const,
        d.scrollbar.horizontal
      ),
      horizontalScrollbarSize: clampNumber(
        scrollbar.horizontalScrollbarSize,
        d.scrollbar.horizontalScrollbarSize,
        4,
        30
      ),
    },
    lineNumbers: oneOf(input.lineNumbers, ['on', 'off', 'relative'] as const, d.lineNumbers),
    insertSpaces: asBoolean(input.insertSpaces, d.insertSpaces),
    previewVisible: asBoolean(input.previewVisible, d.previewVisible),
    sidebarWidth: clampNumber(
      input.sidebarWidth,
      d.sidebarWidth,
      SETTINGS_LIMITS.panelWidth.min,
      SETTINGS_LIMITS.panelWidth.max
    ),
    searchPanelWidth: clampNumber(
      input.searchPanelWidth,
      d.searchPanelWidth,
      SETTINGS_LIMITS.panelWidth.min,
      SETTINGS_LIMITS.panelWidth.max
    ),
  };
};

/** Lecture tolérante : ni JSON corrompu ni localStorage bloqué ne doivent empêcher le démarrage. */
export const loadSettings = (): EditorSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

export const persistSettings = (settings: EditorSettings): void => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* les réglages resteront valables pour la session en cours */
  }
};
