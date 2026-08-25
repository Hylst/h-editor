import type { EditorFile } from '@/types/editor';
import { createId } from './ids';

export const WELCOME_FILE_NAME = 'bienvenue.md';

const WELCOME_CONTENT = `# Bienvenue dans EditorX

**EditorX** est un éditeur de code et de texte 100 % local : aucun serveur, aucun compte,
vos fichiers ne quittent jamais votre navigateur.

## Prise en main

1. \`Ctrl + N\` — nouveau fichier
2. \`Ctrl + O\` — ouvrir un fichier du disque
3. \`Ctrl + P\` — aller à un fichier
4. \`Ctrl + S\` — enregistrer sur le disque
5. \`Ctrl + Maj + P\` — palette de commandes

> Vos fichiers sont conservés automatiquement dans le navigateur
> (métadonnées en localStorage, contenu en IndexedDB).

## Raccourcis

| Raccourci | Action |
|---|---|
| \`Ctrl + S\` | Enregistrer sur le disque |
| \`Ctrl + Maj + S\` | Enregistrer sous… |
| \`Ctrl + O\` | Ouvrir un fichier |
| \`Ctrl + N\` | Nouveau fichier |
| \`Ctrl + P\` | Aller à un fichier |
| \`Ctrl + Maj + P\` | Palette de commandes |
| \`Ctrl + B\` | Afficher/masquer l'explorateur |
| \`Ctrl + W\` | Fermer l'onglet |
| \`Ctrl + Maj + T\` | Rouvrir le dernier onglet fermé |
| \`Ctrl + F\` / \`Ctrl + H\` | Rechercher / remplacer dans le fichier |
| \`Ctrl + Maj + F\` | Rechercher dans tous les fichiers |
| \`Alt + Maj + F\` | Formater le document |
| \`Ctrl + \\\` | Diviser l'éditeur |
| \`F11\` | Mode Zen |

## Fonctionnalités

- Éditeur **Monaco** (moteur de VS Code), embarqué — fonctionne **hors ligne**
- Coloration syntaxique pour **40+ langages**
- Aperçu **Markdown** et **HTML** en direct
- Explorateur avec dossiers, glisser-déposer, filtre
- Recherche et remplacement dans tout le projet
- Formatage Prettier (JS, TS, JSON, HTML, CSS, Markdown, YAML)
- Import / export **ZIP** et **JSON**
- Éditeur divisé, mode Zen, thème clair et sombre

## Aperçu

Ce fichier est en Markdown : cliquez sur **Afficher l'aperçu** en haut à droite
pour voir le rendu à côté du code.

---

*Bon code !*
`;

export const createWelcomeFile = (): EditorFile => ({
  id: createId(),
  name: WELCOME_FILE_NAME,
  language: 'markdown',
  content: WELCOME_CONTENT,
  modified: false,
});
