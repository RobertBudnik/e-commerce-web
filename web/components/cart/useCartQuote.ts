'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cartMediaAction, quoteCartAction } from '@/app/actions/shop';
import { useCart } from './CartProvider';
import { toast } from '@/components/ui/ToastHost';
import { ile, odmien, POZYCJE, type Formy } from '@/lib/odmiana';
import type { CartLine, Quote } from '@/lib/types';

/* Orzeczenie idzie za podmiotem: „1 pozycja zniknęła", „5 pozycji zniknęło". */
const ZNIKNELY: Formy = ['zniknęła', 'zniknęły', 'zniknęło'];
const WYPADLY: Formy = ['wypadła', 'wypadły', 'wypadło'];

export type CartMedia = { id: string; icon: string; image: string | null; slug: string };

/**
 * Ostatni zestaw pozycji, który już posprzątaliśmy.
 *
 * Na stronie koszyka ten hook działa dwa razy naraz — raz w szufladzie
 * z layoutu, raz w treści strony. Bez wspólnego znacznika obie kopie
 * usuwałyby te same pozycje i pokazywały ten sam komunikat dwa razy.
 * Zmienna jest modułowa, więc obie kopie widzą ten sam zapis.
 */
let juzPosprzatane = '';

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
  /** Zestaw pozycji, dla którego policzona jest `quote`. Patrz efekt sprzątający. */
  const [quoteKey, setQuoteKey] = useState('');
  const { remove } = useCart();

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
      setQuoteKey('');
      return;
    }

    let cancelled = false;
    setPending(true);

    const timer = setTimeout(async () => {
      // Klucz zapamiętany przed wysyłką: wycena opisuje ten zestaw pozycji,
      // a nie ten, który mógł się zmienić w trakcie oczekiwania na odpowiedź.
      const klucz = latest.current.map((l) => `${l.id}:${l.qty}`).join(',');
      const result = await quoteCartAction(latest.current, coupon);
      if (cancelled) return;
      setQuote(result);
      setQuoteKey(klucz);
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

  /**
   * Sprzątanie pozycji, których baza już nie zna.
   *
   * Koszyk siedzi w `localStorage` i przeżywa wycofanie produktu ze sklepu.
   * Wcześniej taka pozycja znikała z listy po cichu (`if (!info) return null`),
   * ale nadal liczyła się do „3 szt." w nagłówku i do plakietki przy koszyku.
   * Wychodziło z tego zamówienie na zero złotych z aktywnym przyciskiem
   * „Zamawiam i płacę", a jedynym wyjściem było wyczyszczenie całego koszyka.
   *
   * Warunek `quoteKey === linesKey` jest tu konieczny: wycena bywa o krok
   * z tyłu za koszykiem i bez tego porównania świeżo dodany produkt wyglądałby
   * jak nieznany bazie — i wylatywałby zaraz po dodaniu.
   */
  useEffect(() => {
    if (!enabled || !quote || quoteKey !== linesKey) return;

    const znane = new Set(quote.lines.map((l) => l.id));
    const martwe = latest.current.filter((l) => !znane.has(l.id)).map((l) => l.id);
    if (!martwe.length) return;

    const znacznik = martwe.slice().sort().join(',');
    if (juzPosprzatane === znacznik) return;
    juzPosprzatane = znacznik;

    martwe.forEach(remove);
    toast(
      `${ile(martwe.length, POZYCJE)} ${odmien(martwe.length, ZNIKNELY)} ze sklepu i ${odmien(martwe.length, WYPADLY)} z koszyka.`
    );
  }, [quote, quoteKey, linesKey, enabled, remove]);

  return { quote, media, pending };
}
