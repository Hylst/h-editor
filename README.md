# EditorX

Un éditeur de code en ligne moderne, rapide et 100 % front-end, construit avec **React 18**, **Monaco Editor** et **Vite**.

![Version](https://img.shields.io/badge/version-1.7.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![React](https://img.shields.io/badge/React-18.3-61dafb.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6.svg)
![Vite](https://img.shields.io/badge/Vite-8.0-646cff.svg)
![Tests](https://img.shields.io/badge/tests-144%20unitaires%20%2B%20121%20E2E-brightgreen.svg)

EditorX est un IDE léger qui tient dans votre navigateur : pas de backend, pas de tracking, **aucune requête vers un tiers** (Monaco et les polices sont embarqués). Vos fichiers restent sur votre machine — métadonnées en `localStorage`, contenu en `IndexedDB`, écriture disque via la File System Access API. Pensé pour le développeur qui veut éditer, prototyper, prévisualiser sans installer un IDE complet.

> Démo prévue : `https://hylst.fr/app/`

---

## 🚀 Démarrage rapide

### Prérequis
- **Node.js ≥ 18** ([télécharger](https://nodejs.org/))
- **npm** (inclus avec Node.js) ou **pnpm** / **yarn**

### Installation

```bash
# 1. Récupérer le projet
git clone https://github.com/hylst/editorx.git
cd editorx

# 2. Installer les dépendances
npm install

# 3. Lancer le serveur de développement
npm run dev
```

L'application est accessible sur **http://localhost:8080/app/**

> ⚠️ L'app est configurée avec `base: '/app/'` (déploiement sous-chemin). Le `/app/` final est donc important même en local.

---

## 📖 Documentation

| Fichier | Contenu |
|---------|---------|
| [about.md](./about.md) | Description du projet, philosophie, auteur |
| [features.md](./features.md) | Liste détaillée des fonctionnalités avec statut |
| [structure.md](./structure.md) | Architecture technique, conventions, design system |
| [changelog.md](./changelog.md) | Historique des versions (Keep a Changelog) |
| [todo.md](./todo.md) | Roadmap et tâches en cours |
| [test_build_deploy.md](./test_build_deploy.md) | Guide complet : test local, build, déploiement Coolify/Nginx |

---

## ⌨️ Raccourcis principaux

### Fichiers
| Raccourci | Action |
|-----------|--------|
| `Ctrl+S` | Enregistrer sur le disque |
| `Ctrl+Maj+S` | Enregistrer sous… |
| `Ctrl+N` | Nouveau fichier |
| `Ctrl+O` | Ouvrir fichier |
| `Ctrl+W` | Fermer l'onglet (le fichier reste dans le projet) |
| `Ctrl+Maj+T` | Rouvrir le dernier onglet fermé |

### Édition
| Raccourci | Action |
|-----------|--------|
| `Ctrl+Z` / `Ctrl+Y` | Annuler / Rétablir |
| `Ctrl+D` | Sélectionner occurrence suivante |
| `Shift+Alt+F` | Formater (Prettier) |

### Recherche
| Raccourci | Action |
|-----------|--------|
| `Ctrl+F` | Rechercher dans le fichier |
| `Ctrl+H` | Rechercher et remplacer |
| `Ctrl+Shift+F` | Recherche globale |

### Navigation & affichage
| Raccourci | Action |
|-----------|--------|
| `Ctrl+P` | Aller à un fichier |
| `Ctrl+B` | Afficher / masquer l'explorateur |
| `Ctrl+Shift+P` | Palette de commandes |
| `Ctrl+G` | Aller à la ligne (Monaco) |
| `Ctrl+\` / `Ctrl+Maj+\` | Diviser l'éditeur |
| `F11` | Mode Zen plein écran |

Liste complète : voir [features.md](./features.md).

---

## 🛠️ Scripts npm

```bash
npm run dev        # Dev server (http://localhost:8080/app/)
npm run build      # Build production → ./dist/
npm run build:dev  # Build en mode développement (avec sourcemaps)
npm run preview    # Serveur local sur ./dist/ (http://localhost:4173/app/)
npm run lint       # ESLint
npm run typecheck  # Vérification TypeScript (strict)
npm run test       # Tests unitaires Vitest (mode watch)
npm run test:run   # Tests unitaires (une passe, utilisé en CI)
npm run test:e2e   # Build + Playwright (Chromium, Firefox, WebKit, Pixel 7)
npm run test:e2e:chromium  # Idem, Chromium seul (itération rapide)
npm run test:all   # Tout : lint + types + unitaires + E2E
```

---

## 📦 Stack technique

- **[React 18](https://react.dev/)** — UI library
- **[Monaco Editor](https://microsoft.github.io/monaco-editor/)** — moteur d'édition de VS Code
- **[TypeScript 5.8](https://www.typescriptlang.org/)** — typage strict
- **[Vite 8](https://vitejs.dev/)** + **SWC** — build & dev server ultra-rapides
- **[Tailwind CSS 3.4](https://tailwindcss.com/)** — utility-first CSS
- **[shadcn/ui](https://ui.shadcn.com/)** + Radix UI — composants accessibles
- **[react-router-dom 7](https://reactrouter.com/)** — routing client
- **[jszip](https://stuk.github.io/jszip/)** — import/export ZIP
- **[Prettier](https://prettier.io/)** — formatage de code (chargé à la demande)
- **[DOMPurify](https://github.com/cure53/DOMPurify)** — désinfection de l'aperçu Markdown
- **[Vitest](https://vitest.dev/)** — tests unitaires

### Tester un site sans serveur

EditorX assemble votre projet **en mémoire** pour le prévisualiser : les feuilles de styles, les
scripts, les modules ES (`import './util.js'`), les images et les `url()` CSS sont résolus, et
`fetch` sert les fichiers du projet. Les liens internes permettent de naviguer entre les pages.

`Ctrl+Maj+V` bascule entre l'édition et l'aperçu plein écran ; `Échap` revient à l'éditeur.

L'aperçu embarque une **console interactive** — tapez `document.querySelector('h1').textContent` et
le résultat s'affiche — trois **formats d'écran** (bureau, tablette, mobile) pour éprouver le
responsive, et une liste des **ressources introuvables** dont chaque entrée ouvre le fichier fautif.

La page prévisualisée reste **isolée** : elle s'exécute dans une iframe sans accès au stockage de
l'éditeur. Un service worker n'aurait pas permis cette garantie.

*Limites assumées* : pas d'appel réseau réel, pas de routage serveur, pas d'exécution PHP ou Node.

### Confort d'édition

| Fonction | Détail |
|----------|--------|
| Modèles de fichiers | 14 points de départ, dont un **site complet** en 3 fichiers liés |
| Extraits de code | `cl`, `fn`, `rfc`, `useState`, `flexcenter`, `def`… avec champs tabulables |
| Aperçu Markdown | Rendu désinfecté (DOMPurify), typographie complète |
| Aperçu HTML | Site multi-fichiers assemblé, console intégrée, navigation entre pages |
| Recherche globale | Exécutée dans un Web Worker : l'interface ne se fige pas |
| Explorateur | Filtre rapide, virtualisation au-delà de 300 entrées, largeur réglable |
| Corbeille | Les 20 dernières suppressions restent restaurables |

### Stockage et confidentialité

| Donnée | Emplacement |
|--------|-------------|
| Contenu des fichiers | IndexedDB (`editorx` / `file-content`) |
| Arborescence, onglets | `localStorage` (`editorx-workspace`) |
| Préférences | `localStorage` (`editorx-settings`) |
| Fichiers du disque | Uniquement via la File System Access API, sur action explicite |

Aucune donnée ne sort du navigateur. L'éditeur Monaco (~4 Mo) et la police JetBrains Mono sont
servis par l'application elle-même : **EditorX fonctionne hors ligne** une fois installé en PWA.

Détails dans [structure.md](./structure.md).

---

## 🚢 Déploiement

EditorX se déploie comme un **site statique** (rien à exécuter côté serveur).

Le guide complet — depuis le test local Windows jusqu'au déploiement sur VPS Hostinger avec Coolify + Nginx sous l'URL `https://hylst.fr/app/` — est dans [test_build_deploy.md](./test_build_deploy.md).

Alternatives rapides : Netlify, Vercel, Cloudflare Pages, GitHub Pages (drag & drop du dossier `dist/`).

---

## 🤝 Contribution

Les contributions sont les bienvenues.

1. Fork le projet
2. Branche dédiée : `git checkout -b feature/ma-feature`
3. Commit : `git commit -m "feat: ma feature"`
4. Push : `git push origin feature/ma-feature`
5. Ouvrir une Pull Request

Les conventions (lint, tests, format des commits) sont décrites dans [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## 📄 Licence

MIT — voir [LICENSE](./LICENSE).

---

## 👤 Auteur

**Geoffroy Streit** ([hylst.fr](https://hylst.fr))
📧 [geoffroy.streit@gmail.com](mailto:geoffroy.streit@gmail.com)

EditorX est un projet personnel open-source. Vos retours, idées et contributions sont les bienvenus.

---

## 🙏 Remerciements

- L'équipe Monaco / VS Code pour l'éditeur exceptionnel
- L'écosystème React, Vite, Tailwind, shadcn/ui
- La communauté open source
