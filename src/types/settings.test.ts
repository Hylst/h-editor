import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings } from './settings';

describe('sanitizeSettings', () => {
  it('remplace les valeurs non numériques par la valeur par défaut', () => {
    // Régression : vider le champ « taille de police » enregistrait `fontSize: null`,
    // et Monaco devenait illisible au rechargement.
    expect(sanitizeSettings({ fontSize: null }).fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    expect(sanitizeSettings({ fontSize: NaN }).fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    expect(sanitizeSettings({ fontSize: '' }).fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    expect(sanitizeSettings({ tabSize: undefined }).tabSize).toBe(DEFAULT_SETTINGS.tabSize);
  });

  it('borne les valeurs extrêmes', () => {
    expect(sanitizeSettings({ fontSize: 900 }).fontSize).toBe(40);
    expect(sanitizeSettings({ fontSize: -5 }).fontSize).toBe(8);
    expect(sanitizeSettings({ tabSize: 99 }).tabSize).toBe(8);
    expect(sanitizeSettings({ autoSave: { interval: 10 } }).autoSave.interval).toBe(1000);
  });

  it('complète les réglages d’une version antérieure', () => {
    const legacy = { theme: 'vs-dark', fontSize: 16 };
    const result = sanitizeSettings(legacy);
    expect(result.fontSize).toBe(16);
    expect(result.insertSpaces).toBe(DEFAULT_SETTINGS.insertSpaces);
    expect(result.previewVisible).toBe(DEFAULT_SETTINGS.previewVisible);
    expect(result.uiTheme).toBe(DEFAULT_SETTINGS.uiTheme);
  });

  it('rejette les valeurs hors énumération', () => {
    expect(sanitizeSettings({ theme: 'dracula' }).theme).toBe(DEFAULT_SETTINGS.theme);
    expect(sanitizeSettings({ wordWrap: 'maybe' }).wordWrap).toBe(DEFAULT_SETTINGS.wordWrap);
  });

  it('survit à une entrée totalement invalide', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('corrompu')).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings(42)).toEqual(DEFAULT_SETTINGS);
  });
});
