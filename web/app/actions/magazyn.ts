'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';

export type MagazynResult = { ok: true; stock: number } | { ok: false; error: string };

/**
 * Korekta stanu magazynowego.
 *
 * Idzie przez `adjust_stock()`, a nie przez UPDATE na products, z dwóch
 * powodów. Funkcja sprawdza uprawnienie `inventory.write` po swojej stronie,
 * więc odmowa przychodzi z bazy, nie z interfejsu. I zapisuje ruch
 * w `inventory_movements` razem z powodem — bez tego stan po tygodniu jest
 * liczbą, której nikt nie umie wytłumaczyć.
 *
 * Delta, nie wartość docelowa: dwie osoby liczące ten sam regał wpiszą
 * „+3" i „+2", a nie dwie różne sumy, z których jedna nadpisze drugą.
 */
export async function adjustStockAction(
  productId: string,
  delta: number,
  reason: string
): Promise<MagazynResult> {
  if (!Number.isInteger(delta) || delta === 0) {
    return { ok: false, error: 'Korekta musi być liczbą całkowitą różną od zera.' };
  }
  if (!reason.trim()) {
    return { ok: false, error: 'Podaj powód korekty.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('adjust_stock', {
    p_product_id: productId,
    p_delta: delta,
    p_reason: reason.trim(),
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/magazyn/stany');
  revalidatePath('/sklep');

  return { ok: true, stock: typeof data === 'number' ? data : Number(data) };
}
