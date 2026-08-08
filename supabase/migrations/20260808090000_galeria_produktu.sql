-- =============================================================================
-- Nordo — galeria zdjęć produktu
--
-- `products.image_path` trzyma jedno zdjęcie i to zostaje bez zmian: to okładka,
-- używana wszędzie tam, gdzie produkt pokazuje się w liście — siatka katalogu,
-- koszyk, szybki podgląd, lista życzeń, ostatnio oglądane. Rozbicie tego na
-- dołączenie do osobnej tabeli oznaczałoby przepisanie ośmiu zapytań po to,
-- żeby w każdym z nich i tak wziąć pierwszy wiersz.
--
-- Nowa tabela dokłada zdjęcia *dodatkowe*, oglądane wyłącznie na karcie
-- produktu. Sklep z elektroniką bez drugiego ujęcia wygląda jak wizytówka,
-- a jedna kolumna nie ma jak pomieścić czterech zdjęć w kolejności.
--
-- Pliki leżą w tym samym kubełku `product-images` co okładki, z tymi samymi
-- politykami Storage — tutaj trzymamy wyłącznie ścieżki, tak jak przy okładce.
-- =============================================================================

create table if not exists public.product_images (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products (id) on delete cascade,
  -- Sama ścieżka w kubełku, nie adres. Adres publiczny składa front, więc
  -- przejście na własną domenę nie wymaga migracji danych.
  path text not null,
  -- Kolejność ustawia obsługa; przy równych wartościach decyduje czas dodania,
  -- żeby lista nigdy nie skakała między odświeżeniami.
  position integer not null default 0,
  -- Tekst alternatywny. Puste znaczy „opisz zdjęcie nazwą produktu" — lepsze
  -- niż wymuszony duplikat nazwy przy każdym ujęciu.
  alt text,
  created_at timestamptz not null default now()
);

-- To samo zdjęcie dwa razy przy jednym produkcie to zawsze pomyłka obsługi.
create unique index if not exists product_images_unikalne
  on public.product_images (product_id, path);

-- Karta produktu pyta o zdjęcia jednego produktu w kolejności — indeks
-- pokrywa oba warunki naraz.
create index if not exists product_images_produkt_idx
  on public.product_images (product_id, position, created_at);

comment on table public.product_images is
  'Dodatkowe zdjęcia na karcie produktu. Okładka siedzi w products.image_path.';

alter table public.product_images enable row level security;

-- Odczyt publiczny jak katalog: zdjęcia widzi każdy, kto widzi produkt.
-- Warunek sięga do `products`, żeby zdjęcia wycofanej pozycji nie wisiały
-- publicznie po jej ukryciu.
create policy "zdjęcia produktu: odczyt publiczny" on public.product_images
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and (p.is_active or (select public.authorize('products.read_all')))
    )
  );

create policy "zdjęcia produktu: dodawanie" on public.product_images
  for insert to authenticated
  with check ((select public.authorize('products.write')));

create policy "zdjęcia produktu: zmiana" on public.product_images
  for update to authenticated
  using ((select public.authorize('products.write')))
  with check ((select public.authorize('products.write')));

create policy "zdjęcia produktu: kasowanie" on public.product_images
  for delete to authenticated
  using ((select public.authorize('products.write')));

grant select on public.product_images to anon, authenticated;
grant insert, update, delete on public.product_images to authenticated;
