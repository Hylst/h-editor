import { describe, expect, it } from 'vitest';
import { injectConsoleBridge, parseConsoleMessage, PREVIEW_CHANNEL } from './previewConsole';

describe('injectConsoleBridge', () => {
  it('insère le pont juste après <head>', () => {
    const result = injectConsoleBridge('<!doctype html><html><head><title>x</title></head><body></body></html>');
    expect(result.indexOf('<script>')).toBeGreaterThan(result.indexOf('<head>'));
    expect(result.indexOf('<script>')).toBeLessThan(result.indexOf('<title>'));
  });

  it('se rabat sur <html> quand <head> est absent', () => {
    const result = injectConsoleBridge('<html><body>bonjour</body></html>');
    expect(result.indexOf('<script>')).toBeGreaterThan(result.indexOf('<html>'));
    expect(result.indexOf('<script>')).toBeLessThan(result.indexOf('<body>'));
  });

  it('accepte un fragment sans structure', () => {
    // Document en cours d'écriture : le pont doit quand même être présent.
    const result = injectConsoleBridge('<p>fragment</p>');
    expect(result).toContain('<script>');
    expect(result).toContain('<p>fragment</p>');
  });

  it('produit une balise de script correctement fermée', () => {
    const result = injectConsoleBridge('<html></html>');
    const ouvertures = result.match(/<script>/g) ?? [];
    const fermetures = result.match(/<\/script>/g) ?? [];
    expect(ouvertures).toHaveLength(1);
    expect(fermetures).toHaveLength(1);
  });

  it('préserve le contenu de l’utilisateur', () => {
    const source = '<html><head></head><body><h1>Titre</h1><script>console.log(1);</script></body></html>';
    const result = injectConsoleBridge(source);
    expect(result).toContain('<h1>Titre</h1>');
    expect(result).toContain('console.log(1);');
  });
});

describe('pont d’évaluation', () => {
  it('installe un récepteur d’expressions', () => {
    const html = injectConsoleBridge('<html><head></head></html>');
    expect(html).toContain('editorx-preview-eval');
    expect(html).toContain('eval');
  });

  it('n’accepte que les messages du parent', () => {
    // Sans cette garde, n'importe quel cadre pourrait exécuter du code.
    expect(injectConsoleBridge('<html></html>')).toContain('event.source !== parent');
  });

  it('gère les promesses renvoyées par une expression', () => {
    expect(injectConsoleBridge('<html></html>')).toContain('Promise en attente');
  });
});

describe('parseConsoleMessage', () => {
  const valide = { channel: PREVIEW_CHANNEL, level: 'log', text: 'bonjour' };

  it('accepte un message du bon canal', () => {
    expect(parseConsoleMessage(valide)).toEqual({ level: 'log', text: 'bonjour' });
  });

  it('rejette un message d’un autre canal', () => {
    // Une extension ou un autre cadre peut poster n'importe quoi.
    expect(parseConsoleMessage({ ...valide, channel: 'autre-chose' })).toBeNull();
  });

  it('rejette un niveau inconnu', () => {
    expect(parseConsoleMessage({ ...valide, level: 'exec' })).toBeNull();
  });

  it('rejette un texte non textuel', () => {
    expect(parseConsoleMessage({ ...valide, text: { méchant: true } })).toBeNull();
    expect(parseConsoleMessage(null)).toBeNull();
    expect(parseConsoleMessage('chaîne')).toBeNull();
  });

  it('tronque un message démesuré', () => {
    const result = parseConsoleMessage({ ...valide, text: 'x'.repeat(5000) });
    expect(result!.text.length).toBeLessThanOrEqual(2001);
    expect(result!.text.endsWith('…')).toBe(true);
  });

  it('accepte tous les niveaux prévus', () => {
    for (const level of ['log', 'info', 'warn', 'error', 'debug', 'input', 'result']) {
      expect(parseConsoleMessage({ ...valide, level })).not.toBeNull();
    }
  });
});
