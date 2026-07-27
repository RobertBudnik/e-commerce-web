-- =============================================================================
-- Nordo — dane startowe
-- Generowane z js/data.js: node scripts/gen-seed.mjs > supabase/seed.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Macierz uprawnień
-- ---------------------------------------------------------------------------
insert into public.role_permissions (role, permission) values
  ('owner', 'products.read_all'),
  ('owner', 'products.write'),
  ('owner', 'orders.read_all'),
  ('owner', 'orders.write'),
  ('owner', 'customers.read'),
  ('owner', 'inventory.write'),
  ('owner', 'roles.manage'),
  ('manager', 'products.read_all'),
  ('manager', 'products.write'),
  ('manager', 'orders.read_all'),
  ('manager', 'orders.write'),
  ('manager', 'customers.read'),
  ('manager', 'inventory.write'),
  ('staff', 'products.read_all'),
  ('staff', 'orders.read_all'),
  ('staff', 'orders.write'),
  ('staff', 'inventory.write')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Kategorie
-- ---------------------------------------------------------------------------
insert into public.categories (id, name, description, icon, position) values
  ('audio', 'Audio', 'Słuchawki i głośniki', 'headphones', 0),
  ('komputery', 'Komputery', 'Laptopy i akcesoria', 'laptop', 1),
  ('foto', 'Foto', 'Aparaty i obiektywy', 'camera', 2),
  ('smart', 'Smart home', 'Automatyka domowa', 'bulb', 3)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Produkty
-- ---------------------------------------------------------------------------
insert into public.products
  (slug, name, short, category_id, price_cents, old_price_cents, stock, rating, reviews_count, icon, badge, specs) values
  ('sluchawki-bezprzewodowe-aura-x', 'Słuchawki bezprzewodowe Aura X', 'Aktywna redukcja szumów, 40 h pracy na baterii, Bluetooth 5.3.', 'audio', 64900, 79900, 12, 4.6, 218, 'headphones', '-19%', '{"Typ":"Nauszne, zamknięte","Redukcja szumów":"Aktywna (ANC)","Czas pracy":"40 h","Łączność":"Bluetooth 5.3, USB-C","Waga":"265 g"}'::jsonb),
  ('laptop-nova-14-pro', 'Laptop Nova 14 Pro', 'Ekran 14" 2.8K OLED, 16 GB RAM, dysk SSD 1 TB.', 'komputery', 489900, null, 5, 4.8, 96, 'laptop', 'Nowość', '{"Procesor":"8 rdzeni, 4.7 GHz","Pamięć":"16 GB LPDDR5","Dysk":"1 TB NVMe","Ekran":"14\" 2880×1800 OLED 120 Hz","Waga":"1.29 kg"}'::jsonb),
  ('aparat-bezlusterkowy-lumen-r7', 'Aparat bezlusterkowy Lumen R7', 'Matryca 33 Mpx, stabilizacja 5-osiowa, wideo 4K/60.', 'foto', 629900, 699900, 3, 4.7, 54, 'camera', '-10%', '{"Matryca":"33 Mpx full-frame","Stabilizacja":"5-osiowa, do 8 EV","Wideo":"4K 60 kl/s","Mocowanie":"Lumen R","Waga":"612 g"}'::jsonb),
  ('glosnik-przenosny-boom-mini', 'Głośnik przenośny Boom Mini', 'Wodoodporność IP67, 18 h grania, parowanie stereo.', 'audio', 22900, null, 40, 4.3, 412, 'speaker', null, '{"Moc":"20 W RMS","Odporność":"IP67","Czas pracy":"18 h","Łączność":"Bluetooth 5.2","Waga":"540 g"}'::jsonb),
  ('monitor-vision-27-4k', 'Monitor Vision 27 4K', 'Panel IPS 27" 4K, 99% sRGB, USB-C z zasilaniem 90 W.', 'komputery', 179900, 199900, 8, 4.5, 133, 'monitor', '-10%', '{"Przekątna":"27\"","Rozdzielczość":"3840×2160","Odświeżanie":"60 Hz","Porty":"USB-C 90 W, 2× HDMI, DP","Pokrycie barw":"99% sRGB"}'::jsonb),
  ('zarowka-smart-glow-e27', 'Żarówka smart Glow E27', '16 mln kolorów, sterowanie aplikacją i głosem.', 'smart', 7900, null, 120, 4.1, 587, 'bulb', null, '{"Gwint":"E27","Moc":"9 W (60 W ekw.)","Kolory":"RGB + biel 2700–6500 K","Łączność":"Wi-Fi 2.4 GHz","Sterowanie":"Aplikacja, asystent głosowy"}'::jsonb),
  ('obiektyw-lumen-35-mm-f-1-8', 'Obiektyw Lumen 35 mm f/1.8', 'Jasny stałoogniskowy, cichy autofocus, uszczelniona konstrukcja.', 'foto', 214900, null, 0, 4.9, 71, 'lens', null, '{"Ogniskowa":"35 mm","Jasność":"f/1.8","Mocowanie":"Lumen R","Filtr":"62 mm","Waga":"340 g"}'::jsonb),
  ('zamek-smart-lock-pro', 'Zamek smart Lock Pro', 'Odcisk palca, kod PIN i klucz zapasowy. Montaż bez wiercenia.', 'smart', 89900, 109900, 15, 4.4, 88, 'lock', '-18%', '{"Otwieranie":"Odcisk palca, PIN, aplikacja, klucz","Zasilanie":"4× AA, ~9 miesięcy","Łączność":"Bluetooth + mostek Wi-Fi","Montaż":"Nakładka na wkładkę","Materiał":"Stop cynku"}'::jsonb)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Kupony
-- ---------------------------------------------------------------------------
insert into public.coupons (code, percent_off, is_active) values
  ('NOWY10', 10, true),
  ('LATO20', 20, true)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
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

