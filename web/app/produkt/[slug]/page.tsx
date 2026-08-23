import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductGallery } from '@/components/product/ProductGallery';
import { ProductGrid } from '@/components/product/ProductGrid';
import { BuyBox } from '@/components/product/BuyBox';
import { BuyBar } from '@/components/product/BuyBar';
import { TrustBlock } from '@/components/product/TrustBlock';
import { RecentlyViewed } from '@/components/product/RecentlyViewed';
import { Opinie } from '@/components/product/Opinie';
import { money, stars } from '@/lib/format';
import { ile, OPINIE } from '@/lib/odmiana';
import {
  czyMogeOceniac,
  getCategories,
  getGaleriaProduktu,
  getOpinieProduktu,
  getProductBySlug,
  getProductSlugs,
  getRelatedProducts,
} from '@/lib/queries';

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
  // `generateMetadata` biegnie przed `notFound()`, więc tytuł karty ustala się
  // tutaj także dla adresu, który zaraz skończy się stroną 404. Bez tego
  // w pasku karty zostawało „Produkt" nad stroną mówiącą „Nie ma takiej strony".
  if (!product) return { title: 'Nie ma takiej strony', robots: { index: false, follow: false } };

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

  // Kategorie, podobne pozycje i galeria dopiero po znalezieniu produktu —
  // nie ma sensu ciągnąć ich dla adresu, który i tak skończy się na 404.
  const [categories, related, galeria, opinie, mogeOceniac] = await Promise.all([
    getCategories(),
    getRelatedProducts(product.category, product.id),
    getGaleriaProduktu(product.id, product.name),
    getOpinieProduktu(product.id),
    czyMogeOceniac(product.id),
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
        <ProductGallery product={product} galeria={galeria} />
        <div className="product-info">
          <span className="label">{categoryName}</span>
          <h1>{product.name}</h1>
          <p className="rating">
            <span className="stars" aria-hidden="true">
              {stars(product.rating)}
            </span>{' '}
            {product.rating}
            <span className="muted"> · {ile(product.reviews, OPINIE)}</span>
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

      <hr className="rule" />

      <Opinie
        produktId={product.id}
        slug={product.slug}
        opinie={opinie}
        mogeOceniac={mogeOceniac}
      />

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
