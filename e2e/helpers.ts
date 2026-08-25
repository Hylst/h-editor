import { expect, type Page } from '@playwright/test';

/** Attend que l'espace de travail soit chargé et l'éditeur Monaco monté. */
export const waitForEditor = async (page: Page) => {
  await expect(page.getByRole('tablist', { name: 'Fichiers ouverts' })).toBeVisible();
  await expect(page.locator('.monaco-editor').first()).toBeVisible();
  // La sauvegarde initiale confirme que la couche de persistance a répondu.
  await expect(page.getByRole('contentinfo')).toContainText(/Enregistré|fichier/, {
    timeout: 10_000,
  });
};

/**
 * Ouvre l'application sur un profil vierge.
 *
 * Playwright crée un contexte navigateur neuf pour chaque test : localStorage et
 * IndexedDB sont déjà vides. Surtout, il ne faut PAS appeler
 * `indexedDB.deleteDatabase()` une fois l'application chargée : elle détient une
 * connexion ouverte, la suppression est donc différée et s'exécute après le
 * rechargement — effaçant le contenu que la nouvelle session vient d'écrire.
 */
export const openFreshApp = async (page: Page) => {
  await page.goto('./');
  await waitForEditor(page);
};

/** Contenu du fichier actif, lu depuis le modèle Monaco. */
export const editorText = (page: Page) =>
  page.locator('.monaco-editor').first().locator('.view-lines').innerText();

/**
 * Écrit dans l'éditeur actif.
 *
 * Monaco est remonté à chaque changement de fichier : taper dans la foulée d'un
 * `Ctrl+N` fait perdre les premiers caractères. On s'assure donc que la zone de
 * saisie a bien le focus, puis on vérifie que le texte est arrivé.
 */
export const typeInEditor = async (page: Page, text: string) => {
  const editor = page.locator('.monaco-editor').first();
  await expect(editor).toBeVisible();
  await editor.click();

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const active = document.activeElement;
          return !!active?.closest('.monaco-editor');
        }),
      { timeout: 10_000 }
    )
    .toBe(true);

  const avant = await editor.innerText();
  await page.keyboard.type(text);

  // On vérifie que la frappe a porté, sans exiger le texte à l'identique :
  // `formatOnType` de Monaco réécrit la ligne pendant la saisie.
  await expect.poll(() => editor.innerText(), { timeout: 10_000 }).not.toBe(avant);
};

/** Noms des fichiers présents dans l'explorateur. */
export const explorerFiles = async (page: Page): Promise<string[]> => {
  const items = page.getByRole('tree', { name: 'Fichiers du projet' }).getByRole('treeitem');
  return (await items.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
};

/** Noms des onglets ouverts. */
export const openTabs = async (page: Page): Promise<string[]> => {
  const tabs = page.getByRole('tab');
  return (await tabs.allInnerTexts()).map((t) => t.trim());
};

/**
 * Attend que l'état attendu soit réellement present dans le stockage.
 *
 * Se fier au texte « Enregistré à … » de la barre d'état ne suffit pas : il peut
 * dater d'une sauvegarde précédente et laisser passer un rechargement trop tôt.
 */
export const waitForPersisted = async (page: Page, expectedFileNames: string[]) => {
  await expect
    .poll(async () => readPersistedFiles(page), { timeout: 10_000 })
    .toEqual(expect.arrayContaining(expectedFileNames));
};

/** Attend la confirmation visuelle d'une écriture (barre d'état). */
export const waitForSaved = async (page: Page) => {
  await expect(page.getByRole('contentinfo')).toContainText(/Enregistré à/, { timeout: 10_000 });
};

/** Attend que le contenu d'un fichier soit bien celui attendu dans le stockage. */
export const waitForPersistedContent = async (page: Page, fileName: string, needle: string) => {
  await expect
    .poll(
      () =>
        page.evaluate(async (name) => {
          const raw = localStorage.getItem('editorx-workspace');
          if (!raw) return null;
          const meta = JSON.parse(raw);
          const file = (meta.files as { id: string; name: string; content?: string }[]).find(
            (f) => f.name === name
          );
          if (!file) return null;
          if (!meta.contentInIdb) return file.content ?? '';

          return await new Promise<string | null>((resolve) => {
            const open = indexedDB.open('editorx');
            open.onsuccess = () => {
              const request = open.result
                .transaction('file-content', 'readonly')
                .objectStore('file-content')
                .get(file.id);
              request.onsuccess = () => resolve((request.result as string) ?? null);
              request.onerror = () => resolve(null);
            };
            open.onerror = () => resolve(null);
          });
        }, fileName),
      { timeout: 10_000 }
    )
    .toContain(needle);
};

/** État persisté, tel que relu depuis le navigateur. */
export const readPersistedFiles = (page: Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('editorx-workspace');
    if (!raw) return [] as string[];
    return (JSON.parse(raw).files as { name: string }[]).map((f) => f.name);
  });
