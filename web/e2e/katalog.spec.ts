import { expect, test } from '@playwright/test';
import { wyczyscStanPrzegladarki } from './pomoce';
import { MARKA } from '../lib/dane-sklepu';

test.describe('Katalog', () => {
  test.beforeEach(async ({ page }) => {
    await wyczyscStanPrzegladarki(page);
  });

  test('strona główna pokazuje kategorie i polecane prosto z serwera', async ({ page }) => {
    // Bez JavaScriptu treść i tak ma być w HTML-u — to cały sens SSR
    await page.context().addInitScript(() => {});
    const odpowiedz = await page.goto('/');
    const html = (await odpowiedz!.text()) ?? '';

    // Hasło z `dane-sklepu.ts`, nie literał: sklep jest szablonem i każdy
    // wdrażający je podmienia, a dowodem na SSR jest obecność treści w HTML-u,
    // nie jej brzmienie.
    expect(html).toContain(MARKA.hasloHero);
    expect(html).toMatch(/Kategorie/);
    // Nazwa produktu w surowym HTML dowodzi, że siatka nie czeka na klienta
    expect(html).toMatch(/card-title/);

    await expect(page.locator('.category')).toHaveCount(4);
    // Strzępka na stronie głównej pokazuje cały asortyment, nie cztery
    // wybrane pozycje: przy czterech kartach lista mieści się w kontenerze
    // na szerokim ekranie i nie ma czego przeciągać.
    await expect(page.locator('.strzepka .card')).toHaveCount(8);
  });

  test('sklep filtruje po kategorii i sortuje po cenie', async ({ page }) => {
    await page.goto('/sklep');
    const wszystkie = await page.locator('.card').count();
    expect(wszystkie).toBeGreaterThan(1);

    // Filtr, sortowanie i strona jadą w adresie i trafiają do zapytania, więc
    // po kliknięciu trzeba poczekać na odpowiedź. Wcześniej przesiewanie
    // działo się w pamięci przeglądarki i było natychmiastowe — liczenie
    // kafelków od razu po kliknięciu łapało wtedy gotowy wynik, a teraz
    // złapałoby jeszcze poprzedni.
    await page.getByRole('button', { name: 'Audio', exact: true }).click();
    await expect(page).toHaveURL(/kategoria=audio/);

    const audio = page.locator('.card');
    await expect(audio.first()).toBeVisible();
    expect(await audio.count()).toBeLessThan(wszystkie);
    for (const kafelek of await audio.all()) {
      await expect(kafelek.locator('.card-cat')).toHaveText(/audio/i);
    }

    await page.getByRole('button', { name: 'Wszystkie' }).click();
    await expect(page).not.toHaveURL(/kategoria=/);

    await page.getByRole('button', { name: 'Sortowanie' }).click();
    await page.getByRole('option', { name: 'Cena malejąco' }).click();
    await expect(page).toHaveURL(/sort=price-desc/);

    // Cena dolicza się od zera przy wejściu kafelka w pole widzenia, więc
    // widoczny tekst przez pół sekundy nie jest ceną produktu. Czytamy warstwę
    // dla czytnika ekranu — tam stoi wartość docelowa od pierwszego renderu
    // i to ona jest prawdą o cenie.
    const ceny = await page.locator('.card .price .sr-only').allInnerTexts();
    const liczby = ceny.map((t) => Number.parseFloat(t.replace(/[^\d,]/g, '').replace(',', '.')));
    expect(liczby).toEqual([...liczby].sort((a, b) => b - a));
  });

  test('szukajka zawęża listę, a brak trafień mówi to wprost', async ({ page }) => {
    await page.goto('/sklep');
    await page.getByPlaceholder('Szukaj produktu').fill('laptop');
    await expect(page.locator('.card')).toHaveCount(1);

    await page.getByPlaceholder('Szukaj produktu').fill('czegoś takiego nie ma');
    await expect(page.getByText('Brak produktów spełniających kryteria.')).toBeVisible();
  });

  test('filtr i fraza zostają w adresie i przeżywają odświeżenie', async ({ page }) => {
    // Odkąd katalog filtruje baza, adres jest jedynym stanem — wynik szukania
    // da się wysłać linkiem, a „wstecz" wraca do poprzedniego filtra.
    await page.goto('/sklep?kategoria=audio&szukaj=sluchawki');

    await expect(page.getByPlaceholder('Szukaj produktu')).toHaveValue('sluchawki');
    await expect(page.getByRole('button', { name: 'Audio', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await page.reload();
    await expect(page.getByPlaceholder('Szukaj produktu')).toHaveValue('sluchawki');

    // Strona poza zakresem nie wywraca widoku, tylko oddaje pustą listę
    await page.goto('/sklep?strona=99');
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
