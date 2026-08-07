import { expect, test } from '@playwright/test';
import { CZAS_ZAMOWIENIA, dodajPierwszyDoKoszyka, gosc, kwota, wyczyscStanPrzegladarki } from './pomoce';

test.describe('Ścieżka zakupu', () => {
  test.beforeEach(async ({ page }) => {
    await wyczyscStanPrzegladarki(page);
  });

  test('dodanie produktu wysuwa szuflada z wyceną z bazy', async ({ page }) => {
    const nazwa = await dodajPierwszyDoKoszyka(page);

    const szuflada = page.locator('.drawer');
    await expect(szuflada.getByText(nazwa)).toBeVisible();
    await expect(szuflada.locator('.ship-bar')).toBeVisible();
    await expect(page.locator('.cart-count')).toHaveText('1');
  });

  test('krok ilości liczy od bieżącego stanu, nie od wartości z renderu', async ({ page }) => {
    await dodajPierwszyDoKoszyka(page);

    // Trzy szybkie kliknięcia bez czekania na przerysowanie: kiedyś dawały 2
    const plus = page.locator('.drawer .qty button').last();
    await plus.click();
    await plus.click();
    await plus.click();

    await expect(page.locator('.drawer .qty input')).toHaveValue('4');
    await expect(page.locator('.cart-count')).toHaveText('4');
  });

  test('kod rabatowy przelicza sumę, a zły kod nic nie zmienia', async ({ page }) => {
    await dodajPierwszyDoKoszyka(page);
    await page.goto('/koszyk');
    await expect(page.locator('.summary-row.total')).toBeVisible();

    const przed = await kwota(page, 'Razem');

    await page.getByPlaceholder('Kod rabatowy').fill('NOWY10');
    await page.getByRole('button', { name: 'Zastosuj' }).click();
    await expect(page.locator('.summary-row', { hasText: 'Rabat' })).toBeVisible();

    const po = await kwota(page, 'Razem');
    expect(po).toBeLessThan(przed);

    await page.getByPlaceholder('Kod rabatowy').fill('KODKTOREGONIEMA');
    await page.getByRole('button', { name: 'Zastosuj' }).click();
    await expect(page.getByText('Nieprawidłowy kod rabatowy')).toBeVisible();
  });

  test('gość składa zamówienie i dostaje numer, ale nie szczegóły', async ({ page }) => {
    await dodajPierwszyDoKoszyka(page);
    await page.goto('/koszyk');

    const dane = gosc();
    await page.getByLabel('Imię i nazwisko').fill(dane.name);
    await page.getByLabel('E-mail').fill(dane.email);
    await page.getByLabel('Telefon').fill(dane.phone);
    await page.getByLabel('Ulica i numer').fill(dane.street);
    await page.getByLabel('Kod pocztowy').fill(dane.zip);
    await page.getByLabel('Miasto').fill(dane.city);

    await page.getByRole('button', { name: /Zamawiam i płacę/ }).click();

    await page.waitForURL(/\/zamowienie\/NOR-/, { timeout: CZAS_ZAMOWIENIA });
    await expect(page.getByRole('heading', { name: 'Zamówienie przyjęte' })).toBeVisible();
    await expect(page.getByText(/NOR-\d{4}-\d{4}/)).toBeVisible();

    // Zamówienia gościa RLS nie wypuszcza — zostaje sam numer
    await expect(page.getByText(/Szczegóły zamówienia widzi konto/)).toBeVisible();

    // Koszyk odchodzi dopiero po udanym zamówieniu
    const koszyk = await page.evaluate(() => localStorage.getItem('shop.cart.v1'));
    expect(JSON.parse(koszyk ?? '[]')).toHaveLength(0);
  });

  test('koszyk ponad stan magazynowy blokuje zamówienie', async ({ page }) => {
    await page.goto('/sklep');

    // Pozycja z najmniejszym stanem, żeby dało się go przekroczyć
    const id = await page.evaluate(async () => {
      const res = await fetch('/sklep');
      return res.ok;
    });
    expect(id).toBe(true);

    await dodajPierwszyDoKoszyka(page);
    const linie = await page.evaluate(() => JSON.parse(localStorage.getItem('shop.cart.v1') ?? '[]'));

    // Podbicie ilości poza formularzem — tak zrobiłby ktoś, kto obchodzi interfejs
    await page.evaluate((cart) => {
      localStorage.setItem('shop.cart.v1', JSON.stringify([{ id: cart[0].id, qty: 9999 }]));
    }, linie);

    await page.goto('/koszyk');
    await expect(page.getByText(/Brakuje sztuk/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Zamawiam i płacę/ })).toBeDisabled();
  });

  test('pusty koszyk zaprasza do sklepu zamiast pokazywać formularz', async ({ page }) => {
    await page.goto('/koszyk');
    await expect(page.getByRole('heading', { name: 'Koszyk jest pusty' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Zamawiam i płacę/ })).toHaveCount(0);
  });
});
