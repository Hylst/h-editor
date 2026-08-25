export interface EditorFile {
  id: string;
  name: string;
  language: string;
  content: string;
  /** true = modifications non écrites sur le disque (le contenu reste conservé localement) */
  modified: boolean;
  fileHandle?: FileSystemFileHandle;
  parentId?: string; // ID du dossier parent (undefined = racine)
  /**
   * Fichier binaire (image, PDF…) conservé en base64 : il traverse l'import et
   * l'export ZIP sans être corrompu, mais n'est pas éditable comme du texte.
   */
  binary?: boolean;
  /**
   * `lastModified` du fichier disque au moment de son ouverture ou de son
   * dernier enregistrement. Permet de détecter qu'il a été modifié ailleurs
   * (autre éditeur, `git checkout`…) avant de l'écraser.
   */
  diskModifiedAt?: number;
}

export interface EditorFolder {
  id: string;
  name: string;
  parentId?: string; // ID du dossier parent (undefined = racine)
  expanded?: boolean;
}

export interface EditorTab {
  id: string;
  fileId: string;
  active: boolean;
}

export interface FileSystemStructure {
  files: EditorFile[];
  folders: EditorFolder[];
}

export type SupportedLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'html'
  | 'css'
  | 'scss'
  | 'sass'
  | 'less'
  | 'json'
  | 'markdown'
  | 'sql'
  | 'yaml'
  | 'php'
  | 'java'
  | 'c'
  | 'cpp'
  | 'csharp'
  | 'go'
  | 'rust'
  | 'ruby'
  | 'swift'
  | 'kotlin'
  | 'scala'
  | 'r'
  | 'shell'
  | 'bash'
  | 'powershell'
  | 'xml'
  | 'toml'
  | 'ini'
  | 'dockerfile'
  | 'graphql'
  | 'vue'
  | 'svelte'
  | 'dart'
  | 'perl'
  | 'lua'
  | 'elixir'
  | 'haskell'
  | 'clojure'
  | 'objective-c'
  | 'coffeescript'
  | 'plaintext';

/** File System Access API — absente des définitions DOM de TypeScript. */
export interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

declare global {
  type FilePickerAcceptType = {
    description?: string;
    accept: Record<string, string[]>;
  };

  interface Window {
    showOpenFilePicker(options?: {
      multiple?: boolean;
      excludeAcceptAllOption?: boolean;
      types?: FilePickerAcceptType[];
    }): Promise<FileSystemFileHandle[]>;

    showSaveFilePicker(options?: {
      suggestedName?: string;
      excludeAcceptAllOption?: boolean;
      types?: FilePickerAcceptType[];
    }): Promise<FileSystemFileHandle>;

    showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
  }
}
