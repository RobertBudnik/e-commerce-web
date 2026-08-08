import { test } from '@playwright/test';

test('diagnoza obserwatora', async ({ page }) => {
  page.on('console', (m) => console.log('BROWSER:', m.text()));
  await page.goto('/sklep');
  await page.waitForTimeout(1500);
  const d = await page.evaluate(() => {
    const karta = document.querySelector('.card') as HTMLElement;
    const siatka = document.querySelector('.grid') as HTMLElement;
    return {
      maAtrybutReveal: karta?.hasAttribute('data-reveal'),
      celeWSiatce: siatka?.querySelectorAll('[data-reveal]').length,
      reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      pozycjaKarty: karta?.getBoundingClientRect().top,
      oknoWys: window.innerHeight,
    };
  });
  console.log('DIAG', JSON.stringify(d));
});
