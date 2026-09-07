import { expect, test } from '@playwright/test';
import { openFreshApp, openTabs, typeInEditor, waitForSaved } from './helpers';

test.describe('Fonctionnalités', () => {
  test.beforeEach(async ({ page }) => {
    await openFreshApp(page);
  });

  test('l’éditeur occupe toute la largeur tant que l’aperçu est masqué', async ({ page }) => {
    // Avant : tout fichier Markdown bridait l'éditeur à 50 % même sans aperçu.
    const viewport = page.viewportSize()!;
    const editor = page.locator('.monaco-editor').first();
    const before = (await editor.boundingBox())!;
    expect(before.width).toBeGreaterThan(viewport.width * 0.5);

    await page.getByRole('button', { name: "Afficher l'aperçu" }).click();
    await expect(page.locator('.prose')).toBeVisible();
    const after = (await editor.boundingBox())!;
    expect(after.width).toBeLessThan(before.width);
  });

  test('l’aperçu Markdown est réellement mis en forme', async ({ page }) => {
    // Avant : @tailwindcss/typography n'était pas enregistré → rendu brut.
    await page.getByRole('button', { name: "Afficher l'aperçu" }).click();

    const heading = page.locator('.prose h1').first();
    await expect(heading).toBeVisible();

    const [headingSize, bodySize] = await Promise.all([
      heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      page.locator('.prose p').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ]);
    expect(headingSize).toBeGreaterThan(bodySize * 1.5);
    await expect(page.locator('.prose table')).toBeVisible();
  });

  test('l’aperçu Markdown neutralise le HTML dangereux', async ({ page }) => {
    await page.keyboard.press('Control+n');
    await typeInEditor(page, '# Titre\n\n<img src=x onerror="window.__pwned=true">\n');

    // Renommer en .md pour activer l'aperçu
    const item = page.getByRole('treeitem').filter({ hasText: 'nouveau-fichier-1.txt' }).first();
    await item.getByRole('button', { name: /Ouvrir nouveau-fichier-1/ }).dblclick();
    const input = page.getByRole('textbox', { name: 'Nouveau nom du fichier' });
    await input.fill('danger.md');
    await input.press('Enter');

    await page.getByRole('button', { name: "Afficher l'aperçu" }).click();
    await expect(page.locator('.prose h1')).toBeVisible();

    expect(await page.evaluate(() => (window as never as { __pwned?: boolean }).__pwned)).toBeUndefined();
    expect(await page.locator('.prose').innerHTML()).not.toContain('onerror');
  });

  test('la recherche globale déplace le curseur, y compris en mode divisé', async ({ page }) => {
    // Avant : la navigation ciblait un éditeur démonté en mode divisé.
    await page.keyboard.press('Control+Shift+F');
    const search = page.getByRole('textbox', { name: 'Terme à rechercher' });
    await search.fill('Raccourcis');

    // Le libellé « N résultat(s) » matche aussi l'état transitoire entre le
    // commit React (query posée, pending encore false) et l'exécution de
    // l'effet qui lance la recherche : « 0 résultats dans 0 fichiers » et
    // « Aucun résultat » coexistent alors, et getByText(/résultat/) viole le
    // mode strict. On attend les lignes de résultats, seules à porter « L<n> ».
    const premierResultat = page.getByRole('button', { name: /^L\d+/ }).first();
    await expect(premierResultat).toBeVisible();
    await premierResultat.click();
    await expect(page.getByRole('contentinfo')).not.toContainText('Ln 1, Col 1');

    // Même chose une fois l'éditeur divisé
    await page.keyboard.press('Control+\\');
    await expect(page.getByRole('region', { name: /Panneau/ }).first()).toBeVisible();
    await page.getByRole('button', { name: /^L\d+/ }).first().click();
    await expect(page.getByRole('contentinfo')).not.toContainText('Ln 1, Col 1');
  });

  test('une expression régulière invalide est signalée', async ({ page }) => {
    await page.keyboard.press('Control+Shift+F');
    await page.getByRole('button', { name: 'Expression régulière' }).click();
    await page.getByRole('textbox', { name: 'Terme à rechercher' }).fill('([a-z');
    await expect(
      page.getByRole('complementary', { name: 'Recherche dans les fichiers' }).getByRole('alert')
    ).toBeVisible();
  });

  test('remplacer dans tous les fichiers modifie le contenu', async ({ page }) => {
    await page.keyboard.press('Control+n');
    await typeInEditor(page, 'alpha alpha alpha');
    await waitForSaved(page);
    await expect(page.locator('.monaco-editor').first()).toContainText('alpha alpha alpha');

    await page.keyboard.press('Control+Shift+F');
    await page.getByRole('textbox', { name: 'Terme à rechercher' }).fill('alpha');
    await page.getByRole('button', { name: 'Remplacer' }).click();
    await page.getByRole('textbox', { name: 'Texte de remplacement' }).fill('oméga');
    await page.getByRole('button', { name: /Tout remplacer/ }).click();

    await expect(page.locator('.monaco-editor').first()).toContainText('oméga oméga oméga');
  });

  test('Ctrl+P ouvre la navigation rapide et ouvre le fichier choisi', async ({ page }) => {
    await page.keyboard.press('Control+n');
    await page.keyboard.press('Control+p');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder('Nom du fichier…').fill('bienvenue');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('contentinfo')).toContainText('bienvenue.md');
  });

  test('Ctrl+B replie et déplie l’explorateur', async ({ page }) => {
    const explorer = page.getByRole('complementary', { name: 'Explorateur de fichiers' });
    await expect(explorer).toBeVisible();
    await page.keyboard.press('Control+b');
    await expect(explorer).toBeHidden();
    await page.keyboard.press('Control+b');
    await expect(explorer).toBeVisible();
  });

  test('le filtre de l’explorateur masque les fichiers non concernés', async ({ page }) => {
    await page.keyboard.press('Control+n');
    await page.getByRole('textbox', { name: 'Filtrer les fichiers' }).fill('bienv');

    await expect(page.getByRole('treeitem').filter({ hasText: 'bienvenue.md' })).toBeVisible();
    await expect(page.getByRole('treeitem').filter({ hasText: 'nouveau-fichier' })).toHaveCount(0);
  });

  test('le formatage Prettier s’applique au document', async ({ page }) => {
    await page.keyboard.press('Control+n');
    const item = page.getByRole('treeitem').filter({ hasText: 'nouveau-fichier-1.txt' }).first();
    await item.getByRole('button', { name: /Ouvrir nouveau-fichier-1/ }).dblclick();
    const input = page.getByRole('textbox', { name: 'Nouveau nom du fichier' });
    await input.fill('format.ts');
    await input.press('Enter');

    await typeInEditor(page, 'const   x={a:1,b:2}');
    await page.keyboard.press('Alt+Shift+F');

    await expect(page.locator('.monaco-editor').first()).toContainText('const x = { a: 1, b: 2 };');
  });

  test('le thème clair s’applique à toute l’interface', async ({ page }) => {
    // Avant : seul Monaco changeait, l'interface restait sombre.
    await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Clair' }).click();
    await page.keyboard.press('Escape');

    const background = await page
      .getByRole('banner')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    const [r, g, b] = background.match(/\d+/g)!.map(Number);
    expect((r + g + b) / 3).toBeGreaterThan(180); // fond clair
    await expect(page.locator('html')).toHaveClass(/light/);
  });

  test('le mode Zen masque l’interface et Échap en sort', async ({ page }) => {
    await page.keyboard.press('F11');
    await expect(page.getByRole('banner')).toBeHidden();
    await expect(page.getByText('Échap pour quitter', { exact: true })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('banner')).toBeVisible();
  });

  test('les onglets se ferment au clic milieu et par le menu contextuel', async ({ page }) => {
    await page.keyboard.press('Control+n');
    await page.keyboard.press('Control+n');
    expect(await openTabs(page)).toHaveLength(3);

    await page.getByRole('tab').first().click({ button: 'middle' });
    expect(await openTabs(page)).toHaveLength(2);

    await page.getByRole('tab').first().click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Tout fermer' }).click();
    expect(await openTabs(page)).toHaveLength(0);
  });

  test('la palette de commandes exécute une action', async ({ page }) => {
    await page.keyboard.press('Control+Shift+P');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder('Rechercher une commande…').fill('Nouveau fichier');

    // La palette compte désormais 14 modèles nommés « Nouveau : … ». On clique
    // l'entrée voulue plutôt que de presser Entrée : sous charge, la touche
    // partait parfois avant que le filtrage soit appliqué.
    // (Le nom accessible inclut le raccourci : « Nouveau fichierCtrl+N ».)
    await dialog.getByRole('option', { name: /^Nouveau fichier/ }).click();

    await expect(page.getByRole('tab')).toHaveCount(2);
  });

  test('les raccourcis clavier ne se déclenchent pas pendant la saisie dans un champ', async ({
    page,
  }) => {
    // Avant : Ctrl+F depuis le champ de recherche ouvrait le widget de Monaco.
    await page.keyboard.press('Control+Shift+F');
    const search = page.getByRole('textbox', { name: 'Terme à rechercher' });
    await expect(search).toBeVisible();
    await search.fill('Raccourcis');

    // On attend la fin de la recherche : presser pendant la mise à jour des
    // résultats rendait ce test sensible à la charge de la machine.
    await expect(page.getByText(/résultat/)).toBeVisible();
    await expect(search).toBeFocused();

    await search.press('Control+f');

    await expect(page.locator('.find-widget.visible')).toHaveCount(0);
    await expect(search).toBeFocused();
  });

  test('tous les boutons exposent un nom accessible', async ({ page }) => {
    const unnamed = await page.evaluate(
      () =>
        [...document.querySelectorAll('button')].filter(
          (b) => !b.innerText.trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')
        ).length
    );
    expect(unnamed).toBe(0);
  });

  test('l’export ZIP produit un fichier téléchargeable', async ({ page }) => {
    await page.getByRole('button', { name: 'Créer ou importer' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Exporter en ZIP' }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^h-editor-projet-\d{4}-\d{2}-\d{2}\.zip$/);
  });
});
