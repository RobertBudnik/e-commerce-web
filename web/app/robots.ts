import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/**
 * Konto, koszyk, panel i potwierdzenia zamówień nie mają czego szukać
 * w wynikach — to strony jednego użytkownika, nie treść sklepu. Magazyn jest
 * tu z tego samego powodu co panel: to zaplecze firmy, nie witryna.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/konto', '/panel', '/koszyk', '/zamowienie', '/logowanie'],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
