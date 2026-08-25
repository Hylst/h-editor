import { Info, Keyboard, Lightbulb, ShieldCheck, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { APP_AUTHOR, APP_VERSION } from '@/utils/appInfo';

interface InfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUTS: [string, string][] = [
  ['Ctrl + S', 'Enregistrer sur le disque'],
  ['Ctrl + Maj + S', 'Enregistrer sous…'],
  ['Ctrl + O', 'Ouvrir un fichier'],
  ['Ctrl + N', 'Nouveau fichier'],
  ['Ctrl + P', 'Aller à un fichier'],
  ['Ctrl + Maj + P', 'Palette de commandes'],
  ['Ctrl + B', 'Afficher/masquer l’explorateur'],
  ['Ctrl + W', 'Fermer l’onglet'],
  ['Ctrl + Maj + T', 'Rouvrir le dernier onglet fermé'],
  ['Ctrl + F', 'Rechercher dans le fichier'],
  ['Ctrl + H', 'Rechercher et remplacer'],
  ['Ctrl + Maj + F', 'Rechercher dans tous les fichiers'],
  ['Alt + Maj + F', 'Formater le document'],
  ['Ctrl + \\', 'Diviser horizontalement'],
  ['Ctrl + Maj + \\', 'Diviser verticalement'],
  ['F11', 'Mode Zen'],
];

const TIPS: string[] = [
  'Double-cliquez sur un fichier de l’explorateur pour le renommer.',
  'Glissez un fichier sur un dossier pour le déplacer ; « Déposer à la racine » apparaît pendant le glisser.',
  'Clic milieu sur un onglet pour le fermer, clic droit pour « Fermer les autres ».',
  'Fermer un onglet ne supprime pas le fichier : il reste dans l’explorateur.',
  'Une suppression peut être annulée depuis la notification qui suit.',
  'L’aperçu fonctionne pour le Markdown et le HTML (rendu dans une iframe isolée).',
  'Exportez régulièrement en ZIP : c’est la sauvegarde la plus sûre.',
];

const InfoDialog = ({ open, onOpenChange }: InfoDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[85vh] max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl">
          <Info className="h-5 w-5 text-primary" aria-hidden="true" />
          À propos d’EditorX
        </DialogTitle>
      </DialogHeader>

      <Tabs defaultValue="about" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="about" className="gap-2">
            <User className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">À propos</span>
          </TabsTrigger>
          <TabsTrigger value="shortcuts" className="gap-2">
            <Keyboard className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Raccourcis</span>
          </TabsTrigger>
          <TabsTrigger value="tips" className="gap-2">
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Astuces</span>
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="mt-4 h-[400px] pr-4">
          <TabsContent value="about" className="space-y-4">
            <div className="py-4 text-center">
              <p className="bg-gradient-to-r from-primary to-accent bg-clip-text text-3xl font-bold text-transparent">
                EditorX
              </p>
              <p className="text-muted-foreground">Éditeur de code 100 % local — version {APP_VERSION}</p>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4">
              <h3 className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                Confidentialité
              </h3>
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                <li>Aucun serveur, aucun compte, aucune télémétrie.</li>
                <li>Monaco est embarqué dans l’application : aucun appel à un CDN tiers.</li>
                <li>
                  Vos fichiers restent dans le navigateur : métadonnées en localStorage, contenu en
                  IndexedDB.
                </li>
                <li>Les aperçus Markdown sont désinfectés, les aperçus HTML isolés en iframe.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Technologies</h3>
              <p className="text-sm text-muted-foreground">
                React 18, TypeScript, Vite, Monaco Editor, Tailwind CSS, Radix UI, Prettier, JSZip.
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold">Créateur</h3>
              <p className="text-sm text-muted-foreground">{APP_AUTHOR} — licence MIT</p>
            </div>
          </TabsContent>

          <TabsContent value="shortcuts">
            <table className="w-full text-sm">
              <caption className="sr-only">Liste des raccourcis clavier</caption>
              <tbody>
                {SHORTCUTS.map(([keys, label]) => (
                  <tr key={keys} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4">
                      <kbd className="rounded bg-muted px-2 py-1 font-mono text-xs">{keys}</kbd>
                    </td>
                    <td className="py-2 text-muted-foreground">{label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">
              Sur macOS, remplacez Ctrl par ⌘.
            </p>
          </TabsContent>

          <TabsContent value="tips">
            <ul className="space-y-3">
              {TIPS.map((tip) => (
                <li key={tip} className="flex gap-3 text-sm text-muted-foreground">
                  <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                  {tip}
                </li>
              ))}
            </ul>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </DialogContent>
  </Dialog>
);

export default InfoDialog;
