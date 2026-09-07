/**
 * Assemblage d'un site multi-fichiers en un document autonome.
 *
 * H Editor n'a pas de serveur, et l'aperçu s'exécute dans une iframe `sandbox`
 * **sans** `allow-same-origin` : son origine est opaque, ce qui garantit qu'une
 * page prévisualisée ne peut pas lire le stockage de l'éditeur. Cette isolation
 * interdit deux approches qu'on choisirait spontanément (vérifié par essais) :
 *
 * - un **service worker** ne contrôle pas un document d'origine opaque ;
 * - les **`blob:` URL** appartiennent à l'origine créatrice et sont donc bloquées.
 *
 * Restent disponibles : le contenu inline, les `data:` URI, les *import maps*,
 * et les shims `fetch`/`XMLHttpRequest`. C'est sur eux que repose ce module :
 * plutôt qu'un serveur, on construit un **serveur virtuel en mémoire**.
 *
 * Ce fichier est une transformation pure (`files` → chaîne HTML) : il se teste
 * intégralement sans navigateur.
 */

import type { EditorFile, EditorFolder } from '@/types/editor';

/**
 * Ressource référencée mais introuvable.
 *
 * Structurée plutôt qu'en simple message : l'interface doit pouvoir ouvrir le
 * fichier fautif d'un clic, ce qu'une chaîne libre ne permet pas.
 */
export interface MissingResource {
  /** Référence telle qu'écrite par l'utilisateur (`./styles.css`). */
  reference: string;
  /** Chemin du fichier qui contient cette référence. */
  sourcePath: string;
  /** Nature de la ressource, pour l'affichage. */
  kind: 'stylesheet' | 'script' | 'module' | 'asset';
}

export interface AssembledSite {
  /** Document complet, prêt pour `srcDoc`. */
  html: string;
  /** Ressources référencées mais introuvables, signalées à l'utilisateur. */
  missing: MissingResource[];
  /** Chemin du fichier servant de point d'entrée. */
  entryPath: string;
}

/** Au-delà, l'assemblage est refusé : le document deviendrait ingérable. */
export const MAX_ASSEMBLED_BYTES = 12 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  pdf: 'application/pdf',
  json: 'application/json',
  txt: 'text/plain',
  css: 'text/css',
  js: 'text/javascript',
};

const mimeFor = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[ext] ?? 'application/octet-stream';
};

/**
 * Neutralise la séquence qui refermerait prématurément la balise `<script>`
 * ou `<style>` dans laquelle le contenu est injecté.
 *
 * Sans cela, un simple `const s = "</script>"` dans le code de l'utilisateur
 * casserait tout le document assemblé.
 */
const escapeForInlineTag = (code: string): string =>
  code.replace(/<\/(script|style)\b/gi, '<\\/$1');

/**
 * `data:` URI en UTF-8 pourcent-encodé.
 *
 * `btoa` lève une exception sur le moindre caractère non-ASCII : un accent dans
 * un commentaire suffirait à faire échouer l'assemblage.
 */
const toDataUri = (content: string, mime: string): string =>
  `data:${mime};charset=utf-8,${encodeURIComponent(content)}`;

const toBase64DataUri = (base64: string, mime: string): string => `data:${mime};base64,${base64}`;

/** Chemin complet d'un fichier dans l'arborescence du projet. */
export const buildFilePath = (
  file: EditorFile,
  folders: EditorFolder[]
): string => {
  const parts: string[] = [file.name];
  let cursor = file.parentId;
  const guard = new Set<string>();

  while (cursor && !guard.has(cursor)) {
    guard.add(cursor);
    const folder = folders.find((f) => f.id === cursor);
    if (!folder) break;
    parts.unshift(folder.name);
    cursor = folder.parentId;
  }

  return parts.join('/');
};

/**
 * Normalise un chemin relatif à partir du dossier d'un fichier.
 * `resolvePath('src/pages/index.html', '../styles/app.css')` → `src/styles/app.css`
 */
export const resolvePath = (fromPath: string, reference: string): string => {
  // Une ressource externe ou déjà encodée n'a pas à être résolue.
  const cleaned = reference.split('#')[0].split('?')[0].trim();
  if (!cleaned) return '';

  const base = cleaned.startsWith('/')
    ? []
    : fromPath.split('/').slice(0, -1);

  const segments = cleaned.replace(/^\//, '').split('/');
  const stack = [...base];

  for (const segment of segments) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') stack.pop();
    else stack.push(segment);
  }

  return stack.join('/');
};

/** Une référence pointe-t-elle vers l'extérieur (ou est-elle déjà inline) ? */
export const isExternalReference = (reference: string): boolean =>
  /^(https?:|data:|blob:|mailto:|tel:|#|\/\/)/i.test(reference.trim());

interface PathIndex {
  byPath: Map<string, EditorFile>;
}

const buildIndex = (files: EditorFile[], folders: EditorFolder[]): PathIndex => {
  const byPath = new Map<string, EditorFile>();
  for (const file of files) byPath.set(buildFilePath(file, folders), file);
  return { byPath };
};

/** Extrait les spécificateurs d'import statiques d'un module ES. */
export const extractImports = (code: string): string[] => {
  const found = new Set<string>();
  const patterns = [
    /\bimport\s+[^'"]*from\s*['"]([^'"]+)['"]/g, // import x from '…'
    /\bimport\s*['"]([^'"]+)['"]/g, // import '…'
    /\bexport\s+[^'"]*from\s*['"]([^'"]+)['"]/g, // export … from '…'
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // import('…')
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(code)) !== null) found.add(match[1]);
  }

  return [...found];
};

/**
 * Construit récursivement les `data:` URI des modules, et la carte d'import qui
 * permet à l'utilisateur d'écrire `import './util.js'` sans rien changer.
 */
const buildModuleGraph = (
  entryPath: string,
  index: PathIndex,
  missing: MissingResource[]
): Record<string, string> => {
  const uriByPath = new Map<string, string>();
  const visiting = new Set<string>();

  const build = (path: string): string | null => {
    const cached = uriByPath.get(path);
    if (cached) return cached;

    // Un cycle d'import ne doit pas provoquer de récursion infinie : les
    // modules ES les tolèrent, on renvoie le module tel quel.
    if (visiting.has(path)) {
      const file = index.byPath.get(path);
      return file ? toDataUri(file.content, 'text/javascript') : null;
    }

    const file = index.byPath.get(path);
    if (!file || file.binary) return null;

    visiting.add(path);
    let code = file.content;

    for (const specifier of extractImports(code)) {
      if (isExternalReference(specifier)) continue;

      const target = resolveModulePath(path, specifier, index);
      if (!target) {
        missing.push({ reference: specifier, sourcePath: path, kind: 'module' });
        continue;
      }

      const uri = build(target);
      if (!uri) continue;

      // On réécrit le spécificateur directement : plus fiable qu'une carte
      // d'import pour les chemins relatifs, qui y sont mal supportés.
      code = code.replace(
        new RegExp(`(['"])${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1`, 'g'),
        `"${uri}"`
      );
    }

    visiting.delete(path);
    const dataUri = toDataUri(code, 'text/javascript');
    uriByPath.set(path, dataUri);
    return dataUri;
  };

  const entryUri = build(entryPath);
  return entryUri ? { [entryPath]: entryUri } : {};
};

/** Résout un spécificateur de module, en essayant les extensions usuelles. */
const resolveModulePath = (
  fromPath: string,
  specifier: string,
  index: PathIndex
): string | null => {
  const base = resolvePath(fromPath, specifier);
  const candidates = [base, `${base}.js`, `${base}.mjs`, `${base}/index.js`];

  for (const candidate of candidates) {
    if (index.byPath.has(candidate)) return candidate;
  }
  return null;
};

/** Remplace les `url(...)` d'une feuille de styles par des `data:` URI. */
const inlineCssUrls = (
  css: string,
  cssPath: string,
  index: PathIndex,
  missing: MissingResource[]
): string =>
  // `_quote` : groupe positionnel obligatoire du callback replace ; la sortie
  // normalise toujours les guillemets en `"`, il n'est donc jamais lu.
  css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (whole, _quote, reference: string) => {
    if (isExternalReference(reference)) return whole;

    const target = resolvePath(cssPath, reference);
    const file = index.byPath.get(target);
    if (!file) {
      missing.push({ reference, sourcePath: cssPath, kind: 'asset' });
      return whole;
    }

    const uri = file.binary
      ? toBase64DataUri(file.content, mimeFor(target))
      : toDataUri(file.content, mimeFor(target));
    return `url("${uri}")`;
  });

/**
 * Sérialise des données pour une injection sûre dans une balise `<script>`.
 *
 * `JSON.stringify` échappe les guillemets, mais **pas** `</script>` : un fichier
 * du projet contenant cette séquence refermerait la balise et casserait la page
 * (défaut détecté par le test « neutralise une balise fermante »).
 */
const toInlineJson = (value: unknown): string =>
  JSON.stringify(value).replace(
    // Chevrons et separateurs de ligne Unicode : les premiers refermeraient la
    // balise, les seconds sont des fins d instruction en JavaScript.
    /[<>\u2028\u2029]/g,
    (caractere) => '\\u' + caractere.charCodeAt(0).toString(16).padStart(4, '0')
  );

/** Shims permettant à `fetch` et `XMLHttpRequest` de servir les fichiers du projet. */
const buildRuntimeShims = (virtualFiles: Record<string, string>): string => {
  const table = toInlineJson(virtualFiles);

  return `<script>(function () {
  var FICHIERS = ${table};

  function normaliser(u) {
    try { u = String(u); } catch (e) { return ''; }
    return u.replace(/^\\.\\//, '').replace(/^\\//, '').split('?')[0].split('#')[0];
  }

  var vraiFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (entree, options) {
    var url = normaliser(entree && entree.url ? entree.url : entree);
    if (Object.prototype.hasOwnProperty.call(FICHIERS, url)) {
      var type = /\\.json$/.test(url) ? 'application/json'
        : /\\.css$/.test(url) ? 'text/css'
        : /\\.html?$/.test(url) ? 'text/html' : 'text/plain';
      return Promise.resolve(new Response(FICHIERS[url], {
        status: 200, headers: { 'content-type': type + '; charset=utf-8' }
      }));
    }
    if (!vraiFetch) return Promise.reject(new Error('Ressource introuvable : ' + url));
    return vraiFetch(entree, options);
  };

  var VraiXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function () {
    var xhr = new VraiXHR();
    var ouvrir = xhr.open.bind(xhr);
    var envoyer = xhr.send.bind(xhr);
    var cible = '';

    xhr.open = function (methode, url) {
      cible = normaliser(url);
      return ouvrir.apply(null, arguments);
    };

    xhr.send = function () {
      if (Object.prototype.hasOwnProperty.call(FICHIERS, cible)) {
        var contenu = FICHIERS[cible];
        Object.defineProperty(xhr, 'responseText', { value: contenu, configurable: true });
        Object.defineProperty(xhr, 'response', { value: contenu, configurable: true });
        Object.defineProperty(xhr, 'status', { value: 200, configurable: true });
        Object.defineProperty(xhr, 'readyState', { value: 4, configurable: true });
        setTimeout(function () {
          if (xhr.onreadystatechange) xhr.onreadystatechange();
          if (xhr.onload) xhr.onload();
        }, 0);
        return;
      }
      return envoyer.apply(null, arguments);
    };

    return xhr;
  };
})();</` + `script>`;
};

/** Interception des liens internes : la navigation est relayée à l'application. */
const NAVIGATION_SCRIPT = `<script>(function () {
  document.addEventListener('click', function (event) {
    var lien = event.target && event.target.closest ? event.target.closest('a') : null;
    if (!lien) return;

    // \`lien.href\` renvoie une URL absolue trompeuse en origine opaque :
    // seul l'attribut brut permet de distinguer un lien interne.
    var brut = lien.getAttribute('href') || '';
    if (!brut || /^(https?:|mailto:|tel:|#|\\/\\/)/i.test(brut)) return;

    event.preventDefault();
    parent.postMessage({ channel: 'editorx-preview-navigate', href: brut }, '*');
  });
})();</` + `script>`;

/**
 * Assemble le site à partir du fichier d'entrée.
 *
 * Renvoie toujours un document : une ressource manquante est signalée dans
 * `missing`, jamais fatale — l'utilisateur doit pouvoir prévisualiser un site
 * en cours d'écriture.
 */
export const assembleSite = (
  files: EditorFile[],
  folders: EditorFolder[],
  entryFileId: string
): AssembledSite | null => {
  const entry = files.find((f) => f.id === entryFileId);
  if (!entry) return null;

  const index = buildIndex(files, folders);
  const entryPath = buildFilePath(entry, folders);
  const missing: MissingResource[] = [];

  let html = entry.content;

  // ── Feuilles de styles ────────────────────────────────────────────────────
  html = html.replace(
    /<link\b[^>]*\bhref\s*=\s*(['"])([^'"]+)\1[^>]*>/gi,
    (whole, _quote, reference: string) => {
      if (!/stylesheet/i.test(whole) || isExternalReference(reference)) return whole;

      const target = resolvePath(entryPath, reference);
      const file = index.byPath.get(target);
      if (!file) {
        missing.push({ reference, sourcePath: entryPath, kind: 'stylesheet' });
        return whole;
      }

      const css = inlineCssUrls(file.content, target, index, missing);
      return `<style data-editorx-source="${target}">\n${escapeForInlineTag(css)}\n</style>`;
    }
  );

  // ── Scripts ───────────────────────────────────────────────────────────────
  html = html.replace(
    /<script\b([^>]*)\bsrc\s*=\s*(['"])([^'"]+)\2([^>]*)>\s*<\/script>/gi,
    (whole, avant: string, _quote, reference: string, apres: string) => {
      if (isExternalReference(reference)) return whole;

      const target = resolvePath(entryPath, reference);
      const file = index.byPath.get(target);
      if (!file) {
        missing.push({ reference, sourcePath: entryPath, kind: 'script' });
        return whole;
      }

      const attributs = `${avant} ${apres}`;
      const estModule = /type\s*=\s*(['"])module\1/i.test(attributs);

      if (estModule) {
        // Les imports internes sont réécrits en `data:` URI, récursivement.
        const graph = buildModuleGraph(target, index, missing);
        const uri = graph[target];
        if (uri) return `<script type="module" src="${uri}" data-editorx-source="${target}"></script>`;
      }

      return `<script data-editorx-source="${target}">\n${escapeForInlineTag(file.content)}\n</script>`;
    }
  );

  // ── Images et autres ressources ───────────────────────────────────────────
  html = html.replace(
    /\b(src|href|poster)\s*=\s*(['"])([^'"]+)\2/gi,
    (whole, attribut: string, _quote, reference: string) => {
      if (isExternalReference(reference)) return whole;
      // Les liens vers d'autres pages sont gérés par la navigation, pas ici.
      if (attribut.toLowerCase() === 'href' && /\.html?$/i.test(reference)) return whole;

      const target = resolvePath(entryPath, reference);
      const file = index.byPath.get(target);
      if (!file) return whole;

      const uri = file.binary
        ? toBase64DataUri(file.content, mimeFor(target))
        : toDataUri(file.content, mimeFor(target));
      return `${attribut}="${uri}"`;
    }
  );

  // ── Fichiers servis à `fetch` / `XHR` ─────────────────────────────────────
  const virtualFiles: Record<string, string> = {};
  for (const [path, file] of index.byPath) {
    if (!file.binary && path !== entryPath) virtualFiles[path] = file.content;
  }

  const prelude = buildRuntimeShims(virtualFiles) + NAVIGATION_SCRIPT;

  const headMatch = html.match(/<head[^>]*>/i);
  if (headMatch && headMatch.index !== undefined) {
    const at = headMatch.index + headMatch[0].length;
    html = html.slice(0, at) + prelude + html.slice(at);
  } else {
    html = prelude + html;
  }

  if (html.length > MAX_ASSEMBLED_BYTES) {
    return {
      html:
        '<html><body style="font-family:system-ui;padding:2rem">' +
        '<h1>Aperçu trop volumineux</h1>' +
        '<p>Le document assemblé dépasse 12 Mo. Réduisez la taille des ressources intégrées.</p>' +
        '</body></html>',
      missing,
      entryPath,
    };
  }

  return { html, missing, entryPath };
};

/**
 * Retrouve le fichier contenant une référence introuvable, pour permettre à
 * l'utilisateur de l'ouvrir directement depuis la liste des avertissements.
 */
export const findSourceFile = (
  missing: MissingResource,
  files: EditorFile[],
  folders: EditorFolder[]
): EditorFile | null =>
  files.find((f) => buildFilePath(f, folders) === missing.sourcePath) ?? null;

/** Libellé lisible d'une ressource manquante. */
export const describeMissing = (missing: MissingResource): string => {
  const nature =
    missing.kind === 'stylesheet'
      ? 'feuille de styles'
      : missing.kind === 'script'
        ? 'script'
        : missing.kind === 'module'
          ? 'module'
          : 'ressource';
  return `${missing.reference} — ${nature} introuvable, référencée par ${missing.sourcePath}`;
};

/** Le fichier est-il un point d'entrée plausible pour un aperçu de site ? */
export const isHtmlEntry = (file: EditorFile): boolean =>
  !file.binary && /\.html?$/i.test(file.name);
