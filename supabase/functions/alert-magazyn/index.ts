/**
 * POST /functions/v1/alert-magazyn
 *
 * Powiadomienie dla obsługi, gdy stan produktu zejdzie poniżej progu albo do
 * zera. Woła to wyzwalacz `on_products_low_stock` z bazy przez pg_net — nie kod
 * strony, bo stan schodzi także z korekty w magazynie, ze skanera i z przyjęcia
 * zwrotu, a te ścieżki nie przechodzą przez Next.js.
 *
 * Funkcja musi być wystawiona bez JWT (`--no-verify-jwt`): woła ją baza, która
 * nie nosi tokenu użytkownika. Bezpieczeństwa pilnuje wspólny sekret
 * w nagłówku, porównywany w stałym czasie.
 *
 * Zmienne środowiskowe:
 *   RESEND_API_KEY   — klucz z Resend (re_…)
 *   RESEND_FROM      — nadawca, np. „dwie głowy <magazyn@mail.domena.pl>"
 *   ADRES_OBSLUGI    — skrzynka, na którą idą alerty (obowiązkowa)
 *   SEKRET_ALERTU    — ten sam ciąg co w konfiguracja_poczty
 *   PUBLICZNY_ADRES  — adres sklepu, do linku w treści
 */

import { BARWY, KROJ, bezpieczne, rowneWStalymCzasie, skorupa, wyslij } from '../_wspolne/poczta.ts';

const KLUCZ = Deno.env.get('RESEND_API_KEY') ?? '';
const NADAWCA = Deno.env.get('RESEND_FROM') ?? 'dwie głowy <onboarding@resend.dev>';
const ODBIORCA = Deno.env.get('ADRES_OBSLUGI') ?? '';
const SEKRET = Deno.env.get('SEKRET_ALERTU') ?? '';
const ADRES = Deno.env.get('PUBLICZNY_ADRES') ?? 'https://nordo-one.vercel.app';

type Ladunek = {
  product_id?: string;
  nazwa?: string;
  sku?: string;
  stan?: number;
  poprzedni_stan?: number;
  prog?: number;
  powod?: 'zero' | 'nisko';
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Metoda niedozwolona', { status: 405 });

  // Sekret jest jedyną bramką — funkcja jest wystawiona bez JWT.
  if (!SEKRET) {
    console.error('SEKRET_ALERTU nie ustawiony — żądanie odrzucone');
    return new Response('Funkcja nieskonfigurowana', { status: 500 });
  }
  const podany = req.headers.get('x-sekret-alertu') ?? '';
  if (!rowneWStalymCzasie(podany, SEKRET)) {
    return new Response('Brak dostępu', { status: 401 });
  }

  if (!ODBIORCA) {
    console.error('ADRES_OBSLUGI nie ustawiony — nie ma komu wysłać alertu');
    return new Response('Brak odbiorcy', { status: 500 });
  }

  let dane: Ladunek;
  try {
    dane = await req.json();
  } catch {
    return new Response('Nieprawidłowy ładunek', { status: 400 });
  }

  const nazwa = String(dane.nazwa ?? 'produkt bez nazwy');
  const stan = Number(dane.stan ?? 0);
  const poprzedni = Number(dane.poprzedni_stan ?? 0);
  const prog = Number(dane.prog ?? 5);
  const zero = dane.powod === 'zero';
  const sku = String(dane.sku ?? '');

  const naglowek = zero ? 'Stan zerowy' : 'Kończy się towar';
  const wstep = zero
    ? `<strong>${bezpieczne(nazwa)}</strong> zszedł do zera. Produkt zostaje w katalogu, ale nie da się go już kupić.`
    : `<strong>${bezpieczne(nazwa)}</strong> zszedł poniżej progu ${prog} szt. Zostało <strong>${stan}</strong>.`;

  const html = skorupa({
    tytul: `${naglowek} — ${nazwa}`,
    naglowek,
    wstep,
    tresc: `
          <tr><td style="padding:4px 0 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="font-family:${KROJ};font-size:14px;padding:4px 0;" class="ink2">Stan przed</td>
                <td align="right" style="font-family:${KROJ};font-size:14px;padding:4px 0;" class="ink2">${poprzedni} szt.</td>
              </tr>
              <tr>
                <td style="font-family:${KROJ};font-size:14px;padding:4px 0;font-weight:700;" class="ink">Stan teraz</td>
                <td align="right" style="font-family:${KROJ};font-size:14px;padding:4px 0;font-weight:700;" class="ink">${stan} szt.</td>
              </tr>
              <tr>
                <td style="font-family:${KROJ};font-size:14px;padding:4px 0;" class="ink2">Próg alertu</td>
                <td align="right" style="font-family:${KROJ};font-size:14px;padding:4px 0;" class="ink2">${prog} szt.</td>
              </tr>
              ${
                sku
                  ? `<tr>
                <td style="font-family:${KROJ};font-size:14px;padding:4px 0;" class="ink2">SKU</td>
                <td align="right" style="font-family:${KROJ};font-size:14px;padding:4px 0;font-family:monospace;" class="ink2">${bezpieczne(sku)}</td>
              </tr>`
                  : ''
              }
            </table>
          </td></tr>
          <tr><td style="padding:12px 0 0;">
            <div class="linia" style="border-top:1px solid ${BARWY.linia};font-size:0;line-height:0;">&nbsp;</div>
          </td></tr>`,
    przycisk: { etykieta: 'Otwórz magazyn', adres: `${ADRES}/panel/stany` },
    stopka: 'Alert magazynowy. Próg zmienisz w karcie produktu (pole „próg niskiego stanu").',
    adresSklepu: ADRES,
  });

  const tekst = [
    `${naglowek}: ${nazwa}`,
    '',
    `Stan przed:  ${poprzedni} szt.`,
    `Stan teraz:  ${stan} szt.`,
    `Próg alertu: ${prog} szt.`,
    sku ? `SKU:         ${sku}` : '',
    '',
    `Magazyn: ${ADRES}/panel/stany`,
  ]
    .filter((w) => w !== '')
    .join('\n');

  const poszlo = await wyslij({
    klucz: KLUCZ,
    nadawca: NADAWCA,
    do: ODBIORCA,
    temat: `${naglowek}: ${nazwa}`,
    html,
    tekst,
  });

  // 200 nawet przy nieudanej wysyłce: pg_net i tak nie ponawia, a 500 zostawia
  // tylko wpis w kolejce błędów. Powód porażki jest w logach funkcji.
  return new Response(JSON.stringify({ wyslano: poszlo }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
