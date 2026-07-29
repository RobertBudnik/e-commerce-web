import type { Order, Product, Quote, SessionUser } from './types';

/**
 * Wiersz z bazy → kształt używany przez front. Ta warstwa istniała już
 * w statycznej wersji (`js/backend.js`); tutaj dostała typy.
 *
 * Kwoty w bazie są w groszach (integer) — żadnych floatów przy pieniądzach.
 */

export function toProduct(row: any, publicUrl: (path: string | null) => string | null): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    short: row.short ?? '',
    category: row.category_id,
    price: row.price_cents / 100,
    oldPrice: row.old_price_cents ? row.old_price_cents / 100 : null,
    rating: Number(row.rating ?? 0),
    reviews: row.reviews_count ?? 0,
    stock: row.stock ?? 0,
    icon: row.icon ?? 'grid',
    badge: row.badge ?? null,
    specs: (row.specs ?? {}) as Record<string, string>,
    imagePath: row.image_path ?? null,
    image: publicUrl(row.image_path ?? null),
  };
}

/** Adres z kolumny jsonb → jedna linijka do wyświetlenia. */
export function formatAddress(addr: any): string {
  if (!addr) return '';
  return [addr.street, [addr.postal_code, addr.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
}

export function toOrder(row: any): Order {
  const addr = row.shipping_address ?? {};
  return {
    id: row.id,
    number: row.order_number,
    date: row.created_at,
    status: row.status,
    paymentStatus: row.payment_status,
    customer: addr.recipient || row.email,
    email: row.email,
    phone: row.phone ?? addr.phone ?? '',
    address: formatAddress(addr),
    subtotal: row.subtotal_cents / 100,
    discount: row.discount_cents / 100,
    shipping: row.shipping_cents / 100,
    total: row.total_cents / 100,
    items: (row.order_items ?? []).map((i: any) => ({
      productId: i.product_id,
      name: i.name,
      qty: i.qty,
      price: i.unit_price_cents / 100,
    })),
  };
}

export function toQuote(data: any): Quote {
  return {
    subtotal: data.subtotal_cents / 100,
    discount: data.discount_cents / 100,
    shipping: data.shipping_cents / 100,
    total: data.total_cents / 100,
    coupon: data.coupon,
    couponValid: data.coupon_valid,
    percentOff: data.percent_off,
    freeShippingFrom: data.free_shipping_threshold_cents / 100,
    freeShippingMissing: data.free_shipping_missing_cents / 100,
    lines: (data.lines ?? []).map((l: any) => ({
      id: l.product_id,
      name: l.name,
      qty: l.qty,
      price: l.unit_price_cents / 100,
      total: l.line_total_cents / 100,
      stock: l.stock,
      inStock: l.in_stock,
    })),
  };
}

/**
 * Użytkownik z sesji. Rola przyjeżdża w claimie `user_role` access tokenu
 * (dokłada go hook `custom_access_token_hook`) — nie z adresu e-mail
 * i nie z tabeli odpytywanej po stronie klienta.
 */
export function toSessionUser(user: any, claims: any): SessionUser {
  const rawRole = String(claims?.user_role ?? 'customer');
  return {
    id: user.id,
    email: user.email ?? '',
    name: user.user_metadata?.full_name || (user.email ?? '').split('@')[0],
    role: rawRole === 'customer' ? 'customer' : 'admin',
    rawRole,
  };
}
