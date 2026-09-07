import { expect, test } from '@playwright/test';
import { openFreshApp, typeInEditor } from './helpers';

/** Fonctionnalités ajoutées en 1.5.0, vérifiées de bout en bout. */
test.describe('Apports fonctionnels', () => {
  test.beforeEach(async ({ page }) => {
    await openFreshApp(page);
  });

  test('l’explorateur se redimensionne et la largeur est conservée', async ({ page }) => {
    const explorer = page.getByRole('complementary', { name: 'Explorateur de fichiers' });
    const largeurInitiale = (await explorer.boundingBox())!.width;

    const poignee = page.getByRole('separator', { name: "Redimensionner l'explorateur" });
    await poignee.focus();
    // Chemin clavier : accessible et déterministe.
    for (let i = 0; i < 4; i++) await poignee.press('ArrowRight');

    const élargie = (await explorer.boundingBox())!.width;
    expect(élargie).toBeGreaterThan(largeurInitiale);

    // La largeur survit à un rechargement.
    await page.reload();
    await expect(explorer).toBeVisible();
    expect((await explorer.boundingBox())!.width).toBeCloseTo(élargie, 0);
  });

  test('la poignée revient à sa largeur par défaut au double-clic', async ({ page }) => {
    const explorer = page.getByRole('complementary', { name: 'Explorateur de fichiers' });
    const poignee = page.getByRole('separator', { name: "Redimensionner l'explorateur" });

    await poignee.focus();
    for (let i = 0; i < 6; i++) await poignee.press('ArrowLeft');
    expect((await explorer.boundingBox())!.width).toBeLessThan(256);

    await poignee.dblclick();
    expect((await explorer.boundingBox())!.width).toBeCloseTo(256, 0);
  });

  test('un fichier peut être créé depuis un modèle', async ({ page }) => {
    await page.keyboard.press('Control+Shift+P');
    await page.getByPlaceholder('Rechercher une commande…').fill('Nouveau : Page HTML5');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('tab', { name: /page\.html/ })).toBeVisible();
    await expect(page.locator('.monaco-editor').first()).toContainText('<!doctype html>');
  });

  test('la console de l’aperçu affiche les messages de la page', async ({ page }) => {
    await page.keyboard.press('Control+Shift+P');
    await page.getByPlaceholder('Rechercher une commande…').fill('Nouveau : Page HTML5');
    await page.keyboard.press('Enter');
    await expect(page.locator('.monaco-editor').first()).toContainText('Page chargée');

    await page.getByRole('button', { name: "Afficher l'aperçu" }).click();
    await expect(page.locator('iframe[title="Aperçu HTML"]')).toBeVisible();

    await page.getByRole('button', { name: 'Afficher la console' }).click();
    const console = page.getByRole('region', { name: 'Console de l’aperçu' });
    await expect(console).toBeVisible();
    // Le modèle contient `console.log('Page chargée')`.
    await expect(console).toContainText('Page chargée', { timeout: 10_000 });
  });

  test('la console remonte les erreurs de la page prévisualisée', async ({ page }) => {
    await page.keyboard.press('Control+n');
    const item = page.getByRole('treeitem').filter({ hasText: 'nouveau-fichier-1.txt' }).first();
    await item.getByRole('button', { name: /Ouvrir nouveau-fichier-1/ }).dblclick();
    const input = page.getByRole('textbox', { name: 'Nouveau nom du fichier' });
    await input.fill('erreur.html');
    await input.press('Enter');

    await typeInEditor(page, '<html><body><script>throw new Error("boum");</script></body></html>');

    await page.getByRole('button', { name: "Afficher l'aperçu" }).click();
    await page.getByRole('button', { name: 'Afficher la console' }).click();

    await expect(page.getByRole('region', { name: 'Console de l’aperçu' })).toContainText('boum', {
      timeout: 10_000,
    });
  });

  test('la page prévisualisée n’accède pas au stockage d’H Editor', async ({ page }) => {
    // L'iframe est en `sandbox` sans `allow-same-origin` : son origine est opaque.
    await page.keyboard.press('Control+n');
    const item = page.getByRole('treeitem').filter({ hasText: 'nouveau-fichier-1.txt' }).first();
    await item.getByRole('button', { name: /Ouvrir nouveau-fichier-1/ }).dblclick();
    const input = page.getByRole('textbox', { name: 'Nouveau nom du fichier' });
    await input.fill('sandbox.html');
    await input.press('Enter');

    await typeInEditor(
      page,
      '<html><body><script>try { console.log("cles=" + Object.keys(localStorage).length); }' +
        ' catch (e) { console.log("acces refuse"); }</script></body></html>'
    );

    await page.getByRole('button', { name: "Afficher l'aperçu" }).click();
    await page.getByRole('button', { name: 'Afficher la console' }).click();

    const console = page.getByRole('region', { name: 'Console de l’aperçu' });
    await expect(console).toContainText('acces refuse', { timeout: 10_000 });
  });

  test('plusieurs suppressions successives restent annulables', async ({ page }) => {
    // Avant : seule la dernière suppression pouvait être annulée.
    for (let i = 0; i < 2; i++) await page.keyboard.press('Control+n');

    for (const nom of ['nouveau-fichier-1.txt', 'nouveau-fichier-2.txt']) {
      const cible = page.getByRole('treeitem').filter({ hasText: nom }).first();
      await cible.hover();
      await cible.getByRole('button', { name: /Actions pour/ }).click();
      await page.getByRole('menuitem', { name: 'Supprimer' }).click();
      await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
      await expect(page.getByRole('treeitem').filter({ hasText: nom })).toHaveCount(0);
    }

    // La corbeille conserve les deux : on restaure la plus récente…
    await page.locator('[data-sonner-toast]').getByRole('button', { name: 'Annuler' }).first().click();
    await expect(page.getByRole('treeitem').filter({ hasText: 'nouveau-fichier-2.txt' })).toBeVisible();

    // …puis la précédente, via la palette de commandes.
    await page.keyboard.press('Control+Shift+P');
    await page.getByPlaceholder('Rechercher une commande…').fill('Restaurer');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('treeitem').filter({ hasText: 'nouveau-fichier-1.txt' })).toBeVisible();
  });

  test('les extraits de code sont proposés à la complétion', async ({ page }) => {
    await page.keyboard.press('Control+Shift+P');
    await page.getByPlaceholder('Rechercher une commande…').fill('Nouveau : Module TypeScript');
    await page.keyboard.press('Enter');
    await expect(page.locator('.monaco-editor').first()).toContainText('export interface Options');

    await page.locator('.monaco-editor').first().click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('\ncl');
    await page.keyboard.press('Control+Space');

    // La liste de suggestions de Monaco doit contenir notre extrait.
    await expect(page.locator('.suggest-widget')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.suggest-widget')).toContainText('console.log');
  });
});
