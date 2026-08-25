import { useEffect, useState } from 'react';
import { Code2, Palette, RotateCcw, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  SETTINGS_LIMITS,
  type EditorSettings,
  type EditorTheme,
  type UiTheme,
} from '@/types/settings';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: EditorSettings;
  onSettingsChange: (settings: EditorSettings) => void;
  onReset: () => void;
}

/**
 * Les valeurs numériques passent par un `Slider` borné plutôt que par un champ
 * libre : impossible de produire un `NaN` (l'ancien `parseInt('')` enregistrait
 * `fontSize: null` et rendait l'éditeur illisible).
 */
const SettingsDialog = ({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
  onReset,
}: SettingsDialogProps) => {
  const [autoSaveSeconds, setAutoSaveSeconds] = useState(settings.autoSave.interval / 1000);

  useEffect(() => {
    setAutoSaveSeconds(settings.autoSave.interval / 1000);
  }, [settings.autoSave.interval]);

  const update = (patch: Partial<EditorSettings>) => onSettingsChange({ ...settings, ...patch });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Paramètres de l’éditeur</DialogTitle>
          <DialogDescription>Personnalisez votre expérience d’édition.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="appearance" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="appearance" className="gap-2">
              <Palette className="h-4 w-4" aria-hidden="true" />
              Apparence
            </TabsTrigger>
            <TabsTrigger value="editor" className="gap-2">
              <Code2 className="h-4 w-4" aria-hidden="true" />
              Éditeur
            </TabsTrigger>
            <TabsTrigger value="general" className="gap-2">
              <Save className="h-4 w-4" aria-hidden="true" />
              Sauvegarde
            </TabsTrigger>
          </TabsList>

          {/* ── Apparence ── */}
          <TabsContent value="appearance" className="mt-4 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="ui-theme">Thème de l’interface</Label>
              <Select
                value={settings.uiTheme}
                onValueChange={(value: UiTheme) =>
                  update({
                    uiTheme: value,
                    // Le thème Monaco suit l'interface, sauf contraste élevé.
                    theme:
                      settings.theme === 'hc-black'
                        ? 'hc-black'
                        : value === 'light'
                          ? 'vs-light'
                          : 'vs-dark',
                  })
                }
              >
                <SelectTrigger id="ui-theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Sombre</SelectItem>
                  <SelectItem value="light">Clair</SelectItem>
                  <SelectItem value="system">Système</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                S’applique à toute l’interface, pas seulement à la zone de code.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editor-theme">Thème de la zone de code</Label>
              <Select
                value={settings.theme}
                onValueChange={(value: EditorTheme) => update({ theme: value })}
              >
                <SelectTrigger id="editor-theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vs-dark">Sombre</SelectItem>
                  <SelectItem value="vs-light">Clair</SelectItem>
                  <SelectItem value="hc-black">Contraste élevé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label htmlFor="font-size">
                Taille de police : <span className="font-mono">{settings.fontSize} px</span>
              </Label>
              <Slider
                id="font-size"
                min={SETTINGS_LIMITS.fontSize.min}
                max={SETTINGS_LIMITS.fontSize.max}
                step={1}
                value={[settings.fontSize]}
                onValueChange={([value]) => update({ fontSize: value })}
                aria-label="Taille de police"
              />
            </div>
          </TabsContent>

          {/* ── Éditeur ── */}
          <TabsContent value="editor" className="mt-4 space-y-6">
            <div className="space-y-3">
              <Label htmlFor="tab-size">
                Taille de tabulation : <span className="font-mono">{settings.tabSize}</span>
              </Label>
              <Slider
                id="tab-size"
                min={SETTINGS_LIMITS.tabSize.min}
                max={SETTINGS_LIMITS.tabSize.max}
                step={1}
                value={[settings.tabSize]}
                onValueChange={([value]) => update({ tabSize: value })}
                aria-label="Taille de tabulation"
              />
            </div>

            <div className="space-y-4">
              {(
                [
                  {
                    id: 'word-wrap',
                    label: 'Retour à la ligne automatique',
                    checked: settings.wordWrap === 'on',
                    onChange: (checked: boolean) => update({ wordWrap: checked ? 'on' : 'off' }),
                  },
                  {
                    id: 'minimap',
                    label: 'Afficher la minimap',
                    checked: settings.minimap.enabled,
                    onChange: (checked: boolean) => update({ minimap: { enabled: checked } }),
                  },
                  {
                    id: 'line-numbers',
                    label: 'Afficher les numéros de ligne',
                    checked: settings.lineNumbers !== 'off',
                    onChange: (checked: boolean) => update({ lineNumbers: checked ? 'on' : 'off' }),
                  },
                  {
                    id: 'insert-spaces',
                    label: 'Indenter avec des espaces',
                    checked: settings.insertSpaces,
                    onChange: (checked: boolean) => update({ insertSpaces: checked }),
                  },
                ] as const
              ).map((row) => (
                <div key={row.id} className="flex items-center justify-between">
                  <Label htmlFor={row.id} className="text-sm text-muted-foreground">
                    {row.label}
                  </Label>
                  <Switch id={row.id} checked={row.checked} onCheckedChange={row.onChange} />
                </div>
              ))}
            </div>

            {settings.wordWrap === 'off' && (
              <div className="space-y-3 rounded-lg border border-border bg-muted/50 p-4">
                <Label>Barre de défilement horizontale</Label>
                <RadioGroup
                  value={settings.scrollbar.horizontal}
                  onValueChange={(value: 'auto' | 'visible' | 'hidden') =>
                    update({ scrollbar: { ...settings.scrollbar, horizontal: value } })
                  }
                >
                  {(
                    [
                      ['auto', 'Automatique (recommandé)'],
                      ['visible', 'Toujours visible'],
                      ['hidden', 'Masquée'],
                    ] as const
                  ).map(([value, label]) => (
                    <div key={value} className="flex items-center space-x-2">
                      <RadioGroupItem value={value} id={`scroll-${value}`} />
                      <Label htmlFor={`scroll-${value}`} className="cursor-pointer text-sm font-normal">
                        {label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}
          </TabsContent>

          {/* ── Sauvegarde ── */}
          <TabsContent value="general" className="mt-4 space-y-6">
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              Vos fichiers sont <strong className="text-foreground">enregistrés en continu</strong> dans
              le navigateur (métadonnées en localStorage, contenu en IndexedDB). L’option ci-dessous
              concerne uniquement la réécriture sur le disque des fichiers ouverts depuis le disque.
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="auto-save" className="text-sm text-muted-foreground">
                Réenregistrer automatiquement sur le disque
              </Label>
              <Switch
                id="auto-save"
                checked={settings.autoSave.enabled}
                onCheckedChange={(checked) =>
                  update({ autoSave: { ...settings.autoSave, enabled: checked } })
                }
              />
            </div>

            {settings.autoSave.enabled && (
              <div className="space-y-3 border-l-2 border-primary/20 pl-4">
                <Label htmlFor="auto-save-interval">
                  Intervalle : <span className="font-mono">{autoSaveSeconds} s</span>
                </Label>
                <Slider
                  id="auto-save-interval"
                  min={1}
                  max={120}
                  step={1}
                  value={[autoSaveSeconds]}
                  onValueChange={([value]) => setAutoSaveSeconds(value)}
                  onValueCommit={([value]) =>
                    update({ autoSave: { ...settings.autoSave, interval: value * 1000 } })
                  }
                  aria-label="Intervalle de sauvegarde automatique"
                />
                <p className="text-xs text-muted-foreground">
                  Aucune boîte de dialogue ne s’ouvrira : seuls les fichiers déjà liés à un fichier du
                  disque sont réécrits.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end border-t border-border pt-4">
          <Button variant="outline" size="sm" className="gap-2" onClick={onReset}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Rétablir les valeurs par défaut
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
