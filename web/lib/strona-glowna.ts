import type { Product } from './types';

/**
 * Treść strony głównej, która nie mieszka w bazie.
 *
 * Katalog bywa pusty — na produkcji jest pusty dzisiaj — a strona główna nie
 * może wtedy pokazywać dziury po sekcji. Stąd dwa źródła: baza, gdy coś w niej
 * jest, i ta tablica, gdy nie ma nic.
 *
 * Podmiana danych to edycja tego pliku albo wpis w bazie. Trzeciego miejsca
 * nie ma i nie powinno być.
 */

// ---------------------------------------------------------------------------
// Kategorie
// ---------------------------------------------------------------------------

export type KafelekKategorii = {
  /** Trafia do `/sklep?kategoria=…`, więc musi zgadzać się z bazą. */
  id: string;
  nazwa: string;
  /** Jedno zdanie pod nazwą. Mówi, co w środku, a nie jak pięknie. */
  opis: string;
  /** Nazwa ikony z `components/Icon`. */
  ikona: string;
};

/**
 * Cztery kafelki. Liczba nie jest przypadkowa: przy czterech siatka układa się
 * w jeden rząd na szerokim ekranie i w dwa na tablecie, bez osieroconej piątej
 * pozycji w drugim rzędzie.
 *
 * Te wpisy są zapasem. Gdy w bazie pojawią się kategorie, strona bierze je
 * stamtąd — te zostają jako to, co widzi odwiedzający pusty jeszcze sklep.
 */
export const KATEGORIE_ZAPASOWE: readonly KafelekKategorii[] = [
  {
    id: 'ceramika',
    nazwa: 'Ceramika',
    opis: 'Kubki, misy i dzbanki toczone pojedynczo.',
    ikona: 'box',
  },
  {
    id: 'tekstylia',
    nazwa: 'Tekstylia',
    opis: 'Len tkany i prany, zanim trafi na stół.',
    ikona: 'heart',
  },
  {
    id: 'do-domu',
    nazwa: 'Do domu',
    opis: 'Dąb, korek i drobiazgi, które się nie psują.',
    ikona: 'grid',
  },
  {
    id: 'nowosci',
    nazwa: 'Nowości',
    opis: 'Ostatnia partia z pieca, zwykle krótka.',
    ikona: 'shield',
  },
];

// ---------------------------------------------------------------------------
// Produkty
// ---------------------------------------------------------------------------

/**
 * Przykładowe pozycje do oglądania siatki, gdy katalog jest pusty.
 *
 * **Nie pokazują się na produkcji.** Sklep, który wystawia wymyślony towar
 * z ceną, okłamuje kupującego — a tego nie naprawia się drobnym drukiem.
 * Wejście jest za flagą, tak samo jak przy brakach w tekstach informacyjnych
 * (`NEXT_PUBLIC_POKAZ_BRAKI`), więc lokalnie widać układ, a odwiedzający
 * widzi uczciwy komunikat.
 */
const PRZYKLADY: readonly Pick<Product, 'id' | 'slug' | 'name' | 'price' | 'short' | 'category'>[] =
  [
    { id: 'p-1', slug: 'kubek-popiolowy', name: 'Kubek popiołowy', price: 8900, short: 'Szkliwo z popiołu jesionowego, 300 ml.', category: 'ceramika' },
    { id: 'p-2', slug: 'misa-sniadaniowa', name: 'Misa śniadaniowa', price: 12900, short: 'Toczona na kole, brzeg lekko nierówny.', category: 'ceramika' },
    { id: 'p-3', slug: 'obrus-lniany', name: 'Obrus lniany', price: 24900, short: 'Len z Podlasia, prany cztery razy.', category: 'tekstylia' },
    { id: 'p-4', slug: 'deska-debowa', name: 'Deska dębowa', price: 16900, short: 'Olejowana, do chleba i do sera.', category: 'do-domu' },
    { id: 'p-5', slug: 'dzbanek-na-wode', name: 'Dzbanek na wodę', price: 19900, short: 'Litr z okładem, wygodne ucho.', category: 'ceramika' },
    { id: 'p-6', slug: 'serwetki-lniane', name: 'Serwetki lniane', price: 9900, short: 'Komplet czterech, mereżka ręczna.', category: 'tekstylia' },
    { id: 'p-7', slug: 'swiecznik-korkowy', name: 'Świecznik korkowy', price: 7900, short: 'Korek i mosiądz, stoi pewnie.', category: 'do-domu' },
    { id: 'p-8', slug: 'talerz-glebokie', name: 'Talerz głęboki', price: 11900, short: 'Na zupę i na makaron, 22 cm.', category: 'ceramika' },
  ];

/** Czy wolno pokazać przykłady. Domyślnie nie — patrz komentarz wyżej. */
export function przykladyWidoczne(): boolean {
  return process.env.NEXT_PUBLIC_POKAZ_PRZYKLADY === '1';
}

export type PozycjaWyboru = {
  id: string;
  slug: string;
  nazwa: string;
  cena: number;
  opis: string | null;
  /** `false` dla pozycji poglądowych — nie da się ich kupić i nie udajemy, że da. */
  zKatalogu: boolean;
};

/**
 * Jedna lista dla siatki, niezależnie od tego, skąd pochodzi.
 *
 * Kolejność: najpierw katalog (posortowany oceną), potem przykłady, potem
 * pustka. Komponent siatki nie musi wiedzieć, które z tych trzech zaszło.
 */
export function wybranePozycje(zBazy: Product[], ile = 8): PozycjaWyboru[] {
  if (zBazy.length > 0) {
    return [...zBazy]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, ile)
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        nazwa: p.name,
        cena: p.price,
        opis: p.short,
        zKatalogu: true,
      }));
  }

  if (!przykladyWidoczne()) return [];

  return PRZYKLADY.slice(0, ile).map((p) => ({
    id: p.id,
    slug: p.slug,
    nazwa: p.name,
    cena: p.price,
    opis: p.short,
    zKatalogu: false,
  }));
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

/**
 * Sekcja tekstowa w połowie strony. Nie jest ozdobą — mówi, czego sklep nie
 * robi, a to jedyna obietnica, której nie trzeba potem dotrzymywać terminem.
 */
export const MANIFEST = {
  nadtytul: 'Manifest',
  zdanie: 'Co ma być proste, jest proste.',
  akapit:
    'Nie dokładamy wzorów tam, gdzie wystarczy kształt, ani kolorów tam, gdzie wystarczy glina. Rzecz ma leżeć dobrze w dłoni, wytrzymać zmywarkę i nie prosić o uwagę, kiedy stoi na półce.',
  podpis: 'Ania i Marek, pracownia przy Józefa',
} as const;
