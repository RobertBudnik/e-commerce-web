import { expect, type Page } from '@playwright/test';

/**
 * Zapas na złożenie zamówienia i dojście na stronę potwierdzenia.
 *
 * Trzy testy czekały tu zaszyte 20 sekund. Lokalnie z zapasem wystarcza,
 * ale na runnerze CI serwer deweloperski kompiluje `/zamowienie/[numer]`
 * przy pierwszym wejściu i sam ten krok potrafi zjeść cały limit — cały
 * zestaw schodzi tam w 7,4 minuty wobec 2,3 minuty lokalnie. Limit zaszyty
 * w teście nadpisuje ustawienia z konfiguracji, więc musi wiedzieć o CI
 * tak samo jak one.
 */
export const CZAS_ZAMOWIENIA = process.env.CI ? 60_000 : 20_000;

/** Konta z seeda lokalnego. Na produkcji nie istnieją. */
export const KONTA = {
  klient: { email: 'klient@nordo.pl', haslo: 'nordo-local-dev' },
  zaplecze: { email: 'admin@nordo.pl', haslo: 'nordo-local-dev' },
};

/**
 * Treść strony, bez bufora strumieniowania.
 *
 * React wysyła zawartość granic `Suspense` osobno od reszty dokumentu: serwer
 * dopisuje ją na końcu `<body>` w ukrytym `<div id="S:0">`, a krótki skrypt
 * przenosi ją na miejsce. Przez ten czas ten sam element stoi w dokumencie
 * dwa razy — raz w `#tresc`, raz w buforze:
 *
 *   BODY > DIV#tresc > … > SPAN.mag-korekta-wynik
 *   BODY > DIV#S:0   > … > SPAN.mag-korekta-wynik
 *
 * Tryb ścisły Playwrighta słusznie wtedy odmawia, bo „ten element na stronie"
 * przestaje być jednoznaczne. Bufor leży poza `#tresc` i poza drzewem
 * dostępności, więc pytanie zawężone do kontenera treści trafia zawsze
 * w jeden egzemplarz — i przy okazji pyta o to, o co testowi naprawdę
 * chodzi: o to, co widzi człowiek, a nie o dowolny pasujący węzeł w DOM-ie.
 *
 * Używaj tego wszędzie tam, gdzie selektor jest klasą albo tekstem ze strony.
 * `getByRole` na ogół nie potrzebuje zawężenia, bo bufor jest ukryty przed
 * drzewem dostępności — ale zawężenie mu nie szkodzi.
 */
export function tresc(page: Page) {
  return page.locator('#tresc');
}

/** Dane wysyłki dla gościa — każdy przebieg dostaje własny adres e-mail. */
export function gosc() {
  const znacznik = Date.now();
  return {
    name: 'Gość Testowy',
    email: `gosc.${znacznik}@example.com`,
    phone: '+48 111 222 333',
    street: 'Testowa 1',
    zip: '11-111',
    city: 'Gdańsk',
  };
}

export async function zaloguj(page: Page, konto: { email: string; haslo: string }) {
  await page.goto('/logowanie');
  await page.getByLabel('E-mail').fill(konto.email);
  await page.getByLabel('Hasło').fill(konto.haslo);
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await page.waitForURL(/\/konto/);

  // Sam adres to za słaby dowód. Ciasteczko sesji bywa jeszcze w drodze,
  // a następne `goto` na stronę za bramką trafia wtedy w logowanie —
  // tak wywrócił się przebieg zwrotów: test wylądował na ekranie logowania
  // z nagłówkiem gościa, choć `zaloguj` już zwróciło. Przycisk konta
  // z nazwą jest dowodem, że serwer widzi sesję.
  await expect(page.getByRole('button', { name: /Nordo HQ|Robert Kowalski/ })).toBeVisible({
    timeout: 15_000,
  });
}

export async function wyloguj(page: Page) {
  await page.getByRole('button', { name: /Nordo HQ|Robert Kowalski|Gość/ }).first().click();
  await page.getByRole('button', { name: 'Wyloguj' }).click();
  await page.waitForURL('/');
}

/**
 * Dokłada pierwszy dostępny produkt z listy do koszyka i czeka, aż szuflada
 * pokaże policzoną sumę — czyli aż wróci wycena z bazy.
 */
export async function dodajPierwszyDoKoszyka(page: Page) {
  await page.goto('/sklep');
  // Filtr po nazwie dostępnej, nie po tekście. W siatce sklepu `ProductCard`
  // podaje `PrzyciskDoKoszyka` z `ikona`, a ten renderuje wtedy samą ikonę
  // koszyka — napis „Do koszyka" nie trafia do DOM-u i żyje wyłącznie
  // w `aria-label`. `filter({ hasText })` nie miał więc czego dopasować
  // i wywracał dziewięć testów naraz dwudziestosekundowym limitem.
  const kafelek = page
    .locator('.card')
    .filter({ has: page.getByRole('button', { name: 'Do koszyka' }) })
    .first();
  const nazwa = await kafelek.locator('.card-title').innerText();

  await kafelek.getByRole('button', { name: 'Do koszyka' }).click();

  const szuflada = page.locator('.drawer');
  await expect(szuflada).toBeVisible();
  await expect(szuflada.locator('.summary-row.total')).toContainText('zł');

  return nazwa;
}

/**
 * Kwota z wiersza podsumowania jako liczba. Czeka, aż wróci wycena z bazy —
 * przed nią wiersz pokazuje zero i porównania nie mają sensu.
 */
export async function kwota(page: Page, etykieta: string) {
  const wiersz = page.locator('.summary-row', { hasText: etykieta }).last();

  await expect
    .poll(async () => odczytaj(await wiersz.innerText()), { timeout: 15_000 })
    .toBeGreaterThan(0);

  return odczytaj(await wiersz.innerText());
}

function odczytaj(tekst: string) {
  const liczba = tekst.replace(/\s/g, '').replace(/[^\d,]/g, '').replace(',', '.');
  return Number.parseFloat(liczba) || 0;
}

/** Czyści koszyk i historię między testami — stan siedzi w localStorage. */
export async function wyczyscStanPrzegladarki(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.removeItem('shop.cart.v1');
    localStorage.removeItem('shop.recent.v1');
  });
}
