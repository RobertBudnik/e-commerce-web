'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';

/**
 * Akcje panelu właściciela.
 *
 * Wszystkie idą przez funkcje SQL, nie przez zapis do tabel. Powód jest ten
 * sam za każdym razem: granice — których stanów wolno użyć, czy paczka nie
 * jest już nadana, czy to nie ostatni właściciel — dają się wyrazić tylko
 * w funkcji. Polityka RLS odpowiada na pytanie „czy wolno pisać", a nie
 * „czy ten konkretny zapis ma sens".
 *
 * Komunikat błędu z bazy wraca do interfejsu dosłownie. „Zamówienie jest
 * anulowane — towar wrócił na magazyn" mówi właścicielowi wszystko;
 * „wystąpił błąd" kończy się telefonem.
 */

export type Wynik<T = null> = { ok: true; dane: T } | { ok: false; blad: string };

/** Odświeża wszystkie widoki, które pokazują tę samą liczbę. */
function odswiezZamowienia() {
  revalidatePath('/panel');
  revalidatePath('/panel/zamowienia');
  revalidatePath('/panel/wysylki');
  revalidatePath('/panel/kolejka');
}

export async function ustawStanAction(
  zamowienieId: string,
  stan: 'nowe' | 'spakowane'
): Promise<Wynik<string>> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('ustaw_stan_zamowienia', {
    p_zamowienie: zamowienieId,
    p_stan: stan,
  });

  if (error) return { ok: false, blad: error.message };

  odswiezZamowienia();
  return { ok: true, dane: String(data) };
}

/**
 * Nadanie paczki. Idempotencji pilnuje baza — powtórka oddaje numer, który
 * już jest, zamiast tworzyć drugą przesyłkę. Przy podpiętym przewoźniku to
 * jedyna obrona przed podwójnym nadaniem po timeoucie, więc interfejs nie
 * próbuje jej dublować własnym zamkiem na przycisku.
 */
export async function nadajPaczkeAction(
  zamowienieId: string,
  numer: string,
  przewoznik: 'inpost' | 'inny',
  punktOdbioru: string | null
): Promise<Wynik<string>> {
  if (!numer.trim()) return { ok: false, blad: 'Numer przesyłki jest wymagany.' };

  const supabase = await createClient();

  const { data, error } = await supabase.rpc('nadaj_paczke', {
    p_zamowienie: zamowienieId,
    p_numer: numer.trim(),
    p_przewoznik: przewoznik,
    p_punkt: punktOdbioru?.trim() || null,
    p_zewnetrzny_id: null,
  });

  if (error) return { ok: false, blad: error.message };

  odswiezZamowienia();
  return { ok: true, dane: String(data) };
}

/**
 * Potwierdzenie doręczenia. Docelowo stawia je odczyt od przewoźnika — ta
 * droga jest dla sytuacji, w której przewoźnik milczy, a klient potwierdza
 * odbiór przez telefon. Baza zapisuje źródło, więc później widać, czy stan
 * przyszedł z sieci, czy postawił go człowiek.
 */
export async function potwierdzDoreczenieAction(zamowienieId: string): Promise<Wynik<string>> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('potwierdz_doreczenie', {
    p_zamowienie: zamowienieId,
    p_zrodlo: 'obsługa',
  });

  if (error) return { ok: false, blad: error.message };

  odswiezZamowienia();
  return { ok: true, dane: String(data) };
}

/**
 * Zmiana roli. Rola jedzie claimem w tokenie, więc osoba, której ją zmieniono,
 * zobaczy skutek dopiero po odświeżeniu sesji — interfejs ma to powiedzieć
 * wprost, bo cicha zmiana, która przez godzinę nie działa, wygląda na awarię.
 */
export async function nadajRoleAction(
  userId: string,
  rola: 'owner' | 'manager' | 'staff' | 'customer'
): Promise<Wynik<string>> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('nadaj_role', {
    p_user: userId,
    p_rola: rola,
  });

  if (error) return { ok: false, blad: error.message };

  revalidatePath('/panel/ludzie');
  revalidatePath('/panel/dziennik');
  return { ok: true, dane: String(data) };
}

/**
 * Koszt zakupu produktu. Osobna tabela, nie kolumna w katalogu — `products`
 * czyta każdy gość, a marża nie jest informacją dla kupującego.
 */
export async function zapiszKosztAction(
  produktId: string,
  kosztZlote: number
): Promise<Wynik<number>> {
  if (!Number.isFinite(kosztZlote) || kosztZlote < 0) {
    return { ok: false, blad: 'Koszt musi być liczbą nieujemną.' };
  }

  const supabase = await createClient();
  const grosze = Math.round(kosztZlote * 100);

  const { error } = await supabase
    .from('koszty_produktow')
    .upsert({ product_id: produktId, koszt_cents: grosze, updated_at: new Date().toISOString() });

  if (error) return { ok: false, blad: error.message };

  revalidatePath('/panel/katalog');
  revalidatePath('/panel/finanse');
  return { ok: true, dane: grosze / 100 };
}
