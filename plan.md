# H Editor — Audit, corrections et plan

> **Audit** réalisé le 18/08/2026 sur la v1.0.1 : lecture intégrale du code, `tsc`, `eslint`,
> et campagne E2E réelle dans Chrome (parcours utilisateur, console, arbre d'accessibilité,
> `localStorage`, réseau).
> **Corrections** appliquées le même jour et livrées en **v1.1.0** (voir `changelog.md`).
>
> Statuts : ✅ corrigé et vérifié · 🟡 partiellement traité · ⬜️ non traité (reporté)

---

## 0. Vérification de l'audit (faux positifs)

Avant correction, chaque constat a été re-testé. Deux affirmations de la première version de ce
document étaient **fausses** et ont été retirées :

| Constat initial | Vérification | Verdict |
|---|---|---|
| « L'import ZIP aplatit l'arborescence quand l'archive n'a pas d'entrées de dossier » | Reproduction avec JSZip : les entrées de dossier manquantes sont **synthétisées** et parcourues avant les fichiers ; l'arborescence était correcte | ❌ **faux positif** (le reste du constat — corruption des binaires — était exact) |
| « `next-themes` est une dépendance morte » | `src/components/ui/sonner.tsx` l'importait réellement (`useTheme`) et ce composant est monté | ❌ **faux positif** (dépendance depuis remplacée par une lecture directe de la classe `dark`) |

Constats confirmés par mesure : contraste du surlignage **1,41:1** (calcul WCAG), plugin Prettier
YAML absent (échec reproduit), binaire ZIP corrompu (12 octets → 18), Monaco chargé depuis
jsDelivr (10 requêtes), 5 boutons sans nom accessible sur 12, crash `QuotaExceededError`.

---

## 1. 🔴 Critiques — perte de données et crash

### 1.1 ✅ Fermer un onglet supprimait définitivement le fichier

`EditorLayout.tsx:286` — `performTabClose` appelait `setFiles(prev => prev.filter(...))`.
Reproduit : un clic sur la croix effaçait le fichier de l'explorateur **et** du stockage, sans
confirmation pour un fichier non modifié.

**Correction** — onglets et fichiers sont désormais deux notions distinctes : `useTabs` ne touche
qu'à `tabs`, `useWorkspace` détient les fichiers. Ajout d'un historique de fermeture
(`Ctrl+Maj+T`), de la fermeture par clic milieu et d'un menu contextuel.
**Vérifié E2E** : après fermeture, le fichier reste dans l'explorateur et dans IndexedDB.

### 1.2 ✅ Écran blanc au dépassement de quota

`fileStorage.ts:13` (aucun `try/catch`) + effet de persistance + absence d'`ErrorBoundary`.
Reproduit : dépôt d'un fichier de 6 Mo → `QuotaExceededError` → `#root` vidé.

**Correction, trois niveaux** :
1. le **contenu** des fichiers vit dans **IndexedDB** (`utils/storage/`), seules les métadonnées
   (~1 Ko) restent en `localStorage` ;
2. `saveWorkspace` ne lève plus jamais : il renvoie un résultat, l'échec devient une notification
   et un indicateur dans la barre d'état ;
3. `ErrorBoundary` racine avec « Recharger / Récupérer mes fichiers / Réinitialiser ».

**Vérifié E2E** : le même fichier de 6,2 Mo s'importe, l'application reste vivante, et le contenu
est retrouvé intact après rechargement.

### 1.3 ✅ L'auto-enregistrement ouvrait un sélecteur de fichier en boucle

Aucun fichier créé dans l'application n'a de `fileHandle` : `saveFile()` appelait
`showSaveFilePicker()` toutes les 5 s. Sur Firefox/Safari, l'auto-save ne faisait rien, en silence.

**Correction** — la sauvegarde locale est permanente et automatique (différée de 600 ms) ; l'option
« réenregistrer sur le disque » ne concerne que les fichiers déjà liés à un fichier du disque et
n'ouvre plus aucune boîte de dialogue. L'état est affiché (« Enregistré à 21:34 »).

### 1.4 ✅ Champs numériques → `NaN` → éditeur cassé

`parseInt('')` produisait `fontSize: null`, persisté et rechargé.

**Correction** — curseurs bornés dans les réglages, et `sanitizeSettings()` valide/borne/complète
toute valeur lue (JSON corrompu, version antérieure, type inattendu). **6 tests unitaires**.

### 1.5 ✅ Noms de fichiers en doublon

`nouveau-fichier-${files.length + 1}` recréait un nom existant après une suppression.

**Correction** — `utils/fileNames.ts` : unicité par dossier (`notes (2).md`), validation des
caractères interdits, appliquée à la création, au renommage, à la duplication, au déplacement,
à l'import et à l'export ZIP. **11 tests unitaires**. **Vérifié E2E**.

---

## 2. 🟠 Fonctionnalités cassées ou trompeuses

| # | Constat | Statut |
|---|---|---|
| 2.1 | Éditeur bridé à 50 % de largeur pour tout fichier Markdown, aperçu masqué ou non (premier écran de l'application) | ✅ largeur conditionnée à l'aperçu réellement affiché, état remonté dans les réglages |
| 2.2 | Aperçu Markdown non stylé : `@tailwindcss/typography` installé mais non enregistré | ✅ plugin activé (+ retrait des backticks parasites autour du code inline) |
| 2.3 | Recherche globale inopérante en mode divisé (pilotait un éditeur démonté) | ✅ navigation vers l'éditeur du panneau actif, avec réessai si l'éditeur n'est pas encore monté |
| 2.4 | Bouton « Ouvrir » désactivé sur Firefox/Safari alors que le repli fonctionne | ✅ bouton toujours actif ; l'API native est utilisée quand elle existe (permet un vrai `Ctrl+S` ensuite) |
| 2.5 | Formatage YAML annoncé mais toujours en échec (plugin Prettier absent) | ✅ plugin importé ; messages d'erreur de syntaxe explicites |
| 2.6 | Raccourcis globaux déclenchés pendant la saisie ; `Échap` intercepté systématiquement | ✅ champs de l'interface exclus, `preventDefault` seulement si le raccourci agit |
| 2.7 | Onglets non restaurés ; `bienvenue.md` ressuscité après vidage complet | ✅ session complète persistée, drapeau `editorx-initialized` |
| 2.8 | Mutation directe de l'état React (`newTabs[0].active = true`) | ✅ état immuable ; l'onglet voisin devient actif, comme dans un IDE |
| 2.9 | `JSON.parse` non protégés au démarrage | ✅ lectures défensives (`loadSettings`, `readPersisted`, `loadWorkspace`) |
| 2.10 | État de division pointant vers des fichiers supprimés | ✅ nettoyage à l'initialisation |
| 2.11 | Import ZIP : binaires corrompus, aucune limite, remplacement sans confirmation | ✅ binaires ignorés et signalés, limite 50 Mo, progression, import annulable · ❌ l'aplatissement d'arborescence était un faux positif |
| 2.12 | Le renommage marquait le fichier « non sauvegardé » | ✅ le renommage ne touche plus au drapeau `modified` |

---

## 3. 🔒 Sécurité

| # | Constat | Statut |
|---|---|---|
| 3.1 | XSS : `markdown-it` en `html: true` + `dangerouslySetInnerHTML` sans désinfection, avec du contenu tiers entrant par ZIP/JSON | ✅ DOMPurify (profil HTML restreint, `iframe`/`form`/`style` interdits, liens externes en `noopener noreferrer nofollow`) · **9 tests** couvrant script, `onerror`, `javascript:`, iframe |
| 3.2 | Monaco chargé depuis `cdn.jsdelivr.net` : PWA « offline » inopérante, dépendance tierce, promesse « 100 % local » inexacte | ✅ Monaco et ses web workers embarqués ; **0 requête externe** mesurée |
| 3.2b | Police JetBrains Mono chargée depuis Google Fonts (même problème, non listé initialement) | ✅ auto-hébergée (OFL), 8 fichiers woff2 dans `src/assets/fonts` |
| 3.3 | `.env.local` : clés d'API `VITE_*` réelles, aucune utilisée dans `src/` | 🟡 **non supprimées** — ce sont vos clés, la décision vous revient ; aucune n'est lue par le code, elles n'apparaissent donc pas dans le bundle |
| — | 11 vulnérabilités npm (dont 8 hautes) apparues avec l'outillage de test | ✅ `react-router-dom` 7.18, `sharp` 0.35 → **0 vulnérabilité** |

---

## 4. ♿ Accessibilité et responsive

| # | Constat | Statut |
|---|---|---|
| 4.1 | 5 boutons sur 12 sans nom accessible ; toute la barre d'outils muette sous `sm` | ✅ **0 sur 30** (mesuré E2E) : `aria-label`, `aria-pressed`, `role="tree"`/`tab`/`tablist` |
| 4.2 | `<Input>` imbriqué dans un `<button>` pendant le renommage (HTML invalide) | ✅ champ sorti du bouton |
| 4.3 | Surlignage de recherche : contraste 1,41:1 | ✅ > 7:1 dans les deux thèmes |
| 4.4 | Actions révélées au survol uniquement (inaccessibles au tactile/clavier) | ✅ visibles en permanence sur les onglets, `focus-visible` sur les menus |
| 4.5 | Explorateur et panneau de recherche à largeur fixe, non repliables | ✅ explorateur repliable (`Ctrl+B`) + bouton dédié ; panneau de recherche fermable · 🟡 largeurs encore fixes (redimensionnement : reporté) |
| 4.6 | Thème « Clair » n'affectait que la zone de code | ✅ palette claire complète + thème « Système » |
| 4.7 | Aucun repère sémantique | ✅ `header`/`main`/`aside`/`footer`/`nav` + `:focus-visible` global + `prefers-reduced-motion` |
| 4.8 | `navigator.platform` déprécié | ✅ `userAgentData` avec repli |

---

## 5. ⚡ Performance

| Mesure | Avant | Après |
|---|---|---|
| Chunk d'entrée | 2 321 Ko | **160 Ko** |
| Monaco | CDN tiers (20 Ko locaux) | 4 202 Ko embarqués, chunk séparé, chargé en `lazy` |
| Prettier | dans le chunk d'entrée | chunk séparé, `import()` à la première utilisation |
| Précache PWA | 7,5 Mo sans Monaco (donc inutilisable hors ligne) | 10 Mo avec Monaco + polices ; workers de langage et Prettier mis en cache à l'usage |
| Recherche globale | une `RegExp` compilée **par ligne et par fichier**, à chaque frappe | une par recherche + anti-rebond 200 ms + plafond de résultats |
| Persistance | sérialisation complète du projet à **chaque frappe** | différée (600 ms), contenu en IndexedDB |
| Dépendances | 27 inutilisées (recharts, react-hook-form, zod, react-query, uuid…) | supprimées, ainsi que 31 composants d'interface inutilisés |

---

## 6. 📚 Cohérence code / documentation

| # | Écart | Statut |
|---|---|---|
| 6.1 | « Persistance IndexedDB » annoncée partout, jamais implémentée | ✅ réellement implémentée |
| 6.2 | « Monaco ~2 Mo code-split par Vite » (en réalité : CDN) | ✅ corrigé dans le code et dans `CLAUDE.md` |
| 6.3 | « PWA offline » (le précache excluait Monaco) | ✅ vrai hors ligne, stratégie de cache documentée |
| 6.4 | Barre d'état « v1.0 » figée | ✅ version injectée depuis `package.json` (`__APP_VERSION__`) |
| 6.5 | Raccourcis PWA `?action=…` jamais interprétés | ✅ traités au démarrage, URL nettoyée ensuite |
| 6.6 | `theme-color` incohérent entre `index.html` et le manifeste | ✅ constante unique |
| 6.7 | `openFile()` / `openDirectory()` morts, liste d'extensions divergente | ✅ `openFileWithPicker()` réellement utilisé, listes unifiées |
| 6.8 | « Interface responsive » | 🟡 explorateur repliable, aperçu plein écran sous `md` ; une vraie mise en page mobile reste à faire |

---

## 7. 🧪 Qualité, tests, architecture

| Élément | Avant | Après |
|---|---|---|
| Tests | aucun | **42 tests Vitest** (jsdom), un par bug critique corrigé |
| ESLint | 4 erreurs, 9 avertissements | **0 erreur**, 3 avertissements (convention shadcn) |
| TypeScript | `strict: false`, `strictNullChecks: false` | **`strict: true`**, 0 erreur |
| CI | aucune | `.github/workflows/ci.yml` — lint, types, tests, build, audit |
| `EditorLayout.tsx` | 1 494 lignes, toute la logique | ~900 lignes de composition ; logique dans 4 hooks |
| Composants d'interface | 49 fichiers, 17 utilisés | 17 fichiers |

---

## 8. Ce qui reste (proposition de suite)

**Court terme**
- ⬜️ Panneaux redimensionnables (explorateur, recherche) via `ResizablePanelGroup`.
- ⬜️ Mise en page mobile dédiée (explorateur en tiroir, barre d'outils condensée).
- ⬜️ Tests E2E automatisés (Playwright) rejouant les 10 scénarios de l'annexe.
- ⬜️ Corbeille multi-niveaux (aujourd'hui : annulation de la dernière suppression seulement).

**Moyen terme**
- ⬜️ Édition d'un dossier réel du disque via `showDirectoryPicker()` (la fonction existe, non branchée).
- ⬜️ Snippets et modèles de fichiers par langage.
- ⬜️ Diff local (avant/après enregistrement).
- [x] Invite d'installation PWA (`beforeinstallprompt`) et page hors ligne dédiée.

**À décider**
- 🟡 Sort des variables `VITE_*` inutilisées de `.env` / `.env.local` (clés d'API réelles, non lues par le code).
- 🟡 Poids du précache (10 Mo) : acceptable pour un IDE hors ligne, réductible en abandonnant
  l'IntelliSense TypeScript (worker de 6,6 Mo).

---

## Annexe — Scénarios E2E rejoués après correction

| # | Scénario | Avant | Après (vérifié dans Chrome) |
|---|---|---|---|
| 1.1 | Fermer l'onglet du fichier d'accueil | Fichier effacé du projet et du stockage | Onglet fermé, fichier conservé ; `Ctrl+Maj+T` le rouvre |
| 1.2 | Déposer un fichier de 6,2 Mo | `QuotaExceededError` → écran blanc | Import réussi, contenu en IndexedDB, intact après rechargement |
| 1.4 | Vider le champ « taille de police » | `fontSize: null` persisté, éditeur cassé | Curseur borné : valeur impossible |
| 1.5 | 3 créations, 1 suppression, 1 création | Deux `nouveau-fichier-3.txt` identiques | Le nom libre est réutilisé, aucun doublon |
| 2.1 | Premier écran | Éditeur sur 50 %, moitié droite vide | Éditeur pleine largeur, aperçu sur demande |
| 2.2 | Aperçu de `bienvenue.md` | Titres et listes sans mise en forme | Typographie complète (titres, listes, tableaux, code) |
| 2.3 | Division + recherche globale + clic sur résultat | Curseur inchangé (`Ln 1`) | Curseur positionné (`Ln 21`) dans le panneau actif |
| 2.6 | `Ctrl+F` depuis le champ de recherche globale | Ouvrait le widget de Monaco | Le champ garde le focus |
| 3.2 | Ressources réseau | 10 requêtes vers `cdn.jsdelivr.net` | **0 requête externe** |
| 4.1 | Audit des boutons | 5 sans nom accessible sur 12 | **0 sur 30** |


---

# Deuxième passe — revue critique de la v1.1.0 (livrée en v1.2.0)

La première passe a été relue avec la même exigence que le code d'origine. Quatre défauts
**introduits ou laissés** par cette passe ont été trouvés, dont deux par les tests E2E.

## A. Défauts trouvés dans mon propre travail

| # | Défaut | Comment il a été trouvé | Statut |
|---|---|---|---|
| A.1 | `crypto.randomUUID()` n'existe **pas hors contexte sécurisé** : l'application ne démarrait pas via l'IP du réseau local (`http://192.168.x.x:8080`), cas d'un test depuis un téléphone. Le paquet `uuid` supprimé, lui, fonctionnait partout | relecture ciblée des API récentes utilisées | ✅ `createId()` avec repli `crypto.getRandomValues` |
| A.2 | **Alt+Maj+F lançait le formateur interne de Monaco**, pas Prettier : Monaco lie la même combinaison et arrête l'événement avant la fenêtre. Résultat observé : `const x = { a: 1, b: 2 }` (Monaco) au lieu de `const x = { a: 1, b: 2 };` (Prettier) | test E2E de formatage | ✅ action enregistrée dans Monaco, priorité sur son propre raccourci |
| A.3 | **`allowInInput` appliqué trop largement** : `Ctrl+F` depuis le champ de recherche globale rouvrait le widget de Monaco — le bug même que la v1.1.0 prétendait corriger | test E2E « raccourcis pendant la saisie » | ✅ réservé aux raccourcis réellement globaux |
| A.4 | **Réécriture intégrale d'IndexedDB à chaque sauvegarde** : sur un projet de plusieurs Mo, chaque pause de frappe réécrivait tout le contenu | relecture de la couche de persistance | ✅ écriture incrémentale + suppression des orphelins |
| A.5 | **Fenêtre de perte de 600 ms** : fermer l'onglet juste après une frappe perdait la dernière modification | analyse pessimiste du cycle de vie | ✅ purge sur `visibilitychange` / `pagehide` |
| A.6 | **Aucune détection de conflit multi-onglets** : deux onglets ouverts, le dernier à écrire écrasait l'autre sans un mot | analyse pessimiste | ✅ avertissement avec action « Recharger » |
| A.7 | **Contenu IndexedDB manquant rendu silencieusement comme fichier vide** (base évincée par le navigateur, effacée à la main) | reproduit accidentellement par un test E2E mal écrit | ✅ avertissement explicite au chargement |
| A.8 | Avertissement d'accessibilité Radix (`DialogContent` sans description) sur deux dialogues | console pendant l'exploration E2E | ✅ descriptions ajoutées |
| A.9 | Aperçu masqué sous 768 px : le bouton restait actif mais sans effet visible | test E2E mobile | ✅ l'aperçu remplace l'éditeur sur petit écran |
| A.10 | Code mort laissé (`App.css` jamais importé, `use-mobile`, exports inutilisés) | analyse du graphe d'imports | ✅ supprimé |

**Leçon principale** : trois de ces défauts n'étaient pas visibles à la lecture du code — seuls des
tests exécutant réellement l'application les ont révélés. C'est l'argument central en faveur de la
suite E2E ajoutée ici.

## B. Tests E2E (Playwright + Chromium)

| Fichier | Contenu | Profil |
|---|---|---|
| `e2e/regressions.spec.ts` | 11 scénarios épinglant chaque bug critique corrigé (fermeture d'onglet, quota, unicité des noms, persistance, purge à la fermeture, renommage, annulation, requêtes tierces, console propre, réglages corrompus) | bureau |
| `e2e/features.spec.ts` | 17 parcours fonctionnels (aperçu, recherche/remplacement, `Ctrl+P`, `Ctrl+B`, filtre, formatage, thème clair, mode Zen, onglets, palette, export ZIP, accessibilité des boutons) | bureau |
| `e2e/responsive.spec.ts` | 4 vérifications d'affichage mobile | Pixel 7 |

Les tests s'exécutent sur le **build de production** servi par `vite preview` — c'est l'artefact
déployé qui est vérifié, pas le serveur de développement. Commandes : `npm run test:e2e`,
`npm run test:e2e:ui`, `npm run test:all`. Intégrés à la CI avec archivage du rapport en cas d'échec.

## C. « 100 % front-end, back-end ready »

La persistance passe désormais par un contrat explicite, `src/services/workspace/` :

```
types.ts       WorkspaceStore : load / save / clear / estimate / onExternalChange
localStore.ts  implémentation locale (localStorage + IndexedDB, incrémentale, tolérante au quota)
index.ts       getWorkspaceStore() — point de sélection de l'implémentation
```

Aucun composant ni hook d'interface ne connaît le stockage. Ajouter un serveur consistera à écrire
un `remoteStore.ts` respectant les mêmes garanties (ne jamais lever, écritures incrémentales,
notification des changements externes) et à le renvoyer depuis `index.ts` — le reste de
l'application est inchangé. Rien de tout cela n'introduit de dépendance réseau aujourd'hui.

## D. Usage optimal du stockage local

| Donnée | Emplacement | Pourquoi |
|---|---|---|
| Arborescence, onglets, noms, langages | `localStorage` (~1 Ko) | Lecture **synchrone** au démarrage : l'interface s'affiche sans attendre |
| Contenu des fichiers | IndexedDB, clé = id du fichier | Pas de plafond à 5 Mo, écriture **par fichier modifié** |
| Réglages | `localStorage`, validés par `sanitizeSettings` | Petits, et jamais lus tels quels |
| État de division | `localStorage`, nettoyé au chargement | Préférence d'affichage, perte acceptable |

Écriture différée de 600 ms, purgée immédiatement quand la page passe en arrière-plan.
Occupation affichée dans la barre d'état. Toute écriture impossible (quota, navigation privée)
devient une notification, jamais une exception.

---

# Prochaines erreurs à corriger (par ordre de priorité)

| # | Constat | Impact | Piste |
|---|---|---|---|
| ~~N.1~~ | ~~Aucune protection en cas de conflit multi-onglets~~ | — | ✅ **fait en 1.3.0** : numéro de révision, écriture refusée, arbitrage par l'utilisateur (« Recharger » / « Garder ma version ») |
| N.2 | **Les gros fichiers ralentissent la frappe** : chaque modification recrée le tableau `files` complet et déclenche les effets de `useTabs`/`useSplitLayout` | ressenti sur > 5 Mo | découpler le contenu de la liste (map séparée) ou passer à `useReducer` + sélecteurs |
| N.3 | **Recherche globale sur le thread principal** : au-delà de ~100 fichiers, la frappe saccade malgré l'anti-rebond | confort | Web Worker dédié |
| N.4 | **Explorateur non virtualisé** : au-delà de ~500 entrées, le rendu devient coûteux | confort | `@tanstack/react-virtual` sur l'arbre aplati |
| ~~N.5~~ | ~~Pas de compression~~ | — | ✅ **fait en 1.3.0** : gzip avant écriture IndexedDB, facteur ~5 mesuré, repli transparent |
| N.6 | **Aucune reprise après plantage de l'onglet** : le contenu non purgé (moins de 600 ms) est perdu si le processus meurt | rare | journal d'écriture (append-only) en IndexedDB |
| ~~N.7~~ | ~~Fichiers binaires ignorés à l'import ZIP~~ | — | ✅ **fait en 1.3.0** : base64, non éditables, restitués intacts à l'export (aller-retour testé) |
| N.8 | **`showDirectoryPicker()` toujours non branché** | édition d'un vrai dossier impossible | ouvrir un dossier disque, synchroniser handle par fichier |
| N.9 | **Précache de 10 Mo** dont 4 Mo de Monaco | premier chargement lourd sur réseau lent | précacher l'essentiel, différer les langages rares |
| N.10 | **Aucune détection de fichier modifié hors de l'application** (le fichier disque a changé depuis l'ouverture) | écrasement possible à l'enregistrement | comparer `lastModified` du handle avant écriture |

---

# Évolutions proposées

**Édition**
- Emmet pour HTML/CSS, multi-curseur avancé, comparaison avant/après enregistrement.
- Bibliothèque de snippets et modèles de fichiers par langage.
- Journal d'annulation par fichier survivant au rechargement.

**Projet**
- Ouverture d'un dossier réel du disque (File System Access), avec synchronisation bidirectionnelle.
- Corbeille multi-niveaux avec restauration sélective.
- Espaces de travail multiples (basculer entre plusieurs projets sans écraser).

**Partage et collaboration (le moment où le backend devient utile)**
- Export d'un lien de partage en lecture seule (projet encodé, toujours sans serveur).
- Puis, via `remoteStore.ts` : synchronisation multi-appareils, historique de versions,
  édition collaborative (Yjs/CRDT). L'interface n'a pas à changer.

**Exécution**
- Aperçu HTML/CSS/JS complet avec console intégrée (iframe isolée — déjà en place pour le HTML).
- Exécution JavaScript/TypeScript en bac à sable (Web Worker), puis WebContainer si un jour utile.

**Confort et accessibilité**
- Mise en page mobile dédiée (tiroirs).
- Raccourcis personnalisables, palette de commandes avec historique.
- Audit WCAG AA complet.

**Industrialisation**
- Déploiement automatisé depuis la CI (aujourd'hui manuel).
- Tests E2E sur Firefox et WebKit en plus de Chromium.
- Mesure de performance en CI (budget de taille de bundle, Lighthouse).


---

# Troisième passe — livrée en v1.3.0

Trois points du tableau ci-dessus ont été traités, en commençant par ceux qui touchent
l'intégrité des données et l'usage du stockage.

| Point | Mise en œuvre | Vérification |
|---|---|---|
| **N.5 — Compression** | `utils/storage/compression.ts` : gzip via `CompressionStream` avant écriture IndexedDB. Les entrées compressées sont des `Uint8Array`, celles en clair restent des `string` — un projet écrit par une version antérieure reste lisible sans migration. Repli transparent si l'API manque (cas de jsdom, de Safari ancien). | 9 tests sous environnement Node (jsdom ne fournit pas l'API) : facteur > 5 sur du code répétitif, fidélité Unicode et emoji, contenu court laissé en clair, entrée illisible → `null` sans lever |
| **N.7 — Binaires ZIP** | Lus en `uint8array`, stockés en base64 avec `binary: true`, affichés en lecture seule dans l'éditeur, réécrits avec `{ base64: true }` à l'export. Limite de 2 Mo par fichier. | Aller-retour import → export vérifié octet par octet ; un binaire trop volumineux est bien signalé comme ignoré |
| **N.1 — Conflit multi-onglets** | Chaque écriture porte un **numéro de révision**. `save()` refuse et renvoie `reason: 'conflict'` si la révision stockée diffère de celle connue. L'utilisateur arbitre via la notification. | Test unitaire (refus puis écrasement forcé) **et** test E2E avec deux onglets réels |

**Choix technique corrigé en cours de route** : ma première version détectait le conflit par
horodatage. Deux sauvegardes peuvent tomber dans la même milliseconde — et l'horloge système peut
reculer. Le test unitaire l'a démontré immédiatement (échec `expected true to be false`) ;
le compteur de révision, strictement croissant, règle les deux cas.

**Restent ouverts** : N.2 (frappe sur très gros fichiers), N.3 (recherche en Web Worker),
N.4 (virtualisation de l'explorateur), N.6 (journal de reprise), N.8 (`showDirectoryPicker`),
N.9 (poids du précache), N.10 (fichier modifié hors de l'application).


---

# Quatrième passe — livrée en v1.4.0

Tous les points N.1 à N.10 sont traités. Deux défauts supplémentaires ont été trouvés en chemin,
dont un que j'avais moi-même introduit.

## A. Défauts découverts pendant cette passe

| # | Défaut | Origine | Comment il a été trouvé |
|---|---|---|---|
| **P0.1** | **Un remplacement global corrompait les binaires.** « Tout remplacer » appliquait la regex au base64 : en-tête PNG `137,80,78,71` → `137,80,87,71` | **introduit par moi en 1.3.0** avec la préservation des binaires | audit de propagation du drapeau `binary` : 0 référence dans `SearchPanel`, `StatusBar`, `Sidebar` |
| **P0.2** | **L'application ne démarrait pas hors ligne** : `#root` vide. `jszip` était importé statiquement alors que son chunk est hors précache ; son échec réseau bloquait tout le démarrage | **introduit par moi en 1.1.0** en excluant `zip-*.js` du précache | test E2E coupant réellement le réseau — le diagnostic montrait `ROOT-ENFANTS=0` |
| P0.3 | `DOMPurify.addHook` faisait planter l'*import* du module hors contexte DOM | présent depuis 1.1.0 | test unitaire exécuté sous Node |

**P0.2 mérite d'être souligné** : j'affirmais depuis trois versions que l'application « fonctionne
hors ligne », en m'appuyant sur le fait que le service worker précachait Monaco. Le premier test qui
a réellement coupé le réseau a montré que c'était faux. Une vérification par lecture de
configuration ne remplace pas une vérification par exécution.

## B. Traitement des points ouverts

| Point | Décision | Mesure |
|---|---|---|
| **N.1** Conflit multi-onglets | ✅ fait en 1.3.0 (numéro de révision) | test unitaire + E2E deux onglets |
| **N.2** Frappe sur gros projets | ✅ `useTabs` / `useSplitLayout` ne réagissent plus qu'à la composition ; `Sidebar` et `TabBar` mémoïsés | 2 000 fichiers : 146 → 27 ms/caractère |
| **N.3** Recherche en Web Worker | ✅ `src/workers/search.worker.ts`, avec repli synchrone | blocage du thread : **2 146 → 43 ms** |
| **N.4** Virtualisation de l'explorateur | ✅ `useVirtualList`, sans dépendance, active au-delà de 300 entrées | 2 000 fichiers : **2 001 → 43 nœuds** DOM |
| **N.5** Compression | ✅ fait en 1.3.0 | facteur > 5 |
| **N.6** Reprise après plantage | ✅ journal `sessionStorage` écrit à chaque frappe, restauration proposée au démarrage | 9 tests unitaires |
| **N.7** Binaires ZIP | ✅ fait en 1.3.0 | aller-retour vérifié octet par octet |
| **N.8** Ouverture d'un dossier disque | ✅ `showDirectoryPicker` + handles conservés (`Ctrl+S` direct) | dossiers techniques ignorés, limites, annulation |
| **N.9** Poids du précache | ✅ 4,4 Mo d'illustrations retirées | **10 241 → 5 428 Ko (−47 %)**, hors ligne re-testé |
| **N.10** Fichier modifié hors de l'app | ✅ `saveFileChecked` compare `lastModified` avant d'écrire | arbitrage proposé à l'utilisateur |

## C. Ce qui a été mesuré, pas supposé

Chaque décision de performance s'appuie sur une mesure, prise avant et après :

| Situation | Avant | Après |
|---|---|---|
| Blocage du thread pendant une recherche (1 500 fichiers) | 2 146 ms | **43 ms** |
| Nœuds DOM dans l'explorateur (2 000 fichiers) | 2 001 | **43** |
| Frappe (2 000 fichiers) | 146 ms/caractère | **27 ms/caractère** |
| Filtre de l'explorateur (2 000 fichiers) | 210 ms | **55 ms** |
| Précache du service worker | 10 241 Ko | **5 428 Ko** |

À l'inverse, **N.4 n'a pas été implémenté sur la foi du plan** : la mesure à 300 fichiers montrait
un filtre à 80 ms, donc aucun besoin. C'est la mesure à 2 000 fichiers (146 ms/caractère) qui l'a
justifié.

## D. Restant

Rien des points N.1–N.10. Les évolutions listées plus haut (Emmet, collaboration, exécution en bac
à sable) restent ouvertes — ce sont des
ajouts de valeur, non des défauts.
