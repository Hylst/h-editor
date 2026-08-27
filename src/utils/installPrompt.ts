/**
 * Logique pure de décision d'affichage du bouton d'installation PWA.
 * Séparée du hook pour être testable en Vitest (sans DOM).
 */

export interface InstallPromptInputs {
  /** Un événement `beforeinstallprompt` a-t-il été capturé ? */
  hasDeferredPrompt: boolean;
  /** Le navigateur rapporte-t-il un mode d'affichage « installé » ? */
  standaloneDisplayMode: boolean;
  /** iOS Safari signale-t-il qu'il tourne en standalone (ajouté à l'écran d'accueil) ? */
  iosStandalone: boolean;
}

/**
 * Le bouton « Installer » doit-il être affiché ?
 *
 * Trois conditions sont requises : un événement `beforeinstallprompt` a été émis
 * (donc le navigateur propose l'installation) ET l'application n'est pas déjà
 * installée (ni via `display-mode: standalone`, ni via le flag iOS).
 */
export const shouldShowInstallButton = ({
  hasDeferredPrompt,
  standaloneDisplayMode,
  iosStandalone,
}: InstallPromptInputs): boolean =>
  hasDeferredPrompt && !standaloneDisplayMode && !iosStandalone;
