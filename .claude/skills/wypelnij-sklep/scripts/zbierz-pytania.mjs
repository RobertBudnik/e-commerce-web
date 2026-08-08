#!/usr/bin/env node
/**
 * Zbiera wszystkie miejsca w repozytorium, które czekają na wypełnienie.
 *
 * Szuka znacznika `⟨…⟩` w plikach źródłowych i przy każdym trafieniu wyciąga
 * trzy rzeczy: gdzie siedzi (plik, blok, pole), co ma tam trafić (treść
 * znacznika) i dlaczego to istotne (komentarz stojący nad polem). Ten komentarz
 * jest najważniejszy — bez niego wywiad zamienia się w wyliczankę nazw
 * zmiennych, a właściciel sklepu nie ma jak ocenić, co odpowiedzieć.
 *
 * Lista pytań nie jest tu wpisana na sztywno celowo. Konfiguracja sklepu będzie
 * rosła, a wywiad przepisany ręcznie rozjedzie się z nią po pierwszym nowym
 * polu i nikt tego nie zauważy, bo skrypt dalej będzie coś wypisywał.
 *
 * Użycie:
 *   node .claude/skills/wypelnij-sklep/scripts/zbierz-pytania.mjs
 *   node .claude/skills/wypelnij-sklep/scripts/zbierz-pytania.mjs --json
 *   node .claude/skills/wypelnij-sklep/scripts/zbierz-pytania.mjs --blok MARKA
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const TU = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(TU, '..', '..', '..', '..');

/** Katalogi, w których szukamy. Reszta repozytorium nie opisuje sklepu. */
const SZUKAJ_W = ['web/lib', 'web/app', 'web/components', 'docs'];
const ROZSZERZENIA = ['.ts', '.tsx', '.md'];

/** Znacznik pola do wypełnienia. Nawiasy kątowe, nie zwykłe — nie kolidują z JSX. */
const ZNACZNIK = /⟨([^⟩]+)⟩/g;

function pliki(katalog) {
  const pelna = join(ROOT, katalog);
  if (!existsSync(pelna)) return [];
  const wynik = [];
  const chodz = (kat) => {
    for (const wpis of readdirSync(kat, { withFileTypes: true })) {
      if (wpis.name === 'node_modules' || wpis.name.startsWith('.')) continue;
      const p = join(kat, wpis.name);
      if (wpis.isDirectory()) chodz(p);
      else if (ROZSZERZENIA.some((r) => wpis.name.endsWith(r))) wynik.push(p);
    }
  };
  chodz(pelna);
  return wynik;
}

/**
 * Komentarz opisujący pole — blok `/** … *\/` albo ciąg linii `//` bezpośrednio
 * nad polem. Pusta linia przerywa ciąg: komentarz oddzielony przerwą odnosi się
 * do czegoś innego i wklejony do pytania tylko wprowadzałby w błąd.
 */
function komentarzNad(linie, indeks) {
  const zebrane = [];
  for (let i = indeks - 1; i >= 0; i--) {
    const l = linie[i].trim();
    if (l === '') break;
    if (l.startsWith('*/')) continue;
    if (l.startsWith('*')) {
      zebrane.unshift(l.replace(/^\*\s?/, ''));
      continue;
    }
    if (l.startsWith('/**')) {
      zebrane.unshift(l.replace(/^\/\*\*\s?/, ''));
      break;
    }
    if (l.startsWith('//')) {
      zebrane.unshift(l.replace(/^\/\/\s?/, ''));
      continue;
    }
    break;
  }
  return zebrane
    .join(' ')
    .replace(/\*\/\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nazwa bloku (`export const MARKA = {`) obowiązująca w danej linii. */
function blokDla(linie, indeks) {
  for (let i = indeks; i >= 0; i--) {
    const m = linie[i].match(/^export const ([A-Z_]+)\s*[:=]/);
    if (m) return m[1];
    // Nagłówek sekcji w pliku markdown też jest blokiem — dla docs/.
    const md = linie[i].match(/^#{1,3}\s+(.+)$/);
    if (md) return md[1].trim();
  }
  return '(poza blokiem)';
}

/**
 * Nazwa pola, do którego należy dany znacznik. Szuka najbliższego `klucz:`
 * *przed* pozycją znacznika, a nie na początku linii — w tablicach obiektów
 * kilka pól siedzi w jednej linii (`{ tytul: '⟨…⟩', opis: '⟨…⟩' }`) i wersja
 * liczona od początku linii przypisywałaby oba znaczniki do `tytul`.
 */
function poleDlaZnacznika(linia, pozycja) {
  const przed = linia.slice(0, pozycja);
  const klucze = [...przed.matchAll(/([a-zA-Z_][\w]*)\s*:/g)];
  if (klucze.length) return klucze[klucze.length - 1][1];
  const md = przed.match(/^\s*-\s*([^:]+):/);
  return md ? md[1].trim() : null;
}

const znaleziska = [];

for (const katalog of SZUKAJ_W) {
  for (const sciezka of pliki(katalog)) {
    const tresc = readFileSync(sciezka, 'utf8');
    if (!tresc.includes('⟨')) continue;
    const linie = tresc.split('\n');

    linie.forEach((linia, i) => {
      // Linie komentarza opisują konwencję, a nie pole do wypełnienia —
      // inaczej nagłówek pliku zgłaszałby własny przykład jako pytanie.
      const przyciete = linia.trim();
      if (/^(\*|\/\/|\/\*)/.test(przyciete)) return;

      for (const m of linia.matchAll(ZNACZNIK)) {
        znaleziska.push({
          plik: relative(ROOT, sciezka),
          linia: i + 1,
          blok: blokDla(linie, i),
          pole: poleDlaZnacznika(linia, m.index ?? 0),
          pytanie: m[1].trim(),
          dlaczego: komentarzNad(linie, i),
        });
      }
    });
  }
}

// --- wyjście --------------------------------------------------------------

const argumenty = process.argv.slice(2);
const jakoJson = argumenty.includes('--json');
const filtrBlok = argumenty.includes('--blok')
  ? argumenty[argumenty.indexOf('--blok') + 1]
  : null;

const wynik = filtrBlok ? znaleziska.filter((z) => z.blok === filtrBlok) : znaleziska;

if (jakoJson) {
  console.log(JSON.stringify({ ile: wynik.length, znaleziska: wynik }, null, 2));
} else if (wynik.length === 0) {
  console.log('\n  Nie ma czego wypełniać — żadnego znacznika ⟨…⟩ w repozytorium.\n');
} else {
  const bloki = [...new Set(wynik.map((z) => z.blok))];
  for (const blok of bloki) {
    const wBloku = wynik.filter((z) => z.blok === blok);
    console.log(`\n  ${blok}  (${wBloku.length})`);
    for (const z of wBloku) {
      console.log(`    ${z.pole ?? '—'}: ${z.pytanie}`);
      if (z.dlaczego) console.log(`      ↳ ${z.dlaczego}`);
      console.log(`      ${z.plik}:${z.linia}`);
    }
  }
  console.log(`\n  Razem ${wynik.length} pól w ${bloki.length} blokach.\n`);
}
