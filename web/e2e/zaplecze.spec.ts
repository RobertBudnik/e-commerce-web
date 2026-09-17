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
  test('klient nie wchodzi na zaplecze', async ({ page }) => {
    await zaloguj(page, KONTA.klient);

    // Po scaleniu zaplecza ekran „brak dostępu" zniknął: przy zakładkach
    // filtrowanych rolą nie ma jak trafić tam, gdzie się nie wolno, więc
    // bramka po prostu odsyła klienta na jego konto.
    for (const adres of ['/panel/kolejka', '/panel/stany', '/panel/skan', '/panel/zwroty']) {
      await page.goto(adres);
      await expect(page).toHaveURL(/\/konto/);
    }
  });

  test('gość jest odsyłany na logowanie z powrotem na zaplecze', async ({ page }) => {
    await page.goto('/panel/stany');
    await expect(page).toHaveURL(/\/logowanie\?powrot=%2Fpanel%2Fstany/);
  });

  test('pulpit prowadzi do zamówień i do stanów', async ({ page }) => {
    await zaloguj(page, KONTA.zaplecze);
    await page.goto('/panel');

    // Przegląd magazynu zniknął przy scaleniu — jego kafle przejął pulpit.
    await page.getByRole('link', { name: /Do wysłania/ }).click();
    await expect(page).toHaveURL(/\/panel\/zamowienia/);

    await page.goto('/panel');
    await page.getByRole('link', { name: /Niskie stany/ }).click();
    await expect(page).toHaveURL(/\/panel\/stany/);
  });

  test('segmenty kolejki trzymają stan w adresie', async ({ page }) => {
    await zaloguj(page, KONTA.zaplecze);
    await page.goto('/panel/kolejka');

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
    await page.goto('/panel/stany');

    const wiersze = page.locator('.mag-stany .mag-wiersz');
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
    await page.goto('/panel/stany?szukaj=laptop');

    await page.locator('.mag-stany .mag-wiersz').first().click();
    await expect(page).toHaveURL(/\/panel\/stany\/[0-9a-f-]{36}/);

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

    // I widać go w historii pod Stanami — przegląd magazynu zniknął, a ruchy
    // przeniosły się tam, gdzie stoją liczby, które tłumaczą. Powód jedzie
    // małą literą, bo w wierszu czyta się jak zdanie, a nie jak nagłówek.
    await page.goto('/panel/stany');
    await expect(page.locator('.mag-karta').last()).toContainText('przyjęcie dostawy');
  });

  test('stan nie schodzi poniżej zera, a komunikat stoi przy liczbie', async ({ page }) => {
    await zaloguj(page, KONTA.zaplecze);
    await page.goto('/panel/stany?szukaj=laptop');
    await page.locator('.mag-stany .mag-wiersz').first().click();

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
    await page.goto('/panel/zwroty');
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
    await page.goto('/panel/zwroty');
    await expect(page.locator('.mag-karta')).toHaveCount(przed + 1);

    await page.getByRole('button', { name: /Przyjmij zwrot/ }).first().click();
    await expect(page.locator('.mag-karta')).toHaveCount(przed);

    // Sztuki wróciły na stan przez historię magazynu, widoczną pod Stanami
    await page.goto('/panel/stany');
    // Mała litera jest poprawna i celowa: baza zapisuje powód jako „Zwrot od
    // klienta", ale `getOstatnieRuchy` zbija pierwszą literę do małej, zeby
    // wpis czytal sie jak zdanie, a nie jak naglowek (queries.ts:684).
    // Asercja sprawdza to, co widzi magazynier, nie to, co stoi w kolumnie.
    await expect(page.locator('.mag-karta').last()).toContainText('zwrot od klienta');
  });
});

test.describe('Nadanie paczki', () => {
  test('numer trafia do danych dostawy, a zamówienie idzie do wysłanych', async ({ page }) => {
    await zaloguj(page, KONTA.zaplecze);

    // Seed nie trzyma żadnego zamówienia w kolejce — wszystkie są już
    // dostarczone albo wysłane. Cofamy jedno do „nowe", żeby test nie
    // zależał od tego, co akurat zostawiły poprzednie przebiegi.
    await page.getByRole('button', { name: /Zamówienia/ }).click();
    const wKoncie = page.locator('.order').first();
    await wKoncie.locator('.sortbox-btn').click();
    await page.getByRole('option', { name: 'nowe' }).click();
    await expect(wKoncie.locator('.pill')).toHaveText('nowe');

    await page.goto('/panel/kolejka?stan=nowe');

    const pierwsze = page.locator('.mag-karta .mag-wiersz').first();
    await expect(pierwsze).toBeVisible();
    await pierwsze.click();
    await expect(page).toHaveURL(/\/panel\/zamowienia\/[^/]+/);

    // Po scaleniu nadaje się w miejscu, bez nakładki: formularz stoi na karcie
    // zamówienia, bo to jedyny ekran, na którym paczka powstaje. Zostaje
    // `nadaj_paczke` — z przewoźnikiem i idempotencją po stronie bazy.
    const nadaj = page.getByRole('button', { name: 'Nadaj paczkę' });
    await expect(nadaj).toBeDisabled();

    await page.getByPlaceholder('wklej z panelu przewoźnika').fill('JVGL0099887766');
    await expect(nadaj).toBeEnabled();
    await nadaj.click();

    // Jedna asercja zamiast dwóch: po zapisie formularz ustępuje miejsca
    // potwierdzeniu, które samo niesie numer. Pytanie o sam numer trafiało
    // w cztery miejsca naraz — potwierdzenie, dane dostawy i ślad zdarzeń —
    // i wywracało się na trybie ścisłym.
    await expect(
      page.locator('#tresc').getByText(/Paczka nadana — list JVGL0099887766/)
    ).toBeVisible({ timeout: 15_000 });

    // I zamówienie przeniosło się do zakładki wysłanych
    await page.goto('/panel/kolejka?stan=wysłane');
    await expect(page.locator('.mag-karta .mag-wiersz').first()).toBeVisible();
  });
});
