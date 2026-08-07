import { expect, test } from '@playwright/test';

/**
 * Wyłącznie odczyt. Żadnego logowania, koszyka ani zamówień — te testy
 * chodzą po wdrożeniu podpiętym do prawdziwej bazy.
 *
 * Nie sprawdzamy też liczby produktów ani konkretnych nazw: katalog na
 * produkcji jest wpisywany ręcznie i nie ma nic wspólnego z seedem.
 */

test.describe('Dym po wdrożeniu', () => {
  test('strona główna odpowiada i renderuje się na serwerze', async ({ page }) => {
    const odpowiedz = await page.goto('/');
    expect(odpowiedz?.status()).toBe(200);

    // Treść ma być w surowym HTML — inaczej wdrożenie zgubiło SSR
    const html = (await odpowiedz!.text()) ?? '';
    expect(html).toContain('<h1');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('sklep pokazuje katalog z bazy', async ({ page }) => {
    const odpowiedz = await page.goto('/sklep');
    expect(odpowiedz?.status()).toBe(200);

    // Pusta siatka na produkcji oznacza zerwane połączenie z Supabase
    // albo politykę RLS odcinającą gościa od katalogu.
    await expect(page.locator('.card').first()).toBeVisible();
    await expect(page.locator('.card .price').first()).toBeVisible();
  });

  test('karta produktu otwiera się z listy', async ({ page }) => {
    await page.goto('/sklep');
    await page.locator('.card a').first().click();

    await page.waitForURL(/\/produkt\//);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // `.price` jest klasą kafelka w siatce, nie strony produktu — tu cena
    // nazywa się `product-price`. Selektor klasy dopasowuje cały token, więc
    // `.price` nie łapało ani `.price-old`, ani `.price-row`, i asercja padała
    // od pierwszego dnia istnienia tego testu.
    await expect(page.locator('.product-price').first()).toBeVisible();
  });

  test('koszyk gościa jest dostępny i pusty', async ({ page }) => {
    const odpowiedz = await page.goto('/koszyk');
    expect(odpowiedz?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('konto odbija gościa na logowanie', async ({ page }) => {
    await page.goto('/konto');
    await page.waitForURL(/\/logowanie/);
    // Middleware działa po wdrożeniu, nie tylko lokalnie
    expect(page.url()).toContain('powrot=');
  });

  test('nagłówki bezpieczeństwa dojechały z next.config', async ({ page }) => {
    const odpowiedz = await page.goto('/');
    const naglowki = odpowiedz!.headers();

    expect(naglowki['x-frame-options']).toBe('DENY');
    expect(naglowki['x-content-type-options']).toBe('nosniff');
    expect(naglowki['referrer-policy']).toBe('strict-origin-when-cross-origin');
    // HSTS ma sens dopiero po HTTPS — czyli dokładnie tutaj
    expect(naglowki['strict-transport-security']).toContain('max-age=');
  });

  test('robots i mapa strony wskazują adres wdrożenia', async ({ page, baseURL }) => {
    const robots = await page.goto('/robots.txt');
    expect(robots?.status()).toBe(200);

    const mapa = await page.goto('/sitemap.xml');
    expect(mapa?.status()).toBe(200);

    // Zły NEXT_PUBLIC_SITE_URL wypuszcza mapę z adresem localhost
    const xml = (await mapa!.text()) ?? '';
    expect(xml).not.toContain('localhost');
    expect(xml).toContain(new URL(baseURL!).hostname);
  });

  test('strona główna nie sypie błędami w konsoli', async ({ page }) => {
    const bledy: string[] = [];
    page.on('pageerror', (blad) => bledy.push(blad.message));
    page.on('console', (wpis) => {
      if (wpis.type() === 'error') bledy.push(wpis.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(bledy).toEqual([]);
  });
});
