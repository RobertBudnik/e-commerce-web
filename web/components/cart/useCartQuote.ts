'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cartMediaAction, quoteCartAction } from '@/app/actions/shop';
import type { CartLine, Quote } from '@/lib/types';

export type CartMedia = { id: string; icon: string; image: string | null; slug: string };

/**
 * Wycena koszyka i miniatury pozycji — wspólne dla szuflady i strony koszyka.
 *
 * Dwie rzeczy, których wcześniej brakowało w obu miejscach z osobna:
 *
 * 1. Odbicie (debounce). Klikanie „+" trzy razy pod rząd wysyłało trzy
 *    zapytania o wycenę; teraz leci jedno, po ustaniu klikania.
 * 2. Miniatury pobierane tylko przy zmianie *zestawu* produktów. Zmiana
 *    samej ilości nie zmienia grafiki, więc nie ma po co jej ciągnąć.
 */
export function useCartQuote(lines: CartLine[], coupon: string | null, enabled = true) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [media, setMedia] = useState<Map<string, CartMedia>>(new Map());
  const [pending, setPending] = useState(false);

  // Klucze zamiast tablic: efekt ma reagować na treść, nie na referencję
  const linesKey = useMemo(
    () => lines.map((l) => `${l.id}:${l.qty}`).join(','),
    [lines]
  );
  const idsKey = useMemo(() => lines.map((l) => l.id).sort().join(','), [lines]);

  const latest = useRef(lines);
  latest.current = lines;

  useEffect(() => {
    if (!enabled) return;
    if (!lines.length) {
      setQuote(null);
      return;
    }

    let cancelled = false;
    setPending(true);

    const timer = setTimeout(async () => {
      const result = await quoteCartAction(latest.current, coupon);
      if (cancelled) return;
      setQuote(result);
      setPending(false);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, coupon, enabled]);

  useEffect(() => {
    if (!enabled || !idsKey) return;

    let cancelled = false;
    cartMediaAction(idsKey.split(',')).then((rows) => {
      if (!cancelled) setMedia(new Map(rows.map((row) => [row.id, row])));
    });

    return () => {
      cancelled = true;
    };
  }, [idsKey, enabled]);

  return { quote, media, pending };
}
