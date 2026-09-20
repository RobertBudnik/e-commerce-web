/** Formatowanie wspólne dla serwera i przeglądarki — bez zależności od DOM. */

const currency = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });

export const money = (value: number) => currency.format(value);

/**
 * Liczba ze znakiem, do ruchów magazynowych.
 *
 * JavaScript wypisuje liczbę ujemną z dywizem (`-1`), a to znak przenoszenia
 * wyrazu, nie minus. W kroju maszynowym jest wyraźnie krótszy i wyżej niż
 * plus, więc kolumna „+1 / −1" traciła pion. Makiety mają tam minus
 * typograficzny U+2212 i tego się trzymamy — ta sama szerokość co plus.
 */
export const zeZnakiem = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : `${n}`);

export const stars = (rating: number) =>
  '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));

/**
 * Daty i godziny — jedna strefa, jedno miejsce.
 *
 * `timeZone` jest tu **konieczne**, nie kosmetyczne. Panel i magazyn renderują
 * się na serwerze (`dynamic = 'force-dynamic'`), a serwer na Vercelu chodzi
 * w UTC. Bez tej opcji `Intl` bierze strefę procesu i kolejka pakowania
 * pokazywała właścicielowi godziny przesunięte o 1 h zimą i 2 h latem —
 * zamówienie z 11:02 stało w kolejce jako 09:02. Ten sam kod w przeglądarce
 * liczył poprawnie, więc lokalnie nie było tego widać.
 *
 * Sklep sprzedaje z Polski i wysyła z Polski; wszystkie te ekrany czyta
 * człowiek stojący przy regale, nie klient z innej strefy.
 */
const STREFA = 'Europe/Warsaw';

/** „14 lipca 2026" — potwierdzenia i historia zamówień u klienta. */
export const DATA_PELNA = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: STREFA,
});

/** „14 lip" — oś czasu w finansach, gdzie liczy się gęstość, nie precyzja. */
export const DZIEN = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'short',
  timeZone: STREFA,
});

/** „14 lip, 11:02" — listy zaplecza: zamówienia, wysyłki, dziennik, pulpit. */
export const DATA_GODZINA = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: STREFA,
});

/** „14 lipca, 11:02" — karta pojedynczego zamówienia, gdzie jest miejsce. */
export const DATA_GODZINA_PELNA = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: STREFA,
});

/** „11:02" — kolejka pakowania i stany, gdzie wszystko jest z dzisiaj. */
export const GODZINA = new Intl.DateTimeFormat('pl-PL', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: STREFA,
});

/** „14.07" — zwroty, gdzie data stoi w wąskiej kolumnie obok numeru. */
export const DATA_KROTKA = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: '2-digit',
  timeZone: STREFA,
});

export const formatDate = (iso: string) => DATA_PELNA.format(new Date(iso));

/** Nazwa → slug bez polskich znaków. Kolumna `products.slug` jest NOT NULL i unikalna. */
export const slugify = (name: string) =>
  String(name ?? '')
    .toLowerCase()
    .replace(/ą/g, 'a')
    .replace(/ć/g, 'c')
    .replace(/ę/g, 'e')
    .replace(/ł/g, 'l')
    .replace(/ń/g, 'n')
    .replace(/ó/g, 'o')
    .replace(/ś/g, 's')
    .replace(/[żź]/g, 'z')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'produkt';

/** Inicjały do awatara w nagłówku. */
export const initials = (name: string, email: string) => {
  const source = (name || email || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
};
