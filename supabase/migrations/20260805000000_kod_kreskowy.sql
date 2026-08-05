-- =============================================================================
-- Nordo — kod kreskowy produktu
--
-- Skaner w magazynie porównuje to, co pod czytnikiem, z tym, co w zamówieniu.
-- Bez tej kolumny nie ma czego porównywać.
--
-- EAN-13 i EAN-8 to cyfry, ale trzymamy je jako tekst: wiodące zera mają
-- znaczenie, a na kodzie nikt nigdy nie liczy. Unikalność częściowa, bo
-- większość katalogu długo nie będzie miała kodu, a NULL-e nie kolidują.
-- =============================================================================

alter table public.products
  add column if not exists barcode text;

comment on column public.products.barcode is
  'Kod kreskowy z opakowania (EAN-13, EAN-8 lub własny). Używany przez skaner w magazynie.';

create unique index if not exists products_barcode_key
  on public.products (barcode)
  where barcode is not null;

-- Wyszukiwanie po kodzie musi być natychmiastowe — skaner pyta przy każdym
-- odczycie, a magazynier stoi z telefonem nad kartonem.
create index if not exists products_barcode_lookup
  on public.products (barcode)
  where barcode is not null and is_active;
