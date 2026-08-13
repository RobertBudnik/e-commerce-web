import { expect, test } from '@playwright/test';
import { KONTA, zaloguj } from './pomoce';

/**
 * Galeria zdjęć produktu — od wgrania w panelu do przełączania kadru na karcie.
 *
 * Test idzie całą drogą, bo każdy z tych kroków osobno potrafi działać, a razem
 * nie: plik ląduje w kubełku, wiersz w `product_images`, a karta i tak pokazuje
 * samą okładkę, jeśli zapytanie nie trafi w politykę odczytu.
 *
 * Zdjęcia powstają w locie — jednopikselowy PNG w dwóch odcieniach. Repozytorium
 * nie musi wozić plików binarnych dla testu, który sprawdza ścieżkę, nie treść
 * obrazu.
 */

/** Najmniejszy poprawny PNG: jeden piksel, podany kolor. */
function pikselPNG(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
}

test.describe('Galeria produktu', () => {
  test('zaplecze dodaje ujęcie, karta produktu je pokazuje i przełącza', async ({ page }) => {
    await zaloguj(page, KONTA.zaplecze);
    await page.goto('/panel/katalog');

    // Pierwszy produkt z listy — nazwa potrzebna, żeby potem znaleźć jego kartę
    const wiersz = page.locator('.admin-row, .admin-item, tr').filter({ hasText: 'zł' }).first();
    await expect(wiersz).toBeVisible();

    await page.getByRole('button', { name: /Edytuj/i }).first().click();

    // Blok galerii pojawia się dopiero przy istniejącym produkcie
    const wejscie = page.locator('#a-galeria');
    await expect(wejscie).toBeVisible();

    // Punkt odniesienia bierzemy dopiero wtedy, gdy lista przestanie się
    // dosypywać: dwa odczyty pod rząd o tej samej długości. Wcześniej test
    // czytał zero, zanim galeria zdążyła się wyrenderować, i sam sobie
    // zaniżał licznik — a potem padał na „2 zamiast 4" przy drugim przebiegu
    // bez resetu bazy. Zwykłe `networkidle` tego nie łapie, bo dane wchodzą
    // strumieniem RSC, nie osobnym żądaniem.
    const lista = page.locator('.galeria-panel-lista li');
    let poprzedni = -1;
    await expect
      .poll(async () => {
        const teraz = await lista.count();
        const ustabilizowane = teraz === poprzedni;
        poprzedni = teraz;
        return ustabilizowane;
      }, { timeout: 5000 })
      .toBe(true);

    const przed = poprzedni;

    // Dwa ujęcia, nie jedno: seed nie ma okładek, więc przy jednym zdjęciu
    // karta pokazałaby sam kadr bez paska miniatur — i test nie sprawdziłby
    // przełączania, o które w nim chodzi.
    for (const nazwaPliku of ['ujecie-pierwsze.png', 'ujecie-drugie.png']) {
      await wejscie.setInputFiles({
        name: nazwaPliku,
        mimeType: 'image/png',
        buffer: pikselPNG(),
      });
      await expect(page.getByText('Zdjęcie dodane')).toBeVisible();
    }

    await expect(page.locator('.galeria-panel-lista li')).toHaveCount(przed + 2);

    // Nazwa edytowanego produktu prowadzi do jego karty w sklepie
    const nazwa = await page.locator('#a-name').inputValue();

    await page.goto('/sklep');
    await page.getByRole('link', { name: nazwa }).first().click();
    await page.waitForURL(/\/produkt\//);

    // Okładka plus dodane ujęcie = pasek miniatur; przy jednym kadrze go nie ma
    const miniatury = page.locator('.galeria-miniatura');
    await expect(miniatury).toHaveCount(przed + 2);
    await expect(miniatury.first()).toHaveAttribute('aria-pressed', 'true');

    // Przełączenie kadru przestawia stan wciśnięcia na wskazaną miniaturę
    await miniatury.last().click();
    await expect(miniatury.last()).toHaveAttribute('aria-pressed', 'true');
    await expect(miniatury.first()).toHaveAttribute('aria-pressed', 'false');
  });

  test('produkt bez dodatkowych zdjęć nie dostaje pustego paska miniatur', async ({ page }) => {
    // Seed nie ma żadnych zdjęć, więc dowolna karta nadaje się na sprawdzenie
    await page.goto('/sklep');
    await page.locator('.card-title').first().click();
    await page.waitForURL(/\/produkt\//);

    await expect(page.locator('.product-media')).toBeVisible();
    await expect(page.locator('.galeria-miniatury')).toHaveCount(0);
  });
});
