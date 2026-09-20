import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ShopBrowser } from '@/components/product/ShopBrowser';
import { getCategories, getStronaKatalogu } from '@/lib/queries';
import { storeMode } from '@/lib/store-mode';
import { siteUrl } from '@/lib/site';
import { MARKA } from '@/lib/dane-sklepu';

/**
 * Adres kanoniczny liczony z kategorii, a nie stały.
 *
 * Filtr kategorii **zmienia treść** listy, więc `/sklep?kategoria=ceramika`
 * zasługuje na własny adres w indeksie i sam jest swoim kanonicznym.
 * Sortowanie, szukanie i numer strony pokazują **tę samą ofertę w innej
 * kolejności albo porcji** — to jest duplikat i te adresy wskazują na wersję
 * bez parametrów. Ucięcie wszystkiego jak leci wyrzuciłoby z indeksu strony
 * kategorii, czyli dokładnie te, po których ktoś szuka „kubki kamionkowe".
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ kategoria?: string }>;
}): Promise<Metadata> {
  const { kategoria } = await searchParams;
  const baza = siteUrl();
  const kanoniczny =
    kategoria && kategoria !== 'all'
      ? `${baza}/sklep?kategoria=${encodeURIComponent(kategoria)}`
      : `${baza}/sklep`;

  return {
    title: 'Sklep',
    description: `Wszystkie produkty w sklepie ${MARKA.nazwa} — filtruj po kategorii, sortuj po cenie i ocenie.`,
    alternates: { canonical: kanoniczny },
  };
}

/**
 * Lista renderuje się na serwerze: robot i czytelnik dostają gotowy HTML
 * z produktami, a nie pustą siatkę do wypełnienia przez JavaScript.
 *
 * Filtr, sortowanie, szukanie i strona jadą w adresie i trafiają do zapytania,
 * a nie do pamięci przeglądarki. Dlatego strona nie może być rewalidowana co
 * minutę jak dawniej — każdy zestaw parametrów to inny wynik, a stronicowany
 * katalog ma pokazywać stan magazynu, nie sprzed minuty.
 */
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{
    kategoria?: string;
    sort?: string;
    szukaj?: string;
    strona?: string;
    mode?: string;
  }>;
}) {
  const params = await searchParams;

  // W trybie jednoproduktowym lista nie ma czego pokazywać — cała sprzedaż
  // dzieje się na stronie głównej.
  if (storeMode(params) === 'single') redirect('/');

  const kategoria = params.kategoria ?? 'all';
  const sort = params.sort ?? 'popular';
  const szukaj = params.szukaj ?? '';
  const strona = Number.parseInt(params.strona ?? '1', 10) || 1;

  const [katalog, categories] = await Promise.all([
    getStronaKatalogu({ kategoria, sort, szukaj, strona }),
    getCategories(),
  ]);

  return (
    <main className="container section">
      <div className="section-head">
        <div>
          <span className="label">Katalog</span>
          <h1>Sklep</h1>
        </div>
      </div>

      <ShopBrowser
        products={katalog.produkty}
        categories={categories}
        kategoria={kategoria}
        sort={sort}
        szukaj={szukaj}
        ileWszystkich={katalog.ile}
        strona={katalog.strona}
        stron={katalog.stron}
      />
    </main>
  );
}
