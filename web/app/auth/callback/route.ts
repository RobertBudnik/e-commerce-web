import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { sciezkaPowrotu } from '@/lib/sciezka-powrotu';

/**
 * Jedno wejście z poczty i z logowania zewnętrznego.
 *
 * Obsługuje dwa różne mechanizmy, bo Supabase wysyła linki na dwa sposoby
 * i każdy ma inną wadę:
 *
 *   `token_hash` + `type`  — `verifyOtp`. Tak wołają szablony wiadomości.
 *   `code`                 — `exchangeCodeForSession`. Tak wraca PKCE.
 *
 * Wybór między nimi nie jest kosmetyczny. PKCE dowodzi, że sesję odbiera ta
 * sama przeglądarka, która o nią prosiła — dowodem jest `code_verifier`
 * zapisany w ciasteczku przy `signUp`. To dobra własność przy logowaniu
 * zewnętrznym i **zła** przy poczcie: człowiek rejestruje się na komputerze,
 * a maila otwiera na telefonie. Wtedy ciasteczka nie ma, wymiana kodu pada
 * i konto zostaje niepotwierdzone, choć właściciel zrobił dokładnie to,
 * o co go poproszono.
 *
 * Dlatego szablony poczty (patrz `supabase/templates/`) używają `token_hash`.
 * `verifyOtp` sprawdza sam skrót, więc link działa w dowolnej przeglądarce
 * i na dowolnym urządzeniu. Bezpieczeństwo niesie wtedy krótki czas życia
 * linku i to, że skrót jest jednorazowy — nie ciasteczko.
 *
 * Gałąź `code` zostaje dla logowania zewnętrznego i dla linków wystawionych
 * przez starsze szablony; nic nie kosztuje, a ratuje wiadomości wysłane
 * przed podmianą.
 */

/** Rodzaje, które wolno podać w adresie. Cokolwiek innego odrzucamy. */
const RODZAJE: readonly EmailOtpType[] = [
  'signup',
  'magiclink',
  'recovery',
  'invite',
  'email_change',
  'email',
];

function jestRodzajem(wartosc: string | null): wartosc is EmailOtpType {
  return wartosc !== null && (RODZAJE as readonly string[]).includes(wartosc);
}

/** Ekran błędu zamiast surowego komunikatu. `powod` steruje treścią. */
function naBlad(request: NextRequest, powod: string, adres?: string) {
  const cel = new URL('/auth/blad', request.url);
  cel.searchParams.set('powod', powod);
  // Adres wraca tylko po to, żeby przycisk „wyślij ponownie" miał co wypełnić.
  if (adres) cel.searchParams.set('adres', adres);
  return NextResponse.redirect(cel);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Dokąd po udanym potwierdzeniu. Ten sam sprawdzacz co przy logowaniu:
  // parametr przychodzi z adresu, czyli spod kontroli tego, kto podsunął
  // link. Bez tego mielibyśmy otwarte przekierowanie na własnej domenie,
  // podpięte pod prawdziwe, udane logowanie — najlepszy możliwy nośnik
  // wyłudzenia.
  const dokad = sciezkaPowrotu(searchParams.get('next'), '/konto');

  // Supabase odbija tu także własne błędy, zanim jeszcze dotkniemy tokenu.
  const bladZUrl = searchParams.get('error');
  const kodBledu = searchParams.get('error_code');
  if (bladZUrl) {
    return naBlad(request, kodBledu === 'otp_expired' ? 'wygasl' : 'odmowa');
  }

  const tokenHash = searchParams.get('token_hash');
  const rodzaj = searchParams.get('type');
  const kod = searchParams.get('code');

  const supabase = await createClient();

  if (tokenHash && jestRodzajem(rodzaj)) {
    const { error } = await supabase.auth.verifyOtp({ type: rodzaj, token_hash: tokenHash });

    if (error) {
      // Supabase nie rozróżnia „wygasł" od „już użyty" osobnym kodem —
      // w obu przypadkach skrótu po prostu nie ma już w bazie. Dla człowieka
      // to zresztą jedna sytuacja: link nie zadziałał, trzeba nowy.
      return naBlad(request, 'wygasl');
    }

    // Reset hasła kończy się na formularzu nowego hasła, nie na koncie.
    // Sesja odzyskiwania jest ograniczona i służy dokładnie temu.
    if (rodzaj === 'recovery') {
      return NextResponse.redirect(new URL('/haslo/nowe', request.url));
    }

    return NextResponse.redirect(new URL(dokad, request.url));
  }

  if (kod) {
    const { error } = await supabase.auth.exchangeCodeForSession(kod);
    if (error) return naBlad(request, 'wygasl');
    return NextResponse.redirect(new URL(dokad, request.url));
  }

  // Ktoś wszedł tu z palca albo link się urwał po drodze w kliencie poczty.
  return naBlad(request, 'brak');
}
