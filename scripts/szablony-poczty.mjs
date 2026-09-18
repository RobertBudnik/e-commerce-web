/**
 * Generator szablonów poczty.
 *
 * Cztery wiadomości Auth dzielą jedną skorupę: ten sam nagłówek, ten sam
 * przycisk, tę samą stopkę. Trzymanie ich jako czterech osobnych plików HTML
 * kończy się tak, że poprawka trafia do trzech z nich, a czwarta zostaje ze
 * starym adresem stopki i nikt tego nie zauważa przez pół roku — bo tę jedną
 * wiadomość dostaje się raz na sto rejestracji.
 *
 * Skrypt pisze w dwa miejsca:
 *
 *   supabase/templates/     wersja z podstawieniami Supabase ({{ .TokenHash }})
 *   docs/podglad-poczty/    ta sama treść z przykładowymi wartościami,
 *                           do otwarcia w przeglądarce i obejrzenia
 *
 * Uruchomienie: `npm run poczta:szablony`
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KORZEN = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Barwy wprost z `web/app/globals.css`, ale **wpisane liczbami**.
 * Poczta nie zna zmiennych CSS — każdy klient dostaje gotowy kolor albo nic.
 */
const B = {
  tlo: '#ece9e1',
  karta: '#f4f1ea',
  ink: '#1c1a17',
  ink2: '#544f46',
  ink3: '#666055',
  linia: '#dbd7cd',
  naAkcencie: '#f4f1ea',
};

const KROJ =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/**
 * Skorupa wiadomości.
 *
 * Układ na tabelach, style w atrybutach `style`, szerokość 600 px. To nie
 * jest nostalgia za 2005 rokiem: Gmail usuwa z wiadomości większość reguł
 * z `<style>`, Outlook renderuje silnikiem Worda, a `flex` i `grid` nie
 * działają w żadnym z nich. Tabela z inline'owanym stylem to jedyna rzecz,
 * którą rysują tak samo.
 *
 * Bloku `<style>` używamy wyłącznie na tryb ciemny — jeśli klient go
 * zignoruje, wiadomość zostaje jasna i czytelna, więc nic nie tracimy.
 */
function skorupa({ tytul, preheader, naglowek, akapity, przyciskEtykieta, przyciskUrl, dopisek }) {
  const tresc = akapity
    .map(
      (a) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${B.ink2};">${a}</p>`
    )
    .join('\n              ');

  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${tytul}</title>
<style>
  /* Tryb ciemny. Gmail i tak potrafi odwrócić barwy sam, ale wtedy robi to
     na ślepo — ciemny atrament na ciemnym tle. Podanie własnych wartości
     odbiera mu zgadywanie. Klient, który tego bloku nie przeczyta, zostaje
     przy wersji jasnej i nic się nie psuje. */
  @media (prefers-color-scheme: dark) {
    .tlo { background-color: #1b1917 !important; }
    .karta { background-color: #232120 !important; border-color: #3a3632 !important; }
    .ink { color: #ede9de !important; }
    .ink2, .ink3 { color: #b4afa4 !important; }
    .btn { background-color: #ede9de !important; }
    .btn a { color: #1b1917 !important; }
    .linia { border-color: #3a3632 !important; }
  }
</style>
</head>
<body class="tlo" style="margin:0;padding:0;background-color:${B.tlo};">

<!-- Podgląd na liście wiadomości. Bez niego Gmail bierze pierwsze słowa
     z treści, czyli zwykle powitanie — a to nie mówi, po co ten mail. -->
<div style="display:none;font-size:1px;color:${B.tlo};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="tlo" style="background-color:${B.tlo};">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <!-- width:100% + max-width:600px, NIE width:600px. Sztywna szerokość
           rozpycha tabelę nadrzędną do 632 px i na telefonie treść wychodzi
           poza ekran — samo max-width:100% jej nie uratuje, bo rodzic już urósł
           do zawartości. Zmierzone, nie zgadnięte. -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:600px;">

        <tr>
          <td style="padding:0 0 24px;">
            <span class="ink" style="font-family:${KROJ};font-size:15px;font-weight:700;letter-spacing:.02em;color:${B.ink};">dwie głowy</span>
          </td>
        </tr>

        <tr>
          <td class="karta linia" style="background-color:${B.karta};border:1px solid ${B.linia};border-radius:12px;padding:32px;">

            <h1 class="ink" style="margin:0 0 16px;font-family:${KROJ};font-size:22px;line-height:1.3;font-weight:700;color:${B.ink};">${naglowek}</h1>

            <div style="font-family:${KROJ};">
              ${tresc}
            </div>

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
              <tr>
                <td class="btn" style="background-color:${B.ink};border-radius:8px;">
                  <a href="${przyciskUrl}" style="display:inline-block;padding:13px 28px;font-family:${KROJ};font-size:15px;font-weight:600;color:${B.naAkcencie};text-decoration:none;">${przyciskEtykieta}</a>
                </td>
              </tr>
            </table>

            <!-- Adres wypisany słowami, bo przycisk bywa wycinany przez
                 filtry firmowe, a niektórzy czytają pocztę bez HTML-a. -->
            <p class="ink3" style="margin:0;font-family:${KROJ};font-size:12px;line-height:1.6;color:${B.ink3};">
              Przycisk nie działa? Skopiuj ten adres do przeglądarki:<br>
              <span style="word-break:break-all;">${przyciskUrl}</span>
            </p>

          </td>
        </tr>

        <tr>
          <td style="padding:24px 4px 0;">
            <p class="ink3" style="margin:0;font-family:${KROJ};font-size:12px;line-height:1.6;color:${B.ink3};">${dopisek}</p>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>
`;
}

/** Wspólny dopisek: co zrobić, gdy wiadomość przyszła bez powodu. */
const NIE_TY =
  'Nie zakładałeś konta w tym sklepie? Zignoruj tę wiadomość — bez kliknięcia linku nic się nie wydarzy.';

/**
 * Adres celu. `token_hash` zamiast `code` jest decyzją, nie przypadkiem:
 * link musi działać także wtedy, gdy ktoś rejestrował się na komputerze,
 * a pocztę otwiera na telefonie. Patrz `web/app/auth/callback/route.ts`.
 */
const cel = (typ, next) =>
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=${typ}&next=${encodeURIComponent(next)}`;

const SZABLONY = {
  'potwierdzenie': {
    plik: 'confirmation.html',
    typ: 'signup',
    next: '/konto',
    tytul: 'Potwierdź adres e-mail',
    preheader: 'Jedno kliknięcie i konto jest gotowe.',
    naglowek: 'Potwierdź adres e-mail',
    akapity: [
      'Dziękujemy za założenie konta. Zostało potwierdzić, że ten adres należy do Ciebie.',
      'Link jest ważny godzinę i działa jeden raz. Możesz go otworzyć na dowolnym urządzeniu — nie musi to być ta sama przeglądarka, w której się rejestrowałeś.',
    ],
    etykieta: 'Potwierdź adres',
    dopisek: NIE_TY,
  },
  'reset': {
    plik: 'recovery.html',
    typ: 'recovery',
    next: '/haslo/nowe',
    tytul: 'Ustaw nowe hasło',
    preheader: 'Link do zmiany hasła, ważny godzinę.',
    naglowek: 'Ustaw nowe hasło',
    akapity: [
      'Ktoś poprosił o zmianę hasła do konta na ten adres. Jeśli to byłeś Ty, kliknij poniżej.',
      'Link jest ważny godzinę i działa jeden raz. Dopóki go nie użyjesz, stare hasło działa bez zmian.',
    ],
    etykieta: 'Ustaw nowe hasło',
    dopisek:
      'To nie Ty prosiłeś o zmianę? Zignoruj tę wiadomość — hasło zostaje takie, jakie było. Jeśli takich wiadomości jest więcej, zmień hasło i daj nam znać.',
  },
  'magic': {
    plik: 'magic_link.html',
    typ: 'magiclink',
    next: '/konto',
    tytul: 'Zaloguj się jednym kliknięciem',
    preheader: 'Twój link do logowania, ważny godzinę.',
    naglowek: 'Zaloguj się jednym kliknięciem',
    akapity: [
      'Poprosiłeś o logowanie bez hasła. Kliknij poniżej, a wpuścimy Cię na konto.',
      'Link jest ważny godzinę i działa jeden raz.',
    ],
    etykieta: 'Zaloguj się',
    dopisek:
      'Nie prosiłeś o logowanie? Zignoruj tę wiadomość. Bez kliknięcia nikt nie wejdzie na Twoje konto.',
  },
  'zmiana-adresu': {
    plik: 'email_change.html',
    typ: 'email_change',
    next: '/konto',
    tytul: 'Potwierdź zmianę adresu',
    preheader: 'Potwierdź nowy adres e-mail przy koncie.',
    naglowek: 'Potwierdź zmianę adresu',
    akapity: [
      'Przy koncie ma stanąć nowy adres e-mail. Potwierdzenia wymagamy z obu stron — ze starego adresu i z nowego — żeby nikt nie przepisał cudzego konta na siebie.',
      'Link jest ważny godzinę i działa jeden raz.',
    ],
    etykieta: 'Potwierdź zmianę',
    dopisek:
      'Nie zmieniałeś adresu? Zignoruj tę wiadomość i od razu zmień hasło — ktoś mógł dostać się do konta.',
  },
};

/** Przykładowe wartości do podglądu — to, co Supabase podstawia naprawdę. */
const PRZYKLAD = {
  '{{ .SiteURL }}': 'https://nordo-one.vercel.app',
  '{{ .TokenHash }}': 'pkce_2f1a9c4e8b7d3a6f5e0c1b8a9d7e6f5c4b3a2918',
};

mkdirSync(join(KORZEN, 'supabase/templates'), { recursive: true });
mkdirSync(join(KORZEN, 'docs/podglad-poczty'), { recursive: true });

let ile = 0;
for (const [nazwa, s] of Object.entries(SZABLONY)) {
  const url = cel(s.typ, s.next);
  const html = skorupa({
    tytul: s.tytul,
    preheader: s.preheader,
    naglowek: s.naglowek,
    akapity: s.akapity,
    przyciskEtykieta: s.etykieta,
    przyciskUrl: url,
    dopisek: s.dopisek,
  });

  writeFileSync(join(KORZEN, 'supabase/templates', s.plik), html, 'utf8');

  let podglad = html;
  for (const [klucz, wartosc] of Object.entries(PRZYKLAD)) {
    podglad = podglad.split(klucz).join(wartosc);
  }
  writeFileSync(join(KORZEN, 'docs/podglad-poczty', `${nazwa}.html`), podglad, 'utf8');
  ile += 1;
}

console.log(`Zapisano ${ile} szablony do supabase/templates/ i tyle samo podglądów do docs/podglad-poczty/`);
