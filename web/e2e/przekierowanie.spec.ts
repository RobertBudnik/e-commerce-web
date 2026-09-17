import { test, expect } from '@playwright/test';
import { sciezkaPowrotu } from '../lib/sciezka-powrotu';

/**
 * Otwarte przekierowanie po zalogowaniu.
 *
 * Parametr `powrot` szedł kiedyś prosto do `redirect()`. Link wyglądający jak
 * adres sklepu — bo nim był — wyrzucał zalogowanego na obcą domenę już po
 * poprawnym logowaniu. Te przypadki to lista tego, co wtedy przechodziło.
 */
test.describe('Ścieżka powrotu', () => {
  const OBCE = [
    'https://obcy.example.com',
    'http://obcy.example.com',
    '//obcy.example.com',
    '/\\obcy.example.com',
    '/\t/obcy.example.com',   // tabulator: przeglądarka go usunie i zostanie //obcy
    'javascript:alert(1)',
    '',
  ];

  for (const wartosc of OBCE) {
    test(`odrzuca ${JSON.stringify(wartosc)}`, () => {
      expect(sciezkaPowrotu(wartosc)).toBe('/konto');
    });
  }

  const WLASNE = ['/konto', '/panel/zamowienia', '/panel/stany?stan=nowe', '/produkt/laptop-nova-14-pro'];

  for (const wartosc of WLASNE) {
    test(`przepuszcza ${wartosc}`, () => {
      expect(sciezkaPowrotu(wartosc)).toBe(wartosc);
    });
  }

  test('brak parametru daje domyślną ścieżkę', () => {
    expect(sciezkaPowrotu(undefined)).toBe('/konto');
    expect(sciezkaPowrotu(null)).toBe('/konto');
  });

  test('formularz logowania nie niesie obcego adresu w ukrytym polu', async ({ page }) => {
    await page.goto('/logowanie?powrot=https://obcy.example.com');
    await expect(page.locator('input[name="powrot"]')).toHaveValue('/konto');
  });
});
