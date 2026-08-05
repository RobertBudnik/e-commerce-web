/** Kształty, których używa cały front. Wiersze z bazy mapuje `lib/mappers.ts`. */

export type Product = {
  id: string;
  slug: string;
  name: string;
  short: string;
  category: string;
  price: number;
  oldPrice: number | null;
  rating: number;
  reviews: number;
  stock: number;
  barcode: string | null;
  icon: string;
  badge: string | null;
  specs: Record<string, string>;
  imagePath: string | null;
  image: string | null;
};

export type Category = {
  id: string;
  name: string;
  desc: string;
  icon: string;
};

export type OrderStatus = 'nowe' | 'w realizacji' | 'wysłane' | 'dostarczone' | 'anulowane';
export type PaymentStatus = 'oczekuje' | 'opłacone' | 'nieudane' | 'zwrócone';

export type OrderItem = {
  productId: string | null;
  name: string;
  qty: number;
  price: number;
};

export type Order = {
  id: string;
  number: string;
  date: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  customer: string;
  email: string;
  phone: string;
  address: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  items: OrderItem[];
};

export type Quote = {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  coupon: string | null;
  couponValid: boolean;
  percentOff: number;
  freeShippingFrom: number;
  freeShippingMissing: number;
  lines: {
    id: string;
    name: string;
    qty: number;
    price: number;
    total: number;
    stock: number;
    inStock: boolean;
  }[];
};

export type StoreSettings = {
  shippingFlat: number;
  freeFrom: number;
  currency: string;
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  /** 'admin' = konto organizacji, 'customer' = klient. */
  role: 'admin' | 'customer';
  /** Rola prosto z tokenu: owner | manager | staff | customer. */
  rawRole: string;
};

export type CartLine = { id: string; qty: number };
