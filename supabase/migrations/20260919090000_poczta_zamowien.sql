-- =============================================================================
-- Poczta wokół zamówienia: potwierdzenie i przypomnienie o koszyku
--
-- Problem, który to rozwiązuje: Stripe gwarantuje dostarczenie zdarzenia
-- **co najmniej raz**, nie dokładnie raz. `mark_order_paid` jest na to
-- odporne, bo aktualizuje warunkowo, ale zwraca wiersz w obu przypadkach —
-- i pierwszego przejścia, i powtórki. Webhook nie ma więc po czym poznać,
-- czy mail już poszedł, a dwa identyczne potwierdzenia w skrzynce klienta
-- wyglądają jak usterka sklepu.
--
-- Stąd znacznik czasu na zamówieniu i funkcja, która **zajmuje** go
-- atomowo: `update ... where ... is null returning` wraca z wierszem
-- wyłącznie dla tego wywołania, które ustawiło znacznik jako pierwsze.
-- Dwa równoległe webhooki dostaną jedno `true` i jedno `false`.
-- =============================================================================

alter table public.orders
  add column if not exists mail_potwierdzenia_at timestamptz,
  add column if not exists mail_przypomnienia_at timestamptz;

comment on column public.orders.mail_potwierdzenia_at is
  'Kiedy poszło potwierdzenie zawarcia umowy. NULL = jeszcze nie poszło.';
comment on column public.orders.mail_przypomnienia_at is
  'Kiedy poszło przypomnienie o nieopłaconym koszyku. NULL = jeszcze nie poszło.';

-- ---------------------------------------------------------------------------
-- Zajęcie prawa do wysyłki
-- ---------------------------------------------------------------------------
-- Zwraca `true` dokładnie raz na zamówienie i rodzaj. Wywołanie, które
-- dostanie `true`, ma obowiązek wysłać; każde następne dostaje `false`
-- i ma nic nie robić.
--
-- SECURITY DEFINER, bo woła to funkcja brzegowa kluczem service_role —
-- ale prawa i tak zawężamy przez REVOKE niżej, żeby nikt z zewnątrz nie
-- mógł „zużyć" cudzego maila i tym samym go zablokować.
create or replace function public.zajmij_mail_zamowienia(
  p_order_id uuid,
  p_rodzaj text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  zajete uuid;
begin
  if p_rodzaj = 'potwierdzenie' then
    update public.orders
    set mail_potwierdzenia_at = now()
    where id = p_order_id and mail_potwierdzenia_at is null
    returning id into zajete;
  elsif p_rodzaj = 'przypomnienie' then
    update public.orders
    set mail_przypomnienia_at = now()
    where id = p_order_id and mail_przypomnienia_at is null
    returning id into zajete;
  else
    raise exception 'Nieznany rodzaj wiadomości: %', p_rodzaj;
  end if;

  return zajete is not null;
end;
$$;

comment on function public.zajmij_mail_zamowienia(uuid, text) is
  'Atomowo zajmuje prawo do jednorazowej wysyłki. true = wysyłaj, false = ktoś już wysłał.';

-- Tylko service_role. Klient sklepu nie ma powodu tego wołać, a mógłby tym
-- zablokować wysyłkę potwierdzenia cudzemu zamówieniu.
revoke all on function public.zajmij_mail_zamowienia(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Limit na tworzenie sesji płatności — zapora przed testowaniem kart
-- ---------------------------------------------------------------------------
-- Tabela `limity_poczty` obsługuje dokładnie ten wzorzec (okno przesuwne po
-- kluczu i rodzaju), więc nie zakładamy drugiej. Nazwa mówi „poczty", bo taki
-- był pierwszy powód jej istnienia — komentarz niżej prostuje zakres.
alter table public.limity_poczty drop constraint if exists limity_poczty_rodzaj_check;

alter table public.limity_poczty
  add constraint limity_poczty_rodzaj_check
  check (rodzaj in ('rejestracja', 'reset', 'magic', 'ponowna', 'kasa'));

comment on table public.limity_poczty is
  'Okno przesuwne prób: wysyłki poczty oraz tworzenia sesji płatności (rodzaj = kasa). '
  'Klucz to adres IP albo skrót SHA-256 adresu e-mail.';
