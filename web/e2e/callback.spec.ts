import { expect, test } from '@playwright/test';

/**
 * Wejście z poczty — `app/auth/callback/route.ts`.
 *
 * Testy jadą po prawdziwym adresie, a nie po zaimportowanej funkcji. Route
 * handler dostaje `NextRequest`, czyta ciasteczka i kończy przekierowaniem;
 * zawołany bezpośrednio z testu nie miałby ani jednego z tych trzech, więc
 * sprawdzałby atrapę zamiast tego, co naprawdę odpowiada przeglądarce.
 *
 * Token w tych przypadkach jest zmyślony i to jest w porządku: sprawdzamy
 * zachowanie przy złym, brakującym i wrogim wejściu. Ścieżkę z prawdziwym
 * tokenem przechodzi `rejestracja.spec.ts`, bo tam jest skąd go wziąć.
 */
test.describe('Wejście z poczty', () => {
  // Same przekierowania — nie ma po co czekać na dociągnięcie strony docelowej.
  test.use({ javaScriptEnabled: false });

  test('bez żadnych parametrów mówi, że link jest pusty', async ({ page }) => {
    await page.goto('/auth/callback');
    await expect(page).toHaveURL(/\/auth\/blad\?powod=brak/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Pusty link');
  });

  test('zmyślony token trafia na ekran wygaśnięcia, nie na surowy błąd', async ({ page }) => {
    await page.goto('/auth/callback?token_hash=zmyslony-token&type=signup');
    await expect(page).toHaveURL(/\/auth\/blad\?powod=wygasl/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Link stracił ważność');
  });

  test('zmyślony kod PKCE też kończy się ekranem, nie wyjątkiem', async ({ page }) => {
    await page.goto('/auth/callback?code=zmyslony-kod');
    await expect(page).toHaveURL(/\/auth\/blad\?powod=wygasl/);
  });

  test('błąd odbity przez Supabase jest tłumaczony na ludzki ekran', async ({ page }) => {
    await page.goto('/auth/callback?error=access_denied&error_code=otp_expired');
    await expect(page).toHaveURL(/\/auth\/blad\?powod=wygasl/);
  });

  /**
   * Rodzaj spoza listy nie może wejść do `verifyOtp`. Gdyby wchodził,
   * decydowałby o nim ciąg z adresu, czyli ktokolwiek podsunął link.
   */
  test('nieznany rodzaj tokenu jest odrzucany', async ({ page }) => {
    await page.goto('/auth/callback?token_hash=cokolwiek&type=wymyslony');
    await expect(page).toHaveURL(/\/auth\/blad\?powod=brak/);
  });

  /**
   * Otwarte przekierowanie podpięte pod prawdziwe potwierdzenie konta byłoby
   * najlepszym możliwym nośnikiem wyłudzenia: adres sklepu, prawdziwe
   * logowanie, a na końcu cudza strona. `sciezkaPowrotu` ma to ucinać —
   * tu sprawdzamy, że callback naprawdę przez nią przechodzi.
   *
   * Przy zmyślonym tokenie kończymy na ekranie błędu, więc dowodem jest to,
   * że obcy adres nie pojawia się nigdzie w adresie strony.
   */
  const WROGIE_NEXT = [
    'https://obcy.example.com',
    '//obcy.example.com',
    '/\\obcy.example.com',
    'javascript:alert(1)',
  ];

  for (const wrogi of WROGIE_NEXT) {
    test(`nie odsyła na ${JSON.stringify(wrogi)}`, async ({ page }) => {
      await page.goto(
        `/auth/callback?token_hash=zmyslony&type=signup&next=${encodeURIComponent(wrogi)}`
      );

      const adres = new URL(page.url());
      expect(adres.hostname).toBe('localhost');
      expect(page.url()).not.toContain('obcy.example.com');
    });
  }
});
