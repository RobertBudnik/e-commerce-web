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

  // Bez nazwy produkt wchodzi do katalogu jako pusty kafel: klient widzi
  // kategorię, cenę i dziurę tam, gdzie ma być tytuł. `products.name` jest
  // NOT NULL, ale pusty ciąg przez to sito przechodził — stąd sprawdzenie
  // tutaj i warunek w bazie, który zatrzyma też zapis inną drogą.
  if (!name) {
    return { ok: false, error: 'Produkt musi mieć nazwę — bez niej kafel w sklepie zostaje pusty.' };
  }
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

  // Rodzaj przyjeżdża jako tekst wpisany ręcznie — wiersz w słowniku zakłada
  // się sam, jeśli takiego jeszcze nie było.
  const categoryId = await rodzajNaId(supabase, String(formData.get('category') ?? ''));

  const row = {
    // Slug jest NOT NULL i unikalny; formularz go nie zna, więc przy edycji
    // niesie go ukryte pole, a przy nowym produkcie składamy go z nazwy.
    slug: String(formData.get('slug') ?? '').trim() || slugify(name),
    name,
    short: String(formData.get('short') ?? '').trim(),
    category_id: categoryId,
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

  // Zmiana rodzaju mogła opróżnić poprzedni — kafel bez produktów prowadzi
  // klienta w pustkę, więc znika razem z ostatnią pozycją.
  await posprzatajPusteRodzaje(supabase);

  revalidateCatalog();
  return { ok: true };
}

export async function deleteProductAction(id: string, imagePath: string | null): Promise<CatalogResult> {
  const supabase = await createClient();

  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  // Wiersz zniknął, więc plik nie ma już do czego należeć
  if (imagePath) await supabase.storage.from(BUCKET).remove([imagePath]);

  await posprzatajPusteRodzaje(supabase);

  revalidateCatalog();
  return { ok: true };
}

/* ==========================================================================
   Rodzaje produktów — słownik prowadzony w tle

   Admin wpisuje rodzaj przy produkcie, jak zwykły tekst, i nie zarządza żadną
   listą osobno. Wiersz w `categories` powstaje sam, bo strona główna pokazuje
   kafle z ikoną i opisem, a filtr w sklepie chodzi po identyfikatorze — samo
   pole tekstowe przy produkcie nie udźwignęłoby żadnego z tych dwóch.
   ========================================================================== */

/** Ikona zgadywana z nazwy rodzaju. Trafienie jest miłe, pudło nieszkodliwe. */
const IKONY_RODZAJU: [RegExp, string][] = [
  [/audio|słuchaw|sluchaw|głośn|glosn|dźwięk|dzwiek/i, 'headphones'],
  [/laptop|komputer|notebook|pc\b/i, 'laptop'],
  [/foto|aparat|kamer/i, 'camera'],
  [/obiektyw|lens/i, 'lens'],
  [/monitor|ekran|wyświetl|wyswietl/i, 'monitor'],
  [/lamp|żarów|zarow|światł|swiatl/i, 'bulb'],
  [/zamek|klucz|bezpiecz|smart\s*home/i, 'lock'],
  [/głośnik|glosnik|speaker/i, 'speaker'],
];

function ikonaDlaRodzaju(nazwa: string): string {
  return IKONY_RODZAJU.find(([wzor]) => wzor.test(nazwa))?.[1] ?? 'grid';
}

/**
 * Zwraca identyfikator rodzaju, zakładając wiersz, jeśli takiego jeszcze nie ma.
 *
 * Identyfikator powstaje z nazwy i jest kluczem głównym — ten sam rodzaj wpisany
 * drugi raz trafia w istniejący wiersz zamiast tworzyć duplikat. Nazwy nie
 * nadpisujemy przy trafieniu: „AUDIO" wpisane w pośpiechu nie ma prawa zmienić
 * „Audio", które stoi już na kaflu na stronie głównej.
 */
async function rodzajNaId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nazwa: string
): Promise<string | null> {
  const czysta = nazwa.trim();
  if (!czysta) return null;

  const id = slugify(czysta);
  if (!id) return null;

  const { data: istnieje } = await supabase.from('categories').select('id').eq('id', id).maybeSingle();
  if (istnieje) return id;

  // Nowy rodzaj ląduje na końcu listy — kolejność poprawia się rzadko i ręcznie,
  // a wskakiwanie nowej pozycji przed istniejące byłoby zaskoczeniem.
  const { data: ostatnia } = await supabase
    .from('categories')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('categories').insert({
    id,
    name: czysta,
    icon: ikonaDlaRodzaju(czysta),
    position: (ostatnia?.position ?? -1) + 1,
  });

  // Wyścig dwóch zapisów z tym samym rodzajem kończy się kolizją klucza —
  // to znaczy, że ktoś zdążył pierwszy, czyli dokładnie to, o co nam chodziło.
  if (error && error.code !== '23505') return null;
  return id;
}

/**
 * Kasuje rodzaje, w których nie został ani jeden produkt.
 *
 * Bez tego lista rodzajów rośnie po każdej literówce i po każdym skasowanym
 * produkcie, a klient dostaje na stronie głównej kafel prowadzący do pustki.
 * Sprzątanie jest ciche: skoro admin nigdy tej listy nie zakładał, nie ma go
 * po co pytać o zgodę na skasowanie pozycji, której nie widzi.
 */
async function posprzatajPusteRodzaje(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [{ data: rodzaje }, { data: uzywane }] = await Promise.all([
    supabase.from('categories').select('id'),
    supabase.from('products').select('category_id').not('category_id', 'is', null),
  ]);
  if (!rodzaje) return;

  const zajete = new Set((uzywane ?? []).map((p) => p.category_id));
  const puste = rodzaje.map((r) => r.id).filter((id) => !zajete.has(id));
  if (puste.length) await supabase.from('categories').delete().in('id', puste);
}

/* ==========================================================================
   Galeria produktu

   Okładka (`products.image_path`) zostaje w formularzu produktu wyżej — jedzie
   razem z nim do każdej listy. Tutaj są zdjęcia dodatkowe, oglądane wyłącznie
   na karcie produktu. Osobne akcje, bo dodaje się je pojedynczo i po zapisaniu
   produktu, a nie razem z nim.
   ========================================================================== */

export type ZdjeciePanelu = { id: number; path: string; url: string; alt: string | null };

/** Zdjęcia dodatkowe produktu do panelu. Kolejność ta sama co na karcie. */
export async function galeriaProduktuAction(productId: string): Promise<ZdjeciePanelu[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('product_images')
    .select('id, path, alt')
    .eq('product_id', productId)
    .order('position')
    .order('created_at');

  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
  return (data ?? []).map((row) => ({
    id: Number(row.id),
    path: String(row.path),
    url: `${base}${row.path}`,
    alt: (row.alt as string | null) ?? null,
  }));
}

/**
 * Dodanie ujęcia do galerii.
 *
 * Kolejność liczona z liczby istniejących zdjęć, nie wpisywana ręcznie:
 * przy czterech ujęciach nikt nie chce myśleć o numerach, a kolejność
 * dodawania jest tą, której się spodziewa.
 */
export async function dodajZdjecieGaleriiAction(
  productId: string,
  formData: FormData
): Promise<CatalogResult> {
  const file = formData.get('zdjecie');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Wskaż plik ze zdjęciem.' };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: 'Zdjęcie waży ponad 5 MB — kubełek go nie przyjmie.' };
  }

  const supabase = await createClient();

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '31536000', contentType: file.type, upsert: false });

  if (uploadError) return { ok: false, error: `Nie wgrano zdjęcia: ${uploadError.message}` };

  const { count } = await supabase
    .from('product_images')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId);

  const { error } = await supabase.from('product_images').insert({
    product_id: productId,
    path,
    position: count ?? 0,
    alt: String(formData.get('alt') ?? '').trim() || null,
  });

  // Zapis do tabeli padł, więc plik w kubełku nie ma już do czego należeć.
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, error: error.message };
  }

  revalidateCatalog();
  return { ok: true };
}

/** Usunięcie ujęcia. Wiersz najpierw, plik potem — odwrotnie zostawiałby martwą ścieżkę. */
export async function usunZdjecieGaleriiAction(id: number, path: string): Promise<CatalogResult> {
  const supabase = await createClient();

  const { error } = await supabase.from('product_images').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  const { error: removeError } = await supabase.storage.from(BUCKET).remove([path]);
  if (removeError) console.warn('Nie skasowano pliku zdjęcia:', removeError.message);

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
