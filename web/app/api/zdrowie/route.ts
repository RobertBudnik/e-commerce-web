import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * Sonda zdrowia dla monitoringu zewnętrznego.
 *
 * Powstała, bo „strona się otwiera" nie znaczy „sklep działa". Strona główna
 * odpowiada HTTP 200 także wtedy, gdy baza nie odpowiada (katalog renderuje
 * się wtedy pusty), gdy kolejka stoi i gdy schemat bazy jest starszy niż kod.
 * Zwykły uptime monitor przepuści każdy z tych stanów.
 *
 * Trzy rzeczy, które sonda naprawdę sprawdza:
 *
 *   1. baza      — czy PostgREST odpowiada na najtańsze możliwe zapytanie
 *   2. kolejka   — czy zadania w tle są przerabiane, czy rosną
 *   3. schemat   — czy funkcje, których wymaga ten kod, istnieją w bazie
 *
 * Trzecia jest tu z konkretnego powodu. 19.09.2026 produkcja stała siedem
 * migracji za repo i dwie funkcje, których kod woła, po prostu nie
 * istniały — a nic tego nie zgłaszało. Ten punkt zamienia taki rozjazd
 * z niewidzialnego w alarmowalny.
 *
 * Czego tu świadomie NIE ma: liczby zamówień, obrotu ani niczego, co mówi
 * o skali sprzedaży. Sonda jest publiczna, bo monitoring musi ją czytać bez
 * logowania, a dane handlowe nie mają prawa wisieć pod publicznym adresem.
 * Alarm „zero zamówień od godziny" należy ustawić po stronie bazy albo
 * hurtowni, nie tutaj.
 */

/** Nigdy z cache'u — sonda ma mówić o teraz, nie o tym, jak było minutę temu. */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Ile zadań w kolejce uznajemy za zator. Powyżej — coś nie drenuje. */
const PROG_ZATORU = 50;

type Stan = 'ok' | 'degradacja' | 'awaria';

export async function GET() {
  const wynik: Record<string, unknown> = { czas: new Date().toISOString() };
  let stan: Stan = 'ok';

  const supabase = await createClient();

  // --- 1. baza ------------------------------------------------------------
  // `limit(1)`, a NIE `head: true`.
  //
  // To nie jest drobiazg: przy `head: true` supabase-js wysyła żądanie HEAD,
  // a odpowiedź HEAD nie ma ciała. Gdy PostgREST odpowiada błędem (404
  // PGRST205 „nie ma takiej tabeli"), treść błędu siedzi właśnie w ciele —
  // więc klient nie ma czego sparsować i oddaje `error: null`, `count: null`.
  // Sonda z `head: true` raportowała przez to „ok" dla tabeli, której
  // w bazie w ogóle nie było. Zmierzone, nie przewidziane.
  //
  // Jeden wiersz to koszt bez znaczenia, a odpowiedź jest prawdziwa.
  const baza = await supabase.from('store_settings').select('id').limit(1);
  if (baza.error) {
    wynik.baza = { ok: false, blad: baza.error.message };
    stan = 'awaria';
  } else {
    wynik.baza = { ok: true };
  }

  // --- 2. kolejka ---------------------------------------------------------
  if (!baza.error) {
    // Bez `head: true` — z tego samego powodu, co wyżej. `limit(0)` nie
    // ściąga wierszy, ale zostaje zwykłym GET-em, więc błąd przychodzi
    // z ciałem i da się go odczytać.
    const [oczekujace, porazki] = await Promise.all([
      supabase
        .from('zadania')
        .select('id', { count: 'exact' })
        .eq('stan', 'oczekuje')
        .limit(0),
      supabase.from('zadania').select('id', { count: 'exact' }).eq('stan', 'porazka').limit(0),
    ]);

    if (oczekujace.error || porazki.error || oczekujace.count === null) {
      // Brak tabeli to też informacja — znaczy, że migracja kolejki nie
      // weszła na to środowisko.
      wynik.kolejka = {
        ok: false,
        blad: (oczekujace.error ?? porazki.error)?.message ?? 'brak tabeli `zadania`',
      };
      if (stan === 'ok') stan = 'degradacja';
    } else {
      const czeka = oczekujace.count ?? 0;
      const zepsute = porazki.count ?? 0;
      const zator = czeka > PROG_ZATORU;
      wynik.kolejka = { ok: !zator && zepsute === 0, oczekuje: czeka, porazki: zepsute };
      if (zator || zepsute > 0) {
        if (stan === 'ok') stan = 'degradacja';
      }
    }
  }

  // --- 3. schemat ---------------------------------------------------------
  // Funkcje wołane przez kod sklepu. Brak którejkolwiek znaczy, że baza
  // jest starsza niż aplikacja — czyli że ktoś wdrożył kod bez migracji.
  if (!baza.error) {
    const { data, error } = await supabase.rpc('brakujace_funkcje');

    if (error) {
      wynik.schemat = { ok: false, blad: 'brak funkcji kontrolnej `brakujace_funkcje`' };
      if (stan === 'ok') stan = 'degradacja';
    } else {
      const brakuje = (data ?? []) as string[];
      wynik.schemat = { ok: brakuje.length === 0, brakuje };
      if (brakuje.length > 0 && stan === 'ok') stan = 'degradacja';
    }
  }

  wynik.stan = stan;

  // 503 wyłącznie przy prawdziwej awarii. Degradacja oddaje 200, bo sklep
  // wtedy sprzedaje — ma tylko zapaloną kontrolkę. Uptime monitor, który
  // dzwoni o trzeciej w nocy przy każdym zatorze kolejki, zostaje wyciszony
  // po tygodniu i przestaje pilnować czegokolwiek.
  return NextResponse.json(wynik, {
    status: stan === 'awaria' ? 503 : 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
