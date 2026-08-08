-- =============================================================================
-- Nordo — opinie klientów
--
-- `products.rating` i `products.reviews_count` istniały od początku, ale były
-- liczbami z ziarna: gwiazdki na każdej karcie, za którymi nie stała ani jedna
-- opinia. Nie dało się ich przeczytać ani dodać.
--
-- Trzy decyzje, z których wynika reszta pliku:
--
-- 1. Opinię wystawia wyłącznie ten, kto kupił i odebrał. Bez tego warunku
--    pierwszą rzeczą w tabeli jest spam, a sprawdzenie zakupu i tak musi
--    siedzieć w bazie — przeglądarka nie jest źródłem prawdy o tym, kto co
--    kupił.
--
-- 2. Jedna opinia na osobę i produkt. Kolejny zakup tego samego przedmiotu nie
--    daje drugiego głosu; poprawienie własnej opinii owszem.
--
-- 3. Średnia i licznik na `products` liczą się wyzwalaczem, nie zapytaniem
--    przy każdym renderze. Siatka katalogu pokazuje gwiazdki przy ośmiu
--    pozycjach naraz — osiem podzapytań agregujących przy każdym wejściu to
--    koszt bez powodu, skoro opinia zmienia się rzadko, a czytana jest stale.
-- =============================================================================

create type public.review_status as enum ('opublikowana', 'ukryta');

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  -- Sama ocena bez słowa też jest opinią; treść jest dobrowolna.
  tresc text check (tresc is null or length(btrim(tresc)) between 3 and 2000),
  -- Podpis pod opinią, zapisany w chwili wystawienia i skrócony do imienia
  -- z inicjałem. Dwa powody, oba wykluczają dołączenie do `profiles`:
  -- polityka „profil: odczyt własnego" nie wypuści nazwiska gościowi, który
  -- czyta opinie, a pełne nazwisko pod publiczną opinią to i tak więcej,
  -- niż potrzeba, żeby wiedzieć, że pisze człowiek, a nie sklep.
  autor text,
  -- Moderacja: obsługa chowa, nie kasuje. Skasowana opinia wraca po tygodniu
  -- razem z tym samym klientem, a ukryta zostaje w ewidencji.
  status public.review_status not null default 'opublikowana',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create index if not exists reviews_produkt_idx
  on public.reviews (product_id, created_at desc)
  where status = 'opublikowana';

create index if not exists reviews_user_idx on public.reviews (user_id);

comment on table public.reviews is
  'Opinie klientów. Wystawia je wyłącznie kupujący; średnia trafia na products wyzwalaczem.';

create trigger reviews_touch before update on public.reviews
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Średnia i licznik na produkcie
--
-- Liczone z opinii opublikowanych: ukrycie opinii ma zmienić ocenę produktu,
-- inaczej moderacja niczego nie naprawia.
-- ---------------------------------------------------------------------------
create or replace function public.przelicz_ocene_produktu(p_produkt uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_srednia numeric;
  v_ile integer;
begin
  select round(avg(rating)::numeric, 1), count(*)
  into v_srednia, v_ile
  from public.reviews
  where product_id = p_produkt and status = 'opublikowana';

  update public.products
  set rating = coalesce(v_srednia, 0),
      reviews_count = coalesce(v_ile, 0)
  where id = p_produkt;
end;
$$;

create or replace function public.opinie_przelicz()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Przy zmianie produktu w opinii (nie zdarza się, ale schemat na to pozwala)
  -- przeliczamy oba, żeby stary nie został z zawyżoną liczbą.
  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id then
    perform public.przelicz_ocene_produktu(old.product_id);
  end if;

  perform public.przelicz_ocene_produktu(
    case when tg_op = 'DELETE' then old.product_id else new.product_id end
  );

  return null;
end;
$$;

create trigger reviews_przelicz
  after insert or update or delete on public.reviews
  for each row execute function public.opinie_przelicz();

revoke execute on function public.przelicz_ocene_produktu(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.opinie_przelicz() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.reviews enable row level security;

-- Opublikowane widzi każdy — to treść sklepu. Swoją własną widzi autor także
-- po ukryciu, żeby wiedział, co napisał; zaplecze widzi wszystkie.
create policy "opinie: odczyt" on public.reviews
  for select
  using (
    status = 'opublikowana'
    or user_id = (select auth.uid())
    or (select public.authorize('orders.read_all'))
  );

-- Dodanie idzie wyłącznie przez `dodaj_opinie()`, bo tam siedzi sprawdzenie
-- zakupu. Brak polityki INSERT to ta sama decyzja co przy `orders`.

create policy "opinie: zmiana własnej" on public.reviews
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and status = 'opublikowana');

create policy "opinie: moderacja" on public.reviews
  for update
  using ((select public.authorize('orders.write')))
  with check ((select public.authorize('orders.write')));

create policy "opinie: kasowanie własnej" on public.reviews
  for delete
  using (user_id = (select auth.uid()) or (select public.authorize('orders.write')));

grant select on public.reviews to anon, authenticated;
grant update, delete on public.reviews to authenticated;

-- ---------------------------------------------------------------------------
-- Wystawienie opinii
--
-- Warunek zakupu: pozycja z tego produktu w zamówieniu tego konta, ze stanem
-- „dostarczone". Ten sam próg co przy zwrotach — klient ma towar w ręku.
-- ---------------------------------------------------------------------------
create or replace function public.dodaj_opinie(
  p_produkt uuid,
  p_ocena smallint,
  p_tresc text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_tresc text;
  v_autor text;
  v_pelne text;
begin
  if auth.uid() is null then
    raise exception 'Opinię wystawia zalogowane konto';
  end if;

  if p_ocena is null or p_ocena < 1 or p_ocena > 5 then
    raise exception 'Ocena musi być od 1 do 5';
  end if;

  if not exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.product_id = p_produkt
      and o.user_id = auth.uid()
      and o.status = 'dostarczone'
  ) then
    raise exception 'Opinię o produkcie wystawia się po jego odebraniu';
  end if;

  v_tresc := nullif(btrim(coalesce(p_tresc, '')), '');

  -- „Robert Budnik" → „Robert B.". Przy jednym słowie zostaje samo imię,
  -- przy pustym profilu — „Klient", bo podpis „null" pod opinią wygląda
  -- jak usterka, a nie jak anonimowość.
  select nullif(btrim(coalesce(full_name, '')), '') into v_pelne
  from public.profiles where id = auth.uid();

  v_autor := case
    when v_pelne is null then 'Klient'
    when position(' ' in v_pelne) = 0 then v_pelne
    else split_part(v_pelne, ' ', 1) || ' ' || upper(left(split_part(v_pelne, ' ', 2), 1)) || '.'
  end;

  -- Druga opinia tej samej osoby o tym samym produkcie nadpisuje pierwszą,
  -- zamiast odbijać się błędem: z punktu widzenia klienta to jest poprawka
  -- własnego zdania, a nie próba oszustwa.
  insert into public.reviews (product_id, user_id, rating, tresc, autor)
  values (p_produkt, auth.uid(), p_ocena, v_tresc, v_autor)
  on conflict (product_id, user_id) do update
    set rating = excluded.rating,
        tresc = excluded.tresc,
        autor = excluded.autor,
        status = 'opublikowana'
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.dodaj_opinie(uuid, smallint, text) from public, anon, service_role;
grant execute on function public.dodaj_opinie(uuid, smallint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Ziarno zostaje nietknięte celowo
--
-- `products.rating` i `reviews_count` z seeda opisują katalog demonstracyjny
-- i wyzwalacz ich nie rusza, dopóki ktoś nie wystawi opinii o danym produkcie.
-- Wtedy liczba przestaje być zmyślona i zaczyna wynikać z danych — dla tego
-- jednego produktu. Kasowanie ziarna tutaj zostawiłoby świeżą instalację
-- z ośmioma pozycjami bez ani jednej gwiazdki.
-- ---------------------------------------------------------------------------
