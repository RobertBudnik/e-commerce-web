'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { toOrder } from '@/lib/mappers';
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
 * Zmiana statusu zamówienia. Wpuszcza wyłącznie polityka „zamówienia: obsługa"
 * (uprawnienie `orders.write`) — klient dostanie zero wierszy, nie błąd.
 */
export async function setOrderStatusAction(
  orderId: string,
  status: OrderStatus
): Promise<ActionResult<Order>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select('*, order_items(*)');

  if (error) return { ok: false, error: error.message };
  if (!data.length) return { ok: false, error: 'Brak uprawnień do zmiany statusu tego zamówienia.' };

  revalidatePath('/konto');
  return { ok: true, data: toOrder(data[0]) };
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
  return { ok: true, data: toOrder(Array.isArray(data) ? data[0] : data) };
}
