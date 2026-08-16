#!/usr/bin/env node
/**
 * Kontrast palety liczony z tokenów w `web/app/globals.css`.
 *
 * Nie z DOM-u: wartości bywają zapisane jako `rgba()` z przezroczystością,
 * a przeglądarka odda wtedy kolor kanału, nie to, co widzi oko na tle. Tu
 * półprzezroczyste linie i tła są najpierw składane z powierzchnią, na której
 * leżą, i dopiero taki wynik idzie do wzoru z WCAG.
 *
 * Progi:
 *   4.5:1  tekst do 18 px (AA)
 *   3.0:1  tekst od 24 px, obwódki kontrolek i elementy nietekstowe (AA)
 *
 * Użycie:
 *   node scripts/kontrast.mjs
 *   node scripts/kontrast.mjs --paleta magazyn
 *   node scripts/kontrast.mjs --motyw ciemny
 */
import { readFileSync } from 'node:fs';

const plik = readFileSync(new URL('../web/app/globals.css', import.meta.url), 'utf8');

const argumenty = process.argv.slice(2);
const wartoscFlagi = (nazwa, domyslna) =>
  argumenty.includes(nazwa) ? argumenty[argumenty.indexOf(nazwa) + 1] : domyslna;

const motyw = wartoscFlagi('--motyw', 'jasny');
if (!['jasny', 'ciemny'].includes(motyw)) {
  console.error(`Nieznany motyw: ${motyw}. Dozwolone: jasny, ciemny.`);
  process.exit(2);
}

const paleta = wartoscFlagi('--paleta', 'sklep');
if (!['sklep', 'magazyn'].includes(paleta)) {
  console.error(`Nieznana paleta: ${paleta}. Dozwolone: sklep, magazyn.`);
  process.exit(2);
}

/** Deklaracje `--x: y;` z jednego bloku, licząc od podanego selektora. */
function zBloku(selektor) {
  const od = plik.indexOf(selektor);
  if (od < 0) throw new Error(`Nie znaleziono bloku: ${selektor}`);
  const blok = plik.slice(od, plik.indexOf('}', od));
  return [...blok.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, n, w]) => [n, w.trim()]);
}

/** Blok tokenów danego motywu plus deklaracje jednolinijkowe (`:root { --x: y; }`). */
function tokeny(nazwaMotywu) {
  const mapa = new Map(
    zBloku(nazwaMotywu === 'jasny' ? ':root,\n.motyw-jasny {' : '.dark,\n.motyw-ciemny {')
  );

  // Tokeny dopisane poza głównym blokiem — `:root { --line-pole: #8a8377; }`
  const prefiks = nazwaMotywu === 'jasny' ? ':root' : '.dark';
  for (const [, sel, nazwa, wartosc] of plik.matchAll(
    /(:root|\.dark)\s*\{\s*--([\w-]+):\s*([^;]+);\s*\}/g
  )) {
    if (sel === prefiks) mapa.set(nazwa, wartosc.trim());
  }

  // Magazyn stoi na palecie Apple, nie na palecie sklepu, ale nie podmienia
  // wszystkiego — `.mag` przykrywa część tokenów, a reszta zostaje odziedziczona
  // po stronie. Dlatego nakładamy jego blok na komplet sklepowy zamiast czytać
  // go osobno: inaczej wynik mierzyłby kolory, których na tym ekranie nie ma.
  if (paleta === 'magazyn') {
    for (const [n, w] of zBloku('\n.mag {')) mapa.set(n, w);
    if (nazwaMotywu === 'ciemny') for (const [n, w] of zBloku('.dark .mag {')) mapa.set(n, w);
  }

  return mapa;
}

const PALETA = tokeny(motyw);

/** `#rgb`, `#rrggbb` albo `rgba(r, g, b, a)` → [r, g, b, a]. */
function kolor(wartosc, glebokosc = 0) {
  if (glebokosc > 4) return null;

  const odwolanie = wartosc.match(/var\(\s*--([\w-]+)/);
  if (odwolanie) {
    const dalej = PALETA.get(odwolanie[1]);
    return dalej ? kolor(dalej, glebokosc + 1) : null;
  }

  const hex = wartosc.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((z) => z + z).join('') : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }

  const rgba = wartosc.match(/rgba?\(([^)]+)\)/i);
  if (rgba) {
    const [r, g, b, a = '1'] = rgba[1].split(',').map((c) => c.trim());
    return [Number(r), Number(g), Number(b), Number(a)];
  }

  // oklch() i inne przestrzenie pomijamy świadomie — w tej palecie ich nie ma,
  // a przeliczanie ich tutaj znaczyłoby drugą implementację obok przeglądarki.
  return null;
}

/** Półprzezroczysty kolor na tle → kolor widziany. */
function zloz(wierzch, spod) {
  const a = wierzch[3];
  return [0, 1, 2].map((i) => Math.round(wierzch[i] * a + spod[i] * (1 - a)));
}

function luminancja([r, g, b]) {
  const k = [r, g, b]
    .map((c) => c / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
}

function kontrast(nazwaPrzod, nazwaTlo) {
  const przod = kolor(PALETA.get(nazwaPrzod) ?? '');
  const tlo = kolor(PALETA.get(nazwaTlo) ?? '');
  if (!przod || !tlo) return null;

  // Półprzezroczyste tło (np. `--ok-soft`) leży na tle strony, nie na bieli.
  // Składanie z bielą dawało w ciemnym motywie wyniki oderwane od tego, co
  // widać na ekranie — jasny podkład pod ciemnym interfejsem.
  const strona = kolor(PALETA.get('bg') ?? '#ffffff') ?? [255, 255, 255, 1];
  const podklad = zloz(tlo, strona);
  const widoczny = zloz(przod, podklad);

  const [a, b] = [luminancja(widoczny), luminancja(podklad)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

/** Co z czym się spotyka w magazynie. Inna paleta, inne powierzchnie:
 *  treść leży tam na białej karcie (`--surface`) albo na tle listy (`--bg`),
 *  a nie na trzech powierzchniach sklepu. */
const PARY_MAGAZYN = [
  ['ink', 'surface', 4.5, 'etykieta na karcie'],
  ['ink', 'bg', 4.5, 'etykieta na tle listy'],
  ['ink-2', 'surface', 4.5, 'podpis na karcie'],
  ['ink-2', 'bg', 4.5, 'podpis na tle listy'],
  // Trzeci stopień tuszu niesie placeholdery i ikony w polu szukania — nigdy
  // treść, którą trzeba przeczytać, żeby wiedzieć, co robić. Apple trzyma go
  // na 30% i to jest wartość z systemu, nie nasza pomyłka.
  ['ink-faint', 'surface', 4.5, 'placeholder na karcie', 'wyjątek: nie niesie treści'],
  ['accent-ink', 'surface', 4.5, 'sienna na karcie'],
  ['accent-ink', 'bg', 4.5, 'sienna na tle listy'],
  ['na-akcencie', 'accent', 4.5, 'napis na przycisku siennym'],
  ['ok-ink', 'surface', 4.5, 'korekta dodatnia'],
  ['blad', 'surface', 4.5, 'komunikat błędu na karcie'],
  ['blad', 'bg', 4.5, 'komunikat błędu na tle listy'],
  ['uwaga', 'surface', 4.5, 'stan przy progu', 'wyjątek: dioda ma podpis słowny'],
  // Separator w liście grupowanej rozdziela wiersze, ale nie niesie treści —
  // wiersz czyta się bez niego. SC 1.4.11 go nie obejmuje.
  ['line', 'surface', 3, 'separator w liście', 'wyjątek: rozdziela, nie informuje'],
];

/** Co z czym się spotyka w interfejsie i jakiego progu wymaga. */
const PARY_SKLEP = [
  ['ink', 'bg', 4.5, 'treść na tle strony'],
  ['ink', 'surface', 4.5, 'treść na bieli'],
  ['ink', 'panel', 4.5, 'treść na panelu'],
  ['ink-2', 'bg', 4.5, 'opis na tle strony'],
  ['ink-2', 'surface', 4.5, 'opis na bieli'],
  ['ink-2', 'panel', 4.5, 'opis na panelu'],
  ['ink-3', 'bg', 4.5, 'etykieta na tle strony'],
  ['ink-3', 'surface', 4.5, 'etykieta na bieli'],
  ['ink-3', 'panel', 4.5, 'etykieta na panelu'],
  // `--accent` nie nosi liter — tekst bierze `--accent-ink`, a akcent
  // został przy wypełnieniach, obwódkach, gwiazdkach oceny i ikonach.
  // Stąd próg 3:1 z SC 1.4.11, nie 4,5:1.
  //
  // Gwiazdki i serce nie dobijają nawet do 3:1 i to jest świadome:
  // ocena stoi obok liczby („4,8 · 412 opinii"), a serce ma `aria-pressed`
  // i podpis, więc kolor nie jest tam jedynym nośnikiem informacji —
  // wypełnienie kształtu niesie ją tak samo. Oznaczone jako wyjątek, żeby
  // nie znikło z widoku i nie udawało, że przechodzi.
  ['accent', 'bg', 3, 'ikony na tle strony', 'wyjątek: kształt niesie treść'],
  ['accent', 'surface', 3, 'ikony na bieli', 'wyjątek: kształt niesie treść'],
  ['accent', 'panel', 3, 'ikony na panelu', 'wyjątek: kształt niesie treść'],
  ['accent-ink', 'bg', 4.5, 'drobny napis akcentem'],
  ['accent-ink', 'accent-soft', 4.5, 'napis na znaczniku przeceny'],
  ['ok-ink', 'ok-soft', 4.5, 'napis „opłacone" na zielonym'],
  ['btn-ink', 'btn-bg', 4.5, 'napis na przycisku głównym'],
  // Wypełnienie akcentem nosi litery w dwóch miejscach — aktywny filtr
  // i plakietka koszyka. Para wpisana po tym, jak zrzut pokazał jasny napis
  // na tanie: audyt mierzył wtedy tylko przycisk główny i tego nie widział.
  ['na-akcencie', 'accent', 4.5, 'napis na wypełnieniu akcentem'],
  ['line-pole', 'bg', 3, 'obwódka pola na tle strony'],
  ['line-pole', 'surface', 3, 'obwódka pola na bieli'],
  ['line-pole', 'panel', 3, 'obwódka pola na panelu'],
  ['line-pole', 'panel', 3, 'obrys przycisku ghost na panelu'],
  ['etykieta', 'panel', 4.5, 'nadtytuł na panelu'],
];

const PARY = paleta === 'magazyn' ? PARY_MAGAZYN : PARY_SKLEP;

let upadlo = 0;
console.log(`\n  paleta: ${paleta} · motyw: ${motyw}\n`);

for (const [przod, tlo, prog, opis, wyjatek] of PARY) {
  const wynik = kontrast(przod, tlo);
  if (wynik === null) {
    console.log(`  ·  ${opis.padEnd(34)} — nie policzono (${przod} / ${tlo})`);
    continue;
  }
  const zdane = wynik >= prog;
  // Wyjątek nie psuje kodu wyjścia, ale zostaje na liście ze znakiem `~`
  // i powodem — inaczej po miesiącu nikt nie pamięta, dlaczego przechodzi.
  if (!zdane && !wyjatek) upadlo += 1;
  const znak = zdane ? '✓' : wyjatek ? '~' : '✗';
  const ogon = !zdane && wyjatek ? `  ${wyjatek}` : '';
  console.log(
    `  ${znak}  ${opis.padEnd(34)} ${wynik.toFixed(2)}:1  (próg ${prog.toFixed(1)})${ogon}`
  );
}

console.log(
  upadlo
    ? `\n  ${upadlo} par poniżej progu.\n`
    : '\n  Cała paleta nad progiem.\n'
);

process.exit(upadlo ? 1 : 0);
