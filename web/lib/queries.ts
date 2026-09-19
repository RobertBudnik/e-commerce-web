import 'server-only';

import { cache } from 'react';

import { createClient } from '@/utils/supabase/server';
import { createPublicClient } from '@/utils/supabase/public';
import { toOrder, toProduct, toSessionUser } from './mappers';
import type { OrderRow, ProductRow, RuchRow } from './rows';
import type {
  Category,
  DzienSprzedazy,
  Order,
  OsobaZaplecza,
  PodsumowanieFinansow,
  PozycjaZPokryciem,
  Product,
  PrzesylkaPanelu,
  RuchMagazynowy,
  SessionUser,
  SprzedazProduktu,
  StoreSettings,
  WpisDziennika,
} from './types';

const BUCKET = 'product-images';

/** Ścieżka z bazy → publiczny adres pliku. Adres projektu bierzemy ze zmiennej. */
export function imageUrl(path: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** Payload tokenu bez weryfikacji podpisu — token zweryfikował już `getUser()`. */
function decodeClaims(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1];
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    return JSON.parse(json);
  } catch {
    return {};
  }
}

/**
 * Zalogowany użytkownik albo null. `getUser()` weryfikuje token u dostawcy,
 * a rola przyjeżdża claimem — front nie pyta o nią bazy przy każdym renderze.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const claims = session ? decodeClaims(session.access_token) : {};

  // Rola normalnie przyjeżdża claimem, bez pytania bazy przy każdym renderze.
  // Gdy hook nie jest włączony w projekcie, claimu nie ma i całe zaplecze
  // wyglądałoby jak konto klienta — łącznie z właścicielem. Wtedy, i tylko
  // wtedy, dopytujemy tabelę ról. Ten sam wariant awaryjny ma po swojej
  // stronie `current_role_name()` w bazie.
  if (!claims.user_role) {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const kolejnosc = ['owner', 'manager', 'staff', 'customer'];
    const najwyzsza = (data ?? [])
      .map((r) => String(r.role))
      .sort((a, b) => kolejnosc.indexOf(a) - kolejnosc.indexOf(b))[0];

    if (najwyzsza) claims.user_role = najwyzsza;
  }

  return toSessionUser(user, claims);
});

/**
 * Same slugi, bez sesji — `generateStaticParams` biegnie poza żądaniem,
 * więc nie ma tam ciasteczek i klient z `next/headers` by się wywrócił.
 */
export async function getProductSlugs(): Promise<string[]> {
  const { data } = await createPublicClient()
    .from('products')
    .select('slug')
    .eq('is_active', true);

  return (data ?? []).map((row) => row.slug as string);
}

/**
 * Błąd zapytania do katalogu.
 *
 * Do tej pory każde z tych miejsc zwracało pustą tablicę. Wyglądało to
 * rozsądnie — strona się renderuje, nic nie wybucha — a było najgorszym
 * z możliwych zachowań sklepu: **awaria bazy, polityki RLS albo sieci
 * wyglądała dla klienta identycznie jak pusty katalog**. „0 produktów,
 * brak pozycji spełniających kryteria" to zdanie, które klient czyta jako
 * „nic tu nie ma" i wychodzi. Właściciel nie dowiadywał się o niczym, bo
 * nic nie rzucało, więc Sentry nie miał czego złapać.
 *
 * Teraz zapytanie, które padło, rzuca. Błąd leci w górę do `error.tsx`,
 * klient widzi „coś poszło nie tak" zamiast fałszywej pustki, a Sentry
 * dostaje wpis. Pusty wynik dalej znaczy pusto — bo to prawda.
 */
class BladZapytania extends Error {
  constructor(co: string, przyczyna: { message?: string; code?: string } | null) {
    super(`Zapytanie „${co}" nie powiodło się: ${przyczyna?.message ?? 'brak szczegółów'}`);
    this.name = 'BladZapytania';
    // Kod PostgREST/Postgresa bardzo pomaga przy grupowaniu w Sentry —
    // inny kod to zwykle zupełnie inna przyczyna.
    if (przyczyna?.code) this.cause = przyczyna.code;
  }
}

export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, description, icon, position')
    .order('position');

  if (error) throw new BladZapytania('lista kategorii', error);
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    desc: c.description ?? '',
    icon: c.icon ?? 'grid',
    position: c.position ?? 0,
  }));
});

/**
 * Katalog. Aktywne pozycje widzi każdy — polityka `produkty: odczyt publiczny`
 * przepuszcza `anon`, więc lista renderuje się serwerowo także dla gościa.
 */
export const getProducts = cache(async (): Promise<Product[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('created_at');

  if (error) throw new BladZapytania('katalog produktów', error);
  return zOmnibusem((data ?? []).map((row) => toProduct(row as ProductRow, imageUrl)));
});

/** Ile pozycji mieści jedna strona katalogu. */
export const NA_STRONE = 12;

export type StronaKatalogu = {
  produkty: Product[];
  /** Ile pozycji pasuje do filtrów w całości, nie na tej stronie. */
  ile: number;
  strona: number;
  stron: number;
};

/** Kolejności do wyboru w sklepie. Klucz jedzie w adresie, więc jest stabilny. */
const SORTOWANIA: Record<string, { kolumna: string; rosnaco: boolean }> = {
  popular: { kolumna: 'reviews_count', rosnaco: false },
  'price-asc': { kolumna: 'price_cents', rosnaco: true },
  'price-desc': { kolumna: 'price_cents', rosnaco: false },
  rating: { kolumna: 'rating', rosnaco: false },
  // „Nowości" to czwarte sortowanie z listy Baymarda (cena, ocena,
  // popularność, nowość) i jedyne, którego tu brakowało. Kolumna już była —
  // `created_at` znaczy „kiedy produkt wszedł do katalogu".
  nowosc: { kolumna: 'created_at', rosnaco: false },
  name: { kolumna: 'name', rosnaco: true },
};

/**
 * Strona katalogu z filtrem, szukaniem i sortowaniem — wszystko po stronie bazy.
 *
 * Wcześniej `/sklep` brało cały katalog i przesiewało go w przeglądarce. Przy
 * ośmiu produktach było to tańsze niż zapytanie na każdą zmianę filtra i tak
 * stało w komentarzu przy `ShopBrowser`. Przy stu pozycjach kończy się to
 * wysyłaniem stu rekordów, żeby pokazać dwanaście.
 *
 * Liczbę pasujących pozycji bierzemy z tego samego zapytania (`count: exact`),
 * a nie osobnym — inaczej licznik i lista potrafią pokazać dwie różne prawdy,
 * gdy ktoś w międzyczasie wycofa produkt.
 */
export async function getStronaKatalogu({
  kategoria = 'all',
  sort = 'popular',
  szukaj = '',
  strona = 1,
}: {
  kategoria?: string;
  sort?: string;
  szukaj?: string;
  strona?: number;
}): Promise<StronaKatalogu> {
  const supabase = await createClient();
  const kolejnosc = SORTOWANIA[sort] ?? SORTOWANIA.popular;
  const numer = Math.max(1, Math.floor(strona) || 1);
  const od = (numer - 1) * NA_STRONE;

  let zapytanie = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .eq('is_active', true);

  if (kategoria && kategoria !== 'all') {
    zapytanie = zapytanie.eq('category_id', kategoria);
  }

  // Szukanie ma własną drogę: ranking trafień liczy funkcja w bazie, bo
  // PostgREST sortuje wyłącznie po kolumnach, a „dokładna nazwa najpierw"
  // jest wyrażeniem. Ścieżka bez frazy zostaje na PostgREST — działa dobrze.
  const fraza = szukaj.trim();
  if (fraza) {
    const { data, error } = await supabase.rpc('katalog_szukaj', {
      p_fraza: fraza,
      p_kategoria: kategoria && kategoria !== 'all' ? kategoria : null,
      p_sort: sort,
      p_od: od,
      p_ile: NA_STRONE,
    });

    if (error) throw new BladZapytania('szukanie w katalogu', error);

    const wiersze = (data ?? []) as { produkt: ProductRow; laczna: number }[];
    // Łączna liczba trafień jedzie w każdym wierszu (to samo `count(*)` dla
    // całego wyniku), więc wystarczy wziąć ją z pierwszego. Brak wierszy
    // znaczy zero trafień.
    const ileTrafien = wiersze.length > 0 ? Number(wiersze[0]!.laczna) : 0;

    return {
      produkty: await zOmnibusem(wiersze.map((w) => toProduct(w.produkt, imageUrl))),
      ile: ileTrafien,
      strona: numer,
      stron: Math.max(1, Math.ceil(ileTrafien / NA_STRONE)),
    };
  }

  const { data, error, count } = await zapytanie
    .order(kolejnosc.kolumna, { ascending: kolejnosc.rosnaco })
    // Druga kolejność rozstrzyga remisy — bez niej dwie pozycje o tej samej
    // cenie potrafią zamienić się miejscami między stronami i jedna zniknie.
    .order('id', { ascending: true })
    .range(od, od + NA_STRONE - 1);

  if (error) throw new BladZapytania('strona katalogu', error);

  const ile = count ?? 0;
  return {
    produkty: await zOmnibusem(data.map((row) => toProduct(row as ProductRow, imageUrl))),
    ile,
    strona: numer,
    stron: Math.max(1, Math.ceil(ile / NA_STRONE)),
  };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('products').select('*').eq('slug', slug).maybeSingle();

  // Tu rozróżnienie jest istotne: `maybeSingle()` przy braku wiersza oddaje
  // `data: null` BEZ błędu, a to znaczy „nie ma takiego produktu" i ma
  // skończyć się czterysta czwórką. Błąd zapytania to co innego — to awaria
  // po naszej stronie i nie wolno jej podawać jako nieistniejącego produktu.
  if (error) throw new BladZapytania(`produkt „${slug}"`, error);
  if (!data) return null;
  const produkt = toProduct(data as ProductRow, imageUrl);
  return (await zOmnibusem([produkt]))[0] ?? produkt;
}

/** Jedno ujęcie w galerii karty produktu. */
export type ZdjecieGalerii = { url: string; alt: string };

/**
 * Dodatkowe zdjęcia produktu.
 *
 * Okładka zostaje w `products.image_path` i jedzie razem z produktem do
 * każdej listy; tutaj chodzi o ujęcia oglądane wyłącznie na karcie. Osobne
 * zapytanie, bo tylko ta jedna strona ich potrzebuje — dokładanie dołączenia
 * do `getProducts()` obciążałoby siatkę katalogu bez powodu.
 */
export async function getGaleriaProduktu(
  productId: string,
  nazwa: string
): Promise<ZdjecieGalerii[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('product_images')
    .select('path, alt')
    .eq('product_id', productId)
    .order('position')
    .order('created_at');

  if (error) throw new BladZapytania('galeria produktu', error);

  return (data ?? [])
    .map((row) => ({ url: imageUrl(row.path as string), alt: (row.alt as string) || nazwa }))
    .filter((z): z is ZdjecieGalerii => Boolean(z.url));
}

/** Opinia widoczna na karcie produktu. */
export type Opinia = {
  id: string;
  ocena: number;
  tresc: string | null;
  autor: string;
  data: string;
  /** Czy pisze ją zalogowane konto — do oznaczenia „Twoja opinia". */
  wlasna: boolean;
};

/**
 * Opinie o produkcie, najnowsze na górze.
 *
 * Polityka odczytu przepuszcza opublikowane każdemu, a autorowi także jego
 * własną po ukryciu — dlatego zapytanie nie filtruje statusu samo: zrobiłoby
 * to drugi raz i odcięło autorowi jego wiersz.
 */
export async function getOpinieProduktu(productId: string): Promise<Opinia[]> {
  const supabase = await createClient();

  const [{ data }, { data: sesja }] = await Promise.all([
    supabase
      .from('reviews')
      .select('id, rating, tresc, autor, created_at, user_id')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.auth.getUser(),
  ]);

  const mojeId = sesja.user?.id ?? null;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    ocena: Number(row.rating),
    tresc: (row.tresc as string | null) ?? null,
    autor: (row.autor as string | null) || 'Klient',
    data: row.created_at as string,
    wlasna: Boolean(mojeId) && row.user_id === mojeId,
  }));
}

/**
 * Czy zalogowane konto może wystawić opinię o tym produkcie.
 *
 * Warunek jest ten sam co w `dodaj_opinie()` — sprawdzenie po stronie bazy
 * jest tym, które decyduje. Tutaj chodzi wyłącznie o to, żeby nie pokazywać
 * formularza komuś, kto i tak dostanie odmowę.
 */
export async function czyMogeOceniac(productId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { count } = await supabase
    .from('order_items')
    .select('id, orders!inner(user_id, status)', { count: 'exact', head: true })
    .eq('product_id', productId)
    .eq('orders.user_id', user.id)
    .eq('orders.status', 'dostarczone');

  return (count ?? 0) > 0;
}

/**
 * Podobne produkty. Wcześniej strona ciągnęła cały katalog i filtrowała go
 * w pamięci — przy większym asortymencie to rosnący koszt bez powodu.
 */
export async function getRelatedProducts(
  categoryId: string,
  excludeId: string,
  limit = 4
): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('category_id', categoryId)
    .eq('is_active', true)
    .neq('id', excludeId)
    .limit(limit);

  // Jedyne miejsce w tym pliku, które przy błędzie zwraca pustkę zamiast
  // rzucać — i to jest wybór, nie przeoczenie. „Podobne produkty" to pasek
  // dodatkowy: gdy go nie ma, karta produktu jest kompletna i nic nie kłamie.
  // Wywrócenie całej karty produktu przez awarię paska rekomendacji byłoby
  // gorsze od jego braku. Pozostałe zapytania opisują stan sklepu i tam
  // cisza wprowadza w błąd.
  if (error || !data) return [];
  return zOmnibusem(data.map((row) => toProduct(row as ProductRow, imageUrl)));
}

/**
 * Najniższa cena z 30 dni dla podanych produktów — w złotych, nie w groszach.
 *
 * Liczy baza (`najnizsza_cena_30dni`), bo odpowiedź wymaga historii cen,
 * a nie samego wiersza produktu, i bo naiwne „minimum z wpisów w oknie"
 * daje złą liczbę dla produktu, który nie zmieniał ceny od pół roku.
 *
 * Jedno zapytanie na całą listę, nie jedno na kafelek: siatka katalogu ma
 * dwadzieścia pozycji i dwadzieścia zapytań zamieniłoby to w problem N+1.
 *
 * Przy błędzie oddaje pustą mapę, a nie rzuca. Powód jest ten sam, co przy
 * pasku podobnych: brak liczby oznacza tylko tyle, że kafelek nie pokaże
 * obniżki (`ProductCard` bez niej chowa też przekreśloną cenę), czyli
 * zachowa się zgodnie z prawem. Wywrócenie katalogu byłoby gorsze.
 */
/**
 * Dokłada najniższą cenę z 30 dni do gotowej listy produktów.
 *
 * Jedno zapytanie na listę. Wołane tylko tam, gdzie produkt trafia przed oczy
 * kupującego — magazyn i skaner tej liczby nie potrzebują, a zapytanie
 * kosztuje.
 *
 * Optymalizacja, która nie jest przedwczesna: pytamy wyłącznie o produkty
 * z ustawioną dawną ceną. Bez obniżki nie ma czego pokazywać, a w katalogu
 * bez wyprzedaży to znaczy zero zapytań zamiast jednego na każde wejście.
 */
async function zOmnibusem(produkty: Product[]): Promise<Product[]> {
  const zObnizka = produkty.filter((p) => typeof p.oldPrice === 'number' && p.oldPrice > p.price);
  if (zObnizka.length === 0) return produkty;

  const mapa = await najnizszeCeny30Dni(zObnizka.map((p) => p.id));
  if (mapa.size === 0) return produkty;

  return produkty.map((p) => {
    const najnizsza = mapa.get(p.id);
    return typeof najnizsza === 'number' ? { ...p, najnizsza30: najnizsza } : p;
  });
}

export async function najnizszeCeny30Dni(
  idProduktow: string[]
): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  if (idProduktow.length === 0) return mapa;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('najnizsza_cena_30dni', {
    p_produkty: idProduktow,
  });

  if (error || !data) {
    console.error('Nie udało się policzyć najniższych cen z 30 dni:', error?.message);
    return mapa;
  }

  for (const wiersz of data as { product_id: string; najnizsza_cents: number }[]) {
    if (typeof wiersz.najnizsza_cents === 'number') {
      mapa.set(wiersz.product_id, wiersz.najnizsza_cents / 100);
    }
  }
  return mapa;
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('store_settings')
    .select('shipping_flat_cents, free_shipping_threshold_cents, currency')
    .maybeSingle();

  return {
    shippingFlat: (data?.shipping_flat_cents ?? 1999) / 100,
    freeFrom: (data?.free_shipping_threshold_cents ?? 30000) / 100,
    currency: data?.currency ?? 'PLN',
  };
}

/**
 * Zamówienia widoczne dla zalogowanego konta. Zakres wycina RLS: klient
 * dostaje wyłącznie swoje, konto z `orders.read_all` — wszystkie.
 */
export async function getOrders(): Promise<Order[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false });

  if (error) throw new BladZapytania('zamówienia konta', error);
  return data.map((row) => toOrder(row as OrderRow));
}

/**
 * Produkt po kodzie kreskowym. Skaner pyta o to przy każdym odczycie, więc
 * zapytanie jest wąskie i trafia w indeks częściowy z migracji.
 */
export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  const kod = barcode.trim();
  if (!kod) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('barcode', kod)
    .maybeSingle();

  // Brak wiersza to prawda („nie ma takiego"), błąd zapytania to awaria.
  if (error) throw new BladZapytania('produkt po kodzie kreskowym', error);
  if (!data) return null;
  return toProduct(data as ProductRow, imageUrl);
}

/**
 * Jedno zamówienie po numerze. RLS oddaje je właścicielowi albo zapleczu —
 * zamówienia gościa nie zobaczy nikt inny, więc strona potwierdzenia musi
 * umieć pokazać sam numer.
 */
export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('order_number', orderNumber)
    .maybeSingle();

  // Brak wiersza to prawda („nie ma takiego"), błąd zapytania to awaria.
  if (error) throw new BladZapytania('zamówienie po numerze', error);
  if (!data) return null;
  return toOrder(data as OrderRow);
}

/** Lista życzeń zalogowanego konta; RLS nie wypuszcza cudzych wpisów. */
export async function getWishlist(): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('wishlists')
    .select('product_id, products(*)')
    .order('created_at', { ascending: false });

  if (error) throw new BladZapytania('lista życzeń', error);
  // PostgREST zwraca zagnieżdżony produkt; bywa pusty, gdy pozycja zniknęła
  return (data as unknown as { products: ProductRow | null }[])
    .filter((row) => row.products)
    .map((row) => toProduct(row.products as ProductRow, imageUrl));
}

export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: addresses }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase
      .from('addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  const address = addresses?.[0] ?? null;

  return {
    name: profile?.full_name ?? '',
    email: profile?.email ?? user.email ?? '',
    phone: profile?.phone ?? '',
    newsletter: Boolean(profile?.newsletter),
    street: address?.street ?? '',
    zip: address?.postal_code ?? '',
    city: address?.city ?? '',
  };
}

/* ==========================================================================
   Magazyn — aplikacja zarządu

   Wszystkie zapytania niżej filtrują i liczą po stronie bazy. Telefon ma
   dostać gotowy wynik, a nie kilka tysięcy wierszy do przemielenia na
   łączu komórkowym.
   ========================================================================== */

/** Zamówienie w kolejce razem z pokryciem pozycji w magazynie. */
export type ZamowienieWKolejce = Order & {
  /** Ile sztuk brakuje w sumie, żeby dało się spakować. Zero = komplet. */
  brakujeSztuk: number;
  /** Nazwa pierwszej pozycji bez pokrycia — do komunikatu w wierszu. */
  brakujacyProdukt: string | null;
};

/**
 * Pokrycie pozycji zamówienia w magazynie.
 *
 * Liczone na jednym zapytaniu o produkty z tych zamówień, nie po jednym na
 * pozycję: kolejka z dwudziestoma zamówieniami po trzy pozycje to inaczej
 * sześćdziesiąt zapytań przy każdym wejściu na ekran.
 */
async function stanyProduktow(idProduktow: string[]): Promise<Map<string, number>> {
  const unikalne = [...new Set(idProduktow.filter(Boolean))];
  if (unikalne.length === 0) return new Map();

  const supabase = await createClient();
  const { data } = await supabase.from('products').select('id, stock').in('id', unikalne);

  return new Map((data ?? []).map((r) => [String(r.id), Number(r.stock ?? 0)]));
}

/**
 * Kolejka zamówień dla wybranej zakładki.
 *
 * „Nowe" i „Spakowane" to praca do zrobienia, więc najstarsze na górze.
 * „Wysłane" to archiwum ostatnich dni — tam odwrotnie, bo szuka się tego,
 * co przed chwilą wyjechało.
 */
export async function getKolejkaZamowien(
  stan: 'nowe' | 'spakowane' | 'wysłane'
): Promise<ZamowienieWKolejce[]> {
  const supabase = await createClient();

  // Zamówienia sprzed wprowadzenia stanu „spakowane" siedzą w „w realizacji";
  // zakładka Nowe pokazuje jedno i drugie, żeby żadne nie wypadło z kolejki.
  const stany = stan === 'nowe' ? ['nowe', 'w realizacji'] : [stan];

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .in('status', stany)
    .neq('payment_status', 'zwrócone')
    .order('created_at', { ascending: stan !== 'wysłane' })
    .limit(50);

  if (error) throw new BladZapytania('kolejka zamówień', error);

  const zamowienia = data.map((row) => toOrder(row as OrderRow));
  const stanyMap = await stanyProduktow(
    zamowienia.flatMap((z) => z.items.map((p) => p.productId ?? ''))
  );

  return zamowienia.map((z) => {
    let brakujeSztuk = 0;
    let brakujacyProdukt: string | null = null;

    for (const pozycja of z.items) {
      if (!pozycja.productId) continue;
      const stanTeraz = stanyMap.get(pozycja.productId) ?? 0;
      const brak = Math.max(0, pozycja.qty - stanTeraz);
      if (brak > 0) {
        brakujeSztuk += brak;
        if (!brakujacyProdukt) brakujacyProdukt = pozycja.name;
      }
    }

    return { ...z, brakujeSztuk, brakujacyProdukt };
  });
}

/** Liczniki przy segmentach — trzy zapytania zliczające, bez ściągania wierszy. */
export async function getLicznikiZamowien(): Promise<Record<string, number>> {
  const supabase = await createClient();

  const zlicz = async (stany: string[]) => {
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', stany)
      .neq('payment_status', 'zwrócone');
    return count ?? 0;
  };

  const [nowe, spakowane, wyslane] = await Promise.all([
    zlicz(['nowe', 'w realizacji']),
    zlicz(['spakowane']),
    zlicz(['wysłane']),
  ]);

  return { nowe, spakowane, wysłane: wyslane };
}

/** Jedno zamówienie po numerze, z pokryciem każdej pozycji w magazynie. */
export async function getZamowienieZPokryciem(
  numer: string
): Promise<{ zamowienie: Order; pozycje: PozycjaZPokryciem[] } | null> {
  const zamowienie = await getOrderByNumber(numer);
  if (!zamowienie) return null;

  const supabase = await createClient();
  const idProduktow = [...new Set(zamowienie.items.map((p) => p.productId).filter(Boolean))];

  const { data } = idProduktow.length
    ? await supabase.from('products').select('id, stock, sku').in('id', idProduktow as string[])
    : { data: [] as { id: string; stock: number; sku: string | null }[] };

  const wg = new Map((data ?? []).map((r) => [String(r.id), r]));

  const pozycje: PozycjaZPokryciem[] = zamowienie.items.map((p) => {
    const produkt = p.productId ? wg.get(p.productId) : undefined;
    const stan = Number(produkt?.stock ?? 0);
    return {
      ...p,
      sku: produkt?.sku ?? null,
      stan,
      brakuje: Math.max(0, p.qty - stan),
    };
  });

  return { zamowienie, pozycje };
}

/**
 * Stany magazynowe z filtrem i szukaniem.
 *
 * Szukanie idzie po nazwie i po symbolu jednym zapytaniem (`or`), a filtr
 * progu po stronie bazy nie da się wyrazić prościej niż porównaniem dwóch
 * kolumn — dlatego segment „niskie" domykamy w pamięci na już zawężonym
 * zbiorze aktywnych produktów.
 */
export async function getStanyMagazynu(
  szukaj = '',
  segment: 'wszystko' | 'niskie' | 'zero' = 'wszystko'
): Promise<Product[]> {
  const supabase = await createClient();
  let zapytanie = supabase.from('products').select('*').eq('is_active', true);

  const fraza = szukaj.trim();
  if (fraza) {
    // `%` i `,` rozbijają składnię filtra PostgREST — usuwamy je z frazy.
    const czysta = fraza.replace(/[%,]/g, ' ').trim();
    if (czysta) zapytanie = zapytanie.or(`name.ilike.%${czysta}%,sku.ilike.%${czysta}%`);
  }
  if (segment === 'zero') zapytanie = zapytanie.eq('stock', 0);

  const { data, error } = await zapytanie
    .order('stock', { ascending: true })
    .order('name', { ascending: true })
    .limit(200);

  if (error) throw new BladZapytania('stany magazynowe', error);

  const produkty = data.map((row) => toProduct(row as ProductRow, imageUrl));
  if (segment !== 'niskie') return produkty;

  return produkty.filter((p) => p.progNiski > 0 && p.stock > 0 && p.stock <= p.progNiski);
}

/** Zwroty czekające na przyjęcie w magazynie. */
export async function getLiczbaZwrotow(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('zwroty')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'zgłoszony');

  return count ?? 0;
}

/** Liczniki segmentów magazynu. Liczone z jednego przebiegu po aktywnych pozycjach. */
export async function getLicznikiMagazynu(): Promise<{
  wszystko: number;
  niskie: number;
  zero: number;
}> {
  const supabase = await createClient();
  const { data } = await supabase.from('products').select('stock, prog_niski').eq('is_active', true);

  const wiersze = data ?? [];
  return {
    wszystko: wiersze.length,
    niskie: wiersze.filter((r) => {
      const prog = Number(r.prog_niski ?? 5);
      const stan = Number(r.stock ?? 0);
      return prog > 0 && stan > 0 && stan <= prog;
    }).length,
    zero: wiersze.filter((r) => Number(r.stock ?? 0) === 0).length,
  };
}

export async function getProduktPoId(id: string): Promise<Product | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();

  // Brak wiersza to prawda („nie ma takiego"), błąd zapytania to awaria.
  if (error) throw new BladZapytania('produkt po identyfikatorze', error);
  if (!data) return null;
  return toProduct(data as ProductRow, imageUrl);
}

/** Ostatnie ruchy magazynowe — historia, z której wynika stan. */
export async function getOstatnieRuchy(limit = 3): Promise<RuchMagazynowy[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('id, product_id, delta, reason, notatka, created_at, products(name), orders(order_number)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new BladZapytania('ostatnie ruchy magazynowe', error);

  return (data as unknown as RuchRow[]).map((r) => {
    // PostgREST oddaje dołączony wiersz raz jako obiekt, raz jako tablicę —
    // zależnie od tego, jak rozpozna kardynalność relacji.
    const produkt = Array.isArray(r.products) ? r.products[0] : r.products;
    const zam = Array.isArray(r.orders) ? r.orders[0] : r.orders;

    // Ruch wynikający z zamówienia opisuje się numerem, nie powodem:
    // „zamówienie #NOR-2026-0418" mówi magazynierowi więcej niż „sprzedaż",
    // bo pozwala tę paczkę odnaleźć. Powody z listy lecą małą literą, żeby
    // czytały się jak zdanie, a nie jak nagłówek.
    const zrodlo = zam?.order_number
      ? `zamówienie ${zam.order_number}`
      : r.reason.charAt(0).toLowerCase() + r.reason.slice(1);

    return {
      id: r.id,
      produktId: r.product_id,
      produkt: produkt?.name ?? 'Produkt usunięty',
      delta: r.delta,
      powod: zrodlo,
      notatka: r.notatka,
      czas: r.created_at,
    };
  });
}

/**
 * Liczby na Przegląd. Wszystko z bazy — pustych kart z zerami nie rysujemy
 * z założenia, więc ekran musi wiedzieć, czy dziś cokolwiek się wydarzyło.
 */
export async function getPrzeglad(): Promise<{
  doWyslania: number;
  niskieStany: number;
  zwroty: number;
  paczkiDzis: number;
  sztukiDzis: number;
  ruchy: RuchMagazynowy[];
}> {
  const supabase = await createClient();
  const poczatekDnia = new Date();
  poczatekDnia.setHours(0, 0, 0, 0);
  const odKiedy = poczatekDnia.toISOString();

  const [liczniki, magazyn, zwroty, ruchy, paczki, ruchyDzis] = await Promise.all([
    getLicznikiZamowien(),
    getLicznikiMagazynu(),
    getLiczbaZwrotow(),
    getOstatnieRuchy(3),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'wysłane')
      .gte('updated_at', odKiedy),
    supabase.from('inventory_movements').select('delta').gte('created_at', odKiedy),
  ]);

  const sztukiDzis = (ruchyDzis.data ?? [])
    .map((r) => Number(r.delta ?? 0))
    .filter((d) => d > 0)
    .reduce((a, b) => a + b, 0);

  return {
    doWyslania: (liczniki.nowe ?? 0) + (liczniki.spakowane ?? 0),
    niskieStany: magazyn.niskie,
    zwroty,
    paczkiDzis: paczki.count ?? 0,
    sztukiDzis,
    ruchy,
  };
}

/** Zwrot do przyjęcia razem z pozycjami i numerem zamówienia. */
export type ZwrotDoPrzyjecia = {
  id: string;
  numerZamowienia: string;
  klient: string;
  powod: string | null;
  zgloszony: string;
  pozycje: { name: string; qty: number }[];
  sztuk: number;
};

/**
 * Zwroty czekające w kolejce. Pozycje dołączane jednym zapytaniem — lista
 * zwrotów bez zawartości nie mówi magazynierowi, czego się spodziewać.
 */
export async function getZwroty(): Promise<ZwrotDoPrzyjecia[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('zwroty')
    .select('id, powod, created_at, orders(order_number, email, shipping_address), zwroty_pozycje(name, qty)')
    .eq('status', 'zgłoszony')
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) throw new BladZapytania('zwroty', error);

  return data.map((z) => {
    // PostgREST oddaje dołączony wiersz raz jako obiekt, raz jako tablicę.
    const zam = Array.isArray(z.orders) ? z.orders[0] : z.orders;
    const pozycje = (z.zwroty_pozycje ?? []) as { name: string; qty: number }[];
    const adres = (zam?.shipping_address ?? {}) as { recipient?: string };

    return {
      id: String(z.id),
      numerZamowienia: zam?.order_number ?? '—',
      klient: adres.recipient || zam?.email || '—',
      powod: z.powod ?? null,
      zgloszony: z.created_at as string,
      pozycje,
      sztuk: pozycje.reduce((a, p) => a + Number(p.qty ?? 0), 0),
    };
  });
}

// ---------------------------------------------------------------------------
// Panel właściciela
//
// Wszystko niżej jedzie przez klienta z sesją zalogowanego, więc RLS decyduje,
// co wróci. Konto bez `orders.read_all` dostanie puste listy zamiast błędu —
// i to jest właściwe zachowanie: ekran ma nie istnieć dla kogoś, kto nie ma
// tam czego szukać, a nie krzyczeć o odmowie.
// ---------------------------------------------------------------------------

export type FiltrZamowien = {
  stan?: string;
  platnosc?: string;
  od?: string;
  do?: string;
  szukaj?: string;
};

/** Lista zamówień do panelu. Filtry przychodzą z adresu, nie ze stanu ekranu. */
export async function getZamowieniaPanelu(filtr: FiltrZamowien = {}): Promise<Order[]> {
  const supabase = await createClient();

  let zapytanie = supabase
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false })
    .limit(100);

  // „kolejka" to nie stan w bazie, tylko to, co czeka na człowieka.
  if (filtr.stan === 'kolejka') zapytanie = zapytanie.in('status', ['nowe', 'w realizacji', 'spakowane']);
  else if (filtr.stan) zapytanie = zapytanie.eq('status', filtr.stan);

  if (filtr.platnosc) zapytanie = zapytanie.eq('payment_status', filtr.platnosc);
  if (filtr.od) zapytanie = zapytanie.gte('created_at', filtr.od);
  // Data „do" obejmuje cały dzień: użytkownik wpisujący 10 sierpnia ma na myśli
  // koniec tego dnia, nie jego północ.
  if (filtr.do) zapytanie = zapytanie.lt('created_at', `${filtr.do}T23:59:59.999Z`);

  const szukaj = filtr.szukaj?.trim();
  if (szukaj) {
    const wzor = `%${szukaj.replace(/[%,()]/g, '')}%`;
    zapytanie = zapytanie.or(
      `order_number.ilike.${wzor},email.ilike.${wzor},numer_przesylki.ilike.${wzor}`
    );
  }

  const { data, error } = await zapytanie;
  if (error) throw new BladZapytania('zamówienia w panelu', error);
  return data.map((row) => toOrder(row as OrderRow));
}

/** Zamówienie po numerze wraz z przesyłką i śladem w dzienniku. */
export async function getZamowieniePanelu(numer: string): Promise<{
  zamowienie: Order;
  przesylka: PrzesylkaPanelu | null;
  slad: WpisDziennika[];
} | null> {
  const zamowienie = await getOrderByNumber(numer);
  if (!zamowienie) return null;

  const supabase = await createClient();
  const [{ data: p }, { data: d }] = await Promise.all([
    supabase.from('przesylki').select('*').eq('order_id', zamowienie.id).maybeSingle(),
    supabase
      .from('dziennik_zaplecza')
      .select('id, created_at, obszar, obiekt, opis, kto')
      .eq('obiekt', numer)
      .order('id', { ascending: false })
      .limit(20),
  ]);

  return {
    zamowienie,
    przesylka: p
      ? {
          orderId: p.order_id as string,
          numer: (p.numer as string) ?? null,
          przewoznik: (p.przewoznik as string) ?? 'inny',
          punktOdbioru: (p.punkt_odbioru as string) ?? null,
          status: (p.status as string) ?? null,
          statusOdczyt: (p.status_odczyt as string) ?? null,
        }
      : null,
    slad: (d ?? []).map((w) => ({
      id: Number(w.id),
      czas: String(w.created_at),
      kto: '',
      obszar: String(w.obszar),
      obiekt: (w.obiekt as string) ?? null,
      opis: String(w.opis),
    })),
  };
}

/** Kolejka nadań: spakowane paczki bez listu przewozowego. */
export async function getDoNadania(): Promise<Order[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('status', 'spakowane')
    .is('numer_przesylki', null)
    .order('created_at', { ascending: true })
    .limit(50);

  return (data ?? []).map((row) => toOrder(row as OrderRow));
}

/** Paczki w drodze — z numerem, jeszcze nie odebrane. */
export async function getWDrodze(): Promise<{ zamowienie: Order; przesylka: PrzesylkaPanelu | null }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('orders')
    .select('*, order_items(*), przesylki(*)')
    .not('numer_przesylki', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

  return (data ?? []).map((row) => {
    const przesylki = (row as { przesylki?: Record<string, unknown>[] }).przesylki ?? [];
    const p = przesylki[0];
    return {
      zamowienie: toOrder(row as OrderRow),
      przesylka: p
        ? {
            orderId: String(p.order_id),
            numer: (p.numer as string) ?? null,
            przewoznik: (p.przewoznik as string) ?? 'inny',
            punktOdbioru: (p.punkt_odbioru as string) ?? null,
            status: (p.status as string) ?? null,
            statusOdczyt: (p.status_odczyt as string) ?? null,
          }
        : null,
    };
  });
}

/** Dziennik zaplecza. Bez uprawnienia `audyt.read` wraca pusty. */
export async function getDziennik(obszar?: string): Promise<WpisDziennika[]> {
  const supabase = await createClient();

  let zapytanie = supabase
    .from('dziennik_zaplecza')
    .select('id, created_at, obszar, obiekt, opis, kto')
    .order('id', { ascending: false })
    .limit(100);

  if (obszar) zapytanie = zapytanie.eq('obszar', obszar);

  const { data } = await zapytanie;
  if (!data?.length) return [];

  // Kto zrobił zmianę — jednym zapytaniem po profilach, nie N zapytaniami.
  const idOsob = [...new Set(data.map((w) => w.kto).filter(Boolean))] as string[];
  const { data: osoby } = idOsob.length
    ? await supabase.from('profiles').select('id, email, full_name').in('id', idOsob)
    : { data: [] };

  const nazwa = new Map(
    (osoby ?? []).map((o) => [o.id as string, (o.full_name as string) || (o.email as string)])
  );

  return data.map((w) => ({
    id: Number(w.id),
    czas: String(w.created_at),
    kto: w.kto ? nazwa.get(w.kto as string) ?? 'konto usunięte' : 'system',
    obszar: String(w.obszar),
    obiekt: (w.obiekt as string) ?? null,
    opis: String(w.opis),
  }));
}

/** Konta z rolą inną niż klient plus ci, którym rolę można nadać. */
export async function getOsobyZaplecza(): Promise<OsobaZaplecza[]> {
  const supabase = await createClient();

  const { data: role } = await supabase
    .from('user_roles')
    .select('user_id, role, created_at')
    .order('created_at', { ascending: true });

  if (!role?.length) return [];

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', role.map((r) => r.user_id as string));

  const dane = new Map((profile ?? []).map((p) => [p.id as string, p]));

  return role.map((r) => {
    const p = dane.get(r.user_id as string);
    return {
      id: r.user_id as string,
      email: (p?.email as string) ?? '—',
      imie: (p?.full_name as string) ?? '',
      rola: String(r.role),
      odKiedy: String(r.created_at),
    };
  });
}

/**
 * Finanse. Przychód bierzemy z widoków, a nie liczymy drugi raz tutaj —
 * definicja „opłacone i nieanulowane" ma zostać jedna dla całego sklepu.
 */
export async function getFinanse(dni = 30): Promise<PodsumowanieFinansow> {
  const supabase = await createClient();
  const od = new Date(Date.now() - dni * 86_400_000).toISOString().slice(0, 10);
  const dzisIso = new Date().toISOString().slice(0, 10);
  const poczatekMiesiaca = `${dzisIso.slice(0, 7)}-01`;

  const [sprzedaz, marza, produkty] = await Promise.all([
    supabase.from('sprzedaz_dziennie').select('*').gte('dzien', od).order('dzien'),
    supabase.from('marza_dziennie').select('*').gte('dzien', od).order('dzien'),
    supabase.from('sprzedaz_produktow').select('*').order('przychod_cents', { ascending: false }).limit(8),
  ]);

  const marzaDnia = new Map(
    (marza.data ?? []).map((m) => [
      String(m.dzien),
      {
        marza: Number(m.marza_cents ?? 0) / 100,
        bezKosztu: Number(m.pozycji_bez_kosztu ?? 0),
      },
    ])
  );

  const dniSprzedazy: DzienSprzedazy[] = (sprzedaz.data ?? []).map((d) => {
    const m = marzaDnia.get(String(d.dzien));
    return {
      dzien: String(d.dzien),
      przychod: Number(d.przychod_cents ?? 0) / 100,
      zamowien: Number(d.zamowien ?? 0),
      marza: m?.marza ?? 0,
      pozycjiBezKosztu: m?.bezKosztu ?? 0,
    };
  });

  const wMiesiacu = dniSprzedazy.filter((d) => d.dzien >= poczatekMiesiaca);
  const suma = (lista: number[]) => lista.reduce((a, b) => a + b, 0);
  const zamowienMiesiac = suma(wMiesiacu.map((d) => d.zamowien));
  const przychodMiesiac = suma(wMiesiacu.map((d) => d.przychod));

  const top: SprzedazProduktu[] = (produkty.data ?? []).map((p) => ({
    productId: (p.product_id as string) ?? null,
    nazwa: String(p.name),
    sztuk: Number(p.sztuk ?? 0),
    przychod: Number(p.przychod_cents ?? 0) / 100,
  }));

  return {
    dzis: dniSprzedazy.find((d) => d.dzien === dzisIso)?.przychod ?? 0,
    miesiac: przychodMiesiac,
    marzaMiesiac: suma(wMiesiacu.map((d) => d.marza)),
    pozycjiBezKosztu: suma(wMiesiacu.map((d) => d.pozycjiBezKosztu)),
    zamowienMiesiac,
    sredniKoszyk: zamowienMiesiac ? przychodMiesiac / zamowienMiesiac : 0,
    dni: dniSprzedazy,
    top,
  };
}

/** Koszty zakupu do ekranu katalogu. Bez `finanse.read` wraca pusta mapa. */
export async function getKosztyProduktow(): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase.from('koszty_produktow').select('product_id, koszt_cents');
  return new Map((data ?? []).map((k) => [k.product_id as string, Number(k.koszt_cents) / 100]));
}
