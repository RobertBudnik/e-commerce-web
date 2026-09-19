-- =============================================================================
-- Alert magazynowy — powiadomienie, gdy stan spada poniżej progu
--
-- Ten sam wzorzec, co powitanie po potwierdzeniu konta: wyzwalacz w bazie woła
-- funkcję brzegową przez pg_net, a ta wysyła maila przez Resend. Baza jest
-- właściwym miejscem, bo stan schodzi nie tylko z zamówienia — schodzi też
-- z korekty w magazynie, ze skanera i z przyjęcia zwrotu. Wyzwalacz łapie
-- wszystkie te drogi naraz, kod aplikacji musiałby pamiętać o każdej z osobna.
--
-- KLUCZOWE: alert leci przy PRZEKROCZENIU progu w dół, nie przy każdej zmianie
-- poniżej progu. Inaczej sklep z trzema sztukami na stanie słałby maila po
-- każdej sprzedaży — a alert, który przychodzi zawsze, przestaje cokolwiek
-- znaczyć po tygodniu.
-- =============================================================================

-- Próg domyślny, gdy produkt nie ma własnego w `prog_niski`.
-- Pięć sztuk, zgodnie z ustaleniem — przy nakładzie liczonym w sztukach to
-- mniej więcej tydzień zapasu.
create or replace function public.prog_alertu(p_produkt public.products)
returns integer
language sql
immutable
set search_path = public
as $$
  select coalesce(p_produkt.prog_niski, 5);
$$;

comment on function public.prog_alertu(public.products) is
  'Próg niskiego stanu dla produktu: własny z prog_niski albo domyślne 5.';

-- ---------------------------------------------------------------------------
-- Wyzwalacz
-- ---------------------------------------------------------------------------
create or replace function public.alert_niskiego_stanu()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prog integer;
  adres_funkcji text;
  sekret text;
  powod text;
begin
  -- Interesuje nas wyłącznie ruch w dół. Przyjęcie towaru na stan nie jest
  -- powodem do alarmu, nawet jeśli stan dalej jest niski.
  if new.stock >= old.stock then
    return new;
  end if;

  prog := public.prog_alertu(new);

  -- Dwa osobne powody, bo to dwa różne stany dla właściciela:
  -- „kończy się" da się jeszcze dorobić, „nie ma" to już utracona sprzedaż.
  if new.stock = 0 and old.stock > 0 then
    powod := 'zero';
  elsif new.stock < prog and old.stock >= prog then
    powod := 'nisko';
  else
    -- Stan już wcześniej był poniżej progu — alert poszedł wtedy.
    return new;
  end if;

  select wartosc into adres_funkcji from public.konfiguracja_poczty where klucz = 'adres_alertu';
  select wartosc into sekret from public.konfiguracja_poczty where klucz = 'sekret_alertu';

  -- Brak konfiguracji nie ma prawa wywrócić sprzedaży. Zamówienie musi
  -- przejść nawet wtedy, gdy powiadomienia są niedostrojone.
  if adres_funkcji is null or sekret is null then
    return new;
  end if;

  -- Bez pg_net nie ma czym zawołać funkcji. Sprawdzamy schemę, a nie samą
  -- funkcję: `to_regproc` przy przeciążonej nazwie zwraca null i wyglądałoby
  -- to jak brak rozszerzenia, choć jest.
  if to_regnamespace('net') is null then
    return new;
  end if;

  -- EXECUTE, nie wywołanie wprost: ciało plpgsql jest sprawdzane przy
  -- tworzeniu, więc odwołanie do `net.http_post` wysypałoby migrację wszędzie
  -- tam, gdzie pg_net nie ma. Wywołanie jest asynchroniczne — wpis ląduje
  -- w kolejce pg_net, a transakcja sprzedaży kończy się natychmiast.
  execute 'select net.http_post($1, $2, $3, $4, $5)'
  using
    adres_funkcji,
    jsonb_build_object(
      'product_id', new.id,
      'nazwa', new.name,
      'sku', coalesce(new.sku, ''),
      'stan', new.stock,
      'poprzedni_stan', old.stock,
      'prog', prog,
      'powod', powod
    ),
    '{}'::jsonb,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sekret-alertu', sekret
    ),
    5000;

  return new;
end;
$$;

comment on function public.alert_niskiego_stanu() is
  'Woła funkcję brzegową alert-magazyn przy zejściu stanu poniżej progu albo do zera.';

drop trigger if exists on_products_low_stock on public.products;

-- `OF stock` zawęża wyzwalacz do zmian tej jednej kolumny: zmiana ceny albo
-- opisu nie ma powodu uruchamiać tej logiki.
create trigger on_products_low_stock
  after update of stock on public.products
  for each row
  when (new.stock is distinct from old.stock)
  execute function public.alert_niskiego_stanu();
