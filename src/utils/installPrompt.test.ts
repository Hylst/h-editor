import { describe, expect, it } from 'vitest';
import { shouldShowInstallButton } from './installPrompt';

describe('shouldShowInstallButton', () => {
  it('affiche le bouton quand l’événement est capturé et que l’app n’est pas installée', () => {
    expect(
      shouldShowInstallButton({ hasDeferredPrompt: true, standaloneDisplayMode: false, iosStandalone: false })
    ).toBe(true);
  });

  it('n’affiche pas le bouton quand aucun événement n’est capturé', () => {
    expect(
      shouldShowInstallButton({ hasDeferredPrompt: false, standaloneDisplayMode: false, iosStandalone: false })
    ).toBe(false);
  });

  it('n’affiche pas le bouton quand l’app tourne en mode standalone (display-mode)', () => {
    expect(
      shouldShowInstallButton({ hasDeferredPrompt: true, standaloneDisplayMode: true, iosStandalone: false })
    ).toBe(false);
  });

  it('n’affiche pas le bouton quand l’app est installée sous iOS (navigator.standalone)', () => {
    expect(
      shouldShowInstallButton({ hasDeferredPrompt: true, standaloneDisplayMode: false, iosStandalone: true })
    ).toBe(false);
  });

  it('reste caché quand l’événement est absent même si l’app n’est pas installée', () => {
    expect(
      shouldShowInstallButton({ hasDeferredPrompt: false, standaloneDisplayMode: false, iosStandalone: true })
    ).toBe(false);
  });
});
