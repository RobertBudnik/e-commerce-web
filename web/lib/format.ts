/** Formatowanie wspólne dla serwera i przeglądarki — bez zależności od DOM. */

const currency = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });

export const money = (value: number) => currency.format(value);

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
