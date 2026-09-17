import { expect, test } from '@playwright/test';
import { JAK_TO_DZIALA, MARKA } from '../lib/dane-sklepu';

/**
 * Ruch, który został na stronie głównej po przebudowie wg makiety „dwie głowy".
 *
 * Przeciągana taśma, pole cząstek i marquee zeszły razem ze starym układem —
 * ich testy odeszły z nimi. Sekcja przypięta została, bo właściciel chciał ją
 * zatrzymać, więc jej zachowanie dalej jest pilnowane: czy krok zmienia się
 * wraz z przewijaniem i czy przy `prefers-reduced-motion` sekcja rozwija się
 * w zwykłą listę, zamiast przejmować przewijanie.
 *
 * Teksty biorą się z `web/lib/dane-sklepu.ts`, a nie z literałów: sklep jest
 * szablonem, więc test przypięty do konkretnego hasła padałby po każdym
 * rebrandingu, choć sprawdzane zachowanie ani drgnie.
 */
test.describe('Ruch na stronie głównej', () => {
  test('sekcja przypięta zmienia krok wraz z przewijaniem', async ({ page }) => {
    await page.goto('/');
    const blok = page.locator('.przypieta');
    await blok.scrollIntoViewIfNeeded();

    const kropki = page.locator('.przypieta-kropki li');
    await expect(kropki).toHaveCount(JAK_TO_DZIALA.length);

    // Pozycje liczone z geometrii bloku, nie stałym przewinięciem o 900 px.
    // Krok to `droga / liczba kroków`, a droga zależy od wysokości okna —
    // przy stałej wartości test przechodził w izolacji i padał w pełnym
    // zestawie, bo zaczynał przewijanie z innego miejsca.
    const geo = await page.evaluate(() => {
      const el = document.querySelector('.przypieta') as HTMLElement;
      const p = el.getBoundingClientRect();
      return { gora: p.top + window.scrollY, wysokosc: p.height, okno: window.innerHeight };
    });
    const droga = geo.wysokosc - geo.okno;

    for (let i = 0; i < JAK_TO_DZIALA.length; i++) {
      // Środek kroku, żeby nie stać na granicy zaokrąglenia
      const y = geo.gora + (droga * (i + 0.5)) / JAK_TO_DZIALA.length;
      await page.evaluate((doY) => window.scrollTo(0, doY), y);
      await expect(kropki.nth(i)).toHaveAttribute('aria-current', 'step');
    }
  });

  test('przy ograniczonym ruchu sekcja rozwija się w listę, a treść zostaje', async ({
    browser,
  }) => {
    const kontekst = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await kontekst.newPage();
    await page.goto('/');

    // Sekcja przypięta nie przejmuje przewijania — zostaje zwykła lista kroków
    await expect(page.locator('.przypieta-ekran')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: JAK_TO_DZIALA[0].tytul })).toBeVisible();

    // Nagłówek jest od razu docelowy, bez szumu
    await expect(page.getByRole('heading', { level: 1 })).toContainText(MARKA.hasloHero);

    await kontekst.close();
  });
});
