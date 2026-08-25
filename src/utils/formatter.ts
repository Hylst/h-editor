/**
 * Formatage via Prettier.
 *
 * Prettier et ses plugins (~700 Ko) sont chargés **à la demande** : ils ne
 * pèsent plus sur le démarrage de l'application, alors qu'ils ne servent qu'au
 * premier « Formater le document ».
 */

const PARSER_MAP: Record<string, string> = {
  javascript: 'babel',
  typescript: 'typescript',
  json: 'json',
  html: 'html',
  vue: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  markdown: 'markdown',
  yaml: 'yaml',
};

export const canFormat = (language: string): boolean => language in PARSER_MAP;

export const getFormattableLanguages = (): string[] => Object.keys(PARSER_MAP);

type PrettierPlugin = unknown;

const loadPlugins = async (language: string): Promise<PrettierPlugin[]> => {
  switch (language) {
    case 'javascript':
    case 'json': {
      const [babel, estree] = await Promise.all([
        import('prettier/plugins/babel'),
        import('prettier/plugins/estree'),
      ]);
      return [babel.default ?? babel, estree.default ?? estree];
    }
    case 'typescript': {
      const [ts, estree] = await Promise.all([
        import('prettier/plugins/typescript'),
        import('prettier/plugins/estree'),
      ]);
      return [ts.default ?? ts, estree.default ?? estree];
    }
    case 'html':
    case 'vue': {
      const html = await import('prettier/plugins/html');
      return [html.default ?? html];
    }
    case 'css':
    case 'scss':
    case 'less': {
      const postcss = await import('prettier/plugins/postcss');
      return [postcss.default ?? postcss];
    }
    case 'markdown': {
      const markdown = await import('prettier/plugins/markdown');
      return [markdown.default ?? markdown];
    }
    case 'yaml': {
      // Ce plugin manquait : `canFormat('yaml')` renvoyait true et le formatage échouait toujours.
      const yaml = await import('prettier/plugins/yaml');
      return [yaml.default ?? yaml];
    }
    default:
      return [];
  }
};

export const formatCode = async (
  code: string,
  language: string,
  tabSize = 2,
  insertSpaces = true
): Promise<string> => {
  const parser = PARSER_MAP[language];

  if (!parser) {
    throw new Error(`Le formatage n'est pas supporté pour le langage : ${language}`);
  }

  const [{ default: prettier }, plugins] = await Promise.all([
    import('prettier/standalone'),
    loadPlugins(language),
  ]);

  try {
    return await prettier.format(code, {
      parser,
      plugins: plugins as never[],
      tabWidth: tabSize,
      useTabs: !insertSpaces,
      semi: true,
      singleQuote: true,
      trailingComma: 'es5',
      printWidth: 80,
    });
  } catch (error) {
    // Erreur de syntaxe : on remonte le message de Prettier, bien plus utile
    // que l'ancien « Impossible de formater le code ».
    const message = error instanceof Error ? error.message.split('\n')[0] : 'Erreur inconnue';
    throw new Error(`Formatage impossible : ${message}`);
  }
};
