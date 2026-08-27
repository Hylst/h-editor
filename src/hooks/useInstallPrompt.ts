import { useCallback, useEffect, useState } from 'react';
import { shouldShowInstallButton } from '@/utils/installPrompt';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Lecture tolérante de l'état « standalone » (mode installé), sans lever en l'absence de matchMedia. */
const readStandaloneState = (): { standaloneDisplayMode: boolean; iosStandalone: boolean } => {
  const standaloneDisplayMode =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)').matches
      : false;
  const iosStandalone =
    typeof window !== 'undefined' && (window.navigator as { standalone?: boolean }).standalone === true;
  return { standaloneDisplayMode, iosStandalone };
};

/**
 * Capture l'événement `beforeinstallprompt` du navigateur et expose
 * une fonction `install()` pour déclencher le prompt d'installation PWA.
 *
 * Le bouton n'apparaît que si le navigateur supporte l'installation
 * (événement émis) ET que l'application n'est pas déjà installée.
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      // `preventDefault` est requis pour pouvoir déclencher le prompt plus tard
      // (sinon le navigateur ne le propose qu'une fois, immédiatement).
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } catch {
      // Un prompt refusé ou indisponible ne doit jamais faire planter l'application.
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const { standaloneDisplayMode, iosStandalone } = readStandaloneState();

  return {
    canInstall: shouldShowInstallButton({
      hasDeferredPrompt: deferredPrompt !== null,
      standaloneDisplayMode,
      iosStandalone,
    }),
    install,
  };
}
