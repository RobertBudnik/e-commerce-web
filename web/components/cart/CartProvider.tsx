'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CartLine } from '@/lib/types';

const CART_KEY = 'shop.cart.v1';

type CartContext = {
  lines: CartLine[];
  count: number;
  ready: boolean;
  add: (id: string, qty?: number, stock?: number) => void;
  setQty: (id: string, qty: number, stock?: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
};

const Ctx = createContext<CartContext | null>(null);

function read(): CartLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((i) => i?.id && i.qty > 0) : [];
  } catch {
    return [];
  }
}

/**
 * Koszyk zostaje po stronie przeglądarki — to jedyny stan, którego nie ma
 * sensu trzymać w bazie przed złożeniem zamówienia. Klucz `shop.cart.v1`
 * jest ten sam co w statycznej wersji, więc koszyk przeżywa migrację.
 *
 * `ready` odróżnia „koszyk pusty" od „jeszcze nie odczytany" — bez tego
 * pierwszy render serwera i klienta rozjeżdżają się przy hydratacji.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLines(read());
    setReady(true);

    // Druga karta tej samej przeglądarki ma widzieć ten sam koszyk
    const sync = (e: StorageEvent) => {
      if (e.key === CART_KEY) setLines(read());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const write = useCallback((next: CartLine[]) => {
    setLines(next);
    localStorage.setItem(CART_KEY, JSON.stringify(next));
  }, []);

  const add = useCallback(
    (id: string, qty = 1, stock = Infinity) => {
      if (stock <= 0) return;
      const current = read();
      const found = current.find((i) => i.id === id);
      const next = found
        ? current.map((i) => (i.id === id ? { ...i, qty: Math.min(i.qty + qty, stock) } : i))
        : [...current, { id, qty: Math.min(qty, stock) }];
      write(next);
      setOpen(true);
    },
    [write]
  );

  const setQty = useCallback(
    (id: string, qty: number, stock = Infinity) => {
      const next = read()
        .map((i) => (i.id === id ? { ...i, qty: Math.max(0, Math.min(qty, stock)) } : i))
        .filter((i) => i.qty > 0);
      write(next);
    },
    [write]
  );

  const remove = useCallback((id: string) => write(read().filter((i) => i.id !== id)), [write]);
  const clear = useCallback(() => write([]), [write]);

  const value = useMemo<CartContext>(
    () => ({
      lines,
      count: lines.reduce((sum, i) => sum + i.qty, 0),
      ready,
      add,
      setQty,
      remove,
      clear,
      open,
      setOpen,
    }),
    [lines, ready, add, setQty, remove, clear, open]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCart poza CartProvider');
  return ctx;
}
