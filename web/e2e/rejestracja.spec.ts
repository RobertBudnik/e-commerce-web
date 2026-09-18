import { expect, test } from '@playwright/test';
import { KONTA, tresc } from './pomoce';
import { linkZListu, nowyAdres, poczekajNaList } from './poczta';

const HASLO = 'Poprawne1Haslo';

/**
 * Rejestracja z potwierdzeniem adresu.
 *
 * Testy jadą po prawdziwej poczcie złapanej lokalnie — bez tego „konto
 * potwierdzone" byłoby wyłącznie deklaracją. Link wyciągamy z treści
 * wiadomości dokładnie tak, jak zrobiłby to człowiek.
 */
test.describe('Rejestracja', () => {
  test('konto powstaje dopiero po kliknięciu linku z wiadomości', async ({ page }) => {
    const adres = nowyAdres('nowy');

    await page.goto('/logowanie?tryb=rejestracja');
    await page.getByLabel('Imię i nazwisko').fill('Jan Przykładowy');
    await page.getByLabel('E-mail').fill(adres);
    await page.getByLabel('Hasło').fill(HASLO);
    await page.getByRole('button', { name: 'Załóż konto' }).click();

    // Konto istnieje, ale nie wpuszcza — i strona mówi to wprost.
    await page.waitForURL(/\/rejestracja\/sprawdz-skrzynke/);
    await expect(tresc(page).getByRole('heading', { level: 1 })).toContainText('Sprawdź skrzynkę');
    await expect(tresc(page).getByText(adres)).toBeVisible();

    // Bez potwierdzenia logowanie nie przechodzi
    await page.goto('/konto');
    await expect(page).toHaveURL(/\/logowanie/);

    const list = await poczekajNaList(adres);
    expect(list.temat).toContain('Potwierdź');

    await page.goto(linkZListu(list));
    await expect(page).toHaveURL(/\/konto/);
    await expect(tresc(page).getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('ten sam link drugi raz już nie działa', async ({ page }) => {
    const adres = nowyAdres('dwuklik');

    await page.goto('/logowanie?tryb=rejestracja');
    await page.getByLabel('Imię i nazwisko').fill('Ewa Przykładowa');
    await page.getByLabel('E-mail').fill(adres);
    await page.getByLabel('Hasło').fill(HASLO);
    await page.getByRole('button', { name: 'Załóż konto' }).click();
    await page.waitForURL(/\/rejestracja\/sprawdz-skrzynke/);

    const link = linkZListu(await poczekajNaList(adres));

    await page.goto(link);
    await expect(page).toHaveURL(/\/konto/);

    // Drugie wejście musi iść z czystej sesji — inaczej sprawdzilibyśmy
    // tylko tyle, że zalogowany zostaje zalogowany.
    await page.context().clearCookies();

    await page.goto(link);
    await expect(page).toHaveURL(/\/auth\/blad/);
    await expect(tresc(page).getByRole('heading', { level: 1 })).toContainText('stracił ważność');
  });

  /**
   * Otwarte przekierowanie na prawdziwym, działającym linku — czyli w jedynym
   * momencie, w którym naprawdę byłoby groźne. Zmyślony token tego nie
   * sprawdza, bo kończy się ekranem błędu, zanim dojdzie do przekierowania.
   */
  test('podmieniony cel w linku nie wyprowadza poza sklep', async ({ page }) => {
    const adres = nowyAdres('podmiana');

    await page.goto('/logowanie?tryb=rejestracja');
    await page.getByLabel('Imię i nazwisko').fill('Test Podmiany');
    await page.getByLabel('E-mail').fill(adres);
    await page.getByLabel('Hasło').fill(HASLO);
    await page.getByRole('button', { name: 'Załóż konto' }).click();
    await page.waitForURL(/\/rejestracja\/sprawdz-skrzynke/);

    const link = new URL(linkZListu(await poczekajNaList(adres)));
    link.searchParams.set('next', 'https://obcy.example.com/phishing');

    await page.goto(link.toString());

    expect(new URL(page.url()).hostname).toBe('localhost');
    expect(page.url()).not.toContain('obcy.example.com');
  });

  /**
   * Enumeracja kont. Formularz, który na jeden adres odpowiada inaczej niż na
   * drugi, jest wyszukiwarką klientów tego sklepu.
   */
  test('rejestracja na zajęty adres wygląda tak samo jak na nowy', async ({ page }) => {
    await page.goto('/logowanie?tryb=rejestracja');
    await page.getByLabel('Imię i nazwisko').fill('Ktoś Inny');
    await page.getByLabel('E-mail').fill(KONTA.klient.email);
    await page.getByLabel('Hasło').fill(HASLO);
    await page.getByRole('button', { name: 'Załóż konto' }).click();

    // Ta sama droga co przy nowym adresie: ekran „sprawdź skrzynkę".
    // Żadnego „konto już istnieje" — to zdanie zdradzałoby klienta.
    await page.waitForURL(/\/rejestracja\/sprawdz-skrzynke/);
    await expect(page.locator('body')).not.toContainText('już istnieje');
  });

  test('zbyt słabe hasło jest odrzucane z konkretnym powodem', async ({ page }) => {
    await page.goto('/logowanie?tryb=rejestracja');
    await page.getByLabel('Imię i nazwisko').fill('Słabe Hasło');
    await page.getByLabel('E-mail').fill(nowyAdres('slabe'));
    // Osiem znaków, ale bez wielkiej litery i bez cyfry
    await page.getByLabel('Hasło').fill('malelitery');
    await page.getByRole('button', { name: 'Załóż konto' }).click();

    await expect(tresc(page).getByText(/co najmniej ośmiu znaków/i)).toBeVisible();
  });
});

test.describe('Reset hasła', () => {
  test('link prowadzi do formularza nowego hasła, a hasło naprawdę się zmienia', async ({
    page,
  }) => {
    const adres = nowyAdres('reset');
    const noweHaslo = 'ZupelnieInne9';

    // Konto musi istnieć i być potwierdzone
    await page.goto('/logowanie?tryb=rejestracja');
    await page.getByLabel('Imię i nazwisko').fill('Reset Testowy');
    await page.getByLabel('E-mail').fill(adres);
    await page.getByLabel('Hasło').fill(HASLO);
    await page.getByRole('button', { name: 'Załóż konto' }).click();
    await page.waitForURL(/\/rejestracja\/sprawdz-skrzynke/);
    await page.goto(linkZListu(await poczekajNaList(adres)));
    await expect(page).toHaveURL(/\/konto/);
    await page.context().clearCookies();

    // Prośba o nowe hasło
    await page.goto('/haslo/reset');
    await page.getByLabel('E-mail').fill(adres);
    await page.getByRole('button', { name: 'Wyślij link' }).click();
    await expect(tresc(page).getByText(/wysłaliśmy na niego wiadomość/i)).toBeVisible();

    const list = await poczekajNaList(adres);
    expect(list.temat).toContain('hasło');

    await page.goto(linkZListu(list));
    await expect(page).toHaveURL(/\/haslo\/nowe/);

    await page.getByLabel('Nowe hasło').fill(noweHaslo);
    await page.getByLabel('Powtórz hasło').fill(noweHaslo);
    await page.getByRole('button', { name: 'Ustaw nowe hasło' }).click();
    await expect(page).toHaveURL(/\/konto/);

    // Dowód, że zmiana poszła do bazy: nowe hasło wpuszcza
    await page.context().clearCookies();
    await page.goto('/logowanie');
    await page.getByLabel('E-mail').fill(adres);
    await page.getByLabel('Hasło').fill(noweHaslo);
    await page.getByRole('button', { name: 'Zaloguj się' }).click();
    await page.waitForURL(/\/konto/);
  });

  test('reset na nieznany adres nie zdradza, że konta nie ma', async ({ page }) => {
    await page.goto('/haslo/reset');
    await page.getByLabel('E-mail').fill(nowyAdres('nieznany'));
    await page.getByRole('button', { name: 'Wyślij link' }).click();

    await expect(tresc(page).getByText(/wysłaliśmy na niego wiadomość/i)).toBeVisible();
    await expect(page.locator('body')).not.toContainText('nie istnieje');
  });
});
