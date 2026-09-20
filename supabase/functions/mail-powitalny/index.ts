/**
 * POST /functions/v1/mail-powitalny
 *
 * Powitanie po potwierdzeniu konta. Woła to wyzwalacz `on_auth_user_confirmed`
 * z bazy przez pg_net — nie kod strony, bo potwierdzenie bywa klikane na innym
 * urządzeniu i godzinę później, gdy żądania z Next.js dawno nie ma.
 *
 * Funkcja musi być wystawiona bez JWT (`--no-verify-jwt`): woła ją baza, która
 * nie nosi tokenu użytkownika. Bezpieczeństwa pilnuje wspólny sekret
 * w nagłówku, porównywany w stałym czasie.
 *
 * Zmienne środowiskowe:
 *   RESEND_API_KEY        — klucz z Resend (re_…)
 *   RESEND_FROM           — nadawca, np. „dwie głowy <konto@mail.domena.pl>"
 *   RESEND_REPLY_TO       — skrzynka do odpowiedzi (opcjonalna)
 *   SEKRET_POWITANIA      — ten sam ciąg co w konfiguracja_poczty
 *   PUBLICZNY_ADRES       — adres sklepu, do linków w treści
 */

import { KROJ, bezpieczne, rowneWStalymCzasie, skorupa, wyslij } from '../_wspolne/poczta.ts';

const KLUCZ = Deno.env.get('RESEND_API_KEY') ?? '';
const NADAWCA = Deno.env.get('RESEND_FROM') ?? 'dwie głowy <onboarding@resend.dev>';
const ODPOWIEDZ = Deno.env.get('RESEND_REPLY_TO') ?? '';
const SEKRET = Deno.env.get('SEKRET_POWITANIA') ?? '';
const ADRES = Deno.env.get('PUBLICZNY_ADRES') ?? 'https://nordo-one.vercel.app';

/** Imię z pola `full_name`. Puste zostaje puste — lepiej bez imienia niż z cudzym. */
function pierwszeImie(pelne: string): string {
  const czyste = pelne.trim();
  if (!czyste) return '';
  return czyste.split(/\s+/)[0] ?? '';
}

/**
 * Treść powitania w tej samej skorupie, co reszta poczty transakcyjnej.
 *
 * Wcześniej ta funkcja miała własną kopię całego szablonu — własne
 * `bezpieczne()`, własny `KROJ`, własny blok trybu ciemnego i własne barwy
 * wpisane szesnastkowo. Kopia zdążyła się już rozjechać: brakowało w niej
 * reguły `.linia`, a przycisk miał `border-radius: 8px` zamiast pigułki.
 */
function html(imie: string): string {
  const powitanie = imie ? `Cześć ${bezpieczne(imie)},` : 'Cześć,';

  return skorupa({
    tytul: 'Konto gotowe',
    zajawka: 'Konto jest gotowe. Zamówienia i adresy masz teraz w jednym miejscu.',
    naglowek: 'Konto gotowe',
    wstep: powitanie,
    tresc: `
          <tr><td style="font-family:${KROJ};font-size:15px;line-height:1.6;padding:0 0 16px;" class="ink2">
            Adres potwierdzony, konto działa. Od teraz zamówienia, adres dostawy i lista życzeń
            trzymają się razem — także po zmianie urządzenia.
          </td></tr>
          <tr><td style="font-family:${KROJ};font-size:15px;line-height:1.6;padding:0 0 8px;" class="ink2">
            Robimy w dwie pary rąk w Krakowie, w partiach na tyle małych, że pamiętamy każdą.
            Jeśli coś będzie nie tak z zamówieniem, odpisz na tę wiadomość — czyta ją człowiek.
          </td></tr>`,
    przycisk: { etykieta: 'Zobacz swoje konto', adres: `${ADRES}/konto` },
    stopka: 'Dostajesz tę wiadomość, bo potwierdziłeś adres przy zakładaniu konta.',
    adresSklepu: ADRES,
  });
}

/**
 * Wersja tekstowa obok HTML-a.
 *
 * Nie jest ozdobą: część klientów poczty i filtrów czyta wyłącznie `text`,
 * a wiadomość wyłącznie w HTML-u dostaje u nich gorszą ocenę. Resend przyjmuje
 * oba pola naraz i sam składa wiadomość wieloczęściową.
 */
function tekst(imie: string): string {
  const powitanie = imie ? `Cześć ${imie},` : 'Cześć,';
  return [
    'dwie głowy',
    '',
    'KONTO GOTOWE',
    '',
    powitanie,
    '',
    'Adres potwierdzony, konto działa. Od teraz zamówienia, adres dostawy',
    'i lista życzeń trzymają się razem — także po zmianie urządzenia.',
    '',
    'Robimy w dwie pary rąk w Krakowie, w partiach na tyle małych, że',
    'pamiętamy każdą. Jeśli coś będzie nie tak z zamówieniem, odpisz na tę',
    'wiadomość — czyta ją człowiek.',
    '',
    `Twoje konto: ${ADRES}/konto`,
    '',
    'Dostajesz tę wiadomość, bo potwierdziłeś adres przy zakładaniu konta.',
  ].join('\n');
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Metoda nieobsługiwana', { status: 405 });
  }

  // Bez sekretu funkcja jest otwartym nadajnikiem poczty. Brak konfiguracji
  // traktujemy jak odmowę, nie jak zgodę.
  const podany = request.headers.get('x-sekret-powitania') ?? '';
  if (!SEKRET || !rowneWStalymCzasie(podany, SEKRET)) {
    return new Response('Odmowa', { status: 401 });
  }

  if (!KLUCZ) {
    console.error('Brak RESEND_API_KEY — powitanie nie zostanie wysłane.');
    return new Response('Brak konfiguracji poczty', { status: 500 });
  }

  let dane: { email?: string; imie?: string };
  try {
    dane = await request.json();
  } catch {
    return new Response('Zły JSON', { status: 400 });
  }

  const email = (dane.email ?? '').trim();
  if (!email) return new Response('Brak adresu', { status: 400 });

  const imie = pierwszeImie(dane.imie ?? '');

  const poszlo = await wyslij({
    klucz: KLUCZ,
    nadawca: NADAWCA,
    odpowiedzDo: ODPOWIEDZ || undefined,
    do: email,
    temat: 'Konto gotowe',
    html: html(imie),
    tekst: tekst(imie),
  });

  if (!poszlo) {
    // Log wystarcza: powitanie jest miłe, ale jego brak nie może niczego
    // zablokować, a baza i tak zapisała już, że poszło.
    return new Response('Wysyłka odrzucona', { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
