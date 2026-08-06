/**
 * Kształty wierszy, tak jak wracają z PostgREST.
 *
 * Ręczne, nie generowane: `supabase gen types` wymaga działającej bazy przy
 * każdym buildzie, a te tabele zmieniają się rzadko. Gdy zaczną się zmieniać
 * częściej, warto przejść na generator i wyrzucić ten plik.
 */

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  short: string | null;
  description?: string | null;
  category_id: string | null;
  price_cents: number;
  old_price_cents: number | null;
  currency?: string;
  stock: number;
  barcode: string | null;
  sku?: string | null;
  prog_niski?: number | null;
  rating: number | string;
  reviews_count: number;
  icon: string | null;
  badge: string | null;
  specs: Record<string, string> | null;
  image_path: string | null;
  is_active?: boolean;
  created_at?: string;
};

export type ShippingAddress = {
  recipient?: string;
  street?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  phone?: string | null;
};

export type OrderItemRow = {
  id?: number;
  order_id?: string;
  product_id: string | null;
  name: string;
  unit_price_cents: number;
  qty: number;
  line_total_cents: number;
};

export type OrderRow = {
  id: string;
  order_number: string;
  user_id: string | null;
  email: string;
  phone: string | null;
  status: string;
  payment_status: string;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  total_cents: number;
  coupon_code?: string | null;
  shipping_address: ShippingAddress | null;
  payment_provider?: string | null;
  numer_przesylki?: string | null;
  created_at: string;
  order_items?: OrderItemRow[];
};

/**
 * Ruch magazynowy. `delta` jest ze znakiem — plus to przyjęcie, minus
 * wydanie. Stan produktu wynika z sumy ruchów, więc to ta tabela jest
 * źródłem prawdy, a kolumna `products.stock` tylko jej podsumowaniem.
 */
export type RuchRow = {
  id: number;
  product_id: string;
  delta: number;
  reason: string;
  notatka: string | null;
  order_id: string | null;
  created_by: string | null;
  created_at: string;
  products?: { name: string } | { name: string }[] | null;
};

export type QuoteLineRow = {
  product_id: string;
  name: string;
  unit_price_cents: number;
  qty: number;
  line_total_cents: number;
  stock: number;
  in_stock: boolean;
};

export type QuoteRow = {
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  total_cents: number;
  coupon: string | null;
  coupon_valid: boolean;
  percent_off: number;
  free_shipping_threshold_cents: number;
  free_shipping_missing_cents: number;
  currency: string;
  lines: QuoteLineRow[] | null;
};

/** Claim z access tokenu; hook `custom_access_token_hook` dokłada `user_role`. */
export type TokenClaims = { user_role?: string } & Record<string, unknown>;

/** Tyle z użytkownika Auth, ile realnie czyta front. */
export type AuthUserLike = {
  id: string;
  email?: string | null;
  user_metadata?: { full_name?: string } | null;
};
