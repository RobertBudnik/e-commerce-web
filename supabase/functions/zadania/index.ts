/**
 * POST /functions/v1/zadania
 *
 * Pracownik kolejki. Bierze porcję dojrzałych zadań, wykonuje je i oznacza
 * wynik. Woła to `pg_cron` co minutę przez pg_net — albo człowiek ręcznie,
 * gdy trzeba dogonić zaległości.
 *
 * Funkcja musi być wystawiona bez JWT (`--no-verify-jwt`): woła ją baza,
 * która nie nosi tokenu użytkownika. Bezpieczeństwa pilnuje wspólny sekret
 * w nagłówku, porównywany w stałym czasie.
 *
 * Dlaczego pracownik jest osobny od tego, co zadania dodaje: to cała idea
 * Outboxa. Zamówienie zostaje opłacone i **w tej samej transakcji** powstaje
 * wiersz zadania. Czy mail pójdzie za pięć sekund, czy za pięć minut po
 * trzech nieudanych próbach — nie ma wpływu na to, czy zamówienie jest
 * opłacone. Wcześniej miało: padnięcie wysyłki zabierało ze sobą mail
 * bezpowrotnie, bo nikt nie pamiętał, że był do wysłania.
 *
 * Zmienne środowiskowe:
 *   SEKRET_ZADAN     — ten sam ciąg co w konfiguracja_poczty (klucz `sekret_zadan`)
 *   RESEND_API_KEY, RESEND_FROM, RESEND_REPLY_TO, PUBLICZNY_ADRES — jak w poczcie
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — wstrzykiwane przez platformę
 */

import { rowneWStalymCzasie } from '../_wspolne/poczta.ts';
import { klientAdmina, wyslijMailZamowienia } from '../_wspolne/wysylka-zamowien.ts';

const SEKRET = Deno.env.get('SEKRET_ZADAN') ?? '';

/** Ile zadań na jedno wywołanie. Porcja, nie wszystko — funkcja brzegowa ma limit czasu. */
const PORCJA = 10;

type Zadanie = {
  id: number;
  rodzaj: string;
  ladunek: Record<string, unknown>;
  proby: number;
};

/** Wykonanie jednego zadania. Zwraca powód porażki albo nic przy sukcesie. */
async function wykonaj(
  admin: ReturnType<typeof klientAdmina>,
  zadanie: Zadanie
): Promise<string | null> {
  const orderId = typeof zadanie.ladunek.order_id === 'string' ? zadanie.ladunek.order_id : '';

  switch (zadanie.rodzaj) {
    case 'potwierdzenie_zamowienia': {
      if (!orderId) return 'ładunek bez order_id';
      const wynik = await wyslijMailZamowienia(admin, orderId, 'potwierdzenie');
      return wynik.ok ? null : (wynik.powod ?? 'nieznany powód');
    }

    case 'przypomnienie_koszyk': {
      if (!orderId) return 'ładunek bez order_id';
      const wynik = await wyslijMailZamowienia(admin, orderId, 'przypomnienie');
      return wynik.ok ? null : (wynik.powod ?? 'nieznany powód');
    }

    default:
      // Nieznany rodzaj nie naprawi się sam przy ponowieniu.
      return `nieznany rodzaj zadania: ${zadanie.rodzaj}`;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Metoda niedozwolona', { status: 405 });

  if (!SEKRET) {
    console.error('SEKRET_ZADAN nie ustawiony — żądanie odrzucone');
    return new Response('Funkcja nieskonfigurowana', { status: 500 });
  }
  if (!rowneWStalymCzasie(req.headers.get('x-sekret-zadan') ?? '', SEKRET)) {
    return new Response('Brak dostępu', { status: 401 });
  }

  const admin = klientAdmina();

  const { data, error } = await admin.rpc('wez_zadania', { p_ile: PORCJA });
  if (error) {
    console.error('Nie udało się pobrać zadań:', error.message);
    return new Response('Błąd kolejki', { status: 500 });
  }

  const zadania = (data ?? []) as Zadanie[];
  let zrobione = 0;
  let nieudane = 0;

  // Sekwencyjnie, nie równolegle. Porcja jest mała, a Resend ma własne limity
  // — dziesięć jednoczesnych wysyłek co minutę szybciej wpadnie na ścianę
  // niż dziesięć po kolei.
  for (const zadanie of zadania) {
    let powod: string | null;
    try {
      powod = await wykonaj(admin, zadanie);
    } catch (e) {
      powod = e instanceof Error ? e.message : 'wyjątek bez treści';
    }

    const { error: bladZamkniecia } = await admin.rpc('zamknij_zadanie', {
      p_id: zadanie.id,
      p_udalo: powod === null,
      p_blad: powod,
    });

    // Nieoznaczone zadanie nie przepada: `wez_zadania` odda je z powrotem,
    // gdy minie okno pięciu minut. Log jest po to, żeby dało się poznać,
    // że powtórka wzięła się stąd, a nie z prawdziwej porażki.
    if (bladZamkniecia) {
      console.error('Nie udało się zamknąć zadania', zadanie.id, bladZamkniecia.message);
    }

    if (powod === null) zrobione++;
    else {
      nieudane++;
      console.error(`Zadanie ${zadanie.id} (${zadanie.rodzaj}) nie powiodło się: ${powod}`);
    }
  }

  return new Response(JSON.stringify({ wziete: zadania.length, zrobione, nieudane }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
