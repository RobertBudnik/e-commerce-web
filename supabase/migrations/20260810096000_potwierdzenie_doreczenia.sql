-- =============================================================================
-- Nordo — potwierdzenie doręczenia
--
-- Stan „dostarczone" otwiera klientowi dwie rzeczy: zwrot i opinię. Dopóki
-- nikt go nie postawi, oba są zamknięte — więc musi istnieć droga, którą
-- wchodzi.
--
-- Docelowo stawia go odczyt od przewoźnika. Zanim integracja ruszy (i zawsze,
-- gdy przewoźnik milczy, a klient potwierdza odbiór przez telefon), robi to
-- obsługa. Dlatego nie jest to zwykły UPDATE ze zwykłym przyciskiem: funkcja
-- zapisuje ŹRÓDŁO potwierdzenia, więc po fakcie widać, czy „dostarczone"
-- przyszło z sieci przewoźnika, czy postawił je człowiek.
--
-- Bez tego rozróżnienia stan „dostarczone" znaczy tylko tyle, że ktoś kliknął.
-- =============================================================================

create or replace function public.potwierdz_doreczenie(
  p_zamowienie uuid,
  p_zrodlo text default 'obsługa'
)
returns public.order_status
language plpgsql
security definer
set search_path = public
as $$
declare
  stan public.order_status;
  numer text;
begin
  if not public.authorize('orders.write') then
    raise exception 'Brak uprawnień do zmiany zamówienia';
  end if;

  if p_zrodlo not in ('obsługa', 'przewoznik') then
    raise exception 'Źródłem potwierdzenia jest „obsługa" albo „przewoznik"';
  end if;

  select status, order_number into stan, numer
  from public.orders where id = p_zamowienie for update;

  if stan is null then
    raise exception 'Nie ma zamówienia o id %', p_zamowienie;
  end if;

  if stan = 'anulowane' then
    raise exception 'Zamówienie jest anulowane — nie ma czego doręczać';
  end if;

  if stan = 'dostarczone' then
    return stan;
  end if;

  update public.orders set status = 'dostarczone' where id = p_zamowienie;

  perform public.zapisz_w_dzienniku(
    'zamowienie',
    numer,
    format('doręczono (%s), stan przed: %s', p_zrodlo, stan),
    jsonb_build_object('zrodlo', p_zrodlo, 'przed', stan)
  );

  return 'dostarczone';
end;
$$;

comment on function public.potwierdz_doreczenie(uuid, text) is
  'Stawia „dostarczone" i zapisuje, czy potwierdził to przewoźnik, czy obsługa.';

revoke execute on function public.potwierdz_doreczenie(uuid, text)
  from public, anon, service_role;
grant execute on function public.potwierdz_doreczenie(uuid, text) to authenticated;
