/** Formatowanie wspólne dla serwera i przeglądarki — bez zależności od DOM. */

const currency = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });

export const money = (value: number) => currency.format(value);

/**
 * Liczba ze znakiem, do ruchów magazynowych.
 *
 * JavaScript wypisuje liczbę ujemną z dywizem (`-1`), a to znak przenoszenia
 * wyrazu, nie minus. W kroju maszynowym jest wyraźnie krótszy i wyżej niż
 * plus, więc kolumna „+1 / −1" traciła pion. Makiety mają tam minus
 * typograficzny U+2212 i tego się trzymamy — ta sama szerokość co plus.
 */
export const zeZnakiem = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : `${n}`);

export const stars = (rating: number) =>
  '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

/** Nazwa → slug bez polskich znaków. Kolumna `products.slug` jest NOT NULL i unikalna. */
export const slugify = (name: string) =>
  String(name ?? '')
    .toLowerCase()
    .replace(/ą/g, 'a')
    .replace(/ć/g, 'c')
    .replace(/ę/g, 'e')
    .replace(/ł/g, 'l')
    .replace(/ń/g, 'n')
    .replace(/ó/g, 'o')
    .replace(/ś/g, 's')
    .replace(/[żź]/g, 'z')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'produkt';

/** Inicjały do awatara w nagłówku. */
export const initials = (name: string, email: string) => {
  const source = (name || email || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
};
