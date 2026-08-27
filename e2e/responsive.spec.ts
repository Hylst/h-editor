import { expect, test } from '@playwright/test';
import { openFreshApp } from './helpers';

/** Exécuté sur le profil « mobile-chrome » (Pixel 7) — voir playwright.config.ts. */
test.describe('Affichage mobile', () => {
  test.beforeEach(async ({ page }) => {
    await openFreshApp(page);
  });

  test('la page ne défile pas horizontalement', async ({ page }) => {
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test('l’explorateur peut être replié pour libérer l’écran', async ({ page }) => {
    const explorer = page.getByRole('complementary', { name: 'Explorateur de fichiers' });
    // Sur mobile, l'explorateur démarre replié par défaut pour laisser la place à l'éditeur.
    await expect(explorer).toBeHidden();

    // On peut toujours l'ouvrir…
    await page.getByRole('button', { name: "Afficher l'explorateur" }).first().click();
    await expect(explorer).toBeVisible();

    // …puis le re-replier pour récupérer toute la largeur.
    await page.getByRole('button', { name: "Masquer l'explorateur" }).first().click();
    await expect(explorer).toBeHidden();

    const editor = page.locator('.monaco-editor').first();
    const box = (await editor.boundingBox())!;
    expect(box.width).toBeGreaterThan(page.viewportSize()!.width * 0.9);
  });

  test('l’aperçu Markdown est utilisable sur petit écran', async ({ page }) => {
    // Avant : l'aperçu était masqué sous md, le bouton n'avait aucun effet visible.
    await page.getByRole('button', { name: "Afficher l'aperçu" }).click();
    await expect(page.locator('.prose h1').first()).toBeVisible();

    await page.getByRole('button', { name: "Masquer l'aperçu" }).click();
    await expect(page.locator('.monaco-editor').first()).toBeVisible();
  });

  test('la barre d’outils reste accessible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Ouvrir un fichier' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Enregistrer|Télécharger/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Palette de commandes' })).toBeVisible();
  });
});
