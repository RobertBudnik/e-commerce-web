'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart } from './CartProvider';

/** Ikona koszyka w nagłówku: otwiera szufladę i skacze przy zmianie liczby. */
export function CartButton() {
  const { count, setOpen, ready } = useCart();
  const [bump, setBump] = useState(false);
  const previous = useRef(count);

  useEffect(() => {
    if (!ready) return;
    if (count > previous.current) {
      setBump(false);
      // Restart animacji: klasa musi zniknąć na klatkę, inaczej nie zagra drugi raz
      requestAnimationFrame(() => requestAnimationFrame(() => setBump(true)));
    }
    previous.current = count;
  }, [count, ready]);

  return (
    <button className="btn btn-ghost btn-sm cart-btn" type="button" onClick={() => setOpen(true)}>
      Koszyk
      <span
        className={`cart-count${bump ? ' is-bump' : ''}`}
        hidden={count === 0}
        onAnimationEnd={() => setBump(false)}
      >
        {count}
      </span>
    </button>
  );
}
