import 'server-only';

/**
 * Tryb sprzedaży. `catalog` to sklep z listą, `single` to landing pod jeden
 * produkt — ten sam kod, inna strona główna.
 *
 * Źródłem jest zmienna środowiskowa, ale `?mode=` w adresie ją nadpisuje.
 * Nadpisanie służy wyłącznie do podglądu: nie zapisuje się nigdzie i nie
 * zmienia tego, co widzą pozostali.
 */
export type StoreMode = 'single' | 'catalog';

const DOMYSLNY: StoreMode = 'catalog';

function czytaj(wartosc: string | undefined | null): StoreMode | null {
  return wartosc === 'single' || wartosc === 'catalog' ? wartosc : null;
}

/** Tryb z konfiguracji wdrożenia. */
export function storeModeZeSrodowiska(): StoreMode {
  return czytaj(process.env.NEXT_PUBLIC_STORE_MODE) ?? DOMYSLNY;
}

/**
 * Tryb dla konkretnego żądania — z uwzględnieniem podglądu przez `?mode=`.
 * Parametry przychodzą z `searchParams` strony.
 */
export function storeMode(params?: { mode?: string | string[] }): StoreMode {
  const surowy = Array.isArray(params?.mode) ? params?.mode[0] : params?.mode;
  return czytaj(surowy) ?? storeModeZeSrodowiska();
}

/**
 * Slug produktu wyróżnionego w trybie `single`. Pusty oznacza „weź pierwszy
 * z katalogu" — sklep bez tej zmiennej ma działać, a nie pokazywać pustkę.
 */
export function wyroznionyProdukt(): string | null {
  const slug = process.env.NEXT_PUBLIC_FEATURED_PRODUCT?.trim();
  return slug ? slug : null;
}
