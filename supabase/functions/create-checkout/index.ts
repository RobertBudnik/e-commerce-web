/**
 * POST /functions/v1/create-checkout
 *
 * Tworzy zamówienie w bazie (ceny i stany liczy Postgres) i sesję płatności
 * u operatora. Przeglądarka przysyła wyłącznie identyfikatory produktów i ilości.
 *
 * Wejście:  { items: [{ product_id, qty }], email, phone?, shipping_address?, coupon? }
 * Wyjście:  { order_id, order_number, total_cents, checkout_url }
 *
 * Zmienne środowiskowe (supabase/functions/.env lokalnie, sekrety projektu na produkcji):
 *   SITE_URL             — adres frontendu; lokalnie http://localhost:3000, potem domena
 *   STRIPE_SECRET_KEY    — klucz operatora; pusty = tryb bez płatności (do pracy lokalnej)
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY — wstrzykiwane przez platformę
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Wartość awaryjna celuje w serwer deweloperski Next.js — trafia też do
// nagłówka CORS niżej, więc zły adres blokuje wywołanie z przeglądarki.
const SITE_URL = Deno.env.get('SITE_URL') ?? 'http://localhost:3000';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

/**
 * Ile sesji płatności wolno założyć w godzinę.
 *
 * To zapora przed testowaniem kradzionych kart: bot wrzuca najtańszą rzecz
 * do koszyka i przepuszcza przez kasę setki numerów, sprawdzając, które
 * przechodzą. Kosztuje to opłaty za nieudane próby, podbija wskaźnik sporów
 * i kończy się blokadą konta u operatora.
 *
 * Limit po adresie IP i osobno po adresie e-mail — jeden napastnik potrafi
 * mieć wiele adresów IP, a wiele adresów e-mail to dla niego żaden problem,
 * więc dopiero oba razem cokolwiek dają. Progi są luźne wobec prawdziwego
 * klienta: nikt nie zakłada dziesięciu zamówień w godzinę.
 */
const LIMIT_IP: [number, number] = [10, 3600]; // [ile, sekund]
const LIMIT_ADRESU: [number, number] = [5, 3600];

/**
 * Ile żyje nieopłacona sesja. Stripe domyślnie daje dobę.
 *
 * Doba to dla tego sklepu za długo: `create_order` **od razu zdejmuje towar
 * ze stanu**, więc porzucony koszyk blokuje rzecz na cały dzień. Przy nakładzie
 * liczonym w sztukach oznacza to, że jedna porzucona kasa potrafi wyłączyć
 * produkt z sprzedaży do jutra. Godzina wystarcza na przelew i BLIK-a,
 * a wygaśnięcie zwraca towar na półkę.
 */
const ZYCIE_SESJI_SEKUND = 3600;

const CORS = {
  'Access-Control-Allow-Origin': SITE_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

/**
 * Adres żądającego zza odwrotnego pośrednika.
 *
 * Bierzemy wyłącznie pierwszy wpis `x-forwarded-for` — dalsze pozycje
 * dopisują pośrednicy i da się je podrobić własnym nagłówkiem w żądaniu.
 */
function adresZadajacego(req: Request): string {
  const przekazany = req.headers.get('x-forwarded-for');
  if (przekazany) return przekazany.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'nieznany';
}

/**
 * Czy wolno założyć kolejną sesję płatności.
 *
 * Liczy oknem przesuwnym w bazie (`limity_poczty`, rodzaj `kasa`) — ta sama
 * infrastruktura, co przy limitach poczty. Nie zakładamy drugiej tabeli ani
 * nie dokładamy Vercel KV: licznik i tak musi być wspólny dla wszystkich
 * instancji funkcji, a baza już nim jest.
 *
 * Adres e-mail nie trafia do tabeli — liczy się skrót SHA-256 po stronie bazy.
 *
 * Gdy baza nie odpowie, przepuszczamy. Świadomy wybór: limit chroni przed
 * nadużyciem, ale awaria licznika nie może zamknąć kasy wszystkim klientom.
 */
async function wolnoZalozycSesje(
  supabase: ReturnType<typeof createClient>,
  req: Request,
  email: unknown
): Promise<boolean> {
  try {
    const ip = adresZadajacego(req);

    const proby: Promise<{ data: unknown; error: unknown }>[] = [
      supabase.rpc('limit_poczty', {
        p_klucz: `ip:${ip}`,
        p_rodzaj: 'kasa',
        p_ile: LIMIT_IP[0],
        p_sekundy: LIMIT_IP[1],
      }),
    ];

    if (typeof email === 'string' && email.trim()) {
      const { data: skrot, error } = await supabase.rpc('skrot_adresu', { p_email: email });
      if (!error && typeof skrot === 'string') {
        proby.push(
          supabase.rpc('limit_poczty', {
            p_klucz: `email:${skrot}`,
            p_rodzaj: 'kasa',
            p_ile: LIMIT_ADRESU[0],
            p_sekundy: LIMIT_ADRESU[1],
          })
        );
      }
    }

    const wyniki = await Promise.all(proby);
    if (wyniki.some((w) => w.error)) return true; // awaria licznika nie blokuje kasy

    return wyniki.every((w) => w.data === true);
  } catch (e) {
    console.error('Licznik prób kasy nie odpowiedział:', e);
    return true;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Metoda niedozwolona' }, 405);

  try {
    const { items, email, phone, shipping_address, coupon, zgoda_wersja } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return json({ error: 'Koszyk jest pusty' }, 400);
    }

    // Klient z tokenem użytkownika, nie service_role: zamówienie ma trafić
    // do właściwego konta, a RLS ma dalej obowiązywać.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );

    // Limit stoi PRZED `create_order`, nie po: odrzucona próba nie ma prawa
    // zostawić po sobie wiersza zamówienia ani zdjętego stanu magazynowego.
    if (!(await wolnoZalozycSesje(supabase, req, email))) {
      return json({ error: 'Za dużo prób. Spróbuj za kilka minut.' }, 429);
    }

    const { data: order, error } = await supabase.rpc('create_order', {
      p_items: items.map((i: { product_id: string; qty: number }) => ({
        product_id: i.product_id,
        qty: Number(i.qty),
      })),
      p_email: email,
      p_phone: phone ?? null,
      p_shipping_address: shipping_address ?? null,
      p_coupon: coupon ?? null,
      p_zgoda_wersja: zgoda_wersja ?? null,
    });

    if (error) return json({ error: error.message }, 400);

    // Bez klucza operatora kończymy na zamówieniu — wygodne przy pracy lokalnej.
    if (!STRIPE_SECRET_KEY) {
      return json({
        order_id: order.id,
        order_number: order.order_number,
        total_cents: order.total_cents,
        checkout_url: null,
        note: 'STRIPE_SECRET_KEY nie ustawiony — zamówienie czeka na płatność',
      });
    }

    // Stripe Checkout. BLIK i Przelewy24 włącza się w panelu Stripe;
    // przy pustej liście operator sam dobiera metody do kraju i waluty.
    //
    // Adresy powrotu celują w trasy App Routera. Wcześniej stały tu
    // `/order-confirmed.html` i `/cart.html` ze statycznej wersji sklepu —
    // obie odpowiadają dziś 404. Klient płacił i wracał na stronę błędu,
    // mimo że webhook zdążył już oznaczyć zamówienie jako opłacone. Ta
    // ścieżka nie była nigdy przeklikana, bo bez klucza Stripe kod idzie
    // gałęzią „bez płatności", a tam przekierowanie składa front.
    const params = new URLSearchParams({
      mode: 'payment',
      success_url: `${SITE_URL}/zamowienie/${encodeURIComponent(order.order_number)}`,
      cancel_url: `${SITE_URL}/koszyk`,
      customer_email: order.email,
      client_reference_id: order.id,
      'metadata[order_id]': order.id,
      'line_items[0][price_data][currency]': 'pln',
      'line_items[0][price_data][unit_amount]': String(order.total_cents),
      'line_items[0][price_data][product_data][name]': `Zamówienie ${order.order_number}`,
      'line_items[0][quantity]': '1',
      // Polski interfejs kasy. Bez tego Stripe zgaduje z nagłówka przeglądarki
      // i część klientów dostaje angielski formularz płatności.
      locale: 'pl',
      // „Zapłać" zamiast domyślnego „Zapisz się" / „Zapłać teraz" — Stripe
      // dobiera napis na przycisku do tej wartości.
      submit_type: 'pay',
      // Sesja wygasa po godzinie i zwalnia zarezerwowany towar (patrz stała).
      expires_at: String(Math.floor(Date.now() / 1000) + ZYCIE_SESJI_SEKUND),
    });

    // Portfele cyfrowe (Apple Pay, Google Pay) NIE wymagają tu żadnego
    // parametru ani zmiany na froncie. Hostowana kasa Stripe'a pokazuje je
    // sama, gdy przeglądarka i urządzenie je obsługują, a metoda „card" jest
    // włączona na koncie — domenę weryfikuje Stripe, bo to jego strona.
    // Warunkiem jest natomiast, żeby `payment_method_types` NIE było ustawione
    // ręcznie: podanie tej listy wyłącza automatyczny dobór metod i portfele
    // znikają. Dlatego tego parametru tu celowo nie ma.

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        /**
         * Klucz idempotencji — identyfikator zamówienia, bo to on jest tu
         * jednostką pracy.
         *
         * Bez niego zerwane połączenie po stronie klienta i ponowne dotknięcie
         * „Zamawiam" zakłada u operatora DRUGĄ sesję płatności na to samo
         * zamówienie. Obie są ważne, obie da się opłacić, a `payment_intent_id`
         * ma unikalny indeks — więc drugie potwierdzenie rozbija się o bazę,
         * już po pobraniu pieniędzy. Z tym nagłówkiem operator oddaje tę samą
         * sesję zamiast tworzyć nową.
         *
         * Zakres klucza to 24 godziny po stronie operatora, a sesja i tak żyje
         * godzinę (patrz ZYCIE_SESJI_SEKUND) — okno idempotencji obejmuje więc
         * całe życie sesji z zapasem.
         */
        'Idempotency-Key': order.id,
      },
      body: params,
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      // Zamówienie zostaje w stanie "oczekuje" — towar jest zarezerwowany,
      // a obsługa widzi je w panelu.
      return json({ error: session.error?.message ?? 'Operator płatności odrzucił żądanie' }, 502);
    }

    return json({
      order_id: order.id,
      order_number: order.order_number,
      total_cents: order.total_cents,
      checkout_url: session.url,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Błąd serwera' }, 500);
  }
});
