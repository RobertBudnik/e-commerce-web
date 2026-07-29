'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { toProduct, toQuote } from '@/lib/mappers';
import type { ProductRow, QuoteRow } from '@/lib/rows';
import { imageUrl } from '@/lib/queries';
import type { CartLine, Product, Quote } from '@/lib/types';

/**
 * Zapytania do bazy, które w statycznej wersji szły prosto z przeglądarki.
 *
 * Tutaj idą przez serwer — dzięki temu ciasteczko sesji może być `HttpOnly`
 * i nie ma po stronie klienta żadnego kodu, który potrzebowałby tokenu.
 * Zakres danych i tak wycina RLS; to jest druga warstwa, nie jedyna.
 */

export async function quoteCartAction(
  lines: CartLine[],
  coupon?: string | null
): Promise<Quote | null> {
  if (!lines.length) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('quote_order', {
    p_items: lines.map((l) => ({ product_id: l.id, qty: l.qty })),
    p_coupon: coupon ?? null,
  });

  if (error) {
    console.warn('Błąd wyceny koszyka:', error.message);
    return null;
  }
  return toQuote(data as QuoteRow);
}

/** Miniatury do koszyka: wycena zwraca nazwy i ceny, ale nie grafikę. */
export async function cartMediaAction(ids: string[]) {
  if (!ids.length) return [];

  const supabase = await createClient();
  const { data } = await supabase.from('products').select('id, icon, image_path, slug').in('id', ids);

  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/`;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    icon: (row.icon as string) ?? 'grid',
    image: row.image_path ? `${base}${row.image_path}` : null,
    slug: row.slug as string,
  }));
}

/**
 * Przełącza pozycję na liście życzeń. Wpis wiąże się z `auth.uid()`, więc
 * polityka „lista życzeń: własna" nie wpuści nikogo do cudzej listy.
 */
export async function toggleWishlistAction(productId: string): Promise<{ saved: boolean } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Zaloguj się, żeby zapisać listę życzeń' };

  const { data: existing } = await supabase
    .from('wishlists')
    .select('product_id')
    .eq('user_id', user.id)
    .eq('product_id', productId)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from('wishlists').delete().eq('user_id', user.id).eq('product_id', productId)
    : await supabase.from('wishlists').insert({ user_id: user.id, product_id: productId });

  if (error) return { error: error.message };

  revalidatePath('/konto');
  return { saved: !existing };
}

/** Identyfikatory z listy życzeń — do podświetlenia serc po zalogowaniu. */
export async function wishlistIdsAction(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('wishlists').select('product_id');
  return (data ?? []).map((row) => row.product_id as string);
}

/**
 * Produkty po identyfikatorach — dla „ostatnio oglądanych". Historia siedzi
 * w localStorage, więc dopiero przeglądarka wie, o co zapytać. Wcześniej
 * strona wysyłała klientowi cały katalog tylko po to, żeby wybrać z niego
 * cztery pozycje.
 */
export async function productsByIdsAction(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .in('id', ids.slice(0, 12))
    .eq('is_active', true);

  if (error || !data) return [];

  // Kolejność z historii, nie z bazy — najnowsze oglądane jako pierwsze
  const order = new Map(ids.map((id, i) => [id, i]));
  return data
    .map((row) => toProduct(row as ProductRow, imageUrl))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
