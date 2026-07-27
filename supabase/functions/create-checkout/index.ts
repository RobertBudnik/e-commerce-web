/**
 * POST /functions/v1/create-checkout
 *
 * Tworzy zamówienie w bazie (ceny i stany liczy Postgres) i sesję płatności
 * u operatora. Przeglądarka przysyła wyłącznie identyfikatory produktów i ilości.
 *
 * Wejście:  { items: [{ product_id, qty }], email, phone?, shipping_address?, coupon? }
 * Wyjście:  { order_id, order_number, total_cents, checkout_url }
 *
 * Zmienne środowiskowe (supabase/.env.local lokalnie, sekrety projektu na produkcji):
 *   SITE_URL             — adres frontendu; lokalnie http://127.0.0.1:8000, potem domena
 *   STRIPE_SECRET_KEY    — klucz operatora; pusty = tryb bez płatności (do pracy lokalnej)
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY — wstrzykiwane przez platformę
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SITE_URL = Deno.env.get('SITE_URL') ?? 'http://127.0.0.1:8000';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Metoda niedozwolona' }, 405);

  try {
    const { items, email, phone, shipping_address, coupon } = await req.json();

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

    const { data: order, error } = await supabase.rpc('create_order', {
      p_items: items.map((i: { product_id: string; qty: number }) => ({
        product_id: i.product_id,
        qty: Number(i.qty),
      })),
      p_email: email,
      p_phone: phone ?? null,
      p_shipping_address: shipping_address ?? null,
      p_coupon: coupon ?? null,
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
    const params = new URLSearchParams({
      mode: 'payment',
      success_url: `${SITE_URL}/order-confirmed.html?order=${order.order_number}`,
      cancel_url: `${SITE_URL}/cart.html`,
      customer_email: order.email,
      client_reference_id: order.id,
      'metadata[order_id]': order.id,
      'line_items[0][price_data][currency]': 'pln',
      'line_items[0][price_data][unit_amount]': String(order.total_cents),
      'line_items[0][price_data][product_data][name]': `Zamówienie ${order.order_number}`,
      'line_items[0][quantity]': '1',
    });

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
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
