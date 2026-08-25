/**
 * Rendu Markdown et HTML sécurisé pour le panneau d'aperçu.
 *
 * `markdown-it` est configuré avec `html: true` (les documents contiennent
 * souvent du HTML inline) : le résultat DOIT donc être désinfecté avant d'être
 * injecté via `dangerouslySetInnerHTML`. Sans cela, un fichier `.md` reçu par
 * import ZIP/JSON pourrait exécuter du script dans l'origine de l'application,
 * et donc lire tout le projet de l'utilisateur.
 */

import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
});

type PurifyConfig = Parameters<typeof DOMPurify.sanitize>[1];

const PURIFY_CONFIG: PurifyConfig = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed'],
  FORBID_ATTR: ['style', 'srcset', 'formaction'],
  ALLOW_DATA_ATTR: false,
  RETURN_TRUSTED_TYPE: false,
};

// Les liens externes s'ouvrent dans un nouvel onglet, sans fuite de `window.opener`.
//
// Hors contexte DOM (Web Worker, rendu serveur, test Node), DOMPurify se réduit
// à un objet sans `addHook` : l'appel direct faisait planter le simple *import*
// du module. On s'abstient plutôt que de casser l'application entière.
if (typeof DOMPurify.addHook === 'function') {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node instanceof HTMLElement && node.tagName === 'A' && node.getAttribute('href')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  });
}

export const renderMarkdown = (content: string): string =>
  String(DOMPurify.sanitize(md.render(content), PURIFY_CONFIG));

export const sanitizeHtml = (content: string): string =>
  String(DOMPurify.sanitize(content, PURIFY_CONFIG));

/** Langages disposant d'un aperçu dans le panneau latéral. */
export const PREVIEWABLE_LANGUAGES = ['markdown', 'html'] as const;

export const canPreview = (language: string): boolean =>
  (PREVIEWABLE_LANGUAGES as readonly string[]).includes(language);
