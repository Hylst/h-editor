#!/usr/bin/env node
/**
 * Captures d'écran de démonstration d'H Editor, pour les réseaux sociaux.
 *
 * Usage : npm run build && node scripts/capture-screenshots.mjs
 * Sortie : captures/*.png — bureau 1920x1080 @2x, mobile 390x844 @3x.
 *
 * Le script sert ./dist via `vite preview`, importe un projet de démonstration
 * (dossiers + plusieurs types de fichiers) par l'import JSON de l'application,
 * puis met en scène chaque capture avec l'interface réelle — rien n'est retouché.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'captures');
const PORT = 4173;
const BASE = `http://localhost:${PORT}/app/`;

// ── Projet de démonstration ──────────────────────────────────────────────────
// Un site « champ d'étoiles » (hommage demoscene) + sa version React/TS,
// un outil Python et une config JSON : assez de variété pour chaque capture.

const README = `# Démo — Champ d'étoiles

Un mini-projet d'exemple pour montrer H Editor : plusieurs langages, des dossiers,
et un site testé **sans serveur** grâce à l'aperçu intégré.

## Contenu

| Chemin | Rôle |
|---|---|
| \`site/\` | le site de démo (HTML + CSS + JS liés) |
| \`src/\` | la même idée, version React + TypeScript |
| \`tools/\` | un petit script Python d'atelier |
| \`data/\` | une configuration JSON |

## L'esprit

> Écrire du code partout — dans le train, sur la tablette, au fond du grenier —
> et le retrouver intact à chaque ouverture.

- 40+ langages colorés par Monaco
- Aperçu multi-fichiers avec console interactive
- Sauvegarde locale automatique, hors ligne
`;

const INDEX_HTML = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Champ d'étoiles — démo H Editor</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <main>
      <p class="badge">démo demoscene</p>
      <h1>Champ d'étoiles</h1>
      <p>Écrit dans H Editor, testé sans serveur grâce à l'aperçu intégré.</p>
      <canvas id="ciel" width="680" height="380"></canvas>
    </main>
    <script src="app.js"></script>
  </body>
</html>
`;

const STYLES_CSS = `:root {
  --fond: #080a12;
  --encre: #e2e8f0;
  --accent: #60a5fa;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at 30% 20%, #10182c, var(--fond) 70%);
  color: var(--encre);
  font-family: system-ui, sans-serif;
  text-align: center;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.9rem;
  border: 1px solid var(--accent);
  border-radius: 999px;
  color: var(--accent);
  font-size: 0.8rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

h1 {
  margin: 0.8rem 0 0.4rem;
  font-size: 2.6rem;
  background: linear-gradient(90deg, #60a5fa, #c084fc, #f472b6);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

main p:not(.badge) { color: #94a3b8; margin-bottom: 1.4rem; }

canvas {
  border: 1px solid #1e293b;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(96, 165, 250, 0.15);
}
`;

const APP_JS = `// Starfield minimal — 60 fps ou rien.
const canvas = document.getElementById('ciel');
const ctx = canvas.getContext('2d');
const NB_ETOILES = 220;
const etoiles = [];
for (let i = 0; i < NB_ETOILES; i++) {
  etoiles.push({ x: Math.random(), y: Math.random(), z: Math.random() });
}

function couleur(etoile) {
  const teinte = 195 + Math.floor(etoile.z * 140);
  return 'hsl(' + teinte + ', 90%, ' + (55 + Math.floor(etoile.z * 25)) + '%)';
}

function frame() {
  ctx.fillStyle = 'rgba(8, 10, 18, 0.35)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const etoile of etoiles) {
    etoile.z -= 0.012;
    if (etoile.z <= 0.01) {
      etoile.z = 1;
      etoile.x = Math.random();
      etoile.y = Math.random();
    }
    const k = 0.28 / etoile.z;
    const px = (etoile.x - 0.5) * k * canvas.width + canvas.width / 2;
    const py = (etoile.y - 0.5) * k * canvas.height + canvas.height / 2;
    const taille = (1 - etoile.z) * 3;
    ctx.fillStyle = couleur(etoile);
    ctx.fillRect(px, py, taille, taille);
  }
  requestAnimationFrame(frame);
}

frame();
console.log("Champ d'étoiles prêt — " + NB_ETOILES + ' étoiles en orbite.');
`;

const APP_TSX = `import { useEffect, useRef } from 'react';
import { Starfield } from './components/Starfield';
import { creerMoteur, type Moteur } from './lib/engine';

/**
 * Point d'entrée de la démo : un champ d'étoiles dessiné sur canvas,
 * piloté par le moteur de particules de ./lib/engine.ts.
 */
export default function App() {
  const moteurRef = useRef<Moteur | null>(null);

  useEffect(() => {
    moteurRef.current = creerMoteur({ densite: 220, vitesse: 0.012 });
    moteurRef.current.demarrer();
    return () => moteurRef.current?.arreter();
  }, []);

  return (
    <main className="demo">
      <h1>Champ d'étoiles</h1>
      <Starfield largeur={680} hauteur={380} densite={220} />
    </main>
  );
}
`;

const STARFIELD_TSX = `import { useEffect, useRef } from 'react';

interface StarfieldProps {
  largeur: number;
  hauteur: number;
  densite: number;
}

/** Canvas de particules : chaque étoile fuit vers le spectateur. */
export function Starfield({ largeur, hauteur, densite }: StarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // La boucle d'animation vit dans le moteur (voir lib/engine.ts).
    return () => cancelAnimationFrame(0);
  }, [densite]);

  return <canvas ref={canvasRef} width={largeur} height={hauteur} />;
}
`;

const ENGINE_TS = `// Moteur de particules pour le starfield de la démo.

export interface Etoile {
  x: number;
  y: number;
  z: number;
  teinte: number;
}

export interface Moteur {
  demarrer(): void;
  arreter(): void;
  etoiles(): readonly Etoile[];
}

export interface OptionsMoteur {
  densite: number;
  vitesse: number;
}

/** Crée un moteur de particules minimal — l'esprit démo, sans dépendance. */
export function creerMoteur(options: OptionsMoteur): Moteur {
  const etoiles: Etoile[] = Array.from({ length: options.densite }, () => ({
    x: Math.random(),
    y: Math.random(),
    z: Math.random(),
    teinte: 195 + Math.floor(Math.random() * 140),
  }));

  let image = 0;

  return {
    demarrer() {
      image = requestAnimationFrame(() => undefined);
    },
    arreter() {
      cancelAnimationFrame(image);
    },
    etoiles() {
      return etoiles;
    },
  };
}
`;

const OPTIMISE_PY = `"""Petit outil : repère les images du site à optimiser avant export."""
from pathlib import Path

SEUIL = 40 * 1024  # 40 Ko


def images_lourdes(dossier: str = "site") -> list[Path]:
    """Liste les images dépassant le seuil, prêtes à être compressées."""
    suffixes = {".png", ".jpg", ".jpeg"}
    return [
        p
        for p in Path(dossier).glob("**/*")
        if p.suffix.lower() in suffixes and p.stat().st_size > SEUIL
    ]


if __name__ == "__main__":
    for image in images_lourdes():
        print(f"{image} dépasse {SEUIL // 1024} Ko")
    print("Vérification terminée.")
`;

const CONFIG_JSON = `{
  "editeur": {
    "taillePolice": 14,
    "tabulation": 2,
    "retourLigne": true
  },
  "apercu": {
    "format": "bureau",
    "console": true
  },
  "demoscene": {
    "hommage": true,
    "palette": ["#60a5fa", "#c084fc", "#f472b6"]
  }
}
`;

const PROJET = {
  version: 2,
  files: [
    { id: 'f1', name: 'README.md', language: 'markdown', content: README, parentId: undefined },
    { id: 'f2', name: 'index.html', language: 'html', content: INDEX_HTML, parentId: 'd1' },
    { id: 'f3', name: 'styles.css', language: 'css', content: STYLES_CSS, parentId: 'd1' },
    { id: 'f4', name: 'app.js', language: 'javascript', content: APP_JS, parentId: 'd1' },
    { id: 'f5', name: 'App.tsx', language: 'typescript', content: APP_TSX, parentId: 'd2' },
    { id: 'f6', name: 'Starfield.tsx', language: 'typescript', content: STARFIELD_TSX, parentId: 'd3' },
    { id: 'f7', name: 'engine.ts', language: 'typescript', content: ENGINE_TS, parentId: 'd4' },
    { id: 'f8', name: 'optimise.py', language: 'python', content: OPTIMISE_PY, parentId: 'd5' },
    { id: 'f9', name: 'config.json', language: 'json', content: CONFIG_JSON, parentId: 'd6' },
  ],
  folders: [
    { id: 'd1', name: 'site', expanded: true },
    { id: 'd2', name: 'src', expanded: true },
    { id: 'd3', name: 'components', parentId: 'd2', expanded: true },
    { id: 'd4', name: 'lib', parentId: 'd2', expanded: true },
    { id: 'd5', name: 'tools', expanded: true },
    { id: 'd6', name: 'data', expanded: true },
  ],
};

// ── Aides ────────────────────────────────────────────────────────────────────

async function attendreServeur() {
  for (let i = 0; i < 80; i++) {
    try {
      const reponse = await fetch(BASE);
      if (reponse.ok) return;
    } catch {
      // pas encore prêt
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('vite preview ne répond pas sur ' + BASE);
}

async function importerProjet(page) {
  await page.locator('input[accept=".json"]').setInputFiles({
    name: 'projet-demo.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(PROJET, null, 2), 'utf8'),
  });
  await page.getByRole('treeitem', { name: /App\.tsx/ }).waitFor({ state: 'visible' });
  // La notification d'import reste 10 s : on la laisse partir pour ne pas
  // la retrouver au bas des captures.
  await page.waitForFunction(
    () => document.querySelectorAll('[data-sonner-toast]').length === 0,
    undefined,
    { timeout: 20000 },
  );
}

async function ouvrirFichier(page, motif, onglet) {
  await page.keyboard.press('Control+p');
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible' });
  await dialog.getByPlaceholder('Nom du fichier…').fill(motif);
  // Attendre que le filtre ait produit la cible, puis valider : Enter immédiat
  // peut fermer la boîte avant que la liste ne soit filtrée.
  await dialog.getByRole('option', { name: new RegExp(onglet) }).first().waitFor({ state: 'visible' });
  await page.keyboard.press('Enter');
  await page.getByRole('tab', { name: new RegExp(onglet) }).waitFor({ state: 'visible' });
  await page.waitForTimeout(600); // Monaco se remonte à chaque changement de fichier
}

// ── Captures ─────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(OUT, { recursive: true });
  const serveur = spawn(
    process.execPath,
    [
      join(root, 'node_modules', 'vite', 'bin', 'vite.js'),
      'preview',
      '--port',
      String(PORT),
      '--strictPort',
    ],
    {
      cwd: root,
      stdio: 'inherit',
    },
  );

  // Garde-fou : si quelque chose se bloque, on quitte visiblement au bout de 3 min.
  const watchdog = setTimeout(() => {
    console.error('TIMEOUT GLOBAL — abandon des captures.');
    serveur.kill();
    process.exit(2);
  }, 180_000);
  watchdog.unref();

  try {
    console.log('Demarrage de vite preview sur le port ' + PORT + '...');
    await attendreServeur();
    console.log('Serveur pret. Lancement de Chromium...');
    const navigateur = await chromium.launch();
    console.log('Chromium lance.');

    // ── Bureau 1920x1080 @2x ──────────────────────────────────────────────
    const bureau = await navigateur.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2,
    });
    const page = await bureau.newPage();
    await page.goto(BASE);
    await page.locator('.monaco-editor').first().waitFor({ state: 'visible' });
    await importerProjet(page);

    // 01 — Vue d'ensemble : explorateur (dossiers + types variés), App.tsx
    //      ouvert, trois onglets, barre d'état complète.
    await ouvrirFichier(page, 'App.tsx', 'App\\.tsx');
    await ouvrirFichier(page, 'engine.ts', 'engine\\.ts');
    await ouvrirFichier(page, 'config', 'config\\.json');
    await page.getByRole('tab', { name: /App\.tsx/ }).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(OUT, '01-vue-ensemble.png') });
    console.log('OK 01-vue-ensemble.png');

    // 02 — Aperçu Markdown : README.md rendu à côté du source.
    await ouvrirFichier(page, 'README', 'README\\.md');
    await page.getByRole('button', { name: "Afficher l'aperçu" }).click();
    await page.locator('.prose h1').first().waitFor({ state: 'visible' });
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, '02-apercu-markdown.png') });
    console.log('OK 02-apercu-markdown.png');

    // 03 — Aperçu de site multi-fichiers : index.html + rendu du starfield
    //      (styles et script liés assemblés en mémoire), console remontée.
    await ouvrirFichier(page, 'index.html', 'index\\.html');
    await page.waitForTimeout(1200); // laisser le canvas peindre ses premières étoiles
    await page.screenshot({ path: join(OUT, '03-apercu-site.png') });
    console.log('OK 03-apercu-site.png');
    await page.getByRole('button', { name: "Masquer l'aperçu" }).click();

    // 04 — Recherche globale : résultats surlignés dans plusieurs fichiers.
    await page.keyboard.press('Control+Shift+F');
    await page.getByRole('textbox', { name: 'Terme à rechercher' }).fill('starfield');
    await page.getByRole('button', { name: /^L\d+/ }).first().waitFor({ state: 'visible' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, '04-recherche-globale.png') });
    console.log('OK 04-recherche-globale.png');
    await page.getByRole('button', { name: 'Fermer la recherche' }).click();

    // 05 — Vue divisée : deux fichiers côte à côte (Starfield.tsx + App.tsx).
    //      En mode divisé, les panneaux affichent leur en-tête propre (pas d'onglets).
    await page.keyboard.press('Control+\\');
    await page.getByRole('region', { name: /Panneau/ }).first().waitFor({ state: 'visible' });
    await page.keyboard.press('Control+p');
    const dialogDivisee = page.getByRole('dialog');
    await dialogDivisee.getByPlaceholder('Nom du fichier…').fill('Starfield');
    await dialogDivisee.getByRole('option', { name: /Starfield\.tsx/ }).first().waitFor({ state: 'visible' });
    await page.keyboard.press('Enter');
    await page
      .getByRole('region', { name: /Panneau/ })
      .getByText('Starfield.tsx', { exact: true })
      .first()
      .waitFor({ state: 'visible' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT, '05-vue-divisee.png') });
    console.log('OK 05-vue-divisee.png');
    await bureau.close();

    // ── Mobile 390x844 @3x (Pixel 7) ──────────────────────────────────────
    const mobile = await navigateur.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const pageM = await mobile.newPage();
    await pageM.goto(BASE);
    await pageM.locator('.monaco-editor').first().waitFor({ state: 'visible' });
    // Sur écran étroit l'explorateur démarre replié : on l'ouvre pour importer,
    // puis on le referme — la capture montre l'éditeur pleine largeur.
    await pageM.getByRole('button', { name: "Afficher l'explorateur" }).click();
    await importerProjet(pageM);
    // Deux boutons portent ce nom (barre d'outils + explorateur) : on vise celui du bandeau.
    await pageM
      .getByRole('banner')
      .getByRole('button', { name: "Masquer l'explorateur" })
      .click();
    await ouvrirFichier(pageM, 'App.tsx', 'App\\.tsx');
    await pageM.waitForTimeout(500);
    await pageM.screenshot({ path: join(OUT, '06-mobile.png') });
    console.log('OK 06-mobile.png');
    await mobile.close();

    await navigateur.close();
    console.log('\nCaptures prêtes dans captures/.');
  } finally {
    serveur.kill();
  }
}

main().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});



