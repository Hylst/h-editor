import { memo, useMemo, useRef, useState } from 'react';
import {
  Archive,
  Binary,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Edit2,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { EditorFile, EditorFolder } from '@/types/editor';
import type { SplitPanel, SplitView } from '@/hooks/useSplitLayout';
import { useVirtualList } from '@/hooks/useVirtualList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FILE_TEMPLATES } from '@/utils/templates';

interface SidebarProps {
  files: EditorFile[];
  folders: EditorFolder[];
  activeFileId: string | null;
  onFileSelect: (fileId: string) => void;
  onNewFile: (parentId?: string) => void;
  onNewFromTemplate: (templateId: string) => void;
  onNewFolder: (parentId?: string) => void;
  onToggleFolder: (folderId: string) => void;
  onImportJSON: (json: string) => void;
  onExportJSON: () => void;
  onImportZip: (file: File) => void;
  onExportZip: () => void;
  /** Absent si le navigateur ne gère pas `showDirectoryPicker`. */
  onOpenDirectory?: () => void;
  onDropFiles: (files: FileList, parentId?: string) => void;
  onRenameFile: (fileId: string, newName: string) => boolean;
  onRenameFolder: (folderId: string, newName: string) => boolean;
  onDeleteFile: (fileId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveFile: (fileId: string, newParentId?: string) => void;
  onMoveFolder: (folderId: string, newParentId?: string) => void;
  onDuplicateFile: (fileId: string) => void;
  splitView: SplitView;
  onOpenInPanel: (panel: SplitPanel, fileId: string) => void;
  onClose: () => void;
  /** Largeur en pixels, pilotée par la poignée de redimensionnement. */
  width: number;
}

const LANGUAGE_COLORS: Record<string, string> = {
  markdown: 'text-lang-markdown',
  javascript: 'text-lang-javascript',
  typescript: 'text-lang-typescript',
  python: 'text-lang-python',
  java: 'text-lang-java',
  go: 'text-lang-go',
  rust: 'text-lang-rust',
  ruby: 'text-lang-ruby',
  php: 'text-lang-php',
  html: 'text-lang-html',
  css: 'text-lang-css',
  json: 'text-lang-json',
};

const Sidebar = ({
  files,
  folders,
  activeFileId,
  onFileSelect,
  onNewFile,
  onNewFromTemplate,
  onNewFolder,
  onToggleFolder,
  onImportJSON,
  onExportJSON,
  onImportZip,
  onExportZip,
  onOpenDirectory,
  onDropFiles,
  onRenameFile,
  onRenameFolder,
  onDeleteFile,
  onDeleteFolder,
  onMoveFile,
  onMoveFolder,
  onDuplicateFile,
  splitView,
  onOpenInPanel,
  onClose,
  width,
}: SidebarProps) => {
  const [dragOverRoot, setDragOverRoot] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [renamingItemId, setRenamingItemId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [draggingItem, setDraggingItem] = useState<{ type: 'file' | 'folder'; id: string } | null>(null);
  const [filter, setFilter] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Filtre rapide : masque tout ce qui ne correspond pas, dossiers vides compris.
  const { visibleFileIds, visibleFolderIds } = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return { visibleFileIds: null, visibleFolderIds: null };

    const fileIds = new Set(
      files.filter((f) => f.name.toLowerCase().includes(query)).map((f) => f.id)
    );
    const folderIds = new Set<string>();

    // On garde les dossiers correspondant au filtre et tous les ancêtres des résultats.
    const addAncestors = (parentId?: string) => {
      let cursor = parentId;
      const guard = new Set<string>();
      while (cursor && !guard.has(cursor)) {
        guard.add(cursor);
        folderIds.add(cursor);
        cursor = folders.find((f) => f.id === cursor)?.parentId;
      }
    };

    files.filter((f) => fileIds.has(f.id)).forEach((f) => addAncestors(f.parentId));
    folders
      .filter((f) => f.name.toLowerCase().includes(query))
      .forEach((f) => {
        folderIds.add(f.id);
        addAncestors(f.parentId);
      });

    return { visibleFileIds: fileIds, visibleFolderIds: folderIds };
  }, [filter, files, folders]);

  const isFolderVisible = (id: string) => !visibleFolderIds || visibleFolderIds.has(id);
  const isFileVisible = (id: string) => !visibleFileIds || visibleFileIds.has(id);

  /**
   * Arbre aplati en liste de lignes visibles.
   *
   * Permet de ne rendre que la portion réellement affichée sur les gros
   * projets : garder 2 000 nœuds dans le DOM coûtait 146 ms par caractère saisi.
   */
  type Row =
    | { kind: 'folder'; folder: EditorFolder; level: number }
    | { kind: 'file'; file: EditorFile; level: number };

  const rows = useMemo(() => {
    const result: Row[] = [];

    const walk = (parentId: string | undefined, level: number) => {
      for (const folder of folders) {
        if (folder.parentId !== parentId) continue;
        if (!isFolderVisible(folder.id)) continue;

        result.push({ kind: 'folder', folder, level });
        // Pendant un filtrage, on déplie pour montrer les résultats.
        const expanded = filter ? true : folder.expanded ?? false;
        if (expanded) walk(folder.id, level + 1);
      }

      for (const file of files) {
        if (file.parentId !== parentId) continue;
        if (!isFileVisible(file.id)) continue;
        result.push({ kind: 'file', file, level });
      }
    };

    walk(undefined, 0);
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, folders, filter, visibleFileIds, visibleFolderIds]);

  const ROW_HEIGHT = 30;
  const { containerRef, window: virtualWindow } = useVirtualList<HTMLDivElement>({
    itemCount: rows.length,
    itemHeight: ROW_HEIGHT,
  });

  const getFileIcon = (file: EditorFile) => {
    if (file.binary) {
      return <Binary className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />;
    }
    const color = LANGUAGE_COLORS[file.language] ?? 'text-muted-foreground';
    const Icon = file.language === 'markdown' ? FileText : FileCode;
    return <Icon className={`h-4 w-4 flex-shrink-0 ${color}`} aria-hidden="true" />;
  };

  // ── Glisser-déposer ───────────────────────────────────────────────────────

  const handleDragOver = (e: React.DragEvent, folderId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    const hasFiles = e.dataTransfer.types.includes('Files');
    const hasItem = draggingItem !== null || e.dataTransfer.types.includes('application/x-editorx-item');
    if (!hasFiles && !hasItem) return;

    if (folderId) {
      setDragOverFolderId(folderId);
      setDragOverRoot(false);
    } else {
      setDragOverRoot(true);
      setDragOverFolderId(null);
    }
  };

  const handleDragLeave = (e: React.DragEvent, folderId?: string) => {
    const related = e.relatedTarget as HTMLElement | null;
    if (related && e.currentTarget.contains(related)) return;
    if (folderId) setDragOverFolderId((id) => (id === folderId ? null : id));
    else setDragOverRoot(false);
  };

  const handleDrop = (e: React.DragEvent, parentId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverRoot(false);
    setDragOverFolderId(null);

    let item = draggingItem;
    if (!item) {
      const data = e.dataTransfer.getData('application/x-editorx-item');
      if (data) {
        try {
          item = JSON.parse(data);
        } catch {
          item = null;
        }
      }
    }

    if (item) {
      if (item.type === 'file') onMoveFile(item.id, parentId);
      else onMoveFolder(item.id, parentId);
      setDraggingItem(null);
      return;
    }

    if (e.dataTransfer.files.length > 0) onDropFiles(e.dataTransfer.files, parentId);
  };

  const handleDragStart = (e: React.DragEvent, type: 'file' | 'folder', id: string) => {
    e.stopPropagation();
    setDraggingItem({ type, id });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-editorx-item', JSON.stringify({ type, id }));
    if (type === 'file') e.dataTransfer.setData('application/x-editorx-file-id', id);
  };

  // ── Renommage ─────────────────────────────────────────────────────────────

  const startRename = (id: string, currentName: string) => {
    setRenamingItemId(id);
    setRenamingValue(currentName);
  };

  const confirmRename = (id: string, type: 'file' | 'folder') => {
    if (!renamingValue.trim()) {
      setRenamingItemId(null);
      return;
    }
    const ok = type === 'file' ? onRenameFile(id, renamingValue) : onRenameFolder(id, renamingValue);
    if (ok) {
      setRenamingItemId(null);
      setRenamingValue('');
    }
  };

  const renameInput = (id: string, type: 'file' | 'folder') => (
    <Input
      value={renamingValue}
      onChange={(e) => setRenamingValue(e.target.value)}
      onBlur={() => confirmRename(id, type)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') confirmRename(id, type);
        if (e.key === 'Escape') setRenamingItemId(null);
      }}
      autoFocus
      aria-label={type === 'file' ? 'Nouveau nom du fichier' : 'Nouveau nom du dossier'}
      className="h-6 min-w-0 flex-1 text-sm"
    />
  );

  // ── Rendu de l'arborescence ───────────────────────────────────────────────

  const renderFolder = (folder: EditorFolder, level = 0) => {
    // Pendant un filtrage, on déplie automatiquement pour montrer les résultats.
    const isExpanded = filter ? true : folder.expanded ?? false;
    const isRenaming = renamingItemId === folder.id;

    return (
      <div key={folder.id} role="treeitem" aria-expanded={isExpanded} aria-label={folder.name}>
        <div
          draggable={!isRenaming}
          onDragStart={(e) => handleDragStart(e, 'folder', folder.id)}
          onDragEnd={() => setDraggingItem(null)}
          onDragOver={(e) => handleDragOver(e, folder.id)}
          onDragLeave={(e) => handleDragLeave(e, folder.id)}
          onDrop={(e) => handleDrop(e, folder.id)}
          className={`group flex w-full items-center gap-1 py-1.5 pr-2 transition-colors hover:bg-editor-tab-active/50 ${
            dragOverFolderId === folder.id ? 'bg-primary/20 ring-1 ring-inset ring-primary' : ''
          } ${draggingItem?.id === folder.id ? 'opacity-50' : ''}`}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
        >
          <button
            type="button"
            onClick={() => !isRenaming && onToggleFolder(folder.id)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            aria-label={`${isExpanded ? 'Replier' : 'Déplier'} le dossier ${folder.name}`}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 flex-shrink-0 text-editor-text-muted" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3 w-3 flex-shrink-0 text-editor-text-muted" aria-hidden="true" />
            )}
            <Folder className="h-4 w-4 flex-shrink-0 text-lang-folder" aria-hidden="true" />
            {!isRenaming && <span className="truncate text-sm text-editor-text">{folder.name}</span>}
          </button>

          {/* Le champ de renommage est hors du bouton : un <input> imbriqué dans
              un <button> produisait un HTML invalide et volait les clics. */}
          {isRenaming && renameInput(folder.id, 'folder')}

          {!isRenaming && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded p-1 opacity-0 transition-opacity hover:bg-editor-background focus-visible:opacity-100 group-hover:opacity-100"
                  aria-label={`Actions pour le dossier ${folder.name}`}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onNewFile(folder.id)}>
                  <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                  Nouveau fichier
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onNewFolder(folder.id)}>
                  <Folder className="mr-2 h-4 w-4" aria-hidden="true" />
                  Nouveau dossier
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => startRename(folder.id, folder.name)}>
                  <Edit2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Renommer
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => onDeleteFolder(folder.id)}>
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

      </div>
    );
  };

  const renderFile = (file: EditorFile, level = 0) => {
    const isRenaming = renamingItemId === file.id;
    const isActive = activeFileId === file.id;

    return (
      <div
        key={file.id}
        role="treeitem"
        aria-selected={isActive}
        draggable={!isRenaming}
        onDragStart={(e) => handleDragStart(e, 'file', file.id)}
        onDragEnd={() => setDraggingItem(null)}
        className={`group flex w-full items-center gap-1 py-1.5 pr-2 transition-colors ${
          isActive
            ? 'border-l-2 border-primary bg-editor-tab-active text-editor-text'
            : 'text-editor-text-muted hover:bg-editor-tab-active/50'
        } ${draggingItem?.id === file.id ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${level * 12 + (isActive ? 6 : 8)}px` }}
      >
        <button
          type="button"
          onClick={() => !isRenaming && onFileSelect(file.id)}
          onDoubleClick={() => startRename(file.id, file.name)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-label={`Ouvrir ${file.name}${file.binary ? ' (fichier binaire)' : ''}${
            file.modified ? ' (non enregistré sur le disque)' : ''
          }`}
        >
          <span className="w-3 flex-shrink-0" aria-hidden="true" />
          {getFileIcon(file)}
          {!isRenaming && <span className="truncate text-sm">{file.name}</span>}
          {file.modified && !isRenaming && (
            <span
              className="h-2 w-2 flex-shrink-0 rounded-full bg-primary"
              title="Non enregistré sur le disque"
              aria-hidden="true"
            />
          )}
        </button>

        {isRenaming && renameInput(file.id, 'file')}

        {!isRenaming && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded p-1 opacity-0 transition-opacity hover:bg-editor-background focus-visible:opacity-100 group-hover:opacity-100"
                aria-label={`Actions pour ${file.name}`}
              >
                <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {splitView !== 'none' && (
                <>
                  <DropdownMenuItem onClick={() => onOpenInPanel('topLeft', file.id)}>
                    <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                    {splitView === 'vertical' ? 'Afficher en haut' : 'Afficher à gauche'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onOpenInPanel('bottomRight', file.id)}>
                    <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                    {splitView === 'vertical' ? 'Afficher en bas' : 'Afficher à droite'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => startRename(file.id, file.name)}>
                <Edit2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Renommer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicateFile(file.id)}>
                <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                Dupliquer
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => onDeleteFile(file.id)}>
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  const hasVisibleResults = rows.length > 0;

  return (
    <aside
      className="flex h-full flex-shrink-0 flex-col bg-editor-sidebar"
      style={{ width }}
      aria-label="Explorateur de fichiers"
    >
      <div className="border-b border-editor-border p-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-semibold text-editor-text">EXPLORATEUR</span>
          </span>
          <span className="flex gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Créer ou importer">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onNewFile()}>
                  <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                  Nouveau fichier
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FileCode className="mr-2 h-4 w-4" aria-hidden="true" />
                    Nouveau depuis un modèle
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {FILE_TEMPLATES.map((template) => (
                      <DropdownMenuItem
                        key={template.id}
                        onClick={() => onNewFromTemplate(template.id)}
                      >
                        <span className="flex flex-col">
                          <span>{template.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {template.description}
                          </span>
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem onClick={() => onNewFolder()}>
                  <Folder className="mr-2 h-4 w-4" aria-hidden="true" />
                  Nouveau dossier
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {onOpenDirectory && (
                  <DropdownMenuItem onClick={onOpenDirectory}>
                    <FolderOpen className="mr-2 h-4 w-4" aria-hidden="true" />
                    Ouvrir un dossier du disque…
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                  Importer des fichiers
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => zipInputRef.current?.click()}>
                  <Archive className="mr-2 h-4 w-4" aria-hidden="true" />
                  Importer un ZIP
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => jsonInputRef.current?.click()}>
                  <FileJson className="mr-2 h-4 w-4" aria-hidden="true" />
                  Importer un JSON
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onExportJSON}>
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  Exporter en JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportZip}>
                  <Archive className="mr-2 h-4 w-4" aria-hidden="true" />
                  Exporter en ZIP
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
              aria-label="Masquer l'explorateur"
            >
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            </Button>
          </span>
        </div>

        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-editor-text-muted"
            aria-hidden="true"
          />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrer les fichiers…"
            aria-label="Filtrer les fichiers"
            className="h-7 bg-editor-background pl-7 pr-7 text-xs"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-editor-text-muted hover:text-editor-text"
              aria-label="Effacer le filtre"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className={`flex-1 overflow-y-auto py-2 ${dragOverRoot ? 'bg-primary/10' : ''}`}
        role="tree"
        aria-label="Fichiers du projet"
        onDragOver={(e) => handleDragOver(e)}
        onDragLeave={(e) => handleDragLeave(e)}
        onDrop={(e) => handleDrop(e)}
      >
        {files.length === 0 && folders.length === 0 ? (
          <p className="p-4 text-center text-sm text-editor-text-muted">
            Glissez des fichiers ici ou créez-en un
          </p>
        ) : !hasVisibleResults ? (
          <p className="p-4 text-center text-sm text-editor-text-muted">Aucun résultat</p>
        ) : (
          <>
            {virtualWindow.paddingTop > 0 && (
              <div style={{ height: virtualWindow.paddingTop }} aria-hidden="true" />
            )}
            {rows.slice(virtualWindow.start, virtualWindow.end).map((row) =>
              row.kind === 'folder'
                ? renderFolder(row.folder, row.level)
                : renderFile(row.file, row.level)
            )}
            {virtualWindow.paddingBottom > 0 && (
              <div style={{ height: virtualWindow.paddingBottom }} aria-hidden="true" />
            )}
          </>
        )}

        {draggingItem && (
          <div
            className={`m-2 flex min-h-[52px] items-center justify-center rounded-md border-2 border-dashed text-xs transition-colors ${
              dragOverRoot ? 'border-primary bg-primary/20 text-primary' : 'border-editor-border text-editor-text-muted'
            }`}
            onDragOver={(e) => handleDragOver(e)}
            onDrop={(e) => handleDrop(e, undefined)}
          >
            Déposer à la racine
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          if (e.target.files?.length) onDropFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={jsonInputRef}
        type="file"
        accept=".json"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) file.text().then(onImportJSON);
          e.target.value = '';
        }}
      />
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImportZip(file);
          e.target.value = '';
        }}
      />
    </aside>
  );
};

/**
 * L'explorateur n'affiche que des métadonnées (nom, langage, drapeaux).
 * Sans cette comparaison, il se rendait à nouveau à **chaque caractère saisi**,
 * puisque `files` est un nouveau tableau à chaque frappe.
 */
const sameTree = (prev: SidebarProps, next: SidebarProps): boolean => {
  if (prev.width !== next.width) return false;
  if (prev.activeFileId !== next.activeFileId) return false;
  if (prev.splitView !== next.splitView) return false;
  if (prev.files.length !== next.files.length) return false;
  if (prev.folders.length !== next.folders.length) return false;

  for (let i = 0; i < prev.files.length; i++) {
    const a = prev.files[i];
    const b = next.files[i];
    if (
      a.id !== b.id ||
      a.name !== b.name ||
      a.language !== b.language ||
      a.parentId !== b.parentId ||
      a.modified !== b.modified ||
      a.binary !== b.binary
    ) {
      return false;
    }
  }

  for (let i = 0; i < prev.folders.length; i++) {
    const a = prev.folders[i];
    const b = next.folders[i];
    if (a.id !== b.id || a.name !== b.name || a.parentId !== b.parentId || a.expanded !== b.expanded) {
      return false;
    }
  }

  return true;
};

export default memo(Sidebar, sameTree);
