'use client';

import { useEffect, useState } from 'react';
import { ProductGrid } from './ProductGrid';
import type { Category, Product } from '@/lib/types';

const RECENT_KEY = 'shop.recent.v1';
const RECENT_MAX = 8;

function read(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Historia oglądania: lista identyfikatorów w localStorage, najnowsze z przodu.
 * Świadomie tylko lokalnie — to podpowiedź nawigacyjna, nie dane konta,
 * a przy koncie musiałaby przejść przez RLS i osobną tabelę.
 *
 * `skipId` wypada z listy, żeby na własnej karcie nie pokazywać jej samej.
 */
export function RecentlyViewed({
  catalog,
  categories,
  skipId,
  track,
  className = 'section',
}: {
  catalog: Product[];
  categories: Category[];
  skipId?: string;
  track?: string;
  /** Strona główna trzyma treść w kontenerze, karta produktu już w nim jest. */
  className?: string;
}) {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    // Najpierw odczyt (bez bieżącej pozycji), potem zapis — inaczej karta
    // dopisałaby samą siebie, zanim zdąży pokazać poprzednie.
    setIds(read());

    if (track) {
      const next = [track, ...read().filter((id) => id !== track)].slice(0, RECENT_MAX);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    }
  }, [track]);

  const products = ids
    .filter((id) => id !== skipId)
    .map((id) => catalog.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p))
    .slice(0, 4);

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
