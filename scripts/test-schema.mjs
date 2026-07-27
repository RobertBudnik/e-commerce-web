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
  raw_user_meta_data jsonb default '{}'::jsonb
);

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
check('macierz uprawnień wypełniona', Number(c.perms) === 17, `jest ${c.perms}`);
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
await asService();
console.log(`\n${passed} przeszło, ${failed} nie przeszło\n`);
process.exit(failed === 0 ? 0 : 1);
