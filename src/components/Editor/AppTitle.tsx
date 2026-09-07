import type { CSSProperties } from 'react';

/**
 * Titre de l'application dans l'en-tête.
 *
 * Le nom est découpé caractère par caractère pour animer un cycle de couleurs
 * régulier — clin d'œil aux cycles de palette de la demoscene. Le nom complet
 * est doublé en `sr-only` pour les lecteurs d'écran : les lettres animées sont
 * `aria-hidden` pour ne pas être épelées. `prefers-reduced-motion` gèle
 * l'animation via le bloc global de `index.css`.
 */
const TITLE = 'H Editor';

const AppTitle = () => (
  <span className="flex-shrink-0 text-lg font-bold sm:text-xl">
    <span className="sr-only">{TITLE}</span>
    <span aria-hidden="true">
      {TITLE.split('').map((char, index) => (
        <span
          key={`${index}-${char}`}
          className="app-title-char"
          style={{ '--char-index': index } as CSSProperties}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  </span>
);

export default AppTitle;
