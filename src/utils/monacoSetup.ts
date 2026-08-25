/**
 * Monaco auto-hébergé.
 *
 * Par défaut, `@monaco-editor/react` télécharge Monaco depuis cdn.jsdelivr.net
 * au premier rendu. Conséquences corrigées ici :
 *  - l'application était inutilisable hors ligne (la PWA ne précachait qu'un wrapper de 20 Ko) ;
 *  - dépendance de disponibilité et fuite d'adresse IP vers un tiers, en contradiction
 *    avec la promesse « 100 % local » ;
 *  - aucune maîtrise de la version réellement exécutée.
 *
 * On charge donc le paquet `monaco-editor` du bundle, ainsi que ses web workers.
 */

import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';

import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    switch (label) {
      case 'json':
        return new jsonWorker();
      case 'css':
      case 'scss':
      case 'less':
        return new cssWorker();
      case 'html':
      case 'handlebars':
      case 'razor':
        return new htmlWorker();
      case 'typescript':
      case 'javascript':
        return new tsWorker();
      default:
        return new editorWorker();
    }
  },
};

loader.config({ monaco });

export { monaco };
