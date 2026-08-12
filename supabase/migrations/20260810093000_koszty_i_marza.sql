-- =============================================================================
-- Nordo — koszt zakupu i marża
--
-- Panel ma pokazywać, ile właściciel zarabia, a nie tylko ile wpłynęło.
-- Do tego potrzebny jest koszt zakupu, którego w bazie nie ma.
--
-- Kusi, żeby dopisać kolumnę do `products`. Nie tędy: polityka
-- „produkty: odczyt publiczny" oddaje wiersz każdemu, także `anon`, a PostgREST
-- zwraca wszystkie kolumny. Koszt zakupu wyciekłby do przeglądarki pierwszego
-- lepszego klienta razem z marżą sklepu.
--
-- Ta sama pułapka czeka piętro niżej i jest mniej widoczna: `order_items` ma
-- politykę „klient czyta pozycje własnych zamówień". Kolumna z kosztem w tej
-- tabeli oddałaby kupującemu marżę na tym, co właśnie kupił. Dlatego koszty
-- mieszkają w dwóch osobnych tabelach, obu zamkniętych na `finanse.read`.
--
-- Marża liczy się z kosztu z chwili sprzedaży, nie z dzisiejszego: dostawca
-- podniósł cenę w marcu, a raport za styczeń ma zostać taki, jaki był.
-- =============================================================================

create table if not exists public.koszty_produktow (
  product_id uuid primary key references public.products on delete cascade,
  koszt_cents integer not null check (koszt_cents >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.koszty_produktow is
  'Cena zakupu produktu. Osobna tabela, bo products jest czytelne publicznie.';

alter table public.koszty_produktow enable row level security;

create policy "koszty: odczyt zaplecza" on public.koszty_produktow
  for select to authenticated
  using ((select public.authorize('finanse.read')));

create policy "koszty: zapis" on public.koszty_produktow
  for all to authenticated
  using ((select public.authorize('products.write')))
  with check ((select public.authorize('products.write')));

grant select, insert, update, delete on public.koszty_produktow to authenticated;

-- ---------------------------------------------------------------------------
-- Koszt utrwalony przy pozycji zamówienia
--
-- Osobna tabela, nie kolumna w `order_items` — patrz nagłówek. Wiersz powstaje
-- z wyzwalacza, a nie z `create_order()`: pozycje zamówienia powstają dziś
-- jedną drogą, ale import i korekta z ręki to druga i trzecia. Wyzwalacz łapie
-- wszystkie, zmiana w funkcji tylko jedną.
--
-- Brak wiersza znaczy „nie znaliśmy wtedy kosztu" i tak ma zostać. Zamówienia
-- sprzed tej migracji kosztu nie mają, a żadna wartość zastępcza tego nie
-- naprawi — raport ma o tym mówić wprost zamiast udawać pewność.
-- ---------------------------------------------------------------------------
create table if not exists public.koszty_pozycji (
  order_item_id bigint primary key references public.order_items on delete cascade,
  koszt_jednostkowy_cents integer not null check (koszt_jednostkowy_cents >= 0)
);

comment on table public.koszty_pozycji is
  'Koszt zakupu z chwili sprzedaży. Poza order_items, bo tamto czyta kupujący.';

alter table public.koszty_pozycji enable row level security;

create policy "koszty pozycji: odczyt zaplecza" on public.koszty_pozycji
  for select to authenticated
  using ((select public.authorize('finanse.read')));

grant select on public.koszty_pozycji to authenticated;

create or replace function public.utrwal_koszt_pozycji()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  koszt integer;
begin
  if new.product_id is null then
    return new;
  end if;

  select koszt_cents into koszt
  from public.koszty_produktow where product_id = new.product_id;

  if koszt is not null then
    insert into public.koszty_pozycji (order_item_id, koszt_jednostkowy_cents)
    values (new.id, koszt)
    on conflict (order_item_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists order_items_koszt on public.order_items;
create trigger order_items_koszt
  after insert on public.order_items
  for each row execute function public.utrwal_koszt_pozycji();

revoke execute on function public.utrwal_koszt_pozycji()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Widok marży
--
-- Definicja przychodu jedna dla całego sklepu, ta sama co w `sprzedaz_dziennie`:
-- opłacone i nieanulowane. Druga definicja w drugim miejscu znaczy dwie różne
-- liczby na jednym ekranie i telefon od księgowej.
--
-- `pozycji_bez_kosztu` jedzie obok kwot, żeby ekran mógł napisać „policzone
-- z 18 z 25 pozycji" zamiast pokazywać marżę zawyżoną o wszystko, czego nie zna.
--
-- `security_invoker` sprawia, że widok dziedziczy polityki tabel źródłowych —
-- a `koszty_pozycji` wpuszcza wyłącznie `finanse.read`. Klient, który trafi
-- pod /rest/v1/marza_dziennie, zobaczy zero wierszy.
-- ---------------------------------------------------------------------------
create or replace view public.marza_dziennie as
select
  date_trunc('day', o.created_at)::date                    as dzien,
  sum(oi.line_total_cents)                                 as przychod_cents,
  sum(coalesce(kp.koszt_jednostkowy_cents, 0) * oi.qty)    as koszt_cents,
  sum(oi.line_total_cents)
    - sum(coalesce(kp.koszt_jednostkowy_cents, 0) * oi.qty) as marza_cents,
  count(*) filter (where kp.koszt_jednostkowy_cents is null) as pozycji_bez_kosztu,
  count(*)                                                 as pozycji
from public.order_items oi
join public.orders o on o.id = oi.order_id
left join public.koszty_pozycji kp on kp.order_item_id = oi.id
where o.payment_status = 'opłacone'
  and o.status <> 'anulowane'
group by 1;

alter view public.marza_dziennie set (security_invoker = true);

-- Bez tego GRANT-u widok jest niewidoczny przez API — i to nie wygląda jak
-- brak dostępu, tylko jak brak sprzedaży: PostgREST oddaje pustą listę, a panel
-- rysuje marżę zero przy prawdziwym przychodzie. RLS przepuszcza dopiero po
-- grancie, nie zamiast niego.
grant select on public.marza_dziennie to authenticated;

comment on view public.marza_dziennie is
  'Marża dzienna z kosztów utrwalonych przy pozycjach. Tylko opłacone i nieanulowane.';
