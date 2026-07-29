import 'server-only';

import { cache } from 'react';

import { createClient } from '@/utils/supabase/server';
import { createPublicClient } from '@/utils/supabase/public';
import { toOrder, toProduct, toSessionUser } from './mappers';
import type { OrderRow, ProductRow } from './rows';
import type { Category, Order, Product, SessionUser, StoreSettings } from './types';

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

  return toSessionUser(user, session ? decodeClaims(session.access_token) : {});
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
