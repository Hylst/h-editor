import { describe, expect, it } from 'vitest';
import { canPreview, renderMarkdown, sanitizeHtml } from './markdown';

describe('renderMarkdown', () => {
  it('rend le Markdown normalement', () => {
    const html = renderMarkdown('# Titre\n\n- un\n- deux');
    expect(html).toContain('<h1>Titre</h1>');
    expect(html).toContain('<li>un</li>');
  });

  it('neutralise les scripts injectés (XSS via fichier importé)', () => {
    const html = renderMarkdown('<script>window.__pwned = true;</script>\n\nTexte');
    expect(html).not.toContain('<script');
    expect(html).toContain('Texte');
  });

  it('supprime les gestionnaires d’événements inline', () => {
    const html = renderMarkdown('<img src="x" onerror="window.__pwned = true">');
    expect(html).not.toContain('onerror');
  });

  it('ne produit jamais de lien javascript:', () => {
    // markdown-it refuse déjà de créer le lien : le texte reste inerte,
    // ce qui compte est l'absence d'attribut href exécutable.
    const html = renderMarkdown('[clic](javascript:alert(1))');
    expect(html).not.toMatch(/href\s*=\s*["']?javascript:/i);

    const injected = sanitizeHtml('<a href="javascript:alert(1)">clic</a>');
    expect(injected).not.toMatch(/href\s*=\s*["']?javascript:/i);
  });

  it('bloque les iframes', () => {
    const html = renderMarkdown('<iframe src="https://exemple.test"></iframe>');
    expect(html).not.toContain('<iframe');
  });

  it('sécurise les liens externes', () => {
    const html = renderMarkdown('[site](https://exemple.test)');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('target="_blank"');
  });

  it('conserve le HTML inoffensif', () => {
    expect(renderMarkdown('<strong>gras</strong>')).toContain('<strong>gras</strong>');
  });
});

describe('sanitizeHtml', () => {
  it('retire le script mais garde la structure', () => {
    const html = sanitizeHtml('<div><p>ok</p><script>alert(1)</script></div>');
    expect(html).toContain('<p>ok</p>');
    expect(html).not.toContain('script');
  });
});

describe('canPreview', () => {
  it('cible le Markdown et le HTML', () => {
    expect(canPreview('markdown')).toBe(true);
    expect(canPreview('html')).toBe(true);
    expect(canPreview('typescript')).toBe(false);
  });
});
