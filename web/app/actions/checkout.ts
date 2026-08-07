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
/**
 * Format polskiego kodu pocztowego. Adres z literówką w kodzie nie zatrzymuje
 * zamówienia w bazie — zatrzymuje paczkę u kuriera, czyli tydzień później
 * i drożej. Reszta pól zostaje bez wzorca: nazwiska i nazwy ulic mają
 * za dużo prawidłowych kształtów, żeby je zgadywać wyrażeniem regularnym.
 */
const KOD_POCZTOWY = /^\d{2}-\d{3}$/;

export async function checkoutAction(input: CheckoutInput): Promise<CheckoutResult> {
  if (!input.lines.length) return { ok: false, error: 'Koszyk jest pusty.' };

  // Formularz ma `required`, ale to atrybut przeglądarki. Akcja serwerowa
  // jest wywoływalna bez formularza, więc puste pole sprawdzamy tutaj.
  const zip = input.zip.trim();
  if (!input.name.trim()) return { ok: false, error: 'Podaj imię i nazwisko odbiorcy.' };
  if (!input.street.trim()) return { ok: false, error: 'Podaj ulicę i numer.' };
  if (!input.city.trim()) return { ok: false, error: 'Podaj miasto.' };
  if (!KOD_POCZTOWY.test(zip)) return { ok: false, error: 'Kod pocztowy w formacie 00-001.' };

  const supabase = await createClient();

  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: {
      items: input.lines.map((l) => ({ product_id: l.id, qty: l.qty })),
      email: input.email,
      phone: input.phone || null,
      coupon: input.coupon,
      shipping_address: {
        recipient: input.name.trim(),
        street: input.street.trim(),
        postal_code: zip,
        city: input.city.trim(),
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
