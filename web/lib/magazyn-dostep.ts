import 'server-only';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionUser } from './queries';
import type { SessionUser } from './types';

/**
 * Role wpuszczane do magazynu.
 *
 * `staff` zostaje razem z zarządem świadomie: to on pakuje paczki i liczy
 * regały, więc odcięcie go zamknęłoby narzędzie przed jedynym człowiekiem,
 * który go używa codziennie. Zakres tego, co widzi, i tak wycina RLS —
 * kwot ani cudzych zamówień baza mu nie odda, choćby wpisał adres z palca.
 */
const ZAPLECZE = ['owner', 'manager', 'staff'];

/**
 * Wpuszcza albo odsyła. Zwraca zalogowanego, żeby ekran nie pytał o niego
 * drugi raz — `getSessionUser` jest opakowane w `cache`, ale jawny zwrot
 * czyta się lepiej niż poleganie na tym z boku.
 *
 * Przekierowanie to wygoda, nie zapora. Prawdziwej pilnują polityki RLS
 * i sprawdzenia `authorize()` wewnątrz funkcji zapisujących: rola jedzie
 * claimem w tokenie, a nie tym, że ktoś zna adres.
 */
export async function wymagajZaplecza(sciezka: string): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) redirect(`/logowanie?powrot=${encodeURIComponent(sciezka)}`);

  if (!ZAPLECZE.includes(user.rawRole)) {
    // W przeglądarce ciche odesłanie na konto jest w porządku: klient trafił
    // tu wpisując adres z palca albo klikając stary link, a konto to miejsce,
    // gdzie faktycznie ma co robić.
    //
    // W aplikacji magazynowej to samo odesłanie kłamie. Ktoś pobrał program
    // nazwany „magazyn", zalogował się swoim kontem i wylądował w sklepie bez
    // jednego słowa wyjaśnienia — wygląda to na awarię, nie na brak
    // uprawnień. Dlatego powłoka dostaje ekran, który mówi wprost, co się
    // stało i co z tym zrobić.
    const naglowki = await headers();
    const wPowloce = (naglowki.get('user-agent') ?? '').includes('NordoApp');

    if (wPowloce) redirect('/magazyn/brak-dostepu');
    redirect('/konto');
  }

  return user;
}
