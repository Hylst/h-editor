/**
 * Entrées/sorties disque.
 *
 * La File System Access API n'existe que sur les navigateurs Chromium (et est
 * bloquée en iframe) : chaque fonction expose un repli utilisable partout.
 */

export interface OpenedFile {
  handle?: FileSystemFileHandle;
  content: string;
  name: string;
  /** Date de dernière modification du fichier sur le disque, à l'ouverture. */
  lastModified: number;
}

export type SaveResult =
  | { status: 'saved'; handle: FileSystemFileHandle; name: string; lastModified: number }
  | { status: 'cancelled' }
  | { status: 'unavailable' }
  | { status: 'conflict'; diskModifiedAt: number }
  | { status: 'error'; message: string };

/** Types de fichiers proposés dans les sélecteurs natifs. */
const TEXT_FILE_TYPES = [
  {
    description: 'Fichiers texte et code',
    accept: {
      'text/plain': [
        '.txt', '.md', '.markdown', '.log',
        '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
        '.json', '.jsonc', '.html', '.htm', '.xml', '.svg',
        '.css', '.scss', '.sass', '.less',
        '.py', '.pyw', '.php', '.java', '.c', '.h', '.cpp', '.hpp', '.cc', '.cxx',
        '.cs', '.go', '.rs', '.rb', '.erb', '.swift', '.kt', '.kts',
        '.scala', '.r', '.rmd', '.sh', '.bash', '.zsh', '.fish', '.ps1', '.psm1',
        '.sql', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.env',
        '.graphql', '.gql', '.vue', '.svelte', '.dart', '.pl', '.pm', '.lua',
        '.ex', '.exs', '.hs', '.clj', '.cljs', '.m', '.mm', '.coffee', '.dockerfile',
      ],
    },
  },
] satisfies FilePickerAcceptType[];

export const checkFileSystemSupport = (): boolean => {
  try {
    return (
      typeof window !== 'undefined' &&
      'showOpenFilePicker' in window &&
      'showSaveFilePicker' in window
    );
  } catch {
    return false;
  }
};

/** Ouvre un fichier via le sélecteur natif ; renvoie null si l'utilisateur annule. */
export const openFileWithPicker = async (): Promise<OpenedFile | null> => {
  try {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: TEXT_FILE_TYPES,
      excludeAcceptAllOption: false,
    });
    const file = await handle.getFile();
    return {
      handle,
      content: await file.text(),
      name: file.name,
      lastModified: file.lastModified,
    };
  } catch (error) {
    if ((error as Error)?.name !== 'AbortError') {
      console.error('Ouverture impossible :', error);
    }
    return null;
  }
};

/**
 * Écrit un contenu sur le disque.
 *
 * Si `expectedModifiedAt` est fourni et que le fichier a changé sur le disque
 * depuis (autre éditeur, `git checkout`…), l'écriture est **refusée** :
 * l'écraser silencieusement ferait perdre le travail de l'autre outil.
 */
export const saveFileChecked = async (
  content: string,
  fileHandle?: FileSystemFileHandle,
  suggestedName?: string,
  expectedModifiedAt?: number
): Promise<SaveResult> => {
  try {
    let handle = fileHandle;

    if (!handle) {
      if (!checkFileSystemSupport()) return { status: 'unavailable' };
      handle = await window.showSaveFilePicker({ suggestedName, types: TEXT_FILE_TYPES });
    } else if (expectedModifiedAt !== undefined) {
      const current = await handle.getFile();
      // Tolérance d'une seconde : certains systèmes de fichiers arrondissent.
      if (current.lastModified - expectedModifiedAt > 1000) {
        return { status: 'conflict', diskModifiedAt: current.lastModified };
      }
    }

    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();

    const saved = await handle.getFile();
    return { status: 'saved', handle, name: saved.name, lastModified: saved.lastModified };
  } catch (error) {
    const name = (error as Error)?.name;
    if (name === 'AbortError') return { status: 'cancelled' };
    if (name === 'NotAllowedError') {
      console.warn('Permission d’écriture refusée.');
      return { status: 'cancelled' };
    }
    console.error('Enregistrement impossible :', error);
    return { status: 'error', message: (error as Error)?.message ?? 'Erreur inconnue' };
  }
};

/** Variante simplifiée, sans détection de conflit (auto-enregistrement). */
export const saveFile = async (
  content: string,
  fileHandle?: FileSystemFileHandle,
  suggestedName?: string
): Promise<FileSystemFileHandle | null> => {
  const result = await saveFileChecked(content, fileHandle, suggestedName);
  return result.status === 'saved' ? result.handle : null;
};

export const openDirectory = async (): Promise<FileSystemDirectoryHandle | null> => {
  try {
    return await window.showDirectoryPicker();
  } catch (error) {
    if ((error as Error)?.name !== 'AbortError') console.error('Ouverture du dossier :', error);
    return null;
  }
};

/** Repli universel : téléchargement du contenu. */
export const downloadFile = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python', pyw: 'python',
  html: 'html', htm: 'html',
  css: 'css', scss: 'scss', sass: 'sass', less: 'less',
  json: 'json', jsonc: 'json', xml: 'xml', svg: 'xml',
  yaml: 'yaml', yml: 'yaml', toml: 'toml',
  ini: 'ini', cfg: 'ini', conf: 'ini', env: 'ini',
  md: 'markdown', markdown: 'markdown',
  sql: 'sql',
  sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
  ps1: 'powershell', psm1: 'powershell',
  php: 'php', java: 'java',
  c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cc: 'cpp', cxx: 'cpp',
  cs: 'csharp', csx: 'csharp',
  go: 'go', rs: 'rust', rb: 'ruby', erb: 'ruby',
  swift: 'swift', kt: 'kotlin', kts: 'kotlin',
  scala: 'scala', sc: 'scala', r: 'r', rmd: 'r',
  graphql: 'graphql', gql: 'graphql',
  vue: 'vue', svelte: 'svelte', dart: 'dart',
  pl: 'perl', pm: 'perl', lua: 'lua',
  ex: 'elixir', exs: 'elixir', hs: 'haskell',
  clj: 'clojure', cljs: 'clojure',
  m: 'objective-c', mm: 'objective-c',
  coffee: 'coffeescript',
  txt: 'plaintext', log: 'plaintext',
};

/**
 * Déduit le langage d'un nom de fichier.
 * Les extensions binaires (`.class`, `.jar`, `.db`…) ne sont volontairement plus
 * associées à un langage : ces fichiers ne sont pas éditables en texte.
 */
export const getLanguageFromFilename = (filename: string): string => {
  const lower = filename.toLowerCase();

  // Fichiers sans extension ou à nom conventionnel
  if (lower === 'dockerfile' || lower.endsWith('.dockerfile') || lower.startsWith('dockerfile.')) {
    return 'dockerfile';
  }
  if (lower === 'makefile') return 'plaintext';
  if (lower.startsWith('.env')) return 'ini';
  if (lower === '.gitignore' || lower === '.npmrc' || lower === '.editorconfig') return 'ini';

  const ext = lower.includes('.') ? lower.split('.').pop() ?? '' : '';
  return LANGUAGE_BY_EXTENSION[ext] ?? 'plaintext';
};
