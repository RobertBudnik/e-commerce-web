/**
 * Generator danych startowych: scripts/seed-data.mjs → supabase/seed.sql
 * Użycie: node scripts/gen-seed.mjs > supabase/seed.sql
 *
 * Wypełnia lokalną bazę czymś, na czym da się klikać. Na produkcji katalog
 * wpisuje się przez panel produktów, a seeda się nie uruchamia.
 */
import { CATEGORIES, ORDERS, PRODUCTS } from './seed-data.mjs';

const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

const slug = (name) =>
  name
    .toLowerCase()
    .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l')
    .replace(/ń/g, 'n').replace(/ó/g, 'o').replace(/ś/g, 's').replace(/[żź]/g, 'z')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const PERMISSIONS = {
  owner: ['products.read_all', 'products.write', 'orders.read_all', 'orders.write', 'customers.read', 'inventory.write', 'roles.manage'],
  manager: ['products.read_all', 'products.write', 'orders.read_all', 'orders.write', 'customers.read', 'inventory.write'],
  staff: ['products.read_all', 'orders.read_all', 'orders.write', 'inventory.write'],
};

const out = [];

out.push(`-- =============================================================================
-- Dane startowe
-- Generowane: node scripts/gen-seed.mjs > supabase/seed.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Macierz uprawnień
-- ---------------------------------------------------------------------------
insert into public.role_permissions (role, permission) values`);
out.push(
  Object.entries(PERMISSIONS)
    .flatMap(([role, list]) => list.map((p) => `  ('${role}', '${p}')`))
    .join(',\n') + '\non conflict do nothing;\n'
);

out.push(`-- ---------------------------------------------------------------------------
-- Kategorie
-- ---------------------------------------------------------------------------
insert into public.categories (id, name, description, icon, position) values`);
out.push(
  CATEGORIES.map((c, i) => `  (${q(c.id)}, ${q(c.name)}, ${q(c.desc)}, ${q(c.icon)}, ${i})`).join(',\n') +
    '\non conflict (id) do nothing;\n'
);

out.push(`-- ---------------------------------------------------------------------------
-- Produkty
-- ---------------------------------------------------------------------------
insert into public.products
  (slug, name, short, category_id, price_cents, old_price_cents, stock, rating, reviews_count, icon, badge, specs) values`);
out.push(
  PRODUCTS.map(
    (p) =>
      `  (${q(slug(p.name))}, ${q(p.name)}, ${q(p.short)}, ${q(p.category)}, ${Math.round(p.price * 100)}, ` +
      `${p.oldPrice ? Math.round(p.oldPrice * 100) : 'null'}, ${p.stock}, ${p.rating}, ${p.reviews}, ` +
      `${q(p.icon)}, ${q(p.badge)}, ${q(JSON.stringify(p.specs))}::jsonb)`
  ).join(',\n') + '\non conflict (slug) do nothing;\n'
);

out.push(`-- ---------------------------------------------------------------------------
-- Kupony
-- ---------------------------------------------------------------------------
insert into public.coupons (code, percent_off, is_active) values
  ('NOWY10', 10, true),
  ('LATO20', 20, true)
on conflict (code) do nothing;
`);

out.push(`-- ---------------------------------------------------------------------------
-- Konto właściciela do pracy lokalnej.
-- Hasło ustawiane wyłącznie tutaj, w seedzie lokalnym — na produkcji role nadaje
-- się istniejącemu użytkownikowi:
--   insert into public.user_roles (user_id, role)
--   select id, 'owner' from auth.users where email = 'twoj@adres.pl';
-- ---------------------------------------------------------------------------
do $$
declare
  admin_id uuid;
begin
  select id into admin_id from auth.users where email = 'admin@sklep.example';

  if admin_id is null then
    admin_id := gen_random_uuid();

    -- Kolumny tokenów muszą być pustymi napisami, nie NULL-ami. GoTrue mapuje je
    -- na typ string i przy NULL-u wywala logowanie błędem 500.
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token,
      email_change, email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
      'admin@sklep.example', crypt('lokalne-haslo-dev', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Zaplecze sklepu"}'::jsonb,
      '', '', '', '', '', '', '', ''
    );

    -- Wpis tożsamości — bez niego logowanie hasłem nie znajduje konta
    insert into auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      admin_id, admin_id,
      jsonb_build_object('sub', admin_id::text, 'email', 'admin@sklep.example', 'email_verified', true),
      'email', now(), now(), now()
    )
    on conflict do nothing;
  end if;

  insert into public.user_roles (user_id, role)
  values (admin_id, 'owner')
  on conflict (user_id, role) do nothing;
end $$;
`);

/* ---------------------------------------------------------------------------
 * Demo dla panelu konta: konto klienta, jego zamówienie, adres i lista życzeń
 * plus dwa zamówienia gościa. Dzięki temu widać różnicę, którą robi RLS:
 * właściciel widzi wszystkie trzy, klient wyłącznie swoje jedno.
 * ------------------------------------------------------------------------- */
const DEMO_CUSTOMER = { email: 'klient@sklep.example', name: 'Robert Kowalski' };
const STATUS = { 'w drodze': 'wysłane', dostarczone: 'dostarczone' };

const parseAddress = (line) => {
  // "Krucza 12/4, 00-001 Warszawa" → ulica / kod / miasto
  const [street = '', rest = ''] = line.split(',').map((s) => s.trim());
  const [postal = '', ...city] = rest.split(' ');
  return { street, postal, city: city.join(' ') };
};

const orderSql = ORDERS.map((o, idx) => {
  const own = idx === 0;
  const addr = parseAddress(o.address);
  const items = o.items.map((i) => {
    const p = PRODUCTS.find((x) => x.id === i.id);
    return { slug: slug(p.name), qty: i.qty, cents: Math.round(p.price * 100) };
  });
  const subtotal = items.reduce((s, i) => s + i.cents * i.qty, 0);
  const shipping = Math.round(o.shipping * 100);
  const email = own ? DEMO_CUSTOMER.email : o.email;

  const itemRows = items
    .map(
      (i) => `    insert into public.order_items (order_id, product_id, name, unit_price_cents, qty, line_total_cents)
    select order_id, p.id, p.name, p.price_cents, ${i.qty}, p.price_cents * ${i.qty}
    from public.products p where p.slug = ${q(i.slug)};`
    )
    .join('\n');

  return `    insert into public.orders (
      order_number, user_id, email, phone, status, payment_status,
      subtotal_cents, discount_cents, shipping_cents, total_cents,
      shipping_address, created_at
    ) values (
      ${q(o.id)}, ${own ? 'customer_id' : 'null'}, ${q(email)}, ${q(o.phone)},
      ${q(STATUS[o.status] ?? 'nowe')}, 'opłacone',
      ${subtotal}, 0, ${shipping}, ${subtotal + shipping},
      jsonb_build_object(
        'recipient', ${q(o.customer)}, 'street', ${q(addr.street)},
        'postal_code', ${q(addr.postal)}, 'city', ${q(addr.city)},
        'country', 'PL', 'phone', ${q(o.phone)}
      ),
      ${q(o.date)}::timestamptz
    ) returning id into order_id;

${itemRows}`;
}).join('\n\n');

out.push(`-- ---------------------------------------------------------------------------
-- Konto klienta demo + historia zamówień (wyłącznie do pracy lokalnej).
-- Zamówienia z pierwszego wiersza należą do klienta, pozostałe to zakupy gościa —
-- klient ich nie zobaczy, bo polityka "zamówienia: odczyt własnych" tnie po user_id.
-- ---------------------------------------------------------------------------
do $$
declare
  customer_id uuid;
  order_id uuid;
begin
  select id into customer_id from auth.users where email = ${q(DEMO_CUSTOMER.email)};

  if customer_id is null then
    customer_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token,
      email_change, email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', customer_id, 'authenticated', 'authenticated',
      ${q(DEMO_CUSTOMER.email)}, crypt('lokalne-haslo-dev', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      ${q(JSON.stringify({ full_name: DEMO_CUSTOMER.name }))}::jsonb,
      '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      customer_id, customer_id,
      jsonb_build_object('sub', customer_id::text, 'email', ${q(DEMO_CUSTOMER.email)}, 'email_verified', true),
      'email', now(), now(), now()
    )
    on conflict do nothing;
  end if;

  -- Adres dostawy klienta
  insert into public.addresses (user_id, recipient, street, postal_code, city, phone, is_default)
  select customer_id, ${q(ORDERS[0].customer)}, ${q(parseAddress(ORDERS[0].address).street)},
         ${q(parseAddress(ORDERS[0].address).postal)}, ${q(parseAddress(ORDERS[0].address).city)},
         ${q(ORDERS[0].phone)}, true
  where not exists (select 1 from public.addresses where user_id = customer_id);

  -- Lista życzeń klienta
  insert into public.wishlists (user_id, product_id)
  select customer_id, p.id from public.products p
  where p.slug in (${[PRODUCTS[1], PRODUCTS[6]].map((p) => q(slug(p.name))).join(', ')})
  on conflict do nothing;

  -- Zamówienia. Numery są stałe, więc powtórzony seed nic nie dubluje.
  if not exists (select 1 from public.orders) then
${orderSql}
  end if;

  -- Profil zakłada trigger handle_new_user; tu dochodzi telefon do panelu konta
  update public.profiles set full_name = ${q(DEMO_CUSTOMER.name)}, phone = ${q(ORDERS[0].phone)}
  where id = customer_id;
end $$;
`);

console.log(out.join('\n'));
