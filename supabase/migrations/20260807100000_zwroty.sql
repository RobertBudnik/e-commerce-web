-- =============================================================================
-- Zwroty od klienta
--
-- Domykają obieg towaru: sklep pozwala klientowi zgłosić zwrot, magazyn go
-- przyjmuje, a sztuki wracają na stan tą samą drogą co każda inna zmiana —
-- przez wpis w `inventory_movements`. Bez tego „Zwroty do przyjęcia" na
-- przeglądzie byłyby liczbą bez pokrycia.
--
-- Dwie tabele zamiast jednej, bo zwrot dotyczy wybranych pozycji, nie
-- całego zamówienia: klient odsyła jedną parę słuchawek z trzech, a magazyn
-- musi wiedzieć, ile sztuk czego się spodziewać.
--
-- Stan zwrotu celowo ma tylko trzy wartości. Więcej znaczy tyle, że nikt ich
-- potem nie odróżnia.
-- =============================================================================

create type public.return_status as enum ('zgłoszony', 'przyjęty', 'odrzucony');

create table if not exists public.zwroty (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.return_status not null default 'zgłoszony',
  powod text,
  created_at timestamptz not null default now(),
  -- Kto i kiedy przyjął. Puste, dopóki paczka nie wróciła do magazynu.
  przyjety_at timestamptz,
  przyjety_by uuid references auth.users (id)
);

create table if not exists public.zwroty_pozycje (
  id bigint generated always as identity primary key,
  zwrot_id uuid not null references public.zwroty (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  -- Nazwa kopiowana jak w `order_items`: produkt może zniknąć z katalogu,
  -- a zwrot ma zostać czytelny.
  name text not null,
  qty integer not null check (qty > 0)
);

create index if not exists zwroty_status_idx on public.zwroty (status, created_at);
create index if not exists zwroty_pozycje_zwrot_idx on public.zwroty_pozycje (zwrot_id);

comment on table public.zwroty is 'Zgłoszenia zwrotu od klientów. Przyjęcie dopisuje ruch magazynowy.';

-- =============================================================================
-- RLS
-- =============================================================================

alter table public.zwroty enable row level security;
alter table public.zwroty_pozycje enable row level security;

-- Klient widzi zwroty swoich zamówień, zaplecze wszystkie. Ten sam podział
-- co przy zamówieniach, więc nie wprowadzamy nowego uprawnienia.
create policy "zwroty: odczyt właściciela i zaplecza" on public.zwroty
  for select to authenticated
  using (
    public.authorize('orders.read_all')
    or exists (
      select 1 from public.orders o
      where o.id = zwroty.order_id and o.user_id = auth.uid()
    )
  );

create policy "zwroty: zgłoszenie przez właściciela zamówienia" on public.zwroty
  for insert to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = zwroty.order_id and o.user_id = auth.uid()
    )
  );

create policy "zwroty: zmiana wyłącznie przez zaplecze" on public.zwroty
  for update to authenticated
  using (public.authorize('orders.write'))
  with check (public.authorize('orders.write'));

create policy "pozycje zwrotu: odczyt jak zwrot" on public.zwroty_pozycje
  for select to authenticated
  using (
    exists (
      select 1 from public.zwroty z
      where z.id = zwroty_pozycje.zwrot_id
        and (
          public.authorize('orders.read_all')
          or exists (
            select 1 from public.orders o
            where o.id = z.order_id and o.user_id = auth.uid()
          )
        )
    )
  );

create policy "pozycje zwrotu: dopisanie przy własnym zgłoszeniu" on public.zwroty_pozycje
  for insert to authenticated
  with check (
    exists (
      select 1 from public.zwroty z
      join public.orders o on o.id = z.order_id
      where z.id = zwroty_pozycje.zwrot_id and o.user_id = auth.uid()
    )
  );

-- =============================================================================
-- Zgłoszenie zwrotu ze sklepu
--
-- Jedna funkcja zamiast dwóch wstawień z przeglądarki: nagłówek i pozycje
-- muszą powstać razem albo wcale, inaczej magazyn dostaje zwrot bez zawartości.
-- =============================================================================

create or replace function public.zglos_zwrot(
  p_zamowienie uuid,
  p_pozycje jsonb,
  p_powod text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  zwrot_id uuid;
  pozycja jsonb;
  zamowione integer;
begin
  if not exists (
    select 1 from public.orders
    where id = p_zamowienie and user_id = auth.uid()
  ) then
    raise exception 'To nie jest Twoje zamówienie';
  end if;

  if jsonb_array_length(coalesce(p_pozycje, '[]'::jsonb)) = 0 then
    raise exception 'Wskaż, co odsyłasz';
  end if;

  insert into public.zwroty (order_id, powod)
  values (p_zamowienie, nullif(btrim(p_powod), ''))
  returning id into zwrot_id;

  for pozycja in select * from jsonb_array_elements(p_pozycje) loop
    -- Nie da się zwrócić więcej, niż było w zamówieniu. Sprawdzenie w bazie,
    -- bo przeglądarka jest po stronie klienta i nie jest źródłem prawdy.
    select qty into zamowione
    from public.order_items
    where order_id = p_zamowienie
      and product_id = (pozycja ->> 'product_id')::uuid;

    if zamowione is null then
      raise exception 'Pozycji nie było w tym zamówieniu';
    end if;

    if (pozycja ->> 'qty')::integer > zamowione then
      raise exception 'W zamówieniu było % szt., nie można zwrócić więcej', zamowione;
    end if;

    insert into public.zwroty_pozycje (zwrot_id, product_id, name, qty)
    select zwrot_id, oi.product_id, oi.name, (pozycja ->> 'qty')::integer
    from public.order_items oi
    where oi.order_id = p_zamowienie
      and oi.product_id = (pozycja ->> 'product_id')::uuid;
  end loop;

  return zwrot_id;
end;
$$;

-- =============================================================================
-- Przyjęcie zwrotu w magazynie
--
-- Towar wraca na stan wyłącznie przez `inventory_movements`, tym samym
-- kanałem co korekta ręczna. Dzięki temu historia magazynu tłumaczy każdą
-- sztukę, niezależnie od tego, którędy przyszła.
--
-- Idempotentne przez stan: drugie dotknięcie „Przyjmij" nie dołoży sztuk,
-- bo zwrot nie jest już zgłoszony.
-- =============================================================================

create or replace function public.przyjmij_zwrot(p_zwrot uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  obecny public.return_status;
  sztuk integer := 0;
  pozycja record;
begin
  if not public.authorize('inventory.write') then
    raise exception 'Brak uprawnień do przyjęcia zwrotu';
  end if;

  select status into obecny from public.zwroty where id = p_zwrot for update;

  if obecny is null then
    raise exception 'Nie ma zwrotu o id %', p_zwrot;
  end if;

  if obecny <> 'zgłoszony' then
    -- Powtórka nie jest błędem: przycisk mógł zostać dotknięty dwa razy.
    return 0;
  end if;

  for pozycja in
    select product_id, qty from public.zwroty_pozycje where zwrot_id = p_zwrot
  loop
    if pozycja.product_id is not null then
      update public.products
      set stock = stock + pozycja.qty
      where id = pozycja.product_id;

      insert into public.inventory_movements (product_id, delta, reason, created_by)
      values (pozycja.product_id, pozycja.qty, 'Zwrot od klienta', auth.uid());

      sztuk := sztuk + pozycja.qty;
    end if;
  end loop;

  update public.zwroty
  set status = 'przyjęty', przyjety_at = now(), przyjety_by = auth.uid()
  where id = p_zwrot;

  return sztuk;
end;
$$;

-- Granty: `revoke ... from public` nie wystarcza, bo domyślne uprawnienia
-- Supabase nadają EXECUTE jawnie rolom anon i service_role przy każdej nowej
-- funkcji w schemacie public.
revoke execute on function public.zglos_zwrot(uuid, jsonb, text) from public, anon, service_role;
revoke execute on function public.przyjmij_zwrot(uuid) from public, anon, service_role;
grant execute on function public.zglos_zwrot(uuid, jsonb, text) to authenticated;
grant execute on function public.przyjmij_zwrot(uuid) to authenticated;

grant select, insert on public.zwroty to authenticated;
grant update on public.zwroty to authenticated;
grant select, insert on public.zwroty_pozycje to authenticated;
grant usage on sequence public.zwroty_pozycje_id_seq to authenticated;
