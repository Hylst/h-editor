/**
 * Nommage des fichiers et dossiers : unicité et validation.
 *
 * Corrige le bug de collision (`nouveau-fichier-${files.length + 1}` produisait
 * des doublons dès qu'un fichier était supprimé) et sécurise les renommages.
 */

export const INVALID_NAME_CHARS = /[\\/:*?"<>|]/;

export interface NameCheck {
  valid: boolean;
  error?: string;
}

export const validateName = (name: string): NameCheck => {
  const trimmed = name.trim();

  if (!trimmed) return { valid: false, error: 'Le nom ne peut pas être vide' };
  if (trimmed.length > 255) return { valid: false, error: 'Nom trop long (255 caractères maximum)' };
  if (INVALID_NAME_CHARS.test(trimmed)) {
    return { valid: false, error: 'Caractères interdits : \\ / : * ? " < > |' };
  }
  if (trimmed === '.' || trimmed === '..') return { valid: false, error: 'Nom réservé' };

  return { valid: true };
};

const splitExtension = (name: string): [string, string] => {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex <= 0) return [name, ''];
  return [name.slice(0, dotIndex), name.slice(dotIndex)];
};

interface NamedItem {
  id: string;
  name: string;
  parentId?: string;
}

/**
 * Renvoie un nom libre dans le dossier `parentId`, en ajoutant un suffixe
 * numéroté si nécessaire : `notes.txt` → `notes (2).txt` → `notes (3).txt`.
 * `ignoreId` permet de renommer un élément sans qu'il entre en conflit avec lui-même.
 */
export const getUniqueName = (
  desiredName: string,
  parentId: string | undefined,
  items: NamedItem[],
  ignoreId?: string
): string => {
  const siblings = new Set(
    items
      .filter((item) => item.parentId === parentId && item.id !== ignoreId)
      .map((item) => item.name.toLowerCase())
  );

  if (!siblings.has(desiredName.toLowerCase())) return desiredName;

  const [base, ext] = splitExtension(desiredName);
  // Repart d'une base propre si le nom porte déjà un suffixe « (n) »
  const cleanBase = base.replace(/ \(\d+\)$/, '');

  for (let i = 2; i < 10_000; i++) {
    const candidate = `${cleanBase} (${i})${ext}`;
    if (!siblings.has(candidate.toLowerCase())) return candidate;
  }

  return `${cleanBase}-${Date.now()}${ext}`;
};

/** Nom par défaut d'un nouveau fichier, garanti unique dans son dossier. */
export const getNewFileName = (items: NamedItem[], parentId?: string): string => {
  const used = new Set(
    items.filter((i) => i.parentId === parentId).map((i) => i.name.toLowerCase())
  );
  for (let i = 1; i < 10_000; i++) {
    const candidate = `nouveau-fichier-${i}.txt`;
    if (!used.has(candidate)) return candidate;
  }
  return `nouveau-fichier-${Date.now()}.txt`;
};

/** Nom par défaut d'un nouveau dossier, garanti unique dans son parent. */
export const getNewFolderName = (items: NamedItem[], parentId?: string): string => {
  const used = new Set(
    items.filter((i) => i.parentId === parentId).map((i) => i.name.toLowerCase())
  );
  for (let i = 1; i < 10_000; i++) {
    const candidate = `nouveau-dossier-${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `nouveau-dossier-${Date.now()}`;
};

/** Nom de copie : `app.tsx` → `app - copie.tsx`, puis `app - copie (2).tsx`. */
export const getCopyName = (name: string, parentId: string | undefined, items: NamedItem[]): string => {
  const [base, ext] = splitExtension(name);
  return getUniqueName(`${base} - copie${ext}`, parentId, items);
};
