import { describe, expect, it } from 'vitest';
import type { EditorFile, EditorFolder } from '@/types/editor';
import {
  assembleSite,
  buildFilePath,
  describeMissing,
  extractImports,
  findSourceFile,
  isExternalReference,
  isHtmlEntry,
  resolvePath,
} from './sitePreview';

const file = (
  id: string,
  name: string,
  content: string,
  parentId?: string,
  binary = false
): EditorFile => ({ id, name, content, language: 'plaintext', modified: false, parentId, binary });

describe('resolvePath', () => {
  it('résout un chemin relatif simple', () => {
    expect(resolvePath('index.html', 'styles.css')).toBe('styles.css');
    expect(resolvePath('index.html', './styles.css')).toBe('styles.css');
  });

  it('résout depuis un sous-dossier', () => {
    expect(resolvePath('src/pages/index.html', 'app.css')).toBe('src/pages/app.css');
    expect(resolvePath('src/pages/index.html', '../styles/app.css')).toBe('src/styles/app.css');
    expect(resolvePath('a/b/c/page.html', '../../x.js')).toBe('a/x.js');
  });

  it('traite un chemin absolu depuis la racine du projet', () => {
    expect(resolvePath('src/pages/index.html', '/global.css')).toBe('global.css');
  });

  it('ignore la requête et l’ancre', () => {
    expect(resolvePath('index.html', 'app.js?v=2')).toBe('app.js');
    expect(resolvePath('index.html', 'page.html#section')).toBe('page.html');
  });

  it('ne remonte pas au-delà de la racine', () => {
    expect(resolvePath('index.html', '../../../secret.txt')).toBe('secret.txt');
  });
});

describe('isExternalReference', () => {
  it('reconnaît les ressources externes', () => {
    for (const url of [
      'https://cdn.test/a.js',
      'http://x.test/a.css',
      '//cdn.test/a.js',
      'data:text/css,body{}',
      'mailto:a@b.c',
      '#ancre',
    ]) {
      expect(isExternalReference(url)).toBe(true);
    }
  });

  it('reconnaît les ressources internes', () => {
    for (const path of ['styles.css', './app.js', '../a/b.css', '/global.css']) {
      expect(isExternalReference(path)).toBe(false);
    }
  });
});

describe('buildFilePath', () => {
  const folders: EditorFolder[] = [
    { id: 'd1', name: 'src' },
    { id: 'd2', name: 'pages', parentId: 'd1' },
  ];

  it('reconstruit le chemin complet', () => {
    expect(buildFilePath(file('f', 'index.html', '', 'd2'), folders)).toBe('src/pages/index.html');
    expect(buildFilePath(file('f', 'a.txt', ''), folders)).toBe('a.txt');
  });

  it('survit à une boucle de dossiers parents', () => {
    const cycliques: EditorFolder[] = [
      { id: 'x', name: 'x', parentId: 'y' },
      { id: 'y', name: 'y', parentId: 'x' },
    ];
    expect(() => buildFilePath(file('f', 'a.txt', '', 'x'), cycliques)).not.toThrow();
  });
});

describe('extractImports', () => {
  it('trouve les différentes formes d’import', () => {
    const code = `
      import defaut from './a.js';
      import { nomme } from "./b.js";
      import './effet.js';
      export { x } from './c.js';
      const paresseux = await import('./d.js');
      import externe from 'https://cdn.test/e.js';
    `;
    expect(extractImports(code).sort()).toEqual(
      ['./a.js', './b.js', './c.js', './d.js', './effet.js', 'https://cdn.test/e.js'].sort()
    );
  });

  it('ne renvoie rien sur du code sans import', () => {
    expect(extractImports('const a = 1; // import fictif')).toEqual([]);
  });
});

describe('assembleSite', () => {
  const folders: EditorFolder[] = [];

  it('intègre une feuille de styles et un script', () => {
    const files = [
      file('h', 'index.html', '<html><head><link rel="stylesheet" href="styles.css"></head><body><script src="app.js"></script></body></html>'),
      file('c', 'styles.css', 'body { color: red; }'),
      file('j', 'app.js', 'console.log("bonjour");'),
    ];

    const result = assembleSite(files, folders, 'h')!;
    expect(result.html).toContain('body { color: red; }');
    expect(result.html).toContain('console.log("bonjour");');
    expect(result.html).not.toContain('href="styles.css"');
    expect(result.missing).toEqual([]);
  });

  it('signale les ressources manquantes sans échouer', () => {
    const files = [
      file('h', 'index.html', '<html><head><link rel="stylesheet" href="absent.css"></head><body><script src="absent.js"></script></body></html>'),
    ];

    const result = assembleSite(files, folders, 'h')!;
    expect(result.missing).toHaveLength(2);
    expect(result.missing.map((m) => m.reference).sort()).toEqual(['absent.css', 'absent.js']);
    expect(result.missing.map((m) => m.kind).sort()).toEqual(['script', 'stylesheet']);
    // Chaque manque désigne le fichier fautif, pour permettre de l'ouvrir.
    expect(result.missing.every((m) => m.sourcePath === 'index.html')).toBe(true);
    expect(result.html).toContain('<html>'); // le document reste exploitable
  });

  it('neutralise une balise fermante présente dans le code utilisateur', () => {
    // Sans échappement, ce script refermerait la balise et casserait la page.
    const files = [
      file('h', 'index.html', '<html><body><script src="app.js"></script></body></html>'),
      file('j', 'app.js', 'const piege = "</script><h1>injecté</h1>";'),
    ];

    const result = assembleSite(files, folders, 'h')!;
    expect(result.html).not.toContain('</script><h1>injecté</h1>');
    expect(result.html).toContain('<\\/script>');
  });

  it('intègre une image binaire en data: URI', () => {
    const files = [
      file('h', 'index.html', '<html><body><img src="logo.png"></body></html>'),
      file('i', 'logo.png', 'iVBORw0KGgo=', undefined, true),
    ];

    const result = assembleSite(files, folders, 'h')!;
    expect(result.html).toContain('data:image/png;base64,iVBORw0KGgo=');
  });

  it('résout les url() d’une feuille de styles', () => {
    const files = [
      file('h', 'index.html', '<html><head><link rel="stylesheet" href="styles.css"></head></html>'),
      file('c', 'styles.css', 'body { background: url("fond.png"); }'),
      file('i', 'fond.png', 'AAAA', undefined, true),
    ];

    const result = assembleSite(files, folders, 'h')!;
    expect(result.html).toContain('data:image/png;base64,AAAA');
  });

  it('réécrit les imports d’un module ES en data: URI', () => {
    const files = [
      file('h', 'index.html', '<html><body><script type="module" src="main.js"></script></body></html>'),
      file('m', 'main.js', "import { saluer } from './util.js';\nsaluer();"),
      file('u', 'util.js', "export const saluer = () => console.log('salut');"),
    ];

    const result = assembleSite(files, folders, 'h')!;
    expect(result.html).toContain('type="module"');
    expect(result.html).toContain('data:text/javascript');
    expect(result.missing).toEqual([]);
  });

  it('supporte un module sans extension explicite', () => {
    const files = [
      file('h', 'index.html', '<html><body><script type="module" src="main.js"></script></body></html>'),
      file('m', 'main.js', "import './util';"),
      file('u', 'util.js', 'export const x = 1;'),
    ];

    expect(assembleSite(files, folders, 'h')!.missing).toEqual([]);
  });

  it('tolère un cycle d’imports', () => {
    const files = [
      file('h', 'index.html', '<html><body><script type="module" src="a.js"></script></body></html>'),
      file('a', 'a.js', "import './b.js';\nexport const a = 1;"),
      file('b', 'b.js', "import './a.js';\nexport const b = 2;"),
    ];

    expect(() => assembleSite(files, folders, 'h')).not.toThrow();
  });

  it('gère les caractères accentués (btoa aurait échoué)', () => {
    const files = [
      file('h', 'index.html', '<html><body><script type="module" src="main.js"></script></body></html>'),
      file('m', 'main.js', "// éléphant à Noël — ✅\nexport const x = 1;"),
    ];

    const result = assembleSite(files, folders, 'h')!;
    expect(result.html).toContain('charset=utf-8');
  });

  it('laisse intactes les ressources externes', () => {
    const files = [
      file('h', 'index.html', '<html><head><link rel="stylesheet" href="https://cdn.test/a.css"><script src="https://cdn.test/b.js"></script></head></html>'),
    ];

    const result = assembleSite(files, folders, 'h')!;
    expect(result.html).toContain('https://cdn.test/a.css');
    expect(result.html).toContain('https://cdn.test/b.js');
    expect(result.missing).toEqual([]);
  });

  it('injecte les shims et le pont de navigation', () => {
    const files = [
      file('h', 'index.html', '<html><head></head><body></body></html>'),
      file('d', 'donnees.json', '{"ok":true}'),
    ];

    const result = assembleSite(files, folders, 'h')!;
    expect(result.html).toContain('window.fetch');
    expect(result.html).toContain('XMLHttpRequest');
    expect(result.html).toContain('editorx-preview-navigate');
    expect(result.html).toContain('donnees.json');
  });

  it('résout depuis un sous-dossier', () => {
    const dossiers: EditorFolder[] = [
      { id: 'd1', name: 'pages' },
      { id: 'd2', name: 'assets' },
    ];
    const files = [
      file('h', 'index.html', '<html><head><link rel="stylesheet" href="../assets/app.css"></head></html>', 'd1'),
      file('c', 'app.css', '.x { color: blue; }', 'd2'),
    ];

    const result = assembleSite(files, dossiers, 'h')!;
    expect(result.html).toContain('.x { color: blue; }');
    expect(result.missing).toEqual([]);
  });

  it('renvoie null si le point d’entrée n’existe pas', () => {
    expect(assembleSite([], folders, 'inconnu')).toBeNull();
  });

  it('refuse un document démesuré plutôt que de figer le navigateur', () => {
    const files = [
      file('h', 'index.html', '<html><body><script src="gros.js"></script></body></html>'),
      file('g', 'gros.js', 'x'.repeat(13 * 1024 * 1024)),
    ];

    const result = assembleSite(files, folders, 'h')!;
    expect(result.html).toContain('trop volumineux');
  });
});

describe('ressources manquantes', () => {
  it('désigne le module fautif et son importateur', () => {
    const files = [
      file('h', 'index.html', '<html><body><script type="module" src="main.js"></script></body></html>'),
      file('m', 'main.js', "import './absent.js';"),
    ];

    const [manque] = assembleSite(files, [], 'h')!.missing;
    expect(manque.kind).toBe('module');
    expect(manque.reference).toBe('./absent.js');
    expect(manque.sourcePath).toBe('main.js');
  });

  it('désigne la feuille de styles fautive pour une image manquante', () => {
    const files = [
      file('h', 'index.html', '<html><head><link rel="stylesheet" href="app.css"></head></html>'),
      file('c', 'app.css', 'body { background: url("absente.png"); }'),
    ];

    const [manque] = assembleSite(files, [], 'h')!.missing;
    expect(manque.kind).toBe('asset');
    expect(manque.sourcePath).toBe('app.css'); // et non index.html
  });

  it('retrouve le fichier fautif pour permettre son ouverture', () => {
    const dossiers: EditorFolder[] = [{ id: 'd', name: 'src' }];
    const source = file('c', 'app.css', 'body{background:url(x.png)}', 'd');
    const files = [
      file('h', 'index.html', '<html><head><link rel="stylesheet" href="src/app.css"></head></html>'),
      source,
    ];

    const [manque] = assembleSite(files, dossiers, 'h')!.missing;
    expect(findSourceFile(manque, files, dossiers)).toBe(source);
  });

  it('produit un libellé lisible', () => {
    const texte = describeMissing({ reference: './a.css', sourcePath: 'index.html', kind: 'stylesheet' });
    expect(texte).toContain('./a.css');
    expect(texte).toContain('feuille de styles');
    expect(texte).toContain('index.html');
  });
});

describe('isHtmlEntry', () => {
  it('reconnaît les pages HTML', () => {
    expect(isHtmlEntry(file('a', 'index.html', ''))).toBe(true);
    expect(isHtmlEntry(file('a', 'page.htm', ''))).toBe(true);
    expect(isHtmlEntry(file('a', 'style.css', ''))).toBe(false);
    expect(isHtmlEntry(file('a', 'image.html', '', undefined, true))).toBe(false);
  });
});
