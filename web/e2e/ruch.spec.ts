import { expect, test } from '@playwright/test';

/**
 * Zaawansowany ruch — sekcja z `.claude/skills/nordo-design`.
 *
 * Testy sprawdzają zachowanie, nie wygląd: czy strzępka jedzie dalej po
 * puszczeniu, czy sekcja przypięta zmienia krok wraz z przewijaniem i czy
 * wszystko znika przy `prefers-reduced-motion`. Tego ostatniego nie da się
 * sprawdzić okiem, a jest to warunek, na którym cała ta warstwa stoi.
 */
test.describe('Zaawansowany ruch', () => {
  test('strzępka jedzie dalej po puszczeniu i nie otwiera karty po przeciągnięciu', async ({
    page,
  }) => {
    await page.goto('/');
    const strzepka = page.locator('.strzepka');
    // Bez przewinięcia strzępka leży pod ekranem, a mysz Playwrighta celuje
    // wtedy poza widok i żaden uchwyt wskaźnika się nie odpala.
    await strzepka.scrollIntoViewIfNeeded();
    await expect(strzepka).toBeVisible();

    // Bez zapasu do przewijania nie ma czego testować — przy zbyt szerokim
    // oknie karty mieszczą się w kontenerze.
    const zapas = await strzepka.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(zapas).toBeGreaterThan(200);

    const p = (await strzepka.boundingBox())!;
    const y = p.y + 60;

    await page.mouse.move(p.x + 500, y);
    await page.mouse.down();
    // Kilka kroków, bo prędkość liczy się z ostatniej klatki gestu
    for (const x of [460, 420, 380, 340]) {
      await page.mouse.move(p.x + x, y);
    }
    const wTrakcie = await strzepka.evaluate((el) => el.scrollLeft);
    await page.mouse.up();

    // Wybieg dokłada drogę już po puszczeniu przycisku
    await expect
      .poll(async () => strzepka.evaluate((el) => el.scrollLeft), { timeout: 2000 })
      .toBeGreaterThan(wTrakcie);

    // Adres się nie zmienił — przeciągnięcie po karcie nie jest kliknięciem
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('sekcja przypięta zmienia krok wraz z przewijaniem', async ({ page }) => {
    await page.goto('/');
    const blok = page.locator('.przypieta');
    await blok.scrollIntoViewIfNeeded();

    const kropki = page.locator('.przypieta-kropki li');
    await expect(kropki).toHaveCount(3);

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

    for (let i = 0; i < 3; i++) {
      // Środek kroku, żeby nie stać na granicy zaokrąglenia
      const y = geo.gora + (droga * (i + 0.5)) / 3;
      await page.evaluate((doY) => window.scrollTo(0, doY), y);
      await expect(kropki.nth(i)).toHaveAttribute('aria-current', 'step');
    }
  });

  test('spotlight odsłania tekst snopem za kursorem', async ({ page }) => {
    await page.goto('/');
    const panel = page.locator('.spotlight');
    await panel.scrollIntoViewIfNeeded();

    const snop = page.locator('.spotlight-snop');
    await expect(snop).toBeAttached();

    // Przed najechaniem snop jest zgaszony
    await expect(snop).toHaveCSS('clip-path', /circle\(0px/);

    const p = (await panel.boundingBox())!;
    await page.mouse.move(p.x + 320, p.y + 120);

    // Po najechaniu koło ma promień i siedzi tam, gdzie kursor
    await expect(snop).toHaveCSS('clip-path', /circle\(130px/);

    // Oba teksty niosą to samo zdanie, ale czytnik dostaje je raz
    await expect(snop).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('.spotlight-spod')).toBeVisible();
  });

  test('przy ograniczonym ruchu efekty znikają, a treść zostaje', async ({ browser }) => {
    const kontekst = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await kontekst.newPage();
    await page.goto('/');

    // Cząsteczki i snop spotlightu nie powstają w ogóle
    await expect(page.locator('.pole-czastek')).toHaveCount(0);
    await expect(page.locator('.spotlight-snop')).toHaveCount(0);

    // Marquee stoi, ale hasła są na stronie
    await expect(page.locator('.marquee-stoi')).toBeVisible();
    await expect(page.getByText('Darmowa dostawa od 300 zł').first()).toBeVisible();

    // Sekcja przypięta rozwija się w zwykłą listę — nie przejmuje przewijania
    await expect(page.locator('.przypieta-ekran')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Zamawiasz do 15:00' })).toBeVisible();

    // Nagłówek jest od razu docelowy, bez szumu
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Elektronika bez zbędnego hałasu'
    );

    await kontekst.close();
  });
});
