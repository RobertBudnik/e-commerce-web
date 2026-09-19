/**
 * Wspólna skorupa poczty dla funkcji brzegowych.
 *
 * Powstała, bo maili transakcyjnych zrobiło się kilka (powitanie, potwierdzenie
 * zamówienia, przypomnienie o koszyku, alert magazynowy) i każdy z nich
 * potrzebuje tej samej rzeczy: tabeli o szerokości 600 px, tych samych barw
 * i tego samego wywołania Resenda. Trzy kopie tego kodu rozjechałyby się przy
 * pierwszej zmianie palety — a paleta już raz się zmieniła.
 *
 * Barwy są **wpisane liczbami**, nie zmiennymi CSS: klient pocztowy zmiennych
 * nie zna. Te same wartości co w `scripts/szablony-poczty.mjs` i w
 * `web/app/globals.css` — przy zmianie palety trzeba ruszyć wszystkie trzy.
 *
 * Układ na tabelach ze stylem w atrybutach. To nie nostalgia za 2005 rokiem:
 * Gmail usuwa większość reguł z `<style>`, Outlook renderuje silnikiem Worda,
 * a `flex` i `grid` nie działają w żadnym z nich.
 */

export const BARWY = {
  tlo: '#ece9e1',
  karta: '#fbf7ee',
  ink: '#1c1a17',
  ink2: '#544f46',
  ink3: '#666055',
  linia: '#dbd3c2',
  naAkcencie: '#f4f1ea',
} as const;

export const KROJ =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** Ucieczka dla treści wstawianej do HTML-a. Nazwy produktów pisze właściciel, adresy klient. */
export function bezpieczne(tekst: string): string {
  return String(tekst)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Porównanie w stałym czasie — zwykłe === wycieka informację przez czas wykonania. */
export function rowneWStalymCzasie(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let roznica = 0;
  for (let i = 0; i < a.length; i++) roznica |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return roznica === 0;
}

/** Grosze na „1 234,50 zł". Klient pocztowy nie ma Intl z polskim locale w każdej wersji. */
export function zlote(grosze: number): string {
  const znak = grosze < 0 ? '-' : '';
  const calosc = Math.abs(Math.round(grosze));
  const zl = Math.floor(calosc / 100);
  const gr = String(calosc % 100).padStart(2, '0');
  const zeSpacjami = String(zl).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${znak}${zeSpacjami},${gr} zł`;
}

type Przycisk = { etykieta: string; adres: string };

/**
 * Skorupa wiadomości: nagłówek z marką, karta z treścią, stopka.
 *
 * `width:100%` razem z `max-width:600px`, nigdy `width:600px`. Sztywna
 * szerokość rozpycha tabelę nadrzędną poza ekran telefonu — zmierzone:
 * `scrollWidth` 632 przy oknie 375. To nie jest przesada, tylko poprawka
 * po realnym błędzie w poprzedniej rundzie szablonów.
 */
export function skorupa(opcje: {
  tytul: string;
  naglowek: string;
  wstep: string;
  tresc?: string;
  przycisk?: Przycisk;
  stopka?: string;
  adresSklepu: string;
}): string {
  const { tytul, naglowek, wstep, tresc = '', przycisk, stopka = '', adresSklepu } = opcje;

  const blokPrzycisku = przycisk
    ? `
          <tr><td style="padding:8px 0 4px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="btn" style="background-color:${BARWY.ink};border-radius:999px;">
                <a href="${bezpieczne(przycisk.adres)}" style="display:inline-block;padding:13px 28px;font-family:${KROJ};font-size:15px;font-weight:600;color:${BARWY.naAkcencie};text-decoration:none;">${bezpieczne(przycisk.etykieta)}</a>
              </td></tr>
            </table>
          </td></tr>`
    : '';

  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${bezpieczne(tytul)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .tlo { background-color: #1b1917 !important; }
    .karta { background-color: #232120 !important; border-color: #3a3632 !important; }
    .ink { color: #ede9de !important; }
    .ink2, .ink3 { color: #b4afa4 !important; }
    .linia { border-color: #3a3632 !important; }
    .btn { background-color: #ede9de !important; }
    .btn a { color: #1b1917 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${BARWY.tlo};">
<table role="presentation" class="tlo" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BARWY.tlo};">
  <tr><td align="center" style="padding:32px 16px;">

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:600px;">

      <tr><td style="padding:0 0 20px;font-family:${KROJ};font-size:17px;font-weight:700;letter-spacing:-.02em;" class="ink">
        dwie głowy<span style="color:${BARWY.ink3};">.</span>
      </td></tr>

      <tr><td class="karta linia" style="background-color:${BARWY.karta};border:1px solid ${BARWY.linia};border-radius:12px;padding:32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td style="font-family:${KROJ};font-size:22px;font-weight:700;line-height:1.25;letter-spacing:-.02em;padding:0 0 12px;" class="ink">
            ${bezpieczne(naglowek)}
          </td></tr>
          <tr><td style="font-family:${KROJ};font-size:15px;line-height:1.6;padding:0 0 16px;" class="ink2">
            ${wstep}
          </td></tr>
          ${tresc}
          ${blokPrzycisku}
        </table>
      </td></tr>

      <tr><td style="font-family:${KROJ};font-size:12px;line-height:1.6;padding:20px 4px 0;" class="ink3">
        ${stopka}
        ${stopka ? '<br><br>' : ''}Wiadomość ze sklepu <a href="${bezpieczne(adresSklepu)}" style="color:inherit;">dwie głowy</a>.
      </td></tr>

    </table>

  </td></tr>
</table>
</body>
</html>`;
}

/**
 * Wysyłka przez Resend.
 *
 * Zawsze z częścią tekstową. Bez niej filtry antyspamowe podnoszą ocenę
 * wiadomości, a czytniki ekranu i klienci tekstowi dostają pustkę.
 *
 * Zwraca `false` zamiast rzucać: żadna z tych wiadomości nie jest ważniejsza
 * od operacji, przy której powstaje. Nieudany mail po zamówieniu nie ma prawa
 * cofnąć zamówienia ani kazać Stripe'owi ponawiać webhooka w kółko.
 */
export async function wyslij(opcje: {
  klucz: string;
  nadawca: string;
  odpowiedzDo?: string;
  do: string;
  temat: string;
  html: string;
  tekst: string;
}): Promise<boolean> {
  if (!opcje.klucz) {
    console.error('RESEND_API_KEY nie ustawiony — wiadomość nie poszła:', opcje.temat);
    return false;
  }

  const ciało: Record<string, unknown> = {
    from: opcje.nadawca,
    to: [opcje.do],
    subject: opcje.temat,
    html: opcje.html,
    text: opcje.tekst,
  };
  if (opcje.odpowiedzDo) ciało.reply_to = opcje.odpowiedzDo;

  try {
    const odpowiedz = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opcje.klucz}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ciało),
    });

    if (!odpowiedz.ok) {
      console.error('Resend odrzucił wiadomość:', odpowiedz.status, await odpowiedz.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('Resend nieosiągalny:', e);
    return false;
  }
}
