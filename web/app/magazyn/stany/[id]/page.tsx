import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { KorektaStanu } from '@/components/magazyn/KorektaStanu';
import { wymagajZaplecza } from '@/lib/panel-dostep';
import { getProduktPoId } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'Korekta stanu',
};

export const dynamic = 'force-dynamic';

export default async function Korekta({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ szukaj?: string; segment?: string }>;
}) {
  const { id } = await params;
  await wymagajZaplecza(`/magazyn/stany/${id}`);

  const produkt = await getProduktPoId(id);
  if (!produkt) notFound();

  // Powrót zabiera ze sobą filtr i frazę, więc wraca do tej samej listy,
  // z której magazynier wszedł, a nie na jej początek.
  const { szukaj, segment } = await searchParams;
  const p = new URLSearchParams();
  if (szukaj) p.set('szukaj', szukaj);
  if (segment) p.set('segment', segment);
  const powrot = p.toString() ? `/magazyn/stany?${p}` : '/magazyn/stany';

  return (
    <main className="mag">
      <Link className="mag-powrot" href={powrot}>
        Magazyn
      </Link>

      <header className="mag-top mag-top-kolumna">
        <h1 style={{ fontSize: 26 }}>{produkt.name}</h1>
        <p className="mag-podtytul">
          {[produkt.sku ?? produkt.barcode, produkt.category].filter(Boolean).join(' · ')}
        </p>
      </header>

      <div style={{ marginTop: 14 }}>
        <KorektaStanu
          produktId={produkt.id}
          stanZBazy={produkt.stock}
          progNiski={produkt.progNiski}
        />
      </div>
    </main>
  );
}
