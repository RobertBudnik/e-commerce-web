'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { slugify } from '@/lib/format';
import { textToSpecs } from '@/lib/specs';

const BUCKET = 'product-images';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type CatalogResult = { ok: true } | { ok: false; error: string };

/**
 * Zapis produktu z panelu zaplecza.
 *
 * O uprawnieniach decyduje RLS: polityki `produkty: dodawanie` i `produkty:
 * edycja` wpuszczają wyłącznie konto z `products.write`, a kubełek ze zdjęciami
 * ma tę samą regułę. Ten kod niczego nie sprawdza „na wszelki wypadek" —
 * odmowa przychodzi z bazy.
 */
export async function saveProductAction(formData: FormData): Promise<CatalogResult> {
  const supabase = await createClient();

  const id = String(formData.get('id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const currentImagePath = String(formData.get('currentImagePath') ?? '').trim() || null;
  const dropImage = formData.get('dropImage') === '1';
  const file = formData.get('image');

  let imagePath = dropImage ? null : currentImagePath;

  // Najpierw plik: gdyby wgranie padło, produkt nie zapisze się z martwą ścieżką
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMAGE_BYTES) {
      return { ok: false, error: 'Zdjęcie waży ponad 5 MB — kubełek go nie przyjmie.' };
    }

    // Nazwa losowa: nazwy od klienta bywają zajęte, mają spacje i polskie znaki
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: '31536000', contentType: file.type, upsert: false });

    if (uploadError) return { ok: false, error: `Nie wgrano zdjęcia: ${uploadError.message}` };
    imagePath = path;
  }

  const row = {
    // Slug jest NOT NULL i unikalny; formularz go nie zna, więc przy edycji
    // niesie go ukryte pole, a przy nowym produkcie składamy go z nazwy.
    slug: String(formData.get('slug') ?? '').trim() || slugify(name),
    name,
    short: String(formData.get('short') ?? '').trim(),
    category_id: String(formData.get('category') ?? '') || null,
    price_cents: Math.round(Number(formData.get('price') ?? 0) * 100),
    old_price_cents: formData.get('oldPrice')
      ? Math.round(Number(formData.get('oldPrice')) * 100)
      : null,
    stock: Number(formData.get('stock') ?? 0),
    // Pusty kod to NULL, nie pusty tekst — indeks unikalny pomija NULL-e,
    // więc kilka produktów bez kodu ze sobą nie koliduje.
    barcode: String(formData.get('barcode') ?? '').trim() || null,
    rating: Number(formData.get('rating') ?? 0),
    reviews_count: Number(formData.get('reviews') ?? 0),
    icon: String(formData.get('icon') ?? 'grid'),
    badge: String(formData.get('badge') ?? '').trim() || null,
    specs: textToSpecs(String(formData.get('specs') ?? '')),
    image_path: imagePath,
  };

  const save = (data: typeof row) =>
    id
      ? supabase.from('products').update(data).eq('id', id).select('id').single()
      : supabase.from('products').insert(data).select('id').single();

  let { error } = await save(row);

  // Dwa produkty o tej samej nazwie dają ten sam slug — druga próba
  // z krótką końcówką zamiast błędu w twarz
  if (error?.code === '23505') {
    ({ error } = await save({ ...row, slug: `${row.slug}-${Math.random().toString(36).slice(2, 6)}` }));
  }

  if (error) return { ok: false, error: error.message };

  // Stary plik kasujemy dopiero po udanym zapisie; osierocony plik w kubełku
  // jest mniej szkodliwy niż produkt bez zdjęcia
  if (currentImagePath && currentImagePath !== imagePath) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove([currentImagePath]);
    if (removeError) console.warn('Nie skasowano starego zdjęcia:', removeError.message);
  }

  revalidateCatalog();
  return { ok: true };
}

export async function deleteProductAction(id: string, imagePath: string | null): Promise<CatalogResult> {
  const supabase = await createClient();

  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  // Wiersz zniknął, więc plik nie ma już do czego należeć
  if (imagePath) await supabase.storage.from(BUCKET).remove([imagePath]);

  revalidateCatalog();
  return { ok: true };
}

/** Katalog wisi na kilku stronach naraz — odświeżamy je wszystkie. */
function revalidateCatalog() {
  revalidatePath('/');
  revalidatePath('/sklep');
  revalidatePath('/panel');
  revalidatePath('/produkt', 'layout');
}
