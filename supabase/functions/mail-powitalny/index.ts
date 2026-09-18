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

const KLUCZ = Deno.env.get('RESEND_API_KEY') ?? '';
const NADAWCA = Deno.env.get('RESEND_FROM') ?? 'dwie głowy <onboarding@resend.dev>';
const ODPOWIEDZ = Deno.env.get('RESEND_REPLY_TO') ?? '';
const SEKRET = Deno.env.get('SEKRET_POWITANIA') ?? '';
const ADRES = Deno.env.get('PUBLICZNY_ADRES') ?? 'https://nordo-one.vercel.app';

/** Porównanie w stałym czasie — zwykłe === wycieka informację przez czas wykonania. */
function rowneWStalymCzasie(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let roznica = 0;
  for (let i = 0; i < a.length; i++) roznica |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return roznica === 0;
}

/** Imię z pola `full_name`. Puste zostaje puste — lepiej bez imienia niż z cudzym. */
function pierwszeImie(pelne: string): string {
  const czyste = pelne.trim();
  if (!czyste) return '';
  return czyste.split(/\s+/)[0] ?? '';
}

/** Ucieczka dla treści wstawianej do HTML-a. Imię przychodzi od użytkownika. */
function bezpieczne(tekst: string): string {
  return tekst
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const KROJ =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function html(imie: string): string {
  const powitanie = imie ? `Cześć ${bezpieczne(imie)},` : 'Cześć,';

  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Konto gotowe</title>
<style>
  @media (prefers-color-scheme: dark) {
    .tlo { background-color: #1b1917 !important; }
    .karta { background-color: #232120 !important; border-color: #3a3632 !important; }
    .ink { color: #ede9de !important; }
    .ink2, .ink3 { color: #b4afa4 !important; }
    .btn { background-color: #ede9de !important; }
    .btn a { color: #1b1917 !important; }
  }
</style>
</head>
<body class="tlo" style="margin:0;padding:0;background-color:#ece9e1;">
<div style="display:none;font-size:1px;color:#ece9e1;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Konto jest gotowe. Zamówienia i adresy masz teraz w jednym miejscu.</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="tlo" style="background-color:#ece9e1;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:600px;">

      <tr><td style="padding:0 0 24px;">
        <span class="ink" style="font-family:${KROJ};font-size:15px;font-weight:700;letter-spacing:.02em;color:#1c1a17;">dwie głowy</span>
      </td></tr>

      <tr><td class="karta" style="background-color:#fbf7ee;border:1px solid #dbd3c2;border-radius:12px;padding:32px;">
        <h1 class="ink" style="margin:0 0 16px;font-family:${KROJ};font-size:22px;line-height:1.3;font-weight:700;color:#1c1a17;">Konto gotowe</h1>

        <p class="ink2" style="margin:0 0 16px;font-family:${KROJ};font-size:15px;line-height:1.6;color:#544f46;">${powitanie}</p>
        <p class="ink2" style="margin:0 0 16px;font-family:${KROJ};font-size:15px;line-height:1.6;color:#544f46;">
          Adres potwierdzony, konto działa. Od teraz zamówienia, adres dostawy i lista życzeń
          trzymają się razem — także po zmianie urządzenia.
        </p>
        <p class="ink2" style="margin:0 0 24px;font-family:${KROJ};font-size:15px;line-height:1.6;color:#544f46;">
          Robimy w dwie pary rąk w Krakowie, w partiach na tyle małych, że pamiętamy każdą.
          Jeśli coś będzie nie tak z zamówieniem, odpisz na tę wiadomość — czyta ją człowiek.
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">
          <tr><td class="btn" style="background-color:#1c1a17;border-radius:8px;">
            <a href="${ADRES}/konto" style="display:inline-block;padding:13px 28px;font-family:${KROJ};font-size:15px;font-weight:600;color:#f4f1ea;text-decoration:none;">Zobacz swoje konto</a>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:24px 4px 0;">
        <p class="ink3" style="margin:0;font-family:${KROJ};font-size:12px;line-height:1.6;color:#666055;">
          Dostajesz tę wiadomość, bo potwierdziłeś adres przy zakładaniu konta.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
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

  const odpowiedz = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KLUCZ}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: NADAWCA,
      to: [email],
      ...(ODPOWIEDZ ? { reply_to: ODPOWIEDZ } : {}),
      subject: 'Konto gotowe',
      html: html(imie),
      text: tekst(imie),
    }),
  });

  if (!odpowiedz.ok) {
    const tresc = await odpowiedz.text();
    // Log wystarcza: powitanie jest miłe, ale jego brak nie może niczego
    // zablokować, a baza i tak zapisała już, że poszło.
    console.error('Resend odrzucił wysyłkę', odpowiedz.status, tresc);
    return new Response('Wysyłka odrzucona', { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
