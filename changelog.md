# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

---

## [Unreleased]

Améliorations PWA et affichage mobile.

### ✅ Page de fallback hors ligne (Added)

`public/offline.html` est désormais servie par le service worker (`navigateFallback`) quand une
navigation échoue faute de réseau. La page précise qu'H Editor fonctionne hors ligne et offre un
lien de retour vers l'éditeur. Le fallback n'intercepte ni les appels `/api/` ni les fichiers à
extension (les assets 404 ne sont pas masqués par la page hors ligne).

### 📲 Prompt d'installation PWA (Added)

Bouton **« Installer »** dans la barre de statut, affiché uniquement quand le navigateur émet
`beforeinstallprompt` (PWA installable, application pas encore installée). Nouveau hook
`useInstallPrompt` qui capture l'événement et déclenche le prompt.

### 📱 Explorateur replié par défaut sur mobile (Changed)

Sur écran étroit (< 768 px), l'explorateur démarre replié pour laisser la place à l'éditeur.
L'utilisateur peut toujours l'ouvrir via Ctrl+B ou le bouton de la barre d'outils. Le test E2E
responsive a été adapté pour couvrir ce nouveau comportement.

### 📦 Manifest et installabilité iOS (Changed)

- `id` explicite (`/app/`) dans le manifest PWA ;
- second screenshot au format portrait (`narrow`) ;
- balises iOS ajoutées dans `index.html` (`apple-mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style`, icône 512 px).

### ✏️ Renommage : EditorX devient H Editor (Changed)

Le nom change dans toute l'interface, le manifeste PWA, les métadonnées SEO, les icônes (la
lettre « E » devient « H ») et la documentation. Le sous-titre de l'en-tête « Éditeur de code
professionnel » laisse place à « Né sur smartphone, élevé à la demoscene », et le titre se
pare d'un cycle de couleurs régulier, hommage aux démos de l'époque — désactivé pour les
utilisateurs en `prefers-reduced-motion`.

**Les clés de stockage restent inchangées** (`editorx-workspace`, `editorx-settings`, base
IndexedDB `editorx`, canaux `editorx-preview-*`) : les renommer aurait rendu illisibles les
données des utilisateurs existants. La compatibilité des espaces de travail est préservée.

### 🛠️ Import JSON (Fixed)

Un JSON valide qui n'est pas une sauvegarde de projet (une config, des données…) était rejeté
comme « Fichier JSON invalide ». Il est désormais **ajouté au projet comme fichier ordinaire**,
onglet ouvert, avec une notification qui explique le cas ; seuls les JSON illisibles produisent
une erreur. Test de non-régression : `analyzeJSONImport`.

### 📂 Déploiement sous `/heditor/` (Changed)

Le sous-chemin de déploiement passe de `/app/` à **`/heditor/`** (H pour Hylst) :

- `vite.config.ts` : `base: '/heditor/'`, manifeste (`start_url`, `scope`, `id`), raccourcis
  d'application et `navigateFallback` alignés ;
- `src/App.tsx` : `<BrowserRouter basename="/heditor">` ;
- `public/offline.html`, SEO (`canonical`, Open Graph, JSON-LD), `robots.txt`, `sitemap.xml`,
  `package.json` et `appInfo.ts` (homepage) mis à jour ;
- le sous-titre « Né sur smartphone, élevé à la demoscene » de l'en-tête est supprimé.

Le build statique se place désormais dans `/heditor/` du serveur Nginx (Coolify ou autre) :
`https://hylst.fr/heditor/`.

---

## [1.7.0] - 2026-08-24

Phase 4 de l'aperçu de site : la prévisualisation devient un véritable outil de mise au point.

### 🖥️ Console interactive (Added)

La console de l'aperçu accepte désormais la **saisie d'expressions**, évaluées dans la page
prévisualisée : `document.querySelector('h1').textContent`, `2 + 3`, une promesse…

- expression réaffichée puis résultat, avec des marqueurs distincts (`❯` / `←`) ;
- erreurs d'évaluation affichées sans casser l'aperçu ;
- promesses résolues et affichées à leur terme ;
- **historique des commandes** parcouru aux flèches haut/bas, comme dans un terminal.

L'évaluation a lieu **dans l'iframe**, qui reste en origine opaque : `eval` n'y donne accès ni au
stockage ni au DOM de l'éditeur. Le récepteur n'accepte que les messages du parent
(`event.source !== parent` est rejeté).

### 📱 Sélecteur de format d'écran (Added)

Trois formats pour éprouver le responsive sans quitter l'éditeur : **Bureau**, **Tablette** (768 px)
et **Mobile** (375 px). Le cadre réduit est centré et ombré ; le site y reste pleinement
fonctionnel — scripts compris.

### ⚠️ Ressources introuvables cliquables (Changed)

Le compteur d'avertissements ouvre désormais une **liste détaillée**, et chaque entrée **ouvre le
fichier fautif** d'un clic.

Pour cela, les ressources manquantes sont devenues des objets structurés
(`{ reference, sourcePath, kind }`) au lieu de messages libres : une image absente référencée par
`styles.css` désigne bien `styles.css`, et non la page qui l'inclut.

### 🧪 Tests

- **139 tests unitaires** (+7) : ressources structurées, pont d'évaluation, garde du parent.
- **120 tests E2E** (+7) : évaluation d'expressions, accès au DOM, expression erronée, historique,
  formats d'écran, site fonctionnel en mobile, ouverture du fichier fautif.

## [1.6.0] - 2026-08-24

Prévisualisation d'un **site complet multi-fichiers**, sans backend — et six nouveaux modèles.

### 🌐 Aperçu de site (Added)

Un site HTML/CSS/JS réparti sur plusieurs fichiers peut désormais être testé directement dans
l'éditeur. L'aperçu **assemble le projet en mémoire** :

- feuilles de styles et scripts liés intégrés au document ;
- **modules ES** : les imports internes sont réécrits récursivement en `data:` URI, si bien que
  `import './util.js'` fonctionne sans rien changer au code ;
- images, polices et binaires servis en `data:` URI (déjà stockés en base64 depuis la 1.3.0) ;
- `url(...)` des feuilles de styles résolus ;
- **shims `fetch` et `XMLHttpRequest`** servant les fichiers texte du projet ;
- **navigation entre pages** : les liens internes sont interceptés et la page cible réassemblée,
  avec un bouton de retour ;
- ressources introuvables signalées, sans jamais interrompre l'aperçu.

**Aperçu plein écran** (`Ctrl+Maj+V`) pour basculer entre édition et test du site ; `Échap` revient.

L'isolation est **préservée** : l'iframe conserve `sandbox` sans `allow-same-origin`, donc la page
prévisualisée ne peut pas lire le stockage de l'éditeur — vérifié par un test dédié.

> **Pourquoi pas un service worker ?** Parce qu'il ne contrôle pas un document d'origine opaque, et
> que les `blob:` URL y sont bloquées. Les deux points ont été mesurés avant de choisir l'approche.

### 📄 Six nouveaux modèles (Added)

Portés de 8 à **14** : **Site web complet** (crée `index.html` + `styles.css` + `app.js` liés,
directement testable dans l'aperçu), **Composant Vue (SFC)**, **Serveur Node/Express**,
**Workflow GitHub Actions**, **`.gitignore`**, **Test unitaire Vitest**.
Un modèle peut désormais créer plusieurs fichiers d'un coup.

### 🔴 Corrigé (Fixed)

- **Deux iframes coexistaient en plein écran** : le site s'exécutait en double et les messages de
  console se mélangeaient. Le panneau latéral n'est plus monté dans ce mode.
- **Le code de l'utilisateur pouvait casser le document assemblé** : un `</script>` dans un fichier,
  ou dans la table des fichiers virtuels, refermait la balise. Échappement des chevrons et des
  séparateurs de ligne Unicode.

### 📚 Documentation (Added)

- **`continue.md`** — passation complète : invariants, architecture, pièges, où reprendre.
- **`agents.md`** — instructions pour les agents de codage (opencode et autres).

### 🧪 Tests

- **132 tests unitaires** (+26) dont 26 pour l'assemblage de site (transformation pure).
- **113 tests E2E** (+7) : styles et scripts liés, navigation entre pages, plein écran, isolation.

## [1.5.0] - 2026-08-20

Ajout de valeur, une fois la dette traitée : confort d'édition, aperçu exécutable,
sécurité des données, et validation sur trois moteurs de navigateur.

### ✨ Nouveautés (Added)
- **Console dans l'aperçu HTML.** Les appels à `console.log/info/warn/error/debug`, les erreurs non
  rattrapées et les promesses rejetées de la page prévisualisée s'affichent sous l'aperçu.
  Le pont passe par `postMessage` : l'iframe reste en `sandbox` **sans** `allow-same-origin`, donc
  la page n'accède ni au stockage ni au DOM d'H Editor — vérifié par un test dédié.
- **Modèles de fichiers** : 8 points de départ (HTML5, composant React, module TypeScript, script
  Python, document Markdown, configuration JSON, feuille de styles, schéma SQL), accessibles depuis
  l'explorateur et la palette de commandes.
- **Extraits de code** (snippets) pour JavaScript, TypeScript, React, CSS, Python et HTML :
  `cl`, `fn`, `rfc`, `useState`, `flexcenter`, `def`… avec navigation par tabulation entre les champs.
- **Panneaux latéraux redimensionnables** : explorateur et recherche se règlent au glisser, au
  clavier (flèches, ±16 px, ±64 px avec Maj) ou d'un double-clic pour revenir à la largeur d'origine.
  La largeur est conservée entre les sessions.
- **Corbeille à plusieurs niveaux** : les 20 dernières suppressions restent restaurables depuis la
  palette de commandes. Auparavant, seule la dernière pouvait être annulée — une suppression en
  série était irrécupérable dès la seconde.

### 🧪 Qualité (Added)
- **Tests E2E sur trois moteurs** : Chromium, **Firefox** et **WebKit**, plus le profil Pixel 7.
  106 exécutions au total. Firefox et WebKit rejouent les régressions critiques et les
  fonctionnalités ; les mesures de performance restent sur Chromium, où elles ont un sens.
- **106 tests unitaires** (+11) : injection et validation du pont de console, canal `postMessage`.
- **8 tests E2E** pour les nouveautés, dont l'isolation réelle de l'iframe et la persistance des
  largeurs de panneaux.

### 🔧 Ajusté (Changed)
- Parallélisme des tests plafonné à 4 processus : Firefox et WebKit dépassaient les délais sur une
  machine chargée, sans qu'aucun défaut applicatif ne soit en cause (vérifié en série).
- Un test de raccourcis clavier attendait la fin de la recherche avant d'agir : il dépendait de la
  vitesse de la machine.

## [1.4.0] - 2026-08-20

Traitement de tous les points restés ouverts (N.1 à N.10), et correction d'une régression
introduite en 1.3.0 ainsi que d'un défaut du mode hors ligne.

### 🔴 Corrections critiques (Fixed)
- **Un remplacement global corrompait les fichiers binaires.** Depuis la 1.3.0, « Tout remplacer »
  appliquait l'expression régulière au base64 : l'en-tête PNG `137,80,78,71` devenait
  `137,80,87,71`, image détruite. Les binaires sont désormais exclus de la recherche **et** du
  remplacement ; l'éditeur, la barre d'état et l'explorateur les traitent comme tels.
- **L'application ne démarrait pas hors ligne.** `jszip` était importé statiquement alors que son
  chunk est volontairement hors du précache : sans réseau, son échec bloquait tout le démarrage
  (`#root` restait vide). La promesse « fonctionne hors ligne » était donc inexacte depuis la 1.1.0.
  JSZip est maintenant chargé à la demande, et **un test E2E coupe réellement le réseau** pour le
  prouver.
- **`DOMPurify.addHook` faisait planter l'import du module** hors contexte DOM (worker, rendu
  serveur, test Node).

### ⚡ Performance (Changed)
- **Recherche globale déportée dans un Web Worker** : le blocage du thread principal passe de
  **2 146 ms à 43 ms** sur un projet de 1 500 fichiers (mesuré). Repli synchrone si les workers
  sont indisponibles ; les réponses périmées d'une frappe antérieure sont ignorées.
- **Explorateur virtualisé** au-delà de 300 entrées, sans dépendance ajoutée. À 2 000 fichiers :
  **2 001 → 43 nœuds** dans le DOM, frappe **146 → 27 ms par caractère**, filtre **210 → 55 ms**.
- **Frappe allégée** : `useTabs` et `useSplitLayout` ne réagissent plus qu'aux changements de
  composition du projet (et non à chaque caractère), `Sidebar` et `TabBar` sont mémoïsés sur les
  seules métadonnées.
- **Précache réduit de 47 %** (10 241 → 5 428 Ko) : 4,4 Mo d'illustrations de communication
  (`social/`, `og-image.png`) y figuraient sans jamais servir à l'éditeur.

### 💾 Données (Added)
- **Journal de reprise** : chaque frappe est inscrite dans `sessionStorage`. Après un plantage
  brutal de l'onglet — où ni `pagehide` ni `visibilitychange` ne sont émis — les modifications non
  enregistrées sont proposées à la restauration au démarrage suivant.
- **Détection des modifications hors application** : si un fichier a changé sur le disque depuis son
  ouverture (autre éditeur, `git checkout`…), `Ctrl+S` refuse d'écraser et propose d'arbitrer.

### 📂 Fonctionnalités (Added)
- **Ouverture d'un dossier réel du disque** (`showDirectoryPicker`) : l'arborescence est importée
  avec les handles, si bien que `Ctrl+S` réécrit ensuite directement sur le disque, sans sélecteur.
  Dossiers techniques ignorés (`node_modules`, `.git`, `dist`…), binaires préservés, limites de
  taille et de nombre, import annulable.

### 🧪 Tests
- **95 tests unitaires** (+26) : sécurité des binaires, worker de recherche, journal de reprise.
- **40 tests E2E** (+7) : performance (frappe, DOM, filtre, repli de dossier), hors ligne réel avec
  coupure du réseau, absence des illustrations dans le précache.

## [1.3.0] - 2026-08-19

Suite du plan d'amélioration : compression du stockage, préservation des binaires,
protection contre l'écrasement concurrent.

### 💾 Stockage (Added / Changed)
- **Compression gzip** du contenu écrit en IndexedDB (`CompressionStream`) : un fichier source
  répétitif occupe environ **5 fois moins de place**, à quota navigateur constant. Repli
  transparent en clair si l'API est absente, et relecture des projets écrits sans compression.
- **Protection contre l'écrasement concurrent** : chaque écriture porte un **numéro de révision**
  (et non un horodatage, deux sauvegardes pouvant tomber dans la même milliseconde). Si un autre
  onglet a écrit entre-temps, la sauvegarde est **refusée** et l'utilisateur tranche —
  « Recharger » ou « Garder ma version » — au lieu de perdre silencieusement un travail.

### 📦 Import / export (Fixed)
- **Les fichiers binaires d'une archive ZIP ne sont plus perdus** : ils sont conservés en base64,
  signalés comme non éditables dans l'éditeur, et **restitués intacts à l'export**. Un aller-retour
  import → export préserve désormais les images et autres ressources.
  Auparavant ils étaient simplement ignorés (et, avant la 1.1.0, corrompus).
- Limite de 2 Mo par binaire pour ne pas gonfler inutilement le stockage.
- Le drapeau binaire est conservé dans l'export JSON.

### 🧪 Tests
- **69 tests unitaires** (+15) : compression (9, exécutés sous Node où l'API existe),
  révision et conflit, aller-retour binaire ZIP, relecture d'un format antérieur.
- **33 tests E2E** (+1) : deux onglets réels ne peuvent plus s'écraser l'un l'autre.

## [1.2.0] - 2026-08-18

Revue critique de la version 1.1.0 : quatre défauts introduits ou laissés par la passe
précédente, tests E2E Playwright, et couche de persistance prête pour un backend.

### 🔴 Corrections (Fixed)
- **`crypto.randomUUID()` hors contexte sécurisé** : l'application ne démarrait pas quand
  elle était ouverte depuis l'IP du réseau local (`http://192.168.x.x:8080`, cas du test sur
  téléphone). Remplacé par `createId()` avec repli sur `crypto.getRandomValues`.
- **Alt+Maj+F lançait le formateur interne de Monaco**, pas Prettier : Monaco possède la même
  combinaison et arrête l'événement avant la fenêtre. L'action est désormais enregistrée
  *dans* Monaco et appelle bien Prettier (détecté par les tests E2E).
- **Les raccourcis d'édition se déclenchaient depuis les champs de l'interface** : `allowInInput`
  avait été appliqué trop largement, si bien que `Ctrl+F` dans le champ de recherche globale
  rouvrait le widget de Monaco — précisément le bug censé être corrigé.
- **Fenêtre de perte de données de 600 ms** : fermer l'onglet juste après une frappe perdait la
  dernière modification. Purge immédiate sur `visibilitychange` et `pagehide`.
- **Avertissement d'accessibilité Radix** (`DialogContent` sans description) sur la palette de
  commandes et la navigation rapide.

### ⚡ Stockage (Changed)
- **Écriture incrémentale** : seuls les contenus réellement modifiés sont écrits en IndexedDB.
  Auparavant, chaque sauvegarde réécrivait l'intégralité du projet (plusieurs Mo par frappe sur
  un gros projet).
- **Suppression des orphelins** : le contenu des fichiers retirés est effacé d'IndexedDB.
- **Détection d'intégrité** : si le contenu référencé est introuvable (base effacée, éviction du
  navigateur), l'utilisateur est prévenu au lieu de découvrir des fichiers vides.
- **Conflit multi-onglets** : une écriture venue d'un autre onglet déclenche un avertissement avec
  action « Recharger », au lieu d'être écrasée silencieusement.
- **Occupation affichée** dans la barre d'état (poids du projet, quota de l'origine).
- L'auto-enregistrement disque ne reconstruit plus son intervalle à chaque frappe.

### 🧩 Architecture (Added)
- **`src/services/workspace/`** : contrat `WorkspaceStore` (port) + implémentation locale.
  L'application reste 100 % front-end ; brancher un backend consistera à fournir une autre
  implémentation et à la renvoyer depuis `index.ts`, sans toucher aux composants.

### 🧪 Tests (Added)
- **32 tests E2E Playwright** (Chromium bureau + profil Pixel 7) exécutés sur le **build de
  production** : non-régression des bugs critiques, parcours fonctionnels, affichage mobile,
  absence de requête tierce, absence d'erreur console.
- **12 tests unitaires** supplémentaires sur la couche de stockage (`fake-indexeddb`), dont
  l'écriture incrémentale, le quota, la migration et le conflit multi-onglets.
- E2E intégrés à la CI, avec rapport archivé en cas d'échec.

### 📱 Interface (Fixed)
- L'aperçu Markdown/HTML est utilisable sur petit écran (il remplaçait l'éditeur au lieu d'être
  simplement masqué sous 768 px).

## [1.1.0] - 2026-08-18

Version d'audit et de correction : cinq bugs critiques (dont deux pertes de données),
sécurisation de l'aperçu, auto-hébergement de Monaco et des polices, refonte du stockage.

### 🔴 Corrections critiques (Fixed)
- **Fermer un onglet ne supprime plus le fichier.** `performTabClose` retirait le fichier de
  l'espace de travail *et* du stockage : perte de données définitive, sans confirmation pour un
  fichier non modifié. Les onglets et les fichiers sont désormais deux notions distinctes
  (`useTabs` / `useWorkspace`), avec historique de réouverture (`Ctrl+Maj+T`).
- **Plus d'écran blanc au dépassement de quota.** `saveToLocalStorage` lançait un
  `QuotaExceededError` non capturé dans un `useEffect` : React démontait toute l'application.
  Le contenu des fichiers vit maintenant dans **IndexedDB**, l'écriture est protégée, l'erreur
  devient une notification, et un `ErrorBoundary` racine propose export/réinitialisation.
- **L'auto-enregistrement n'ouvre plus de sélecteur de fichier en boucle.** Il ne réécrit que les
  fichiers déjà liés à un fichier du disque ; la sauvegarde locale est permanente et automatique.
- **Les réglages numériques ne peuvent plus produire `NaN`.** `parseInt('')` enregistrait
  `fontSize: null` et cassait l'éditeur au rechargement : champs remplacés par des curseurs bornés
  et validation systématique (`sanitizeSettings`).
- **Fini les noms de fichiers en doublon.** `nouveau-fichier-${files.length + 1}` recréait un nom
  existant après une suppression ; unicité garantie à la création, au renommage, à la duplication,
  au déplacement et à l'export ZIP.

### 🟠 Corrections fonctionnelles (Fixed)
- L'éditeur n'est plus bridé à 50 % de largeur pour les fichiers Markdown quand l'aperçu est masqué.
- Aperçu Markdown enfin stylé : le plugin `@tailwindcss/typography` n'était pas enregistré.
- La recherche globale fonctionne en mode divisé (elle pilotait un éditeur démonté).
- Le bouton « Ouvrir » n'est plus désactivé sur Firefox/Safari, où le repli `<input type="file">` fonctionne.
- Formatage YAML réparé (plugin Prettier manquant) ; les erreurs de syntaxe sont désormais expliquées.
- Les raccourcis clavier ne se déclenchent plus pendant la saisie dans un champ de l'interface, et
  `Échap` n'est plus intercepté lorsqu'il n'a rien à faire.
- Session restaurée intégralement (onglets + onglet actif) ; un espace vidé volontairement le reste.
- Renommer un fichier ne le marque plus comme « non enregistré ».
- Lecture défensive de `localStorage` : un JSON corrompu n'empêche plus le démarrage.
- Import ZIP : arborescence reconstruite sans dépendre des entrées de dossier, binaires ignorés au
  lieu d'être corrompus, progression affichée, import annulable.

### 🔒 Sécurité (Security)
- **XSS corrigée dans l'aperçu Markdown** : le HTML est désinfecté par DOMPurify (les liens externes
  reçoivent `rel="noopener noreferrer nofollow"`), l'aperçu HTML s'exécute dans une iframe `sandbox`
  sans `allow-same-origin`.
- **Monaco n'est plus téléchargé depuis cdn.jsdelivr.net** : il est embarqué dans le bundle.
  L'application est réellement utilisable hors ligne et n'émet plus aucune requête vers un tiers.
- **JetBrains Mono auto-hébergée** (OFL) : plus d'appel à fonts.googleapis.com.
- 0 vulnérabilité `npm audit` (mise à jour `react-router-dom` 7.18, `sharp` 0.35).

### ✨ Nouveautés (Added)
- `Ctrl+P` — aller à un fichier ; `Ctrl+B` — replier l'explorateur ; `Ctrl+Maj+T` — rouvrir un onglet.
- Filtre rapide dans l'explorateur.
- Aperçu **HTML** en direct, en plus du Markdown.
- Thème clair complet pour toute l'interface (et non plus seulement la zone de code) + thème système.
- Barre d'état enrichie : état de sauvegarde horodaté, lignes/mots/caractères, sélection, version réelle.
- Onglets : réorganisation par glisser-déposer, clic milieu pour fermer, menu contextuel
  (« Fermer les autres », « Tout fermer »).
- Suppression annulable (corbeille d'une action) pour les fichiers et les dossiers.
- Les raccourcis PWA (`?action=new-file`, `?action=import`, `?mode=zen`) sont enfin interprétés.

### ♿ Accessibilité (Changed)
- Tous les boutons ont un nom accessible (5 sur 12 en étaient dépourvus).
- Le champ de renommage n'est plus imbriqué dans un `<button>` (HTML invalide).
- Surlignage de recherche lisible (contraste 1,4:1 → > 7:1), focus clavier visible partout,
  actions de la barre d'onglets accessibles au tactile, `prefers-reduced-motion` respecté.

### ⚡ Performance (Changed)
- Chunk principal : **2,32 Mo → 160 Ko**. Prettier, JSZip, Markdown, Monaco et les dialogues sont
  chargés à la demande.
- Recherche globale : une seule expression régulière compilée par recherche (au lieu d'une par ligne
  et par fichier) + anti-rebond de 200 ms.
- Persistance différée (600 ms) au lieu d'une sérialisation complète à chaque frappe.
- 31 composants d'interface inutilisés et 27 dépendances supprimés (`recharts`, `react-hook-form`,
  `zod`, `@tanstack/react-query`, `uuid`…). Restaurables via `npx shadcn@latest add <nom>`.

### 🧪 Qualité (Added)
- **42 tests unitaires** Vitest sur les utilitaires (noms, réglages, ZIP, JSON, Markdown, formatage).
- **TypeScript `strict: true`** activé — 0 erreur.
- **ESLint : 0 erreur** (5 auparavant).
- **CI GitHub Actions** : lint, types, tests, build, audit.
- `EditorLayout.tsx` (1 494 lignes) découpé en hooks : `useWorkspace`, `useTabs`, `useSettings`,
  `useSplitLayout`.

## [1.0.2] - 2026-05-28

### 📱 PWA complète (Added)
- **`vite-plugin-pwa@1.3.0`** installé — génère `sw.js` (Workbox `generateSW`) et `manifest.webmanifest` automatiquement au build
- **Service worker Workbox** : précache de 33 entrées (7,5 MB), y compris tous les chunks Monaco
  - `maximumFileSizeToCacheInBytes: 3 MB` (Monaco dépasse la limite Workbox par défaut de 2 MB)
  - `navigateFallback: null` (le Nginx existant gère le SPA routing via `try_files`)
  - Cache réseau `CacheFirst` pour les polices Google (stylesheet 1 an, webfonts 1 an)
- **Manifest enrichi** :
  - `display_override: ["window-controls-overlay", "standalone", "browser"]` — support Window Controls Overlay (desktop PWA)
  - 3 raccourcis PWA (`Nouveau fichier`, `Importer un fichier`, `Mode Zen`)
  - Screenshot wide `og-image.png` (1200×630) pour la fiche d'installation
  - `theme_color: #3b82f6`, `background_color: #0f1419`, `lang: fr`
- **`public/manifest.webmanifest` supprimé** — le plugin devient propriétaire du manifeste (conflits évités)
- **`index.html`** : suppression du `<link rel="manifest">` manuel (le plugin l'injecte) ; ajout d'un commentaire explicatif

### 🎨 Branding & Icônes (Added)
- **`public/icon.svg`** — logo mark H Editor "E" carré scalable (source vectorielle des icônes)
- **`public/icon-192.png`** (192×192) et **`public/icon-512.png`** (512×512) — icônes PWA générées depuis `icon.svg` via `sharp`
- **`public/favicon.ico`** — favicon 32×32 PNG-in-ICO (remplace le placeholder Vite générique)
- **`index.html`** : ajout de `<link rel="icon" type="image/svg+xml" href="icon.svg">` (priorité navigateurs modernes) + `apple-touch-icon` mis à jour vers `icon-192.png`
- **`scripts/build-icons.mjs`** — script de génération des icônes (`npm run icons:build`)
- **`package.json`** : script `icons:build` ajouté

### ⚙️ Configuration (Added)
- **`.env`** — fichier de variables d'environnement de base (clefs API providers : Cloudflare Workers AI, Pollinations, HuggingFace, Cerebras, Vast.ai, Nvidia NIM, OpenRouter)
- **`.gitignore`** : exclusions explicites de `.env.local` et `.env.*.local` (secrets)

### 🧰 Dépendances (Dependencies)
- ➕ `vite-plugin-pwa@^1.3.0` (devDep)

---

## [1.0.1] - 2026-05-27

### 🔐 Sécurité (Security)
- **0 vulnérabilité** dans `npm audit` (4 modérées résolues) :
  - Mise à jour de **Vite 5 → 8** (corrige `GHSA-4w7w-66w2-5vf9` path traversal + `GHSA-67mh-4wv8-2f99` esbuild dev server)
  - Mise à jour de `@vitejs/plugin-react-swc` 3 → 4
  - Ajout d'un `overrides.dompurify` ≥ 3.4.7 dans `package.json` (corrige 5 CVEs DOMPurify utilisées transitivement par monaco-editor)

### ⚙️ Build (Changed)
- `vite.config.ts` : ajout d'un **`manualChunks`** séparant `monaco`, `react-vendor`, `radix-vendor`, `charts` du bundle principal
- `chunkSizeWarningLimit` relevé à 1500 KB (taille raisonnable pour un IDE web)
- Build production en **~1.8 s** (Rolldown via Vite 8)

### 🧹 Nettoyage (Changed)
- **Suppression complète des références à la plateforme Lovable** :
  - Retrait du plugin Vite `lovable-tagger` (dépendance + import + utilisation dans `vite.config.ts`)
  - Remplacement des meta tags OG/Twitter pointant vers `lovable.dev/...` par l'image locale `og-image.png`
  - Remplacement de `@lovable_dev` (twitter:site) par `@hylst`
  - Mise à jour des URLs canoniques et `og:url` de `editorx.app` vers `https://hylst.fr/app/`
- **Renommage cohérent** "CodeFlow Editor" → **H Editor** dans toute la documentation (README, about, structure)
- **`package.json`** : nom, description, auteur, licence, homepage renseignés (était `vite_react_shadcn_ts` / `0.0.0`)

### 🐛 Corrections (Fixed)
- **`src/pages/NotFound.tsx`** : le lien `<a href="/">` cassait le routing sous-chemin `/app`. Remplacé par `<Link to="/">` (React Router, respecte le `basename`)
- **`NotFound.tsx`** : abandon des couleurs Tailwind brutes (`bg-gray-100`, `text-gray-600`) au profit des tokens du design system (`bg-background`, `text-muted-foreground`, `text-primary`)
- **`NotFound.tsx`** : ajout d'icônes Lucide, mise à jour du `document.title`, message en français

### 🎨 SEO & Branding (Added)
- **`public/og-image.png`** (1200 × 630, 31 KB) — image Open Graph branded H Editor/hylst, générée depuis `og-image.svg`
- **`public/og-image.svg`** — source vectorielle de l'OG image (éditable)
- **`scripts/build-og-image.mjs`** — script de régénération PNG (`npm run og:build`)
- **`public/manifest.webmanifest`** — manifeste PWA basique (`scope: /app/`, `theme_color`, icons)
- **`public/sitemap.xml`** — sitemap minimal référencé dans `robots.txt`
- **`public/robots.txt`** — ajout du `Sitemap:`, opt-out des crawlers IA (GPTBot, CCBot, Google-Extended, ClaudeBot, ClaudeBot)
- **`index.html`** :
  - `meta theme-color`, `color-scheme`, `format-detection`
  - `link rel="manifest"`, `apple-touch-icon`
  - OG : URL absolues, `og:image:width/height/alt`, `og:locale:alternate`
  - Twitter : `twitter:creator`, `twitter:image:alt`
  - Schema.org JSON-LD enrichi : `image`, `softwareVersion`, `inLanguage`, `isAccessibleForFree`, `browserRequirements`, `publisher`, `license`

### 🚢 Déploiement (Added)
- **Configuration de déploiement sous-chemin** :
  - `vite.config.ts` : `base: '/app/'`
  - `src/App.tsx` : `<BrowserRouter basename="/app">`
  - Permet le déploiement sous `https://hylst.fr/app/` derrière Nginx
- **Nouveaux fichiers de documentation** :
  - [`features.md`](./features.md) — inventaire complet des fonctionnalités avec statut
  - [`test_build_deploy.md`](./test_build_deploy.md) — guide pas-à-pas test local Windows + build + déploiement Coolify/Nginx
- **Fichier `LICENSE`** (MIT, Geoffroy Streit) à la racine

### 📝 Documentation (Docs)
- Refonte du [README.md](./README.md) (cohérence du nom, liens vers la nouvelle doc, attribution auteur)
- Mise à jour de [about.md](./about.md) (auteur, vision, historique)
- Enrichissement de [structure.md](./structure.md) (arborescence à jour, flux de données détaillé)

### 🧰 Dépendances (Dependencies)
- ⬆️ `vite` 5.4 → 8.0
- ⬆️ `@vitejs/plugin-react-swc` 3.11 → 4.3
- ➕ `sharp` (devDep, génération OG image)
- ➖ `lovable-tagger` (retiré)

---

## [1.0.0] - 2024-01-15

### ✨ Ajouté

#### Éditeur
- Intégration de Monaco Editor avec coloration syntaxique
- Support de 40+ langages de programmation
- Auto-complétion intelligente
- Formatage automatique avec Prettier
- Numérotation des lignes
- Minimap pour navigation rapide
- Marqueurs d'erreurs et avertissements

#### Interface
- Design sombre moderne avec tokens de design cohérents
- Système d'onglets avec indicateur de modification
- Arborescence de fichiers avec icônes par type
- Barre de statut avec informations contextuelles
- Panneau de prévisualisation Markdown/HTML
- Animations et transitions fluides

#### Recherche
- Recherche locale dans le fichier (`Ctrl+F`)
- Recherche et remplacement (`Ctrl+H`)
- Recherche globale dans tous les fichiers (`Ctrl+Shift+F`)
- Support des expressions régulières
- Options case-sensitive et mot entier

#### Gestion de fichiers
- Création de fichiers et dossiers
- Renommage et suppression
- Import de fichiers locaux
- Export de projets en ZIP
- Persistance automatique en localStorage / IndexedDB

#### Layouts
- Vue simple (un éditeur)
- Vue horizontale (deux éditeurs côte à côte)
- Vue verticale (deux éditeurs empilés)
- Mode Zen plein écran sans distractions

#### Productivité
- Palette de commandes (`Ctrl+Shift+P`)
- Recherche rapide de fichiers (`Ctrl+P`)
- 30+ raccourcis clavier compatibles VSCode
- Dialogue d'aide et astuces
- Paramètres personnalisables

#### SEO & Accessibilité
- Meta tags optimisés
- Open Graph et Twitter Cards
- Schema.org JSON-LD
- Navigation au clavier complète

### 🔧 Technique
- Architecture React 18 avec hooks
- TypeScript strict
- Tailwind CSS avec design tokens
- Vite + SWC pour le build
- ESLint pour la qualité du code

---

## [0.9.0] - 2024-01-10 (Beta)

### Ajouté
- Version beta de l'éditeur
- Fonctionnalités de base
- Tests utilisateurs

### Corrigé
- Bugs de synchronisation des onglets
- Problèmes de performance avec gros fichiers

---

## [0.8.0] - 2024-01-05 (Alpha)

### Ajouté
- Prototype initial
- Intégration Monaco Editor
- Interface de base

---

## 🚧 En cours

- Premier déploiement sur `https://hylst.fr/app/` (VPS Hostinger + Coolify + Nginx statique)

---

## 📋 Roadmap

Voir [todo.md](./todo.md) pour la liste complète. Priorités :

### v1.1.0 (court terme)
- [ ] Image OG officielle + favicon harmonisé
- [ ] Tests unitaires Vitest (`utils/` en priorité : `fileSystem`, `zipHandler`, `formatter`)
- [ ] Workflow GitHub Actions (`lint` + `build` sur PR)
- [ ] `CONTRIBUTING.md`
- [ ] Découpage de `EditorLayout.tsx` (1494 LOC) en sous-hooks (`useFileSystem`, `useTabsState`, `useEditorSettings`)
- [ ] Thèmes clair & haut contraste
- [ ] Système de snippets par langage

### v1.2.0 (moyen terme)
- [x] ~~Conversion en **PWA** (service worker, manifest)~~ — fait en 1.0.2 (`vite-plugin-pwa`, Workbox, manifest enrichi)
- [x] Page de fallback **offline** (`public/offline.html`) — `navigateFallback` configuré dans `vite.config.ts`
- [x] Prompt d'installation PWA (événement `beforeinstallprompt`) dans la barre de statut — `useInstallPrompt` hook + bouton « Installer »
- [ ] Intégration **Sentry** opt-in pour monitoring prod
- [x] ~~Internationalisation (i18n) FR/EN~~ — abandonné (décision produit, 2026-08)
- [ ] Drag & drop pour réorganiser les onglets
- [ ] Templates de projets (HTML5, React component, etc.)

### v2.0.0 (long terme)
- [ ] **Mode collaboration temps réel** (Yjs / CRDT)
- [ ] Support **Git** intégré (diff view, historique)
- [ ] Terminal fonctionnel
- [ ] Architecture de plugins / extensions
- [ ] Synchronisation cloud opt-in (Dropbox, Google Drive)
