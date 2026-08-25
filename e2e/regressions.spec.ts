import { expect, test } from '@playwright/test';
import {
  editorText,
  explorerFiles,
  openFreshApp,
  openTabs,
  readPersistedFiles,
  typeInEditor,
  waitForPersisted,
  waitForPersistedContent,
  waitForSaved,
} from './helpers';

/**
 * Non-régression des bugs critiques corrigés en 1.1.0.
 * Chaque test décrit le comportement fautif qu'il empêche de revenir.
 */
test.describe('Régressions critiques', () => {
  test.beforeEach(async ({ page }) => {
    await openFreshApp(page);
  });

  test('fermer un onglet ne supprime pas le fichier', async ({ page }) => {
    // Avant : performTabClose retirait le fichier du projet ET du stockage.
    expect(await explorerFiles(page)).toContain('bienvenue.md');

    await page.getByRole('button', { name: "Fermer l'onglet bienvenue.md" }).click();

    expect(await openTabs(page)).toHaveLength(0);
    expect(await explorerFiles(page)).toContain('bienvenue.md');
    await waitForSaved(page);
    expect(await readPersistedFiles(page)).toContain('bienvenue.md');
  });

  test('Ctrl+Maj+T rouvre le dernier onglet fermé', async ({ page }) => {
    await page.getByRole('button', { name: "Fermer l'onglet bienvenue.md" }).click();
    expect(await openTabs(page)).toHaveLength(0);

    await page.keyboard.press('Control+Shift+T');
    await expect(page.getByRole('tab', { name: /bienvenue\.md/ })).toBeVisible();
  });

  test('les noms de nouveaux fichiers restent uniques après suppression', async ({ page }) => {
    // Avant : `nouveau-fichier-${files.length + 1}` recréait un nom existant.
    for (let i = 0; i < 3; i++) await page.keyboard.press('Control+n');
    await expect(page.getByRole('tab')).toHaveCount(4);

    const item = page
      .getByRole('treeitem')
      .filter({ hasText: 'nouveau-fichier-2.txt' })
      .first();
    await item.hover();
    await item.getByRole('button', { name: /Actions pour/ }).click();
    await page.getByRole('menuitem', { name: 'Supprimer' }).click();
    await page.getByRole('button', { name: 'Supprimer', exact: true }).click();

    await page.keyboard.press('Control+n');
    await waitForSaved(page);

    const names = await readPersistedFiles(page);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('nouveau-fichier-2.txt');
  });

  test('un projet volumineux ne fait pas planter l’application', async ({ page }) => {
    // Avant : QuotaExceededError non capturée → arbre React démonté (page blanche).
    await page.evaluate(async () => {
      const big = new File(['const a = 1;\n'.repeat(400_000)], 'gros-fichier.js', {
        type: 'text/plain',
      });
      const dt = new DataTransfer();
      dt.items.add(big);
      document
        .querySelector('[role="tree"]')!
        .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    });

    await expect(page.getByRole('treeitem').filter({ hasText: 'gros-fichier.js' })).toBeVisible();
    await waitForSaved(page);

    // L'application est toujours vivante et les métadonnées restent minuscules.
    await expect(page.getByRole('contentinfo')).toBeVisible();
    const metaSize = await page.evaluate(
      () => localStorage.getItem('editorx-workspace')!.length
    );
    expect(metaSize).toBeLessThan(5_000);
  });

  test('la session (contenu + onglets) survit à un rechargement', async ({ page }) => {
    await page.keyboard.press('Control+n');
    await typeInEditor(page, 'const persistance = true;');
    await waitForPersisted(page, ['bienvenue.md', 'nouveau-fichier-1.txt']);
    await waitForPersistedContent(page, 'nouveau-fichier-1.txt', 'const persistance = true;');

    await page.reload();
    await expect(page.getByRole('tab')).toHaveCount(2);
    await expect(page.locator('.monaco-editor').first()).toContainText('const persistance = true;');
  });

  test('la dernière frappe est enregistrée même en fermant aussitôt', async ({ page }) => {
    // Avant : 600 ms d'anti-rebond = fenêtre de perte à la fermeture.
    await page.keyboard.press('Control+n');
    await typeInEditor(page, 'sauvegarde-immediate');

    // Simule le passage en arrière-plan (déclencheur de la purge).
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await page.reload();
    await expect(page.locator('.monaco-editor').first()).toContainText('sauvegarde-immediate');
  });

  test('renommer un fichier ne le marque pas comme non enregistré', async ({ page }) => {
    const item = page.getByRole('treeitem').filter({ hasText: 'bienvenue.md' }).first();
    await item.getByRole('button', { name: /Ouvrir bienvenue\.md/ }).dblclick();

    const input = page.getByRole('textbox', { name: 'Nouveau nom du fichier' });
    await input.fill('lisez-moi.md');
    await input.press('Enter');

    await expect(page.getByRole('treeitem').filter({ hasText: 'lisez-moi.md' })).toBeVisible();
    // Le point « non enregistré sur le disque » ne doit pas apparaître.
    await expect(page.getByRole('tab', { name: /lisez-moi\.md/ })).not.toContainText('●');
  });

  test('la suppression est confirmée puis annulable', async ({ page }) => {
    await page.keyboard.press('Control+n');
    const item = page.getByRole('treeitem').filter({ hasText: 'nouveau-fichier-1.txt' }).first();
    await item.hover();
    await item.getByRole('button', { name: /Actions pour/ }).click();
    await page.getByRole('menuitem', { name: 'Supprimer' }).click();

    await expect(page.getByRole('alertdialog')).toContainText('nouveau-fichier-1.txt');
    await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
    await expect(page.getByRole('treeitem').filter({ hasText: 'nouveau-fichier-1.txt' })).toHaveCount(0);

    // « Annuler » existe aussi dans le dialogue : on cible celui de la notification.
    await page.locator('[data-sonner-toast]').getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByRole('treeitem').filter({ hasText: 'nouveau-fichier-1.txt' })).toBeVisible();
  });

  test('un second onglet ne peut pas écraser silencieusement le premier', async ({ page, context }) => {
    // Avant : le dernier onglet à écrire remplaçait le travail de l'autre sans un mot.
    await page.keyboard.press('Control+n');
    await typeInEditor(page, 'version-onglet-A');
    await waitForPersistedContent(page, 'nouveau-fichier-1.txt', 'version-onglet-A');

    // Un second onglet écrit à son tour.
    const second = await context.newPage();
    await second.goto('./');
    await expect(second.locator('.monaco-editor').first()).toBeVisible();
    await second.keyboard.press('Control+n');
    await second.locator('.monaco-editor').first().click();
    await second.keyboard.type('version-onglet-B');
    await waitForPersistedContent(second, 'nouveau-fichier-2.txt', 'version-onglet-B');

    // Le premier onglet tente d'écrire : la sauvegarde doit être refusée.
    await typeInEditor(page, '-suite');
    await expect(page.getByRole('contentinfo')).toContainText(/Stockage saturé|Enregistrement|Enregistré/);

    // Le travail du second onglet est toujours là.
    const names = await readPersistedFiles(second);
    expect(names).toContain('nouveau-fichier-2.txt');

    await second.close();
  });

  test('aucune requête vers un domaine tiers', async ({ page }) => {
    // Avant : Monaco venait de cdn.jsdelivr.net et la police de Google Fonts.
    const external: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (!url.startsWith('http://localhost') && !url.startsWith('data:') && !url.startsWith('blob:')) {
        external.push(url);
      }
    });

    await page.reload();
    await typeInEditor(page, 'const x = 1;');
    expect(external).toEqual([]);
  });

  test('aucune erreur dans la console', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.reload();
    await page.keyboard.press('Control+n');
    await typeInEditor(page, 'const sansErreur = true;');
    await waitForSaved(page);

    expect(errors).toEqual([]);
  });

  test('le contenu de l’éditeur reste lisible après réglage extrême', async ({ page }) => {
    // Avant : vider le champ « taille de police » écrivait fontSize: null.
    await page.evaluate(() => {
      localStorage.setItem(
        'editorx-settings',
        JSON.stringify({ fontSize: null, tabSize: 'abc', theme: 'inconnu' })
      );
    });
    await page.reload();
    await expect(page.locator('.monaco-editor').first()).toBeVisible();

    // Ce qui compte d'abord : l'éditeur reste lisible et affiche le contenu.
    await expect.poll(() => editorText(page), { timeout: 10_000 }).toBeTruthy();

    // La réécriture des réglages assainis est asynchrone (effet React) : on la
    // laisse advenir plutôt que de lire le stockage dans la foulée du reload.
    await expect
      .poll(
        () => page.evaluate(() => JSON.parse(localStorage.getItem('editorx-settings')!)),
        { timeout: 10_000 }
      )
      .toMatchObject({ fontSize: 14, tabSize: 2, theme: 'vs-dark' });
  });
});
