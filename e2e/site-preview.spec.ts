import { expect, test } from '@playwright/test';
import { openFreshApp } from './helpers';

/**
 * Prévisualisation d'un site multi-fichiers, sans backend.
 *
 * Le site est assemblé en mémoire (styles, scripts, modules, images résolus) et
 * servi à une iframe qui reste isolée : `sandbox` sans `allow-same-origin`.
 */
test.describe('Aperçu de site', () => {
  test.beforeEach(async ({ page }) => {
    await openFreshApp(page);
  });

  /** Crée un site à partir du modèle « Site web complet ». */
  const creerSite = async (page: import('@playwright/test').Page) => {
    await page.keyboard.press('Control+Shift+P');
    await page.getByPlaceholder('Rechercher une commande…').fill('Site web complet');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: /index\.html/ })).toBeVisible();
  };

  test('le modèle crée les trois fichiers liés', async ({ page }) => {
    await creerSite(page);

    for (const nom of ['index.html', 'styles.css', 'app.js']) {
      await expect(page.getByRole('treeitem').filter({ hasText: nom })).toBeVisible();
    }
  });

  test('la feuille de styles liée est appliquée dans l’aperçu', async ({ page }) => {
    await creerSite(page);
    await page.getByRole('button', { name: "Afficher l'aperçu" }).click();

    const cadre = page.frameLocator('iframe[title="Aperçu HTML"]');
    await expect(cadre.locator('h1')).toBeVisible();

    // `styles.css` définit un fond sombre : sans résolution, il resterait blanc.
    const fond = await cadre
      .locator('body')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    const [r, g, b] = fond.match(/\d+/g)!.map(Number);
    expect((r + g + b) / 3).toBeLessThan(80);
  });

  test('le script lié s’exécute et sa console remonte', async ({ page }) => {
    await creerSite(page);
    await page.getByRole('button', { name: "Afficher l'aperçu" }).click();
    await page.getByRole('button', { name: 'Afficher la console' }).click();

    // `app.js` journalise au chargement.
    await expect(page.getByRole('region', { name: 'Console de l’aperçu' })).toContainText(
      'Script chargé',
      { timeout: 10_000 }
    );

    // Et il réagit vraiment aux interactions.
    const cadre = page.frameLocator('iframe[title="Aperçu HTML"]');
    await cadre.locator('#compteur').click();
    await expect(cadre.locator('#compteur')).toHaveText('1 clic');
  });

  test('l’aperçu plein écran s’ouvre et se referme au clavier', async ({ page }) => {
    await creerSite(page);

    await page.keyboard.press('Control+Shift+V');
    // En plein écran, l'explorateur et la barre d'état disparaissent.
    await expect(page.getByRole('complementary', { name: 'Explorateur de fichiers' })).toBeHidden();
    await expect(page.locator('iframe[title="Aperçu HTML"]')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('complementary', { name: 'Explorateur de fichiers' })).toBeVisible();
  });

  test('les ressources introuvables sont signalées', async ({ page }) => {
    await page.keyboard.press('Control+Shift+P');
    await page.getByPlaceholder('Rechercher une commande…').fill('Nouveau : Page HTML5');
    await page.keyboard.press('Enter');

    await page.locator('.monaco-editor').first().click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('<html><head><link rel="stylesheet" href="absent.css"></head><body>x</body></html>');

    await page.getByRole('button', { name: "Afficher l'aperçu" }).click();
    // Un compteur d'avertissement apparaît, avec le détail en infobulle.
    await expect(page.locator('[title*="absent.css"]')).toBeVisible({ timeout: 10_000 });
  });

  test('la navigation entre pages du site fonctionne', async ({ page }) => {
    await page.keyboard.press('Control+Shift+P');
    await page.getByPlaceholder('Rechercher une commande…').fill('Nouveau : Page HTML5');
    await page.keyboard.press('Enter');

    await page.locator('.monaco-editor').first().click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('<html><body><h1>Accueil</h1><a href="page2.html">Suite</a></body></html>');

    // Seconde page du site
    await page.keyboard.press('Control+Shift+P');
    await page.getByPlaceholder('Rechercher une commande…').fill('Nouveau : Page HTML5');
    await page.keyboard.press('Enter');

    const second = page.getByRole('treeitem').filter({ hasText: 'page (2).html' }).first();
    await second.getByRole('button', { name: /Ouvrir page/ }).dblclick();
    const champ = page.getByRole('textbox', { name: 'Nouveau nom du fichier' });
    await champ.fill('page2.html');
    await champ.press('Enter');

    await page.locator('.monaco-editor').first().click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('<html><body><h1>Seconde page</h1></body></html>');

    // Revenir à la page d'accueil et suivre le lien depuis l'aperçu
    await page.getByRole('tab', { name: /^page\.html/ }).click();
    await page.getByRole('button', { name: "Afficher l'aperçu" }).click();

    const cadre = page.frameLocator('iframe[title="Aperçu HTML"]');
    await expect(cadre.locator('h1')).toHaveText('Accueil');
    await cadre.locator('a').click();

    await expect(cadre.locator('h1')).toHaveText('Seconde page', { timeout: 10_000 });
    // Un bouton de retour apparaît.
    await expect(page.getByRole('button', { name: 'Page précédente' })).toBeVisible();
  });

  test('la console interactive évalue une expression dans la page', async ({ page }) => {
    await creerSite(page);
    await page.getByRole('button', { name: "Afficher l'aperçu" }).click();
    await page.getByRole('button', { name: 'Afficher la console' }).click();

    const champ = page.getByRole('textbox', { name: 'Expression à évaluer dans la page' });
    await champ.fill('2 + 3');
    await champ.press('Enter');

    const console = page.getByRole('region', { name: 'Console de l’aperçu' });
    // L'expression est réaffichée, puis son résultat.
    await expect(console).toContainText('2 + 3');
    await expect(console).toContainText('5', { timeout: 10_000 });
  });

  test('la console interactive atteint le DOM de la page', async ({ page }) => {
    await creerSite(page);
    await page.getByRole('button', { name: "Afficher l'aperçu" }).click();
    await page.getByRole('button', { name: 'Afficher la console' }).click();

    const champ = page.getByRole('textbox', { name: 'Expression à évaluer dans la page' });
    await champ.fill('document.querySelector("h1").textContent');
    await champ.press('Enter');

    await expect(page.getByRole('region', { name: 'Console de l’aperçu' })).toContainText(
      'Mon site',
      { timeout: 10_000 }
    );
  });

  test('une expression erronée affiche l’erreur sans casser l’aperçu', async ({ page }) => {
    await creerSite(page);
    await page.getByRole('button', { name: "Afficher l'aperçu" }).click();
    await page.getByRole('button', { name: 'Afficher la console' }).click();

    const champ = page.getByRole('textbox', { name: 'Expression à évaluer dans la page' });
    await champ.fill('variableInexistante.propriete');
    await champ.press('Enter');

    await expect(page.getByRole('region', { name: 'Console de l’aperçu' })).toContainText(
      /Error|is not defined/,
      { timeout: 10_000 }
    );
    // L'aperçu reste fonctionnel après l'erreur.
    await expect(page.frameLocator('iframe[title="Aperçu HTML"]').locator('h1')).toBeVisible();
  });

  test('l’historique des expressions se parcourt aux flèches', async ({ page }) => {
    await creerSite(page);
    await page.getByRole('button', { name: "Afficher l'aperçu" }).click();
    await page.getByRole('button', { name: 'Afficher la console' }).click();

    const champ = page.getByRole('textbox', { name: 'Expression à évaluer dans la page' });
    await champ.fill('1 + 1');
    await champ.press('Enter');
    await expect(champ).toHaveValue('');

    await champ.press('ArrowUp');
    await expect(champ).toHaveValue('1 + 1');

    await champ.press('ArrowDown');
    await expect(champ).toHaveValue('');
  });

  test('le sélecteur de format contraint la largeur de l’aperçu', async ({ page }) => {
    await creerSite(page);
    await page.getByRole('button', { name: "Afficher l'aperçu" }).click();

    const cadre = page.locator('iframe[title="Aperçu HTML"]');
    const bureau = (await cadre.boundingBox())!.width;

    await page.getByRole('button', { name: 'Format Mobile' }).click();
    await expect.poll(async () => (await cadre.boundingBox())!.width).toBeLessThan(400);

    await page.getByRole('button', { name: 'Format Tablette' }).click();
    await expect.poll(async () => Math.round((await cadre.boundingBox())!.width)).toBe(768);

    await page.getByRole('button', { name: 'Format Bureau' }).click();
    await expect.poll(async () => (await cadre.boundingBox())!.width).toBeCloseTo(bureau, -1);
  });

  test('le site reste fonctionnel en format mobile', async ({ page }) => {
    await creerSite(page);
    await page.getByRole('button', { name: "Afficher l'aperçu" }).click();
    await page.getByRole('button', { name: 'Format Mobile' }).click();

    // Le contenu et les scripts continuent de fonctionner dans le cadre réduit.
    const cadre = page.frameLocator('iframe[title="Aperçu HTML"]');
    await expect(cadre.locator('h1')).toBeVisible();
    await cadre.locator('#compteur').click();
    await expect(cadre.locator('#compteur')).toHaveText('1 clic');
  });

  test('une ressource manquante ouvre le fichier fautif', async ({ page }) => {
    // Une page dont la feuille de styles référence une image absente.
    await page.keyboard.press('Control+Shift+P');
    await page.getByPlaceholder('Rechercher une commande…').fill('Site web complet');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: /index\.html/ })).toBeVisible();

    const styles = page.getByRole('treeitem').filter({ hasText: 'styles.css' }).first();
    await styles.getByRole('button', { name: /Ouvrir styles\.css/ }).click();
    await page.locator('.monaco-editor').first().click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('body { background: url("absente.png"); }');

    await page.getByRole('tab', { name: /index\.html/ }).click();
    await page.getByRole('button', { name: "Afficher l'aperçu" }).click();

    // Le compteur d'avertissements ouvre la liste détaillée.
    await page.getByRole('button', { name: /ressource\(s\) introuvable/ }).click();
    const liste = page.getByRole('region', { name: 'Ressources introuvables' });
    await expect(liste).toContainText('absente.png');
    // Le manque désigne styles.css, pas index.html.
    await expect(liste).toContainText('styles.css');

    await liste.getByRole('button').first().click();
    // Le fichier fautif est ouvert dans l'éditeur.
    await expect(page.getByRole('contentinfo')).toContainText('styles.css');
  });

  test('la page prévisualisée reste isolée du stockage', async ({ page }) => {
    await creerSite(page);

    // On injecte une tentative d'accès dans le script lié du site.
    const script = page.getByRole('treeitem').filter({ hasText: 'app.js' }).first();
    await script.getByRole('button', { name: /Ouvrir app\.js/ }).click();
    await expect(page.locator('.monaco-editor').first()).toContainText('Script chargé');
    await page.locator('.monaco-editor').first().click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type(
      'try { console.log("cles=" + Object.keys(localStorage).length); } catch (e) { console.log("acces refuse"); }'
    );

    await page.getByRole('tab', { name: /index\.html/ }).click();
    await page.getByRole('button', { name: "Afficher l'aperçu" }).click();
    await page.getByRole('button', { name: 'Afficher la console' }).click();

    await expect(page.getByRole('region', { name: 'Console de l’aperçu' })).toContainText(
      'acces refuse',
      { timeout: 10_000 }
    );
  });
});
