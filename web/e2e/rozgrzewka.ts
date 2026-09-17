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

      // `card-title` stoi w każdej karcie produktu. Jego obecność dowodzi,
      // że lista przyszła z bazy, a nie z pustego prerenderu.
      if (odpowiedz.ok && html.includes('card-title')) return;

      ostatni = `HTTP ${odpowiedz.status}, bez kart w treści`;
    } catch (blad) {
      ostatni = blad instanceof Error ? blad.message : String(blad);
    }

    await new Promise((gotowe) => setTimeout(gotowe, PRZERWA_MS));
  }

  throw new Error(
    `Katalog nie zdążył się odświeżyć w ${LIMIT_MS / 1000} s (${ostatni}). ` +
      'Bez towaru na liście ścieżka zakupu nie ma czego kupić, więc zestaw ' +
      'padłby na dziesięciu testach naraz zamiast powiedzieć, co jest nie tak.'
  );
}

export default async function rozgrzej(): Promise<void> {
  await poczekajNaKatalog();
}
