'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { toOrder } from '@/lib/mappers';
import type { OrderRow } from '@/lib/rows';
import type { Order, OrderStatus } from '@/lib/types';

/**
 * Operacje panelu konta. Wszystkie idą przez serwer, a zakres i tak wycina
 * RLS — front tylko nie proponuje tego, co i tak dostanie odmowę.
 */

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Dane kontaktowe do `profiles`, adres dostawy do `addresses`. */
export async function saveProfileAction(formData: FormData): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sesja wygasła — zaloguj się ponownie.' };

  const name = String(formData.get('name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const newsletter = formData.get('newsletter') === 'on';
  const street = String(formData.get('street') ?? '').trim();
  const zip = String(formData.get('zip') ?? '').trim();
  const city = String(formData.get('city') ?? '').trim();

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: name, phone, newsletter })
    .eq('id', user.id);

  if (profileError) return { ok: false, error: profileError.message };

  if (street || zip || city) {
    // Jeden adres domyślny na konto — kolejny zapis nadpisuje istniejący wiersz
    const { data: current } = await supabase
      .from('addresses')
      .select('id')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .limit(1);

    const row = {
      user_id: user.id,
      recipient: name || user.email,
      street,
      postal_code: zip,
      city,
      phone: phone || null,
      is_default: true,
    };

    const { error: addressError } = current?.[0]
      ? await supabase.from('addresses').update(row).eq('id', current[0].id)
      : await supabase.from('addresses').insert(row);

    if (addressError) return { ok: false, error: addressError.message };
  }

  revalidatePath('/konto');
  revalidatePath('/koszyk');
  return { ok: true, data: null };
}

/**
 * Zmiana statusu zamówienia — przez `ustaw_stan_zamowienia()`, nie UPDATE-em
 * na tabeli.
 *
 * UPDATE przechodził przez politykę „zamówienia: obsługa" i na tym kończyła się
 * kontrola: wyzwalacz bronił wyłącznie stanu „anulowane", więc tą drogą dawało
 * się postawić „wysłane" bez numeru listu i „dostarczone" z ręki, mijając
 * wszystkie granice, dla których powstała migracja 20260807160000. Funkcja
 * przepuszcza dwa stany samej kolejki i zapisuje zmianę w dzienniku.
 *
 * Wysyłkę nadaje panel wysyłek (razem z listem przewozowym), a „dostarczone"
 * przychodzi od przewoźnika — dlatego nie ma tu dla nich ścieżki.
 */
export async function setOrderStatusAction(
  orderId: string,
  status: OrderStatus
): Promise<ActionResult<Order>> {
  const supabase = await createClient();

  const { error } = await supabase.rpc('ustaw_stan_zamowienia', {
    p_zamowienie: orderId,
    p_stan: status,
  });

  if (error) return { ok: false, error: error.message };

  const { data } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .maybeSingle();

  if (!data) return { ok: false, error: 'Nie udało się odczytać zamówienia po zmianie.' };

  revalidatePath('/konto');
  revalidatePath('/panel/zamowienia');
  return { ok: true, data: toOrder(data as OrderRow) };
}

/**
 * Anulowanie idzie przez funkcję, nie przez UPDATE, bo poza statusem musi
 * wrócić towar na magazyn. Ta sama funkcja pozwala klientowi wycofać własne
 * zamówienie — sprawdza to sama, po `auth.uid()`.
 */
export async function cancelOrderAction(orderId: string): Promise<ActionResult<Order>> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('cancel_order', { p_order_id: orderId });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/konto');
  return { ok: true, data: toOrder((Array.isArray(data) ? data[0] : data) as OrderRow) };
}
