'use client';

import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { ProductMedia } from './ProductMedia';
import { money, stars } from '@/lib/format';
import { OdometrCeny } from '@/components/ruch/OdometrCeny';
import { useCart } from '@/components/cart/CartProvider';
import { useWishlist } from './WishlistProvider';
import { openQuickView } from './QuickViewHost';
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
        <span className="card-cat">{categoryName}</span>
        <h3 className="card-title">
          <Link href={`/produkt/${product.slug}`}>{product.name}</Link>
        </h3>
        <span className="rating">
          <span className="stars" aria-hidden="true">
            {stars(product.rating)}
          </span>
          <span className="sr-only">Ocena {product.rating} na 5.</span> {product.reviews} opinii
        </span>
        <div className="price-row">
          <span className="price">
            <OdometrCeny cena={product.price} />
          </span>
          {product.oldPrice && <span className="price-old">{money(product.oldPrice)}</span>}
        </div>
        <div className="card-cta">
          <button
            className="btn btn-ghost btn-block"
            type="button"
            disabled={out}
            onClick={() => cart.add(product.id, 1, product.stock)}
          >
            {out ? 'Niedostępny' : 'Do koszyka'}
          </button>
        </div>
      </div>
    </article>
  );
}
