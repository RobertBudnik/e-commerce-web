/**
 * Rozgrzewka cache'u przed zestawem e2e.
 *
 * Odkąd testy jadą po buildzie produkcyjnym, a nie po serwerze deweloperskim,
 * wchodzi w grę rzecz, której w `next dev` nie było: trasy z `revalidate` są
 * prerenderowane przy buildzie i pierwsze żądanie dostaje tamtą wersję.
 * W CI build powstaje zanim testy cokolwiek kupią, więc katalog bywa w niej
 * pusty — `/sklep` oddawał zero kart przy pierwszym wejściu i dopiero
 * powtórka widziała towar. Jeden pusty `/sklep` wywracał sześć testów
 * ścieżki zakupu naraz, bo pomocnik `dodajPierwszyDoKoszyka` nie miał czego
 * kliknąć.
 *
 * Rozgrzewka odpytuje katalog do skutku: pierwsze żądanie uruchamia
 * odświeżenie w tle, kolejne dostają już prawdziwą treść. Czekamy na
 * konkretny dowód — nazwę produktu w HTML-u — a nie na sam kod 200, bo
 * pusta lista też jest dwusetką.
 */
const ADRES = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

/** Ile najwyżej czekamy na świeży katalog. */
const LIMIT_MS = 60_000;
const PRZERWA_MS = 1_000;

async function poczekajNaKatalog(): Promise<void> {
  const koniec = Date.now() + LIMIT_MS;
  let ostatni = 'brak odpowiedzi';

  while (Date.now() < koniec) {
    try {
      const odpowiedz = await fetch(`${ADRES}/sklep`, { cache: 'no-store' });
      const html = await odpowiedz.text();

      // Nie wystarczy, że karty są. Ścieżka zakupu potrzebuje sztuki NA STANIE:
      // `ProductCard` renderuje „Do koszyka" tylko przy `stock !== 0`, a przy
      // zerze wypisuje „Niedostępny" i wyłącza przycisk. Rozgrzewka pilnująca
      // samych kart przepuszczała katalog bez towaru, a wtedy padało jedenaście
      // testów naraz na `dodajPierwszyDoKoszyka`, nie mówiąc dlaczego.
      const kart = (html.match(/card-title/g) ?? []).length;
      const doKupienia = (html.match(/Do koszyka/g) ?? []).length;

      if (odpowiedz.ok && doKupienia > 0) return;

      ostatni =
        `HTTP ${odpowiedz.status}, kart: ${kart}, sztuk na stanie: ${doKupienia}` +
        (kart > 0 && doKupienia === 0 ? ' — katalog jest, ale wszystko niedostępne' : '');
    } catch (blad) {
      ostatni = blad instanceof Error ? blad.message : String(blad);
    }

    await new Promise((gotowe) => setTimeout(gotowe, PRZERWA_MS));
  }

  throw new Error(
    `Katalog nie wystawił ani jednej sztuki na stanie w ${LIMIT_MS / 1000} s ` +
      `(${ostatni}). Bez tego ścieżka zakupu nie ma czego kupić i pada ` +
      'jedenaście testów naraz. Jeśli kart jest sporo, a sztuk zero, przyczyną ' +
      'są stany w `supabase/seed.sql`, a nie cache ani wygląd.'
  );
}

export default async function rozgrzej(): Promise<void> {
  await poczekajNaKatalog();
}
