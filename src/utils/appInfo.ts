/**
 * Métadonnées de l'application.
 *
 * La version provient de `package.json`, injectée au build par Vite
 * (`define: __APP_VERSION__`) : plus de « v1.0 » codé en dur dans la barre d'état
 * qui divergeait de la version réelle.
 */

declare const __APP_VERSION__: string;

export const APP_VERSION =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev';

export const APP_NAME = 'EditorX';
export const APP_AUTHOR = 'Geoffroy Streit';
export const APP_HOMEPAGE = 'https://hylst.fr/app';
