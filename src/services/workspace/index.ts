/**
 * Point de sélection de l'implémentation de stockage.
 *
 * Aujourd'hui : uniquement local (aucun serveur, aucune requête réseau).
 *
 * Pour brancher un backend plus tard, sans toucher aux composants :
 *   1. écrire `remoteStore.ts` implémentant `WorkspaceStore` (mêmes garanties :
 *      ne jamais lever, écritures incrémentales, notification des changements
 *      externes via WebSocket/SSE plutôt que l'événement `storage`) ;
 *   2. le composer avec le store local (le local reste le cache hors ligne) ;
 *   3. le renvoyer ici selon la configuration/l'authentification.
 *
 * Les hooks (`useWorkspace`) ne connaissent que l'interface : le reste de
 * l'application n'a pas à changer.
 */

import { LocalWorkspaceStore } from './localStore';
import type { WorkspaceStore } from './types';

let store: WorkspaceStore | null = null;

export const getWorkspaceStore = (): WorkspaceStore => {
  if (!store) store = new LocalWorkspaceStore();
  return store;
};

/** Utilisé par les tests pour injecter une implémentation factice. */
export const setWorkspaceStore = (custom: WorkspaceStore | null): void => {
  store = custom;
};

export * from './types';
