/**
 * Treść maili wokół zamówienia: potwierdzenie po zapłacie i przypomnienie
 * o nieopłaconym koszyku.
 *
 * Osobny plik od `poczta.ts`, bo tamten trzyma skorupę i wysyłkę, a tu siedzi
 * to, co ta konkretna wiadomość ma powiedzieć. Skorupa zmienia się przy
 * zmianie palety, treść — przy zmianie prawa albo oferty.
 */

import { BARWY, KROJ, bezpieczne, skorupa, zlote } from './poczta.ts';

export type PozycjaZamowienia = {
  name: string;
  qty: number;
  unit_price_cents: number;
  line_total_cents: number;
};

export type Zamowienie = {
  order_number: string;
  email: string;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  total_cents: number;
  coupon_code: string | null;
  shipping_address: Record<string, unknown> | null;
};

function wiersz(lewo: string, prawo: string, mocny = false): string {
  const waga = mocny ? '700' : '400';
  const klasa = mocny ? 'ink' : 'ink2';
  return `
          <tr>
            <td style="font-family:${KROJ};font-size:14px;line-height:1.6;padding:4px 0;font-weight:${waga};" class="${klasa}">${lewo}</td>
            <td align="right" style="font-family:${KROJ};font-size:14px;line-height:1.6;padding:4px 0;font-weight:${waga};white-space:nowrap;" class="${klasa}">${prawo}</td>
          </tr>`;
}

/** Tabela pozycji plus podsumowanie kwot. */
function tabelaPozycji(zam: Zamowienie, pozycje: PozycjaZamowienia[]): string {
  const linie = pozycje
    .map((p) =>
      wiersz(
        `${bezpieczne(p.name)} <span style="color:${BARWY.ink3};">× ${p.qty}</span>`,
        zlote(p.line_total_cents)
      )
    )
    .join('');

  const rabat =
    zam.discount_cents > 0
      ? wiersz(
          `Rabat${zam.coupon_code ? ` (${bezpieczne(zam.coupon_code)})` : ''}`,
          `−${zlote(zam.discount_cents)}`
        )
      : '';

  const dostawa = wiersz(
    'Dostawa',
    zam.shipping_cents === 0 ? 'gratis' : zlote(zam.shipping_cents)
  );

  return `
          <tr><td style="padding:4px 0 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              ${linie}
              <tr><td colspan="2" style="padding:10px 0;"><div class="linia" style="border-top:1px solid ${BARWY.linia};font-size:0;line-height:0;">&nbsp;</div></td></tr>
              ${wiersz('Wartość produktów', zlote(zam.subtotal_cents))}
              ${rabat}
              ${dostawa}
              <tr><td colspan="2" style="padding:10px 0;"><div class="linia" style="border-top:1px solid ${BARWY.linia};font-size:0;line-height:0;">&nbsp;</div></td></tr>
              ${wiersz('Razem', zlote(zam.total_cents), true)}
            </table>
          </td></tr>`;
}

/** Adres dostawy, jeśli klient go podał. Pola są opcjonalne — pomijamy puste. */
function blokAdresu(adres: Record<string, unknown> | null): string {
  if (!adres) return '';
  const pola = ['imie', 'nazwisko', 'ulica', 'kod', 'miasto', 'kraj']
    .map((k) => (typeof adres[k] === 'string' ? String(adres[k]).trim() : ''))
    .filter(Boolean);
  if (pola.length === 0) return '';

  const imieNazwisko = [pola[0], pola[1]].filter(Boolean).join(' ');
  const reszta = pola.slice(2).join(', ');

  return `
          <tr><td style="padding:12px 0 4px;font-family:${KROJ};font-size:13px;line-height:1.6;" class="ink3">
            <strong style="font-weight:600;">Adres dostawy</strong><br>
            ${bezpieczne([imieNazwisko, reszta].filter(Boolean).join(', '))}
          </td></tr>`;
}

/**
 * Potwierdzenie zamówienia po zaksięgowanej płatności.
 *
 * To nie jest uprzejmość, tylko obowiązek: art. 21 ustawy o prawach
 * konsumenta każe przekazać potwierdzenie zawarcia umowy na trwałym nośniku.
 * Stąd w treści są kwoty, pozycje i **pouczenie o odstąpieniu wprost
 * w wiadomości**, a nie tylko odnośnik — odnośnik można zmienić po fakcie,
 * wiadomość w skrzynce klienta już nie.
 */
export function mailPotwierdzenia(
  zam: Zamowienie,
  pozycje: PozycjaZamowienia[],
  adresSklepu: string
): { temat: string; html: string; tekst: string } {
  const numer = bezpieczne(zam.order_number);

  const html = skorupa({
    tytul: `Zamówienie ${numer}`,
    naglowek: 'Zamówienie przyjęte i opłacone',
    wstep: `Dziękujemy. Płatność doszła, zamówienie <strong>${numer}</strong> jest u nas. Odezwiemy się, gdy paczka pojedzie.`,
    tresc:
      tabelaPozycji(zam, pozycje) +
      blokAdresu(zam.shipping_address) +
      `
          <tr><td style="padding:16px 0 0;">
            <div class="linia" style="border-top:1px solid ${BARWY.linia};font-size:0;line-height:0;">&nbsp;</div>
          </td></tr>
          <tr><td style="font-family:${KROJ};font-size:13px;line-height:1.65;padding:14px 0 0;" class="ink3">
            <strong style="font-weight:600;">Prawo odstąpienia.</strong> Masz 14 dni od odebrania rzeczy, żeby odstąpić od umowy bez podawania przyczyny. Termin liczy się od dnia, w którym paczka trafiła do Ciebie albo do wskazanej przez Ciebie osoby. Żeby zachować termin, wystarczy wysłać oświadczenie przed jego upływem.<br><br>
            Pełna treść, wzór oświadczenia i zasady reklamacji:
            <a href="${adresSklepu}/informacje/odstapienie-od-umowy" style="color:inherit;">odstąpienie od umowy</a> ·
            <a href="${adresSklepu}/informacje/zwroty-i-reklamacje" style="color:inherit;">zwroty i reklamacje</a> ·
            <a href="${adresSklepu}/informacje/regulamin" style="color:inherit;">regulamin</a> ·
            <a href="${adresSklepu}/informacje/polityka-prywatnosci" style="color:inherit;">polityka prywatności</a>
          </td></tr>`,
    przycisk: {
      etykieta: 'Zobacz zamówienie',
      adres: `${adresSklepu}/zamowienie/${encodeURIComponent(zam.order_number)}`,
    },
    stopka:
      'Dostajesz tę wiadomość, bo złożyłeś u nas zamówienie. To potwierdzenie zawarcia umowy — zachowaj je.',
    adresSklepu,
  });

  const pozycjeTekst = pozycje
    .map((p) => `  ${p.name} × ${p.qty} — ${zlote(p.line_total_cents)}`)
    .join('\n');

  const tekst = [
    `Zamówienie ${zam.order_number} przyjęte i opłacone.`,
    '',
    pozycjeTekst,
    '',
    `Wartość produktów: ${zlote(zam.subtotal_cents)}`,
    zam.discount_cents > 0 ? `Rabat: -${zlote(zam.discount_cents)}` : '',
    `Dostawa: ${zam.shipping_cents === 0 ? 'gratis' : zlote(zam.shipping_cents)}`,
    `Razem: ${zlote(zam.total_cents)}`,
    '',
    `Podgląd zamówienia: ${adresSklepu}/zamowienie/${encodeURIComponent(zam.order_number)}`,
    '',
    'Prawo odstąpienia: masz 14 dni od odebrania rzeczy, żeby odstąpić od umowy',
    'bez podawania przyczyny.',
    `Wzór oświadczenia: ${adresSklepu}/informacje/odstapienie-od-umowy`,
    `Regulamin: ${adresSklepu}/informacje/regulamin`,
  ]
    .filter((w) => w !== '')
    .join('\n');

  return { temat: `Zamówienie ${zam.order_number} — potwierdzenie`, html, tekst };
}

/**
 * Przypomnienie o koszyku, za który nikt nie zapłacił.
 *
 * Wysyłane przy `checkout.session.expired`, czyli po wygaśnięciu sesji
 * u operatora — domyślnie doba. Opóźnienia nie trzeba planować osobno:
 * samo zdarzenie przychodzi z opóźnieniem.
 *
 * UWAGA PRAWNA. Ta wiadomość zachęca do zakupu, więc jest informacją
 * handlową w rozumieniu art. 10 ustawy o świadczeniu usług drogą
 * elektroniczną — a on wymaga wcześniejszej zgody odbiorcy. Zamówienie
 * zbiera zgodę na regulamin i przetwarzanie danych, **nie** na marketing.
 * Dlatego wysyłka jest domyślnie wyłączona i włącza ją dopiero zmienna
 * `PRZYPOMNIENIE_KOSZYK=1`. Włączenie bez zebranej zgody marketingowej
 * jest decyzją właściciela, nie ustawieniem domyślnym.
 */
export function mailPorzuconegoKoszyka(
  zam: Zamowienie,
  pozycje: PozycjaZamowienia[],
  adresSklepu: string
): { temat: string; html: string; tekst: string } {
  const lista = pozycje
    .map(
      (p) =>
        `<li style="margin:0 0 4px;">${bezpieczne(p.name)} <span style="color:${BARWY.ink3};">× ${p.qty}</span></li>`
    )
    .join('');

  const html = skorupa({
    tytul: 'Koszyk czeka',
    naglowek: 'Zostawiłeś coś w koszyku',
    wstep:
      'Płatność nie doszła do końca, więc zamówienie wygasło, a rzeczy wróciły na półkę. Jeśli to była pomyłka albo zmieniłeś zdanie — złóż je jeszcze raz.',
    tresc: `
          <tr><td style="font-family:${KROJ};font-size:14px;line-height:1.6;padding:0 0 12px;" class="ink2">
            <ul style="margin:0;padding-left:18px;">${lista}</ul>
          </td></tr>
          <tr><td style="font-family:${KROJ};font-size:13px;line-height:1.6;padding:0 0 4px;" class="ink3">
            Dostępność i cena mogły się zmienić — każda rzecz jest robiona pojedynczo.
          </td></tr>`,
    przycisk: { etykieta: 'Wróć do sklepu', adres: `${adresSklepu}/sklep` },
    stopka: `Dostajesz tę wiadomość, bo zaczynałeś u nas zamówienie. Nie chcesz takich przypomnień? Odpisz „nie" na ten adres, a wypiszemy Cię ręcznie.`,
    adresSklepu,
  });

  const tekst = [
    'Zostawiłeś coś w koszyku.',
    '',
    ...pozycje.map((p) => `  ${p.name} × ${p.qty}`),
    '',
    'Płatność nie doszła do końca, więc zamówienie wygasło, a rzeczy wróciły na półkę.',
    `Sklep: ${adresSklepu}/sklep`,
  ].join('\n');

  return { temat: 'Twój koszyk czeka — dwie głowy', html, tekst };
}
