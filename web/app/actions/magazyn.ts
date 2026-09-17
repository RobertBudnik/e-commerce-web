'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { POWODY_KOREKTY, type PowodKorekty } from '@/lib/magazyn-powody';

export type KorektaWynik =
  | { ok: true; stan: number }
  | { ok: false; blad: string };

/**
 * Korekta stanu z aplikacji.
 *
 * Idzie przez `koryguj_stan()`, która nie ścina stanu do zera po cichu —
 * poprzedniczka (`adjust_stock`, skasowana razem ze starym widokiem stanów)
 * na próbie zdjęcia pięciu sztuk z trzech kończyła zerem i komunikatem
 * „zapisano". Tutaj baza odmawia, a interfejs pokazuje powód przy liczbie.
 *
 * `klucz` jest wystawiany przez przeglądarkę raz na otwarty ekran korekty.
 * Drugie dotknięcie przycisku wysyła ten sam klucz, a baza oddaje stan
 * bieżący zamiast dokładać drugi ruch.
 */
export async function korygujStanAction(
  produktId: string,
  delta: number,
  powod: string,
  notatka: string,
  klucz: string
): Promise<KorektaWynik> {
  if (!Number.isInteger(delta) || delta === 0) {
    return { ok: false, blad: 'Korekta musi być liczbą całkowitą różną od zera.' };
  }
  if (!POWODY_KOREKTY.includes(powod as PowodKorekty)) {
    return { ok: false, blad: 'Wybierz powód korekty.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('koryguj_stan', {
    p_produkt: produktId,
    p_delta: delta,
    p_powod: powod,
    p_notatka: notatka.trim() || null,
    p_klucz: klucz || null,
  });

  if (error) return { ok: false, blad: error.message };

  revalidatePath('/panel/stany');
  revalidatePath('/panel');
  revalidatePath('/sklep');

  return { ok: true, stan: Number(data) };
}

export type ZwrotWynik = { ok: true; sztuk: number } | { ok: false; blad: string };

/**
 * Przyjęcie zwrotu w magazynie.
 *
 * Sztuki wracają na stan przez `inventory_movements`, tym samym kanałem co
 * korekta ręczna — historia magazynu tłumaczy każdą sztukę niezależnie od
 * tego, którędy przyszła. Powtórne dotknięcie oddaje zero i nie dubluje
 * ruchu, bo funkcja patrzy na stan zwrotu, nie na klucz żądania.
 */
export async function przyjmijZwrotAction(zwrotId: string): Promise<ZwrotWynik> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('przyjmij_zwrot', { p_zwrot: zwrotId });

  if (error) return { ok: false, blad: error.message };

  revalidatePath('/panel/zwroty');
  revalidatePath('/panel/stany');
  revalidatePath('/panel');
  revalidatePath('/sklep');

  return { ok: true, sztuk: Number(data) };
}
