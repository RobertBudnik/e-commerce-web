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
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — wstrzykiwane przez platformę
 *   RESEND_API_KEY        — klucz Resend; pusty = maile nie idą, reszta działa
 *   RESEND_FROM           — nadawca, np. „dwie głowy <sklep@mail.domena.pl>"
 *   RESEND_REPLY_TO       — skrzynka do odpowiedzi (opcjonalna)
 *   PUBLICZNY_ADRES       — adres sklepu do linków w treści
 *   PRZYPOMNIENIE_KOSZYK  — '1' włącza mail o porzuconym koszyku (patrz niżej)
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { wyslij } from '../_wspolne/poczta.ts';
import {
  mailPorzuconegoKoszyka,
  mailPotwierdzenia,
  type PozycjaZamowienia,
  type Zamowienie,
} from '../_wspolne/maile-zamowien.ts';

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const TOLERANCE_SECONDS = 300;

const KLUCZ_RESEND = Deno.env.get('RESEND_API_KEY') ?? '';
const NADAWCA = Deno.env.get('RESEND_FROM') ?? 'dwie głowy <onboarding@resend.dev>';
const ODPOWIEDZ = Deno.env.get('RESEND_REPLY_TO') ?? '';
const ADRES = Deno.env.get('PUBLICZNY_ADRES') ?? 'https://nordo-one.vercel.app';

/**
 * Przypomnienie o porzuconym koszyku jest **domyślnie wyłączone**.
 *
 * Powód jest prawny, nie techniczny: ta wiadomość zachęca do zakupu, więc
 * jest informacją handlową w rozumieniu art. 10 ustawy o świadczeniu usług
 * drogą elektroniczną, a on wymaga wcześniejszej zgody odbiorcy. Formularz
 * zamówienia zbiera zgodę na regulamin i przetwarzanie danych — nie na
 * marketing. Włączenie tego przełącznika bez zebranej zgody marketingowej
 * jest świadomą decyzją właściciela sklepu.
 */
const PRZYPOMINAJ = Deno.env.get('PRZYPOMNIENIE_KOSZYK') === '1';

/** Porównanie w stałym czasie — zwykłe === wycieka informację przez czas wykonania. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(
    header.split(',').map((kv) => kv.split('=', 2) as [string, string])
  );
  const timestamp = parts['t'];
  const signature = parts['v1'];
  if (!timestamp || !signature) return false;

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

  return timingSafeEqual(expected, signature);
}

/** Typ klienta z service_role — tylko tyle, ile tu używamy. */
type Admin = ReturnType<typeof createClient>;

/** Zamówienie razem z pozycjami. `null`, gdy zamówienia nie ma albo baza nie odpowiada. */
async function pobierzZamowienie(
  admin: Admin,
  orderId: string
): Promise<{ zam: Zamowienie; pozycje: PozycjaZamowienia[] } | null> {
  const [zamowienie, pozycje] = await Promise.all([
    admin
      .from('orders')
      .select(
        'order_number, email, subtotal_cents, discount_cents, shipping_cents, total_cents, coupon_code, shipping_address'
      )
      .eq('id', orderId)
      .maybeSingle(),
    admin
      .from('order_items')
      .select('name, qty, unit_price_cents, line_total_cents')
      .eq('order_id', orderId)
      .order('id'),
  ]);

  if (zamowienie.error || !zamowienie.data) {
    console.error('Nie udało się pobrać zamówienia', orderId, zamowienie.error);
    return null;
  }
  if (pozycje.error) {
    console.error('Nie udało się pobrać pozycji zamówienia', orderId, pozycje.error);
    return null;
  }

  return {
    zam: zamowienie.data as unknown as Zamowienie,
    pozycje: (pozycje.data ?? []) as unknown as PozycjaZamowienia[],
  };
}

/** Cofnięcie zajętego znacznika — żeby ponowienie Stripe'a mogło spróbować raz jeszcze. */
async function zwolnijZnacznik(admin: Admin, orderId: string, rodzaj: string): Promise<void> {
  const kolumna = rodzaj === 'potwierdzenie' ? 'mail_potwierdzenia_at' : 'mail_przypomnienia_at';
  const { error } = await admin.from('orders').update({ [kolumna]: null }).eq('id', orderId);
  if (error) console.error('Nie udało się zwolnić znacznika', kolumna, orderId, error);
}

/**
 * Wysyłka maila wokół zamówienia — zawsze przez zajęcie znacznika.
 *
 * Kolejność ma znaczenie: najpierw zajmujemy prawo do wysyłki (atomowo,
 * w bazie), potem wysyłamy. Odwrotna kolejność przy dwóch równoległych
 * webhookach dałaby dwa maile. Gdy wysyłka padnie, znacznik wraca do NULL,
 * żeby ponowienie od Stripe'a mogło spróbować jeszcze raz.
 *
 * Funkcja **nigdy nie rzuca**. Nieudany mail nie ma prawa cofnąć zapłaconego
 * zamówienia ani wprowadzić Stripe'a w pętlę ponowień — zamówienie jest
 * ważniejsze od wiadomości o nim.
 */
async function wyslijMailZamowienia(
  admin: Admin,
  orderId: string,
  rodzaj: 'potwierdzenie' | 'przypomnienie'
): Promise<void> {
  try {
    if (!KLUCZ_RESEND) {
      console.warn('RESEND_API_KEY pusty — pomijam', rodzaj, 'dla', orderId);
      return;
    }

    const { data: wolno, error } = await admin.rpc('zajmij_mail_zamowienia', {
      p_order_id: orderId,
      p_rodzaj: rodzaj,
    });
    if (error) {
      console.error('Nie udało się zająć znacznika wysyłki', orderId, error);
      return;
    }
    if (wolno !== true) return; // ktoś już wysłał

    const dane = await pobierzZamowienie(admin, orderId);
    if (!dane) {
      await zwolnijZnacznik(admin, orderId, rodzaj);
      return;
    }
    if (!dane.zam.email) {
      console.warn('Zamówienie bez adresu e-mail — pomijam', rodzaj, orderId);
      return;
    }

    const tresc =
      rodzaj === 'potwierdzenie'
        ? mailPotwierdzenia(dane.zam, dane.pozycje, ADRES)
        : mailPorzuconegoKoszyka(dane.zam, dane.pozycje, ADRES);

    const poszlo = await wyslij({
      klucz: KLUCZ_RESEND,
      nadawca: NADAWCA,
      odpowiedzDo: ODPOWIEDZ || undefined,
      do: dane.zam.email,
      temat: tresc.temat,
      html: tresc.html,
      tekst: tresc.tekst,
    });

    if (!poszlo) await zwolnijZnacznik(admin, orderId, rodzaj);
  } catch (e) {
    console.error('Błąd wysyłki maila', rodzaj, orderId, e);
  }
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

  const event = JSON.parse(payload);

  // service_role omija RLS — dlatego ten klucz nie ma prawa opuścić serwera
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        const orderId = session.metadata?.order_id ?? session.client_reference_id;
        if (!orderId) break;

        // mark_order_paid jest idempotentne — Stripe potrafi wysłać to samo zdarzenie kilka razy
        const { error } = await admin.rpc('mark_order_paid', {
          p_order_id: orderId,
          p_provider: 'stripe',
          p_payment_intent: session.payment_intent ?? session.id,
        });
        if (error) throw error;

        // Potwierdzenie zawarcia umowy na trwałym nośniku — art. 21 ustawy
        // o prawach konsumenta. Świadomie PO `mark_order_paid` i świadomie
        // bez `throw`: zamówienie jest już opłacone i stan bazy ma to
        // odzwierciedlać niezależnie od tego, czy poczta akurat działa.
        await wyslijMailZamowienia(admin, orderId, 'potwierdzenie');
        break;
      }

      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object;
        const orderId = session.metadata?.order_id ?? session.client_reference_id;
        if (!orderId) break;

        // Pozycje trzeba odczytać PRZED anulowaniem: `cancel_order` zwraca
        // towar na magazyn, ale wiersze `order_items` zostają — czytamy je
        // jednak wcześniej, żeby treść maila nie zależała od tego, co
        // anulowanie robi ze stanem zamówienia.
        const doPrzypomnienia =
          PRZYPOMINAJ && event.type === 'checkout.session.expired'
            ? await pobierzZamowienie(admin, orderId)
            : null;

        // Anulowanie zwraca zarezerwowany towar na magazyn
        const { error } = await admin.rpc('cancel_order', { p_order_id: orderId });
        if (error) throw error;

        // Przypomnienie idzie tylko przy wygaśnięciu sesji, nie przy odrzuconej
        // płatności: „nie zdążyłeś zapłacić" i „bank odrzucił kartę" to dwie
        // różne sytuacje, a ta druga nie potrzebuje zachęty do zakupu.
        if (doPrzypomnienia && doPrzypomnienia.zam.email) {
          await wyslijMailZamowienia(admin, orderId, 'przypomnienie');
        }
        break;
      }

      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    // 500 każe Stripe'owi ponowić — lepsze niż ciche zgubienie płatności
    console.error('Błąd obsługi webhooka:', e);
    return new Response('Błąd obsługi zdarzenia', { status: 500 });
  }
});
