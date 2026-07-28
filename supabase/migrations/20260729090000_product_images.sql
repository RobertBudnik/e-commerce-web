-- =============================================================================
-- Nordo — zdjęcia produktów
--
-- Plik trafia do Storage, w tabeli zostaje sama ścieżka. URL-a nie zapisujemy:
-- adres projektu zmienia się przy przejściu na domenę, a ścieżka nie.
-- Front składa adres publiczny sam (`getPublicUrl`).
--
-- Kubełek jest publiczny do odczytu — zdjęcia w sklepie mają być widoczne dla
-- niezalogowanych. Zapis wpuszcza wyłącznie konto z uprawnieniem products.write,
-- tą samą regułą co edycję katalogu.
-- =============================================================================

alter table public.products
  add column if not exists image_path text;

comment on column public.products.image_path is
  'Ścieżka pliku w kubełku product-images; NULL = kafelek pokazuje ikonę zastępczą.';

-- ---------------------------------------------------------------------------
-- Kubełek
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,                                        -- 5 MB wystarczy na zdjęcie produktu
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Polityki na obiektach. Kubełek publiczny załatwia odczyt przez CDN, ale
-- polityka i tak musi istnieć — inaczej klient z tokenem dostanie odmowę
-- przy listowaniu.
-- ---------------------------------------------------------------------------
drop policy if exists "zdjęcia: odczyt publiczny" on storage.objects;
create policy "zdjęcia: odczyt publiczny" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "zdjęcia: wgrywanie" on storage.objects;
create policy "zdjęcia: wgrywanie" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.authorize('products.write'));

drop policy if exists "zdjęcia: podmiana" on storage.objects;
create policy "zdjęcia: podmiana" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.authorize('products.write'))
  with check (bucket_id = 'product-images' and public.authorize('products.write'));

drop policy if exists "zdjęcia: usuwanie" on storage.objects;
create policy "zdjęcia: usuwanie" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.authorize('products.write'));
