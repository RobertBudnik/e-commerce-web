import 'server-only';

import { redirect } from 'next/navigation';
import { getSessionUser } from './queries';
import type { SessionUser } from './types';

/**
 * Kto wchodzi do panelu właściciela.
 *
 * `staff` zostaje przed drzwiami — nie z nieufności, tylko dlatego, że nie ma
 * tu nic dla niego: jego narzędziem jest aplikacja magazynu, dopasowana do
 * telefonu i do pracy w ruchu. Panel to biurko, kwoty i decyzje.
 *
 * Jak wszędzie w tym projekcie: przekierowanie to wygoda, nie zapora.
 * Prawdziwej pilnują polityki RLS i sprawdzenia `authorize()` w funkcjach —
 * rola jedzie claimem w tokenie, a nie tym, że ktoś zna adres.
 */
const PANEL = ['owner', 'manager'];

/** Sam właściciel: role i dziennik. Zarządca prowadzi sklep, ale nie zatrudnia. */
const WLASCICIEL = ['owner'];

export async function wymagajPanelu(sciezka: string): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) redirect(`/logowanie?powrot=${encodeURIComponent(sciezka)}`);
  if (!PANEL.includes(user.rawRole)) redirect('/konto');

  return user;
}

export async function wymagajWlasciciela(sciezka: string): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) redirect(`/logowanie?powrot=${encodeURIComponent(sciezka)}`);
  if (!WLASCICIEL.includes(user.rawRole)) redirect('/panel');

  return user;
}
