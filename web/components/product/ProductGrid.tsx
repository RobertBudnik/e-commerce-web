'use client';

import { useEffect, useRef } from 'react';
import { ProductCard } from './ProductCard';
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

  useEffect(() => {
    const root = grid.current;
    if (!root) return;

    const targets = root.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      targets.forEach((el) => el.classList.add('is-in'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          // Element wjeżdżający od góry pojawia się bez animacji — animowanie
          // go przy powrocie w górę wygląda jak usterka.
          if (entry.boundingClientRect.top < 0) entry.target.classList.add('is-instant');
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
    );

    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [products]);

  if (!products.length) return <p className="muted">{empty}</p>;

  const nameOf = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="grid" ref={grid}>
      {products.map((product, i) => (
        <ProductCard
          key={product.id}
          product={product}
          categoryName={nameOf(product.category)}
          delay={delayFor(i)}
        />
      ))}
    </div>
  );
}
