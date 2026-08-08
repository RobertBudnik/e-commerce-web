import 'server-only';

import { cache } from 'react';

import { createClient } from '@/utils/supabase/server';
import { createPublicClient } from '@/utils/supabase/public';
import { toOrder, toProduct, toSessionUser } from './mappers';
import type { OrderRow, ProductRow, RuchRow } from './rows';
import type {
  Category,
  Order,
  PozycjaZPokryciem,
  Product,
  RuchMagazynowy,
  SessionUser,
  StoreSettings,
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

export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, description, icon, position')
    .order('position');

  if (error || !data) return [];
  return data.map((c) => ({ id: c.id, name: c.name, desc: c.description ?? '', icon: c.icon ?? 'grid' }));
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

  if (error || !data) return [];
  return data.map((row) => toProduct(row as ProductRow, imageUrl));
});

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('products').select('*').eq('slug', slug).maybeSingle();

  if (error || !data) return null;
  return toProduct(data as ProductRow, imageUrl);
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

  if (error || !data) return [];

  return data
    .map((row) => ({ url: imageUrl(row.path as string), alt: (row.alt as string) || nazwa }))
    .filter((z): z is ZdjecieGalerii => Boolean(z.url));
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

  if (error || !data) return [];
  return data.map((row) => toProduct(row as ProductRow, imageUrl));
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

  if (error || !data) return [];
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

  if (error || !data) return null;
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

  if (error || !data) return null;
  return toOrder(data as OrderRow);
}

/** Lista życzeń zalogowanego konta; RLS nie wypuszcza cudzych wpisów. */
export async function getWishlist(): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('wishlists')
    .select('product_id, products(*)')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
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

  if (error || !data) return [];

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

  if (error || !data) return [];

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

  if (error || !data) return null;
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

  if (error || !data) return [];

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

  if (error || !data) return [];

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
