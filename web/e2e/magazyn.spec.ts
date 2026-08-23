import { expect, test } from '@playwright/test';
import { CZAS_ZAMOWIENIA, dodajPierwszyDoKoszyka, KONTA, wyloguj, zaloguj } from './pomoce';

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
    // Własne zamówienie, jak w teście anulowania obok. Wcześniej test brał
    // pierwsze zamówienie z listy zaplecza i zgłaszał zwrot na nie — działało
    // dopóki bazie wolno było przyjąć ten sam zwrot dwa razy. Odkąd
    // `zglos_zwrot` sumuje wcześniejsze zgłoszenia, powtórka przebiegu
    // (w CI `retries: 1`) trafiała na to samo zamówienie i słusznie dostawała
    // odmowę — test padał na poprawce, nie na usterce.
    await zaloguj(page, KONTA.klient);
    await dodajPierwszyDoKoszyka(page);

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

    await page.goto('/');
    await wyloguj(page);

    // Zwrot jest możliwy dopiero po dostarczeniu — zaplecze ustawia ten stan
    await zaloguj(page, KONTA.zaplecze);

    // Doręczenie potwierdza panel, nie lista statusów w koncie — stan
    // „dostarczone" jest faktem spoza sklepu i baza zapisuje jego źródło.
    await page.goto(`/panel/zamowienia/${numer}`);
    await page.getByRole('button', { name: 'Potwierdź doręczenie' }).click();
    await expect(page.getByText('Oznaczono jako doręczone')).toBeVisible();

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
    // Mała litera jest poprawna i celowa: baza zapisuje powód jako „Zwrot od
    // klienta", ale `getOstatnieRuchy` zbija pierwszą literę do małej, zeby
    // wpis czytal sie jak zdanie, a nie jak naglowek (queries.ts:684).
    // Asercja sprawdza to, co widzi magazynier, nie to, co stoi w kolumnie.
    await expect(page.locator('.mag-karta').last()).toContainText('zwrot od klienta');
  });
});

test.describe('Nadanie przesyłki', () => {
  test('arkusz przyjmuje numer, zamówienie idzie do wysłanych', async ({ page }) => {
    await zaloguj(page, KONTA.zaplecze);

    // Seed nie trzyma żadnego zamówienia w kolejce — wszystkie są już
    // dostarczone albo wysłane. Cofamy jedno do „nowe", żeby test nie
    // zależał od tego, co akurat zostawiły poprzednie przebiegi.
    await page.getByRole('button', { name: /Zamówienia/ }).click();
    const wKoncie = page.locator('.order').first();
    await wKoncie.locator('.sortbox-btn').click();
    await page.getByRole('option', { name: 'nowe' }).click();
    await expect(wKoncie.locator('.pill')).toHaveText('nowe');

    await page.goto('/magazyn/zamowienia?stan=nowe');

    const pierwsze = page.locator('.mag-karta .mag-wiersz').first();
    await expect(pierwsze).toBeVisible();
    await pierwsze.click();
    await expect(page).toHaveURL(/\/magazyn\/zamowienia\/[^/]+/);

    // Arkusz otwiera się dopiero na żądanie — karta zamówienia nie nosi
    // pustego pola na numer przy każdym otwarciu
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Nadaj przesyłkę' }).click();

    const arkusz = page.getByRole('dialog');
    await expect(arkusz).toBeVisible();
    await expect(arkusz.getByRole('button', { name: 'Nadaj przesyłkę' })).toBeDisabled();

    // Escape zamyka, tak jak każdą nakładkę w tym projekcie
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByRole('button', { name: 'Nadaj przesyłkę' }).click();
    await page.getByPlaceholder('Numer listu przewozowego').fill('JVGL0099887766');
    await page.getByRole('dialog').getByRole('button', { name: 'Nadaj przesyłkę' }).click();

    // Numer wylądował w danych dostawy, a akcje ustąpiły miejsca informacji
    await expect(page.getByText('JVGL0099887766')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('paczka nadana')).toBeVisible();

    // I zamówienie przeniosło się do zakładki wysłanych
    await page.goto('/magazyn/zamowienia?stan=wysłane');
    await expect(page.locator('.mag-karta .mag-wiersz').first()).toBeVisible();
  });
});

test.describe('Motyw skanera', () => {
  test('wybór wyłamuje ekran z motywu aplikacji i przeżywa przeładowanie', async ({ page }) => {
    await zaloguj(page, KONTA.zaplecze);
    await page.goto('/magazyn/skan');

    const ekran = page.locator('main.mag');
    // Domyślnie „Auto" — ekran idzie za motywem aplikacji i nie nosi klasy
    await expect(page.getByRole('tab', { name: 'Auto' })).toHaveAttribute('aria-selected', 'true');
    await expect(ekran).not.toHaveClass(/motyw-(ciemny|jasny)/);

    await page.getByRole('tab', { name: 'Ciemny' }).click();
    await expect(ekran).toHaveClass(/motyw-ciemny/);

    // Tło naprawdę się zmienia, nie tylko klasa
    const ciemne = await ekran.evaluate((el) => getComputedStyle(el).backgroundColor);

    await page.getByRole('tab', { name: 'Jasny' }).click();
    await expect(ekran).toHaveClass(/motyw-jasny/);
    const jasne = await ekran.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(jasne).not.toBe(ciemne);

    // Wybór zostaje przy telefonie
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Jasny' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.locator('main.mag')).toHaveClass(/motyw-jasny/);
  });
});
