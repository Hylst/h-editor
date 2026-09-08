import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignLeft,
  Columns2,
  Command as CommandIcon,
  Download,
  Eye,
  FileText,
  FolderOpen,
  FolderPlus,
  FolderTree,
  FileCode2,
  Undo2,
  Loader2,
  Maximize2,
  Minimize2,
  PanelLeft,
  Plus,
  Save,
  Search,
  Split,
  SplitSquareHorizontal,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import type { EditorFile } from '@/types/editor';
import MonacoEditor, { type MonacoEditorRef } from './MonacoEditor';
import TabBar from './TabBar';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';
import ResizeHandle from './ResizeHandle';
import AppTitle from './AppTitle';
import { useKeyboardShortcuts, type KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';
import { useSettings } from '@/hooks/useSettings';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useTabs } from '@/hooks/useTabs';
import { useSplitLayout } from '@/hooks/useSplitLayout';
import {
  checkFileSystemSupport,
  downloadFile,
  getLanguageFromFilename,
  openFileWithPicker,
  saveFile,
  saveFileChecked,
} from '@/utils/fileSystem';
import { importDirectory, isDirectoryPickerSupported } from '@/utils/directoryImport';
import { canFormat, formatCode } from '@/utils/formatter';
import { analyzeJSONImport, downloadJSON } from '@/utils/fileStorage';
import { downloadAsZip, importFromZip } from '@/utils/zipHandler';
import { canPreview } from '@/utils/markdown';
import { FILE_TEMPLATES } from '@/utils/templates';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Dialogues et panneaux secondaires : chargés à la demande (allège le bundle initial).
const PreviewPanel = lazy(() => import('./PreviewPanel'));
const SearchPanel = lazy(() => import('./SearchPanel'));
const CommandPalette = lazy(() => import('./CommandPalette'));
const QuickOpen = lazy(() => import('./QuickOpen'));
const SettingsDialog = lazy(() => import('./SettingsDialog'));
const InfoDialog = lazy(() => import('./InfoDialog'));

interface PendingDeletion {
  kind: 'file' | 'folder';
  id: string;
  name: string;
  warnUnsaved: boolean;
}

const EditorLayout = () => {
  const { settings, setSettings, updateSettings, resetSettings } = useSettings();
  const workspace = useWorkspace();
  const { files, folders, isLoading, storageStatus, restoredTabs } = workspace;

  const tabsApi = useTabs(files, restoredTabs);
  const { tabs, activeFile } = tabsApi;

  const split = useSplitLayout(files, isLoading);

  const [fsSupported] = useState(checkFileSystemSupport);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [zenMode, setZenMode] = useState(false);
  const [previewFullScreen, setPreviewFullScreen] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [selectionLength, setSelectionLength] = useState(0);
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(null);
  const [isBusy, setIsBusy] = useState<string | null>(null);

  // Sur écran étroit (< 768px, breakpoint md de Tailwind), on masque l'explorateur au
  // chargement : il occupe une largeur fixe (défaut 256px) qui mangerait 68% de l'écran.
  // L'utilisateur peut toujours le rouvrir avec Ctrl+B ou le bouton de la barre d'outils.
  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) {
      setSidebarVisible(false);
    }
  }, []);

  const mainEditorRef = useRef<MonacoEditorRef>(null);
  const topLeftEditorRef = useRef<MonacoEditorRef>(null);
  const bottomRightEditorRef = useRef<MonacoEditorRef>(null);

  const topLeftFile = useMemo(
    () => (split.isSplit ? files.find((f) => f.id === split.topLeftFileId) ?? null : null),
    [files, split.isSplit, split.topLeftFileId]
  );
  const bottomRightFile = useMemo(
    () => (split.isSplit ? files.find((f) => f.id === split.bottomRightFileId) ?? null : null),
    [files, split.isSplit, split.bottomRightFileId]
  );

  /** Fichier ciblé par les actions (enregistrer, formater, aperçu…). */
  const targetFile: EditorFile | null = split.isSplit
    ? split.activePanel === 'topLeft'
      ? topLeftFile
      : bottomRightFile
    : activeFile;

  /** Éditeur Monaco correspondant au panneau courant. */
  const activeEditorRef = split.isSplit
    ? split.activePanel === 'topLeft'
      ? topLeftEditorRef
      : bottomRightEditorRef
    : mainEditorRef;

  const previewAvailable = !!targetFile && canPreview(targetFile.language);
  const previewOpen = previewAvailable && settings.previewVisible;

  // Les onglets sont persistés avec le projet (restauration complète de la session).
  const { syncTabs } = workspace;
  useEffect(() => {
    syncTabs(tabs);
  }, [tabs, syncTabs]);

  // Raccourcis de l'application installée (manifest PWA) : ?action=… / ?mode=zen
  const pwaActionHandled = useRef(false);
  useEffect(() => {
    if (isLoading || pwaActionHandled.current) return;
    pwaActionHandled.current = true;

    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const mode = params.get('mode');
    if (!action && !mode) return;

    if (action === 'new-file') handleNewFile();
    if (action === 'import') fileImportRef.current?.click();
    if (mode === 'zen') setZenMode(true);

    // On nettoie l'URL pour ne pas rejouer l'action au rechargement.
    window.history.replaceState({}, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const fileImportRef = useRef<HTMLInputElement>(null);

  // ── Édition ───────────────────────────────────────────────────────────────

  const handleContentChange = useCallback(
    (fileId: string | undefined, value: string | undefined) => {
      if (!fileId || value === undefined) return;
      workspace.updateFileContent(fileId, value);
    },
    [workspace]
  );

  // ── Fichiers ──────────────────────────────────────────────────────────────

  const handleNewFile = useCallback(
    (parentId?: string) => {
      const id = workspace.createFile(parentId);
      tabsApi.openTab(id);
      toast.success('Fichier créé');
    },
    [workspace, tabsApi]
  );

  /** Crée un fichier pré-rempli à partir d'un modèle. */
  const handleNewFromTemplate = useCallback(
    (templateId: string) => {
      const template = FILE_TEMPLATES.find((t) => t.id === templateId);
      if (!template) return;

      const id = workspace.createFile(undefined, template.fileName, template.content);

      // Certains modèles créent plusieurs fichiers liés (page + styles + script).
      for (const extra of template.extraFiles ?? []) {
        workspace.createFile(undefined, extra.fileName, extra.content);
      }

      tabsApi.openTab(id);

      const total = 1 + (template.extraFiles?.length ?? 0);
      toast.success(
        total > 1 ? `« ${template.label} » créé (${total} fichiers)` : `« ${template.label} » créé`,
        total > 1
          ? { description: 'Utilisez l’aperçu (Ctrl+Maj+V) pour tester le résultat.' }
          : undefined
      );
    },
    [workspace, tabsApi]
  );

  const handleNewFolder = useCallback(
    (parentId?: string) => {
      workspace.createFolder(parentId);
      toast.success('Dossier créé');
    },
    [workspace]
  );

  const handleFileSelect = useCallback(
    (fileId: string) => {
      if (split.isSplit) {
        split.openInPanel(split.activePanel, fileId);
        return;
      }
      tabsApi.openTab(fileId);
    },
    [split, tabsApi]
  );

  const handleOpenFile = useCallback(async () => {
    // File System Access API quand elle existe (permet un vrai Ctrl+S ensuite),
    // sinon <input type="file"> — qui fonctionne sur tous les navigateurs.
    if (fsSupported) {
      const opened = await openFileWithPicker();
      if (!opened) return;

      const ids = workspace.addFiles([
        {
          name: opened.name,
          language: getLanguageFromFilename(opened.name),
          content: opened.content,
          modified: false,
          fileHandle: opened.handle,
          diskModifiedAt: opened.lastModified,
        },
      ]);
      if (ids[0]) tabsApi.openTab(ids[0]);
      toast.success(`« ${opened.name} » ouvert`);
      return;
    }

    fileImportRef.current?.click();
  }, [fsSupported, workspace, tabsApi]);

  const handleOpenDirectory = useCallback(async () => {
    if (!isDirectoryPickerSupported()) {
      toast.error('Votre navigateur ne permet pas d’ouvrir un dossier (Chrome/Edge requis)');
      return;
    }

    setIsBusy('Lecture du dossier…');
    const result = await importDirectory(({ processed, currentPath }) =>
      setIsBusy(`Lecture du dossier… ${processed} fichier(s) (${currentPath.slice(-40)})`)
    );
    setIsBusy(null);

    if (!result) return;
    if (result.files.length === 0) {
      toast.error('Aucun fichier exploitable dans ce dossier');
      return;
    }

    workspace.replaceWorkspace(result.files, result.folders);
    tabsApi.closeAllTabs();

    toast.success(
      `« ${result.rootName} » ouvert : ${result.files.length} fichier(s)` +
        (result.truncated ? ' (limite atteinte, import partiel)' : ''),
      {
        description:
          'Ctrl+S réécrit directement sur le disque. ' +
          (result.skipped.length > 0 ? `${result.skipped.length} élément(s) ignoré(s).` : ''),
        action: {
          label: 'Annuler',
          onClick: () => {
            if (workspace.undoDelete()) toast.success('Ouverture annulée');
          },
        },
        duration: 12000,
      }
    );
  }, [workspace, tabsApi]);

  const handleImportInput = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(event.target.files ?? []);
      event.target.value = '';
      if (selected.length === 0) return;

      const incoming = await Promise.all(
        selected.map(async (file) => ({
          name: file.name,
          language: getLanguageFromFilename(file.name),
          content: await file.text(),
          modified: false,
        }))
      );

      const ids = workspace.addFiles(incoming);
      if (ids[0]) tabsApi.openTab(ids[0]);
      toast.success(`${ids.length} fichier(s) importé(s)`);
    },
    [workspace, tabsApi]
  );

  const handleDropFiles = useCallback(
    async (dropped: FileList, parentId?: string) => {
      const incoming = await Promise.all(
        Array.from(dropped).map(async (file) => ({
          name: file.name,
          language: getLanguageFromFilename(file.name),
          content: await file.text(),
          modified: false,
        }))
      );
      const ids = workspace.addFiles(incoming, parentId);
      toast.success(`${ids.length} fichier(s) importé(s)`);
    },
    [workspace]
  );

  const handleSaveFile = useCallback(async () => {
    if (!targetFile) {
      toast.error('Aucun fichier actif à enregistrer');
      return;
    }

    if (!fsSupported && !targetFile.fileHandle) {
      downloadFile(targetFile.content, targetFile.name);
      workspace.markFileSaved(targetFile.id);
      toast.success(`« ${targetFile.name} » téléchargé`);
      return;
    }

    const result = await saveFileChecked(
      targetFile.content,
      targetFile.fileHandle,
      targetFile.name,
      targetFile.diskModifiedAt
    );

    if (result.status === 'cancelled' || result.status === 'unavailable') return;

    if (result.status === 'error') {
      toast.error(`Enregistrement impossible : ${result.message}`);
      return;
    }

    if (result.status === 'conflict') {
      // Le fichier a changé sur le disque depuis son ouverture : l'écraser
      // ferait perdre le travail de l'autre outil (éditeur, git…).
      const file = targetFile;
      toast.warning('Ce fichier a été modifié en dehors d’H Editor', {
        description: `Modifié sur le disque le ${new Date(result.diskModifiedAt).toLocaleString('fr-FR')}. Écraser remplacerait cette version.`,
        duration: Infinity,
        action: {
          label: 'Écraser',
          onClick: async () => {
            const forced = await saveFileChecked(file.content, file.fileHandle, file.name);
            if (forced.status === 'saved') {
              workspace.markFileSaved(file.id, forced.handle, forced.name, forced.lastModified);
              toast.success(`« ${forced.name} » enregistré`);
            }
          },
        },
        cancel: { label: 'Annuler', onClick: () => undefined },
      });
      return;
    }

    workspace.markFileSaved(targetFile.id, result.handle, result.name, result.lastModified);
    toast.success(`« ${result.name} » enregistré`);
  }, [targetFile, fsSupported, workspace]);

  const handleSaveFileAs = useCallback(async () => {
    if (!targetFile) {
      toast.error('Aucun fichier actif à enregistrer');
      return;
    }

    if (!fsSupported) {
      downloadFile(targetFile.content, targetFile.name);
      toast.success(`« ${targetFile.name} » téléchargé`);
      return;
    }

    const result = await saveFileChecked(targetFile.content, undefined, targetFile.name);
    if (result.status !== 'saved') return;

    workspace.markFileSaved(targetFile.id, result.handle, result.name, result.lastModified);
    toast.success(`Enregistré sous « ${result.name} »`);
  }, [targetFile, fsSupported, workspace]);

  const requestDeleteFile = useCallback(
    (fileId: string) => {
      const file = files.find((f) => f.id === fileId);
      if (!file) return;
      setPendingDeletion({ kind: 'file', id: fileId, name: file.name, warnUnsaved: file.modified });
    },
    [files]
  );

  const requestDeleteFolder = useCallback(
    (folderId: string) => {
      const folder = folders.find((f) => f.id === folderId);
      if (!folder) return;
      setPendingDeletion({ kind: 'folder', id: folderId, name: folder.name, warnUnsaved: false });
    },
    [folders]
  );

  const confirmDeletion = useCallback(() => {
    if (!pendingDeletion) return;

    const label = pendingDeletion.name;
    if (pendingDeletion.kind === 'file') workspace.deleteFile(pendingDeletion.id);
    else workspace.deleteFolder(pendingDeletion.id);

    setPendingDeletion(null);
    toast.success(`« ${label} » supprimé`, {
      description: 'Restaurable ensuite depuis la palette de commandes.',
      action: {
        label: 'Annuler',
        onClick: () => {
          if (workspace.undoDelete()) toast.success('Suppression annulée');
        },
      },
      duration: 8000,
    });
  }, [pendingDeletion, workspace]);

  const handleDuplicateFile = useCallback(
    (fileId: string) => {
      const id = workspace.duplicateFile(fileId);
      if (id) {
        tabsApi.openTab(id);
        toast.success('Fichier dupliqué');
      }
    },
    [workspace, tabsApi]
  );

  const handleMoveFolder = useCallback(
    (folderId: string, newParentId?: string) => {
      if (!workspace.moveFolder(folderId, newParentId)) {
        toast.error('Impossible de déplacer un dossier dans lui-même');
      }
    },
    [workspace]
  );

  // ── Import / export ───────────────────────────────────────────────────────

  const handleImportJSON = useCallback(
    (json: string, fileName?: string) => {
      const result = analyzeJSONImport(json);

      if (result.kind === 'invalid') {
        toast.error('JSON illisible : le fichier n’a pas pu être analysé.');
        return;
      }

      if (result.kind === 'file') {
        // Un JSON valide qui n'est pas une sauvegarde de projet reste utile :
        // on l'ajoute comme fichier ordinaire plutôt que de le rejeter.
        const name = fileName?.trim() ? fileName.trim() : 'donnees.json';
        const id = workspace.createFile(undefined, name, json);
        tabsApi.openTab(id);
        toast.success(`« ${name} » ajouté au projet`, {
          description:
            'Ce JSON n’était pas une sauvegarde de projet, il a été ajouté comme fichier ordinaire.',
        });
        return;
      }

      workspace.replaceWorkspace(result.structure.files, result.structure.folders);
      tabsApi.closeAllTabs();
      toast.success(`Projet importé (${result.structure.files.length} fichiers)`, {
        action: {
          label: 'Annuler',
          onClick: () => {
            if (workspace.undoDelete()) toast.success('Import annulé');
          },
        },
        duration: 10000,
      });
    },
    [workspace, tabsApi]
  );

  const handleImportZip = useCallback(
    async (file: File) => {
      setIsBusy('Import du ZIP…');
      const imported = await importFromZip(file, ({ processed, total }) =>
        setIsBusy(`Import du ZIP… ${processed}/${total}`)
      );
      setIsBusy(null);

      if (!imported) {
        toast.error('Archive ZIP illisible');
        return;
      }

      workspace.replaceWorkspace(imported.files, imported.folders);
      tabsApi.closeAllTabs();

      const skipped = imported.skipped.length;
      const binaries = imported.preservedBinaries.length;
      toast.success(
        `Projet importé : ${imported.files.length} fichiers` +
          (binaries ? `, dont ${binaries} binaire(s) conservé(s)` : '') +
          (skipped ? `, ${skipped} ignoré(s) car trop volumineux` : ''),
        {
          action: {
            label: 'Annuler',
            onClick: () => {
              if (workspace.undoDelete()) toast.success('Import annulé');
            },
          },
          duration: 10000,
        }
      );
    },
    [workspace, tabsApi]
  );

  const handleExportJSON = useCallback(() => {
    downloadJSON(files, folders);
    toast.success('Projet exporté en JSON');
  }, [files, folders]);

  const handleExportZip = useCallback(async () => {
    setIsBusy('Création de l’archive…');
    try {
      await downloadAsZip(files, folders);
      toast.success('Projet exporté en ZIP');
    } catch {
      toast.error('Export ZIP impossible');
    } finally {
      setIsBusy(null);
    }
  }, [files, folders]);

  // ── Formatage ─────────────────────────────────────────────────────────────

  const formatFile = useCallback(
    async (file: EditorFile | null) => {
      if (!file) {
        toast.error('Aucun fichier actif à formater');
        return;
      }
      if (!canFormat(file.language)) {
        toast.error(`Formatage non supporté pour ${file.language}`);
        return;
      }

      try {
        const formatted = await formatCode(
          file.content,
          file.language,
          settings.tabSize,
          settings.insertSpaces
        );
        if (formatted !== file.content) {
          workspace.updateFileContent(file.id, formatted);
          toast.success('Document formaté');
        } else {
          toast.info('Document déjà formaté');
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erreur de formatage');
      }
    },
    [settings.tabSize, settings.insertSpaces, workspace]
  );

  const handleFormatDocument = useCallback(
    () => formatFile(targetFile),
    [formatFile, targetFile]
  );

  // ── Recherche ─────────────────────────────────────────────────────────────

  const handleSearchResultClick = useCallback(
    (fileId: string, line: number, column: number) => {
      // En mode split, la navigation doit viser l'éditeur du panneau actif :
      // l'ancienne version pilotait toujours l'éditeur principal, démonté à ce moment-là.
      if (split.isSplit) split.openInPanel(split.activePanel, fileId);
      else tabsApi.openTab(fileId);

      // L'éditeur peut ne pas être encore monté (chargement paresseux) ou le
      // modèle pas encore remplacé : on réessaie brièvement.
      // (Pas de requestAnimationFrame ici : il est suspendu quand la fenêtre
      // n'est pas au premier plan, et la navigation ne se faisait alors jamais.)
      let attempts = 0;
      const goTo = () => {
        const editor = activeEditorRef.current;
        if (editor) {
          editor.goToPosition(line, column);
          return;
        }
        if (attempts++ < 20) setTimeout(goTo, 50);
      };
      setTimeout(goTo, 50);
    },
    [split, tabsApi, activeEditorRef]
  );

  const handleReplaceInFiles = useCallback(
    (replacements: { fileId: string; content: string }[]) => {
      replacements.forEach(({ fileId, content }) => workspace.updateFileContent(fileId, content));
    },
    [workspace]
  );

  // ── Disposition ───────────────────────────────────────────────────────────

  const handleToggleZen = useCallback(() => {
    setZenMode((prev) => {
      if (!prev) toast.success('Mode Zen activé, Échap pour quitter');
      return !prev;
    });
  }, []);

  /** Bascule entre édition et aperçu plein écran (Ctrl+Maj+V). */
  const handleTogglePreviewFullScreen = useCallback(() => {
    if (!previewAvailable) {
      toast.info('Ouvrez un fichier HTML ou Markdown pour l’aperçu plein écran');
      return;
    }
    // Passer en plein écran implique d'afficher l'aperçu.
    if (!settings.previewVisible) updateSettings({ previewVisible: true });
    setPreviewFullScreen((full) => !full);
  }, [previewAvailable, settings.previewVisible, updateSettings]);

  const handleTogglePreview = useCallback(() => {
    if (!previewAvailable) {
      toast.info('Aperçu disponible pour les fichiers Markdown et HTML');
      return;
    }
    updateSettings({ previewVisible: !settings.previewVisible });
  }, [previewAvailable, settings.previewVisible, updateSettings]);

  // ── Raccourcis clavier ────────────────────────────────────────────────────

  const shortcuts = useMemo<KeyboardShortcut[]>(
    () => [
      { key: 's', ctrl: true, allowInInput: true, handler: handleSaveFile, description: 'Enregistrer' },
      {
        key: 's',
        ctrl: true,
        shift: true,
        allowInInput: true,
        handler: handleSaveFileAs,
        description: 'Enregistrer sous…',
      },
      { key: 'o', ctrl: true, allowInInput: true, handler: handleOpenFile, description: 'Ouvrir un fichier' },
      {
        key: 'n',
        ctrl: true,
        allowInInput: true,
        handler: () => handleNewFile(),
        description: 'Nouveau fichier',
      },
      {
        key: 'p',
        ctrl: true,
        shift: true,
        allowInInput: true,
        handler: () => setCommandPaletteOpen(true),
        description: 'Palette de commandes',
      },
      {
        key: 'p',
        ctrl: true,
        allowInInput: true,
        handler: () => setQuickOpenOpen(true),
        description: 'Aller à un fichier',
      },
      {
        key: 'w',
        ctrl: true,
        handler: () => {
          if (!activeFile) return false;
          tabsApi.closeTab(activeFile.id);
          return true;
        },
        description: "Fermer l'onglet",
      },
      {
        key: 't',
        ctrl: true,
        shift: true,
        allowInInput: true,
        handler: () => {
          if (!tabsApi.reopenLastTab()) {
            toast.info('Aucun onglet à rouvrir');
            return false;
          }
          return true;
        },
        description: 'Rouvrir le dernier onglet',
      },
      {
        key: 'b',
        ctrl: true,
        allowInInput: true,
        handler: () => setSidebarVisible((v) => !v),
        description: "Afficher/masquer l'explorateur",
      },
      {
        key: 'f',
        shift: true,
        alt: true,
        handler: handleFormatDocument,
        description: 'Formater le document',
      },
      {
        key: '\\',
        ctrl: true,
        handler: () => split.toggleSplit('vertical', targetFile?.id),
        description: 'Diviser horizontalement',
      },
      {
        key: '\\',
        ctrl: true,
        shift: true,
        handler: () => split.toggleSplit('horizontal', targetFile?.id),
        description: 'Diviser verticalement',
      },
      {
        key: 'f',
        ctrl: true,
        handler: () => activeEditorRef.current?.triggerFind(),
        description: 'Rechercher dans le fichier',
      },
      {
        key: 'h',
        ctrl: true,
        handler: () => activeEditorRef.current?.triggerFindReplace(),
        description: 'Rechercher et remplacer',
      },
      {
        key: 'f',
        ctrl: true,
        shift: true,
        allowInInput: true,
        handler: () => setSearchPanelOpen(true),
        description: 'Rechercher dans tous les fichiers',
      },
      {
        key: 'v',
        ctrl: true,
        shift: true,
        allowInInput: true,
        handler: handleTogglePreviewFullScreen,
        description: 'Aperçu plein écran',
      },
      { key: 'F11', allowInInput: true, handler: handleToggleZen, description: 'Mode Zen' },
      {
        key: 'Escape',
        allowInInput: true,
        handler: () => {
          // Renvoyer false laisse l'événement disponible pour Monaco et les dialogues :
          // Échap n'est plus intercepté systématiquement.
          if (previewFullScreen) {
            setPreviewFullScreen(false);
            return true;
          }
          if (!zenMode) return false;
          setZenMode(false);
          return true;
        },
        description: 'Quitter le mode Zen',
      },
    ],
    [
      handleSaveFile,
      handleSaveFileAs,
      handleOpenFile,
      handleNewFile,
      handleFormatDocument,
      handleTogglePreviewFullScreen,
      handleToggleZen,
      activeFile,
      tabsApi,
      split,
      targetFile,
      activeEditorRef,
      zenMode,
      previewFullScreen,
    ]
  );

  useKeyboardShortcuts(shortcuts);

  const commands = useMemo(
    () => [
      { id: 'quick-open', label: 'Aller à un fichier…', icon: <FileText className="h-4 w-4" />, shortcut: shortcuts[5], action: () => setQuickOpenOpen(true) },
      { id: 'new-file', label: 'Nouveau fichier', icon: <Plus className="h-4 w-4" />, shortcut: shortcuts[3], action: () => handleNewFile() },
      { id: 'new-folder', label: 'Nouveau dossier', icon: <FolderPlus className="h-4 w-4" />, action: () => handleNewFolder() },
      ...FILE_TEMPLATES.map((template) => ({
        id: `template-${template.id}`,
        label: `Nouveau : ${template.label}`,
        icon: <FileCode2 className="h-4 w-4" />,
        action: () => handleNewFromTemplate(template.id),
      })),
      { id: 'open-file', label: 'Ouvrir un fichier', icon: <FolderOpen className="h-4 w-4" />, shortcut: shortcuts[2], action: handleOpenFile },
      { id: 'save-file', label: 'Enregistrer', icon: <Save className="h-4 w-4" />, shortcut: shortcuts[0], action: handleSaveFile },
      { id: 'save-file-as', label: 'Enregistrer sous…', icon: <Save className="h-4 w-4" />, shortcut: shortcuts[1], action: handleSaveFileAs },
      { id: 'close-tab', label: "Fermer l'onglet", icon: <X className="h-4 w-4" />, shortcut: shortcuts[6], action: () => activeFile && tabsApi.closeTab(activeFile.id) },
      { id: 'reopen-tab', label: 'Rouvrir le dernier onglet fermé', icon: <FileText className="h-4 w-4" />, shortcut: shortcuts[7], action: () => tabsApi.reopenLastTab() },
      { id: 'format-document', label: 'Formater le document', icon: <AlignLeft className="h-4 w-4" />, shortcut: shortcuts[9], action: handleFormatDocument },
      { id: 'toggle-preview', label: previewOpen ? "Masquer l'aperçu" : "Afficher l'aperçu", icon: <Eye className="h-4 w-4" />, action: handleTogglePreview },
      { id: 'preview-fullscreen', label: previewFullScreen ? "Quitter l'aperçu plein écran" : 'Aperçu plein écran (tester le site)', icon: <Eye className="h-4 w-4" />, shortcut: shortcuts[15], action: handleTogglePreviewFullScreen },
      { id: 'toggle-sidebar', label: sidebarVisible ? "Masquer l'explorateur" : "Afficher l'explorateur", icon: <PanelLeft className="h-4 w-4" />, shortcut: shortcuts[8], action: () => setSidebarVisible((v) => !v) },
      { id: 'split-vertical', label: 'Diviser horizontalement', icon: <Split className="h-4 w-4" />, shortcut: shortcuts[10], action: () => split.toggleSplit('vertical', targetFile?.id) },
      { id: 'split-horizontal', label: 'Diviser verticalement', icon: <Columns2 className="h-4 w-4" />, shortcut: shortcuts[11], action: () => split.toggleSplit('horizontal', targetFile?.id) },
      { id: 'close-split', label: 'Fermer la division', icon: <X className="h-4 w-4" />, action: split.closeSplit },
      { id: 'search-local', label: 'Rechercher dans le fichier', icon: <Search className="h-4 w-4" />, shortcut: shortcuts[12], action: () => activeEditorRef.current?.triggerFind() },
      { id: 'search-replace', label: 'Rechercher et remplacer', icon: <Search className="h-4 w-4" />, shortcut: shortcuts[13], action: () => activeEditorRef.current?.triggerFindReplace() },
      { id: 'search-global', label: 'Rechercher dans tous les fichiers', icon: <Search className="h-4 w-4" />, shortcut: shortcuts[14], action: () => setSearchPanelOpen(true) },
      { id: 'export-json', label: 'Exporter en JSON', icon: <Download className="h-4 w-4" />, action: handleExportJSON },
      { id: 'export-zip', label: 'Exporter en ZIP', icon: <Download className="h-4 w-4" />, action: handleExportZip },
      { id: 'import-files', label: 'Importer des fichiers', icon: <Upload className="h-4 w-4" />, action: () => fileImportRef.current?.click() },
      ...(isDirectoryPickerSupported()
        ? [{ id: 'open-directory', label: 'Ouvrir un dossier du disque…', icon: <FolderTree className="h-4 w-4" />, action: handleOpenDirectory }]
        : []),
      ...workspace.trash.map((entry, index) => ({
        id: `restore-${entry.id}`,
        label: `Restaurer « ${entry.label} »${index === 0 ? ' (dernière suppression)' : ''}`,
        icon: <Undo2 className="h-4 w-4" />,
        action: () => {
          const label = workspace.restoreFromTrash(entry.id);
          if (label) toast.success(`« ${label} » restauré`);
        },
      })),
      { id: 'settings', label: 'Paramètres', icon: <CommandIcon className="h-4 w-4" />, action: () => setSettingsOpen(true) },
      { id: 'zen-mode', label: zenMode ? 'Quitter le mode Zen' : 'Mode Zen', icon: zenMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />, shortcut: shortcuts[15], action: handleToggleZen },
    ],
    [
      shortcuts,
      handleNewFile,
      handleNewFromTemplate,
      handleNewFolder,
      handleOpenFile,
      handleSaveFile,
      handleSaveFileAs,
      handleFormatDocument,
      handleTogglePreview,
      handleTogglePreviewFullScreen,
      previewFullScreen,
      handleExportJSON,
      handleExportZip,
      handleOpenDirectory,
      handleToggleZen,
      previewOpen,
      sidebarVisible,
      zenMode,
      activeFile,
      tabsApi,
      split,
      targetFile,
      activeEditorRef,
    ]
  );

  // ── Auto-enregistrement sur disque (uniquement les fichiers déjà liés) ────

  // Les données sont lues via une ref : sinon l'intervalle serait détruit et
  // recréé à chaque frappe, et ne se déclencherait jamais pendant la saisie.
  const autoSaveData = useRef({ files, markFileSaved: workspace.markFileSaved });
  autoSaveData.current = { files, markFileSaved: workspace.markFileSaved };

  useEffect(() => {
    if (!settings.autoSave.enabled) return;

    let running = false;
    const timer = setInterval(async () => {
      if (running) return; // évite le chevauchement sur un disque lent
      running = true;
      try {
        // On n'ouvre JAMAIS de sélecteur de fichier : seuls les fichiers
        // possédant déjà un handle disque sont réécrits.
        const { files: current, markFileSaved } = autoSaveData.current;
        for (const file of current.filter((f) => f.modified && f.fileHandle)) {
          const handle = await saveFile(file.content, file.fileHandle);
          if (handle) markFileSaved(file.id, handle);
        }
      } finally {
        running = false;
      }
    }, settings.autoSave.interval);

    return () => clearInterval(timer);
  }, [settings.autoSave.enabled, settings.autoSave.interval]);

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-editor-background">
        <div className="flex items-center gap-3 text-editor-text-muted">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          <span>Chargement de votre espace de travail…</span>
        </div>
      </div>
    );
  }

  const renderEditorPane = (
    file: EditorFile | null,
    editorRef: React.RefObject<MonacoEditorRef>,
    panel: 'topLeft' | 'bottomRight',
    label: string
  ) => (
    <section
      className={`flex h-full flex-col transition-colors ${
        split.activePanel === panel ? 'ring-1 ring-inset ring-primary/60' : ''
      }`}
      onFocus={() => split.setActivePanel(panel)}
      onClick={() => split.setActivePanel(panel)}
      aria-label={`Panneau ${label}`}
    >
      <header className="flex h-9 items-center justify-between border-b border-editor-border bg-editor-tab-active px-3">
        <span className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate text-sm text-editor-text">{file?.name ?? 'Aucun fichier'}</span>
          {file?.modified && (
            <span className="text-xs text-editor-text-muted" title="Non enregistré sur le disque">
              ●
            </span>
          )}
        </span>
        <span className="text-xs uppercase text-editor-text-muted">{label}</span>
      </header>
      <div className="min-h-0 flex-1">
        <MonacoEditor
          ref={editorRef}
          file={file}
          settings={settings}
          onChange={(value) => handleContentChange(file?.id, value)}
          onRequestFormat={() => formatFile(file)}
          onFocus={() => split.setActivePanel(panel)}
          onCursorPositionChange={(line, column) =>
            split.activePanel === panel && setCursorPosition({ line, column })
          }
          onSelectionChange={(length) => split.activePanel === panel && setSelectionLength(length)}
        />
      </div>
    </section>
  );

  return (
    <div className={`flex h-screen w-full flex-col bg-editor-background ${zenMode ? 'zen-mode' : ''}`}>
      {/* Barre d'outils */}
      {!zenMode && (
        <header className="flex h-12 items-center justify-between border-b border-editor-border bg-editor-sidebar px-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Tooltip delayDuration={400}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSidebarVisible((v) => !v)}
                  aria-label={sidebarVisible ? "Masquer l'explorateur" : "Afficher l'explorateur"}
                  aria-pressed={sidebarVisible}
                >
                  <PanelLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Explorateur (Ctrl+B)</TooltipContent>
            </Tooltip>

            <AppTitle />
          </div>

          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Actions principales">
            <Tooltip delayDuration={400}>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={handleOpenFile} className="gap-2" aria-label="Ouvrir un fichier">
                  <FolderOpen className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Ouvrir</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ouvrir un fichier (Ctrl+O)</TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={400}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveFile}
                  className="gap-2"
                  disabled={!targetFile}
                  aria-label={fsSupported ? 'Enregistrer le fichier' : 'Télécharger le fichier'}
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{fsSupported ? 'Enregistrer' : 'Télécharger'}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {fsSupported ? 'Enregistrer sur le disque (Ctrl+S)' : 'Télécharger le fichier (Ctrl+S)'}
              </TooltipContent>
            </Tooltip>

            <span className="hidden h-4 w-px bg-editor-border sm:block" />

            <Tooltip delayDuration={400}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleTogglePreview}
                  disabled={!previewAvailable}
                  aria-label={previewOpen ? "Masquer l'aperçu" : "Afficher l'aperçu"}
                  aria-pressed={previewOpen}
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Aperçu Markdown / HTML</TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={400}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => split.toggleSplit('vertical', targetFile?.id)}
                  aria-label="Diviser l'éditeur horizontalement"
                  aria-pressed={split.splitView === 'vertical'}
                >
                  <Split className="h-4 w-4 rotate-90" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Diviser horizontalement (Ctrl+\)</TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={400}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => split.toggleSplit('horizontal', targetFile?.id)}
                  aria-label="Diviser l'éditeur verticalement"
                  aria-pressed={split.splitView === 'horizontal'}
                >
                  <SplitSquareHorizontal className="h-4 w-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Diviser verticalement (Ctrl+Maj+\)</TooltipContent>
            </Tooltip>

            <span className="hidden h-4 w-px bg-editor-border sm:block" />

            <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSettingsOpen(true)} aria-label="Paramètres">
              <CommandIcon className="hidden h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Paramètres</span>
              <span className="sm:hidden" aria-hidden="true">⚙</span>
            </Button>

            <Button variant="ghost" size="sm" className="gap-2" onClick={() => setInfoOpen(true)} aria-label="Informations et aide">
              <span className="hidden sm:inline">Info</span>
              <span className="sm:hidden" aria-hidden="true">?</span>
            </Button>

            <Tooltip delayDuration={400}>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => setCommandPaletteOpen(true)} className="gap-2" aria-label="Palette de commandes">
                  <CommandIcon className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Commandes</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Palette de commandes (Ctrl+Maj+P)</TooltipContent>
            </Tooltip>
          </nav>
        </header>
      )}

      {/* Aperçu plein écran : le site occupe toute la fenêtre. */}
      {previewFullScreen && previewOpen && targetFile && (
        <div className="flex min-h-0 flex-1">
          <Suspense fallback={null}>
            <PreviewPanel
              content={targetFile.content}
              language={targetFile.language}
              file={targetFile}
              files={files}
              folders={folders}
              fullScreen
              onToggleFullScreen={handleTogglePreviewFullScreen}
              onOpenFile={(fileId) => {
                // Ouvrir le fichier fautif implique de quitter le plein écran.
                setPreviewFullScreen(false);
                handleFileSelect(fileId);
              }}
              onClose={() => {
                setPreviewFullScreen(false);
                updateSettings({ previewVisible: false });
              }}
            />
          </Suspense>
        </div>
      )}

      {/* Corps */}
      <div className={`flex min-h-0 flex-1 ${previewFullScreen ? 'hidden' : ''}`}>
        {searchPanelOpen && !zenMode && (
          <>
            <Suspense fallback={null}>
              <SearchPanel
                files={files}
                width={settings.searchPanelWidth}
                onClose={() => setSearchPanelOpen(false)}
                onResultClick={handleSearchResultClick}
                onReplace={handleReplaceInFiles}
              />
            </Suspense>
            <ResizeHandle
              width={settings.searchPanelWidth}
              onWidthChange={(searchPanelWidth) => updateSettings({ searchPanelWidth })}
              label="Redimensionner le panneau de recherche"
            />
          </>
        )}

        {sidebarVisible && !zenMode && (
          <Sidebar
            files={files}
            folders={folders}
            activeFileId={targetFile?.id ?? null}
            onFileSelect={handleFileSelect}
            onNewFile={handleNewFile}
            onNewFromTemplate={handleNewFromTemplate}
            onNewFolder={handleNewFolder}
            onToggleFolder={workspace.toggleFolder}
            onImportJSON={handleImportJSON}
            onExportJSON={handleExportJSON}
            onImportZip={handleImportZip}
            onExportZip={handleExportZip}
            onOpenDirectory={isDirectoryPickerSupported() ? handleOpenDirectory : undefined}
            onDropFiles={handleDropFiles}
            onRenameFile={workspace.renameFile}
            onRenameFolder={workspace.renameFolder}
            onDeleteFile={requestDeleteFile}
            onDeleteFolder={requestDeleteFolder}
            onMoveFile={workspace.moveFile}
            onMoveFolder={handleMoveFolder}
            onDuplicateFile={handleDuplicateFile}
            splitView={split.splitView}
            onOpenInPanel={split.openInPanel}
            onClose={() => setSidebarVisible(false)}
            width={settings.sidebarWidth}
          />
        )}

        {sidebarVisible && !zenMode && (
          <ResizeHandle
            width={settings.sidebarWidth}
            onWidthChange={(sidebarWidth) => updateSettings({ sidebarWidth })}
            label="Redimensionner l'explorateur"
          />
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          {!zenMode && (
            <TabBar
              tabs={tabs}
              files={files}
              onTabClick={tabsApi.activateTab}
              onTabClose={tabsApi.closeTab}
              onCloseOthers={tabsApi.closeOtherTabs}
              onCloseAll={tabsApi.closeAllTabs}
              onReorder={tabsApi.moveTab}
            />
          )}

          <div className="flex min-h-0 flex-1">
            <div className={`min-w-0 flex-1 ${previewOpen ? 'hidden md:block' : ''}`}>
              {split.isSplit ? (
                <ResizablePanelGroup direction={split.splitView === 'horizontal' ? 'horizontal' : 'vertical'}>
                  <ResizablePanel defaultSize={50} minSize={15}>
                    {renderEditorPane(
                      topLeftFile,
                      topLeftEditorRef,
                      'topLeft',
                      split.splitView === 'vertical' ? 'Haut' : 'Gauche'
                    )}
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={50} minSize={15}>
                    {renderEditorPane(
                      bottomRightFile,
                      bottomRightEditorRef,
                      'bottomRight',
                      split.splitView === 'vertical' ? 'Bas' : 'Droite'
                    )}
                  </ResizablePanel>
                </ResizablePanelGroup>
              ) : (
                <MonacoEditor
                  ref={mainEditorRef}
                  file={activeFile}
                  settings={settings}
                  onChange={(value) => handleContentChange(activeFile?.id, value)}
                  onRequestFormat={() => formatFile(activeFile)}
                  onCursorPositionChange={(line, column) => setCursorPosition({ line, column })}
                  onSelectionChange={setSelectionLength}
                />
              )}
            </div>

            {/* L'aperçu n'occupe de la place que lorsqu'il est réellement affiché :
                auparavant l'éditeur était bridé à 50 % pour tout fichier Markdown.
                En plein écran, ce panneau n'est pas monté du tout — deux iframes
                exécuteraient le site en double et mêleraient leurs consoles. */}
            {previewOpen && targetFile && !previewFullScreen && (
              <div className="w-full min-w-0 md:w-1/2">
                <Suspense fallback={null}>
                  <PreviewPanel
                    content={targetFile.content}
                    language={targetFile.language}
                    file={targetFile}
                    files={files}
                    folders={folders}
                    onToggleFullScreen={handleTogglePreviewFullScreen}
                    onOpenFile={handleFileSelect}
                    onClose={() => updateSettings({ previewVisible: false })}
                  />
                </Suspense>
              </div>
            )}
          </div>
        </main>
      </div>

      {!zenMode && !previewFullScreen && (
        <StatusBar
          activeFile={targetFile}
          splitView={split.splitView}
          onCloseSplit={split.closeSplit}
          cursorPosition={cursorPosition}
          selectionLength={selectionLength}
          storageStatus={storageStatus}
          usage={workspace.usage}
          fileCount={files.length}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {zenMode && (
        <div className="animate-fade-in fixed bottom-4 right-4 z-50 rounded-lg border border-border bg-popover/90 px-3 py-1.5 shadow-lg backdrop-blur-sm">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
            Mode Zen
            <span className="text-xs opacity-70">Échap pour quitter</span>
          </span>
        </div>
      )}

      {isBusy && (
        <div
          className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-popover px-4 py-2 shadow-lg"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
          <span className="text-sm text-foreground">{isBusy}</span>
        </div>
      )}

      <input
        ref={fileImportRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleImportInput}
        aria-hidden="true"
        tabIndex={-1}
      />

      <Suspense fallback={null}>
        {commandPaletteOpen && (
          <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} commands={commands} />
        )}
        {quickOpenOpen && (
          <QuickOpen
            open={quickOpenOpen}
            onOpenChange={setQuickOpenOpen}
            files={files}
            folders={folders}
            onSelect={handleFileSelect}
          />
        )}
        {settingsOpen && (
          <SettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            settings={settings}
            onSettingsChange={setSettings}
            onReset={resetSettings}
          />
        )}
        {infoOpen && <InfoDialog open={infoOpen} onOpenChange={setInfoOpen} />}
      </Suspense>

      <AlertDialog open={pendingDeletion !== null} onOpenChange={(open) => !open && setPendingDeletion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer {pendingDeletion?.kind === 'folder' ? 'le dossier' : 'le fichier'} « {pendingDeletion?.name} » ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeletion?.kind === 'folder'
                ? 'Le dossier et tout son contenu seront supprimés.'
                : 'Le fichier sera retiré de votre espace de travail.'}{' '}
              {pendingDeletion?.warnUnsaved && 'Il contient des modifications non enregistrées sur le disque. '}
              Vous pourrez annuler juste après.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletion}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EditorLayout;
