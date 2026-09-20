'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { useCart } from '@/components/cart/CartProvider';
import { useWishlist } from './WishlistProvider';
import { Ilosc } from '@/components/ui/Ilosc';
import type { Product } from '@/lib/types';

/** Ilość, dodanie do koszyka i lista życzeń — jedyny interaktywny kawałek karty. */
export function BuyBox({ product }: { product: Product }) {
  const [qty, setQty] = useState(1);
  const cart = useCart();
  const wish = useWishlist();
  const out = product.stock === 0;

  return (
    <>
      <div className="buy-row">
        <Ilosc
          wartosc={qty}
          stan={product.stock}
          onKrok={(d) => setQty((q) => Math.max(1, Math.min(q + d, product.stock || 1)))}
          onWpis={(n) => setQty(Math.max(1, Math.min(n || 1, product.stock || 1)))}
        />
        <button
          className="btn"
          type="button"
          disabled={out}
          onClick={() => cart.add(product.id, qty, product.stock)}
        >
          {out ? 'Niedostępny' : 'Dodaj do koszyka'}
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          aria-pressed={wish.has(product.id)}
          onClick={() => wish.toggle(product.id)}
        >
          <Icon name="heart" /> Do listy życzeń
        </button>
      </div>
      <p>
        <Link className="arrow-link" href="/koszyk">
          Przejdź do koszyka
        </Link>
      </p>
    </>
  );
}
