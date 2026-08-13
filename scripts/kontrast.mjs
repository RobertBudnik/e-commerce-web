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
 *   node scripts/kontrast.mjs --motyw ciemny
 */
import { readFileSync } from 'node:fs';

const plik = readFileSync(new URL('../web/app/globals.css', import.meta.url), 'utf8');

const argumenty = process.argv.slice(2);
const motyw = argumenty.includes('--motyw') ? argumenty[argumenty.indexOf('--motyw') + 1] : 'jasny';
if (!['jasny', 'ciemny'].includes(motyw)) {
  console.error(`Nieznany motyw: ${motyw}. Dozwolone: jasny, ciemny.`);
  process.exit(2);
}

/** Blok tokenów danego motywu plus deklaracje jednolinijkowe (`:root { --x: y; }`). */
function tokeny(nazwaMotywu) {
  const selektor = nazwaMotywu === 'jasny' ? ':root,\n.motyw-jasny {' : '.dark,\n.motyw-ciemny {';
  const od = plik.indexOf(selektor);
  const blok = plik.slice(od, plik.indexOf('}', od));

  const mapa = new Map();
  for (const [, nazwa, wartosc] of blok.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    mapa.set(nazwa, wartosc.trim());
  }

  // Tokeny dopisane poza głównym blokiem — `:root { --line-pole: #8a8377; }`
  const prefiks = nazwaMotywu === 'jasny' ? ':root' : '.dark';
  for (const [, sel, nazwa, wartosc] of plik.matchAll(
    /(:root|\.dark)\s*\{\s*--([\w-]+):\s*([^;]+);\s*\}/g
  )) {
    if (sel === prefiks) mapa.set(nazwa, wartosc.trim());
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

/** Co z czym się spotyka w interfejsie i jakiego progu wymaga. */
const PARY = [
  ['ink', 'bg', 4.5, 'treść na tle strony'],
  ['ink', 'surface', 4.5, 'treść na bieli'],
  ['ink', 'panel', 4.5, 'treść na beżu'],
  ['ink-2', 'bg', 4.5, 'opis na tle strony'],
  ['ink-2', 'surface', 4.5, 'opis na bieli'],
  ['ink-2', 'panel', 4.5, 'opis na beżu'],
  ['ink-3', 'bg', 4.5, 'etykieta na tle strony'],
  ['ink-3', 'surface', 4.5, 'etykieta na bieli'],
  ['ink-3', 'panel', 4.5, 'etykieta na beżu'],
  ['accent', 'bg', 4.5, 'akcent na tle strony'],
  ['accent', 'surface', 4.5, 'akcent na bieli'],
  ['accent', 'panel', 4.5, 'akcent na beżu'],
  ['accent-ink', 'bg', 4.5, 'drobny napis akcentem'],
  ['accent-ink', 'accent-soft', 4.5, 'napis na znaczniku przeceny'],
  ['ok-ink', 'ok-soft', 4.5, 'napis „opłacone" na zielonym'],
  ['btn-ink', 'btn-bg', 4.5, 'napis na przycisku głównym'],
  ['line-pole', 'bg', 3, 'obwódka pola na tle strony'],
  ['line-pole', 'surface', 3, 'obwódka pola na bieli'],
  ['line-pole', 'panel', 3, 'obwódka pola na beżu'],
  ['line-pole', 'panel', 3, 'obrys przycisku ghost na beżu'],
  ['etykieta', 'panel', 4.5, 'nadtytuł na beżu'],
];

let upadlo = 0;
console.log(`\n  motyw: ${motyw}\n`);

for (const [przod, tlo, prog, opis] of PARY) {
  const wynik = kontrast(przod, tlo);
  if (wynik === null) {
    console.log(`  ·  ${opis.padEnd(34)} — nie policzono (${przod} / ${tlo})`);
    continue;
  }
  const zdane = wynik >= prog;
  if (!zdane) upadlo += 1;
  console.log(
    `  ${zdane ? '✓' : '✗'}  ${opis.padEnd(34)} ${wynik.toFixed(2)}:1  (próg ${prog.toFixed(1)})`
  );
}

console.log(
  upadlo
    ? `\n  ${upadlo} par poniżej progu.\n`
    : '\n  Cała paleta nad progiem.\n'
);

process.exit(upadlo ? 1 : 0);
