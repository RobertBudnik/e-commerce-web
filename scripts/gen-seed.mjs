/**
 * Generator danych startowych: js/data.js → supabase/seed.sql
 * Użycie: node scripts/gen-seed.mjs > supabase/seed.sql
 *
 * Trzyma seed w zgodzie z katalogiem szablonu. Gdy katalog zacznie żyć
 * w bazie, ten skrypt przestaje być potrzebny.
 */
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');
const sandbox = {};
new Function('exports', `${src}\nexports.CATEGORIES = CATEGORIES; exports.PRODUCTS = PRODUCTS;`)(sandbox);
const { CATEGORIES, PRODUCTS } = sandbox;

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
-- Nordo — dane startowe
-- Generowane z js/data.js: node scripts/gen-seed.mjs > supabase/seed.sql
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
  select id into admin_id from auth.users where email = 'admin@nordo.pl';

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
      'admin@nordo.pl', crypt('nordo-local-dev', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Nordo HQ"}'::jsonb,
      '', '', '', '', '', '', '', ''
    );

    -- Wpis tożsamości — bez niego logowanie hasłem nie znajduje konta
    insert into auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      admin_id, admin_id,
      jsonb_build_object('sub', admin_id::text, 'email', 'admin@nordo.pl', 'email_verified', true),
      'email', now(), now(), now()
    )
    on conflict do nothing;
  end if;

  insert into public.user_roles (user_id, role)
  values (admin_id, 'owner')
  on conflict (user_id, role) do nothing;
end $$;
`);

console.log(out.join('\n'));
