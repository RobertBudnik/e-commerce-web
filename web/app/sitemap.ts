import type { MetadataRoute } from 'next';
import { getCategories, getProductSlugs } from '@/lib/queries';
import { SLUGI_INFO } from '@/lib/strony-informacyjne';
import { siteUrl } from '@/lib/site';

/**
 * Mapa strony budowana z katalogu. Korzysta z klienta bez ciasteczek, bo
 * biegnie poza żądaniem użytkownika — i tak ma pokazywać to, co widzi gość.
 *
 * Trzy rodzaje adresów, świadomie w tej kolejności ważności:
 *
 *   1. stałe        strona główna, katalog, pomoc
 *   2. kategorie    `/sklep?kategoria=…` — to są strony, po których ludzie
 *                   trafiają z wyszukiwarki („kubki kamionkowe"), a nie po
 *                   nazwie sklepu. Bez nich mapa oddaje Google'owi wyłącznie
 *                   pojedyncze produkty i stronę główną.
 *   3. produkty     karty towaru
 *   4. dokumenty    regulamin, zwroty, prywatność — indeksowalne i często
 *                   wyszukiwane wprost („regulamin sklepu nazwa")
 *
 * `priority` nie jest obietnicą, tylko podpowiedzią względnej ważności
 * w obrębie tej jednej domeny. Google traktuje to luźno; sensu nie ma
 * wpisywanie wszędzie jedynki.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  // Równolegle: dwa niezależne zapytania, a mapa i tak czeka na oba.
  const [slugs, kategorie] = await Promise.all([getProductSlugs(), getCategories()]);

  const teraz = new Date();

  return [
    { url: base, lastModified: teraz, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/sklep`, lastModified: teraz, changeFrequency: 'daily', priority: 0.9 },

    ...kategorie.map((k) => ({
      url: `${base}/sklep?kategoria=${encodeURIComponent(k.id)}`,
      lastModified: teraz,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),

    ...slugs.map((slug) => ({
      url: `${base}/produkt/${slug}`,
      lastModified: teraz,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),

    { url: `${base}/pomoc`, changeFrequency: 'monthly', priority: 0.4 },

    ...SLUGI_INFO.map((slug) => ({
      url: `${base}/informacje/${slug}`,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    })),
  ];
}
