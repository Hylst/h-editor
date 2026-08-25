/**
 * Extraits de code proposés à la complétion, par langage.
 *
 * Enregistrés auprès de Monaco à la volée : aucun poids au démarrage, et la
 * syntaxe `${1:nom}` active la navigation par tabulation entre les champs.
 */

import type * as Monaco from 'monaco-editor';

interface SnippetDefinition {
  label: string;
  detail: string;
  body: string;
}

const JS_FAMILY: SnippetDefinition[] = [
  {
    label: 'cl',
    detail: 'console.log',
    body: 'console.log(${1:valeur});',
  },
  {
    label: 'fn',
    detail: 'Fonction fléchée',
    body: 'const ${1:nom} = (${2:params}) => {\n\t${3}\n};',
  },
  {
    label: 'afn',
    detail: 'Fonction fléchée asynchrone',
    body: 'const ${1:nom} = async (${2:params}) => {\n\t${3}\n};',
  },
  {
    label: 'trycatch',
    detail: 'try / catch',
    body: 'try {\n\t${1}\n} catch (error) {\n\tconsole.error(${2:error});\n}',
  },
  {
    label: 'foreach',
    detail: 'Boucle for…of',
    body: 'for (const ${1:element} of ${2:liste}) {\n\t${3}\n}',
  },
  {
    label: 'map',
    detail: 'Array.map',
    body: '${1:liste}.map((${2:element}) => ${3:element});',
  },
  {
    label: 'imp',
    detail: 'Import de module',
    body: "import { ${1:nom} } from '${2:module}';",
  },
];

const TS_ONLY: SnippetDefinition[] = [
  {
    label: 'int',
    detail: 'Interface',
    body: 'interface ${1:Nom} {\n\t${2:propriete}: ${3:string};\n}',
  },
  {
    label: 'type',
    detail: 'Alias de type',
    body: 'type ${1:Nom} = ${2:string};',
  },
];

const REACT: SnippetDefinition[] = [
  {
    label: 'rfc',
    detail: 'Composant React',
    body:
      'interface ${1:Nom}Props {\n\t${2:titre}: string;\n}\n\n' +
      'const ${1:Nom} = ({ ${2:titre} }: ${1:Nom}Props) => {\n\treturn <div>{${2:titre}}</div>;\n};\n\n' +
      'export default ${1:Nom};',
  },
  {
    label: 'useState',
    detail: 'Hook d’état',
    body: 'const [${1:valeur}, set${2:Valeur}] = useState(${3:null});',
  },
  {
    label: 'useEffect',
    detail: 'Hook d’effet',
    body: 'useEffect(() => {\n\t${1}\n}, [${2}]);',
  },
];

const CSS_SNIPPETS: SnippetDefinition[] = [
  {
    label: 'flexcenter',
    detail: 'Centrage flex',
    body: 'display: flex;\nalign-items: center;\njustify-content: center;',
  },
  {
    label: 'grid',
    detail: 'Grille responsive',
    body: 'display: grid;\ngrid-template-columns: repeat(auto-fit, minmax(${1:220px}, 1fr));\ngap: ${2:1rem};',
  },
  {
    label: 'media',
    detail: 'Requête média',
    body: '@media (max-width: ${1:768px}) {\n\t${2}\n}',
  },
];

const PYTHON_SNIPPETS: SnippetDefinition[] = [
  {
    label: 'def',
    detail: 'Fonction typée',
    body: 'def ${1:nom}(${2:params}) -> ${3:None}:\n\t"""${4:Description}."""\n\t${5:pass}',
  },
  {
    label: 'main',
    detail: 'Point d’entrée',
    body: 'if __name__ == "__main__":\n\t${1:main()}',
  },
];

const HTML_SNIPPETS: SnippetDefinition[] = [
  {
    label: 'html5',
    detail: 'Squelette HTML5',
    body:
      '<!doctype html>\n<html lang="fr">\n  <head>\n    <meta charset="utf-8" />\n' +
      '    <meta name="viewport" content="width=device-width, initial-scale=1" />\n' +
      '    <title>${1:Titre}</title>\n  </head>\n  <body>\n    ${2}\n  </body>\n</html>',
  },
];

const BY_LANGUAGE: Record<string, SnippetDefinition[]> = {
  javascript: [...JS_FAMILY, ...REACT],
  typescript: [...JS_FAMILY, ...TS_ONLY, ...REACT],
  css: CSS_SNIPPETS,
  scss: CSS_SNIPPETS,
  less: CSS_SNIPPETS,
  python: PYTHON_SNIPPETS,
  html: HTML_SNIPPETS,
};

/** Langages disposant d'extraits (exposé pour la documentation et les tests). */
export const SNIPPET_LANGUAGES = Object.keys(BY_LANGUAGE);

export const getSnippets = (language: string): SnippetDefinition[] => BY_LANGUAGE[language] ?? [];

let registered = false;

/**
 * Enregistre les extraits auprès de Monaco.
 *
 * Idempotent : appelé au montage de chaque éditeur, il ne doit pas empiler
 * plusieurs fournisseurs de complétion pour un même langage.
 */
export const registerSnippets = (monaco: typeof Monaco): void => {
  if (registered) return;
  registered = true;

  for (const [language, snippets] of Object.entries(BY_LANGUAGE)) {
    monaco.languages.registerCompletionItemProvider(language, {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        return {
          suggestions: snippets.map((snippet) => ({
            label: snippet.label,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: snippet.body,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: snippet.detail,
            documentation: { value: '```\n' + snippet.body.replace(/\$\{\d+:?([^}]*)\}/g, '$1') + '\n```' },
            range,
          })),
        };
      },
    });
  }
};
