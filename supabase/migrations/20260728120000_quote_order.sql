-- =============================================================================
-- Nordo — wycena koszyka po stronie serwera
--
-- Front do tej pory liczył rabat i dostawę u siebie, z kodami rabatowymi wprost
-- w js/app.js. quote_order() liczy to samo, czym potem policzy create_order():
-- ceny bierze z products, próg darmowej dostawy ze store_settings, a kupon
-- sprawdza w coupons. Nic nie zapisuje — to podgląd przed złożeniem zamówienia.
--
-- security definer, bo tabela coupons jest zamknięta dla klienta: bez tego
-- przeglądarka mogłaby wyciągnąć całą listę kodów. Tutaj oddajemy wyłącznie
-- wynik dla kodu, który klient sam wpisał.
-- =============================================================================

create or replace function public.quote_order(
  p_items jsonb,
  p_coupon text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  item jsonb;
  prod public.products;
  qty integer;
  settings public.store_settings;
  v_subtotal integer := 0;
  v_discount integer := 0;
  v_shipping integer := 0;
  v_percent integer;
  v_coupon text;
  v_coupon_valid boolean := false;
  v_lines jsonb := '[]'::jsonb;
  v_missing integer;
begin
  select * into settings from public.store_settings where id;

  v_coupon := upper(nullif(trim(p_coupon), ''));

  for item in
    select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    qty := coalesce((item ->> 'qty')::integer, 0);
    if qty <= 0 then
      continue;
    end if;

    select * into prod
    from public.products
    where id = (item ->> 'product_id')::uuid and is_active;

    -- Produkt zniknął z katalogu albo został wyłączony — pomijamy go w wycenie,
    -- a create_order i tak odrzuci takie zamówienie.
    if prod.id is null then
      continue;
    end if;

    v_subtotal := v_subtotal + prod.price_cents * qty;

    v_lines := v_lines || jsonb_build_object(
      'product_id', prod.id,
      'name', prod.name,
      'unit_price_cents', prod.price_cents,
      'qty', qty,
      'line_total_cents', prod.price_cents * qty,
      'stock', prod.stock,
      'in_stock', prod.stock >= qty
    );
  end loop;

  if v_coupon is not null then
    select c.percent_off into v_percent
    from public.coupons c
    where c.code = v_coupon
      and c.is_active
      and (c.valid_from is null or c.valid_from <= now())
      and (c.valid_to is null or c.valid_to >= now())
      and (c.max_uses is null or c.used_count < c.max_uses);

    if v_percent is not null then
      v_coupon_valid := true;
      -- Ten sam wzór co w create_order — dzielenie całkowite, grosze w dół
      v_discount := (v_subtotal * v_percent) / 100;
    end if;
  end if;

  if v_subtotal = 0 then
    v_shipping := 0;
  elsif (v_subtotal - v_discount) >= settings.free_shipping_threshold_cents then
    v_shipping := 0;
  else
    v_shipping := settings.shipping_flat_cents;
  end if;

  v_missing := greatest(settings.free_shipping_threshold_cents - (v_subtotal - v_discount), 0);

  return jsonb_build_object(
    'subtotal_cents', v_subtotal,
    'discount_cents', v_discount,
    'shipping_cents', v_shipping,
    'total_cents', v_subtotal - v_discount + v_shipping,
    'coupon', v_coupon,
    'coupon_valid', v_coupon_valid,
    'percent_off', coalesce(v_percent, 0),
    'free_shipping_threshold_cents', settings.free_shipping_threshold_cents,
    'free_shipping_missing_cents', case when v_shipping = 0 then 0 else v_missing end,
    'currency', settings.currency,
    'lines', v_lines
  );
end;
$$;

comment on function public.quote_order(jsonb, text) is
  'Podgląd sumy koszyka liczony w bazie: ceny z products, próg dostawy ze store_settings, kupon z coupons. Bez zapisu.';

grant execute on function public.quote_order(jsonb, text) to anon, authenticated;
