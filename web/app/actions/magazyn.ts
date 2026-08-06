'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { POWODY_KOREKTY, type PowodKorekty } from '@/lib/magazyn-powody';

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

/* ==========================================================================
   Aplikacja zarządu
   ========================================================================== */

export type KorektaWynik =
  | { ok: true; stan: number }
  | { ok: false; blad: string };

/**
 * Korekta stanu z aplikacji.
 *
 * Idzie przez `koryguj_stan()`, nie przez `adjust_stock()`, bo tamta ścina
 * stan do zera po cichu — próba zdjęcia pięciu sztuk z trzech kończyła się
 * zerem i komunikatem „zapisano". Tutaj baza odmawia, a interfejs pokazuje
 * powód przy liczbie.
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

  revalidatePath('/magazyn');
  revalidatePath('/magazyn/stany');
  revalidatePath('/sklep');

  return { ok: true, stan: Number(data) };
}

export type PrzesylkaWynik =
  | { ok: true; numer: string }
  | { ok: false; blad: string };

/**
 * Nadanie przesyłki. Numer listu i zmiana stanu idą jednym wywołaniem —
 * gdyby to były dwa zapisy, drugi mógłby nie dojść i paczka wyjechałaby
 * bez numeru albo numer wisiałby przy zamówieniu, które stoi w magazynie.
 */
export async function nadajPrzesylkeAction(
  zamowienieId: string,
  numer: string
): Promise<PrzesylkaWynik> {
  const czysty = numer.trim();
  if (!czysty) return { ok: false, blad: 'Podaj numer przesyłki.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('nadaj_przesylke', {
    p_zamowienie: zamowienieId,
    p_numer: czysty,
  });

  if (error) return { ok: false, blad: error.message };

  revalidatePath('/magazyn');
  revalidatePath('/magazyn/zamowienia');

  return { ok: true, numer: String(data) };
}

export type StanZamowieniaWynik =
  | { ok: true; stan: string }
  | { ok: false; blad: string };

/** Zmiana stanu zamówienia w kolejce. Stan „wysłane" nadaje wyłącznie przesyłka. */
export async function ustawStanZamowieniaAction(
  zamowienieId: string,
  stan: 'nowe' | 'spakowane'
): Promise<StanZamowieniaWynik> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('ustaw_stan_zamowienia', {
    p_zamowienie: zamowienieId,
    p_stan: stan,
  });

  if (error) return { ok: false, blad: error.message };

  revalidatePath('/magazyn');
  revalidatePath('/magazyn/zamowienia');

  return { ok: true, stan: String(data) };
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

  revalidatePath('/magazyn');
  revalidatePath('/magazyn/zwroty');
  revalidatePath('/magazyn/stany');
  revalidatePath('/sklep');

  return { ok: true, sztuk: Number(data) };
}
