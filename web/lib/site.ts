/**
 * Adres publiczny sklepu. Na Vercelu `VERCEL_URL` jest ustawiane automatycznie
 * dla każdego wdrożenia (także podglądowego), więc sitemapa i metadane
 * pokazują właściwą domenę bez ręcznej zmiany przy każdym deployu.
 */
export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}
