'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { ProductGrid } from './ProductGrid';
import { SortStack } from '@/components/ui/SortStack';
import { PlamaWyboru } from '@/components/ruch/PlamaWyboru';
import type { Category, Product } from '@/lib/types';
import { ile, PRODUKTY } from '@/lib/odmiana';

const SORT_OPTIONS = [
  { value: 'popular', label: 'Najpopularniejsze' },
  { value: 'price-asc', label: 'Cena rosnąco' },
  { value: 'price-desc', label: 'Cena malejąco' },
  { value: 'rating', label: 'Najwyżej oceniane' },
  { value: 'name', label: 'Nazwa A–Z' },
];

/**
 * Pasek narzędzi nad siatką katalogu.
 *
 * Filtr, sortowanie i szukanie idą teraz do bazy, nie do pamięci przeglądarki.
 * Wcześniej strona wysyłała cały katalog i przesiewała go u klienta — przy
 * ośmiu produktach tańsze niż zapytanie na każdą zmianę, przy stu oznacza sto
 * rekordów po to, żeby pokazać dwanaście.
 *
 * Stan siedzi w adresie, nie w komponencie. Dzięki temu wynik szukania da się
 * wysłać linkiem, przycisk „wstecz" wraca do poprzedniego filtra, a odświeżenie
 * strony niczego nie gubi.
 *
 * Pole tekstowe jest jedynym miejscem z odbiciem: każda litera to inaczej jedno
 * wejście do bazy i jeden wpis w historii przeglądarki.
 */
export function ShopBrowser({
  products,
  categories,
  kategoria,
  sort,
  szukaj,
  ileWszystkich,
  strona,
  stron,
}: {
  products: Product[];
  categories: Category[];
  kategoria: string;
  sort: string;
  szukaj: string;
  ileWszystkich: number;
  strona: number;
  stron: number;
}) {
  const router = useRouter();
  const sciezka = usePathname();
  const [oczekuje, start] = useTransition();

  // Wpisywana fraza żyje lokalnie, żeby pole nie czekało na odpowiedź serwera
  // przy każdej literze; do adresu trafia po odbiciu.
  const [fraza, setFraza] = useState(szukaj);
  const pierwszeWejscie = useRef(true);

  function przejdz(zmiany: Record<string, string | number | null>) {
    const params = new URLSearchParams();
    const nastepne = { kategoria, sort, szukaj, strona, ...zmiany };

    if (nastepne.kategoria && nastepne.kategoria !== 'all') params.set('kategoria', String(nastepne.kategoria));
    if (nastepne.sort && nastepne.sort !== 'popular') params.set('sort', String(nastepne.sort));
    if (nastepne.szukaj) params.set('szukaj', String(nastepne.szukaj));
    if (Number(nastepne.strona) > 1) params.set('strona', String(nastepne.strona));

    const query = params.toString();
    start(() => router.push(query ? `${sciezka}?${query}` : sciezka, { scroll: false }));
  }

  // Odbicie na frazie. Zmiana filtra albo strony przez adres nie ma tu nic do
  // roboty — stąd pominięcie pierwszego przebiegu.
  useEffect(() => {
    if (pierwszeWejscie.current) {
      pierwszeWejscie.current = false;
      return;
    }
    if (fraza === szukaj) return;

    const timer = setTimeout(() => przejdz({ szukaj: fraza, strona: 1 }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fraza]);

  // Adres bywa zmieniony poza tym komponentem — przyciskiem „wstecz" albo
  // linkiem. Wtedy pole ma pokazać to, co faktycznie jest w adresie.
  useEffect(() => {
    setFraza(szukaj);
  }, [szukaj]);

  return (
    <>
      <div className="toolbar">
        <div className="chips">
          <button
            className="chip"
            type="button"
            aria-pressed={kategoria === 'all'}
            onClick={() => przejdz({ kategoria: 'all', strona: 1 })}
          >
            {kategoria === 'all' && <PlamaWyboru layoutId="chip-tlo" className="chip-tlo" />}
            <span className="chip-tekst">Wszystkie</span>
          </button>
          {categories.map((c) => (
            <button
              className="chip"
              type="button"
              key={c.id}
              aria-pressed={kategoria === c.id}
              onClick={() => przejdz({ kategoria: c.id, strona: 1 })}
            >
              {kategoria === c.id && <PlamaWyboru layoutId="chip-tlo" className="chip-tlo" />}
              <span className="chip-tekst">{c.name}</span>
            </button>
          ))}
        </div>

        <div className="shop-tools">
          <label className="sr-only" htmlFor="szukaj">
            Szukaj produktu
          </label>
          <div className="search">
            <Icon name="search" />
            <input
              id="szukaj"
              type="search"
              placeholder="Szukaj"
              value={fraza}
              onChange={(e) => setFraza(e.target.value)}
            />
          </div>
          <SortStack
            label="Sortowanie"
            options={SORT_OPTIONS}
            value={sort}
            onChange={(wartosc) => przejdz({ sort: wartosc, strona: 1 })}
          />
        </div>
      </div>

      <p className="muted num" style={{ marginBottom: 24 }} aria-live="polite">
        {ile(ileWszystkich, PRODUKTY)}
        {stron > 1 && ` · strona ${strona} z ${stron}`}
      </p>

      <div data-oczekuje={oczekuje ? '' : undefined} className="katalog-siatka">
        <ProductGrid products={products} categories={categories} />
      </div>

      {stron > 1 && (
        <nav className="stronicowanie" aria-label="Strony katalogu">
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            disabled={strona <= 1}
            onClick={() => przejdz({ strona: strona - 1 })}
          >
            Poprzednia
          </button>
          <span className="muted num">
            {strona} / {stron}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            disabled={strona >= stron}
            onClick={() => przejdz({ strona: strona + 1 })}
          >
            Następna
          </button>
        </nav>
      )}
    </>
  );
}
