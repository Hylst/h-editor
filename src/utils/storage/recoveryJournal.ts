/**
 * Journal de reprise.
 *
 * La sauvegarde est différée de 600 ms et purgée quand la page passe en
 * arrière-plan. Reste un cas non couvert : le **plantage brutal** de l'onglet
 * (crash du processus, coupure de courant), où ni `pagehide` ni
 * `visibilitychange` ne sont émis. Les frappes de la dernière seconde seraient
 * alors perdues.
 *
 * Ce journal écrit chaque modification en cours dans `sessionStorage`, de façon
 * synchrone et immédiate. Au démarrage suivant, si une entrée subsiste alors que
 * la sauvegarde normale ne la contient pas, on propose sa récupération.
 *
 * `sessionStorage` est volontaire : l'entrée disparaît à la fermeture propre de
 * l'onglet, ce qui évite de proposer une reprise après une sortie normale.
 */

const JOURNAL_KEY = 'editorx-journal';

/** Au-delà, on n'inscrit plus le contenu au journal (coût synchrone trop élevé). */
const MAX_JOURNALED_BYTES = 512 * 1024;

export interface JournalEntry {
  fileId: string;
  fileName: string;
  content: string;
  at: number;
}

const read = (): Record<string, JournalEntry> => {
  try {
    const raw = sessionStorage.getItem(JOURNAL_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const write = (entries: Record<string, JournalEntry>): void => {
  try {
    sessionStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
  } catch {
    // Quota de session atteint : le journal est un confort, pas une garantie.
    // La sauvegarde principale reste la source de vérité.
  }
};

/** Inscrit (ou met à jour) l'état en cours d'un fichier. */
export const journalWrite = (fileId: string, fileName: string, content: string): void => {
  if (content.length > MAX_JOURNALED_BYTES) return;

  const entries = read();
  entries[fileId] = { fileId, fileName, content, at: Date.now() };
  write(entries);
};

/** Retire du journal les fichiers dont la sauvegarde est confirmée. */
export const journalClear = (fileIds: string[]): void => {
  if (fileIds.length === 0) return;

  const entries = read();
  let changed = false;
  for (const id of fileIds) {
    if (entries[id]) {
      delete entries[id];
      changed = true;
    }
  }
  if (changed) write(entries);
};

export const journalClearAll = (): void => {
  try {
    sessionStorage.removeItem(JOURNAL_KEY);
  } catch {
    /* rien à faire */
  }
};

/**
 * Entrées du journal qui divergent de ce qui a été effectivement persisté :
 * ce sont les modifications qu'un plantage aurait emportées.
 */
export const journalPendingEntries = (
  persisted: { id: string; content: string }[]
): JournalEntry[] => {
  const entries = read();
  if (Object.keys(entries).length === 0) return [];

  const byId = new Map(persisted.map((f) => [f.id, f.content]));

  return Object.values(entries).filter((entry) => {
    const saved = byId.get(entry.fileId);
    // Fichier disparu depuis : rien à restaurer.
    if (saved === undefined) return false;
    return saved !== entry.content;
  });
};
