'use client';

import { useEffect, useState } from 'react';
import { ProductGrid } from './ProductGrid';
import { productsByIdsAction } from '@/app/actions/shop';
import type { Category, Product } from '@/lib/types';

const RECENT_KEY = 'shop.recent.v1';
const RECENT_MAX = 8;

function read(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(list) ? list.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Historia oglądania: lista identyfikatorów w localStorage, najnowsze z przodu.
 * Świadomie tylko lokalnie — to podpowiedź nawigacyjna, nie dane konta.
 *
 * Same produkty dociąga serwer po identyfikatorach. Strona nie musi więc
 * wysyłać całego katalogu do przeglądarki tylko po to, żeby wybrać z niego
 * cztery pozycje.
 */
export function RecentlyViewed({
  categories,
  skipId,
  track,
  className = 'section',
}: {
  categories: Category[];
  /** Bieżący produkt wypada z listy — na własnej karcie nie pokazujemy jej samej. */
  skipId?: string;
  /** Identyfikator do dopisania do historii (karta produktu). */
  track?: string;
  /** Strona główna trzyma treść w kontenerze, karta produktu już w nim jest. */
  className?: string;
}) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    // Najpierw odczyt (bez bieżącej pozycji), potem zapis — inaczej karta
    // dopisałaby samą siebie, zanim zdąży pokazać poprzednie.
    const history = read();

    if (track) {
      const next = [track, ...history.filter((id) => id !== track)].slice(0, RECENT_MAX);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    }

    const wanted = history.filter((id) => id !== skipId).slice(0, 4);
    if (!wanted.length) {
      setProducts([]);
      return;
    }

    let cancelled = false;
    productsByIdsAction(wanted).then((rows) => {
      if (!cancelled) setProducts(rows);
    });

    return () => {
      cancelled = true;
    };
  }, [track, skipId]);

  if (!products.length) return null;

  return (
    <section className={className}>
      <div className="section-head">
        <div>
          <span className="label">Twoja historia</span>
          <h2>Ostatnio oglądane</h2>
        </div>
      </div>
      <ProductGrid products={products} categories={categories} />
    </section>
  );
}
