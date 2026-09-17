import 'server-only';

import { redirect } from 'next/navigation';
import { getSessionUser } from './queries';
import type { SessionUser } from './types';

/**
 * Kto wchodzi do zaplecza i jak głęboko.
 *
 * Zaplecze jest jedno — pod `/panel` — ale nie jest płaskie. Trzy poziomy
 * biorą się z tego, czym te role naprawdę się zajmują, a nie z hierarchii:
 *
 *   zaplecze    praca przy regale: stany, zwroty, skaner, kolejka pakowania
 *   biuro       kwoty i decyzje: pulpit, zamówienia, wysyłki, katalog, finanse
 *   właściciel  zatrudnianie i audyt: ludzie, dziennik
 *
 * `staff` siedzi wyłącznie na pierwszym poziomie i to jest cały powód, dla
 * którego te trzy stałe istnieją. Gdyby zaplecze miało jedną bramkę, scalenie
 * magazynu z panelem odcięłoby magazyniera od jego własnego narzędzia —
 * a to on pakuje paczki i liczy regały.
 *
 * Jak wszędzie w tym projekcie: przekierowanie to wygoda, nie zapora.
 * Prawdziwej pilnują polityki RLS i sprawdzenia `authorize()` w funkcjach —
 * rola jedzie claimem w tokenie, a nie tym, że ktoś zna adres.
 */
const ZAPLECZE = ['owner', 'manager', 'staff'];

const BIURO = ['owner', 'manager'];

/** Sam właściciel: role i dziennik. Zarządca prowadzi sklep, ale nie zatrudnia. */
const WLASCICIEL = ['owner'];

/** Wspólny początek każdej bramki: bez sesji nie ma o czym rozmawiać. */
async function zalogowany(sciezka: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/logowanie?powrot=${encodeURIComponent(sciezka)}`);
  return user;
}

/** Praca przy regale. Wpuszcza też `staff` — to jego jedyne miejsce w serwisie. */
export async function wymagajZaplecza(sciezka: string): Promise<SessionUser> {
  const user = await zalogowany(sciezka);
  if (!ZAPLECZE.includes(user.rawRole)) redirect('/konto');
  return user;
}

/**
 * Biurko: kwoty, decyzje, katalog.
 *
 * `staff` ląduje na kolejce pakowania, nie na koncie klienta. Odesłanie go
 * do sklepu wyglądałoby jak utrata uprawnień, a on ma tu robotę — tylko na
 * innym ekranie.
 */
export async function wymagajBiura(sciezka: string): Promise<SessionUser> {
  const user = await zalogowany(sciezka);
  if (!BIURO.includes(user.rawRole)) redirect('/panel/kolejka');
  return user;
}

export async function wymagajWlasciciela(sciezka: string): Promise<SessionUser> {
  const user = await zalogowany(sciezka);
  if (!WLASCICIEL.includes(user.rawRole)) redirect('/panel');
  return user;
}
