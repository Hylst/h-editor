# Structure du projet H Editor

Ce document décrit l'architecture technique d'H Editor en détail : organisation des dossiers, flux de données, conventions de code, design system et points d'attention performance.

> État vérifié au 25/08/2026 sur la v1.7.0 (comptages et tailles mesurés, pas estimés).

---

## 🗂️ Vue d'ensemble

```
editorx-zen-code-main/
├── public/                 # Fichiers statiques servis tels quels
├── scripts/                # Génération d'icônes et de l'image OG (Node)
├── src/                    # Code source applicatif
│   ├── assets/fonts/       # JetBrains Mono auto-hébergée (8 woff2)
│   ├── components/         # Composants React (Editor + UI shadcn)
│   ├── hooks/              # Hooks React personnalisés (8 fichiers)
│   ├── pages/              # Pages routées (Index, NotFound)
│   ├── services/workspace/ # Contrat de stockage (back-end ready)
│   ├── styles/             # fonts.css (@font-face locales)
│   ├── types/              # Définitions TypeScript
│   ├── utils/              # Utilitaires purs (+ tests colocalisés)
│   ├── workers/            # search.worker.ts (recherche hors thread)
│   └── lib/                # Bibliothèques internes (cn)
├── e2e/                    # Playwright (7 specs + helpers.ts)
├── index.html              # Point d'entrée HTML + meta SEO
├── vite.config.ts          # Configuration Vite (base: '/app/') + PWA
├── playwright.config.ts    # 4 profils (chromium, mobile-chrome, firefox, webkit)
├── tsconfig*.json          # Configuration TypeScript (3 fichiers)
├── tailwind.config.ts      # Configuration Tailwind + design tokens
├── postcss.config.js       # Pipeline PostCSS
├── eslint.config.js        # Configuration ESLint (flat config)
├── components.json         # Configuration shadcn/ui
├── package.json            # Dépendances et scripts
├── CLAUDE.md               # Guidance Claude Code (anglais)
├── README.md               # Vue d'ensemble
├── about.md                # Description, philosophie, auteur
├── features.md             # Fonctionnalités détaillées
├── changelog.md            # Historique des versions
├── todo.md                 # Roadmap
├── continue.md             # Passation : invariants, pièges, où reprendre
├── agents.md               # Instructions agents de codage
├── plan.md                 # Historique des audits et corrections
├── structure.md            # Ce document
└── test_build_deploy.md    # Guide test / build / déploiement
```

---

## 📁 Arborescence détaillée `src/`

```
src/
├── components/
│   ├── ErrorBoundary.tsx               # Frontière d'erreur racine (export/réinitialisation)
│   ├── Editor/                         # Composants métier de l'éditeur
│   │   ├── EditorLayout.tsx           # ⭐ Composition : branche les hooks, raccourcis,
│   │   │                              #    commandes et mise en page (~1 226 LOC)
│   │   ├── MonacoEditor.tsx           # Enveloppe paresseuse (React.lazy)
│   │   ├── MonacoEditorInner.tsx      # Implémentation réelle de l'éditeur Monaco
│   │   ├── Sidebar.tsx                # Arborescence fichiers/dossiers (mémoïsée, virtualisée > 300)
│   │   ├── TabBar.tsx                 # Onglets ouverts (réordonnables, mémoïsé)
│   │   ├── QuickOpen.tsx              # « Aller à un fichier » (Ctrl+P)
│   │   ├── StatusBar.tsx              # Barre de statut (ligne, colonne, encodage…)
│   │   ├── PreviewPanel.tsx           # Aperçu Markdown/HTML + console + formats d'écran
│   │   ├── SearchPanel.tsx            # Recherche globale (pilote le Web Worker)
│   │   ├── ResizeHandle.tsx           # Poignée de redimensionnement accessible
│   │   ├── CommandPalette.tsx         # Palette de commandes (Ctrl+Maj+P)
│   │   ├── SettingsDialog.tsx         # Dialogue paramètres
│   │   └── InfoDialog.tsx             # Dialogue À propos / Aide / Raccourcis
│   └── ui/                            # Composants UI shadcn — 17 fichiers, tous utilisés
│       ├── alert-dialog, button, context-menu, dialog, dropdown-menu, input, label,
│       ├── radio-group, resizable, scroll-area, select, slider, sonner, switch,
│       └── tabs, toggle, tooltip
│
├── hooks/
│   ├── useWorkspace.ts                # Source de vérité des fichiers/dossiers + persistance
│   ├── useTabs.ts                     # Onglets, onglet actif, historique de fermeture
│   ├── useSettings.ts                 # Préférences validées + application du thème
│   ├── useSplitLayout.ts              # Vue divisée, panneau actif, persistance
│   ├── useSearch.ts                   # Pilote le Web Worker de recherche (repli synchrone)
│   ├── useVirtualList.ts              # Fenêtrage de liste (> 300 entrées), sans dépendance
│   ├── useKeyboardShortcuts.ts        # Raccourcis globaux, ignorés dans les champs UI
│   └── useInstallPrompt.ts            # Capture `beforeinstallprompt`, déclenche l'installation PWA
│
├── services/workspace/
│   ├── types.ts                       # Contrat WorkspaceStore (load/save/clear/estimate/…)
│   ├── localStore.ts                  # Implémentation locale incrémentale (+ tests)
│   └── index.ts                       # getWorkspaceStore() — point de sélection
│
├── workers/
│   └── search.worker.ts               # Recherche globale hors du thread principal (+ test)
│
├── pages/
│   ├── Index.tsx                      # Page racine → rend <EditorLayout />
│   └── NotFound.tsx                   # 404
│
├── types/
│   ├── editor.ts                      # EditorFile, EditorFolder, EditorTab
│   └── settings.ts                    # EditorSettings + sanitizeSettings (+ tests)
│
├── utils/
│   ├── fileSystem.ts                  # Disque (pickers, écriture) + détection de langage
│   ├── fileStorage.ts                 # Import/export JSON du projet (+ tests)
│   ├── zipHandler.ts                  # Import/export ZIP via jszip (+ tests, progression)
│   ├── directoryImport.ts             # showDirectoryPicker, handles conservés
│   ├── formatter.ts                   # Prettier, chargé en import() dynamique
│   ├── markdown.ts                    # markdown-it + DOMPurify (+ tests)
│   ├── sitePreview.ts                 # Assemblage de site multi-fichiers (pur, 26 tests)
│   ├── previewConsole.ts              # Pont console postMessage de l'aperçu (+ tests)
│   ├── binarySafety.test.ts           # Garde anti-traitement texte des binaires
│   ├── fileNames.ts                   # Unicité et validation des noms (+ tests)
│   ├── installPrompt.ts               # Décision d'affichage du bouton « Installer » PWA (pur, + tests)
│   ├── monacoSetup.ts                 # Monaco auto-hébergé + web workers (aucun CDN)
│   ├── templates.ts                   # 14 modèles de fichiers (dont site complet 3 fichiers)
│   ├── snippets.ts                    # Extraits de code par langage (Monaco)
│   ├── ids.ts                         # createId() — crypto.randomUUID indisponible hors HTTPS
│   ├── appInfo.ts                     # Version injectée (__APP_VERSION__) + métadonnées
│   ├── welcomeFile.ts                 # Contenu du fichier d'accueil bienvenue.md
│   └── storage/
│       ├── indexedDb.ts               # Wrapper IndexedDB minimal, sans dépendance
│       ├── compression.ts             # gzip via CompressionStream, repli transparent (+ tests)
│       └── recoveryJournal.ts         # Journal sessionStorage par frappe (+ tests)
│
├── lib/
│   └── utils.ts                       # Helpers (cn() pour Tailwind merge)
│
├── styles/
│   └── fonts.css                      # @font-face JetBrains Mono (locales)
│
├── App.tsx                            # Racine React : providers + Router (basename="/app")
├── main.tsx                           # createRoot + mount
├── index.css                          # Tokens CSS HSL + Tailwind directives
└── vite-env.d.ts
```

Tests unitaires colocalisés (`*.test.ts`) : 13 fichiers, **144 tests** — voir la section Tests.

---

## ⚙️ Stack technique

| Couche | Technologie | Version | Rôle |
|--------|-------------|---------|------|
| Framework UI | React | 18.3 | Composants & rendu |
| Langage | TypeScript | 5.8 | Typage strict (`strict: true`) |
| Build | Vite + SWC | 8.0 | Bundling + HMR, plugin PWA (Workbox) |
| Routing | react-router-dom | 7.18 | Routes client-side |
| Éditeur | @monaco-editor/react | 4.7 | Moteur d'édition VS Code (auto-hébergé) |
| CSS | Tailwind CSS | 3.4 | Utility-first + design tokens |
| Composants | shadcn/ui + Radix UI | — | Primitives accessibles |
| State | React hooks natifs | — | useState / useCallback / useEffect |
| ZIP | jszip | 3.10 | Import/Export archives (import dynamique) |
| Markdown | markdown-it | 14.1 | Rendu preview (via DOMPurify) |
| Format | prettier | 3.6 | Formatage code (import dynamique) |
| Notifications | sonner | 1.7 | Toasts |
| Resize panes | react-resizable-panels | 2.1 | Layouts splits |
| Icônes | lucide-react | 0.462 | Set d'icônes SVG |

> Aucune dépendance de données (react-query, store externe…) ni d'utilitaires (uuid, zod…) :
> elles ont été retirées en 1.1.0 comme inutilisées.

---

## 🔁 Flux de données

```
useWorkspace (source de vérité : files[], folders[])
useTabs · useSettings · useSplitLayout
        │
        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                              EditorLayout                              │
│   Composition : branche les hooks, enregistre les raccourcis et        │
│   commandes, assemble Sidebar / TabBar / éditeurs / Preview / StatusBar│
└────────────────────────────────────────────────────────────────────────┘
     │ props        │ props        │ props        │ props
     ▼              ▼              ▼              ▼
┌─────────┐   ┌──────────┐   ┌──────────────┐   ┌──────────┐
│ Sidebar │   │  TabBar  │   │ MonacoEditor │   │ StatusBar│
└─────────┘   └──────────┘   └──────────────┘   └──────────┘
      └──────────────┴──────┬───────┴──────────────┘
                            ▼
          services/workspace (localStorage métadonnées
          + IndexedDB contenu compressé gzip)
                            ▼
          zipHandler / formatter (imports dynamiques)
```

**Principe** : l'état métier vit dans quatre hooks (`useWorkspace`, `useTabs`, `useSettings`,
`useSplitLayout`) ; `EditorLayout` n'est plus que la composition (~1 226 LOC). Les
sous-composants reçoivent des `props` et émettent des callbacks.

**Invariant de performance** : `files` est un nouveau tableau à chaque frappe. Ne jamais en faire
dépendre un effet directement — dériver une signature d'ids ou mémoïser sur les métadonnées
(comme le font `useTabs`, `useSplitLayout`, `Sidebar`, `TabBar`).

---

## 🧱 Types principaux

### `EditorFile` ([src/types/editor.ts](./src/types/editor.ts))
```typescript
interface EditorFile {
  id: string;
  name: string;
  language: string;
  content: string;
  /** true = modifications non écrites sur le disque */
  modified: boolean;
  /** Handle File System Access si lié à un fichier disque (Ctrl+S direct) */
  fileHandle?: FileSystemFileHandle;
  /** undefined = racine */
  parentId?: string;
  /** Binaire conservé en base64 : jamais de traitement texte dessus */
  binary?: boolean;
  /** lastModified disque à l'ouverture — détecte une modification externe */
  diskModifiedAt?: number;
}

interface EditorFolder {
  id: string;
  name: string;
  parentId?: string;
  expanded?: boolean;
}

interface EditorTab {
  id: string;
  fileId: string;
  active: boolean;
}
```

### `EditorSettings` ([src/types/settings.ts](./src/types/settings.ts))
```typescript
type EditorTheme = 'vs-dark' | 'vs-light' | 'hc-black';
type UiTheme = 'dark' | 'light' | 'system';

interface EditorSettings {
  autoSave: { enabled: boolean; interval: number }; // ms
  theme: EditorTheme;                               // thème Monaco
  uiTheme: UiTheme;                                 // thème interface (synchronisé par défaut)
  fontSize: number;
  tabSize: number;
  wordWrap: 'on' | 'off';
  minimap: { enabled: boolean };
  scrollbar: { horizontal: 'auto' | 'visible' | 'hidden'; horizontalScrollbarSize: number };
  lineNumbers: 'on' | 'off' | 'relative';
  insertSpaces: boolean;
  previewVisible: boolean;
  sidebarWidth: number;
  searchPanelWidth: number;
}
```
Toute valeur lue du stockage passe par `sanitizeSettings()` (validation, bornage, complétion).

---

## 💾 Persistance

H Editor n'a aucun backend. Toute la donnée vit côté navigateur :

| Mécanisme | Usage |
|-----------|-------|
| `localStorage` (`editorx-workspace`) | Métadonnées, onglets (~1 Ko, lecture synchrone) |
| `IndexedDB` (`editorx` / `file-content`) | **Contenu des fichiers**, compressé gzip, écriture incrémentale |
| `localStorage` (`editorx-settings`) | Réglages, toujours validés par `sanitizeSettings` |
| `sessionStorage` | Journal de reprise (survit à un plantage brutal de l'onglet) |
| File System Access API | Lecture/écriture disque explicite (Chromium ; repli `<input type="file">`) |
| ZIP (jszip) | Import/export complet de projets |

Garanties : aucune écriture ne lève (`SaveOutcome`), écriture différée 600 ms purgée sur
`visibilitychange`/`pagehide`, conflit multi-onglets détecté (numéro de révision) et arbitré.

**Limite connue** : la File System Access API est bloquée en iframe et indisponible sur Firefox/Safari (fallback `<input type="file">` en place).

---

## 🎨 Design System

### Tokens CSS HSL ([src/index.css](./src/index.css))

```css
/* `:root` porte le thème CLAIR, `.dark` le thème SOMBRE
   (Tailwind darkMode: 'class', piloté par useSettings). */
:root {
  --background: 210 20% 98%;   /* thème clair */
  --foreground: 220 25% 12%;
  --primary: 199 89% 38%;
  /* ... variables éditeur, langages, surlignage recherche (> 7:1) ... */
}
.dark { /* palette sombre */ }
```

### Convention Tailwind
```tsx
// ✅ Correct — Token
<div className="bg-editor-bg text-foreground" />

// ❌ Incorrect — Couleur directe
<div className="bg-slate-900 text-white" />
```

Tailwind est configuré avec `darkMode: ["class"]` et étend `colors` via les variables HSL.

---

## 📐 Conventions

### Nommage
- **Composants** : `PascalCase` → `EditorLayout.tsx`
- **Hooks** : `useXxx` camelCase → `useKeyboardShortcuts.ts`
- **Utils / lib** : camelCase → `fileSystem.ts`, `cn`
- **Types / Interfaces** : `PascalCase`

### Alias TypeScript
```jsonc
// tsconfig.json
{
  "paths": { "@/*": ["./src/*"] }
}
```
→ `import { Button } from "@/components/ui/button";`

### Structure type d'un composant
```tsx
// 1. Imports (externes → internes)
// 2. Types locaux
// 3. Composant (états, effets, handlers useCallback si passés en props, render)
// 4. Export
```

### Qualité
- TypeScript `strict: true` — 0 erreur (`npm run typecheck`)
- ESLint flat config — 0 erreur, 4 avertissements de convention shadcn (`react-refresh/only-export-components`)
- Pas de `any`.

---

## ⚡ Performance

Mesures de référence gardées par `e2e/performance.spec.ts` :

| Situation | Avant | Après |
|---|---|---|
| Blocage pendant une recherche (1 500 fichiers) | 2 146 ms | **43 ms** (Web Worker) |
| Nœuds DOM explorateur (2 000 fichiers) | 2 001 | **43** (virtualisation > 300) |
| Frappe (2 000 fichiers) | 146 ms/car. | **27 ms/car.** |
| Filtre de l'explorateur (2 000 fichiers) | 210 ms | **55 ms** |
| Chunk d'entrée | 2 321 Ko | **~180 Ko** (mesuré 08/2026 : 182 Ko) |
| Précache service worker | 10 241 Ko | **36 entrées, ~5,3 Mo** (mesuré 08/2026) |

Autres points :
- Chargement paresseux (`React.lazy`) de l'éditeur, des dialogues, de l'aperçu et de la recherche ;
  Prettier et JSZip en `import()` dynamique (restent hors précache — invariant hors ligne).
- Anti-rebond de la recherche globale : **200 ms** (`useSearch.ts`).
- **Monaco** (~4 Mo) embarqué, chunk dédié, jamais depuis un CDN.

---

## 🚢 Configuration de déploiement (sous-chemin `/app`)

H Editor est servi sous `https://hylst.fr/app/`. Deux ajustements qui doivent rester synchronisés :

### `vite.config.ts`
```ts
base: '/app/',
```

### `src/App.tsx`
```tsx
<BrowserRouter basename="/app">
```

Sans ces deux modifications, les assets retournent 404 et les routes React cassent. Détails dans [test_build_deploy.md](./test_build_deploy.md).

---

## 🧪 Couche de stockage (`src/services/workspace/`)

H Editor reste **100 % front-end**, mais la persistance passe par un contrat explicite
pour rester *back-end ready* :

| Fichier | Rôle |
|---------|------|
| `types.ts` | Interface `WorkspaceStore` : `load`, `save`, `clear`, `estimate`, `onExternalChange` |
| `localStore.ts` | Implémentation locale (localStorage + IndexedDB), écritures incrémentales, tolérante au quota (+ tests avec `fake-indexeddb`) |
| `index.ts` | Sélection de l'implémentation active (`getWorkspaceStore()`) |

Ajouter un backend plus tard = écrire un `remoteStore.ts` respectant la même interface et le
renvoyer depuis `index.ts`. Aucun composant ni hook d'interface n'a besoin d'être modifié.

Garanties attendues de toute implémentation :

1. aucune méthode ne lève — les échecs sont retournés (`SaveOutcome`) ;
2. `save()` exploite `changedFileIds` / `removedFileIds` pour ne pas tout réécrire ;
3. `onExternalChange()` signale une écriture concurrente (autre onglet aujourd'hui,
   autre appareil demain).

## Tests

Deux couches, exécutées par `npm run test:all` :

| Type | Emplacement | Volume | Commande |
|------|-------------|--------|----------|
| Unitaires (Vitest + jsdom ; Node pour compression) | `src/**/*.test.ts` — 13 fichiers | **144 tests** | `npm run test:run` |
| E2E (Playwright) | `e2e/*.spec.ts` — 7 specs + `helpers.ts` | **121 tests** | `npm run test:e2e` |

Fichiers E2E :

```
e2e/
├── regressions.spec.ts    Un test par bug ayant réellement existé — ne jamais supprimer
├── features.spec.ts       Surface fonctionnelle
├── value.spec.ts          Apports 1.5.0
├── site-preview.spec.ts   Assemblage multi-fichiers, navigation, isolation iframe
├── performance.spec.ts    Garde-fous chiffrés (Chromium)
├── offline.spec.ts        Coupure réseau réelle
├── responsive.spec.ts     Profil Pixel 7
└── helpers.ts             waitForPersisted, typeInEditor…
```

Profils Playwright (4) : `chromium` (tout sauf responsive), `mobile-chrome` (responsive),
`firefox` et `webkit` (regressions + features uniquement — File System Access est Chromium-only
et les seuils de perf n'ont de sens que sur un moteur).

Les tests E2E s'exécutent sur le **build de production** servi par `vite preview`.

## Invariants à ne pas casser

Voir [continue.md](./continue.md) §2 pour le détail et la raison de chacun :

1. **`files` est un nouveau tableau à chaque frappe** — jamais de dépendance directe.
2. **Tout import statique du chunk d'entrée doit être précaché**, sinon l'application ne démarre
   pas hors ligne. `jszip`, `prettier` et Monaco sont chargés dynamiquement pour cette raison.
3. **Un fichier `binary` ne subit jamais de traitement texte** : ni recherche, ni remplacement,
   ni formatage, ni aperçu.
4. **Fermer un onglet ne supprime jamais un fichier.**
5. **Aucune écriture ne doit lever** : les échecs remontent par `SaveOutcome`.
6. **L'iframe d'aperçu garde `sandbox` sans `allow-same-origin`** : c'est ce qui empêche une page
   prévisualisée d'accéder au stockage. Toute la conception de `sitePreview.ts` en découle.
7. **Le contenu Markdown passe toujours par `renderMarkdown()`** (DOMPurify).

## Documents de reprise

| Fichier | Public |
|---------|--------|
| `continue.md` | Développeur ou agent reprenant le projet : invariants, pièges, où reprendre |
| `agents.md` | Agents de codage (opencode, Claude Code…) : règles et conventions |
| `CLAUDE.md` | Guidance anglaise pour Claude Code (architecture, tests) |
| `plan.md` | Historique des audits et des corrections, avec mesures |
