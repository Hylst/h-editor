/**
 * Console de l'aperçu HTML.
 *
 * Le document prévisualisé s'exécute dans une iframe `sandbox` **sans**
 * `allow-same-origin` : il ne peut donc pas accéder au stockage d'EditorX, et
 * l'application ne peut pas lire son DOM. Le seul canal possible est
 * `postMessage`, ce que ce module met en place.
 *
 * Le script injecté relaie `console.*` et les erreurs non rattrapées vers la
 * fenêtre parente.
 */

export type ConsoleLevel =
  | 'log'
  | 'info'
  | 'warn'
  | 'error'
  | 'debug'
  /** Expression saisie par l'utilisateur, réaffichée pour le contexte. */
  | 'input'
  /** Résultat de l'évaluation d'une expression. */
  | 'result';

export interface ConsoleEntry {
  id: number;
  level: ConsoleLevel;
  text: string;
  at: number;
}

/** Marqueur du canal : évite de confondre avec un autre `postMessage`. */
export const PREVIEW_CHANNEL = 'editorx-preview-console';

/** Canal des expressions envoyées à la page prévisualisée. */
export const PREVIEW_EVAL_CHANNEL = 'editorx-preview-eval';

/**
 * Script injecté en tête du document prévisualisé.
 *
 * Écrit sans dépendance et sans syntaxe moderne agressive : il s'exécute dans le
 * contexte de l'utilisateur, qui peut cibler d'anciens navigateurs.
 */
// La balise fermante est concaténée : écrite d'un seul tenant, elle refermerait
// prématurément le script si ce fichier venait à être inliné dans une page HTML.
const BRIDGE_SCRIPT = `<script>(function () {
  var CHANNEL = ${JSON.stringify(PREVIEW_CHANNEL)};
  var seq = 0;

  function render(value, depth) {
    depth = depth || 0;
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    var type = typeof value;
    if (type === 'string') return depth === 0 ? value : JSON.stringify(value);
    if (type === 'number' || type === 'boolean' || type === 'bigint') return String(value);
    if (type === 'function') return '[Function ' + (value.name || 'anonyme') + ']';
    if (value instanceof Error) return value.name + ': ' + value.message;
    if (value instanceof Element) return '<' + value.tagName.toLowerCase() + '>';
    if (depth > 2) return '…';
    try {
      if (Array.isArray(value)) {
        return '[' + value.slice(0, 50).map(function (v) { return render(v, depth + 1); }).join(', ') + ']';
      }
      var parts = [];
      for (var key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          parts.push(key + ': ' + render(value[key], depth + 1));
        }
        if (parts.length >= 30) { parts.push('…'); break; }
      }
      return '{ ' + parts.join(', ') + ' }';
    } catch (e) {
      return String(value);
    }
  }

  function send(level, args) {
    try {
      var text = Array.prototype.map.call(args, function (a) { return render(a, 0); }).join(' ');
      parent.postMessage({ channel: CHANNEL, level: level, text: text, seq: seq++ }, '*');
    } catch (e) {
      /* la console ne doit jamais casser la page prévisualisée */
    }
  }

  ['log', 'info', 'warn', 'error', 'debug'].forEach(function (level) {
    var original = console[level];
    console[level] = function () {
      send(level, arguments);
      if (original) original.apply(console, arguments);
    };
  });

  window.addEventListener('error', function (event) {
    send('error', [event.message + ' (' + (event.lineno || 0) + ':' + (event.colno || 0) + ')']);
  });

  window.addEventListener('unhandledrejection', function (event) {
    send('error', ['Promesse rejetée : ' + render(event.reason, 0)]);
  });

  // Console interactive : le parent envoie une expression, on l'évalue ici.
  //
  // \`eval\` est ici légitime : la page s'exécute déjà dans une origine opaque,
  // isolée du stockage de l'éditeur. On n'accepte que les messages du parent.
  window.addEventListener('message', function (event) {
    if (event.source !== parent) return;
    var data = event.data;
    if (!data || data.channel !== 'editorx-preview-eval' || typeof data.code !== 'string') return;

    try {
      // Indirection : évalue dans la portée globale, comme une vraie console.
      var resultat = (0, eval)(data.code);

      if (resultat && typeof resultat.then === 'function') {
        resultat.then(
          function (valeur) { send('result', ['Promise → ' + render(valeur, 0)]); },
          function (erreur) { send('error', [render(erreur, 0)]); }
        );
        send('result', ['Promise en attente…']);
        return;
      }

      send('result', [render(resultat, 0)]);
    } catch (erreur) {
      send('error', [render(erreur, 0)]);
    }
  });
})();</` + `script>`;

/**
 * Insère le pont juste après `<head>`, ou en tête du document si la balise est
 * absente (fragment HTML en cours d'écriture).
 */
export const injectConsoleBridge = (html: string): string => {
  const headMatch = html.match(/<head[^>]*>/i);
  if (headMatch && headMatch.index !== undefined) {
    const at = headMatch.index + headMatch[0].length;
    return html.slice(0, at) + BRIDGE_SCRIPT + html.slice(at);
  }

  const htmlMatch = html.match(/<html[^>]*>/i);
  if (htmlMatch && htmlMatch.index !== undefined) {
    const at = htmlMatch.index + htmlMatch[0].length;
    return html.slice(0, at) + BRIDGE_SCRIPT + html.slice(at);
  }

  return BRIDGE_SCRIPT + html;
};

/** Valide un message reçu de l'iframe avant de l'afficher. */
export const parseConsoleMessage = (data: unknown): Omit<ConsoleEntry, 'id' | 'at'> | null => {
  if (!data || typeof data !== 'object') return null;
  const message = data as Record<string, unknown>;
  if (message.channel !== PREVIEW_CHANNEL) return null;

  const level = message.level;
  const text = message.text;
  if (typeof text !== 'string') return null;

  const niveaux: ConsoleLevel[] = ['log', 'info', 'warn', 'error', 'debug', 'input', 'result'];
  if (!niveaux.includes(level as ConsoleLevel)) return null;

  // Une page peut inonder la console : on tronque les messages démesurés.
  return {
    level: level as ConsoleLevel,
    text: text.length > 2000 ? `${text.slice(0, 2000)}…` : text,
  };
};
