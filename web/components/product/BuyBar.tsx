'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/components/cart/CartProvider';
import { money } from '@/lib/format';
import type { Product } from '@/lib/types';

/**
 * Pasek zakupu przyklejony na dole karty produktu. Pokazuje się dopiero,
 * gdy właściwy przycisk zjedzie za ekran — wcześniej byłby dublem.
 */
export function BuyBar({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const cart = useCart();
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (product.stock === 0) return;

    const anchor = sentinel.current;
    if (!anchor) return;

    const io = new IntersectionObserver(
      ([entry]) => setOpen(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 }
    );

    io.observe(anchor);
    return () => io.disconnect();
  }, [product.stock]);

  if (product.stock === 0) return <div ref={sentinel} />;

  return (
    <>
      {/* Punkt odniesienia siedzi tuż pod przyciskiem zakupu */}
      <div ref={sentinel} />
      <div className={`buy-bar${open ? ' is-open' : ''}`}>
        <div className="container buy-bar-inner">
          <div className="buy-bar-info">
            <div className="buy-bar-name">{product.name}</div>
            <div className="buy-bar-price num">{money(product.price)}</div>
          </div>
          <button className="btn" type="button" onClick={() => cart.add(product.id, 1, product.stock)}>
            Do koszyka
          </button>
        </div>
      </div>
    </>
  );
}
