'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
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
    <button
      className="btn btn-ghost btn-sm cart-btn"
      type="button"
      onClick={() => setOpen(true)}
      /* Na wąskim ekranie napis chowa CSS, a plakietka znika przy zerze —
         bez tej etykiety zostawał przycisk bez żadnej nazwy, czytany przez
         VoiceOver jako „przycisk". Napis „Koszyk" jest tu pierwszym słowem,
         więc sterowanie głosem po widocznym tekście dalej trafia w cel. */
      aria-label={ready && count > 0 ? `Koszyk, ${count} szt.` : 'Koszyk'}
    >
      <Icon className="cart-btn-ikona" name="cart" />
      <span className="cart-btn-tekst">Koszyk</span>
      <span
        className={`cart-count${bump ? ' is-bump' : ''}`}
        hidden={count === 0}
        onAnimationEnd={() => setBump(false)}
        aria-hidden="true"
      >
        {count}
      </span>
    </button>
  );
}
