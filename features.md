# Fonctionnalités d'EditorX

Inventaire détaillé des fonctionnalités, organisé par catégorie. Statuts : ✅ Disponible · 🚧 En cours · 📋 Roadmap.

---

## 📝 Édition de code

| Fonctionnalité | Statut | Détail |
|---|---|---|
| Monaco Editor (moteur VS Code) | ✅ | Intégration complète via `@monaco-editor/react` |
| 40+ langages supportés | ✅ | JS, TS, Python, PHP, Java, Go, Rust, Ruby, Swift, Kotlin, SQL, YAML, JSON, HTML, CSS, Markdown, etc. |
| Coloration syntaxique | ✅ | Native Monaco |
| Auto-complétion IntelliSense | ✅ | Suggestions contextuelles |
| Multi-curseurs | ✅ | `Alt+Click` pour ajouter un curseur |
| Sélection en colonnes | ✅ | `Alt+Shift+Drag` |
| Formatage Prettier | ✅ | `Shift+Alt+F` (JS, TS, CSS, HTML, JSON, MD) |
| Numérotation des lignes | ✅ | Configurable dans Settings |
| Minimap | ✅ | Navigation rapide, toggle dans Settings |
| Marqueurs erreurs/warnings | ✅ | Diagnostics dans la gouttière |
| Pliage de code (folding) | ✅ | Monaco natif |
| Bracket matching | ✅ | Surlignage paires `{}` `()` `[]` |
| Snippets par langage | ✅ | 6 langages, champs tabulables (`snippets.ts`) — v1.5.0 |
| Emmet (HTML/CSS) | 📋 | À évaluer — dépendance à charger en `import()` dynamique |
| Refactor symboles | 📋 | À évaluer |

---

## 📂 Gestion de fichiers

| Fonctionnalité | Statut | Détail |
|---|---|---|
| Arborescence fichiers/dossiers | ✅ | Composant `Sidebar` |
| Création de fichier | ✅ | Menu contextuel + raccourci `Ctrl+N` |
| Création de dossier | ✅ | Menu contextuel |
| Renommage | ✅ | F2 ou menu contextuel |
| Suppression | ✅ | Avec confirmation |
| Drag & drop fichiers depuis disque | ✅ | Vers la sidebar |
| Drag & drop entre dossiers | ✅ | Réorganisation interne |
| Menu contextuel | ✅ | Clic droit sur node |
| Icônes par type/langage | ✅ | Tokens CSS dédiés |
| Indicateur fichier modifié | ✅ | Point dans onglet + arbo |
| Import projet ZIP | ✅ | Via `jszip` |
| Export projet ZIP | ✅ | Téléchargement direct |
| Import/Export JSON workspace | ✅ | Sauvegarde complète de la session |
| File System Access API | ✅ | Chrome/Edge uniquement (fallback ailleurs) |
| Persistance localStorage | ✅ | Réglages + arborescence + onglets (métadonnées) |
| Persistance IndexedDB | ✅ | Contenu de tous les fichiers, écriture incrémentale |
| Indicateur progression import/export | ✅ | `ZipProgress` / `DirectoryProgress` (v1.1.0) |
| Modèles de fichiers | ✅ | 14 modèles dont un site complet en 3 fichiers liés (v1.5.0 → v1.6.0) |

---

## 🔍 Recherche

| Fonctionnalité | Statut | Détail |
|---|---|---|
| Recherche locale | ✅ | `Ctrl+F` — barre Monaco |
| Find & Replace | ✅ | `Ctrl+H` |
| Recherche globale | ✅ | `Ctrl+Shift+F` — `SearchPanel` |
| Expressions régulières | ✅ | Toggle dans le panneau |
| Case-sensitive | ✅ | Toggle |
| Mot entier | ✅ | Toggle |
| Remplacement global | ✅ | Avec preview |
| Navigation entre résultats | ✅ | F3 / Shift+F3 |
| Web Worker pour gros projets | ✅ | `search.worker.ts`, repli synchrone (v1.4.0) |

---

## 🗂️ Onglets

| Fonctionnalité | Statut | Détail |
|---|---|---|
| Multi-onglets | ✅ | Composant `TabBar` |
| Indicateur modifié | ✅ | Point dans l'onglet |
| Fermeture rapide | ✅ | Croix sur hover ou `Ctrl+W` |
| Navigation `Ctrl+Tab` | ✅ | Suivant |
| Navigation `Ctrl+Shift+Tab` | ✅ | Précédent |
| Drag & drop pour réordonner | ✅ | v1.1.0 |
| Onglets épinglés | 📋 | À faire |
| Rouvrir l'onglet fermé `Ctrl+Shift+T` | ✅ | Historique des 20 derniers (v1.1.0) |
| Historique fichiers récents | 📋 | À évaluer |

---

## 🖥️ Layouts & affichage

| Fonctionnalité | Statut | Détail |
|---|---|---|
| Vue simple | ✅ | Un seul éditeur |
| Split horizontal | ✅ | Deux éditeurs côte à côte |
| Split vertical | ✅ | Deux éditeurs empilés |
| Mode Zen plein écran | ✅ | `F11` |
| Sidebar pliable | ✅ | `Ctrl+B` |
| Panneaux redimensionnables | ✅ | `react-resizable-panels` |
| Preview Markdown live | ✅ | Panneau dédié (`PreviewPanel`) |
| Preview HTML live | ✅ | Iframe sandboxée |
| Thème vs-dark (par défaut) | ✅ | Monaco theme |
| Thème vs-light | ✅ | Settings |
| Thème hc-black (haut contraste) | ✅ | Settings |
| Thème clair custom EditorX | ✅ | Interface + éditeur, ou suivi du thème système (v1.1.0) |
| Thème haut contraste custom | 📋 | À faire |
| Import/export de thèmes | 📋 | À faire |

---

## ⌨️ Raccourcis clavier (compatibles VSCode)

### Fichiers
| Raccourci | Action |
|-----------|--------|
| `Ctrl+S` | Sauvegarder |
| `Ctrl+N` | Nouveau fichier |
| `Ctrl+O` | Ouvrir fichier |
| `Ctrl+W` | Fermer onglet |
| « Fermer tous les onglets » | Menu contextuel d'onglet ou palette de commandes |

### Édition
| Raccourci | Action |
|-----------|--------|
| `Ctrl+Z` / `Ctrl+Y` | Annuler / Rétablir |
| `Ctrl+X` / `Ctrl+C` / `Ctrl+V` | Couper / Copier / Coller |
| `Ctrl+A` | Tout sélectionner |
| `Ctrl+D` | Sélectionner occurrence suivante |
| `Ctrl+L` | Sélectionner la ligne |
| `Shift+Alt+F` | Formater le document |
| `Ctrl+/` | Commenter / Décommenter |
| `Alt+↑` / `Alt+↓` | Déplacer ligne haut/bas |

### Recherche
| Raccourci | Action |
|-----------|--------|
| `Ctrl+F` | Rechercher (local) |
| `Ctrl+H` | Rechercher et remplacer |
| `Ctrl+Shift+F` | Rechercher (global) |
| `F3` / `Shift+F3` | Résultat suivant / précédent |

### Navigation
| Raccourci | Action |
|-----------|--------|
| `Ctrl+P` | Recherche rapide fichiers |
| `Ctrl+Shift+P` | Palette de commandes |
| `Ctrl+G` | Aller à la ligne |
| `Ctrl+Tab` | Onglet suivant |
| `Ctrl+Home` / `Ctrl+End` | Début / fin de fichier |

### Affichage
| Raccourci | Action |
|-----------|--------|
| `F11` | Mode Zen plein écran |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl++` / `Ctrl+-` | Zoom in / out |

---

## 🎛️ Paramètres (`SettingsDialog`)

| Paramètre | Type | Défaut |
|-----------|------|--------|
| `autoSave` | `{ enabled: boolean; interval: number }` (ms) | `{ true, 5000 }` |
| `theme` | `vs-dark` / `vs-light` / `hc-black` | `vs-dark` |
| `uiTheme` | `dark` / `light` / `system` | `dark` |
| `fontSize` | number (8–40) | 14 |
| `tabSize` | number (1–8) | 2 |
| `wordWrap` | `on` / `off` | `on` |
| `minimap` | `{ enabled: boolean }` | `{ true }` |
| `scrollbar` | `{ horizontal, horizontalScrollbarSize }` | `{ auto, 10 }` |
| `lineNumbers` | `on` / `off` / `relative` | `on` |
| `insertSpaces` | bool | true |
| `previewVisible` | bool | false |
| `sidebarWidth` / `searchPanelWidth` | number (180–640) | 256 / 320 |

Persistés dans `localStorage` (`editorx-settings`) ; toute lecture passe par
`sanitizeSettings()` qui valide, borne et complète chaque champ.

---

## 🛠️ Outils intégrés

| Fonctionnalité | Statut | Détail |
|---|---|---|
| Palette de commandes | ✅ | `Ctrl+Shift+P` — `CommandPalette` avec recherche fuzzy (cmdk) |
| Dialogue d'aide / À propos | ✅ | `InfoDialog` (raccourcis, astuces, à propos) |
| Notifications toast | ✅ | `sonner` |
| Status Bar contextuelle | ✅ | Ligne, colonne, langage, encodage |

---

## 📲 PWA, hors ligne et mobile

| Fonctionnalité | Statut | Détail |
|---|---|---|
| Application installable (PWA) | ✅ | Manifeste complet, `display: standalone`, icônes 192/512 px + SVG |
| Bouton « Installer » | ✅ | Dans la barre d'état, dès que le navigateur émet `beforeinstallprompt` (`useInstallPrompt`) |
| Fonctionnement hors ligne | ✅ | Monaco et la police embarqués, précachés (37 entrées, ~5,5 Mo) — vérifié par un test E2E coupant réellement le réseau |
| Page de fallback hors ligne | ✅ | `public/offline.html` servie par le service worker (`navigateFallback`) pour les navigations sans réseau ; n'intercepte ni `/api/` ni les assets |
| Raccourcis d'application | ✅ | « Nouveau fichier », « Importer un fichier », « Mode Zen » depuis l'icône PWA |
| Explorateur replié sur mobile | ✅ | Écran < 768 px : la place va à l'éditeur ; explorateur réouvrable (`Ctrl+B` ou bouton) |
| Installabilité iOS | ✅ | Balises `apple-mobile-web-app-*`, icône 512 px, screenshot portrait (`narrow`) |

---

## 🔮 Roadmap

La liste complète et priorisée vit dans [todo.md](./todo.md) — source unique, pour éviter deux
listes divergentes. Restes notables : Emmet (import dynamique), onglets épinglés, thème haut
contraste custom, mise en page mobile dédiée, raccourcis personnalisables.

> **Décision produit** : l'internationalisation (i18n) a été **écartée** — l'interface reste en
> français et les sélecteurs E2E s'appuient sur les noms accessibles français.

---

## 📊 Récapitulatif

Le décompte détaillé par catégorie évolue à chaque version ; se référer aux tableaux ci-dessus
(statuts à jour au 07/09/2026).


---

## Ajouts de la version 1.1.0

| Fonctionnalité | Raccourci | Détail |
|----------------|-----------|--------|
| Aller à un fichier | `Ctrl+P` | Recherche par nom avec chemin affiché |
| Replier l'explorateur | `Ctrl+B` | Libère la largeur, utile sur petit écran |
| Rouvrir un onglet fermé | `Ctrl+Maj+T` | Historique des 20 derniers |
| Filtre de l'explorateur | — | Champ de filtrage, dépliage automatique des résultats |
| Aperçu HTML | — | Rendu dans une iframe `sandbox` isolée |
| Aperçu Markdown désinfecté | — | DOMPurify : scripts et gestionnaires inline neutralisés |
| Suppression annulable | — | Notification « Annuler » après chaque suppression |
| Onglets réorganisables | glisser-déposer | Clic milieu pour fermer, menu contextuel |
| Thème clair complet | — | Interface + éditeur, ou suivi du thème système |
| État de sauvegarde | — | Horodatage, poids du projet, alerte de saturation |
| Fonctionnement hors ligne | — | Monaco et la police sont embarqués, précachés par le service worker |


---

## Ajouts des versions 1.2.0 à 1.5.0

### Édition

| Fonctionnalité | Version | Détail |
|----------------|---------|--------|
| Modèles de fichiers | 1.5.0 | 8 modèles, depuis l'explorateur ou `Ctrl+Maj+P` |
| Extraits de code | 1.5.0 | JS, TS, React, CSS, Python, HTML — champs tabulables |
| Console de l'aperçu HTML | 1.5.0 | `console.*`, erreurs, promesses rejetées ; iframe isolée |
| Panneaux redimensionnables | 1.5.0 | Souris, clavier, double-clic ; largeur conservée |

### Données et robustesse

| Fonctionnalité | Version | Détail |
|----------------|---------|--------|
| Corbeille multi-niveaux | 1.5.0 | 20 suppressions restaurables |
| Journal de reprise | 1.4.0 | Survit à un plantage brutal de l'onglet |
| Détection de modification externe | 1.4.0 | Le fichier disque a changé → arbitrage avant écrasement |
| Ouverture d'un dossier disque | 1.4.0 | `Ctrl+S` écrit ensuite directement, sans sélecteur |
| Compression du stockage | 1.3.0 | gzip, facteur ~5 sur du code source |
| Binaires préservés | 1.3.0 | Base64, restitués intacts à l'export |
| Protection contre l'écrasement concurrent | 1.3.0 | Numéro de révision, arbitrage utilisateur |

### Performance (mesurée)

| Situation | Avant | Après |
|-----------|-------|-------|
| Blocage pendant une recherche (1 500 fichiers) | 2 146 ms | **43 ms** |
| Nœuds DOM de l'explorateur (2 000 fichiers) | 2 001 | **43** |
| Frappe (2 000 fichiers) | 146 ms/car. | **27 ms/car.** |
| Précache du service worker | 10 241 Ko | **≈5,3 Mo** (36 entrées, mesuré 08/2026) |
| Chunk d'entrée | 2 321 Ko | **~180 Ko** |

### Compatibilité vérifiée

Les tests de bout en bout s'exécutent sur **Chromium, Firefox, WebKit** et un profil **Pixel 7**.
Les fonctions dépendantes de Chromium (File System Access, ouverture de dossier) disposent d'un
repli sur les autres moteurs : `<input type="file">` et téléchargement.


---

## Version 1.6.0 — aperçu de site multi-fichiers

| Fonctionnalité | Détail |
|----------------|--------|
| Assemblage du projet | Styles, scripts, modules ES, images et `url()` CSS résolus en mémoire |
| Modules ES | Imports internes réécrits récursivement en `data:` URI |
| `fetch` / `XHR` | Servent les fichiers texte du projet |
| Navigation | Liens internes interceptés, page cible réassemblée, bouton de retour |
| Plein écran | `Ctrl+Maj+V` pour basculer édition ↔ test, `Échap` pour revenir |
| Ressources manquantes | Comptées et détaillées en infobulle, sans interrompre l'aperçu |
| Isolation | `sandbox` sans `allow-same-origin` conservé — aucun accès au stockage |
| **Console interactive** | Saisie d'expressions évaluées dans la page, historique aux flèches |
| **Formats d'écran** | Bureau, tablette (768 px), mobile (375 px) — le site reste fonctionnel |
| **Ressources manquantes** | Liste détaillée, chaque entrée ouvre le fichier fautif |

### Les 14 modèles de fichiers

| Modèle | Fichiers créés |
|--------|----------------|
| Site web complet | `index.html` + `styles.css` + `app.js` (liés, testables) |
| Page HTML5 | `page.html` |
| Composant React | `Composant.tsx` |
| Composant Vue (SFC) | `Composant.vue` |
| Module TypeScript | `module.ts` |
| Script Python | `script.py` |
| Serveur Node / Express | `serveur.js` |
| Test unitaire Vitest | `module.test.ts` |
| Workflow GitHub Actions | `ci.yml` |
| Document Markdown | `document.md` |
| Configuration JSON | `config.json` |
| Feuille de styles | `styles.css` |
| Schéma SQL | `schema.sql` |
| `.gitignore` | `.gitignore` |

### Ce que l'aperçu ne peut pas faire

Ces limites tiennent à l'absence de serveur et sont documentées, non contournées :

- pas d'appel réseau réel vers une API tierce ;
- pas de routage côté serveur (`/a-propos` sans `.html`) ;
- pas d'exécution de code serveur (PHP, Node) — le modèle Express est éditable, pas exécutable ;
- cookies et `localStorage` inopérants dans la page prévisualisée (origine opaque).
