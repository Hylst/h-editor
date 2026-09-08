/**
 * Modèles de fichiers.
 *
 * Créer un fichier vide puis retaper la même ossature est le geste le plus
 * répétitif d'un éditeur. Ces modèles sont volontairement courts : un point de
 * départ correct, pas un générateur de projet.
 */

export interface TemplateExtraFile {
  fileName: string;
  content: string;
}

export interface FileTemplate {
  id: string;
  label: string;
  /** Nom proposé ; l'unicité est assurée à la création. */
  fileName: string;
  description: string;
  content: string;
  /**
   * Fichiers créés en même temps (feuille de styles, script…).
   * Le point d'entrée est ouvert dans un onglet, les autres restent
   * disponibles dans l'explorateur — et sont résolus par l'aperçu de site.
   */
  extraFiles?: TemplateExtraFile[];
}

export const FILE_TEMPLATES: FileTemplate[] = [
  {
    id: 'site-multipage',
    label: 'Site web complet (3 fichiers)',
    fileName: 'index.html',
    description: 'Page, styles et script liés, prêt pour l’aperçu',
    /** Ce modèle crée aussi `styles.css` et `app.js`, résolus par l’aperçu. */
    extraFiles: [
      {
        fileName: 'styles.css',
        content: `:root {
  --fond: #0f172a;
  --texte: #e2e8f0;
  --accent: #38bdf8;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  font-family: system-ui, sans-serif;
  background: var(--fond);
  color: var(--texte);
}

main { text-align: center; padding: 2rem; }

h1 { color: var(--accent); margin-bottom: 0.5rem; }

button {
  margin-top: 1.5rem;
  padding: 0.6rem 1.2rem;
  border: 0;
  border-radius: 0.4rem;
  background: var(--accent);
  color: var(--fond);
  font-size: 1rem;
  cursor: pointer;
}
`,
      },
      {
        fileName: 'app.js',
        content: `const bouton = document.querySelector('#compteur');
let clics = 0;

bouton.addEventListener('click', () => {
  clics += 1;
  bouton.textContent = clics === 1 ? '1 clic' : clics + ' clics';
  console.log('Clics :', clics);
});

console.log('Script chargé');
`,
      },
    ],
    content: `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mon site</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <main>
      <h1>Mon site</h1>
      <p>Les fichiers <code>styles.css</code> et <code>app.js</code> sont liés.</p>
      <button id="compteur">Cliquez ici</button>
    </main>
    <script src="app.js"></script>
  </body>
</html>
`,
  },
  {
    id: 'vue-sfc',
    label: 'Composant Vue (SFC)',
    fileName: 'Composant.vue',
    description: 'Composition API, script setup typé',
    content: `<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{ titre: string }>();
const compteur = ref(0);
const resume = computed(() => \`\${props.titre} (\${compteur.value})\`);
</script>

<template>
  <section class="composant">
    <h2>{{ resume }}</h2>
    <button @click="compteur++">Incrémenter</button>
  </section>
</template>

<style scoped>
.composant {
  padding: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
}
</style>
`,
  },
  {
    id: 'node-server',
    label: 'Serveur Node / Express',
    fileName: 'serveur.js',
    description: 'API minimale avec gestion d’erreurs',
    content: `import express from 'express';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());

app.get('/api/sante', (_requete, reponse) => {
  reponse.json({ statut: 'ok', horodatage: new Date().toISOString() });
});

app.post('/api/echo', (requete, reponse) => {
  reponse.status(201).json({ recu: requete.body });
});

// Gestionnaire d'erreurs : sans lui, une exception laisse la requête en suspens.
app.use((erreur, _requete, reponse, _suivant) => {
  console.error(erreur);
  reponse.status(500).json({ erreur: 'Erreur interne' });
});

app.listen(PORT, () => {
  console.log(\`Serveur à l'écoute sur http://localhost:\${PORT}\`);
});
`,
  },
  {
    id: 'github-workflow',
    label: 'Workflow GitHub Actions',
    fileName: 'ci.yml',
    description: 'Intégration continue Node : lint, tests, build',
    content: `name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verifier:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Installer les dépendances
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Tests
        run: npm test

      - name: Build
        run: npm run build
`,
  },
  {
    id: 'gitignore',
    label: 'Fichier .gitignore',
    fileName: '.gitignore',
    description: 'Node, build, éditeurs, secrets',
    content: `# Dépendances
node_modules/

# Build
dist/
build/
coverage/

# Secrets, ne jamais commiter
.env
.env.local
*.local

# Journaux
*.log
npm-debug.log*

# Éditeurs et systèmes
.vscode/*
!.vscode/extensions.json
.idea/
.DS_Store
Thumbs.db
`,
  },
  {
    id: 'vitest-spec',
    label: 'Test unitaire (Vitest)',
    fileName: 'module.test.ts',
    description: 'Cas nominal, cas limite et cas d’erreur',
    content: `import { describe, expect, it } from 'vitest';

/** Fonction sous test, à remplacer par un import réel. */
const additionner = (a: number, b: number): number => a + b;

describe('additionner', () => {
  it('additionne deux nombres', () => {
    expect(additionner(2, 3)).toBe(5);
  });

  it('gère les valeurs négatives', () => {
    expect(additionner(-2, -3)).toBe(-5);
  });

  it('reste exact aux limites', () => {
    expect(additionner(Number.MAX_SAFE_INTEGER, 0)).toBe(Number.MAX_SAFE_INTEGER);
  });
});
`,
  },
  {
    id: 'html5',
    label: 'Page HTML5',
    fileName: 'page.html',
    description: 'Document complet, prêt pour l’aperçu',
    content: `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Nouvelle page</title>
    <style>
      body {
        font-family: system-ui, sans-serif;
        margin: 0;
        display: grid;
        place-items: center;
        min-height: 100vh;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Bonjour</h1>
      <p>Modifiez ce fichier : l’aperçu se met à jour tout seul.</p>
    </main>
    <script>
      console.log('Page chargée');
    </script>
  </body>
</html>
`,
  },
  {
    id: 'react-component',
    label: 'Composant React (TSX)',
    fileName: 'Composant.tsx',
    description: 'Composant fonctionnel typé',
    content: `interface ComposantProps {
  titre: string;
  children?: React.ReactNode;
}

const Composant = ({ titre, children }: ComposantProps) => {
  return (
    <section>
      <h2>{titre}</h2>
      {children}
    </section>
  );
};

export default Composant;
`,
  },
  {
    id: 'typescript-module',
    label: 'Module TypeScript',
    fileName: 'module.ts',
    description: 'Module avec type exporté et fonction',
    content: `export interface Options {
  verbeux?: boolean;
}

export const executer = (entree: string, options: Options = {}): string => {
  if (options.verbeux) console.log('Traitement de', entree);
  return entree.trim();
};
`,
  },
  {
    id: 'python-script',
    label: 'Script Python',
    fileName: 'script.py',
    description: 'Script avec point d’entrée',
    content: `"""Description du script."""


def principal() -> None:
    print("Bonjour")


if __name__ == "__main__":
    principal()
`,
  },
  {
    id: 'markdown-doc',
    label: 'Document Markdown',
    fileName: 'document.md',
    description: 'Structure de base avec titres et tableau',
    content: `# Titre du document

Courte introduction.

## Section

- Premier point
- Deuxième point

## Références

| Nom | Valeur |
|-----|--------|
| Exemple | 42 |
`,
  },
  {
    id: 'json-config',
    label: 'Configuration JSON',
    fileName: 'config.json',
    description: 'Objet de configuration',
    content: `{
  "nom": "mon-projet",
  "version": "1.0.0",
  "options": {
    "actif": true,
    "limite": 10
  }
}
`,
  },
  {
    id: 'css-styles',
    label: 'Feuille de styles',
    fileName: 'styles.css',
    description: 'Variables et mise en page de base',
    content: `:root {
  --couleur-fond: #ffffff;
  --couleur-texte: #1a1a1a;
  --espacement: 1rem;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: var(--espacement);
  background: var(--couleur-fond);
  color: var(--couleur-texte);
  font-family: system-ui, sans-serif;
}
`,
  },
  {
    id: 'sql-schema',
    label: 'Schéma SQL',
    fileName: 'schema.sql',
    description: 'Création de table avec index',
    content: `CREATE TABLE utilisateur (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  cree_le TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_utilisateur_email ON utilisateur (email);
`,
  },
];

export const getTemplate = (id: string): FileTemplate | undefined =>
  FILE_TEMPLATES.find((template) => template.id === id);
