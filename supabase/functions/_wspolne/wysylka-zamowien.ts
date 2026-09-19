/**
 * Wysyłka maili wokół zamówienia.
 *
 * Mieszkało to w `stripe-webhook`, dopóki wysyłka działa się w środku obsługi
 * webhooka. Odkąd robi to kolejka (`zadania`), moduł jest wspólny: webhook
 * tylko odnotowuje płatność, a wysyłką zajmuje się pracownik kolejki.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { wyslij } from './poczta.ts';
import {
  mailPorzuconegoKoszyka,
  mailPotwierdzenia,
  type PozycjaZamowienia,
  type Zamowienie,
} from './maile-zamowien.ts';

const KLUCZ_RESEND = Deno.env.get('RESEND_API_KEY') ?? '';
const NADAWCA = Deno.env.get('RESEND_FROM') ?? 'dwie głowy <onboarding@resend.dev>';
const ODPOWIEDZ = Deno.env.get('RESEND_REPLY_TO') ?? '';
const ADRES = Deno.env.get('PUBLICZNY_ADRES') ?? 'https://nordo-one.vercel.app';

export type Admin = ReturnType<typeof createClient>;

/** Klient z prawami service_role. Ten klucz nie ma prawa opuścić serwera. */
export function klientAdmina(): Admin {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

/** Zamówienie razem z pozycjami. `null`, gdy go nie ma albo baza nie odpowiada. */
export async function pobierzZamowienie(
  admin: Admin,
  orderId: string
): Promise<{ zam: Zamowienie; pozycje: PozycjaZamowienia[] } | null> {
  const [zamowienie, pozycje] = await Promise.all([
    admin
      .from('orders')
      .select(
        'order_number, email, subtotal_cents, discount_cents, shipping_cents, total_cents, coupon_code, shipping_address'
      )
      .eq('id', orderId)
      .maybeSingle(),
    admin
      .from('order_items')
      .select('name, qty, unit_price_cents, line_total_cents')
      .eq('order_id', orderId)
      .order('id'),
  ]);

  if (zamowienie.error || !zamowienie.data) {
    console.error('Nie udało się pobrać zamówienia', orderId, zamowienie.error);
    return null;
  }
  if (pozycje.error) {
    console.error('Nie udało się pobrać pozycji zamówienia', orderId, pozycje.error);
    return null;
  }

  return {
    zam: zamowienie.data as unknown as Zamowienie,
    pozycje: (pozycje.data ?? []) as unknown as PozycjaZamowienia[],
  };
}

/** Cofnięcie zajętego znacznika, żeby kolejne podejście mogło spróbować. */
async function zwolnijZnacznik(admin: Admin, orderId: string, rodzaj: string): Promise<void> {
  const kolumna = rodzaj === 'potwierdzenie' ? 'mail_potwierdzenia_at' : 'mail_przypomnienia_at';
  const { error } = await admin.from('orders').update({ [kolumna]: null }).eq('id', orderId);
  if (error) console.error('Nie udało się zwolnić znacznika', kolumna, orderId, error);
}

/**
 * Wysyłka maila wokół zamówienia.
 *
 * Druga warstwa idempotencji. Pierwsza (unikalny `klucz` w tabeli `zadania`)
 * pilnuje, żeby nie powstało drugie ZADANIE. Ta pilnuje, żeby nie poszedł
 * drugi MAIL — bo zadanie można ponowić także wtedy, gdy poprzednie podejście
 * zdążyło wysłać i padło tuż przed oznaczeniem wyniku. Bez tego ponowienie
 * po takiej awarii dokłada klientowi drugie potwierdzenie.
 *
 * Zwraca `true`, gdy zadanie wolno uznać za zrobione. Uwaga: „już wysłane
 * wcześniej" też jest sukcesem — nie ma czego ponawiać.
 */
export async function wyslijMailZamowienia(
  admin: Admin,
  orderId: string,
  rodzaj: 'potwierdzenie' | 'przypomnienie'
): Promise<{ ok: boolean; powod?: string }> {
  if (!KLUCZ_RESEND) {
    // Brak klucza to stan konfiguracji, nie błąd przejściowy — ponawianie
    // tego w nieskończoność zapcha kolejkę. Zadanie kończy się porażką
    // z czytelnym powodem.
    return { ok: false, powod: 'RESEND_API_KEY nie ustawiony' };
  }

  const { data: wolno, error } = await admin.rpc('zajmij_mail_zamowienia', {
    p_order_id: orderId,
    p_rodzaj: rodzaj,
  });
  if (error) return { ok: false, powod: `zajmij_mail_zamowienia: ${error.message}` };
  if (wolno !== true) return { ok: true }; // ktoś już wysłał — nie ma czego ponawiać

  const dane = await pobierzZamowienie(admin, orderId);
  if (!dane) {
    await zwolnijZnacznik(admin, orderId, rodzaj);
    return { ok: false, powod: 'nie udało się pobrać zamówienia' };
  }
  if (!dane.zam.email) {
    // Zamówienie bez adresu nigdy nie nabierze adresu — to porażka trwała.
    return { ok: false, powod: 'zamówienie bez adresu e-mail' };
  }

  const tresc =
    rodzaj === 'potwierdzenie'
      ? mailPotwierdzenia(dane.zam, dane.pozycje, ADRES)
      : mailPorzuconegoKoszyka(dane.zam, dane.pozycje, ADRES);

  const poszlo = await wyslij({
    klucz: KLUCZ_RESEND,
    nadawca: NADAWCA,
    odpowiedzDo: ODPOWIEDZ || undefined,
    do: dane.zam.email,
    temat: tresc.temat,
    html: tresc.html,
    tekst: tresc.tekst,
  });

  if (!poszlo) {
    await zwolnijZnacznik(admin, orderId, rodzaj);
    return { ok: false, powod: 'Resend odrzucił wiadomość' };
  }

  return { ok: true };
}
