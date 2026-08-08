import { expect, test } from '@playwright/test';
import { wyczyscStanPrzegladarki } from './pomoce';

test.describe('Katalog', () => {
  test.beforeEach(async ({ page }) => {
    await wyczyscStanPrzegladarki(page);
  });

  test('strona główna pokazuje kategorie i polecane prosto z serwera', async ({ page }) => {
    // Bez JavaScriptu treść i tak ma być w HTML-u — to cały sens SSR
    await page.context().addInitScript(() => {});
    const odpowiedz = await page.goto('/');
    const html = (await odpowiedz!.text()) ?? '';

    expect(html).toContain('Elektronika bez zbędnego hałasu');
    expect(html).toMatch(/Kategorie/);
    // Nazwa produktu w surowym HTML dowodzi, że siatka nie czeka na klienta
    expect(html).toMatch(/card-title/);

    await expect(page.locator('.category')).toHaveCount(4);
    await expect(page.locator('.card')).toHaveCount(4);
  });

  test('sklep filtruje po kategorii i sortuje po cenie', async ({ page }) => {
    await page.goto('/sklep');
    const wszystkie = await page.locator('.card').count();
    expect(wszystkie).toBeGreaterThan(1);

    await page.getByRole('button', { name: 'Audio', exact: true }).click();
    const audio = page.locator('.card');
    await expect(audio.first()).toBeVisible();
    expect(await audio.count()).toBeLessThan(wszystkie);
    for (const kafelek of await audio.all()) {
      await expect(kafelek.locator('.card-cat')).toHaveText(/audio/i);
    }

    await page.getByRole('button', { name: 'Wszystkie' }).click();
    await page.getByRole('button', { name: 'Sortowanie' }).click();
    await page.getByRole('option', { name: 'Cena malejąco' }).click();

    const ceny = await page.locator('.card .price').allInnerTexts();
    const liczby = ceny.map((t) => Number.parseFloat(t.replace(/[^\d,]/g, '').replace(',', '.')));
    expect(liczby).toEqual([...liczby].sort((a, b) => b - a));
  });

  test('szukajka zawęża listę, a brak trafień mówi to wprost', async ({ page }) => {
    await page.goto('/sklep');
    await page.getByPlaceholder('Szukaj').fill('laptop');
    await expect(page.locator('.card')).toHaveCount(1);

    await page.getByPlaceholder('Szukaj').fill('czegoś takiego nie ma');
    await expect(page.getByText('Brak produktów spełniających kryteria.')).toBeVisible();
  });

  test('szybki podgląd otwiera się i zamyka Escapem', async ({ page }) => {
    await page.goto('/sklep');
    await page.locator('.card').first().hover();
    await page.getByRole('button', { name: 'Szybki podgląd' }).first().click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('link', { name: 'Pełna karta produktu' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });

  test('karta produktu ma własne metadane i działający adres ze sluga', async ({ page }) => {
    await page.goto('/produkt/zarowka-smart-glow-e27');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Żarówka smart Glow E27');
    await expect(page).toHaveTitle(/Żarówka smart Glow E27/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      /Żarówka smart Glow E27/
    );
    await expect(page.locator('.specs tr')).not.toHaveCount(0);
  });

  test('nieistniejący produkt pokazuje stronę „nie znaleziono"', async ({ page }) => {
    await page.goto('/produkt/nie-ma-takiego-produktu');

    // Status bywa różny w dev i w produkcji; liczy się to, że nie ma karty
    await expect(page.locator('.product')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Dodaj do koszyka' })).toHaveCount(0);

    // Własna strona sklepu, nie domyślna Next. Wcześniej wystarczał tu sam
    // ciąg „404" gdziekolwiek w treści, więc test przechodził na czarnym
    // grotesku po angielsku, bez nagłówka i bez drogi powrotnej.
    await expect(page.getByRole('heading', { name: 'Nie ma takiej strony' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Przejdź do sklepu' })).toBeVisible();
    // Chrom sklepu zostaje na miejscu — klient nie wypada ze sklepu
    await expect(page.locator('.site-footer, footer')).toBeVisible();
  });
});
