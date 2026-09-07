import { expect, test } from '@playwright/test';

/** Nombre total d'entrées présentes dans les caches du service worker. */
const cachedCount = (page: import('@playwright/test').Page) =>
  page.evaluate(async () => {
    const names = await caches.keys();
    let total = 0;
    for (const name of names) {
      total += (await (await caches.open(name)).keys()).length;
    }
    return total;
  });

/**
 * Vérifie que l'allègement du précache (10,0 → 5,3 Mo) n'a pas cassé le
 * fonctionnement hors ligne : la coquille, Monaco et la police doivent rester
 * disponibles sans réseau.
 */
test.describe('Fonctionnement hors ligne', () => {
  test('l’éditeur se charge sans réseau après une première visite', async ({ page, context }) => {
    test.setTimeout(120_000);

    // Première visite : le service worker s'installe et remplit son précache.
    await page.goto('./');
    await expect(page.locator('.monaco-editor').first()).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => navigator.serviceWorker.ready);

    // On attend que le précache cesse de croître : couper le réseau trop tôt
    // testerait la vitesse de la machine, pas la capacité hors ligne.
    let previous = -1;
    let stableRounds = 0;
    for (let i = 0; i < 60 && stableRounds < 3; i++) {
      const count = await cachedCount(page);
      stableRounds = count > 0 && count === previous ? stableRounds + 1 : 0;
      previous = count;
      if (stableRounds < 3) await page.waitForTimeout(500);
    }
    expect(previous).toBeGreaterThan(10);

    // Coupure du réseau.
    await context.setOffline(true);
    await page.reload();

    // L'application doit s'afficher et rester utilisable.
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.monaco-editor').first()).toBeVisible({ timeout: 30_000 });

    await page.locator('.monaco-editor').first().click();
    await page.keyboard.type('hors ligne');
    await expect(page.locator('.monaco-editor').first()).toContainText('hors ligne');

    await context.setOffline(false);
  });

  test('les illustrations de communication ne sont pas précachées', async ({ page }) => {
    // 4,4 Mo d'images promotionnelles alourdissaient le premier chargement
    // sans jamais servir à l'éditeur.
    await page.goto('./');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForTimeout(3000);

    const social = await page.evaluate(async () => {
      const names = await caches.keys();
      const urls: string[] = [];
      for (const name of names) {
        for (const request of await (await caches.open(name)).keys()) {
          urls.push(new URL(request.url).pathname);
        }
      }
      return urls.filter((u) => u.includes('/social/') || u.includes('og-image'));
    });

    expect(social).toEqual([]);
  });

  test('une URL inconnue hors ligne affiche la page de fallback', async ({ page, context }) => {
    test.setTimeout(120_000);

    // Première visite : installation du service worker et remplissage du précache.
    await page.goto('./');
    await expect(page.locator('.monaco-editor').first()).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForTimeout(1000);

    // Coupure du réseau puis navigation vers une route non précachée.
    await context.setOffline(true);
    // URL inconnue sous la portée du SW : elle ne fait partie ni du précache ni du denylist.
    await page.goto('./route-inconnue-offline');

    // Le navigateFallback doit servir offline.html, pas une erreur brute.
    await expect(page).toHaveTitle('H Editor — Hors ligne');
    await expect(page.getByRole('link', { name: "Retour à l'éditeur" })).toBeVisible();

    await context.setOffline(false);
  });
});
