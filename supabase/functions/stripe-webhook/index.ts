/**
 * POST /functions/v1/stripe-webhook
 *
 * Jedyne miejsce, które uznaje zamówienie za opłacone. Powrót klienta na stronę
 * sukcesu niczego nie potwierdza — to tylko widok.
 *
 * Podpis weryfikowany ręcznie (HMAC-SHA256 na "timestamp.payload"), bez SDK.
 * Funkcja musi być wystawiona bez JWT: --no-verify-jwt przy serve/deploy,
 * bo Stripe nie nosi tokenu użytkownika. Bezpieczeństwa pilnuje podpis.
 *
 * Zmienne środowiskowe:
 *   STRIPE_WEBHOOK_SECRET — whsec_... z panelu Stripe albo `stripe listen`
 *   STRIPE_TRYB           — 'live' albo 'test'; puste przepuszcza oba
 *   PRZYPOMNIENIE_KOSZYK  — '1' włącza mail o porzuconym koszyku (patrz niżej)
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — wstrzykiwane przez platformę
 *
 * Zmiennych Resenda tu nie ma: ta funkcja nie wysyła poczty. Odnotowuje
 * płatność, a resztą zajmuje się kolejka (`zadania`).
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const TOLERANCE_SECONDS = 300;

/**
 * Waluta sklepu. Zdarzenie na inną walutę znaczy, że sesję założył ktoś inny
 * albo że konfiguracja operatora rozjechała się z bazą — w obu przypadkach
 * kwota w groszach nie opisuje tego rachunku.
 */
const WALUTA = 'pln';

/**
 * Tryb, w którym ma pracować ten endpoint.
 *
 * Podpis chroni przed obcym nadawcą, ale nie przed własną pomyłką: endpoint
 * testowy wpięty w produkcyjny projekt podpisuje się poprawnie swoim
 * sekretem, a zamówienia z kart testowych wyglądają w bazie dokładnie jak
 * sprzedaż. Puste = przepuszczaj oba (praca lokalna).
 */
const TRYB = Deno.env.get('STRIPE_TRYB') ?? '';

/**
 * Przypomnienie o porzuconym koszyku jest **domyślnie wyłączone**.
 *
 * Powód jest prawny, nie techniczny: ta wiadomość zachęca do zakupu, więc
 * jest informacją handlową w rozumieniu art. 10 ustawy o świadczeniu usług
 * drogą elektroniczną, a on wymaga wcześniejszej zgody odbiorcy. Formularz
 * zamówienia zbiera zgodę na regulamin i przetwarzanie danych — nie na
 * marketing.
 */
const PRZYPOMINAJ = Deno.env.get('PRZYPOMNIENIE_KOSZYK') === '1';

/** Porównanie w stałym czasie — zwykłe === wycieka informację przez czas wykonania. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Weryfikacja podpisu.
 *
 * Nagłówek potrafi nieść **kilka** podpisów `v1` naraz — tak wygląda rotacja
 * sekretu po stronie operatora: przez okno przejściowe każde zdarzenie jest
 * podpisane starym i nowym kluczem. Wcześniej stało tu `Object.fromEntries`,
 * które z pary powtórzonych kluczy zachowuje ostatni; w dniu rotacji połowa
 * zdarzeń odpadłaby z 400, a operator po serii odmów wyłącza endpoint.
 * Dlatego zbieramy wszystkie i porównujemy z każdym.
 */
async function verifySignature(payload: string, header: string, secret: string): Promise<boolean> {
  let timestamp = '';
  const podpisy: string[] = [];

  for (const czesc of header.split(',')) {
    const [klucz, wartosc] = czesc.split('=', 2);
    if (!klucz || !wartosc) continue;
    if (klucz.trim() === 't') timestamp = wartosc.trim();
    if (klucz.trim() === 'v1') podpisy.push(wartosc.trim());
  }

  if (!timestamp || podpisy.length === 0) return false;

  // Okno czasowe zamyka drogę do powtórki przechwyconego żądania
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`)
  );
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return podpisy.some((podpis) => timingSafeEqual(expected, podpis));
}

/** Identyfikator zamówienia z sesji płatności. */
function zamowienieZSesji(session: Record<string, unknown>): string | null {
  const metadata = session.metadata as Record<string, unknown> | undefined;
  const zMetadanych = typeof metadata?.order_id === 'string' ? metadata.order_id : null;
  const zReferencji =
    typeof session.client_reference_id === 'string' ? session.client_reference_id : null;
  return zMetadanych ?? zReferencji;
}

/**
 * Wynik obsługi zdarzenia.
 *
 * `ponow` rozróżnia dwie porażki, które wcześniej były jednym 500: usterkę
 * przejściową (baza nie odpowiedziała — ponowienie ma sens) od zdarzenia,
 * którego ta funkcja nigdy nie obsłuży (kwota się nie zgadza — ponawianie
 * w nieskończoność niczego nie naprawi, a operator po serii 500 wyłącza
 * endpoint i traci się też zdarzenia, które są w porządku).
 */
type Wynik = { ok: true } | { ok: false; ponow: boolean; powod: string };

const UDANE: Wynik = { ok: true };
const odmowa = (powod: string): Wynik => ({ ok: false, ponow: false, powod });
const usterka = (powod: string): Wynik => ({ ok: false, ponow: true, powod });

type Baza = ReturnType<typeof createClient>;

/**
 * Potwierdzenie wpłaty.
 *
 * Trzy sprawdzenia przed oznaczeniem zamówienia jako opłacone, bo po nim
 * paczka idzie do wysyłki:
 *
 * 1. `payment_status` sesji. `checkout.session.completed` NIE znaczy
 *    „zapłacono" — przy metodach z odroczonym rozliczeniem (przelew,
 *    część płatności odroczonych) sesja domyka się ze stanem `unpaid`,
 *    a pieniądze przychodzą dopiero z `async_payment_succeeded`. Wcześniej
 *    kod oznaczał tu wpłatę od razu: zamówienie szło do realizacji przed
 *    zaksięgowaniem przelewu, a przy odmowie banku nikt już towaru nie
 *    zatrzymywał.
 * 2. Waluta.
 * 3. Kwota wobec rachunku policzonego w bazie.
 */
async function potwierdzWplate(admin: Baza, session: Record<string, unknown>): Promise<Wynik> {
  const orderId = zamowienieZSesji(session);
  if (!orderId) return odmowa('sesja bez identyfikatora zamówienia');

  const stanSesji = session.payment_status;
  if (stanSesji !== 'paid' && stanSesji !== 'no_payment_required') {
    // Nie błąd: tak wygląda przelew w drodze. Pieniądze potwierdzi osobne
    // zdarzenie, a do tego czasu zamówienie ma zostać w stanie „oczekuje".
    console.log(`Sesja ${session.id} domknięta bez wpłaty (${stanSesji}) — czekam na rozliczenie`);
    return UDANE;
  }

  const waluta = String(session.currency ?? '').toLowerCase();
  if (waluta !== WALUTA) {
    return odmowa(`waluta ${waluta} zamiast ${WALUTA}`);
  }

  const wplata = Number(session.amount_total);
  if (!Number.isFinite(wplata)) return odmowa('sesja bez kwoty');

  const { data: zamowienie, error: bladOdczytu } = await admin
    .from('orders')
    .select('id, total_cents, payment_status')
    .eq('id', orderId)
    .maybeSingle();

  if (bladOdczytu) return usterka(`odczyt zamówienia: ${bladOdczytu.message}`);
  if (!zamowienie) return odmowa(`nie ma zamówienia ${orderId}`);

  const rachunek = Number((zamowienie as { total_cents: number }).total_cents);
  if (wplata !== rachunek) {
    // Świadomie bez ponowienia: rozjazd kwoty nie naprawi się sam. Zamówienie
    // zostaje nieopłacone, a ślad zdarzenia i ten wpis mówią obsłudze, gdzie
    // szukać.
    return odmowa(`wpłata ${wplata} gr ≠ rachunek ${rachunek} gr`);
  }

  // mark_order_paid jest idempotentne i samo jeszcze raz sprawdza kwotę —
  // to jest ta sama kontrola po drugiej stronie granicy service_role.
  const { error } = await admin.rpc('mark_order_paid', {
    p_order_id: orderId,
    p_provider: 'stripe',
    p_payment_intent: session.payment_intent ?? session.id,
    p_kwota_groszy: wplata,
  });
  if (error) return usterka(`mark_order_paid: ${error.message}`);

  // Potwierdzenia NIE wysyłamy tutaj. Wyzwalacz `on_order_paid_queue` dokłada
  // zadanie do kolejki w tej samej transakcji, co zmiana `payment_status`,
  // a wysyłką zajmuje się funkcja `zadania`. Różnica nie jest kosmetyczna:
  // wcześniej padnięcie tej funkcji tuż po `mark_order_paid` zabierało ze
  // sobą potwierdzenie bezpowrotnie. Teraz pamięta o tym baza.
  return UDANE;
}

/**
 * Sesja skończyła się niczym — wygasła albo bank odmówił.
 *
 * Woła `anuluj_sesje_platnosci`, nie `cancel_order`. Ta druga sprawdza
 * `authorize('orders.write')`, a `authorize` opiera się na `auth.uid()`, które
 * pod kluczem `service_role` jest zawsze puste. Webhook dostawał więc „Brak
 * uprawnień", oddawał 500, operator ponawiał przez dobę i odpuszczał —
 * a zarezerwowany towar nie wracał na magazyn nigdy.
 */
async function porzucSesje(
  admin: Baza,
  session: Record<string, unknown>,
  platnosc: 'nieudane' | null
): Promise<Wynik> {
  const orderId = zamowienieZSesji(session);
  if (!orderId) return odmowa('sesja bez identyfikatora zamówienia');

  const { data, error } = await admin.rpc('anuluj_sesje_platnosci', {
    p_order_id: orderId,
    p_platnosc: platnosc,
  });
  if (error) return usterka(`anuluj_sesje_platnosci: ${error.message}`);

  // Pusta odpowiedź znaczy „nie ma takiego zamówienia" — sesja z innego
  // wdrożenia albo z drugiego trybu operatora. Ponawianie tego nie naprawi.
  if (data === null) return odmowa(`nie ma zamówienia ${orderId}`);

  return UDANE;
}

/**
 * Zwrot pieniędzy zrobiony w panelu operatora.
 *
 * Bez tego zamówienie zostaje „opłacone" na zawsze, a raport finansowy
 * pokazuje przychód, którego nie ma. Zdarzenie nie niesie metadanych
 * zamówienia, więc baza szuka po `payment_intent_id`.
 *
 * Zwrot częściowy zostawia stan „opłacone" — rozstrzyga o tym baza,
 * porównując kwoty.
 */
async function odnotujZwrot(admin: Baza, charge: Record<string, unknown>): Promise<Wynik> {
  const intent = charge.payment_intent;
  if (typeof intent !== 'string' || !intent) return odmowa('zwrot bez identyfikatora wpłaty');

  const { error } = await admin.rpc('oznacz_zwrot_platnosci', {
    p_payment_intent: intent,
    p_zwrocone_groszy: Number(charge.amount_refunded ?? 0),
    p_calosc_groszy: Number(charge.amount ?? 0),
  });
  // Zwrot wpłaty spoza tej bazy (inny tryb operatora, zamówienie sprzed
  // wdrożenia) nie jest usterką do ponawiania — jest wpisem do dziennika.
  if (error) return odmowa(`oznacz_zwrot_platnosci: ${error.message}`);

  return UDANE;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Metoda niedozwolona', { status: 405 });

  const signature = req.headers.get('stripe-signature');
  const payload = await req.text();

  if (!WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET nie ustawiony — żądanie odrzucone');
    return new Response('Webhook nieskonfigurowany', { status: 500 });
  }
  if (!signature || !(await verifySignature(payload, signature, WEBHOOK_SECRET))) {
    return new Response('Nieprawidłowy podpis', { status: 400 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response('Nieprawidłowa treść zdarzenia', { status: 400 });
  }

  const eventId = typeof event.id === 'string' ? event.id : '';
  const typ = String(event.type ?? '');
  const livemode = event.livemode === true;

  if (!eventId) return new Response('Zdarzenie bez identyfikatora', { status: 400 });

  if ((TRYB === 'live' && !livemode) || (TRYB === 'test' && livemode)) {
    // 200, nie 400: to nie jest atak, tylko endpoint wpięty nie tam, gdzie
    // trzeba. Odmowa z kodem błędu zapętliłaby operatora na zdarzeniu, które
    // i tak nie ma tu czego szukać.
    console.error(`Zdarzenie ${eventId} w trybie livemode=${livemode}, endpoint pracuje w ${TRYB}`);
    return new Response(JSON.stringify({ received: true, pominiete: 'inny tryb' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // service_role omija RLS — dlatego ten klucz nie ma prawa opuścić serwera
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const obiekt = ((event.data as Record<string, unknown>)?.object ?? {}) as Record<string, unknown>;
  const orderId = typ.startsWith('checkout.session.') ? zamowienieZSesji(obiekt) : null;

  // Zajęcie zdarzenia PRZED obsługą, zamknięcie PO. Szczegóły w migracji
  // 20260920090000: sam wpis na wejściu gubiłby zdarzenia po padzie w połowie,
  // a sam wpis na wyjściu nie mówiłby nic o tym, co jest w toku.
  const { data: doObslugi, error: bladSladu } = await admin.rpc('zdarzenie_platnosci_zajmij', {
    p_event_id: eventId,
    p_typ: typ,
    p_order_id: orderId,
    p_livemode: livemode,
  });

  if (bladSladu) {
    console.error('Nie udało się zapisać śladu zdarzenia:', bladSladu);
    return new Response('Błąd zapisu śladu zdarzenia', { status: 500 });
  }

  if (doObslugi !== true) {
    // Powtórka zdarzenia, które już przeszło. Operator wysyła je kilka razy
    // z założenia — to nie jest błąd i nie ma czego robić drugi raz.
    return new Response(JSON.stringify({ received: true, powtorka: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let wynik: Wynik;

  try {
    switch (typ) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        wynik = await potwierdzWplate(admin, obiekt);
        break;

      case 'checkout.session.expired':
        wynik = await porzucSesje(admin, obiekt, null);

        // Przypomnienie idzie tylko przy wygaśnięciu sesji, nie przy odrzuconej
        // płatności: „nie zdążyłeś zapłacić" i „bank odrzucił kartę" to dwie
        // różne sytuacje, a ta druga nie potrzebuje zachęty do zakupu.
        //
        // Do kolejki, nie wprost — tak samo jak potwierdzenie. Zadanie samo
        // sprawdzi, czy zamówienie ma adres, i samo się ponowi.
        if (wynik.ok && PRZYPOMINAJ && orderId) {
          const { error } = await admin.rpc('dodaj_zadanie', {
            p_rodzaj: 'przypomnienie_koszyk',
            p_klucz: `przypomnienie:${orderId}`,
            p_ladunek: { order_id: orderId },
          });
          if (error) console.error('Nie udało się zakolejkować przypomnienia:', error);
        }
        break;

      case 'checkout.session.async_payment_failed':
        wynik = await porzucSesje(admin, obiekt, 'nieudane');
        break;

      case 'charge.refunded':
        wynik = await odnotujZwrot(admin, obiekt);
        break;

      case 'charge.dispute.created':
        // Obciążenie zwrotne. Bazy nie ruszamy — `payment_status` nie ma na to
        // stanu, a wymyślanie go tutaj rozjechałoby raporty. Ale to jest
        // pieniądz zabrany z konta i cisza jest tu najgorszą odpowiedzią:
        // wpis w dzienniku i ślad w `platnosci_zdarzenia` mają obudzić obsługę.
        console.error(
          `SPÓR O PŁATNOŚĆ: ${obiekt.id} na ${obiekt.amount} ${obiekt.currency}, ` +
            `powód ${obiekt.reason}. Odpowiedź trzeba złożyć w panelu operatora.`
        );
        wynik = UDANE;
        break;

      default:
        wynik = UDANE;
        break;
    }
  } catch (e) {
    wynik = usterka(e instanceof Error ? e.message : 'nieznany błąd');
  }

  if (!wynik.ok && wynik.ponow) {
    // Ślad zostaje w stanie `w_toku`, więc ponowienie obsłuży zdarzenie
    // jeszcze raz. 500 każe operatorowi ponowić — lepsze niż ciche zgubienie
    // płatności.
    console.error(`Zdarzenie ${eventId} (${typ}) do ponowienia: ${wynik.powod}`);
    return new Response('Błąd obsługi zdarzenia', { status: 500 });
  }

  if (!wynik.ok) {
    // Zdarzenie odrzucone na trwałe. Domykamy ślad, żeby operator przestał
    // ponawiać, ale zostawiamy krzyk w dzienniku — to jest ten wpis, po którym
    // ktoś ma zajrzeć do panelu.
    console.error(`Zdarzenie ${eventId} (${typ}) ODRZUCONE: ${wynik.powod}`);
  }

  const { error: bladZamkniecia } = await admin.rpc('zdarzenie_platnosci_zamknij', {
    p_event_id: eventId,
  });
  if (bladZamkniecia) {
    // Robota jest zrobiona, tylko ślad został otwarty. Ponowienie przejdzie
    // po raz drugi tą samą, idempotentną drogą — to jest bezpieczniejsze niż
    // zostawienie zdarzenia bez zamknięcia i bez ponowienia.
    console.error('Nie udało się domknąć śladu zdarzenia:', bladZamkniecia);
    return new Response('Błąd domknięcia śladu', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true, obsluzone: wynik.ok }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
