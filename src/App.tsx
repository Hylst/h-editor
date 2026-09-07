import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import ErrorBoundary from '@/components/ErrorBoundary';
import Index from './pages/Index';

const NotFound = lazy(() => import('./pages/NotFound'));

/**
 * `QueryClientProvider` a été retiré : aucune requête réseau n'existe dans cette
 * application 100 % locale, le fournisseur ne faisait qu'alourdir le bundle.
 * De même, un seul système de notifications est conservé (sonner).
 */
const App = () => (
  <ErrorBoundary>
    <TooltipProvider delayDuration={400}>
      <BrowserRouter basename="/heditor">
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="bottom-right" closeButton richColors />
    </TooltipProvider>
  </ErrorBoundary>
);

export default App;
