# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Dev server at http://localhost:8080/app/
npm run build      # Production build → ./dist/
npm run preview    # Preview production build locally
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit (strict mode is ON)
npm run test       # Vitest, watch mode
npm run test:run   # Vitest, single run (used by CI)
npm run test:e2e   # Build + Playwright (Chromium, Firefox, WebKit, Pixel 7)
npm run test:e2e:chromium  # Chromium only — fast iteration
npm run test:all   # lint + typecheck + unit + e2e
```

CI (`.github/workflows/ci.yml`) runs lint + typecheck + unit tests + build + Playwright E2E +
`npm audit` on every push and PR.

## Architecture

**H Editor** is a 100% client-side web IDE (no backend). React 18 + TypeScript + Vite + Monaco Editor.

### State management

`src/components/Editor/EditorLayout.tsx` orchestrates the UI but no longer owns the logic. State lives in four hooks:

| Hook | Responsibility |
|------|----------------|
| `src/hooks/useWorkspace.ts` | Files and folders (source of truth), CRUD, persistence, undo of the last deletion |
| `src/hooks/useTabs.ts` | Open tabs, active tab, closed-tab history (`Ctrl+Shift+T`) |
| `src/hooks/useSettings.ts` | Validated preferences + UI theme application |
| `src/hooks/useSplitLayout.ts` | Split view state, active pane, persistence |

**Invariant: closing a tab never deletes a file.** Tabs are a view over `files`; only
`deleteFile` / `deleteFolder` remove content, always behind a confirmation and an undo toast.

### Persistence

| Mechanism | Used for |
|-----------|----------|
| `localStorage` (`editorx-workspace`) | Tree metadata, tabs — small, read synchronously at startup |
| IndexedDB (`editorx` / `file-content`) | File contents — no practical size limit |
| `localStorage` (`editorx-settings`) | Preferences, always passed through `sanitizeSettings` |
| File System Access API | Explicit disk I/O (Chromium); `<input type="file">` + download fallback elsewhere |
| ZIP (jszip) | Full project import/export |

Writes are debounced (600 ms), **incremental** (only changed file contents are written), and never
throw: `store.save()` returns a `SaveOutcome`, a quota error becomes a toast, and
`src/components/ErrorBoundary.tsx` catches anything else (offering export/reset instead of a blank
page). Pending writes are flushed on `visibilitychange`/`pagehide`, and a write from another tab
raises a warning instead of being silently overwritten.

**Back-end ready:** all persistence goes through the `WorkspaceStore` interface. Adding a server
means writing another implementation and returning it from `services/workspace/index.ts` — no UI
or hook changes. Keep that boundary intact.

### Key files

| File | Role |
|------|------|
| `src/components/Editor/EditorLayout.tsx` | Composition root: wires hooks, shortcuts, commands, layout |
| `src/services/workspace/types.ts` | `WorkspaceStore` contract — the seam a future backend plugs into |
| `src/services/workspace/localStore.ts` | Local implementation: metadata in localStorage, content in IndexedDB, incremental writes |
| `src/utils/storage/indexedDb.ts` | Minimal IndexedDB wrapper (no dependency) |
| `src/utils/ids.ts` | `createId()` — `crypto.randomUUID` is unavailable outside secure contexts (LAN IP) |
| `src/utils/storage/compression.ts` | gzip via `CompressionStream`, transparent fallback to plain text |
| `src/utils/storage/recoveryJournal.ts` | Per-keystroke `sessionStorage` journal — survives a hard tab crash |
| `src/utils/directoryImport.ts` | `showDirectoryPicker` import, keeps handles so `Ctrl+S` writes to disk |
| `src/workers/search.worker.ts` | Global search off the main thread (2 146 ms → 43 ms of blocking) |
| `src/hooks/useVirtualList.ts` | Windowing for the explorer above 300 entries, no dependency |
| `src/utils/templates.ts` | 14 file templates surfaced in the explorer and command palette |
| `src/utils/snippets.ts` | Per-language Monaco completion snippets (registered once) |
| `src/utils/previewConsole.ts` | `postMessage` console bridge for the sandboxed HTML preview |
| `src/utils/sitePreview.ts` | Multi-file site assembly — pure function, 26 unit tests |
| `src/components/Editor/ResizeHandle.tsx` | Accessible panel resize handle (mouse, keyboard, dblclick) |
| `src/components/Editor/QuickOpen.tsx` | « Aller à un fichier » dialog (`Ctrl+P`) |
| `src/utils/fileNames.ts` | Name uniqueness and validation |
| `src/utils/monacoSetup.ts` | Self-hosted Monaco + web workers (no CDN) |
| `src/utils/markdown.ts` | markdown-it + DOMPurify sanitisation |
| `src/utils/formatter.ts` | Prettier, loaded via dynamic `import()` |
| `src/utils/fileSystem.ts` | Disk I/O and language detection |
| `src/types/settings.ts` | `EditorSettings` + `sanitizeSettings` (never trust stored JSON) |
| `src/hooks/useKeyboardShortcuts.ts` | Global hotkeys, ignored inside UI text fields |
| `src/hooks/useInstallPrompt.ts` | Captures `beforeinstallprompt`, triggers PWA install (button in the status bar) |
| `src/utils/installPrompt.ts` | Pure `shouldShowInstallButton()` decision, tested in Vitest |

### Performance invariants

Measured, and pinned by `e2e/performance.spec.ts` — do not regress them:

- `files` is a **new array on every keystroke**. Never make an effect or a component depend on it
  directly: derive a signature (ids) or memoise on metadata, as `useTabs`, `useSplitLayout`,
  `Sidebar` and `TabBar` do.
- Global search runs in a Web Worker. Keep `runSearch` pure so the synchronous fallback stays valid.
- The explorer flattens its tree and renders only the visible window above 300 rows.

### Offline invariant

Anything imported **statically** by the entry chunk must be precached, or the app will not boot
offline. `jszip` and `prettier` are loaded with dynamic `import()` precisely so they can stay out of
the precache. `e2e/offline.spec.ts` cuts the network for real — keep it passing.

### Security constraints

- Monaco is **bundled**, never fetched from jsDelivr — offline support and no third-party requests depend on it.
- JetBrains Mono is self-hosted in `src/assets/fonts` (`src/styles/fonts.css`).
- Markdown preview output **must** go through `renderMarkdown()` (DOMPurify); HTML preview runs in a
  `sandbox` iframe without `allow-same-origin`.
- Never reintroduce `dangerouslySetInnerHTML` with unsanitised content.
- The HTML preview iframe must keep `sandbox` **without** `allow-same-origin`; the console bridge
  talks over `postMessage` and validates every message (`parseConsoleMessage`).
- A file flagged `binary` (base64) must never go through text processing — search, replace, format
  or preview. A global replace on base64 destroys the file.

### Site preview

`sitePreview.ts` assembles a multi-file site in memory: linked stylesheets and scripts are inlined,
ES module imports are rewritten to `data:` URIs recursively, images come from stored base64, and
`fetch`/`XHR` shims serve project files. A service worker cannot be used — it does not control an
opaque-origin document, and `blob:` URLs are blocked there (both measured, not assumed).

Three escaping traps, each covered by a test: `</script>` inside user code (`escapeForInlineTag`),
`<` inside the virtual file table (`toInlineJson`, Unicode line separators included), and non-ASCII
characters (`toDataUri` percent-encodes; `btoa` would throw).

The preview console is interactive: the parent posts an expression on the `editorx-preview-eval`
channel and the iframe evaluates it. `eval` is acceptable there — opaque origin, no access to editor
storage — but the receiver must keep its `event.source !== parent` guard.

### Sub-path deployment (`/app/`)

Configured in two places that must stay in sync:
- `vite.config.ts`: `base: '/app/'`
- `src/App.tsx`: `<BrowserRouter basename="/app">`

### Build / code splitting

Chunks: `monaco` (~4 MB, self-hosted), `prettier`, `zip`, `markdown`, `react-vendor`, `radix-vendor`.
The entry chunk is ~180 KB (measured 08/2026); dialogs, search panel, preview and the editor itself are `React.lazy`.
The service worker precaches the app shell + Monaco; language workers, Prettier and JSZip are
runtime-cached on first use (`vite.config.ts` → `workbox.globIgnores` + `runtimeCaching`).

### Design system

HSL CSS custom properties in `src/index.css`: `:root` holds the **light** palette, `.dark` the dark one
(Tailwind `darkMode: 'class'`, toggled by `useSettings`). UI primitives are shadcn/ui in
`src/components/ui/` — only the 17 actually used are kept; add more with `npx shadcn@latest add <name>`.

### Testing

Two layers:

- **Unit** — Vitest + jsdom, colocated `*.test.ts` (`fileNames`, `settings`, `zipHandler`,
  `fileStorage`, `markdown`, `services/workspace/localStore` with `fake-indexeddb`).
- **E2E** — Playwright in `e2e/`, run against the production build via `vite preview`, on
  **Chromium, Firefox, WebKit** and a Pixel 7 profile. Firefox/WebKit replay `regressions` and
  `features` only: File System Access and `showDirectoryPicker` are Chromium-only (fallbacks exist),
  and performance thresholds would measure the engine rather than the app.
  `regressions.spec.ts` pins every critical bug that actually shipped; `features.spec.ts` covers the
  feature surface; `responsive.spec.ts` runs on a Pixel 7 profile; `performance.spec.ts` guards the
  numbers above; `offline.spec.ts` really goes offline; `site-preview.spec.ts` covers multi-file
  assembly, navigation and isolation.

Do not delete a regression test when refactoring — each one documents a bug that actually shipped.
In E2E, never call `indexedDB.deleteDatabase()` while the app is running: the deletion is deferred
until the connection closes and will wipe what the next session writes. Playwright already gives
each test a clean browser context.
