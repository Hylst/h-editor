import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, AlertCircle } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 — route inconnue :", location.pathname);
    document.title = "404 — Page introuvable | EditorX";
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="max-w-md px-6 text-center">
        <AlertCircle className="mx-auto mb-6 h-16 w-16 text-primary" aria-hidden="true" />
        <h1 className="mb-2 text-6xl font-bold tracking-tight">404</h1>
        <p className="mb-2 text-xl font-medium">Page introuvable</p>
        <p className="mb-8 text-sm text-muted-foreground">
          La route <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{location.pathname}</code> n'existe pas dans EditorX.
        </p>
        <Button asChild>
          <Link to="/" aria-label="Retour à l'éditeur">
            <Home className="mr-2 h-4 w-4" aria-hidden="true" />
            Retour à l'éditeur
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
