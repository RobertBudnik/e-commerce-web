'use server';

import { createClient } from '@/utils/supabase/server';
import { checkoutMessage } from '@/lib/checkout-message';
import type { CartLine } from '@/lib/types';

export type CheckoutInput = {
  lines: CartLine[];
  coupon: string | null;
  name: string;
  email: string;
  phone: string;
  street: string;
  zip: string;
  city: string;
};

export type CheckoutResult =
  | { ok: true; orderNumber: string; checkoutUrl: string | null }
  | { ok: false; error: string };

/**
 * Składa zamówienie przez Edge Function `create-checkout`.
 *
 * Przeglądarka wysyła wyłącznie identyfikatory produktów i ilości — ceny,
 * rabat, dostawę i rezerwację towaru liczy `create_order()` w bazie.
 * Wywołanie idzie z serwera, więc token sesji nie musi opuszczać ciasteczka.
 */
export async function checkoutAction(input: CheckoutInput): Promise<CheckoutResult> {
  if (!input.lines.length) return { ok: false, error: 'Koszyk jest pusty.' };

  const supabase = await createClient();

  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: {
      items: input.lines.map((l) => ({ product_id: l.id, qty: l.qty })),
      email: input.email,
      phone: input.phone || null,
      coupon: input.coupon,
      shipping_address: {
        recipient: input.name,
        street: input.street,
        postal_code: input.zip,
        city: input.city,
        country: 'PL',
        phone: input.phone || null,
      },
    },
  });

  if (error) {
    // FunctionsHttpError chowa treść odpowiedzi w `context` — bez tego
    // do klienta dociera samo „non-2xx status code" zamiast powodu odmowy.
    const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
    const body = await context?.json?.().catch(() => null);
    return { ok: false, error: checkoutMessage(body?.error ?? error.message) };
  }

  if (data?.error) return { ok: false, error: checkoutMessage(data.error) };
  if (!data?.order_number) return { ok: false, error: 'Serwer nie zwrócił numeru zamówienia.' };

  return { ok: true, orderNumber: data.order_number, checkoutUrl: data.checkout_url ?? null };
}
