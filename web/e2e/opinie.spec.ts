import { expect, test } from '@playwright/test';
import { CZAS_ZAMOWIENIA, dodajPierwszyDoKoszyka, KONTA, wyloguj, zaloguj } from './pomoce';

/**
 * Opinie — od zakupu do gwiazdek w katalogu.
 *
 * Test idzie całą drogą, bo warunek „tylko kupujący" da się sprawdzić
 * wyłącznie w komplecie: gość nie widzi formularza, klient bez zakupu też nie,
 * a klient po odebraniu — widzi i może wystawić.
 */
test.describe('Opinie', () => {
  test('gość widzi sekcję, ale nie formularz', async ({ page }) => {
    await page.goto('/sklep');
    await page.locator('.card-title').first().click();
    await page.waitForURL(/\/produkt\//);

    await expect(page.getByRole('heading', { name: 'Opinie' })).toBeVisible();
    await expect(page.locator('.opinia-form')).toHaveCount(0);
  });

  test('klient po odebraniu zamówienia wystawia opinię, ocena trafia na produkt', async ({
    page,
  }) => {
    // Własne zamówienie, żeby test nie zależał od stanu bazy
    await zaloguj(page, KONTA.klient);
    const nazwa = await dodajPierwszyDoKoszyka(page);

    await page.goto('/koszyk');
    await page.getByLabel('Ulica i numer').fill('Krucza 12/4');
    await page.getByLabel('Kod pocztowy').fill('00-001');
    await page.getByLabel('Miasto').fill('Warszawa');
    await page.getByRole('button', { name: /Zamawiam i płacę/ }).click();
    await page.waitForURL(/\/zamowienie\/NOR-/, { timeout: CZAS_ZAMOWIENIA });

    const numer = (await page.getByText(/NOR-\d{4}-\d{4}/).first().innerText()).match(
      /NOR-\d{4}-\d{4}/
    )![0];

    // Przed dostarczeniem formularza nie ma — towar jeszcze nie dojechał
    await page.goto('/sklep');
    await page.getByRole('link', { name: nazwa }).first().click();
    await page.waitForURL(/\/produkt\//);
    await expect(page.locator('.opinia-form')).toHaveCount(0);

    const adresProduktu = page.url();

    // Zaplecze ustawia „dostarczone"
    await page.goto('/');
    await wyloguj(page);
    await zaloguj(page, KONTA.zaplecze);

    // Doręczenie potwierdza panel, nie lista statusów w koncie: to fakt spoza
    // sklepu, więc baza zapisuje przy nim źródło potwierdzenia.
    await page.goto(`/panel/zamowienia/${numer}`);
    await page.getByRole('button', { name: 'Potwierdź doręczenie' }).click();
    await expect(page.getByText('Oznaczono jako doręczone')).toBeVisible();

    // Klient wystawia opinię
    await page.goto('/');
    await wyloguj(page);
    await zaloguj(page, KONTA.klient);
    await page.goto(adresProduktu);

    const formularz = page.locator('.opinia-form');
    await expect(formularz).toBeVisible();

    await formularz.getByRole('radio', { name: /^4 gwiazdki$/ }).check();
    await formularz.getByLabel(/Twoimi słowami/).fill('Sprawdziło się, wróciłbym po drugie.');
    await formularz.getByRole('button', { name: /Wystaw opinię/ }).click();

    await expect(page.getByText('Dziękujemy za opinię')).toBeVisible();

    // Opinia na liście, z podpisem skróconym do imienia z inicjałem
    const opinia = page.locator('.opinia').filter({ hasText: 'Sprawdziło się' });
    await expect(opinia).toBeVisible();
    await expect(opinia.locator('.opinia-moja')).toContainText('Twoja opinia');
    await expect(opinia.locator('.opinia-autor')).not.toContainText('null');

    // Ocena produktu liczy się z opinii, nie z ziarna. Selektor zawężony do
    // kolumny z opisem — `.rating` pojawia się też na kartach „podobnych
    // produktów" niżej na stronie.
    await page.reload();
    await expect(page.locator('.product-info .rating')).toContainText('4');
    await expect(page.locator('.product-info .rating')).toContainText('1 opinii');
  });
});
