# Annonce de lancement — H Editor

> Post prêt à publier. Version longue pour LinkedIn / blog, version courte pour X/Twitter.
> Tous les chiffres cités sont mesurés et vérifiés par les tests du projet (09/2026).

---

## 🚀 Version longue (LinkedIn / blog)

**Après des mois de développement, je suis fier d'annoncer qu'H Editor est terminé et en ligne : https://hylst.fr/heditor/**

H Editor, c'est quoi ? Un **éditeur de code complet, directement dans votre navigateur** — sans installation, sans compte, sans serveur. Vous ouvrez l'URL, vous codez. C'est tout.

**Pourquoi ce projet ?** Parce qu'entre l'IDE lourd à installer et l'éditeur en ligne qui aspire vos données dans un cloud, il manquait une option simple : un vrai environnement de code, **100 % local**, où rien ne quitte jamais votre machine.

### Ce qu'il sait faire

📝 **Éditer du vrai code** — Le moteur d'édition de VS Code (Monaco), avec coloration pour plus de 40 langages, auto-complétion, multi-curseurs, formatage Prettier, et plus de 30 raccourcis compatibles VS Code.

📂 **Gérer un projet** — Arborescence de fichiers et dossiers, glisser-déposer, import/export ZIP, ouverture de dossiers disque, 14 modèles de départ (dont un site web complet en 3 fichiers liés).

🌐 **Tester sans serveur** — C'est la fonctionnalité dont je suis le plus fier : l'aperçu **assemble votre site multi-fichiers en mémoire** (CSS, scripts, modules ES, images) et l'exécute dans un bac à sable isolé, avec une **console interactive** pour évaluer du code dans la page, trois formats d'écran pour éprouver le responsive, et la détection des ressources manquantes. Idéal pour prototyper HTML/CSS/JS sans toucher à un terminal.

💾 **Ne jamais rien perdre** — Sauvegarde automatique et incrémentale en local (localStorage + IndexedDB compressé), journal de reprise qui survit à un plantage, corbeille des 20 dernières suppressions, et détection des modifications concurrentes plutôt qu'écrasement silencieux.

📲 **S'installer comme une app** — H Editor est une PWA : bouton « Installer » dans la barre d'état, fonctionnement **hors ligne** vérifié, raccourcis d'application, interface adaptée au mobile.

### Ce qu'il ne fait pas — volontairement

Pas de backend, pas de compte, pas de télémétrie, **aucune requête vers un tiers** : Monaco et la police sont embarqués dans l'application. Vos données restent chez vous. C'est un choix, assumé et documenté.

### La qualité, mesurée plutôt qu'affirmée

- **144 tests unitaires** + **121 tests de bout en bout**, rejoués sur Chromium, Firefox, WebKit et un profil mobile Pixel 7 ;
- chaque bug ayant réellement existé dispose de son test de non-régression ;
- des performances chiffrées : recherche dans 1 500 fichiers en 43 ms, frappe fluide à 2 000 fichiers ouverts, application de ~180 Ko au démarrage.

👉 **Essayez-le** : https://hylst.fr/heditor/
💻 **Code source (MIT)** : https://github.com/hylst/editorx

Vos retours sont les bienvenus — bugs, idées, contributions. Et si le projet vous plaît, une ⭐ sur le dépôt fait toujours plaisir !

*#opensource #webdev #frontend #react #typescript #PWA #H Editor*

---

## ⚡ Version courte (X/Twitter — ~270 caractères)

🎉 H Editor est terminé et en ligne !

Un éditeur de code complet **dans votre navigateur** : moteur de VS Code, aperçu de site multi-fichiers avec console interactive, sauvegarde locale auto, hors ligne & installable (PWA). Sans compte, sans serveur, sans requête vers un tiers.

👉 https://hylst.fr/heditor/
💻 MIT : https://github.com/hylst/editorx

---

## 📸 Suggestions pour accompagner le post

- Capture du thème sombre avec un projet ouvert (explorateur + split + aperçu de site).
- GIF court : création d'un fichier via le modèle « Site web complet » → aperçu → console interactive qui évalue `document.querySelector('h1').textContent`.
- Screenshot mobile (Pixel 7) montrant l'app installée.

## Chiffres exacts à ne pas dépasser (vérifiés)

| Affirmation | Source |
|---|---|
| 144 tests unitaires | `npm run test:run` (09/2026) |
| 121 tests E2E, 4 moteurs | `npx playwright test` (09/2026) |
| Recherche 1 500 fichiers : 43 ms | `e2e/performance.spec.ts` |
| Frappe 2 000 fichiers : 27 ms/car. | `e2e/performance.spec.ts` |
| Hors ligne vérifié | `e2e/offline.spec.ts` |
| Aucune requête tierce | `e2e/regressions.spec.ts` |
