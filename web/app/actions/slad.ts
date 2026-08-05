'use server';

import { createClient } from '@/utils/supabase/server';

export type Zdarzenie =
  | 'wejscie_na_produkt'
  | 'szukanie'
  | 'dodanie_do_koszyka'
  | 'usuniecie_z_koszyka'
  | 'wejscie_do_kasy'
  | 'zamowienie_zlozone';

/**
 * Zapis zdarzenia w sklepie.
 *
 * Świadomie nie zwraca błędu do interfejsu i nie blokuje niczego: gdyby zapis
 * śladu potrafił przerwać dodanie do koszyka, statystyka kosztowałaby
 * sprzedaż. Zdarzenie jest miłe, zamówienie jest ważne.
 *
 * Identyfikator konta bierzemy z sesji po stronie serwera, a nie z tego, co
 * przyśle przeglądarka — polityka i tak by tego nie przepuściła, ale nie ma
 * powodu wysyłać czegoś, co można ustalić na miejscu.
 */
export async function zapiszZdarzenie(
  event: Zdarzenie,
  dane: { productId?: string; detail?: string; qty?: number } = {}
): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from('shop_events').insert({
      event,
      product_id: dane.productId ?? null,
      // Fraza przycięta: do policzenia, czego ludzie szukają, wystarczy
      // początek, a długi ciąg to zwykle wklejka, nie zapytanie.
      detail: dane.detail?.slice(0, 120) ?? null,
      qty: dane.qty ?? null,
      user_id: user?.id ?? null,
    });
  } catch {
    /* ślad nie ma prawa przeszkodzić w zakupie */
  }
}
