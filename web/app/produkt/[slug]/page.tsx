import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductMedia } from '@/components/product/ProductMedia';
import { ProductGrid } from '@/components/product/ProductGrid';
import { BuyBox } from '@/components/product/BuyBox';
import { BuyBar } from '@/components/product/BuyBar';
import { TrustBlock } from '@/components/product/TrustBlock';
import { RecentlyViewed } from '@/components/product/RecentlyViewed';
import { money, stars } from '@/lib/format';
import { getCategories, getProductBySlug, getProductSlugs, getRelatedProducts } from '@/lib/queries';

export const revalidate = 60;

/** Adresy produktów są znane z góry — Next wygeneruje je przy budowaniu. */
export async function generateStaticParams() {
  const slugs = await getProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: 'Produkt' };

  return {
    title: product.name,
    description: product.short,
    openGraph: {
      title: product.name,
      description: product.short,
      images: product.image ? [{ url: product.image }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  // Kategorie i podobne pozycje dopiero po znalezieniu produktu — nie ma sensu
  // ciągnąć ich dla adresu, który i tak skończy się na 404.
  const [categories, related] = await Promise.all([
    getCategories(),
    getRelatedProducts(product.category, product.id),
  ]);

  const categoryName = categories.find((c) => c.id === product.category)?.name ?? product.category;
  const out = product.stock === 0;

  // Rabat wyłącznie z danych. Cena odniesienia niższa albo równa bieżącej
  // nie jest promocją, tylko błędem w katalogu — wtedy nie pokazujemy nic.
  const rabat =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : null;

  return (
    <main className="container">
      <nav className="breadcrumbs" aria-label="Ścieżka nawigacji">
        <Link href="/">Start</Link>
        <span className="sep">/</span>
        <Link href="/sklep">Sklep</Link>
        <span className="sep">/</span>
        <span>{product.name}</span>
      </nav>

      <div className="product">
        <div className="product-media">
          <ProductMedia product={product} sizes="(max-width: 900px) 92vw, 560px" priority />
        </div>
        <div className="product-info">
          <span className="label">{categoryName}</span>
          <h1>{product.name}</h1>
          <p className="rating">
            <span className="stars" aria-hidden="true">
              {stars(product.rating)}
            </span>{' '}
            {product.rating}
            <span className="muted"> · {product.reviews} opinii</span>
          </p>
          <p className="lede">{product.short}</p>
          <div className="price-row">
            <span className="product-price num">{money(product.price)}</span>
            {rabat !== null && (
              <>
                <span className="price-old num">{money(product.oldPrice!)}</span>
                <span className="price-off num">−{rabat}%</span>
              </>
            )}
          </div>
          <p className={`stock${out ? ' out' : ''}`}>
            {out ? 'Chwilowo niedostępny' : `Dostępny — ${product.stock} szt. w magazynie`}
          </p>

          <BuyBox product={product} />
          <BuyBar product={product} />

          <TrustBlock />

          <h2 className="label spec-head">Specyfikacja</h2>
          <table className="specs">
            <tbody>
              {Object.entries(product.specs).map(([k, v]) => (
                <tr key={k}>
                  <th scope="row">{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <RecentlyViewed categories={categories} skipId={product.id} track={product.id} />

      {Boolean(related.length) && (
        <>
          <hr className="rule" />
          <section className="section">
            <div className="section-head">
              <div>
                <span className="label">Z tej samej kategorii</span>
                <h2>Podobne produkty</h2>
              </div>
              <Link className="arrow-link" href="/sklep">
                Wszystkie produkty
              </Link>
            </div>
            <ProductGrid products={related} categories={categories} />
          </section>
        </>
      )}
    </main>
  );
}
