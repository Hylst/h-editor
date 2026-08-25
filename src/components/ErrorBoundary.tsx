import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Download, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Filet de sécurité racine.
 *
 * Sans cette barrière, la moindre exception dans un effet (par exemple un
 * `QuotaExceededError` pendant la persistance) démontait tout l'arbre React :
 * l'utilisateur se retrouvait devant une page blanche, sans explication ni
 * moyen de récupérer son travail.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('EditorX — erreur non rattrapée :', error, info.componentStack);
  }

  private handleReload = () => window.location.reload();

  /** Dernier recours : récupérer le projet depuis le stockage, même si l'UI est morte. */
  private handleExport = () => {
    try {
      const raw =
        localStorage.getItem('editorx-workspace') ?? localStorage.getItem('editorx-filesystem');
      const blob = new Blob([raw ?? '{}'], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `editorx-recuperation-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Impossible de lire le stockage local.");
    }
  };

  private handleReset = () => {
    if (!window.confirm('Effacer les données locales d’EditorX et redémarrer ?')) return;
    try {
      localStorage.clear();
      indexedDB?.deleteDatabase('editorx');
    } catch {
      /* on redémarre quand même */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-lg w-full space-y-6 rounded-lg border border-border bg-card p-8 shadow-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive flex-shrink-0" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">Une erreur est survenue</h1>
              <p className="text-sm text-muted-foreground">
                EditorX s’est arrêté, mais vos fichiers sont toujours dans le stockage local.
              </p>
            </div>
          </div>

          <pre className="max-h-40 overflow-auto rounded bg-muted p-3 text-xs text-muted-foreground whitespace-pre-wrap">
            {this.state.error.message}
          </pre>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <RefreshCw className="h-4 w-4" />
              Recharger
            </button>
            <button
              onClick={this.handleExport}
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              <Download className="h-4 w-4" />
              Récupérer mes fichiers
            </button>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 rounded-md border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
              Réinitialiser
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
