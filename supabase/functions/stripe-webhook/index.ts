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
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const TOLERANCE_SECONDS = 300;

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
        break;
      }

      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object;
        const orderId = session.metadata?.order_id ?? session.client_reference_id;
        if (!orderId) break;

        // Anulowanie zwraca zarezerwowany towar na magazyn
        const { error } = await admin.rpc('cancel_order', { p_order_id: orderId });
        if (error) throw error;
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
