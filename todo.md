# EditorX — Roadmap & Tâches

## ✅ Terminé en v1.1.0 (audit + corrections, 18/08/2026)

Détail complet dans [plan.md](./plan.md) et [changelog.md](./changelog.md).

- [x] **5 bugs critiques** : fermeture d'onglet destructrice, crash quota (écran blanc),
      auto-save ouvrant un sélecteur en boucle, réglages `NaN`, noms de fichiers en doublon
- [x] **Persistance IndexedDB** (le contenu ne tient plus dans localStorage) + `ErrorBoundary` racine
- [x] **Monaco auto-hébergé** — PWA réellement hors ligne, 0 requête vers un CDN tiers
- [x] **Police JetBrains Mono auto-hébergée** (plus d'appel à Google Fonts)
- [x] **XSS de l'aperçu Markdown** corrigée (DOMPurify) ; aperçu HTML isolé en iframe sandbox
- [x] **Thème clair** appliqué à toute l'interface + thème système
- [x] **Accessibilité** : 0 bouton sans nom accessible, contrastes, repères sémantiques, focus visible
- [x] **Tests Vitest** : 42 tests sur `utils/` et `types/`
- [x] **Workflow CI** GitHub Actions : lint + types + tests + build + audit
- [x] **Découpage `EditorLayout.tsx`** en `useWorkspace` / `useTabs` / `useSettings` / `useSplitLayout`
- [x] **TypeScript `strict: true`**, ESLint 0 erreur, `npm audit` 0 vulnérabilité
- [x] **Perf** : chunk d'entrée 2,32 Mo → 160 Ko, lazy-loading des dialogues et de Prettier,
      recherche globale optimisée, 27 dépendances et 31 composants inutilisés supprimés
- [x] `Ctrl+P` (aller à un fichier), `Ctrl+B` (explorateur), `Ctrl+Maj+T` (rouvrir un onglet),
      filtre de l'explorateur, aperçu HTML, suppression annulable, onglets réorganisables
- [x] Raccourcis PWA (`?action=…`, `?mode=zen`) enfin interprétés
- [x] Version affichée réelle, `theme-color` cohérent, documentation alignée sur le code

## ✅ Terminé en v1.5.0 (ajout de valeur)

- [x] **Console dans l'aperçu HTML** — `console.*`, erreurs, promesses rejetées ; iframe toujours isolée
- [x] **8 modèles de fichiers** + **extraits de code** pour 6 langages
- [x] **Panneaux redimensionnables** (souris, clavier, double-clic) avec largeur conservée
- [x] **Corbeille à 20 niveaux**, restaurable depuis la palette de commandes
- [x] **Tests E2E sur Firefox et WebKit** en plus de Chromium et du profil mobile

## 🚧 En cours

- [ ] **Premier déploiement** : suivre [test_build_deploy.md](./test_build_deploy.md) → publier sur `https://hylst.fr/app/`

## ✅ Terminé en v1.0.2

- [x] **Favicon harmonisé** : `public/favicon.ico` (32×32 PNG-in-ICO), `public/icon.svg` (scalable) — générés depuis le logo "E" bleu via `npm run icons:build`
- [x] **PWA icons** : `icon-192.png` et `icon-512.png` dans `public/`, référencés dans manifest et `index.html`
- [x] **PWA service worker** : `vite-plugin-pwa` + Workbox ; précache mesuré au 25/08/2026 : **36 entrées, ~5,3 Mo** (Monaco inclus, hors ligne réel vérifié par `e2e/offline.spec.ts`)

## ✅ Récemment terminé (v1.0.1)

- [x] Nettoyage complet Lovable (plugin, meta tags, URLs)
- [x] Renommage cohérent "CodeFlow Editor" → "EditorX"
- [x] Configuration déploiement sous-chemin `/app`
- [x] Documentation refondue/créée (README, about, structure, features, test_build_deploy, LICENSE)
- [x] **OG image PNG 1200×630** générée depuis SVG via `npm run og:build` (script `scripts/build-og-image.mjs`)
- [x] **SEO** : manifest.webmanifest, sitemap.xml, robots.txt enrichi, meta theme-color, Schema.org JSON-LD enrichi, URLs OG absolues
- [x] **0 vulnérabilité npm audit** : Vite 5→8, dompurify ≥ 3.4.7 via overrides
- [x] **NotFound.tsx** réécrit (Link au lieu de `<a href>`, design tokens, icônes Lucide, français)
- [x] **Build optimisé** : manualChunks (monaco, react-vendor, radix-vendor, charts)

## 🎯 Priorité Haute (v1.1.0)

### Qualité & infra
- [x] **Tests Vitest** — 42 tests (v1.1.0)
- [x] **Workflow CI** — `.github/workflows/ci.yml` (v1.1.0)
- [ ] **`CONTRIBUTING.md`** : conventions de commit, format de PR, comment lancer les tests
- [x] **Découpage `EditorLayout.tsx`** en `useWorkspace` / `useTabs` / `useSettings` / `useSplitLayout` (v1.1.0)

### Thèmes
- [x] Thème clair complet (v1.1.0)
- [ ] Thème haut contraste custom
- [ ] Import/export de thèmes personnalisés
- [ ] Prévisualisation du thème avant application

### Onglets améliorés
- [x] Drag & drop pour réorganiser les onglets (v1.1.0)
- [ ] Onglets épinglés (pin tabs)
- [x] Historique des onglets fermés (v1.1.0)
- [x] Raccourci `Ctrl+Maj+T` (v1.1.0)

### Snippets & Templates
- [x] Bibliothèque de snippets par langage (v1.5.0)
- [ ] Création de snippets personnalisés
- [x] Insertion rapide par extraits tabulables (v1.5.0)
- [x] Modèles de fichiers — 8 modèles (v1.5.0)

## 🔧 Priorité Moyenne (v1.2.0)

### PWA
- [x] Service worker Workbox avec précache (`vite-plugin-pwa@1.3.0`) — fait en 1.0.2
- [x] Web App Manifest enrichi (installable, shortcuts, screenshot, display_override) — fait en 1.0.2
- [x] Cache stratégique des assets Monaco (`maximumFileSizeToCacheInBytes: 3 MB`) — fait en 1.0.2
- [ ] Page offline (`public/offline.html`) — l'app fonctionne déjà hors ligne, reste le cas d'une URL inconnue
- [ ] Prompt d'installation (`beforeinstallprompt`) dans la barre de statut

### Édition avancée
- [ ] Emmet pour HTML/CSS
- [ ] Multi-curseur avancé (`Ctrl+Shift+L`, édition en colonnes)
- [ ] Diff view local (avant/après)

### Performance
- [x] **Lazy-loading des dialogues** — chunk principal 2,3 Mo → 160 Ko (v1.1.0)
- [x] Dépendances inutilisées supprimées — 27 paquets, 31 composants (v1.1.0)
- [x] Chargement paresseux des modules lourds (Monaco, Prettier, JSZip) (v1.4.0)
- [x] Virtualisation de l'explorateur — 2 001 → 43 nœuds DOM (v1.4.0)
- [x] **Web Worker** pour la recherche globale — blocage 2 146 → 43 ms (v1.4.0)
- [ ] Mettre à jour `caniuse-lite` régulièrement : `npx update-browserslist-db@latest`

### UX
- [x] Indicateur de progression pour l'import ZIP (v1.1.0)
- [ ] Améliorer le feedback visuel du drag & drop entre dossiers
- [x] Suppression confirmée **et annulable** ; fermer un onglet ne détruit plus rien (v1.1.0)

### Intégration Git (visualisation)
- [ ] Affichage des lignes modifiées dans la gouttière
- [ ] Comparaison de fichiers (diff view)
- [x] Journal de reprise après plantage de l'onglet (v1.4.0)
- [ ] Historique des modifications locales

### Monitoring
- [ ] Sentry **opt-in** (toggle dans Settings → "Send anonymous error reports")

## 📦 Priorité Basse (v2.0.0+)

### Collaboration
- [ ] Mode lecture seule pour partage
- [ ] Export/partage de workspace via lien
- [ ] **Collaboration temps réel** (Yjs / CRDT)

### Terminal & exécution
- [x] Console de l'aperçu HTML (lecture des messages) (v1.5.0)
- [ ] Exécution de code JS/TS (sandbox iframe ou WebContainer)
- [x] Affichage des `console.log` de la page prévisualisée (v1.5.0)

### Extensions / Plugins
- [ ] Architecture de plugins simple (API stable)
- [ ] Marketplace communautaire
- [ ] Gestionnaire d'extensions intégré

### Cloud opt-in
- [x] Ouverture d'un dossier réel du disque avec écriture directe (v1.4.0)
- [ ] Sauvegarde sur cloud personnel (Dropbox, Google Drive, OneDrive)
- [ ] Sync multi-appareils
- [ ] Versioning automatique

### Stats & profil
- [x] Compteur lignes/mots/caractères dans la barre d'état (v1.1.0)
- [ ] Temps d'édition
- [ ] Lignes de code par langage

### Accessibilité
- [ ] Audit complet WCAG AA
- [ ] Support lecteur d'écran renforcé
- [ ] Mode daltonien

## 🐛 Corrections connues à surveiller

- [x] Zone de drop explicite "Déposer à la racine"
- [x] Recherche globale avec `Ctrl+Shift+F`
- [x] Recherche locale avec `Ctrl+F`
- [x] Rechercher/remplacer avec `Ctrl+H`
- [x] Erreurs d'expression régulière affichées dans le panneau de recherche (v1.1.0)
- [ ] Suppression récursive de dossiers : pré-calculer la liste des IDs avant confirmation (déjà OK, à vérifier après refactor)
- [x] Repli File System Access documenté et bouton « Ouvrir » toujours actif (v1.1.0)

## 📝 Notes techniques

### Bonnes pratiques à maintenir
- 100 % front-end, aucun backend
- Persistance localStorage + IndexedDB
- Tous les raccourcis clavier personnalisables (à venir)
- Interface responsive

### À surveiller
- Le File System Access API est bloqué en iframe et indisponible sur Firefox/Safari (fallback `<input type="file">` en place)
- localStorage ne contient plus que les métadonnées (~1 Ko) ; **le contenu est en IndexedDB**
- Monaco (~4 Mo) est **embarqué** : ne jamais revenir au chargement CDN, cela casserait le hors ligne
- L'aperçu Markdown doit **toujours** passer par `renderMarkdown()` (DOMPurify)

### Dette technique (état après 1.1.0)
- ~~`EditorLayout.tsx` à 1494 LOC~~ → découpé en hooks (composition ~1 226 LOC au 08/2026)
- ~~Aucun test automatisé~~ → **139 tests unitaires + 120 tests E2E Playwright** (7 specs)
- ~~Pas de CI/CD~~ → workflow CI en place ; déploiement encore manuel
- `Index.tsx` est un wrapper trivial — à inliner ou justifier
- ~~Panneaux latéraux à largeur fixe~~ → redimensionnables depuis la 1.5.0 (`ResizeHandle`)
- Interface non repensée pour mobile


---

## Reste à faire (après 1.5.0)

### Édition
- [x] **Six modèles de fichiers supplémentaires** (v1.6.0) — 8 → 14
- [ ] Emmet pour HTML/CSS (dépendance à charger dynamiquement — voir l'invariant hors ligne)
- [ ] Multi-curseur avancé (`Ctrl+Maj+L`, édition en colonnes)
- [ ] Comparaison avant/après enregistrement (diff local)
- [ ] Annulation persistant au rechargement

### Projet
- [ ] Espaces de travail multiples (basculer sans écraser)
- [ ] Synchronisation bidirectionnelle avec le dossier disque ouvert
- [ ] Import ZIP fusionnant au lieu de remplacer

### Partage et collaboration
- [ ] Lien de partage en lecture seule (projet encodé, toujours sans serveur)
- [ ] Puis, via `remoteStore.ts` : multi-appareils, historique, collaboration CRDT

### Exécution
- [x] **Prévisualisation d'un site complet multi-fichiers** (v1.6.0 → v1.7.0) — **les 4 phases sont faites**
- [ ] Exécution JavaScript/TypeScript en bac à sable (Web Worker)
- [x] Console interactive (saisie d'expressions) (v1.7.0)

### Confort
- [ ] Raccourcis personnalisables
- [ ] Mise en page mobile dédiée (tiroirs)

### Industrialisation
- [ ] Déploiement automatisé depuis la CI
- [ ] Budget de taille de bundle vérifié en CI

### Aperçu de site — pistes ouvertes après la phase 4
- [ ] Complétion des expressions dans la console (noms globaux de la page)
- [ ] Formats d'écran personnalisés (largeur libre, rotation)
- [ ] Rechargement à chaud partiel (ne réassembler que le fichier modifié)
- [ ] Inspecteur d'éléments rudimentaire (survol → sélecteur CSS)


---

## 📄 Modèles de fichiers — ✅ livrés en 1.6.0

Les six modèles proposés ont été ajoutés (8 → **14**), dont un **Site web complet** qui crée trois
fichiers liés et sert de démonstration à l'aperçu de site :

| Modèle | Nom proposé | Pourquoi celui-ci |
|--------|-------------|-------------------|
| **Site web complet** | `index.html` + `styles.css` + `app.js` | Trois fichiers liés d'un coup, démonstration directe de l'aperçu de site |
| **Composant Vue (SFC)** | `Composant.vue` | Vue est déjà reconnu par la coloration syntaxique et par Prettier, mais aucun modèle ne l'exploitait |
| **Serveur Node / Express** | `serveur.js` | Cas d'usage le plus fréquent après le front : une petite API pour accompagner le site |
| **Test unitaire Vitest** | `module.test.ts` | Squelette Vitest — valide aussi le formatage TS |
| **Workflow GitHub Actions** | `ci.yml` | Valide aussi le formatage YAML, réparé en 1.1.0 mais jamais mis en avant |
| **`.gitignore` (Node / web)** | `.gitignore` | Universel, et déjà associé au langage `ini` par la détection de type |

Candidat de réserve, si le besoin s'en fait sentir : `Dockerfile` (déjà reconnu par la détection).

**Effort estimé** : très faible — `src/utils/templates.ts` est une simple liste, et chaque modèle
est automatiquement proposé dans l'explorateur *et* dans la palette de commandes.
Prévoir un test E2E par modèle ajouté, sur le patron de celui qui existe déjà.

---

## 🌐 Prévisualiser un site complet, sans backend

**Question posée** : EditorX peut-il « lancer un serveur » pour tester un site HTML/CSS/JS
multi-fichiers, avec bascule entre édition et aperçu ?

**Réponse : oui, et sans aucun backend.** La faisabilité a été vérifiée par des essais réels dans
le navigateur (et non par déduction) — voir le tableau ci-dessous.

### Ce que les essais ont montré

L'aperçu s'exécute dans une iframe `sandbox` **sans** `allow-same-origin` : son origine est
*opaque*, ce qui garantit qu'une page prévisualisée ne peut pas lire le stockage d'EditorX.
Cette isolation impose des contraintes, mesurées :

| Mécanisme envisagé | Résultat | Conséquence |
|--------------------|----------|-------------|
| Service worker faisant office de serveur | ❌ inaccessible | Une origine opaque n'est pas contrôlée par un service worker |
| `Blob URL` pour les CSS/JS externes | ❌ bloqué | Les URL `blob:` appartiennent à l'origine créatrice |
| Scripts et styles **inline** | ✅ | Base de la solution |
| Modules ES via `data:` URI | ✅ | Permet `<script type="module">` |
| **Import map + `data:` URI** | ✅ | Permet d'écrire `import './util.js'` sans rien changer au code |
| Images / polices en `data:` URI | ✅ | Les binaires sont déjà stockés en base64 depuis la 1.3.0 |
| Shim de `fetch` | ✅ | `fetch('./donnees.json')` servi depuis la mémoire |
| Shim de `XMLHttpRequest` | ✅ | Pour les bibliothèques plus anciennes |
| Interception des liens internes | ✅ | Via `getAttribute('href')` — `a.href` renvoie une URL absolue trompeuse |

**Conclusion** : plutôt qu'un serveur, on assemble un **serveur virtuel en mémoire**. C'est
l'approche de CodePen, et elle conserve l'isolation de sécurité — contrairement à un service
worker, qui exigerait de servir le code de l'utilisateur sur la même origine que l'éditeur.

### Plan proposé

#### Phase 1 — Assemblage multi-fichiers ✅ **fait en 1.6.0**

- [x] `src/utils/sitePreview.ts` : à partir de `files` + `folders`, produire un document autonome
  - [x] résoudre `<link rel="stylesheet" href="…">` → `<style>` inline
  - [x] résoudre `<script src="…">` → `<script>` inline
  - [x] résoudre `<img src="…">`, `url(…)` en CSS, `<source>`, favicon → `data:` URI depuis les binaires
  - [x] générer une **import map** (`data:` URI par module) pour que `import './util.js'` fonctionne
  - [x] résoudre les chemins relatifs (`./`, `../`) contre l'arborescence du projet
  - [x] signaler les références manquantes dans la console de l'aperçu, plutôt que d'échouer en silence
- [x] Injecter les shims `fetch` / `XMLHttpRequest` servant les fichiers texte du projet
- [x] Garde-fous : limite de taille du document assemblé, détection des cycles d'import

#### Phase 2 — Navigation dans le site ✅ **fait en 1.6.0**

- [x] Intercepter les clics sur les liens internes et réassembler la page cible
- [ ] Barre d'adresse minimale dans l'aperçu : page courante, retour, rechargement
- [ ] Conserver l'historique de navigation de l'aperçu (précédent / suivant)

#### Phase 3 — Bascule édition ↔ aperçu ✅ **fait en 1.6.0**

- [x] Mode **aperçu plein écran** (`Ctrl+Maj+V`), avec retour à l'édition par le même raccourci
- [ ] Bouton « Ouvrir dans un nouvel onglet » — un onglet dédié, toujours servi depuis la mémoire
- [ ] Rechargement automatique à la sauvegarde, avec option de gel manuel
- [x] Choix du point d'entrée (`index.html` par défaut, sinon le premier `.html` du projet)

#### Phase 4 — Confort ✅ **fait en 1.7.0**

- [x] Console déjà en place (1.5.0) : y ajouter la saisie d'expressions
- [x] Sélecteur de format d'écran (mobile / tablette / bureau) pour tester le responsive
- [x] Indicateur des ressources non résolues, avec lien vers le fichier fautif

### Limites assumées

Ces limites tiennent à l'absence de serveur, et doivent être **documentées, pas contournées** :

- pas d'appels réseau réels vers une API tierce (le `sandbox` bloque les requêtes cross-origin) ;
- pas de routage côté serveur (`/a-propos` sans `.html`) : seuls les fichiers existent ;
- pas d'exécution de code serveur (PHP, Node…) — un modèle Express reste éditable, non exécutable ;
- les cookies et `localStorage` de la page prévisualisée sont inopérants en origine opaque ;
- pas de rechargement à chaud partiel : la page est réassemblée en entier.

**Alternative écartée** : servir l'aperçu depuis un sous-domaine dédié (`preview.hylst.fr`) lèverait
la plupart de ces limites et autoriserait un vrai service worker. Cela ne demande pas de backend
applicatif, seulement une entrée d'hébergement statique supplémentaire — mais cela sort du cadre
« une seule origine, aucun prérequis de déploiement » tenu jusqu'ici. À reconsidérer si le besoin
d'appels réseau réels apparaît.

### Effort et risques

| Phase | Effort | Risque principal |
|-------|--------|------------------|
| 1 — Assemblage | 1 à 2 jours | Résolution des chemins : à couvrir par des tests unitaires purs |
| 2 — Navigation | ½ journée | Faible |
| 3 — Bascule | ½ journée | Faible ; attention à ne pas perdre le focus de l'éditeur |
| 4 — Confort | 1 jour | Faible |

L'assemblage est une transformation **pure** (`files` → chaîne HTML) : il se teste entièrement en
Vitest, sans navigateur. Les tests E2E ne couvriront que l'intégration et la bascule.
