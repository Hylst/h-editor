# Reprise du développement — H Editor

> Document de passation. À lire **en entier** avant toute modification : il contient des pièges
> qui ont réellement coûté des régressions, et des invariants qu'un refactoring naïf casse.
>
> État au 24/08/2026 — version **1.7.0**.

---

## 1. En deux minutes

**H Editor** est un éditeur de code **100 % front-end** : aucun backend, aucun compte, aucune requête
vers un tiers. React 18 + TypeScript strict + Vite + Monaco, déployé sous `/heditor/`.

```bash
npm run dev              # http://localhost:8080/heditor/
npm run test:all         # lint + types + 144 tests unitaires + 121 E2E
npm run test:e2e:chromium  # itération rapide sur un seul moteur
```

| Indicateur | Valeur |
|---|---|
| Tests unitaires (Vitest) | **144** |
| Tests E2E (Playwright, 4 profils) | **121** |
| ESLint | 0 erreur, 4 avertissements de convention shadcn |
| TypeScript | `strict: true`, 0 erreur |
| `npm audit --omit=dev` | 0 vulnérabilité |
| Chunk d'entrée | ~180 Ko (mesuré 08/2026) |
| Précache du service worker | 37 entrées, ~5,5 Mo (mesuré 08/2026) |

---

## 2. Les six invariants

Chacun correspond à un défaut qui a **réellement existé**. Les casser ne provoque pas d'erreur de
compilation : seuls les tests les rattrapent.

### 2.1 `files` est un nouveau tableau à chaque frappe

Ne jamais faire dépendre un effet ou un composant du tableau `files` directement : dériver une
signature d'ids (`useTabs`, `useSplitLayout`) ou mémoïser sur les métadonnées (`Sidebar`, `TabBar`).
Sans cela, tout le projet est recalculé à chaque caractère saisi — mesuré à 146 ms/caractère sur
2 000 fichiers.

### 2.2 Tout import statique du chunk d'entrée doit être précaché

Sinon **l'application ne démarre pas hors ligne**. `jszip`, `prettier` et Monaco sont chargés par
`import()` dynamique précisément pour rester hors du précache. Ce défaut a existé pendant trois
versions sans être vu : `e2e/offline.spec.ts` coupe le réseau pour de vrai, gardez-le vert.

### 2.3 Un fichier `binary` ne subit jamais de traitement texte

Ni recherche, ni remplacement, ni formatage, ni aperçu. Un `String.replace` sur du base64 **détruit
le fichier** : l'en-tête PNG `137,80,78,71` devient `137,80,87,71`. Voir `binarySafety.test.ts`.

### 2.4 Fermer un onglet ne supprime jamais un fichier

`useTabs` ne touche qu'à `tabs`. Seuls `deleteFile` / `deleteFolder` retirent du contenu, toujours
derrière une confirmation et une entrée de corbeille.

### 2.5 Aucune écriture ne doit lever

`store.save()` renvoie un `SaveOutcome`. Un quota dépassé devient une notification, jamais une
exception — une exception dans un effet démonte tout l'arbre React et affiche une page blanche.

### 2.6 L'iframe d'aperçu garde `sandbox` **sans** `allow-same-origin`

C'est ce qui empêche une page prévisualisée de lire le stockage de l'éditeur. Toute la conception de
l'aperçu de site en découle (voir §4).

---

## 3. Architecture

```
src/
├── components/Editor/
│   ├── EditorLayout.tsx      Composition : hooks, raccourcis, commandes, mise en page
│   ├── MonacoEditor.tsx      Enveloppe paresseuse ; MonacoEditorInner fait le travail
│   ├── Sidebar.tsx           Explorateur (mémoïsé, virtualisé au-delà de 300 entrées)
│   ├── PreviewPanel.tsx      Aperçu Markdown/HTML + console + navigation de site
│   └── ResizeHandle.tsx      Poignée de redimensionnement accessible
├── hooks/
│   ├── useWorkspace.ts       Source de vérité des fichiers + persistance
│   ├── useTabs.ts            Onglets (jamais les fichiers)
│   ├── useSettings.ts        Préférences validées + thème
│   ├── useSplitLayout.ts     Vue divisée
│   ├── useSearch.ts          Pilote le Web Worker de recherche
│   ├── useVirtualList.ts     Fenêtrage de liste, sans dépendance
│   ├── useKeyboardShortcuts.ts  Raccourcis globaux (ignorés dans les champs UI)
│   └── useInstallPrompt.ts   Capture `beforeinstallprompt`, bouton « Installer » (barre d'état)
├── services/workspace/       Contrat de stockage (prêt pour un backend)
├── workers/search.worker.ts  Recherche hors du thread principal
└── utils/
    ├── sitePreview.ts        Assemblage de site multi-fichiers (pur, testable)
    ├── previewConsole.ts     Pont console de l'iframe (postMessage)
    ├── storage/              IndexedDB, compression gzip, journal de reprise
    ├── templates.ts          14 modèles de fichiers
    └── snippets.ts           Extraits de code par langage
```

### Persistance

| Donnée | Emplacement | Pourquoi |
|---|---|---|
| Arborescence, onglets, métadonnées | `localStorage` (~1 Ko) | Lecture synchrone au démarrage |
| Contenu des fichiers | IndexedDB, **compressé gzip** | Pas de plafond à 5 Mo, écriture incrémentale |
| Réglages | `localStorage`, via `sanitizeSettings` | Ne jamais faire confiance au JSON stocké |
| Frappe en cours | `sessionStorage` (journal) | Survit à un plantage brutal de l'onglet |

Écriture différée de 600 ms, **purgée immédiatement** sur `visibilitychange` / `pagehide`.
Un conflit (autre onglet, fichier modifié sur le disque) est **détecté et soumis à l'utilisateur**,
jamais écrasé.

---

## 4. L'aperçu de site — la partie la plus subtile

**Objectif** : tester un site HTML/CSS/JS multi-fichiers sans serveur.

L'iframe a une **origine opaque** (invariant 2.6). Cela a été mesuré, pas supposé :

| Approche | Résultat |
|---|---|
| Service worker faisant office de serveur | ❌ une origine opaque n'est pas contrôlée par un SW |
| `blob:` URL pour les CSS/JS | ❌ elles appartiennent à l'origine créatrice |
| Contenu inline, `data:` URI, shims `fetch`/`XHR` | ✅ |

D'où `sitePreview.ts` : un **serveur virtuel en mémoire**. Il résout les feuilles de styles, les
scripts, les modules ES (réécriture des imports en `data:` URI, récursivement), les images
(base64 déjà stocké), les `url()` CSS, et injecte des shims `fetch`/`XHR` servant les fichiers texte
du projet. La navigation entre pages passe par `postMessage`.

**Trois pièges à connaître** :

1. `escapeForInlineTag` — un `</script>` dans le code de l'utilisateur refermerait la balise.
2. `toInlineJson` — `JSON.stringify` n'échappe pas `<`, et la table des fichiers virtuels contient
   du code utilisateur. Séparateurs Unicode compris.
3. `toDataUri` utilise le pourcent-encodage, **pas `btoa`** : un accent suffirait à faire lever.

**Console interactive** (1.7.0) : le parent envoie une expression par `postMessage` sur le canal
`editorx-preview-eval`, l'iframe l'évalue et renvoie le résultat par le canal console habituel.
`eval` est ici légitime — la page est déjà en origine opaque — mais le récepteur **doit** garder sa
garde `event.source !== parent`, sans quoi n'importe quel cadre pourrait exécuter du code.

Limites assumées, à documenter plutôt qu'à contourner : pas d'appel réseau réel, pas de routage
serveur, pas d'exécution PHP/Node, cookies et `localStorage` inopérants dans l'aperçu.

---

## 5. Pièges de développement

### Tests E2E

- **Ne jamais appeler `indexedDB.deleteDatabase()` pendant que l'application tourne** : la
  suppression est différée jusqu'à la fermeture de la connexion et efface ce que la session
  suivante écrit. Playwright fournit déjà un contexte vierge par test.
- **Attendre la persistance réelle**, pas le texte « Enregistré à » : utiliser
  `waitForPersisted` / `waitForPersistedContent` de `e2e/helpers.ts`.
- **Monaco est remonté à chaque changement de fichier** : taper juste après `Ctrl+N` perd les
  premiers caractères. `typeInEditor` attend le focus.
- **`formatOnType` réécrit le texte pendant la frappe** : ne pas exiger le texte à l'identique.
- Le parallélisme est plafonné à 4 : Firefox et WebKit dépassaient les délais sur machine chargée.

### Écriture de code

- `crypto.randomUUID()` n'existe **pas** hors contexte sécurisé (`http://192.168.x.x`) :
  utiliser `createId()` de `utils/ids.ts`.
- `DOMPurify.addHook` n'existe pas hors contexte DOM : l'appel est gardé.
- Les scripts Python de correction en masse échouent sur les `\n` dans les chaînes : préférer
  `String.fromCharCode(10)` ou l'édition directe.

---

## 6. Où reprendre

`todo.md` contient la liste complète et priorisée. Les trois pistes les plus utiles :

1. **Emmet pour HTML/CSS** — à charger en `import()` dynamique (invariant 2.2).
2. **Espaces de travail multiples** — basculer entre projets sans écraser ; la couche
   `services/workspace/` est déjà prête à porter plusieurs espaces.
3. **Aperçu de site, pistes ouvertes** — complétion dans la console, rechargement à chaud partiel,
   inspecteur d'éléments. Les quatre phases prévues sont faites.

**Décision produit à respecter** : l'internationalisation (i18n) a été **écartée**. L'interface
reste en français, et les sélecteurs E2E s'appuient sur les noms accessibles français.

---

## 7. Avant de livrer

```bash
npm run test:all
```

Et vérifier que ces quatre points restent vrais :

- [ ] Aucune requête réseau externe (`e2e/regressions.spec.ts`)
- [ ] L'application démarre hors ligne (`e2e/offline.spec.ts`)
- [ ] Aucune erreur dans la console
- [ ] Les seuils de performance tiennent (`e2e/performance.spec.ts`)
