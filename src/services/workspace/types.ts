/**
 * Contrat de stockage de l'espace de travail (port).
 *
 * EditorX est 100 % front-end : la seule implémentation active est locale
 * (`localStore.ts`, localStorage + IndexedDB). Ce contrat existe pour que
 * l'ajout éventuel d'un backend (synchronisation, partage, multi-appareils)
 * se fasse **sans toucher à l'interface utilisateur** : il suffira de fournir
 * une autre implémentation de `WorkspaceStore` et de la sélectionner dans
 * `services/workspace/index.ts`.
 *
 * Contraintes imposées à toute implémentation :
 *  - aucune méthode ne doit lever : les échecs sont retournés (`SaveOutcome`) ;
 *  - `save()` reçoit la liste des fichiers réellement modifiés pour permettre
 *    des écritures incrémentales (indispensable dès quelques Mo de projet) ;
 *  - `load()` renvoie `null` quand aucun espace de travail n'existe encore.
 */

import type { EditorFile, EditorFolder, EditorTab } from '@/types/editor';

export interface WorkspaceSnapshot {
  files: EditorFile[];
  folders: EditorFolder[];
  tabs: EditorTab[];
  /**
   * Noms des fichiers dont le contenu était référencé mais introuvable
   * (base IndexedDB effacée par le navigateur ou par l'utilisateur, éviction
   * en navigation privée…). Ils sont restitués vides : il faut le dire plutôt
   * que de laisser croire à une perte silencieuse.
   */
  missingContent?: string[];
}

export interface SaveOptions {
  /** Ids des fichiers dont le contenu a changé depuis la dernière sauvegarde. */
  changedFileIds?: string[];
  /** Ids des fichiers supprimés depuis la dernière sauvegarde. */
  removedFileIds?: string[];
  /** Force la réécriture complète (première sauvegarde, import, restauration). */
  full?: boolean;
  /**
   * Écrire même si une autre instance a modifié le stockage entre-temps.
   * Sans ce drapeau, `save()` refuse et renvoie `reason: 'conflict'` : mieux
   * vaut alerter que détruire le travail d'un autre onglet.
   */
  overwriteConflict?: boolean;
}

export interface SaveOutcome {
  ok: boolean;
  /** Contenu écrit en localStorage faute d'IndexedDB : limite ~5 Mo. */
  degraded?: boolean;
  reason?: 'quota' | 'unavailable' | 'conflict';
  message?: string;
  /** Nombre de fichiers réellement écrits (diagnostic / tests). */
  writtenFiles?: number;
}

export interface StorageUsage {
  /** Octets utilisés par l'origine, tous stockages confondus. */
  usage: number;
  /** Quota annoncé par le navigateur. */
  quota: number;
  /** Poids du projet EditorX lui-même (somme des contenus). */
  workspaceBytes: number;
}

export interface ExternalChange {
  /** Identifiant de l'onglet/instance à l'origine de l'écriture. */
  writerId: string;
  at: number;
}

export interface WorkspaceStore {
  /** Identifiant d'implémentation, exposé pour le diagnostic. */
  readonly kind: string;

  load(): Promise<WorkspaceSnapshot | null>;
  save(snapshot: WorkspaceSnapshot, options?: SaveOptions): Promise<SaveOutcome>;
  clear(): Promise<void>;

  /** A-t-on déjà initialisé un espace de travail sur cet appareil ? */
  hasBeenInitialized(): boolean;

  /** Estimation d'occupation, si le navigateur la fournit. */
  estimate(files: EditorFile[]): Promise<StorageUsage | null>;

  /**
   * Notifie qu'une autre instance (autre onglet aujourd'hui, autre appareil
   * demain) a écrit un nouvel état. Renvoie une fonction de désinscription.
   */
  onExternalChange(listener: (change: ExternalChange) => void): () => void;
}
