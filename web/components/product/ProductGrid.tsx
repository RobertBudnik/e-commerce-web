'use client';

import { useRef } from 'react';
import { ProductCard } from './ProductCard';
import { useUjawnianie } from '@/lib/ujawnianie';
import { Tilt } from '@/components/ruch/Tilt';
import type { Category, Product } from '@/lib/types';

/** Kaskada wejścia: 70 × √index — początek wyraźny, ósmy kafelek nie każe czekać. */
const delayFor = (i: number) => Math.round(70 * Math.sqrt(Math.min(i, 11)));

/**
 * Siatka kafelków z ujawnianiem przy przewijaniu. Obserwator siedzi tutaj,
 * a nie w każdym kafelku — jeden na całą siatkę wystarczy.
 */
export function ProductGrid({
  products,
  categories,
  empty = 'Brak produktów spełniających kryteria.',
}: {
  products: Product[];
  categories: Category[];
  empty?: string;
}) {
  const grid = useRef<HTMLDivElement>(null);

  useUjawnianie(grid, products);

  if (!products.length) return <p className="muted">{empty}</p>;

  const nameOf = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="grid" ref={grid}>
      {products.map((product, i) => (
        <Tilt key={product.id}>
          <ProductCard
            product={product}
            categoryName={nameOf(product.category)}
            delay={delayFor(i)}
          />
        </Tilt>
      ))}
    </div>
  );
}
