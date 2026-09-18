import 'server-only';

import { headers } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

/**
 * Druga warstwa limitów wysyłki — po adresie IP i po adresie e-mail.
 *
 * Supabase liczy własny limit wyłącznie po adresie IP. To zostawia otwartą
 * drugą drogę: jeden napastnik, wiele adresów IP, jedna cudza skrzynka.
 * Ofiara dostaje kilkadziesiąt wiadomości „potwierdź konto", a skargi zbiera
 * nasza domena. Stąd licznik także po adresie, trzymany w bazie
 * (`limity_poczty`), bo serwer jest bezstanowy i licznik w pamięci procesu
 * nie przeżyłby jednego żądania.
 *
 * Adres nie trafia do tabeli — liczy się skrót SHA-256 po stronie bazy.
 */

export type RodzajWysylki = 'rejestracja' | 'reset' | 'magic' | 'ponowna';

/** Ile wysyłek w jakim oknie. Osobno dla adresu IP i dla skrzynki. */
const OKNA: Record<RodzajWysylki, { ip: [number, number]; adres: [number, number] }> = {
  // [ile, sekund]
  rejestracja: { ip: [10, 3600], adres: [3, 3600] },
  reset: { ip: [10, 3600], adres: [3, 3600] },
  magic: { ip: [10, 3600], adres: [5, 3600] },
  // Ponowna wysyłka jest częstsza z natury — ktoś czeka na maila i klika.
  ponowna: { ip: [15, 3600], adres: [5, 3600] },
};

/**
 * Adres żądającego zza odwrotnego pośrednika.
 *
 * Na Vercelu prawdziwy adres siedzi w `x-forwarded-for`, a pierwszy wpis to
 * klient. Bierzemy tylko pierwszy: dalsze pozycje dopisują pośrednicy i da się
 * je podrobić nagłówkiem w żądaniu.
 */
async function adresZadajacego(): Promise<string> {
  const naglowki = await headers();
  const przekazany = naglowki.get('x-forwarded-for');
  if (przekazany) return przekazany.split(',')[0]!.trim();
  return naglowki.get('x-real-ip') ?? 'nieznany';
}

/**
 * Czy wolno wysłać. Zapisuje próbę tylko wtedy, gdy wolno — inaczej odbita
 * próba przedłużałaby blokadę bez końca.
 *
 * Gdy baza nie odpowie, przepuszczamy. To świadomy wybór: limit chroni przed
 * nadużyciem, ale awaria licznika nie może zamykać rejestracji wszystkim.
 */
export async function wolnoWyslac(email: string, rodzaj: RodzajWysylki): Promise<boolean> {
  const supabase = await createClient();
  const okno = OKNA[rodzaj];

  const { data: skrot, error: bladSkrotu } = await supabase.rpc('skrot_adresu', {
    p_email: email,
  });
  if (bladSkrotu) return true;

  const ip = await adresZadajacego();

  const [poIp, poAdresie] = await Promise.all([
    supabase.rpc('limit_poczty', {
      p_klucz: `ip:${ip}`,
      p_rodzaj: rodzaj,
      p_ile: okno.ip[0],
      p_sekundy: okno.ip[1],
    }),
    supabase.rpc('limit_poczty', {
      p_klucz: `email:${skrot}`,
      p_rodzaj: rodzaj,
      p_ile: okno.adres[0],
      p_sekundy: okno.adres[1],
    }),
  ]);

  if (poIp.error || poAdresie.error) return true;

  return poIp.data === true && poAdresie.data === true;
}
