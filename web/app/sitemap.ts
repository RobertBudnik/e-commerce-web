import type { MetadataRoute } from 'next';
import { getProductSlugs } from '@/lib/queries';
import { siteUrl } from '@/lib/site';

/**
 * Mapa strony budowana z katalogu. Korzysta z klienta bez ciasteczek, bo
 * biegnie poza żądaniem użytkownika — i tak ma pokazywać to, co widzi gość.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const slugs = await getProductSlugs();

  return [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/sklep`, changeFrequency: 'daily', priority: 0.9 },
    ...slugs.map((slug) => ({
      url: `${base}/produkt/${slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
