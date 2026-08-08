'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ProductMedia } from './ProductMedia';
import type { ZdjecieGalerii } from '@/lib/queries';
import type { Product } from '@/lib/types';

/**
 * Kolumna ze zdjęciami na karcie produktu.
 *
 * Komponent trzyma całą kolumnę, nie samo zdjęcie: `.product-media` jest
 * kwadratem o stałych proporcjach, więc pasek miniatur musi stać pod nim,
 * a nie w środku.
 *
 * Okładka jest pierwszym kadrem, dodatkowe ujęcia idą za nią. Przy produkcie
 * bez galerii wychodzi dokładnie to, co było wcześniej — jedno zdjęcie albo
 * ikona zastępcza — więc katalog bez zdjęć nie zyskuje pustego paska miniatur.
 *
 * Miniatury to przyciski, nie lista wyboru: `aria-pressed` działa na
 * przycisku, `aria-selected` nie, a `role="listbox"` znaczyłby obsługę
 * strzałek, Home/End i Escape dla czegoś, co jest przełącznikiem kadru.
 */
export function ProductGallery({
  product,
  galeria,
}: {
  product: Product;
  galeria: ZdjecieGalerii[];
}) {
  // Okładka na przodzie; bez niej galeria zaczyna się od pierwszego ujęcia.
  const kadry: ZdjecieGalerii[] = product.image
    ? [{ url: product.image, alt: product.name }, ...galeria]
    : galeria;

  const [aktywny, setAktywny] = useState(0);

  // Zero kadrów: produkt bez okładki i bez galerii dostaje ikonę zastępczą.
  // Warunek celowo sprawdza pustkę, nie „mniej niż dwa": przy produkcie bez
  // okładki, ale z jednym ujęciem w galerii, wcześniejsza wersja spadała tutaj
  // i pokazywała ikonę, gubiąc zdjęcie, które w bazie leżało.
  if (kadry.length === 0) {
    return (
      <div className="product-media">
        <ProductMedia product={product} sizes="(max-width: 900px) 92vw, 560px" priority />
      </div>
    );
  }

  const kadr = kadry[Math.min(aktywny, kadry.length - 1)];

  return (
    <div className="product-galeria">
      <div className="product-media">
        <Image
          // Klucz na adresie: bez niego React podmienia sam atrybut w tym samym
          // elemencie i wejście `media-in` nie ma czego animować przy zmianie
          // kadru — zdjęcie przeskakiwałoby bez przejścia.
          key={kadr.url}
          className="media-img"
          src={kadr.url}
          alt={kadr.alt}
          fill
          sizes="(max-width: 900px) 92vw, 560px"
          priority
        />
      </div>

      {/* Pasek miniatur ma sens dopiero przy drugim ujęciu — przy jednym
          byłby przyciskiem, który nic nie przełącza. */}
      {kadry.length > 1 && (
      <div className="galeria-miniatury" role="group" aria-label={`Zdjęcia — ${product.name}`}>
        {kadry.map((z, i) => (
          <button
            key={z.url}
            type="button"
            className="galeria-miniatura"
            aria-pressed={i === aktywny}
            aria-label={`Ujęcie ${i + 1} z ${kadry.length}`}
            onClick={() => setAktywny(i)}
          >
            <Image src={z.url} alt="" fill sizes="80px" />
          </button>
        ))}
      </div>
      )}
    </div>
  );
}
