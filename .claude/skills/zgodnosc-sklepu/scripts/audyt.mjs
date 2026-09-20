#!/usr/bin/env node
/**
 * Audyt zgodności sklepu.
 *
 * Sprawdza ustalenia po wzorcach w kodzie, nie po numerach linii — dzięki temu
 * przeżywa refaktor i nie trzeba go poprawiać po każdym przesunięciu importu.
 *
 * Wynik:
 *   otwarte    — brak jest na miejscu
 *   zamkniete  — naprawione
 *   odroczone  — czeka na tożsamość sprzedawcy, nie da się ruszyć teraz
 *   decyzja    — skrypt nie rozstrzygnie, potrzebna odpowiedź właściciela
 *   nieznane   — nie dało się ocenić (brak pliku, zmieniona struktura)
 *
 * Dwa etapy, bo sklep bez sprzedawcy i bez towaru niczego nie narusza —
 * obowiązki konsumenckie wchodzą przy pierwszej sprzedaży. Zanim to nastąpi,
 * blokowanie pracy na brakującym NIP-ie jest szumem, nie ostrożnością.
 *
 *   --etap projekt   (domyślny) — liczą się wyłącznie braki możliwe do naprawy
 *                    z samego kodu; punkty zależne od tożsamości sprzedawcy
 *                    pokazują się jako `odroczone` i nie psują kodu wyjścia
 *   --etap sprzedaz  — przed wpuszczeniem prawdziwego ruchu; liczy się wszystko
 *
 * Kod wyjścia 1, gdy została otwarta blokada licząca się na danym etapie.
 *
 * Użycie:
 *   node .claude/skills/zgodnosc-sklepu/scripts/audyt.mjs
 *   node .claude/skills/zgodnosc-sklepu/scripts/audyt.mjs --etap sprzedaz
 *   node .claude/skills/zgodnosc-sklepu/scripts/audyt.mjs --json
 *   node .claude/skills/zgodnosc-sklepu/scripts/audyt.mjs --waga blokada
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const TU = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(TU, '..', '..', '..', '..');

// --- odczyt ---------------------------------------------------------------

const pamiec = new Map();

/** Treść pliku albo null. Pusty string to prawidłowa treść, null to brak pliku. */
function plik(sciezka) {
  if (pamiec.has(sciezka)) return pamiec.get(sciezka);
  const pelna = join(ROOT, sciezka);
  const tresc = existsSync(pelna) && statSync(pelna).isFile()
    ? readFileSync(pelna, 'utf8')
    : null;
  pamiec.set(sciezka, tresc);
  return tresc;
}

/** Zlepek treści wszystkich plików w katalogu (rekurencyjnie), po rozszerzeniu. */
function katalog(sciezka, rozszerzenia = ['.ts', '.tsx', '.sql', '.mjs']) {
  const klucz = `dir:${sciezka}:${rozszerzenia.join(',')}`;
  if (pamiec.has(klucz)) return pamiec.get(klucz);
  const pelna = join(ROOT, sciezka);
  let zlepek = '';
  const chodz = (kat) => {
    if (!existsSync(kat)) return;
    for (const wpis of readdirSync(kat, { withFileTypes: true })) {
      if (wpis.name === 'node_modules' || wpis.name.startsWith('.')) continue;
      const p = join(kat, wpis.name);
      if (wpis.isDirectory()) chodz(p);
      else if (rozszerzenia.some((r) => wpis.name.endsWith(r))) {
        zlepek += `\n/* ${p} */\n` + readFileSync(p, 'utf8');
      }
    }
  };
  chodz(pelna);
  pamiec.set(klucz, zlepek);
  return zlepek;
}

const ma = (tresc, wzor) =>
  typeof tresc === 'string' && (wzor instanceof RegExp ? wzor.test(tresc) : tresc.includes(wzor));

/** Skrót na najczęstszy kształt: brak pliku → nieznane, wzorzec → otwarte. */
function gdy(tresc, warunek) {
  if (tresc === null) return 'nieznane';
  return warunek ? 'otwarte' : 'zamkniete';
}

// --- ustalenia ------------------------------------------------------------

const STRONY = 'web/lib/strony-informacyjne.ts';
const KOSZYK = 'web/components/cart/CartPage.tsx';
const INFO_STRONA = 'web/app/informacje/[temat]/page.tsx';
const TRYB = 'web/lib/store-mode.ts';
const GLOWNA = 'web/app/page.tsx';
const STOPKA = 'web/components/layout/SiteFooter.tsx';
const MAPA = 'web/app/sitemap.ts';
const DANE = 'docs/dane-sprzedawcy.md';

const USTALENIA = [
  {
    id: 'todo-publiczne',
    waga: 'blokada',
    nazwa: 'Blok „do uzupełnienia" widoczny dla klienta',
    gdzie: INFO_STRONA,
    ocena() {
      const t = plik(INFO_STRONA);
      if (t === null) return 'nieznane';
      const renderuje = ma(t, /doUzupelnienia\.length\s*>\s*0/);
      const bramka = ma(t, /NODE_ENV|rola|admin|zarzadc|user_role/i);
      return gdy(t, renderuje && !bramka);
    },
  },
  {
    id: 'zgoda-regulamin',
    waga: 'blokada',
    nazwa: 'Brak akceptacji regulaminu przy składaniu zamówienia',
    gdzie: KOSZYK,
    ocena: () => gdy(plik(KOSZYK), !ma(plik(KOSZYK), /informacje\/regulamin/)),
  },
  {
    id: 'klauzula-rodo',
    etap: 'sprzedaz',
    waga: 'blokada',
    nazwa: 'Brak klauzuli RODO w miejscu zbierania danych',
    gdzie: KOSZYK,
    ocena: () => gdy(plik(KOSZYK), !ma(plik(KOSZYK), /polityka-prywatnosci/)),
  },
  {
    id: 'pouczenie-odstapienie',
    waga: 'blokada',
    nazwa: 'Brak pouczenia o prawie odstąpienia przed zamówieniem',
    gdzie: KOSZYK,
    ocena: () => gdy(plik(KOSZYK), !ma(plik(KOSZYK), /odst[ąa]pien/i)),
  },
  {
    id: 'dane-zebrane',
    etap: 'sprzedaz',
    waga: 'blokada',
    nazwa: 'Dane sprzedawcy nie zostały zebrane od właściciela',
    gdzie: DANE,
    ocena() {
      const t = plik(DANE);
      if (t === null) return 'otwarte';
      return gdy(t, ma(t, /⟨DO UZUPEŁNIENIA/));
    },
  },
  {
    id: 'dane-na-stronie',
    etap: 'sprzedaz',
    waga: 'blokada',
    nazwa: 'Dane sprzedawcy (NIP, adres) nie pokazują się w sklepie',
    gdzie: `${STOPKA} / ${STRONY}`,
    ocena() {
      const zlepek = (plik(STOPKA) ?? '') + (plik(STRONY) ?? '');
      if (!zlepek) return 'nieznane';
      // Samo słowo „NIP" nie wystarcza — pada też na liście rzeczy do
      // uzupełnienia. Szukamy numeru: dziesięć cyfr, z myślnikami lub bez.
      const numer = /NIP\D{0,4}\d{3}[-\s]?\d{3}[-\s]?\d{2}[-\s]?\d{2}/;
      return gdy(zlepek, !ma(zlepek, numer));
    },
  },
  {
    id: 'regulamin-tresc',
    etap: 'sprzedaz',
    waga: 'blokada',
    nazwa: 'Regulamin to szkielet, nie dokument',
    gdzie: STRONY,
    ocena() {
      const t = plik(STRONY);
      if (t === null) return 'nieznane';
      const od = t.indexOf('regulamin: {');
      if (od === -1) return 'nieznane';
      const reszta = t.slice(od);
      const koniec = reszta.indexOf("\n  '");
      const blok = koniec === -1 ? reszta : reszta.slice(0, koniec);
      const sekcje = (blok.match(/naglowek:/g) ?? []).length;
      // Minimum sensownego regulaminu: strony umowy, zawarcie umowy, płatność,
      // dostawa, odstąpienie, reklamacje, dane osobowe, zmiany regulaminu.
      return gdy(t, sekcje < 6);
    },
  },
  {
    id: 'dostawa-rozjazd',
    etap: 'sprzedaz',
    waga: 'wysokie',
    nazwa: 'Reklamowana forma dostawy, której nie da się wybrać',
    gdzie: `${STRONY} / ${KOSZYK}`,
    ocena() {
      const s = plik(STRONY);
      const k = plik(KOSZYK);
      if (s === null || k === null) return 'nieznane';
      const obiecana = ma(s, /Paczkomat/i);
      const wybieralna = ma(k, /dostaw|shipping_method|przewoznik/i) && ma(k, /radio|select|name="dostawa"/);
      return gdy(s, obiecana && !wybieralna);
    },
  },
  {
    id: 'usuniecie-konta',
    waga: 'wysokie',
    nazwa: 'Polityka obiecuje usunięcie konta, funkcji nie ma',
    gdzie: STRONY,
    ocena() {
      const s = plik(STRONY);
      if (s === null) return 'nieznane';
      const obietnica = ma(s, /usun[ąa][ćc] konto/i);
      const kod = katalog('web/app/actions') + katalog('supabase/migrations');
      const wdrozone = ma(kod, /usun_konto|usunKonto|delete_account|usuniecie_konta/i);
      return gdy(s, obietnica && !wdrozone);
    },
  },
  {
    id: 'procesory-ujawnione',
    etap: 'sprzedaz',
    waga: 'wysokie',
    nazwa: 'Sentry i pozostali odbiorcy danych nieujawnieni w polityce',
    gdzie: STRONY,
    ocena() {
      const s = plik(STRONY);
      const cfg = plik('web/next.config.ts');
      if (s === null) return 'nieznane';
      const jestSentry = ma(cfg, /SENTRY_DSN/);
      return gdy(s, jestSentry && !ma(s, /Sentry/i));
    },
  },
  {
    id: 'zgodnosc-towaru',
    waga: 'wysokie',
    nazwa: 'Rękojmia zlana z gwarancją — brak reżimu ustawowego',
    gdzie: STRONY,
    // `\w` w JS nie obejmuje polskich znaków, więc „zgodność" wypadałaby
    // z dopasowania. Stąd `\S*` zamiast `\w*` w każdym wzorcu z odmianą.
    ocena: () => gdy(plik(STRONY), !ma(plik(STRONY), /(nie)?zgodno\S* towaru z umow/i)),
  },
  {
    id: 'historia-cen',
    waga: 'wysokie',
    nazwa: 'Omnibus — rabat bez najniższej ceny z 30 dni',
    gdzie: 'supabase/migrations',
    ocena() {
      const m = katalog('supabase/migrations', ['.sql']);
      if (!m) return 'nieznane';
      const uzywaOldPrice = ma(m, /old_price_cents/);
      const jestHistoria = ma(m, /historia_cen|price_history|ceny_historia|najnizsza_cena/i);
      return gdy(m, uzywaOldPrice && !jestHistoria);
    },
  },
  {
    id: 'gpsr',
    waga: 'wysokie',
    nazwa: 'GPSR — brak danych producenta i ostrzeżeń przy produkcie',
    gdzie: 'supabase/migrations',
    ocena() {
      const m = katalog('supabase/migrations', ['.sql']);
      if (!m) return 'nieznane';
      return gdy(m, !ma(m, /producent|manufacturer|importer|ostrzezenia/i));
    },
  },
  {
    id: 'potwierdzenie-umowy',
    etap: 'sprzedaz',
    waga: 'wysokie',
    nazwa: 'Obiecany e-mail potwierdzający nie istnieje (trwały nośnik)',
    gdzie: 'web/app/zamowienie/[numer]/page.tsx',
    ocena() {
      const t = plik('web/app/zamowienie/[numer]/page.tsx');
      if (t === null) return 'nieznane';
      const obietnica = ma(t, /potwierdzenie idzie na e-mail|na e-mail/i);
      const kod = katalog('web/app') + katalog('supabase/functions', ['.ts']);
      const mailer = ma(kod, /resend|nodemailer|sendgrid|postmark|wyslijMail|send_email/i);
      return gdy(t, obietnica && !mailer);
    },
  },
  {
    id: 'odr-nieaktualne',
    waga: 'srednie',
    nazwa: 'Odesłanie do platformy ODR (wygaszona 20.07.2025)',
    gdzie: STRONY,
    ocena: () => gdy(plik(STRONY), ma(plik(STRONY), /\bODR\b/)),
  },
  {
    id: 'newsletter-zgoda',
    waga: 'srednie',
    nazwa: 'Newsletter bez zgody marketingowej i bez obsługi',
    gdzie: GLOWNA,
    ocena() {
      const t = plik(GLOWNA);
      if (t === null) return 'nieznane';
      const jest = ma(t, /Newsletter/);
      const zgoda = ma(t, /zgod/i);
      return gdy(t, jest && !zgoda);
    },
  },
  {
    id: 'plasowanie',
    waga: 'srednie',
    nazwa: 'Brak informacji o kryteriach plasowania ofert (tryb catalog)',
    gdzie: 'web/app/sklep/page.tsx',
    ocena: () =>
      gdy(plik('web/app/sklep/page.tsx'), !ma(plik('web/app/sklep/page.tsx'), /plasowan|kryteri/i)),
  },
  // --- spójność trybu sprzedaży ---
  {
    id: 'tryb-martwy-kod',
    waga: 'blokada',
    nazwa: 'Tryb single nie wyróżnia produktu — wyroznionyProdukt() nieużywany',
    gdzie: TRYB,
    ocena() {
      const t = plik(TRYB);
      if (t === null) return 'nieznane';
      const uzycia = (katalog('web').match(/wyroznionyProdukt/g) ?? []).length;
      // Jedno wystąpienie to sama definicja — nikt tego nie woła.
      return gdy(t, uzycia <= 1);
    },
  },
  {
    id: 'tryb-linki-glowna',
    waga: 'wysokie',
    nazwa: 'Strona główna linkuje do /sklep niezależnie od trybu',
    gdzie: GLOWNA,
    ocena() {
      const t = plik(GLOWNA);
      if (t === null) return 'nieznane';
      return gdy(t, ma(t, /href="\/sklep/) && !ma(t, /storeMode/));
    },
  },
  {
    id: 'tryb-linki-stopka',
    waga: 'wysokie',
    nazwa: 'Stopka linkuje do /sklep niezależnie od trybu',
    gdzie: STOPKA,
    ocena() {
      const t = plik(STOPKA);
      if (t === null) return 'nieznane';
      return gdy(t, ma(t, /href="\/sklep/) && !ma(t, /storeMode|tryb/));
    },
  },
  {
    id: 'tryb-sitemap',
    waga: 'srednie',
    nazwa: 'Mapa strony zgłasza /sklep i produkty spoza aktywnej oferty',
    gdzie: MAPA,
    ocena() {
      const t = plik(MAPA);
      if (t === null) return 'nieznane';
      return gdy(t, ma(t, /\/sklep/) && !ma(t, /storeMode/));
    },
  },
  {
    id: 'tryb-podglad',
    waga: 'wysokie',
    nazwa: 'Podgląd ?mode= dostępny dla każdego, nie tylko dla zarządcy',
    gdzie: TRYB,
    ocena() {
      const t = plik(TRYB);
      if (t === null) return 'nieznane';
      const czyta = ma(t, /params\?\.mode|params\.mode/);
      const bramka = ma(t, /admin|rola|user_role|zarzadc/i);
      return gdy(t, czyta && !bramka);
    },
  },
  {
    id: 'tryb-w-zamowieniu',
    waga: 'wysokie',
    nazwa: 'Zamówienie nie zapisuje trybu ani wersji regulaminu',
    gdzie: 'supabase/migrations',
    ocena() {
      const m = katalog('supabase/migrations', ['.sql']);
      if (!m) return 'nieznane';
      const tryb = ma(m, /tryb_sprzedazy|store_mode/i);
      const wersja = ma(m, /wersja_regulaminu|regulamin_wersja|terms_version/i);
      return gdy(m, !(tryb && wersja));
    },
  },
  {
    id: 'tryb-slad',
    waga: 'srednie',
    nazwa: 'Zmiana trybu nie zostawia śladu w zdarzeniach sklepu',
    gdzie: 'supabase/migrations',
    ocena() {
      const m = katalog('supabase/migrations', ['.sql']);
      if (!m) return 'nieznane';
      const saZdarzenia = ma(m, /zdarzenia/i);
      return gdy(m, saZdarzenia && !ma(m, /zmiana_trybu|tryb_zmieniony/i));
    },
  },
  // --- wymagają decyzji właściciela ---
  {
    id: 'twierdzenia-handlowe',
    waga: 'decyzja',
    nazwa: 'Obietnice bez pokrycia: 120 000 zamówień, 24 h, 2 lata door-to-door',
    gdzie: `${STOPKA} / ${GLOWNA} / web/components/product/TrustBlock.tsx`,
    ocena() {
      const zlepek =
        (plik(STOPKA) ?? '') + (plik(GLOWNA) ?? '') + (plik('web/components/product/TrustBlock.tsx') ?? '');
      if (!zlepek) return 'nieznane';
      return ma(zlepek, /120 000|120\b.*zam[óo]wie|door-to-door|Wysyłka w 24/i) ? 'decyzja' : 'zamkniete';
    },
  },
  {
    id: 'oceny-z-ziarna',
    waga: 'decyzja',
    nazwa: 'Oceny i liczby opinii z ziarna wyświetlane jak prawdziwe',
    gdzie: 'scripts/seed-data.mjs',
    ocena() {
      const t = plik('scripts/seed-data.mjs');
      if (t === null) return 'nieznane';
      return ma(t, /rating/) ? 'decyzja' : 'zamkniete';
    },
  },
];

// --- wyjście --------------------------------------------------------------

const KOLEJNOSC = { blokada: 0, wysokie: 1, srednie: 2, decyzja: 3 };
const ZNAK = { otwarte: '✗', zamkniete: '✓', odroczone: '~', decyzja: '?', nieznane: '·' };

const argumenty = process.argv.slice(2);
const jakoJson = argumenty.includes('--json');
const filtrWaga = argumenty.includes('--waga')
  ? argumenty[argumenty.indexOf('--waga') + 1]
  : null;
const etap = argumenty.includes('--etap')
  ? argumenty[argumenty.indexOf('--etap') + 1]
  : 'projekt';

if (!['projekt', 'sprzedaz'].includes(etap)) {
  console.error(`Nieznany etap: ${etap}. Dozwolone: projekt, sprzedaz.`);
  process.exit(2);
}

const wyniki = USTALENIA.filter((u) => !filtrWaga || u.waga === filtrWaga)
  .map((u) => {
    let stan = u.ocena();
    // Na etapie projektu punkty zależne od tożsamości sprzedawcy nie są
    // brakiem do naprawy, tylko pozycją na liście przed pierwszą sprzedażą.
    if (etap === 'projekt' && u.etap === 'sprzedaz' && stan === 'otwarte') stan = 'odroczone';
    return { id: u.id, waga: u.waga, nazwa: u.nazwa, gdzie: u.gdzie, stan };
  })
  .sort((a, b) => KOLEJNOSC[a.waga] - KOLEJNOSC[b.waga] || a.id.localeCompare(b.id));

const otwarteBlokady = wyniki.filter((w) => w.waga === 'blokada' && w.stan === 'otwarte');

if (jakoJson) {
  console.log(JSON.stringify({ etap, wyniki, otwarteBlokady: otwarteBlokady.length }, null, 2));
} else {
  console.log(`\n  etap: ${etap}`);
  const szer = Math.max(...wyniki.map((w) => w.id.length));
  let ostatniaWaga = null;
  for (const w of wyniki) {
    if (w.waga !== ostatniaWaga) {
      console.log(`\n  ${w.waga.toUpperCase()}`);
      ostatniaWaga = w.waga;
    }
    console.log(`  ${ZNAK[w.stan]} ${w.id.padEnd(szer)}  ${w.nazwa}`);
    if (w.stan === 'otwarte' || w.stan === 'decyzja') console.log(`${' '.repeat(szer + 6)}${w.gdzie}`);
  }

  const ile = (stan) => wyniki.filter((w) => w.stan === stan).length;
  console.log(
    `\n  otwarte ${ile('otwarte')} · zamknięte ${ile('zamkniete')} · odroczone ${ile('odroczone')} · decyzje ${ile('decyzja')} · nieznane ${ile('nieznane')}`
  );
  if (otwarteBlokady.length) {
    const co =
      etap === 'projekt'
        ? 'blokad do naprawy z samego kodu.'
        : 'blokad — sklep nie może przyjmować zamówień od konsumentów.';
    console.log(`\n  ${otwarteBlokady.length} ${co}\n`);
  } else if (ile('odroczone')) {
    console.log(
      `\n  Kod czysty. ${ile('odroczone')} punktów czeka na tożsamość sprzedawcy — sprawdź je przed pierwszą sprzedażą przez --etap sprzedaz.\n`
    );
  } else {
    console.log('\n  Brak otwartych blokad.\n');
  }
}

process.exit(otwarteBlokady.length ? 1 : 0);
