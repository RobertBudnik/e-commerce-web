/**
 * Testy schematu na prawdziwym Postgresie (pglite, PG 16) — bez Dockera.
 *
 * Odtwarza minimalny odpowiednik warstwy auth Supabase (schemat auth,
 * auth.uid(), auth.jwt(), role anon/authenticated), wgrywa migracje i seed,
 * po czym sprawdza: uprawnienia, liczenie cen, rezerwację stanu, RLS.
 *
 * Uruchomienie: npm run db:test
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const db = new PGlite();

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function throws(name, fn, expectedFragment) {
  try {
    await fn();
    check(name, false, 'brak oczekiwanego błędu');
  } catch (e) {
    const hit = !expectedFragment || e.message.includes(expectedFragment);
    check(name, hit, hit ? '' : `inny błąd: ${e.message}`);
  }
}

/** Kontekst żądania jak w Supabase: rola bazy + claims z JWT. */
async function asUser(userId, role = 'authenticated', extraClaims = {}) {
  const claims = JSON.stringify({ sub: userId, role, ...extraClaims });
  // Ustawienia sesyjne, nie "local" — poza transakcją SET LOCAL nie ma żadnego skutku,
  // a wtedy zapytania lecą jako superuser i RLS w ogóle się nie odzywa.
  await db.exec('reset role;');
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
  await db.exec(`set role ${role};`);
}

async function asService() {
  await db.exec('reset role;');
  await db.query(`select set_config('request.jwt.claims', '', false)`);
}

// ---------------------------------------------------------------------------
// Atrapa warstwy auth Supabase
// ---------------------------------------------------------------------------
const AUTH_STUB = `
create schema if not exists auth;

create table auth.users (
  instance_id uuid,
  id uuid primary key default gen_random_uuid(),
  aud text,
  role text,
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  -- Kolumny tokenów: seed lokalny je wypełnia, GoTrue nie znosi tu NULL-i
  confirmation_token text default '',
  recovery_token text default '',
  email_change text default '',
  email_change_token_new text default '',
  email_change_token_current text default '',
  phone_change text default '',
  phone_change_token text default '',
  reauthentication_token text default ''
);

create table auth.identities (
  provider_id text not null,
  user_id uuid not null references auth.users on delete cascade,
  identity_data jsonb not null,
  provider text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (provider, provider_id)
);

-- Storage: tyle, ile potrzeba migracji ze zdjęciami produktów. Prawdziwe
-- tabele mają więcej kolumn, ale polityki dotykają wyłącznie bucket_id.
create schema if not exists storage;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now()
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets,
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz default now()
);

alter table storage.objects enable row level security;

create or replace function auth.jwt() returns jsonb language sql stable as $fn$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$fn$;

create or replace function auth.uid() returns uuid language sql stable as $fn$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$fn$;

do $do$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $do$;

grant usage on schema auth to anon, authenticated, service_role;

-- Uprawnienia na Storage: na Supabase są fabryczne, tu trzeba je dołożyć,
-- inaczej polityki nie mają czego pilnować. Muszą iść po utworzeniu ról.
grant usage on schema storage to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;

-- crypt/gen_salt są w pgcrypto; na potrzeby testu wystarczą atrapy
create or replace function crypt(text, text) returns text language sql immutable as $fn$ select md5($1) $fn$;
create or replace function gen_salt(text) returns text language sql volatile as $fn$ select 'salt' $fn$;
`;

// ---------------------------------------------------------------------------
console.log('\nMigracje');
await db.exec(AUTH_STUB);

const migrationsDir = join(root, 'supabase', 'migrations');
for (const file of readdirSync(migrationsDir).sort()) {
  // pglite nie wozi ze sobą pgcrypto; gen_random_uuid jest w rdzeniu PG 16,
  // a crypt/gen_salt podmieniamy atrapami w AUTH_STUB. Na Supabase rozszerzenie
  // istnieje, więc linia w migracji zostaje.
  const sql = readFileSync(join(migrationsDir, file), 'utf8').replace(
    /create extension if not exists "pgcrypto";/i,
    '-- pgcrypto pominięte w teście'
  );
  try {
    await db.exec(sql);
    check(file, true);
  } catch (e) {
    check(file, false, e.message);
    console.log('\nPrzerwane — dalsze testy bez sensu.\n');
    process.exit(1);
  }
}

console.log('\nDane startowe');
try {
  await db.exec(readFileSync(join(root, 'supabase', 'seed.sql'), 'utf8'));
  check('seed.sql', true);
} catch (e) {
  check('seed.sql', false, e.message);
  process.exit(1);
}

const counts = await db.query(`
  select
    (select count(*) from public.products) as products,
    (select count(*) from public.categories) as categories,
    (select count(*) from public.role_permissions) as perms,
    (select count(*) from public.user_roles) as roles
`);
const c = counts.rows[0];
check('8 produktów w katalogu', Number(c.products) === 8, `jest ${c.products}`);
check('4 kategorie', Number(c.categories) === 4, `jest ${c.categories}`);
// 17 z macierzy podstawowej + 3 z panelu właściciela (finanse.read ×2, audyt.read)
check('macierz uprawnień wypełniona', Number(c.perms) === 20, `jest ${c.perms}`);
check('właściciel ma rolę', Number(c.roles) >= 1);

// Użytkownicy testowi
const { rows: [owner] } = await db.query(`select id from auth.users where email = 'admin@nordo.pl'`);
const { rows: [customer] } = await db.query(`
  insert into auth.users (email, aud, role) values ('klient@example.com', 'authenticated', 'authenticated')
  returning id
`);
const { rows: [other] } = await db.query(`
  insert into auth.users (email, aud, role) values ('obcy@example.com', 'authenticated', 'authenticated')
  returning id
`);
// Rolę klienta nadaje już trigger handle_new_user — to tylko asekuracja.
await db.query(
  `insert into public.user_roles (user_id, role) values ($1, 'customer'), ($2, 'customer')
   on conflict (user_id, role) do nothing`,
  [customer.id, other.id]
);
const triggerRoles = await db.query(
  `select count(*) as n from public.user_roles where user_id in ($1, $2) and role = 'customer'`,
  [customer.id, other.id]
);
check('trigger nadaje rolę klienta przy rejestracji', Number(triggerRoles.rows[0].n) === 2, `${triggerRoles.rows[0].n}`);

// ---------------------------------------------------------------------------
console.log('\nUprawnienia');
await asUser(owner.id);
const ownerWrite = await db.query(`select public.authorize('products.write') as ok`);
check('właściciel może pisać produkty', ownerWrite.rows[0].ok === true);

const ownerRoles = await db.query(`select public.authorize('roles.manage') as ok`);
check('właściciel zarządza rolami', ownerRoles.rows[0].ok === true);

await asUser(customer.id);
const custWrite = await db.query(`select public.authorize('products.write') as ok`);
check('klient nie może pisać produktów', custWrite.rows[0].ok === false);

const custOrders = await db.query(`select public.authorize('orders.read_all') as ok`);
check('klient nie widzi cudzych zamówień (uprawnienie)', custOrders.rows[0].ok === false);

const staffCheck = await db.query(`select public.is_staff() as ok`);
check('klient to nie zaplecze', staffCheck.rows[0].ok === false);

// Rola z claimu JWT ma pierwszeństwo przed tabelą
await asUser(customer.id, 'authenticated', { user_role: 'manager' });
const claimRole = await db.query(`select public.current_role_name()::text as role`);
check('rola czytana z claimu JWT', claimRole.rows[0].role === 'manager');

// ---------------------------------------------------------------------------
console.log('\nSkładanie zamówienia');
await asService();
const { rows: [headphones] } = await db.query(
  `select id, price_cents, stock from public.products where slug = 'sluchawki-bezprzewodowe-aura-x'`
);
const { rows: [bulb] } = await db.query(
  `select id, price_cents, stock from public.products where slug = 'zarowka-smart-glow-e27'`
);

await asUser(customer.id);
const orderRes = await db.query(
  `select * from public.create_order($1::jsonb, $2, $3, null, null)`,
  [JSON.stringify([{ product_id: headphones.id, qty: 2 }, { product_id: bulb.id, qty: 3 }]), 'klient@example.com', '+48600100200']
);
const order = orderRes.rows[0];
const expectedSubtotal = headphones.price_cents * 2 + bulb.price_cents * 3;
check('suma liczona z cen w bazie', order.subtotal_cents === expectedSubtotal, `${order.subtotal_cents} ≠ ${expectedSubtotal}`);
check('dostawa gratis powyżej progu', order.shipping_cents === 0, `${order.shipping_cents}`);
check('razem = suma - rabat + dostawa', order.total_cents === expectedSubtotal, `${order.total_cents}`);
check('numer zamówienia nadany', /^NOR-\d{4}-\d{4}$/.test(order.order_number), order.order_number);
check('zamówienie czeka na płatność', order.payment_status === 'oczekuje');

await asService();
const afterStock = await db.query(`select stock from public.products where id = $1`, [headphones.id]);
check('stan zdjęty z magazynu', afterStock.rows[0].stock === headphones.stock - 2, `${afterStock.rows[0].stock}`);

const movements = await db.query(
  `select count(*) as n from public.inventory_movements where order_id = $1`, [order.id]
);
check('ruchy magazynowe zapisane', Number(movements.rows[0].n) === 2, `${movements.rows[0].n}`);

// Tania pozycja poniżej progu — dostawa płatna
await asUser(customer.id);
const smallOrder = (
  await db.query(`select * from public.create_order($1::jsonb, $2, null, null, null)`, [
    JSON.stringify([{ product_id: bulb.id, qty: 1 }]),
    'klient@example.com',
  ])
).rows[0];
check('dostawa doliczona poniżej progu', smallOrder.shipping_cents === 1999, `${smallOrder.shipping_cents}`);
check('razem z dostawą', smallOrder.total_cents === bulb.price_cents + 1999);

// Kupon
const couponOrder = (
  await db.query(`select * from public.create_order($1::jsonb, $2, null, null, $3)`, [
    JSON.stringify([{ product_id: bulb.id, qty: 1 }]),
    'klient@example.com',
    'nowy10',
  ])
).rows[0];
check('kupon liczony od sumy', couponOrder.discount_cents === Math.trunc(bulb.price_cents / 10), `${couponOrder.discount_cents}`);
check('kod znormalizowany do wersalików', couponOrder.coupon_code === 'NOWY10');

await throws(
  'zły kupon odrzucony',
  () =>
    db.query(`select * from public.create_order($1::jsonb, $2, null, null, $3)`, [
      JSON.stringify([{ product_id: bulb.id, qty: 1 }]),
      'klient@example.com',
      'FALSZYWY',
    ]),
  'nieprawidłowy'
);

await throws(
  'zły e-mail odrzucony',
  () =>
    db.query(`select * from public.create_order($1::jsonb, $2, null, null, null)`, [
      JSON.stringify([{ product_id: bulb.id, qty: 1 }]),
      'to-nie-jest-email',
    ]),
  'e-mail'
);

// ---------------------------------------------------------------------------
console.log('\nWycena koszyka');
await asUser(customer.id);

const quote = (
  await db.query(`select public.quote_order($1::jsonb, null) as q`, [
    JSON.stringify([{ product_id: bulb.id, qty: 2 }]),
  ])
).rows[0].q;
check('wycena liczy sumę z cen w bazie', quote.subtotal_cents === bulb.price_cents * 2, `${quote.subtotal_cents}`);
check('dostawa doliczona poniżej progu', quote.shipping_cents === 1999, `${quote.shipping_cents}`);
check('brakująca kwota do darmowej dostawy', quote.free_shipping_missing_cents === 30000 - bulb.price_cents * 2, `${quote.free_shipping_missing_cents}`);
check('pozycja w stanie', quote.lines[0].in_stock === true);

const quoteCoupon = (
  await db.query(`select public.quote_order($1::jsonb, $2) as q`, [
    JSON.stringify([{ product_id: bulb.id, qty: 2 }]),
    'nowy10',
  ])
).rows[0].q;
check('kupon uznany niezależnie od wielkości liter', quoteCoupon.coupon_valid === true);
check('rabat z wyceny jak w create_order', quoteCoupon.discount_cents === Math.trunc((bulb.price_cents * 2) / 10), `${quoteCoupon.discount_cents}`);

const quoteBadCoupon = (
  await db.query(`select public.quote_order($1::jsonb, $2) as q`, [
    JSON.stringify([{ product_id: bulb.id, qty: 1 }]),
    'LEWY99',
  ])
).rows[0].q;
check('zły kod nie daje rabatu', quoteBadCoupon.coupon_valid === false && quoteBadCoupon.discount_cents === 0);

const quoteBig = (
  await db.query(`select public.quote_order($1::jsonb, null) as q`, [
    JSON.stringify([{ product_id: headphones.id, qty: 1 }]),
  ])
).rows[0].q;
check('dostawa gratis powyżej progu', quoteBig.shipping_cents === 0, `${quoteBig.shipping_cents}`);

// Wycena musi widzieć braki, zanim klient kliknie „zamawiam"
const quoteShort = (
  await db.query(`select public.quote_order($1::jsonb, null) as q`, [
    JSON.stringify([{ product_id: bulb.id, qty: 100000 }]),
  ])
).rows[0].q;
check('wycena oznacza brak towaru', quoteShort.lines[0].in_stock === false);

// Wejście od klienta ma sufit: bez niego żądanie z tysiącami pozycji
// zajmowało bazę na tyle długo, że wystarczyło kilka naraz
const hugeCart = JSON.stringify(
  Array.from({ length: 51 }, () => ({ product_id: bulb.id, qty: 1 }))
);
await throws(
  'wycena odrzuca koszyk ponad limit',
  () => db.query(`select public.quote_order($1::jsonb, null)`, [hugeCart]),
  'Za dużo pozycji'
);
await throws(
  'zamówienie odrzuca koszyk ponad limit',
  () => db.query(`select * from public.create_order($1::jsonb, $2, null, null, null)`, [hugeCart, 'klient@example.com']),
  'Za dużo pozycji'
);

// Kupony zostają zamknięte — wycena oddaje wynik, nie listę kodów
const couponPeek = await db.query(`select count(*) as n from public.coupons`);
check('klient nie wylistuje kuponów', Number(couponPeek.rows[0].n) === 0, `${couponPeek.rows[0].n}`);

await asUser(null, 'anon');
const anonQuote = (
  await db.query(`select public.quote_order($1::jsonb, null) as q`, [
    JSON.stringify([{ product_id: bulb.id, qty: 1 }]),
  ])
).rows[0].q;
check('gość wycenia koszyk bez logowania', anonQuote.total_cents === bulb.price_cents + 1999, `${anonQuote.total_cents}`);

// ---------------------------------------------------------------------------
// Postgres nadaje EXECUTE roli PUBLIC każdej nowej funkcji, a anon
// i authenticated po PUBLIC dziedziczą. Odebranie prawa samym rolom nie
// wystarcza — trzeba odebrać PUBLIC, inaczej funkcja dalej wisi pod
// /rest/v1/rpc/<nazwa>. Te testy pilnują, żeby nie wróciło.
console.log('\nFunkcje zamknięte przed przeglądarką');
await asService();

for (const [nazwa, sygnatura] of [
  ['mark_order_paid', 'public.mark_order_paid(uuid, text, text)'],
  ['take_stock', 'public.take_stock(uuid, integer, text, uuid)'],
  ['return_stock', 'public.return_stock(uuid, integer, text, uuid)'],
  ['handle_new_user', 'public.handle_new_user()'],
  ['custom_access_token_hook', 'public.custom_access_token_hook(jsonb)'],
]) {
  const { rows } = await db.query(
    `select has_function_privilege('anon', $1, 'execute') as a,
            has_function_privilege('authenticated', $1, 'execute') as u`,
    [sygnatura]
  );
  check(`${nazwa}: gość nie uruchomi`, rows[0].a === false, `anon=${rows[0].a}`);
  check(`${nazwa}: zalogowany nie uruchomi`, rows[0].u === false, `authenticated=${rows[0].u}`);
}

// Wystawione świadomie — mają własne sprawdzenie uprawnień w środku
for (const [nazwa, sygnatura] of [
  ['create_order', 'public.create_order(jsonb, text, text, jsonb, text)'],
  ['quote_order', 'public.quote_order(jsonb, text)'],
]) {
  const { rows } = await db.query(
    `select has_function_privilege('anon', $1, 'execute') as a`,
    [sygnatura]
  );
  check(`${nazwa}: gość uruchomi`, rows[0].a === true, `anon=${rows[0].a}`);
}

// Ustalony search_path — bez niego funkcja z cudzymi prawami rozwiązuje
// nazwy tabel według ścieżki wołającego
for (const nazwa of ['custom_access_token_hook', 'touch_updated_at']) {
  const { rows } = await db.query(
    `select p.proconfig from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = $1`,
    [nazwa]
  );
  const ustawiony = (rows[0]?.proconfig ?? []).some((c) => c.startsWith('search_path='));
  check(`${nazwa}: ma ustalony search_path`, ustawiony, `${rows[0]?.proconfig}`);
}

// ---------------------------------------------------------------------------
console.log('\nStany magazynowe');
await asService();
const { rows: [camera] } = await db.query(
  `select id, stock from public.products where slug = 'aparat-bezlusterkowy-lumen-r7'`
);

await asUser(customer.id);
await throws(
  'zamówienie ponad stan odrzucone',
  () =>
    db.query(`select * from public.create_order($1::jsonb, $2, null, null, null)`, [
      JSON.stringify([{ product_id: camera.id, qty: camera.stock + 1 }]),
      'klient@example.com',
    ]),
  'Za mało sztuk'
);

await asService();
const cameraAfter = await db.query(`select stock from public.products where id = $1`, [camera.id]);
check('nieudane zamówienie nie ruszyło stanu', cameraAfter.rows[0].stock === camera.stock, `${cameraAfter.rows[0].stock}`);

// Wyścig: dwa zejścia ze stanu, drugie nie ma prawa przejść
const { rows: [lastOne] } = await db.query(
  `update public.products set stock = 1 where slug = 'zamek-smart-lock-pro' returning id`
);
const takeA = await db.query(`select public.take_stock($1, 1, 'test A') as ok`, [lastOne.id]);
const takeB = await db.query(`select public.take_stock($1, 1, 'test B') as ok`, [lastOne.id]);
check('pierwsze zejście ze stanu przechodzi', takeA.rows[0].ok === true);
check('drugie zejście odrzucone (brak oversellingu)', takeB.rows[0].ok === false);

const finalStock = await db.query(`select stock from public.products where id = $1`, [lastOne.id]);
check('stan nie zszedł poniżej zera', finalStock.rows[0].stock === 0, `${finalStock.rows[0].stock}`);

// ---------------------------------------------------------------------------
console.log('\nPłatność i anulowanie');
await asService();
const paid = await db.query(`select * from public.mark_order_paid($1, 'stripe', 'pi_test_123')`, [order.id]);
check('zamówienie opłacone', paid.rows[0].payment_status === 'opłacone');
check('status przeszedł w realizację', paid.rows[0].status === 'w realizacji');

const paidAgain = await db.query(`select * from public.mark_order_paid($1, 'stripe', 'pi_test_123')`, [order.id]);
check('powtórka webhooka nic nie psuje', paidAgain.rows[0].payment_status === 'opłacone');

const stockBeforeCancel = (await db.query(`select stock from public.products where id = $1`, [bulb.id])).rows[0].stock;
await asUser(customer.id);
const cancelled = await db.query(`select * from public.cancel_order($1)`, [smallOrder.id]);
check('zamówienie anulowane', cancelled.rows[0].status === 'anulowane');

await asService();
const stockAfterCancel = (await db.query(`select stock from public.products where id = $1`, [bulb.id])).rows[0].stock;
check('towar wrócił na magazyn', stockAfterCancel === stockBeforeCancel + 1, `${stockAfterCancel} vs ${stockBeforeCancel}`);

await asUser(other.id);
await throws(
  'obcy nie anuluje cudzego zamówienia',
  () => db.query(`select * from public.cancel_order($1)`, [order.id]),
  'Brak uprawnień'
);

// ---------------------------------------------------------------------------
console.log('\nRow Level Security');
await asUser(customer.id);
const mine = await db.query(`select count(*) as n from public.orders`);
check('klient widzi swoje zamówienia', Number(mine.rows[0].n) >= 3, `${mine.rows[0].n}`);

await asUser(other.id);
const notMine = await db.query(`select count(*) as n from public.orders`);
check('klient nie widzi cudzych zamówień', Number(notMine.rows[0].n) === 0, `${notMine.rows[0].n}`);

const foreignItems = await db.query(`select count(*) as n from public.order_items`);
check('ani cudzych pozycji', Number(foreignItems.rows[0].n) === 0, `${foreignItems.rows[0].n}`);

await asUser(owner.id);
const allOrders = await db.query(`select count(*) as n from public.orders`);
check('zaplecze widzi wszystkie zamówienia', Number(allOrders.rows[0].n) >= 3, `${allOrders.rows[0].n}`);

// Eskalacja uprawnień
await asUser(other.id);
await throws(
  'klient nie nada sobie roli właściciela',
  () => db.query(`insert into public.user_roles (user_id, role) values ($1, 'owner')`, [other.id]),
  'policy'
);

await throws(
  'klient nie doda produktu',
  () =>
    db.query(
      `insert into public.products (slug, name, price_cents) values ('lewy', 'Lewy produkt', 1)`
    ),
  'policy'
);

// RLS na UPDATE nie rzuca błędem — po prostu nie widzi wiersza do zmiany
const priceUpdate = await db.query(`update public.products set price_cents = 1 where id = $1`, [bulb.id]);
check('próba zmiany ceny nie trafia w żaden wiersz', priceUpdate.affectedRows === 0, `${priceUpdate.affectedRows}`);

const priceCheck = await db.query(`select price_cents from public.products where id = $1`, [bulb.id]);
check('cena nietknięta', priceCheck.rows[0].price_cents === bulb.price_cents);

// Katalog publiczny dla niezalogowanych
await asUser(null, 'anon');
const anonProducts = await db.query(`select count(*) as n from public.products`);
check('gość widzi katalog', Number(anonProducts.rows[0].n) === 8, `${anonProducts.rows[0].n}`);

// Gość nie dostaje pustej listy, tylko odmowę — brak GRANT-u na tabeli.
// To mocniejsza bariera niż sama polityka RLS.
await throws(
  'gość nie czyta zamówień',
  () => db.query(`select count(*) from public.orders`),
  'permission denied'
);

await throws(
  'gość nie czyta profili',
  () => db.query(`select count(*) from public.profiles`),
  'permission denied'
);

await throws(
  'gość nie czyta ruchów magazynowych',
  () => db.query(`select count(*) from public.inventory_movements`),
  'permission denied'
);

// ---------------------------------------------------------------------------
// Obsługa zamówień z panelu zaplecza
// ---------------------------------------------------------------------------
console.log('\nObsługa zamówień');
await asService();
const { rows: [handled] } = await db.query(
  `select id, status from public.orders where status <> 'anulowane' order by created_at limit 1`
);

// Klient nie dostaje błędu, tylko zero trafionych wierszy — RLS nie widzi
// cudzego zamówienia, więc UPDATE nie ma czego zmienić.
await asUser(other.id);
const foreignUpdate = await db.query(
  `update public.orders set status = 'wysłane' where id = $1`, [handled.id]
);
check('klient nie przestawi cudzego statusu', foreignUpdate.affectedRows === 0, `${foreignUpdate.affectedRows}`);

// Własnego też nie: polityka „zamówienia: obsługa" wymaga orders.write
await asUser(customer.id);
const ownUpdate = await db.query(
  `update public.orders set status = 'dostarczone' where id = $1`, [handled.id]
);
check('klient nie przestawi własnego statusu', ownUpdate.affectedRows === 0, `${ownUpdate.affectedRows}`);

await asUser(owner.id);
const staffUpdate = await db.query(
  `update public.orders set status = 'wysłane' where id = $1 returning status`, [handled.id]
);
check('zaplecze przestawia status', staffUpdate.rows[0]?.status === 'wysłane', `${staffUpdate.rows[0]?.status}`);

// Klient wycofuje własne zamówienie — cancel_order sprawdza właściciela sam,
// bo pod spodem musi ruszyć magazyn, czego RLS na orders nie obejmuje.
await asService();
const { rows: [ownFresh] } = await db.query(
  `insert into public.orders (user_id, email, status) values ($1, 'klient@example.com', 'nowe') returning id`,
  [customer.id]
);
await asUser(customer.id);
const cancelledByOwner = await db.query(`select status from public.cancel_order($1)`, [ownFresh.id]);
check('klient anuluje własne zamówienie', cancelledByOwner.rows[0].status === 'anulowane', `${cancelledByOwner.rows[0].status}`);

// ---------------------------------------------------------------------------
// Granice stanów — migracja 20260807160000
//
// Interfejs pokazywał „Anuluj" tylko przy zamówieniu w stanie „nowe", a zwrot
// tylko przy „dostarczone". Funkcje sprawdzały wyłącznie, KTO woła, nigdy
// W JAKIM STANIE jest zamówienie — a RPC jest wywoływalne z palca kluczem
// `anon`, który leży w kodzie strony. Te przypadki pilnują, żeby granica
// została po stronie bazy.
// ---------------------------------------------------------------------------
console.log('\nGranice stanów zamówień');

/** Świeże zamówienie klienta w zadanym stanie, bez przechodzenia przez sklep. */
async function zamowienieKlienta(status = 'nowe', payment = 'oczekuje') {
  await asService();
  const { rows: [row] } = await db.query(
    `insert into public.orders (user_id, email, status, payment_status)
     values ($1, 'klient@example.com', $2, $3) returning id`,
    [customer.id, status, payment]
  );
  return row.id;
}

const oplacone = await zamowienieKlienta('nowe', 'opłacone');
await asUser(customer.id);
await throws(
  'klient nie anuluje opłaconego zamówienia',
  () => db.query(`select * from public.cancel_order($1)`, [oplacone]),
  'opłacone'
);

const wRealizacji = await zamowienieKlienta('spakowane');
await asUser(customer.id);
await throws(
  'klient nie anuluje zamówienia, które ruszyło',
  () => db.query(`select * from public.cancel_order($1)`, [wRealizacji]),
  'w realizacji'
);

// Zaplecze zostaje bez ograniczeń — anulowanie wysłanej paczki po telefonie
// od klienta to zwykła praca obsługi.
const wyslane = await zamowienieKlienta('wysłane', 'opłacone');
await asUser(owner.id);
const anulowanePrzezZaplecze = await db.query(`select status from public.cancel_order($1)`, [wyslane]);
check(
  'zaplecze anuluje wysłane zamówienie',
  anulowanePrzezZaplecze.rows[0].status === 'anulowane',
  `${anulowanePrzezZaplecze.rows[0].status}`
);

// Surowy UPDATE omijał zwrot towaru: status leciał na „anulowane", a magazyn
// zostawał bez zmian. Wyzwalacz zamyka tę drogę także zapleczu.
const doUpdate = await zamowienieKlienta('nowe');
await asUser(owner.id);
await throws(
  'surowy UPDATE na „anulowane" odrzucony',
  () => db.query(`update public.orders set status = 'anulowane' where id = $1`, [doUpdate]),
  'cancel_order'
);

// Kolejka pakowania przestawia wyłącznie stany kolejki
await throws(
  'kolejka nie ustawia „dostarczone"',
  () => db.query(`select public.ustaw_stan_zamowienia($1, 'dostarczone')`, [doUpdate]),
  'wyłącznie'
);
const wKolejce = await db.query(`select public.ustaw_stan_zamowienia($1, 'spakowane') as stan`, [doUpdate]);
check('kolejka ustawia „spakowane"', wKolejce.rows[0].stan === 'spakowane', `${wKolejce.rows[0].stan}`);

// Anulowana paczka nie dostaje listu przewozowego — towar wrócił na magazyn
await asUser(owner.id);
await throws(
  'nie nadajemy przesyłki na anulowane zamówienie',
  () => db.query(`select public.nadaj_przesylke($1, 'PACZKA-TEST')`, [wyslane]),
  'anulowane'
);

// Zwroty: dopiero po dostarczeniu i tylko do wysokości tego, co zostało
await asService();
await db.query(`update public.products set stock = 20 where id = $1`, [bulb.id]);
await asUser(customer.id);
const doZwrotu = (
  await db.query(`select * from public.create_order($1::jsonb, $2, null, null, null)`, [
    JSON.stringify([{ product_id: bulb.id, qty: 2 }]),
    'klient@example.com',
  ])
).rows[0];

await throws(
  'zwrot przed dostarczeniem odrzucony',
  () =>
    db.query(`select public.zglos_zwrot($1, $2::jsonb, null)`, [
      doZwrotu.id,
      JSON.stringify([{ product_id: bulb.id, qty: 1 }]),
    ]),
  'po dostarczeniu'
);

await asService();
await db.query(`update public.orders set status = 'dostarczone' where id = $1`, [doZwrotu.id]);

await asUser(customer.id);
const pierwszyZwrot = await db.query(`select public.zglos_zwrot($1, $2::jsonb, null) as id`, [
  doZwrotu.id,
  JSON.stringify([{ product_id: bulb.id, qty: 2 }]),
]);
check('zwrot całego zamówienia przechodzi', Boolean(pierwszyZwrot.rows[0].id));

// Ta sama pozycja drugi raz: wcześniej przechodziło bez ograniczeń i magazyn
// przyjmował sztuki, których nikt nie kupił.
await throws(
  'ten sam zwrot drugi raz odrzucony',
  () =>
    db.query(`select public.zglos_zwrot($1, $2::jsonb, null)`, [
      doZwrotu.id,
      JSON.stringify([{ product_id: bulb.id, qty: 2 }]),
    ]),
  'zgłoszono już'
);

// Kupon z limitem użyć: sprawdzenie i licznik w jednej instrukcji
await asService();
await db.query(
  `insert into public.coupons (code, percent_off, max_uses, used_count)
   values ('JEDNORAZ', 10, 1, 0) on conflict (code) do update set max_uses = 1, used_count = 0`
);
await db.query(`update public.products set stock = 20 where id = $1`, [bulb.id]);

await asUser(customer.id);
await db.query(`select * from public.create_order($1::jsonb, $2, null, null, $3)`, [
  JSON.stringify([{ product_id: bulb.id, qty: 1 }]),
  'klient@example.com',
  'JEDNORAZ',
]);
await throws(
  'kupon nie przekracza limitu użyć',
  () =>
    db.query(`select * from public.create_order($1::jsonb, $2, null, null, $3)`, [
      JSON.stringify([{ product_id: bulb.id, qty: 1 }]),
      'klient@example.com',
      'JEDNORAZ',
    ]),
  'JEDNORAZ'
);

await asService();
const licznik = await db.query(`select used_count from public.coupons where code = 'JEDNORAZ'`);
check('licznik kuponu stanął na limicie', licznik.rows[0].used_count === 1, `${licznik.rows[0].used_count}`);

// Stara funkcja korekty zniknęła razem z ekranem, który jej używał
const stara = await db.query(
  `select count(*) as n from pg_proc where proname = 'adjust_stock' and pronamespace = 'public'::regnamespace`
);
check('adjust_stock skasowana', Number(stara.rows[0].n) === 0, `${stara.rows[0].n}`);

// ---------------------------------------------------------------------------
// Zdjęcia produktów w Storage
// ---------------------------------------------------------------------------
console.log('\nZdjęcia produktów');
await asService();
const bucket = await db.query(`select public, allowed_mime_types from storage.buckets where id = 'product-images'`);
check('kubełek publiczny do odczytu', bucket.rows[0]?.public === true);
check('dopuszczone tylko obrazy', (bucket.rows[0]?.allowed_mime_types ?? []).every((t) => t.startsWith('image/')));

await asUser(other.id);
await throws(
  'klient nie wgra zdjęcia produktu',
  () =>
    db.query(
      `insert into storage.objects (bucket_id, name, owner) values ('product-images', 'lewe.png', $1)`,
      [other.id]
    ),
  'policy'
);

await asUser(owner.id);
const uploaded = await db.query(
  `insert into storage.objects (bucket_id, name, owner) values ('product-images', 'aura.png', $1) returning name`,
  [owner.id]
);
check('zaplecze wgrywa zdjęcie', uploaded.rows[0]?.name === 'aura.png');

// Gość nie ma prawa wylistować kubełka. Samo zdjęcie widzi i tak: kubełek jest
// publiczny, więc pobranie pliku po adresie omija RLS z definicji i nie da się
// tego sprawdzić zapytaniem SQL. Polityka SELECT dawała co innego — prawo
// poznania wszystkich nazw plików, w tym zdjęć produktów wycofanych z katalogu.
await asUser(null, 'anon');
const listaGoscia = await db.query(`select count(*) as n from storage.objects where bucket_id = 'product-images'`);
check('gość nie wylistuje kubełka', Number(listaGoscia.rows[0].n) === 0, `${listaGoscia.rows[0].n}`);

await asUser(owner.id);
const listaZaplecza = await db.query(`select count(*) as n from storage.objects where bucket_id = 'product-images'`);
check('zaplecze widzi zawartość kubełka', Number(listaZaplecza.rows[0].n) === 1, `${listaZaplecza.rows[0].n}`);

// Ścieżka zdjęcia wisi przy produkcie; brak zdjęcia to zwykły NULL
await asService();
await db.query(`update public.products set image_path = 'aura.png' where id = $1`, [headphones.id]);
await asUser(null, 'anon');
const withImage = await db.query(`select image_path from public.products where id = $1`, [headphones.id]);
check('ścieżka zdjęcia czytelna publicznie', withImage.rows[0].image_path === 'aura.png');

// ---------------------------------------------------------------------------
// Panel konta: lista życzeń i adresy
// ---------------------------------------------------------------------------
console.log('\nPanel konta');
await asUser(customer.id);
await db.query(`insert into public.wishlists (user_id, product_id) values ($1, $2)`, [
  customer.id,
  bulb.id,
]);
await db.query(
  `insert into public.addresses (user_id, recipient, street, postal_code, city, is_default)
   values ($1, 'Klient Testowy', 'Krucza 12/4', '00-001', 'Warszawa', true)`,
  [customer.id]
);

const myWish = await db.query(`select count(*) as n from public.wishlists`);
check('klient widzi swoją listę życzeń', Number(myWish.rows[0].n) === 1, `${myWish.rows[0].n}`);

const myAddr = await db.query(`select count(*) as n from public.addresses`);
check('klient widzi swój adres', Number(myAddr.rows[0].n) === 1, `${myAddr.rows[0].n}`);

await asUser(other.id);
const foreignWish = await db.query(`select count(*) as n from public.wishlists`);
check('klient nie widzi cudzej listy życzeń', Number(foreignWish.rows[0].n) === 0, `${foreignWish.rows[0].n}`);

const foreignAddr = await db.query(`select count(*) as n from public.addresses`);
check('klient nie widzi cudzego adresu', Number(foreignAddr.rows[0].n) === 0, `${foreignAddr.rows[0].n}`);

await throws(
  'klient nie dopisze się do cudzej listy życzeń',
  () => db.query(`insert into public.wishlists (user_id, product_id) values ($1, $2)`, [customer.id, bulb.id]),
  'policy'
);

// Zaplecze obsługuje wysyłkę, więc adresy czyta — ale listy życzeń już nie
await asUser(owner.id);
const staffWish = await db.query(`select count(*) as n from public.wishlists`);
check('zaplecze nie zagląda na listy życzeń', Number(staffWish.rows[0].n) === 0, `${staffWish.rows[0].n}`);

const staffAddr = await db.query(`select count(*) as n from public.addresses`);
// Wierszy jest więcej niż jeden — dochodzi adres klienta z seeda
check('zaplecze czyta adresy do wysyłki', Number(staffAddr.rows[0].n) >= 1, `${staffAddr.rows[0].n}`);

const ownProfile = await db.query(`select count(*) as n from public.profiles where id = $1`, [customer.id]);
check('profil klienta widoczny dla zaplecza', Number(ownProfile.rows[0].n) === 1, `${ownProfile.rows[0].n}`);

// ---------------------------------------------------------------------------
// Panel właściciela: koszty, dziennik, role, przesyłki
// ---------------------------------------------------------------------------
console.log('\nPanel właściciela');

await asService();
const { rows: [towar] } = await db.query(`select id from public.products limit 1`);
await db.query(
  `insert into public.koszty_produktow (product_id, koszt_cents) values ($1, 4200)
   on conflict (product_id) do update set koszt_cents = excluded.koszt_cents`,
  [towar.id]
);

// Koszt zakupu to nie jest informacja dla kupującego
await asUser(customer.id);
const kosztKlient = await db.query(`select count(*) as n from public.koszty_produktow`);
check('klient nie widzi kosztu zakupu', Number(kosztKlient.rows[0].n) === 0, `${kosztKlient.rows[0].n}`);

await asUser(owner.id);
const kosztZaplecze = await db.query(`select count(*) as n from public.koszty_produktow`);
check('zaplecze widzi koszt zakupu', Number(kosztZaplecze.rows[0].n) >= 1, `${kosztZaplecze.rows[0].n}`);

// Koszt pozycji utrwala się przy sprzedaży, a nie przelicza z dzisiejszego
const zamKoszt = await zamowienieKlienta('nowe');
await asService();
await db.query(
  `insert into public.order_items (order_id, product_id, name, unit_price_cents, qty, line_total_cents)
   values ($1, $2, 'Towar testowy', 9900, 1, 9900)`,
  [zamKoszt, towar.id]
);
const utrwalony = await db.query(
  `select kp.koszt_jednostkowy_cents as koszt
   from public.koszty_pozycji kp
   join public.order_items oi on oi.id = kp.order_item_id
   where oi.order_id = $1`,
  [zamKoszt]
);
check(
  'koszt pozycji utrwalony przy zamówieniu',
  utrwalony.rows.some((r) => Number(r.koszt) === 4200),
  `${utrwalony.rows.map((r) => r.koszt).join(',') || 'brak wierszy'}`
);

// Dziennik jest dopisywalny wyłącznie przez funkcje, i tylko przez nie
await asUser(owner.id);
await throws(
  'klient zaplecza nie dopisze się do dziennika',
  () =>
    db.query(
      `insert into public.dziennik_zaplecza (obszar, opis) values ('rola', 'awansowałem się')`
    ),
  // Nie „policy" — tabela nie ma nawet GRANT-u na insert, więc Postgres odbija
  // żądanie o krok wcześniej, zanim dojdzie do polityk.
  'permission denied'
);

await db.query(`select public.ustaw_stan_zamowienia($1, 'spakowane')`, [zamKoszt]);
const wpis = await db.query(
  `select opis from public.dziennik_zaplecza where obszar = 'zamowienie' order by id desc limit 1`
);
check(
  'zmiana stanu zostawia ślad w dzienniku',
  (wpis.rows[0]?.opis ?? '').includes('spakowane'),
  `${wpis.rows[0]?.opis ?? 'brak wpisu'}`
);

await asUser(customer.id);
const dziennikKlient = await db.query(`select count(*) as n from public.dziennik_zaplecza`);
check('klient nie czyta dziennika', Number(dziennikKlient.rows[0].n) === 0, `${dziennikKlient.rows[0].n}`);

// Nadanie idempotentne: drugie dotknięcie przycisku nie tworzy drugiej paczki
const zamPaczka = await zamowienieKlienta('nowe');
await asUser(owner.id);
await db.query(`select public.nadaj_paczke($1, 'PACZKA-1', 'inpost', 'KRA012', 'ext-1')`, [zamPaczka]);
const drugie = await db.query(
  `select public.nadaj_paczke($1, 'PACZKA-2', 'inpost', 'KRA012', 'ext-2') as numer`,
  [zamPaczka]
);
check('powtórne nadanie oddaje pierwszy numer', drugie.rows[0].numer === 'PACZKA-1', `${drugie.rows[0].numer}`);

const ilePaczek = await db.query(`select count(*) as n from public.przesylki where order_id = $1`, [zamPaczka]);
check('jedno zamówienie, jedna przesyłka', Number(ilePaczek.rows[0].n) === 1, `${ilePaczek.rows[0].n}`);

// Role: ostatni właściciel i zakaz awansu ponad własną rolę
await throws(
  'ostatni właściciel nie do zdegradowania',
  () => db.query(`select public.nadaj_role($1, 'staff')`, [owner.id]),
  'jedyny właściciel'
);

await asService();
const { rows: [pakujacy] } = await db.query(`
  insert into auth.users (email, aud, role) values ('pakowacz@example.com', 'authenticated', 'authenticated')
  returning id
`);
await asUser(owner.id);
const nadana = await db.query(`select public.nadaj_role($1, 'staff') as rola`, [pakujacy.id]);
check('właściciel nadaje rolę pracownikowi', nadana.rows[0].rola === 'staff', `${nadana.rows[0].rola}`);

await asUser(pakujacy.id);
await throws(
  'pracownik nie nadaje ról',
  () => db.query(`select public.nadaj_role($1, 'owner')`, [pakujacy.id]),
  'Brak uprawnień'
);

// Widok marży musi mieć GRANT, nie tylko politykę. Bez niego PostgREST oddaje
// pustą listę, a panel rysuje marżę zero przy prawdziwym przychodzie — cisza
// droższa niż błąd, bo wygląda na prawdę.
await asService();
const grantMarzy = await db.query(
  `select has_table_privilege('authenticated', 'public.marza_dziennie', 'select') as ma`
);
check('widok marży dostępny przez API', grantMarzy.rows[0].ma === true, `${grantMarzy.rows[0].ma}`);

// Historia cen: zmiana ceny zostawia wiersz, z którego liczy się Omnibus
await asUser(owner.id);
await asUser(owner.id);
await db.query(`update public.products set price_cents = price_cents - 500 where id = $1`, [towar.id]);
const historia = await db.query(
  `select count(*) as n from public.historia_cen where product_id = $1`,
  [towar.id]
);
check('zmiana ceny dopisuje się do historii', Number(historia.rows[0].n) >= 1, `${historia.rows[0].n}`);

// ---------------------------------------------------------------------------
await asService();
console.log(`\n${passed} przeszło, ${failed} nie przeszło\n`);
process.exit(failed === 0 ? 0 : 1);
