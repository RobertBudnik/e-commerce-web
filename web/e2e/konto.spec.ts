import { expect, test } from '@playwright/test';
import { CZAS_ZAMOWIENIA, KONTA, dodajPierwszyDoKoszyka, wyczyscStanPrzegladarki, zaloguj } from './pomoce';

test.describe('Konto i uprawnienia', () => {
  test.beforeEach(async ({ page }) => {
    await wyczyscStanPrzegladarki(page);
  });

  test('token sesji jest niewidoczny dla JavaScriptu w karcie', async ({ page }) => {
    await zaloguj(page, KONTA.klient);

    // O to chodziło w migracji na Next: ciasteczko HttpOnly zamiast localStorage
    const ciasteczka = await page.evaluate(() => document.cookie);
    expect(ciasteczka).not.toContain('auth-token');

    const magazyn = await page.evaluate(() => Object.keys(localStorage));
    expect(magazyn.some((k) => k.includes('auth'))).toBe(false);
  });

  test('gość trafia z konta na logowanie i wraca po zalogowaniu', async ({ page }) => {
    await page.goto('/konto');
    await page.waitForURL(/\/logowanie/);
    expect(page.url()).toContain('powrot=%2Fkonto');

    await page.getByLabel('E-mail').fill(KONTA.klient.email);
    await page.getByLabel('Hasło').fill(KONTA.klient.haslo);
    await page.getByRole('button', { name: 'Zaloguj się' }).click();

    await page.waitForURL(/\/konto/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Robert');
  });

  test('klient widzi swoje zamówienia, bez narzędzi zaplecza', async ({ page }) => {
    await zaloguj(page, KONTA.klient);

    await expect(page.getByRole('button', { name: /Zamówienia/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Przegląd/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Klienci i adresy/ })).toHaveCount(0);

    await page.getByRole('button', { name: /Zamówienia/ }).click();
    await expect(page.locator('.order').first()).toBeVisible();
    // Stos statusów należy do zaplecza
    await expect(page.locator('.sortbox-sm')).toHaveCount(0);
  });

  test('klient nie wchodzi do panelu produktów', async ({ page }) => {
    await zaloguj(page, KONTA.klient);
    await page.goto('/panel');
    await page.waitForURL(/\/konto/);
  });

  test('klient zapisuje dane kontaktowe i adres', async ({ page }) => {
    await zaloguj(page, KONTA.klient);
    await page.getByRole('button', { name: /Dane i hasło/ }).click();

    const telefon = `+48 600 ${String(Date.now()).slice(-6)}`;
    await page.getByLabel('Telefon').fill(telefon);
    await page.getByLabel('Miasto').fill('Warszawa');
    await page.getByRole('button', { name: 'Zapisz dane' }).click();

    await expect(page.getByText('Dane zapisane')).toBeVisible();

    // Adres logowania należy do Auth, nie do profilu
    await expect(page.locator('#set-email')).toHaveAttribute('readonly', '');

    await page.reload();
    await page.getByRole('button', { name: /Dane i hasło/ }).click();
    await expect(page.getByLabel('Telefon')).toHaveValue(telefon);
  });

  test('zaplecze przestawia status zamówienia', async ({ page }) => {
    await zaloguj(page, KONTA.zaplecze);
    await page.getByRole('button', { name: /Zamówienia/ }).click();

    const zamowienie = page.locator('.order').first();
    const numer = await zamowienie.locator('.order-id').innerText();

    // Lista w koncie przestawia wyłącznie stany kolejki pakowania. „Wysłane"
    // stawia nadanie razem z listem przewozowym, „dostarczone" — potwierdzenie
    // w panelu, więc żadnego z nich nie ma tu do wyboru.
    await zamowienie.locator('.sortbox-btn').click();
    await page.getByRole('option', { name: 'spakowane' }).click();

    await expect(page.getByText(`Status ${numer}: spakowane`)).toBeVisible();
    await expect(zamowienie.locator('.pill')).toHaveText('spakowane');

    // Stan przetrwał przeładowanie, czyli poszedł do bazy
    await page.reload();
    await page.getByRole('button', { name: /Zamówienia/ }).click();
    await expect(page.locator('.order', { hasText: numer }).locator('.pill')).toHaveText(
      'spakowane'
    );
  });

  test('klient anuluje własne zamówienie, a towar wraca na magazyn', async ({ page }) => {
    // Najpierw zamówienie, żeby test nie zależał od stanu bazy
    await zaloguj(page, KONTA.klient);
    const nazwa = await dodajPierwszyDoKoszyka(page);

    await page.goto('/produkt/zarowka-smart-glow-e27');
    const stanPrzed = Number(
      (await page.locator('.stock').innerText()).replace(/\D/g, '')
    );

    await page.goto('/koszyk');
    await page.getByLabel('Ulica i numer').fill('Krucza 12/4');
    await page.getByLabel('Kod pocztowy').fill('00-001');
    await page.getByLabel('Miasto').fill('Warszawa');
    await page.getByRole('checkbox', { name: /regulamin/i }).check();
    await page.getByRole('button', { name: /Zamawiam i płacę/ }).click();
    await page.waitForURL(/\/zamowienie\/NOR-/, { timeout: CZAS_ZAMOWIENIA });

    const numer = (await page.getByText(/NOR-\d{4}-\d{4}/).first().innerText()).match(
      /NOR-\d{4}-\d{4}/
    )![0];

    page.on('dialog', (okno) => okno.accept());

    await page.goto('/konto#orders');
    await page.getByRole('button', { name: /Zamówienia/ }).click();
    const wiersz = page.locator('.order', { hasText: numer });
    await wiersz.getByRole('button', { name: 'Anuluj zamówienie' }).click();

    await expect(page.getByText(/anulowane — towar wrócił na magazyn/)).toBeVisible();
    await expect(wiersz.locator('.pill')).toHaveText('anulowane');

    // Zamówiona sztuka wróciła do katalogu
    if (nazwa.includes('Żarówka')) {
      await page.goto('/produkt/zarowka-smart-glow-e27');
      const stanPo = Number((await page.locator('.stock').innerText()).replace(/\D/g, ''));
      expect(stanPo).toBe(stanPrzed);
    }
  });
});
