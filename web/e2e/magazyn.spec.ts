import { expect, test } from '@playwright/test';
import { KONTA, wyloguj, zaloguj } from './pomoce';

/**
 * Magazyn — narzędzie zaplecza.
 *
 * Testy pilnują trzech rzeczy, których nie widać po zrzucie ekranu: że
 * konto klienta tu nie wchodzi, że korekta stanu zostawia ślad w historii
 * i że stan nie schodzi poniżej zera. Reszta wyglądu jest sprawą CSS-u.
 */
test.describe('Magazyn', () => {
  test('klient nie wchodzi do magazynu', async ({ page }) => {
    await zaloguj(page, KONTA.klient);

    for (const adres of ['/magazyn', '/magazyn/zamowienia', '/magazyn/stany', '/magazyn/skan']) {
      await page.goto(adres);
      await expect(page).toHaveURL(/\/konto/);
    }
  });

  test('gość jest odsyłany na logowanie z powrotem do magazynu', async ({ page }) => {
    await page.goto('/magazyn/stany');
    await expect(page).toHaveURL(/\/logowanie\?powrot=%2Fmagazyn%2Fstany/);
  });

  test('przegląd prowadzi do kolejki i do stanów', async ({ page }) => {
    await zaloguj(page, KONTA.zaplecze);
    await page.goto('/magazyn');

    await expect(page.getByRole('heading', { name: 'Przegląd' })).toBeVisible();

    await page.getByRole('link', { name: /Do wysłania/ }).click();
    await expect(page).toHaveURL(/\/magazyn\/zamowienia\?stan=nowe/);
    await expect(page.getByRole('heading', { name: 'Zamówienia' })).toBeVisible();
  });

  test('segmenty kolejki trzymają stan w adresie', async ({ page }) => {
    await zaloguj(page, KONTA.zaplecze);
    await page.goto('/magazyn/zamowienia');

    await page.getByRole('tab', { name: /Wysłane/ }).click();
    await expect(page).toHaveURL(/stan=wys/);

    // Zakładka przetrwała przeładowanie, czyli stan naprawdę siedzi w adresie
    await page.reload();
    await expect(page.getByRole('tab', { name: /Wysłane/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('szukanie w magazynie zawęża listę i zostaje w adresie', async ({ page }) => {
    await zaloguj(page, KONTA.zaplecze);
    await page.goto('/magazyn/stany');

    const wiersze = page.locator('.mag-karta .mag-wiersz');
    await expect(wiersze.first()).toBeVisible();

    await page.getByPlaceholder('Szukaj nazwy lub SKU').fill('laptop');
    await expect(page).toHaveURL(/szukaj=laptop/, { timeout: 10_000 });
    await expect(wiersze).toHaveCount(1);

    // Fraza bez trafień mówi to wprost, zamiast pokazywać pustą kartę
    await page.getByPlaceholder('Szukaj nazwy lub SKU').fill('zzzzz');
    await expect(page.locator('.mag-pusto')).toContainText('Nic nie pasuje');
  });

  test('korekta stanu zapisuje ruch i podnosi stan', async ({ page }) => {
    await zaloguj(page, KONTA.zaplecze);
    await page.goto('/magazyn/stany?szukaj=laptop');

    await page.locator('.mag-karta .mag-wiersz').first().click();
    await expect(page).toHaveURL(/\/magazyn\/stany\/[0-9a-f-]{36}/);

    const wynik = page.locator('.mag-korekta-wynik');
    const przed = Number(await wynik.innerText());

    // Bez powodu zapis jest nieczynny — powód jest obowiązkowy
    await page.getByRole('button', { name: 'Dodaj jedną sztukę' }).click();
    await expect(page.getByRole('button', { name: /Zapisz zmianę/ })).toBeDisabled();

    await page.getByRole('radio', { name: 'Przyjęcie dostawy' }).click();
    await expect(wynik).toHaveText(String(przed + 1));

    await page.getByRole('button', { name: /Zapisz zmianę/ }).click();
    await expect(wynik).toHaveText(String(przed + 1), { timeout: 15_000 });

    // Stan przetrwał przeładowanie, czyli poszedł do bazy, a nie tylko na ekran
    await page.reload();
    await expect(page.locator('.mag-korekta-wynik')).toHaveText(String(przed + 1));

    // I widać go w historii na przeglądzie. Powód jedzie małą literą, bo
    // w wierszu czyta się jak zdanie, a nie jak nagłówek.
    await page.goto('/magazyn');
    await expect(page.locator('.mag-karta').last()).toContainText('przyjęcie dostawy');
  });

  test('stan nie schodzi poniżej zera, a komunikat stoi przy liczbie', async ({ page }) => {
    await zaloguj(page, KONTA.zaplecze);
    await page.goto('/magazyn/stany?szukaj=laptop');
    await page.locator('.mag-karta .mag-wiersz').first().click();

    const wynik = page.locator('.mag-korekta-wynik');
    const przed = Number(await wynik.innerText());

    await page.getByRole('button', { name: 'Przełącz na odejmowanie' }).click();

    // Zdejmujemy więcej, niż jest — z zapasem, żeby test nie zależał od stanu
    for (let i = 0; i < przed + 2; i++) {
      await page.getByRole('button', { name: 'Zdejmij jedną sztukę' }).click();
    }

    await expect(page.locator('.mag-blad')).toContainText('nie można zdjąć');
    await expect(page.getByRole('button', { name: /Zapisz zmianę/ })).toBeDisabled();
  });
});

/**
 * Zwrot zamyka obieg towaru: klient zgłasza w sklepie, magazyn przyjmuje,
 * sztuki wracają na stan. Test idzie tą drogą w całości, bo każdy z tych
 * trzech kroków osobno potrafi działać, a razem nie.
 */
test.describe('Zwroty', () => {
  test('klient zgłasza zwrot, magazyn przyjmuje, stan rośnie', async ({ page }) => {
    // Zwrot jest możliwy dopiero po dostarczeniu — zaplecze ustawia ten stan
    await zaloguj(page, KONTA.zaplecze);
    await page.getByRole('button', { name: /Zamówienia/ }).click();

    const zamowienie = page.locator('.order').first();
    const numer = await zamowienie.locator('.order-id').innerText();
    await zamowienie.locator('.sortbox-btn').click();
    await page.getByRole('option', { name: 'dostarczone' }).click();
    // Pigułka przy zamówieniu, nie komunikat — komunikat znika sam po chwili
    // i test bywa od niego wolniejszy.
    await expect(zamowienie.locator('.pill')).toHaveText('dostarczone');

    // Zwrotów do przyjęcia przed zgłoszeniem
    await page.goto('/magazyn/zwroty');
    const przed = await page.locator('.mag-karta').count();

    await page.goto('/');
    await wyloguj(page);

    // Klient zgłasza zwrot jednej sztuki
    await zaloguj(page, KONTA.klient);
    const swoje = page.locator('.order', { hasText: numer });
    await swoje.getByRole('button', { name: 'Zgłoś zwrot' }).click();

    const okno = page.getByRole('dialog');
    await expect(okno).toBeVisible();
    await expect(okno.getByRole('button', { name: /Zaznacz, co odsy/ })).toBeDisabled();

    await okno.getByRole('button', { name: /Więcej sztuk/ }).first().click();
    await okno.getByRole('button', { name: /Zgłoś zwrot · 1 szt/ }).click();
    await expect(page.getByText('Zwrot zgłoszony')).toBeVisible();

    // Magazyn widzi zgłoszenie i przyjmuje je
    await page.goto('/');
    await wyloguj(page);

    await zaloguj(page, KONTA.zaplecze);
    await page.goto('/magazyn/zwroty');
    await expect(page.locator('.mag-karta')).toHaveCount(przed + 1);

    await page.getByRole('button', { name: /Przyjmij zwrot/ }).first().click();
    await expect(page.locator('.mag-karta')).toHaveCount(przed);

    // Sztuki wróciły na stan przez historię magazynu
    await page.goto('/magazyn');
    await expect(page.locator('.mag-karta').last()).toContainText('zwrot od klienta');
  });
});
