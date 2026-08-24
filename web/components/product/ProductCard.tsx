'use client';

import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { ProductMedia } from './ProductMedia';
import { money, stars } from '@/lib/format';
import { ile, OPINIE } from '@/lib/odmiana';
import { OdometrCeny } from '@/components/ruch/OdometrCeny';
import { PrzyciskDoKoszyka } from '@/components/ruch/PrzyciskDoKoszyka';
import { useCart } from '@/components/cart/CartProvider';
import { useWishlist } from './WishlistProvider';
import { openQuickView } from './QuickViewHost';
import { lotDoKoszyka } from '@/lib/lot-do-koszyka';
import { useRuchWylaczony } from '@/lib/ruch';
import type { Product } from '@/lib/types';

export function ProductCard({
  product,
  categoryName,
  delay = 0,
}: {
  product: Product;
  categoryName: string;
  delay?: number;
}) {
  const cart = useCart();
  const bezRuchu = useRuchWylaczony();
  const wish = useWishlist();
  const out = product.stock === 0;
  const saved = wish.has(product.id);

  return (
    <article className="card" data-reveal="" style={{ ['--reveal-delay' as string]: `${delay}ms` }}>
      <div className="card-media">
        <Link className="card-media-link" href={`/produkt/${product.slug}`} aria-label={product.name}>
          <ProductMedia product={product} sizes="(max-width: 700px) 46vw, 270px" />
        </Link>
        {product.badge && (
          <span className={`badge ${/^-/.test(product.badge) ? '' : 'badge-neutral'}`}>
            {product.badge}
          </span>
        )}
        <button
          className="wish-btn"
          type="button"
          aria-pressed={saved}
          title="Lista życzeń"
          aria-label="Dodaj do listy życzeń"
          onClick={() => wish.toggle(product.id)}
        >
          <Icon name="heart" />
        </button>
        <button className="card-quick" type="button" onClick={() => openQuickView(product)}>
          <Icon name="eye" /> Szybki podgląd
        </button>
      </div>
      <div className="card-body">
        {/* Kolejność z makiety: kategoria, nazwa w osobnym wierszu, ocena,
            a na dole cena i przycisk w jednym rzędzie. Poprzednia runda
            stawiała nazwę i cenę obok siebie — przy dłuższej nazwie cena
            uciekała na skraj kafla i przestawała się czytać jako para
            z przekreśloną ceną dawną. */}
        <span className="card-cat">{categoryName}</span>
        <h3 className="card-title">
          <Link href={`/produkt/${product.slug}`}>{product.name}</Link>
        </h3>
        <span className="rating">
          <span className="stars" aria-hidden="true">
            {stars(product.rating)}
          </span>
          <span className="sr-only">Ocena {product.rating} na 5.</span>{' '}
          {ile(product.reviews, OPINIE)}
        </span>
        <div className="card-stopka">
          {/* Cena bieżąca i dawna stoją obok siebie, bo to jedna informacja:
              ile kosztuje teraz i ile kosztowała. Rozdzielone na dwa wiersze
              przestawały być porównaniem. */}
          <span className="card-ceny">
            <span className="price">
              <OdometrCeny cena={product.price} />
            </span>
            {product.oldPrice && <span className="price-old">{money(product.oldPrice)}</span>}
          </span>
          <PrzyciskDoKoszyka
            ikona
            etykieta={out ? `${product.name} — niedostępny` : `Do koszyka: ${product.name}`}
            disabled={out}
            onAdd={(el) => {
              // Lot startuje z kadru zdjęcia, nie z przycisku: to zdjęcie jest
              // tym, co klient właśnie oglądał, i za nim powędruje wzrokiem.
              if (!bezRuchu) {
                lotDoKoszyka(el.closest('.card')?.querySelector('.card-media') ?? null);
              }
              cart.add(product.id, 1, product.stock);
            }}
          >
            {out ? 'Niedostępny' : 'Do koszyka'}
          </PrzyciskDoKoszyka>
        </div>
      </div>
    </article>
  );
}
