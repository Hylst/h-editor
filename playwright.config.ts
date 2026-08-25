import { defineConfig, devices } from '@playwright/test';

/**
 * Tests E2E — ils s'exécutent sur le **build de production** servi par
 * `vite preview`, et non sur le serveur de développement : c'est l'artefact
 * réellement déployé qui est vérifié (Monaco embarqué, chunks, service worker
 * désactivé côté preview).
 *
 * Lancement : `npm run test:e2e` (construit puis teste)
 *             `npm run test:e2e:ui` pour le mode interactif.
 */
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}/app/`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Une seconde tentative même en local : ces tests pilotent trois moteurs réels
  // et dépendent de délais de rendu. Playwright signale distinctement les tests
  // « flaky » — on les rend visibles au lieu de les masquer.
  retries: 1,
  // Playwright utilise par défaut la moitié des cœurs. Sur une machine chargée,
  // Firefox et WebKit dépassaient alors les délais sans qu'aucun défaut applicatif
  // ne soit en cause (vérifié : les mêmes tests passent en série).
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Chaque test part d'un navigateur vierge : aucun état ne fuit d'un test à l'autre.
    storageState: undefined,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /responsive\.spec\.ts/,
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      testMatch: /responsive\.spec\.ts/,
    },
    /**
     * Firefox et WebKit ne rejouent que les régressions critiques et les
     * fonctionnalités : la File System Access API et `showDirectoryPicker` y sont
     * absentes (replis prévus), et les mesures de performance dépendraient trop
     * du moteur pour constituer un garde-fou utile.
     */
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: /(regressions|features)\.spec\.ts/,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: /(regressions|features)\.spec\.ts/,
    },
  ],

  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
