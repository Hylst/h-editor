/**
 * Génération d'identifiants.
 *
 * `crypto.randomUUID()` n'existe **que dans un contexte sécurisé** (HTTPS ou
 * localhost). Or Vite expose aussi l'application sur l'IP du réseau local
 * (`http://192.168.x.x:8080`) : sur un téléphone ou une autre machine, l'appel
 * lève « crypto.randomUUID is not a function » et l'application ne démarre pas.
 *
 * Ce module fournit un repli, sans dépendance externe.
 */

const hex = (n: number) => n.toString(16).padStart(2, '0');

/** UUID v4 à partir de `crypto.getRandomValues`, disponible hors contexte sécurisé. */
const uuidFromRandomValues = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC 4122

  const s = Array.from(bytes, hex).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
};

/** Dernier recours (environnements sans Web Crypto : très vieux navigateurs, tests). */
const uuidFromMath = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

export const createId = (): string => {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    if (typeof crypto.getRandomValues === 'function') return uuidFromRandomValues();
  }
  return uuidFromMath();
};
