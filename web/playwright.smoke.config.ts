import { defineConfig, devices } from '@playwright/test';

/**
 * Testy dymne po gotowym wdrożeniu (podgląd z Vercela albo produkcja).
 *
 * Zestaw z `e2e/` tu nie pasuje: tamte testy kupują, rezerwują stan i logują
 * się na konta z seeda. Puszczone po podglądzie zostawiłyby prawdziwe
 * zamówienia w bazie produkcyjnej i zjadłyby stany magazynowe. Tutaj wolno
 * tylko czytać.
 */
const baseURL = process.env.E2E_BASE_URL;

if (!baseURL) {
  throw new Error('Ustaw E2E_BASE_URL na adres wdrożenia, np. https://nordo-abc123.vercel.app');
}

export default defineConfig({
  testDir: './e2e-smoke',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // Świeże wdrożenie potrafi odpowiedzieć na zimno; jedno powtórzenie
  // oddziela zimny start od prawdziwej awarii.
  retries: 2,
  timeout: 30_000,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL,
    locale: 'pl-PL',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
