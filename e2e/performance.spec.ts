import { expect, test } from '@playwright/test';
import { openFreshApp, waitForSaved } from './helpers';

/**
 * Garde-fous de performance.
 *
 * Ces seuils sont volontairement larges : ils ne mesurent pas une performance
 * absolue (qui dépend de la machine) mais empêchent une **régression d'ordre de
 * grandeur** — typiquement le retour d'un effet qui recalcule tout le projet à
 * chaque caractère saisi.
 */
test.describe('Performance', () => {
  test.beforeEach(async ({ page }) => {
    await openFreshApp(page);
  });

  test('la frappe reste fluide sur un projet volumineux', async ({ page }) => {
    // 40 fichiers de ~50 Ko : un projet réaliste, pas un cas limite.
    await page.evaluate(async () => {
      const dt = new DataTransfer();
      for (let i = 0; i < 40; i++) {
        dt.items.add(
          new File([`// fichier ${i}\n` + 'export const valeur = 1;\n'.repeat(2000)], `mod-${i}.ts`, {
            type: 'text/plain',
          })
        );
      }
      document
        .querySelector('[role="tree"]')!
        .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    });

    await expect(page.getByRole('treeitem')).toHaveCount(41, { timeout: 15_000 });
    await waitForSaved(page);

    // Mesure du temps de traitement de 30 frappes consécutives.
    await page.locator('.monaco-editor').first().click();
    const start = Date.now();
    await page.keyboard.type('const mesure = 123456789;', { delay: 0 });
    const elapsed = Date.now() - start;

    // Avant l'optimisation, chaque frappe reconstruisait l'explorateur et
    // rejouait les effets sur les 41 fichiers.
    expect(elapsed).toBeLessThan(4000);
    await expect(page.locator('.monaco-editor').first()).toContainText('const mesure = 123456789;');
  });

  test('l’explorateur reste utilisable avec 300 fichiers', async ({ page }) => {
    await page.evaluate(async () => {
      const dt = new DataTransfer();
      for (let i = 0; i < 300; i++) {
        dt.items.add(new File([`ligne ${i}`], `fichier-${String(i).padStart(3, '0')}.txt`));
      }
      document
        .querySelector('[role="tree"]')!
        .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    });

    await expect(page.getByRole('treeitem').first()).toBeVisible({ timeout: 20_000 });

    // Le filtre doit répondre rapidement même sur un gros arbre.
    const start = Date.now();
    await page.getByRole('textbox', { name: 'Filtrer les fichiers' }).fill('fichier-123');
    await expect(page.getByRole('treeitem')).toHaveCount(1, { timeout: 5000 });
    expect(Date.now() - start).toBeLessThan(5000);
  });

  test('l’explorateur ne garde qu’une fenêtre de nœuds dans le DOM', async ({ page }) => {
    // Avant : 2 000 fichiers = 2 000 nœuds, et 146 ms par caractère saisi.
    await page.evaluate(() => {
      const dt = new DataTransfer();
      for (let i = 0; i < 1200; i++) {
        dt.items.add(new File(['x'], `f-${String(i).padStart(4, '0')}.ts`));
      }
      document
        .querySelector('[role="tree"]')!
        .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    });
    await expect(page.getByRole('treeitem').first()).toBeVisible({ timeout: 60_000 });

    // Seule la portion visible est rendue.
    const rendered = await page.getByRole('treeitem').count();
    expect(rendered).toBeLessThan(120);
    expect(rendered).toBeGreaterThan(5);

    // Le défilement révèle bien la suite de la liste.
    const premiers = await page.getByRole('treeitem').allInnerTexts();
    await page.getByRole('tree').evaluate((el) => {
      el.scrollTop = 10_000;
    });
    await expect
      .poll(async () => (await page.getByRole('treeitem').allInnerTexts())[0], { timeout: 5000 })
      .not.toBe(premiers[0]);

    // Et le filtre continue de fonctionner sur l'ensemble du projet.
    await page.getByRole('textbox', { name: 'Filtrer les fichiers' }).fill('f-0999');
    await expect(page.getByRole('treeitem')).toHaveCount(1);
  });

  test('le repli d’un dossier masque bien son contenu', async ({ page }) => {
    // Garde-fou : l'aplatissement de l'arbre ne doit pas casser le repli.
    await page.getByRole('button', { name: 'Créer ou importer' }).click();
    await page.getByRole('menuitem', { name: 'Nouveau dossier' }).click();

    const dossier = page.getByRole('treeitem').filter({ hasText: 'nouveau-dossier-1' }).first();
    await dossier.hover();
    await dossier.getByRole('button', { name: /Actions pour le dossier/ }).click();
    await page.getByRole('menuitem', { name: 'Nouveau fichier' }).click();

    await expect(page.getByRole('treeitem').filter({ hasText: 'nouveau-fichier-1.txt' })).toBeVisible();

    // Replier : l'enfant disparaît.
    await page.getByRole('button', { name: /Replier le dossier/ }).click();
    await expect(page.getByRole('treeitem').filter({ hasText: 'nouveau-fichier-1.txt' })).toHaveCount(0);

    // Déplier : il revient.
    await page.getByRole('button', { name: /Déplier le dossier/ }).click();
    await expect(page.getByRole('treeitem').filter({ hasText: 'nouveau-fichier-1.txt' })).toBeVisible();
  });

  test('le démarrage reste rapide', async ({ page }) => {
    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return { domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime };
    });

    // Le chargement de Monaco est paresseux : la coquille doit apparaître vite.
    expect(timing.domContentLoaded).toBeLessThan(4000);
  });
});
