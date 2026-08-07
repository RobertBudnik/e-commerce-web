'use client';

import { useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { ProductGrid } from './ProductGrid';
import { SortStack } from '@/components/ui/SortStack';
import type { Category, Product } from '@/lib/types';
import { ile, PRODUKTY } from '@/lib/odmiana';

const SORTERS: Record<string, (a: Product, b: Product) => number> = {
  popular: (a, b) => b.reviews - a.reviews,
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
  rating: (a, b) => b.rating - a.rating,
  name: (a, b) => a.name.localeCompare(b.name, 'pl'),
};

const SORT_OPTIONS = [
  { value: 'popular', label: 'Najpopularniejsze' },
  { value: 'price-asc', label: 'Cena rosnąco' },
  { value: 'price-desc', label: 'Cena malejąco' },
  { value: 'rating', label: 'Najwyżej oceniane' },
  { value: 'name', label: 'Nazwa A–Z' },
];

/**
 * Wyspa kliencka nad listą z serwera. Filtr działa na już pobranym katalogu —
 * przy większym asortymencie to przeniesie się do zapytania (Postgres FTS),
 * dziś ośmiu pozycji nie ma po co odpytywać ponownie.
 */
export function ShopBrowser({
  products,
  categories,
  initialCategory,
  initialSort,
  initialQuery,
}: {
  products: Product[];
  categories: Category[];
  initialCategory: string;
  initialSort: string;
  initialQuery: string;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState(initialSort);
  const [query, setQuery] = useState(initialQuery);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = products.filter(
      (p) =>
        (category === 'all' || p.category === category) &&
        (needle === '' ||
          p.name.toLowerCase().includes(needle) ||
          p.short.toLowerCase().includes(needle))
    );
    return [...list].sort(SORTERS[sort] ?? SORTERS.popular);
  }, [products, category, sort, query]);

  return (
    <>
      <div className="toolbar">
        <div className="chips">
          <button
            className="chip"
            type="button"
            aria-pressed={category === 'all'}
            onClick={() => setCategory('all')}
          >
            Wszystkie
          </button>
          {categories.map((c) => (
            <button
              className="chip"
              type="button"
              key={c.id}
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="shop-tools">
          <label className="sr-only" htmlFor="szukaj">
            Szukaj produktu
          </label>
          <div className="search">
            <Icon name="search" />
            <input
              id="szukaj"
              type="search"
              placeholder="Szukaj"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <SortStack
            label="Sortowanie"
            options={SORT_OPTIONS}
            value={sort}
            onChange={setSort}
          />
        </div>
      </div>

      <p className="muted num" style={{ marginBottom: 24 }}>
        {ile(visible.length, PRODUKTY)}
      </p>

      <ProductGrid products={visible} categories={categories} />
    </>
  );
}
