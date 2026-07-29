'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { useCart } from '@/components/cart/CartProvider';
import { useWishlist } from './WishlistProvider';
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
        <div className="qty">
          <button type="button" aria-label="Zmniejsz ilość" onClick={() => setQty((q) => Math.max(1, q - 1))}>
            −
          </button>
          <input
            type="number"
            value={qty}
            min={1}
            max={product.stock || 1}
            aria-label="Ilość"
            onChange={(e) => setQty(Math.max(1, Math.min(Number(e.target.value) || 1, product.stock || 1)))}
          />
          <button
            type="button"
            aria-label="Zwiększ ilość"
            onClick={() => setQty((q) => Math.min(q + 1, product.stock || 1))}
          >
            +
          </button>
        </div>
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
