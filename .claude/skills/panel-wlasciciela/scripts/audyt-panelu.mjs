#!/usr/bin/env node
/**
 * Audyt zaplecza — higiena panelu właściciela.
 *
 * Sprawdza to, czego typecheck i testy schematu nie łapią: czy granica dostępu
 * naprawdę idzie przez bazę, czy sekret nie wyciekł do przeglądarki i czy nowa
 * migracja ma komplet obudowy (RLS, granty, `security_invoker`).
 *
 * Wszystko po wzorcach w kodzie, nie po numerach linii — przeżywa refaktor.
 *
 * Stany:
 *   ✗ otwarte    — brak jest na miejscu
 *   ✓ zamkniete  — w porządku
 *   ○ brakuje    — element jeszcze nie powstał; nie usterka, tylko robota przed nami
 *   · nieznane   — nie dało się ocenić (brak pliku, zmieniona struktura)
 *
 * Kod wyjścia 1, gdy została otwarta blokada.
 *
 * Użycie:
 *   node .claude/skills/panel-wlasciciela/scripts/audyt-panelu.mjs
 *   node .claude/skills/panel-wlasciciela/scripts/audyt-panelu.mjs --json
 *   node .claude/skills/panel-wlasciciela/scripts/audyt-panelu.mjs --waga blokada
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';

const TU = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(TU, '..', '..', '..', '..');

// --- odczyt ---------------------------------------------------------------

const pamiec = new Map();

function plik(sciezka) {
  if (pamiec.has(sciezka)) return pamiec.get(sciezka);
  const pelna = join(ROOT, sciezka);
  const tresc =
    existsSync(pelna) && statSync(pelna).isFile() ? readFileSync(pelna, 'utf8') : null;
  pamiec.set(sciezka, tresc);
  return tresc;
}

/** Lista [ścieżka względna, treść] dla plików w katalogu, rekurencyjnie. */
function pliki(sciezka, rozszerzenia = ['.ts', '.tsx']) {
  const klucz = `list:${sciezka}:${rozszerzenia.join(',')}`;
  if (pamiec.has(klucz)) return pamiec.get(klucz);
  const wynik = [];
  const chodz = (kat) => {
    if (!existsSync(kat)) return;
    for (const wpis of readdirSync(kat, { withFileTypes: true })) {
      if (wpis.name === 'node_modules' || wpis.name.startsWith('.')) continue;
      const p = join(kat, wpis.name);
      if (wpis.isDirectory()) chodz(p);
      else if (rozszerzenia.some((r) => wpis.name.endsWith(r))) {
        wynik.push([relative(ROOT, p), readFileSync(p, 'utf8')]);
      }
    }
  };
  chodz(join(ROOT, sciezka));
  pamiec.set(klucz, wynik);
  return wynik;
}

/** Cały SQL migracji w kolejności nazw — tak samo, jak wgrywa go Supabase. */
function sql() {
  if (pamiec.has('sql')) return pamiec.get('sql');
  const zlepek = pliki('supabase/migrations', ['.sql'])
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([p, t]) => `\n-- >>> ${p}\n${t}`)
    .join('');
  pamiec.set('sql', zlepek);
  return zlepek;
}

/**
 * Funkcje SQL w postaci obowiązującej — mapa nazwa → treść ostatniej definicji.
 * Kilka migracji nadpisuje te same funkcje (cancel_order, create_order), a liczy
 * się wyłącznie ta, która zostaje po wgraniu wszystkich.
 */
function funkcje() {
  if (pamiec.has('funkcje')) return pamiec.get('funkcje');
  const mapa = new Map();
  const wzor = /create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)\s*\(([\s\S]*?)\$\$;/gi;
  let m;
  while ((m = wzor.exec(sql())) !== null) mapa.set(m[1], m[0]);
  pamiec.set('funkcje', mapa);
  return mapa;
}

/**
 * Funkcje skasowane późniejszą migracją — w bazie ich nie ma, więc nie oceniamy.
 * Liczy się kolejność: funkcja skasowana, a potem odtworzona pod tą samą nazwą
 * istnieje i musi przejść wszystkie sprawdzenia. Pominięcie takiej byłoby
 * cichą dziurą w audycie, czyli gorszą niż brak sprawdzenia.
 */
function usuniete() {
  if (pamiec.has('usuniete')) return pamiec.get('usuniete');
  const t = sql();
  const zbior = new Set();
  for (const m of t.matchAll(/drop\s+function\s+(?:if\s+exists\s+)?public\.(\w+)/gi)) {
    const nazwa = m[1];
    const ostatnieUtworzenie = t.lastIndexOf(`function public.${nazwa}(`);
    const utworzoneWczesniej =
      ostatnieUtworzenie === -1 ||
      ostatnieUtworzenie < m.index ||
      // `lastIndexOf` trafia też w samo `drop function public.X(` — wtedy
      // sprawdzamy, czy przed nim stoi create.
      /drop\s+function\s+(?:if\s+exists\s+)?$/i.test(t.slice(Math.max(0, ostatnieUtworzenie - 40), ostatnieUtworzenie));
    if (utworzoneWczesniej) zbior.add(nazwa);
  }
  pamiec.set('usuniete', zbior);
  return zbior;
}

const ma = (tresc, wzor) =>
  typeof tresc === 'string' && (wzor instanceof RegExp ? wzor.test(tresc) : tresc.includes(wzor));

/** Skrót: brak treści → nieznane, spełniony warunek → otwarte. */
const gdy = (tresc, warunek) => (tresc == null ? 'nieznane' : warunek ? 'otwarte' : 'zamkniete');

/** Pierwsze N nazw z listy, resztę zwija w „+N". Komunikat ma się mieścić w wierszu. */
const wypisz = (lista, ile = 3) =>
  lista.slice(0, ile).join(', ') + (lista.length > ile ? ` +${lista.length - ile}` : '');

// --- ustalenia ------------------------------------------------------------

/**
 * Funkcje bez `authorize()` z powodem. Każda pozycja to świadoma decyzja
 * zapisana w migracji, nie zaległość: albo sprawdza własność wiersza przez
 * `auth.uid()`, albo jest wołana wyłącznie z wnętrza innej funkcji, albo działa
 * dla klienta z założenia.
 */
const BEZ_AUTHORIZE = new Set([
  'authorize',
  'current_role_name',
  'is_staff',
  'custom_access_token_hook',
  'handle_new_user',
  'touch_updated_at',
  'quote_order',
  'create_order',
  'take_stock',
  'return_stock',
  'przelicz_ocene_produktu',
  'opinie_przelicz',
  'pilnuj_anulowania',
  'mark_order_paid',
  'zapisz_w_dzienniku',
]);

const USTALENIA = [
  {
    id: 'service-role-w-web',
    waga: 'blokada',
    nazwa: 'Klucz service_role w aplikacji webowej — omija RLS w całości',
    gdzie: 'web/',
    ocena() {
      const trafienia = pliki('web/app', ['.ts', '.tsx'])
        .concat(pliki('web/lib', ['.ts']), pliki('web/utils', ['.ts']), pliki('web/components', ['.ts', '.tsx']))
        .filter(([, t]) => /SERVICE_ROLE|serviceRole|service_role_key/.test(t))
        .map(([p]) => p);
      return trafienia.length ? { stan: 'otwarte', gdzie: wypisz(trafienia) } : 'zamkniete';
    },
  },
  {
    id: 'sekret-publiczny',
    waga: 'blokada',
    nazwa: 'Sekret pod NEXT_PUBLIC_ — wychodzi do przeglądarki razem ze stroną',
    gdzie: 'web/',
    ocena() {
      // Token geowidgetu jest publiczny z założenia i nie da się nim nadać paczki.
      const dozwolone = /NEXT_PUBLIC_(SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEY|STORE_MODE|SITE_URL|SENTRY_DSN|INPOST_GEOWIDGET\w*)/;
      const podejrzane = /NEXT_PUBLIC_[A-Z0-9_]*(TOKEN|SECRET|API_KEY|PRIVATE|SHIPX)[A-Z0-9_]*/g;
      const trafienia = [];
      for (const [p, t] of pliki('web', ['.ts', '.tsx'])) {
        if (p.includes('node_modules')) continue;
        for (const nazwa of t.match(podejrzane) ?? []) {
          if (!dozwolone.test(nazwa)) trafienia.push(`${nazwa} (${p})`);
        }
      }
      return trafienia.length ? { stan: 'otwarte', gdzie: wypisz(trafienia, 2) } : 'zamkniete';
    },
  },
  {
    id: 'bramka-ekranow',
    waga: 'blokada',
    nazwa: 'Ekran zaplecza bez sprawdzenia sesji i roli',
    gdzie: 'web/app/panel, web/app/magazyn',
    ocena() {
      const ekrany = pliki('web/app/panel', ['.tsx'])
        .concat(pliki('web/app/magazyn', ['.tsx']))
        .filter(([p]) => p.endsWith('page.tsx'));
      if (!ekrany.length) return 'brakuje';
      // Bramki żyją w magazyn-dostep.ts i panel-dostep.ts. Nowa bramka =
      // nowa nazwa na tej liście, inaczej audyt zgłosi fałszywy alarm.
      const bez = ekrany
        .filter(([, t]) => !/wymagajZaplecza|wymagajPanelu|wymagajWlasciciela|getSessionUser/.test(t))
        .map(([p]) => p);
      return bez.length ? { stan: 'otwarte', gdzie: wypisz(bez) } : 'zamkniete';
    },
  },
  {
    id: 'zapis-rol-z-aplikacji',
    waga: 'blokada',
    nazwa: 'Zapis do ról prosto z aplikacji — z pominięciem funkcji pilnującej ostatniego właściciela',
    gdzie: 'web/',
    ocena() {
      const wzor = /\.from\(\s*'(user_roles|role_permissions)'\s*\)[\s\S]{0,160}?\.(update|insert|delete|upsert)\(/;
      const trafienia = pliki('web', ['.ts', '.tsx'])
        .filter(([p]) => !p.includes('node_modules') && !p.includes('/e2e'))
        .filter(([, t]) => wzor.test(t))
        .map(([p]) => p);
      return trafienia.length ? { stan: 'otwarte', gdzie: wypisz(trafienia) } : 'zamkniete';
    },
  },
  {
    id: 'status-z-reki',
    waga: 'wysokie',
    nazwa: 'UPDATE statusu zamówienia obok ustaw_stan_zamowienia — omija granice stanów',
    gdzie: 'web/',
    ocena() {
      // Wyzwalacz `pilnuj_anulowania` broni tylko stanu „anulowane". Reszta
      // przechodzi: „wysłane" bez numeru listu, „dostarczone" z ręki.
      const wzor = /\.from\(\s*'orders'\s*\)[\s\S]{0,160}?\.(update|upsert)\(/;
      const trafienia = pliki('web', ['.ts', '.tsx'])
        .filter(([p]) => !p.includes('node_modules') && !p.includes('/e2e'))
        .filter(([, t]) => wzor.test(t))
        .map(([p]) => p);
      return trafienia.length ? { stan: 'otwarte', gdzie: wypisz(trafienia) } : 'zamkniete';
    },
  },
  {
    id: 'funkcja-bez-authorize',
    waga: 'blokada',
    nazwa: 'Funkcja security definer zmienia dane bez sprawdzenia uprawnień',
    gdzie: 'supabase/migrations',
    ocena() {
      const podejrzane = [];
      for (const [nazwa, tresc] of funkcje()) {
        if (BEZ_AUTHORIZE.has(nazwa) || usuniete().has(nazwa)) continue;
        if (!/security\s+definer/i.test(tresc)) continue;
        if (/returns\s+trigger/i.test(tresc)) continue;
        const zmienia = /\b(insert\s+into|update\s+public\.|delete\s+from)\b/i.test(tresc);
        const pilnuje = /authorize\s*\(/i.test(tresc) || /auth\.uid\s*\(\s*\)/i.test(tresc);
        if (zmienia && !pilnuje) podejrzane.push(nazwa);
      }
      return podejrzane.length ? { stan: 'otwarte', gdzie: wypisz(podejrzane) } : 'zamkniete';
    },
  },
  {
    id: 'rls-tabel',
    waga: 'blokada',
    nazwa: 'Tabela bez włączonego RLS',
    gdzie: 'supabase/migrations',
    ocena() {
      const t = sql();
      const bez = [];
      for (const m of t.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi)) {
        const nazwa = m[1];
        const wzor = new RegExp(`alter\\s+table\\s+public\\.${nazwa}\\s+enable\\s+row\\s+level\\s+security`, 'i');
        if (!wzor.test(t)) bez.push(nazwa);
      }
      return bez.length ? { stan: 'otwarte', gdzie: wypisz(bez) } : 'zamkniete';
    },
  },
  {
    id: 'koszt-w-products',
    waga: 'blokada',
    nazwa: 'Koszt zakupu w tabeli products — wycieka, bo katalog czyta każdy',
    gdzie: 'supabase/migrations',
    ocena: () =>
      gdy(sql(), /alter\s+table\s+public\.products[\s\S]{0,200}?\b(koszt|cost|purchase_price)/i.test(sql())),
  },
  {
    id: 'granty-funkcji',
    waga: 'wysokie',
    nazwa: 'Funkcja zapisująca ani nie odebrała praw PUBLIC, ani nie pilnuje się sama',
    gdzie: 'supabase/migrations',
    ocena() {
      const t = sql();
      const bez = [];
      for (const [nazwa, tresc] of funkcje()) {
        if (/returns\s+trigger/i.test(tresc)) continue;
        if (usuniete().has(nazwa)) continue;
        // Odczytowe pomocnicze (authorize, is_staff) muszą zostać wykonywalne —
        // wołają je polityki RLS w imieniu zalogowanego. Ryzyko niesie zapis.
        if (!/\b(insert\s+into|update\s+public\.|delete\s+from)\b/i.test(tresc)) continue;
        const odebrane = new RegExp(
          `revoke\\s+execute\\s+on\\s+function\\s+public\\.${nazwa}\\s*\\([^)]*\\)?[\\s\\S]{0,120}?from[^;]*\\bpublic\\b`,
          'i'
        ).test(t);
        const pilnujeSie = /authorize\s*\(/i.test(tresc) || /auth\.uid\s*\(\s*\)/i.test(tresc);
        if (!odebrane && !pilnujeSie) bez.push(nazwa);
      }
      return bez.length ? { stan: 'otwarte', gdzie: wypisz(bez, 4) } : 'zamkniete';
    },
  },
  {
    id: 'widok-invoker',
    waga: 'wysokie',
    nazwa: 'Widok bez security_invoker — omija RLS tabel źródłowych',
    gdzie: 'supabase/migrations',
    ocena() {
      const t = sql();
      const bez = [];
      for (const m of t.matchAll(/create\s+(?:or\s+replace\s+)?view\s+public\.(\w+)/gi)) {
        const wzor = new RegExp(`alter\\s+view\\s+public\\.${m[1]}\\s+set\\s*\\(\\s*security_invoker`, 'i');
        if (!wzor.test(t)) bez.push(m[1]);
      }
      return bez.length ? { stan: 'otwarte', gdzie: wypisz(bez) } : 'zamkniete';
    },
  },
  {
    id: 'granty-widokow',
    waga: 'wysokie',
    nazwa: 'Widok bez GRANT-u — przez API wygląda jak brak sprzedaży, nie jak brak dostępu',
    gdzie: 'supabase/migrations',
    ocena() {
      const t = sql();
      const bez = [];
      for (const m of t.matchAll(/create\s+(?:or\s+replace\s+)?view\s+public\.(\w+)/gi)) {
        // PostgREST oddaje pustą listę zamiast błędu, więc brak grantu na widoku
        // objawia się zerami na wykresie. Najdroższa możliwa cisza.
        const wzor = new RegExp(`grant\\s+select[^;]*\\bpublic\\.${m[1]}\\b`, 'i');
        if (!wzor.test(t)) bez.push(m[1]);
      }
      return bez.length ? { stan: 'otwarte', gdzie: wypisz(bez) } : 'zamkniete';
    },
  },
  {
    id: 'enum-i-uzycie',
    waga: 'wysokie',
    nazwa: 'Nowa wartość enuma użyta w tej samej migracji — padnie przy wgrywaniu',
    gdzie: 'supabase/migrations',
    ocena() {
      const zle = pliki('supabase/migrations', ['.sql'])
        .filter(([, t]) => /alter\s+type\s+public\.app_permission\s+add\s+value/i.test(t))
        .filter(([, t]) => /insert\s+into\s+public\.role_permissions/i.test(t))
        .map(([p]) => p.split('/').pop());
      return zle.length ? { stan: 'otwarte', gdzie: wypisz(zle) } : 'zamkniete';
    },
  },
  {
    id: 'noindex-zaplecza',
    waga: 'srednie',
    nazwa: 'Ekran zaplecza bez robots: index false',
    gdzie: 'web/app/panel, web/app/magazyn',
    ocena() {
      const ekrany = pliki('web/app/panel', ['.tsx'])
        .concat(pliki('web/app/magazyn', ['.tsx']))
        .filter(([p]) => p.endsWith('page.tsx'));
      if (!ekrany.length) return 'brakuje';
      const uklady = pliki('web/app/panel', ['.tsx'])
        .concat(pliki('web/app/magazyn', ['.tsx']))
        .filter(([p]) => p.endsWith('layout.tsx'))
        .map(([, t]) => t)
        .join('');
      const wUkladzie = /index:\s*false/.test(uklady);
      const bez = ekrany.filter(([, t]) => !/index:\s*false/.test(t)).map(([p]) => p);
      return bez.length && !wUkladzie ? { stan: 'otwarte', gdzie: wypisz(bez) } : 'zamkniete';
    },
  },
  {
    id: 'dziennik-audytu',
    waga: 'srednie',
    nazwa: 'Brak dziennika zaplecza — nie da się odtworzyć, kto co zmienił',
    gdzie: 'supabase/migrations',
    ocena: () =>
      /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.dziennik_zaplecza/i.test(sql())
        ? 'zamkniete'
        : 'brakuje',
  },
  {
    id: 'dziennik-tylko-dopis',
    waga: 'wysokie',
    nazwa: 'Dziennik z polityką update lub delete — przestaje być dowodem',
    gdzie: 'supabase/migrations',
    ocena() {
      const t = sql();
      if (!/public\.dziennik_zaplecza/.test(t)) return 'brakuje';
      const zle = /create\s+policy[^;]*on\s+public\.dziennik_zaplecza[\s\S]{0,200}?for\s+(update|delete|all)\b/i;
      return gdy(t, zle.test(t));
    },
  },
  {
    id: 'marza-bez-kosztu',
    waga: 'srednie',
    nazwa: 'Panel liczy marżę, choć koszt sprzedanych sztuk nie jest zapisywany',
    gdzie: 'web/app/panel, supabase/migrations',
    ocena() {
      const panel = pliki('web/app/panel', ['.ts', '.tsx']).map(([, t]) => t).join('');
      if (!/mar[żz]/i.test(panel)) return 'zamkniete';
      const zapisany = /order_items[\s\S]{0,200}?koszt/i.test(sql());
      return gdy(panel, !zapisany);
    },
  },
  {
    id: 'przesylki-tabela',
    waga: 'srednie',
    nazwa: 'Brak tabeli przesyłek — przewoźnik i punkt odbioru nie mają gdzie usiąść',
    gdzie: 'supabase/migrations',
    ocena: () =>
      /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.przesylki/i.test(sql())
        ? 'zamkniete'
        : 'brakuje',
  },
  {
    id: 'inpost-w-przegladarce',
    waga: 'blokada',
    nazwa: 'Wywołanie ShipX prosto z aplikacji zamiast z funkcji Edge',
    gdzie: 'web/',
    ocena() {
      const trafienia = pliki('web', ['.ts', '.tsx'])
        .filter(([p]) => !p.includes('node_modules'))
        .filter(([, t]) => /api-shipx|easypack24\.net\/v1|api-shipx-pl/.test(t))
        .map(([p]) => p);
      return trafienia.length ? { stan: 'otwarte', gdzie: wypisz(trafienia) } : 'zamkniete';
    },
  },
];

// --- wyjście --------------------------------------------------------------

const KOLEJNOSC = { blokada: 0, wysokie: 1, srednie: 2 };
const ZNAK = { otwarte: '✗', zamkniete: '✓', brakuje: '○', nieznane: '·' };

const argumenty = process.argv.slice(2);
const jakoJson = argumenty.includes('--json');
const filtrWaga = argumenty.includes('--waga') ? argumenty[argumenty.indexOf('--waga') + 1] : null;

const wyniki = USTALENIA.filter((u) => !filtrWaga || u.waga === filtrWaga)
  .map((u) => {
    const wynik = u.ocena();
    const stan = typeof wynik === 'string' ? wynik : wynik.stan;
    const gdzie = typeof wynik === 'string' ? u.gdzie : wynik.gdzie;
    return { id: u.id, waga: u.waga, nazwa: u.nazwa, gdzie, stan };
  })
  .sort((a, b) => KOLEJNOSC[a.waga] - KOLEJNOSC[b.waga] || a.id.localeCompare(b.id));

const otwarteBlokady = wyniki.filter((w) => w.waga === 'blokada' && w.stan === 'otwarte');

if (jakoJson) {
  console.log(JSON.stringify({ wyniki, otwarteBlokady: otwarteBlokady.length }, null, 2));
} else {
  const szer = Math.max(...wyniki.map((w) => w.id.length));
  let ostatniaWaga = null;
  for (const w of wyniki) {
    if (w.waga !== ostatniaWaga) {
      console.log(`\n  ${w.waga.toUpperCase()}`);
      ostatniaWaga = w.waga;
    }
    console.log(`  ${ZNAK[w.stan]} ${w.id.padEnd(szer)}  ${w.nazwa}`);
    if (w.stan === 'otwarte' || w.stan === 'brakuje') {
      console.log(`${' '.repeat(szer + 6)}${w.gdzie}`);
    }
  }

  const ile = (stan) => wyniki.filter((w) => w.stan === stan).length;
  console.log(
    `\n  otwarte ${ile('otwarte')} · zamknięte ${ile('zamkniete')} · do zbudowania ${ile('brakuje')} · nieznane ${ile('nieznane')}`
  );
  console.log(
    otwarteBlokady.length
      ? `\n  ${otwarteBlokady.length} blokad — zaplecze wpuszcza operacje, których baza nie pilnuje.\n`
      : '\n  Brak otwartych blokad.\n'
  );
}

process.exit(otwarteBlokady.length ? 1 : 0);
