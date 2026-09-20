'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { ProductMedia } from './ProductMedia';
import { money, stars } from '@/lib/format';
import { ile, OPINIE } from '@/lib/odmiana';
import { useCart } from '@/components/cart/CartProvider';
import { useOknoModalne } from '@/lib/okno-modalne';
import { useWishlist } from './WishlistProvider';
import type { Product } from '@/lib/types';

/** Nazwa zdarzenia. Bez marki — szyld sklepu bywa zmieniany, kanał nie. */
const ZDARZENIE = 'sklep:quickview';

/** Otwiera podgląd z dowolnego miejsca — kafelka, wyników szukania, listy życzeń. */
export function openQuickView(product: Product) {
  window.dispatchEvent(new CustomEvent(ZDARZENIE, { detail: product }));
}

/**
 * Karta produktu bez opuszczania listy. Zamykanie: Escape i klik w tło,
 * ostrość wraca na element, z którego podgląd otwarto.
 */
export function QuickViewHost() {
  const [product, setProduct] = useState<Product | null>(null);
  const [visible, setVisible] = useState(false);
  const [qty, setQty] = useState(1);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const cart = useCart();
  const wish = useWishlist();

  useEffect(() => {
    const onOpen = (e: Event) => {
      setProduct((e as CustomEvent<Product>).detail);
      setQty(1);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    };

    window.addEventListener(ZDARZENIE, onOpen);
    return () => window.removeEventListener(ZDARZENIE, onOpen);
  }, []);

  // Okno żyje przez cały czas wyjścia, więc hak pilnuje `product`, nie
  // `visible`: przy `visible` fokus wróciłby na wyzwalacz, zanim panel zdąży
  // zjechać, a strona odblokowałaby przewijanie w połowie animacji.
  useOknoModalne({
    otwarte: product !== null,
    panel,
    zamknij: close,
    pierwszyCel: '.icon-close',
  });

  function close() {
    setVisible(false);
    setTimeout(() => setProduct(null), 280);
  }

  if (!product) return null;
  const out = product.stock === 0;

  return (
    <>
      <div className={`overlay${visible ? ' is-open' : ''}`} onClick={close} />
      <div
        className={`quick${visible ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-title"
        onClick={(e) => e.target === e.currentTarget && close()}
      >
        <div className="quick-panel" ref={panel}>
          <button
            className="icon-close quick-close"
            type="button"
            aria-label="Zamknij podgląd"
            onClick={close}
            ref={closeBtn}
          >
            <Icon name="close" />
          </button>
          <div className="quick-grid">
            <div className="quick-media">
              <ProductMedia product={product} sizes="(max-width: 700px) 92vw, 280px" priority />
            </div>
            <div>
              <span className="label">{product.category}</span>
              <h2 id="quick-title">{product.name}</h2>
              <p className="rating">
                <span className="stars" aria-hidden="true">
                  {stars(product.rating)}
                </span>{' '}
                {ile(product.reviews, OPINIE)}
              </p>
              <p className="lede" style={{ marginTop: 12 }}>
                {product.short}
              </p>
              <div className="price-row">
                <span className="product-price">{money(product.price)}</span>
                {product.oldPrice && <span className="price-old">{money(product.oldPrice)}</span>}
              </div>
              <p className={`stock${out ? ' out' : ''}`}>
                {out ? 'Chwilowo niedostępny' : `Dostępny — ${product.stock} szt.`}
              </p>
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
                    onChange={(e) =>
                      setQty(Math.max(1, Math.min(Number(e.target.value) || 1, product.stock || 1)))
                    }
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
                  onClick={() => {
                    cart.add(product.id, qty, product.stock);
                    close();
                  }}
                >
                  {out ? 'Niedostępny' : 'Do koszyka'}
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  aria-pressed={wish.has(product.id)}
                  onClick={() => wish.toggle(product.id)}
                >
                  <Icon name="heart" /> Zapisz
                </button>
              </div>
              <p>
                <Link className="arrow-link" href={`/produkt/${product.slug}`} onClick={close}>
                  Pełna karta produktu
                </Link>
              </p>
              <table className="specs">
                <tbody>
                  {Object.entries(product.specs)
                    .slice(0, 4)
                    .map(([k, v]) => (
                      <tr key={k}>
                        <th scope="row">{k}</th>
                        <td>{v}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
