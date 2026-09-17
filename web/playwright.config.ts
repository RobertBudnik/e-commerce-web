import { defineConfig, devices } from '@playwright/test';

/**
 * Testy jadą po prawdziwym sklepie i po lokalnej bazie — bez atrap.
 * Wymagają działającego stacku Supabase (`npm run db:start` w katalogu wyżej);
 * bez niego katalog jest pusty i testy słusznie padną.
 *
 * Serwer deweloperski jest podnoszony przez Playwrighta, ale gdy już chodzi,
 * jest wykorzystywany ponownie — inaczej każde uruchomienie kosztowałoby
 * kilkanaście sekund startu. Wyjątkiem jest `E2E_BASE_URL`: wtedy testy jadą
 * po gotowym adresie i podnoszenie czegokolwiek lokalnie nie ma sensu.
 */
export default defineConfig({
  testDir: './e2e',
  /* Rozgrzewka cache'u — patrz `e2e/rozgrzewka.ts`. Chodzi po starcie
     serwera, a przed pierwszym testem. */
  globalSetup: './e2e/rozgrzewka.ts',
  fullyParallel: false,
  // Zamówienia i stany magazynowe to wspólny stan; równoległe pliki
  // potrafiłyby sobie nawzajem wyczyścić koszyk albo zabrać ostatnią sztukę.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],

  /**
   * Limity czasu podniesione na maszynie CI.
   *
   * Testy chodzą po serwerze deweloperskim, a ten kompiluje trasę przy
   * pierwszym wejściu. Lokalnie cały zestaw schodzi w 2,3 minuty; na runnerze
   * GitHuba te same 29 testów zajmuje 7,4 minuty i pojedyncze `page.goto`
   * potrafi przekroczyć domyślne 30 sekund — nie dlatego, że sklep jest
   * zepsuty, tylko dlatego, że akurat kompiluje `/koszyk`.
   *
   * Podnosimy sufit zamiast ścigać się z kompilatorem. Gdyby to przestało
   * wystarczać, właściwym krokiem jest puszczenie e2e po buildzie
   * produkcyjnym (`next start`) zamiast po `next dev` — wtedy znika cała
   * kompilacja na żądanie.
   */
  timeout: process.env.CI ? 90_000 : 30_000,
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    locale: 'pl-PL',
    // Nawigacja i akcje też dostają zapas na wolnym runnerze.
    navigationTimeout: process.env.CI ? 45_000 : 30_000,
    actionTimeout: process.env.CI ? 20_000 : 0,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  /**
   * W CI testy jadą po buildzie produkcyjnym, lokalnie po serwerze
   * deweloperskim.
   *
   * Do tej pory CI robiło rzecz bez sensu: budowało produkcyjnie
   * (`build:check` pisze do `.next-build`), po czym wyrzucało ten build
   * i puszczało testy po `next dev`, który kompiluje każdą trasę przy
   * pierwszym wejściu. Stąd brały się minuty czekania na `page.goto`
   * i kaskada przekroczonych limitów, gdy runner zwolnił.
   *
   * `start:check` podnosi serwer z katalogu, który zbudował poprzedni krok,
   * więc kompilacja na żądanie znika w całości. To jest dokładnie ten krok,
   * który zapowiadał komentarz przy limitach czasu wyżej.
   *
   * Lokalnie zostaje `next dev`: tam liczy się przeładowanie po zmianie
   * pliku, a nie czas zestawu.
   */
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.CI ? 'npm run start:check' : 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
