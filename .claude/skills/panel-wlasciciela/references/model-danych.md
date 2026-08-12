# Model danych zaplecza

Szkice SQL dla brakujących kawałków panelu. Nie są gotowcem do wklejenia —
są wzorcem, w którym zapisane jest, **dlaczego** tak, żeby przy pisaniu
prawdziwej migracji nie zgubić tego, co w tej bazie już raz kosztowało błąd.

## Spis

1. [Zasady każdej migracji](#1-zasady-każdej-migracji)
2. [Nowe uprawnienia — dwie migracje, nie jedna](#2-nowe-uprawnienia--dwie-migracje-nie-jedna)
3. [Koszt zakupu i marża](#3-koszt-zakupu-i-marża)
4. [Historia cen](#4-historia-cen)
5. [Przesyłki](#5-przesyłki)
6. [Dziennik zaplecza](#6-dziennik-zaplecza)
7. [Nadawanie ról](#7-nadawanie-ról)
8. [Lista kontrolna przed zamknięciem migracji](#8-lista-kontrolna-przed-zamknięciem-migracji)

---

## 1. Zasady każdej migracji

Wzorzec jest w plikach, które już są — trzymaj się go, a migracja wtopi się
w resztę:

- nazwa `supabase/migrations/RRRRMMDDGGMMSS_temat_po_polsku.sql`,
- nagłówek komentarzem: co, dlaczego i — jeśli poprawiasz zachowanie — jaka
  sonda to wykazała,
- funkcje zapisujące: `language plpgsql`, `security definer`,
  `set search_path = public`, sprawdzenie `authorize()` w pierwszych liniach,
- po każdej funkcji:
  `revoke execute on function … from public, anon, service_role;`
  i `grant execute on function … to authenticated;`,
- każda nowa tabela: `enable row level security` plus komplet polityk. Tabela
  z RLS bez polityki jest niewidoczna dla wszystkich i wygląda na awarię,
- `comment on table` / `comment on function` jednym zdaniem po polsku.

**`security definer` znaczy „ta funkcja omija RLS".** Cały ciężar kontroli
przenosi się na sprawdzenie w jej środku. Funkcja zapisująca bez `authorize()`
w pierwszych liniach to publiczna furtka do zapisu — klucz `anon` jest w kodzie
strony i każdy może ją zawołać.

## 2. Nowe uprawnienia — dwie migracje, nie jedna

Panel potrzebuje uprawnień, których w enumie nie ma: `finanse.read` (przychód,
marża, eksport) i `audyt.read` (dziennik). Rozdzielone od `orders.read_all`
celowo — księgowa ma widzieć kwoty bez adresów klientów, a `staff` ma
pakować bez wglądu w marżę.

Pułapka Postgresa: nową wartość enuma **wolno** dodać w transakcji, ale
**nie wolno jej w tej samej transakcji użyć**. Supabase puszcza każdą migrację
w transakcji, więc `alter type` i `insert into role_permissions` w jednym pliku
kończą się `unsafe use of new value of enum type`. Stąd dwa pliki:

```sql
-- migracja 1: …_uprawnienia_panelu.sql
alter type public.app_permission add value if not exists 'finanse.read';
alter type public.app_permission add value if not exists 'audyt.read';
```

```sql
-- migracja 2: …_uprawnienia_panelu_przypisania.sql
insert into public.role_permissions (role, permission) values
  ('owner', 'finanse.read'),
  ('owner', 'audyt.read'),
  ('manager', 'finanse.read')
on conflict (role, permission) do nothing;
```

Przypisania idą do **migracji**, nie do `seed.sql`. Seed nie jedzie na
produkcję — macierz uprawnień wylądowała w migracji dokładnie dlatego, że pusta
tabela znaczyła `authorize() = false` dla każdej roli.

## 3. Koszt zakupu i marża

Kusi, żeby dopisać `koszt_cents` do `products`. Nie tędy: polityka
`produkty: odczyt publiczny` oddaje wiersz każdemu, także `anon`, a PostgREST
zwraca wszystkie kolumny. Koszt zakupu wyciekłby do przeglądarki pierwszego
lepszego klienta, razem z marżą.

Koszt mieszka w osobnej tabeli z własną polityką:

```sql
create table public.koszty_produktow (
  product_id uuid primary key references public.products on delete cascade,
  koszt_cents integer not null check (koszt_cents >= 0),
  waluta text not null default 'PLN',
  updated_at timestamptz not null default now()
);

comment on table public.koszty_produktow is
  'Cena zakupu. Osobna tabela, bo products jest czytelne publicznie.';

alter table public.koszty_produktow enable row level security;

create policy "koszty: odczyt zaplecza" on public.koszty_produktow
  for select to authenticated using (public.authorize('finanse.read'));

create policy "koszty: zapis" on public.koszty_produktow
  for all to authenticated
  using (public.authorize('products.write'))
  with check (public.authorize('products.write'));

grant select, insert, update, delete on public.koszty_produktow to authenticated;
```

Marża liczy się z kosztu **z chwili sprzedaży**, nie z dzisiejszego. Dostawca
podniósł cenę w marcu — raport za styczeń ma zostać taki, jaki był. Kusi więc
kolumna `koszt_jednostkowy_cents` w `order_items` — i tu czeka ta sama pułapka
piętro niżej, tylko mniej widoczna: `order_items` ma politykę „klient czyta
pozycje własnych zamówień". Kolumna z kosztem oddałaby kupującemu marżę na tym,
co właśnie kupił.

Koszt pozycji idzie więc do trzeciej tabeli, zamkniętej na `finanse.read`:

```sql
create table public.koszty_pozycji (
  order_item_id bigint primary key references public.order_items on delete cascade,
  koszt_jednostkowy_cents integer not null check (koszt_jednostkowy_cents >= 0)
);
```

Wypełnia ją wyzwalacz `after insert` na `order_items`, nie `create_order()`:
pozycje powstają dziś jedną drogą, ale import i korekta z ręki to druga
i trzecia. Brak wiersza znaczy „nie znaliśmy wtedy kosztu" — zamówienia sprzed
tej zmiany kosztu nie mają i żadna wartość zastępcza tego nie naprawi. Raport
marży pokazuje wtedy zakres „policzone z N z M pozycji" zamiast udawać pewność.

Reguła ogólniejsza, warta zapamiętania przy każdej nowej kolumnie: **zanim
dopiszesz pole, sprawdź polityki tabeli, do której je dokładasz.** Kolumna
dziedziczy dostęp po wierszu, a nie po swoim znaczeniu.

Widok marży trzyma się definicji przychodu z `sprzedaz_dziennie` — opłacone
i nieanulowane — i tak samo dostaje `security_invoker = true`. Bez tego widok
wykonuje się z prawami właściciela i omija RLS tabel źródłowych.

## 4. Historia cen

```sql
create table public.historia_cen (
  id bigint generated by default as identity primary key,
  product_id uuid not null references public.products on delete cascade,
  cena_cents integer not null check (cena_cents >= 0),
  stara_cena_cents integer,
  zmienil uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create index historia_cen_produkt on public.historia_cen (product_id, created_at desc);
```

Wpis dokłada wyzwalacz na `products`, nie interfejs. Cenę zmienia się z panelu,
z SQL-a i importem — wyzwalacz łapie wszystkie trzy drogi, kod panelu jedną.

Odczyt: publiczny. Najniższa cena z trzydziestu dni przed obniżką musi być
widoczna przy produkcie w sklepie (Omnibus), więc chowanie tej tabeli przed
`anon` zablokowałoby to, po co powstała. Zapis: wyłącznie z wyzwalacza.

## 5. Przesyłki

`orders.numer_przesylki` wystarcza, dopóki paczki nadaje się ręcznie u jednego
przewoźnika. Integracja dokłada rzeczy, które w tekstowej kolumnie nie mieszczą
się bez sklejania: przewoźnika, punkt odbioru, identyfikator u przewoźnika,
status i moment jego odczytu.

```sql
create type public.przewoznik as enum ('inpost', 'inny');

create table public.przesylki (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  przewoznik public.przewoznik not null default 'inpost',
  -- Identyfikator u przewoźnika: po nim pobiera się etykietę i status.
  zewnetrzny_id text,
  numer text,
  -- Kod paczkomatu, np. KRA012. Wybrany przez klienta w kasie.
  punkt_odbioru text,
  status text,
  status_odczyt timestamptz,
  utworzona timestamptz not null default now()
);

-- Jedno zamówienie, jedna przesyłka. Przy podziale na paczki zdejmij ten
-- indeks świadomie i przejrzyj wszystkie miejsca, które zakładają jedną.
create unique index przesylki_zamowienie on public.przesylki (order_id);
```

Polityki: odczyt i zapis dla `orders.write`; klient swojej przesyłki **nie**
czyta stąd — dostaje status w widoku zamówienia, przez to, co i tak widzi.

Punkt odbioru wybrany w kasie zapisuje `create_order()` razem z adresem, do
`shipping_address`, i dopiero nadanie przenosi go tutaj. Inaczej trzeba by
wpuścić klienta do tabeli przesyłek.

Wywołanie do przewoźnika idzie z funkcji Edge, nie z Postgresa. Baza nie ma
wychodzić do internetu — nieodpowiadające API zablokowałoby transakcję,
a token przewoźnika nie ma czego szukać w `postgres`.

## 6. Dziennik zaplecza

```sql
create table public.dziennik_zaplecza (
  id bigint generated by default as identity primary key,
  kto uuid references auth.users on delete set null,
  obszar text not null,            -- 'zamowienie' | 'produkt' | 'rola' | 'przesylka'
  obiekt text,                     -- numer zamówienia, slug produktu, e-mail
  opis text not null,              -- „stan: nowe → spakowane"
  szczegoly jsonb,
  created_at timestamptz not null default now()
);

create index dziennik_czas on public.dziennik_zaplecza (created_at desc);
create index dziennik_obiekt on public.dziennik_zaplecza (obszar, obiekt, created_at desc);

alter table public.dziennik_zaplecza enable row level security;

-- Odczyt dla uprawnionych. Zapisu nie ma i to jest cała wartość tej tabeli:
-- wiersze dokłada wyłącznie funkcja `security definer`, więc nie da się
-- podpisać cudzym nazwiskiem ani wyczyścić po sobie.
create policy "dziennik: odczyt" on public.dziennik_zaplecza
  for select to authenticated using (public.authorize('audyt.read'));

grant select on public.dziennik_zaplecza to authenticated;
```

Brak polityk `insert`, `update` i `delete` jest zamierzony. Wpisy dokłada
pomocnicza funkcja, wołana z wnętrza funkcji, które i tak już zmieniają dane:

```sql
create or replace function public.zapisz_w_dzienniku(
  p_obszar text, p_obiekt text, p_opis text, p_szczegoly jsonb default null
) returns void
language sql security definer set search_path = public as $$
  insert into public.dziennik_zaplecza (kto, obszar, obiekt, opis, szczegoly)
  values (auth.uid(), p_obszar, p_obiekt, p_opis, p_szczegoly);
$$;

revoke execute on function public.zapisz_w_dzienniku(text, text, text, jsonb)
  from public, anon, authenticated, service_role;
```

Zwróć uwagę: `authenticated` też traci prawo wykonania. Ta funkcja nie jest
do wołania z zewnątrz — jest do wołania z `ustaw_stan_zamowienia()`,
`nadaj_przesylke()`, `nadaj_role()` i z wyzwalacza cen. Gdyby dało się ją
zawołać z klienta, każdy dopisałby sobie do dziennika, co chce, i dowód
przestałby być dowodem.

Rozszerzając istniejące funkcje o zapis do dziennika, nie zmieniaj ich
sygnatur — `revoke`/`grant` wiszą na sygnaturze, a nowy argument tworzy nową
funkcję i zostawia starą z pełnymi prawami.

## 7. Nadawanie ról

```sql
create or replace function public.nadaj_role(p_user uuid, p_rola public.app_role)
returns public.app_role
language plpgsql security definer set search_path = public as $$
declare
  moja public.app_role;
  ilu_wlascicieli integer;
begin
  if not public.authorize('roles.manage') then
    raise exception 'Brak uprawnień do zmiany ról';
  end if;

  select role into moja from public.user_roles where user_id = auth.uid()
  order by role limit 1;

  -- Nie nadajemy roli wyższej niż własna: inaczej manager z prawem do ról
  -- robi sobie właściciela jednym żądaniem.
  if p_rola = 'owner' and moja <> 'owner' then
    raise exception 'Rolę właściciela nadaje wyłącznie właściciel';
  end if;

  -- Ostatni właściciel zostaje właścicielem. Sklep bez `owner` nie jest
  -- do odzyskania z interfejsu — zostaje SQL na produkcji.
  if p_rola <> 'owner' then
    select count(*) into ilu_wlascicieli
    from public.user_roles where role = 'owner';

    if ilu_wlascicieli = 1
       and exists (select 1 from public.user_roles
                   where user_id = p_user and role = 'owner') then
      raise exception 'To jedyny właściciel — najpierw nadaj tę rolę komuś innemu';
    end if;
  end if;

  delete from public.user_roles where user_id = p_user;
  insert into public.user_roles (user_id, role) values (p_user, p_rola);

  perform public.zapisz_w_dzienniku(
    'rola', p_user::text, format('rola → %s', p_rola), null
  );

  return p_rola;
end;
$$;

revoke execute on function public.nadaj_role(uuid, public.app_role)
  from public, anon, service_role;
grant execute on function public.nadaj_role(uuid, public.app_role) to authenticated;
```

Rola siedzi w tokenie, więc po zmianie **stary token dalej niesie starą rolę**,
aż do odświeżenia sesji. Panel ma to mówić: „zmiana zadziała po ponownym
zalogowaniu tej osoby". Cicha zmiana, która przez godzinę nie działa, wygląda
jak awaria.

## 8. Lista kontrolna przed zamknięciem migracji

- [ ] RLS włączone na każdej nowej tabeli, komplet polityk dopisany
- [ ] `authorize()` w pierwszych liniach każdej funkcji zapisującej
- [ ] `revoke` + `grant` po każdej funkcji; funkcje wewnętrzne bez `authenticated`
- [ ] `grant` na tabelach — RLS przepuszcza, ale bez `grant` i tak nie ma dostępu
- [ ] enum i jego użycie w dwóch osobnych migracjach
- [ ] `security_invoker = true` na każdym nowym widoku
- [ ] `npm run db:test` przechodzi; nowe granice mają swój przypadek
- [ ] sonda na żywej bazie dla przypadków, których test schematu nie łapie
      (wołanie RPC z tokenem klienta na cudzym obiekcie)
- [ ] granty sprawdzone osobnym zapytaniem — `supabase db diff` ich nie widzi
