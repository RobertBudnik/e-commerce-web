import { defineConfig, devices } from '@playwright/test';

/**
 * Testy jadą po prawdziwym sklepie i po lokalnej bazie — bez atrap.
 * Wymagają działającego stacku Supabase (`npm run db:start` w katalogu wyżej);
 * bez niego katalog jest pusty i testy słusznie padną.
 *
 * Serwer deweloperski jest podnoszony przez Playwrighta, ale gdy już chodzi,
 * jest wykorzystywany ponownie — inaczej każde uruchomienie kosztowałoby
 * kilkanaście sekund startu.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // Zamówienia i stany magazynowe to wspólny stan; równoległe pliki
  // potrafiłyby sobie nawzajem wyczyścić koszyk albo zabrać ostatnią sztukę.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    locale: 'pl-PL',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
