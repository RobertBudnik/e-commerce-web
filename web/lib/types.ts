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
  /** Symbol z etykiety magazynowej. Nie mylić ze `slug` ani z `barcode`. */
  sku: string | null;
  /** Stan, przy którym magazyn zapala ostrzeżenie. Zero wyłącza ostrzeganie. */
  progNiski: number;
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

export type OrderStatus =
  | 'nowe'
  | 'w realizacji'
  | 'spakowane'
  | 'wysłane'
  | 'dostarczone'
  | 'anulowane';
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
  /** Operator płatności ze zdarzenia Stripe'a. Puste dla zamówień bez płatności. */
  operatorPlatnosci: string | null;
  /** Numer listu przewozowego. Puste, dopóki paczka nie wyjechała. */
  numerPrzesylki: string | null;
  /** Punkt odbioru; puste znaczy dostawę kurierem pod adres. */
  punktOdbioru: string | null;
};

/** Pozycja historii magazynu. `delta` ze znakiem: plus przyjęcie, minus wydanie. */
export type RuchMagazynowy = {
  id: number;
  produktId: string;
  produkt: string;
  delta: number;
  powod: string;
  notatka: string | null;
  czas: string;
};

/** Pozycja zamówienia wzbogacona o pokrycie w magazynie. */
export type PozycjaZPokryciem = OrderItem & {
  sku: string | null;
  stan: number;
  /** Ile sztuk brakuje, żeby pozycję dało się spakować. Zero = jest komplet. */
  brakuje: number;
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
