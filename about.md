# À propos d'H Editor

## Description

**H Editor** est un éditeur de code en ligne moderne, rapide et 100 % front-end, construit avec **React 18** et **Monaco Editor** (le moteur d'édition de VS Code). Il offre une expérience de développement complète directement dans votre navigateur, sans backend, sans inscription, sans tracking — et **sans aucune requête vers un tiers** : l'éditeur Monaco et la police sont embarqués dans l'application, qui fonctionne donc hors ligne.

L'idée : vous ouvrez l'URL, vous codez, vos fichiers restent chez vous (localStorage + IndexedDB + File System Access API). Vous pouvez aussi importer/exporter vos projets en ZIP en un clic.

---

## Caractéristiques principales

### 🎨 Interface moderne
- Design sombre élégant optimisé pour le confort visuel prolongé
- Système de tokens CSS HSL cohérent (thèmes faciles à étendre)
- Animations fluides et transitions soignées
- Layout responsive (sidebar pliable, panneaux redimensionnables)

### 📝 Édition avancée
- Coloration syntaxique pour **40+ langages** (JS, TS, Python, PHP, Java, Go, Rust, Ruby, Swift, Kotlin, SQL, YAML, JSON, HTML, CSS…)
- Auto-complétion intelligente IntelliSense
- Formatage automatique avec **Prettier** (`Shift+Alt+F`)
- Multi-curseurs, sélection en colonnes
- Minimap pour navigation rapide dans les fichiers longs

### 🔍 Recherche puissante
- Recherche locale dans le fichier (`Ctrl+F`)
- Recherche et remplacement (`Ctrl+H`)
- Recherche globale dans tous les fichiers (`Ctrl+Shift+F`)
- Support des expressions régulières, case-sensitive, mot entier

### 📂 Gestion de fichiers
- Arborescence avec drag & drop
- Menu contextuel (créer, renommer, supprimer)
- Import de fichiers/dossiers locaux (File System Access API)
- Import/Export complet en **ZIP**
- Persistance automatique en localStorage + IndexedDB

### 🖥️ Layouts flexibles
- Vue simple (un éditeur)
- Split horizontal (côte à côte)
- Split vertical (empilé)
- **Mode Zen** plein écran (`F11`) sans distractions
- Panneau de prévisualisation **Markdown** / **HTML** en temps réel

### ⌨️ Productivité
- **Palette de commandes** (`Ctrl+Shift+P`)
- Recherche rapide de fichiers (`Ctrl+P`)
- 30+ raccourcis clavier compatibles VSCode
- Dialogue d'aide intégré
- Paramètres personnalisables (fontSize, tabSize, wordWrap, minimap, thème, autoSave)

### 📲 Installable et hors ligne (PWA)
- Bouton **« Installer »** dans la barre d'état (desktop et mobile) — l'app s'ouvre ensuite dans sa propre fenêtre
- **Fonctionnement hors ligne** : Monaco et la police sont précachés, avec page de fallback dédiée
- **Raccourcis d'application** : « Nouveau fichier », « Importer », « Mode Zen » depuis l'icône
- **Adaptée au mobile** : explorateur replié par défaut sur écran étroit, balises d'installation iOS

---

## Technologies utilisées

- **React 18.3** — Framework UI
- **Monaco Editor 4.7** — Moteur d'édition de VS Code
- **TypeScript 5.8** — Typage statique strict
- **Tailwind CSS 3.4** — Utility-first CSS
- **Vite 8 + SWC** — Build ultra-rapide
- **shadcn/ui** + Radix UI — Composants accessibles
- **react-router-dom 7** — Routing
- **jszip** — Import/Export ZIP
- **Prettier** — Formatage de code

Détails techniques dans [structure.md](./structure.md).

---

## Philosophie

H Editor repose sur quelques principes simples :

1. **Local-first** — Vos données restent dans votre navigateur. Pas de cloud, pas de tracking, pas de compte requis.
2. **Zéro friction** — Ouvrez l'URL, codez. Aucune installation, aucune configuration.
3. **Performance** — Réactivité instantanée, même sur des fichiers volumineux.
4. **Accessibilité** — Navigation clavier complète, contrastes respectés.
5. **Extensibilité** — Architecture modulaire, prête à recevoir plugins / collaboration / Git.

---

## Différence avec les alternatives

| | H Editor | VS Code | CodeSandbox | StackBlitz |
|---|---|---|---|---|
| Installation | ❌ aucune | ✅ desktop | ❌ aucune | ❌ aucune |
| Backend | ❌ aucun | — | ✅ cloud | ✅ cloud |
| Données | 💾 chez vous | 💾 chez vous | ☁️ cloud | ☁️ cloud |
| Compte requis | ❌ non | ❌ non | ✅ souvent | ✅ souvent |
| Exécution de code | ❌ pas encore | ✅ via terminal | ✅ sandbox | ✅ WebContainer |
| Poids | léger | gros | moyen | moyen |

H Editor est positionné comme un **éditeur de texte/code rapide pour le navigateur**, pas un IDE complet. C'est sa force : simplicité, vitesse, confidentialité.

---

## Historique

H Editor est né d'un prototype bootstrapé sur la plateforme **Lovable**, puis émancipé et autonomisé en projet open-source maintenu par son auteur. Toutes les références à la plateforme initiale ont été retirées (cf. [changelog v1.0.1](./changelog.md)).

Le projet est désormais hébergé chez son auteur sous l'URL [hylst.fr/app](https://hylst.fr/app/).

---

## Auteur

**Geoffroy Streit**
- 🌐 [hylst.fr](https://hylst.fr)
- 📧 [geoffroy.streit@gmail.com](mailto:geoffroy.streit@gmail.com)
- 🐦 [@hylst](https://twitter.com/hylst)

---

## Licence

Sous licence **MIT** — voir [LICENSE](./LICENSE). Vous êtes libre de l'utiliser, le modifier et le distribuer.

---

*H Editor — un éditeur de code qui respecte votre temps et vos données.*


---

## Ce qui distingue H Editor

**Rien ne sort de votre navigateur.** L'éditeur Monaco et la police sont embarqués dans
l'application : aucune requête vers un CDN, aucun compte, aucune télémétrie. L'application
fonctionne **hors ligne**, ce qui est vérifié par un test coupant réellement le réseau. Elle
s'**installe comme une application** (PWA — bouton « Installer » dans la barre d'état) et s'adapte
au **mobile** : explorateur replié par défaut sur écran étroit.

**Vos fichiers sont traités avec soin.** Le contenu est compressé avant écriture, les sauvegardes
sont incrémentales, un journal protège des plantages, et toute écriture concurrente — un autre
onglet, un fichier modifié sur le disque — est détectée puis soumise à votre arbitrage plutôt
qu'écrasée. Les vingt dernières suppressions restent restaurables.

**L'aperçu est utile et sûr.** Le Markdown est désinfecté avant affichage ; le HTML s'exécute dans
une iframe isolée, avec sa console rapatriée sous l'aperçu — sans que la page puisse toucher au
stockage de l'éditeur.

**La qualité est mesurée, pas affirmée.** 144 tests unitaires et 121 tests de bout en bout,
rejoués sur Chromium, Firefox, WebKit et un profil mobile. Chaque bug ayant réellement existé
dispose de son test de non-régression, et les seuils de performance sont chiffrés dans la suite.
