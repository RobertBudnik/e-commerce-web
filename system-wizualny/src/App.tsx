import { BelkaPanelu, NawigacjaSklepu } from './components/nawigacja';
import { KartaProduktu, Prezentacja, cena } from './components/karty';
import type { Produkt } from './components/karty';
import { Badge, Button, Kafle, Naglowek, Sekcja, Stat, Tabela } from './components/podstawy';
import type { Kolumna, Odcien } from './components/podstawy';
import { Tokeny } from './components/tokeny';

/* ---------------------------------------------------------------------------
   Dane pokazowe. Ekrany składają się z nich w pętli, więc dołożenie stanu
   zamówienia albo produktu to jedna linijka danych, nie kolejny blok JSX-a.
   --------------------------------------------------------------------------- */

const PRODUKTY: Produkt[] = [
  {
    id: 'aura',
    nazwa: 'Słuchawki Aura X',
    kategoria: 'Audio',
    cena: cena(64900),
    dostepny: true,
    znacznik: { tekst: 'Nowość', odcien: 'solid' },
  },
  {
    id: 'vision',
    nazwa: 'Monitor Vision 27 4K',
    kategoria: 'Komputery',
    cena: cena(179900),
    cenaPrzed: cena(219900),
    dostepny: true,
    znacznik: { tekst: '−19%', odcien: 'sale' },
  },
  {
    id: 'lumen',
    nazwa: 'Obiektyw Lumen 35 mm',
    kategoria: 'Foto',
    cena: cena(214900),
    cenaPrzed: cena(238900),
    dostepny: true,
    znacznik: { tekst: '−10%', odcien: 'sale' },
  },
  {
    id: 'boom',
    nazwa: 'Głośnik Boom Mini',
    kategoria: 'Audio',
    cena: cena(22900),
    dostepny: false,
  },
];

type Zamowienie = {
  id: string;
  numer: string;
  data: string;
  klient: string;
  stan: string;
  platnosc: string;
  platnoscOdcien: Odcien;
  kwota: string;
};

const ZAMOWIENIA: Zamowienie[] = [
  {
    id: '1',
    numer: 'NOR-2026-1000',
    data: '12 sie',
    klient: 'Robert Kowalski',
    stan: 'spakowane',
    platnosc: 'opłacone',
    platnoscOdcien: 'ok',
    kwota: cena(181899),
  },
  {
    id: '2',
    numer: 'NOR-2026-1001',
    data: '11 sie',
    klient: 'Marta Kwiatkowska',
    stan: 'wysłane',
    platnosc: 'opłacone',
    platnoscOdcien: 'ok',
    kwota: cena(631899),
  },
  {
    id: '3',
    numer: 'NOR-2026-1004',
    data: '8 sie',
    klient: 'Paweł Nowak',
    stan: 'nowe',
    platnosc: 'oczekuje',
    platnoscOdcien: 'wait',
    kwota: cena(66899),
  },
  {
    id: '4',
    numer: 'NOR-2026-1006',
    data: '6 sie',
    klient: 'Anna Zielińska',
    stan: 'dostarczone',
    platnosc: 'opłacone',
    platnoscOdcien: 'ok',
    kwota: cena(216899),
  },
];

const KOLUMNY: Kolumna<Zamowienie>[] = [
  { klucz: 'numer', naglowek: 'Numer', render: (z) => <span className="tabular-nums">{z.numer}</span> },
  { klucz: 'data', naglowek: 'Data' },
  { klucz: 'klient', naglowek: 'Klient' },
  { klucz: 'stan', naglowek: 'Stan', render: (z) => <Badge>{z.stan}</Badge> },
  {
    klucz: 'platnosc',
    naglowek: 'Płatność',
    render: (z) => <Badge odcien={z.platnoscOdcien}>{z.platnosc}</Badge>,
  },
  { klucz: 'kwota', naglowek: 'Kwota', doPrawej: true },
];

const SKALA = [
  { klasa: 't-page-title', nazwa: 'Page title', opis: 'Instrument Serif 400 · clamp(40–56px) · lh 1.05' },
  { klasa: 't-h2', nazwa: 'Section H2', opis: 'Instrument Serif 400 · clamp(26–36px) · lh 1.1' },
  { klasa: 't-card-title', nazwa: 'Card title', opis: 'Instrument Serif 400 · 20px · lh 1.2' },
  { klasa: 't-stat', nazwa: 'Stat number', opis: 'Instrument Serif 400 · clamp(28–48px) · lh 1' },
  { klasa: 't-body', nazwa: 'Body', opis: 'Inter 400 · 15px · lh 1.6' },
  { klasa: 't-small', nazwa: 'UI small', opis: 'Inter 400 · 13px · lh 1.5' },
  { klasa: 't-price', nazwa: 'Price', opis: 'Inter 500 · 16px · ls 0.01em · cyfry tabelaryczne' },
  { klasa: 't-nav', nazwa: 'Nav link', opis: 'Inter 400 · 14px · ls 0.01em' },
  { klasa: 't-caption', nazwa: 'Caption', opis: 'Inter 400 · 12px · ink-2' },
  { klasa: 't-th', nazwa: 'Table header', opis: 'Inter 600 · 11px · ls 0.08em · wersaliki' },
  { klasa: 't-overline', nazwa: 'Overline', opis: 'Inter 600 · 10px · ls 0.12em · wersaliki' },
];

const PROMIENIE = [
  { nazwa: 'Przycisk, pole szukania, badge', wartosc: '9999px', klasa: 'rounded-full' },
  { nazwa: 'Karta, kafel, kadr zdjęcia', wartosc: '12px', klasa: 'rounded-xl' },
  { nazwa: 'Pole formularza', wartosc: '6px', klasa: 'rounded-md' },
  { nazwa: 'Awatar', wartosc: '50%', klasa: 'rounded-full' },
];

export default function App() {
  return (
    <div className="min-h-screen">
      <NawigacjaSklepu />
      <BelkaPanelu aktywna="Pulpit" />

      <main className="mx-auto max-w-[1160px] px-6 pb-24">
        <div className="py-16">
          <Naglowek
            overline="System wizualny"
            tytul="Editorial dla sklepu"
            opis="Ciepła biel jako intencja, nie brak decyzji. Serif niesie treść, Inter obsługuje interfejs, terakota pojawia się wyłącznie przy danych i rabacie. Wartości żyją w jednym bloku @theme — wszystko poniżej tylko z nich korzysta."
            akcja={
              <div className="flex gap-3">
                <Button wariant="ghost">Dokumentacja</Button>
                <Button>Pobierz tokeny</Button>
              </div>
            }
          />
        </div>

        <Sekcja
          tytul="Tokeny"
          opis="Jedno źródło prawdy. Legenda odczytuje wartości z CSS-a przy renderze, więc nie potrafi rozjechać się z paletą."
        >
          <Tokeny />
        </Sekcja>

        <Sekcja
          tytul="Typografia"
          opis="Instrument Serif od 20px wzwyż — niżej gubi kreskę włosową i robi się szary. Wszystko drobniejsze należy do Intera."
        >
          <ul className="divide-y divide-border border-y border-border">
            {SKALA.map((s) => (
              <li key={s.klasa} className="grid gap-2 py-6 md:grid-cols-[1fr_auto] md:items-baseline">
                <p className={s.klasa}>{s.nazwa}</p>
                <p className="t-caption text-ink-3">
                  <code>.{s.klasa}</code> · {s.opis}
                </p>
              </li>
            ))}
          </ul>
        </Sekcja>

        <Sekcja
          tytul="Przyciski"
          opis="Pigułka wszędzie — to jedyny wyjątek od kanciastości w systemie, więc nie ma od niego wyjątków."
        >
          <Prezentacja>
            <Button>Zamawiam i płacę</Button>
            <Button wariant="ghost">Dodaj do listy</Button>
            <Button disabled>Niedostępny</Button>
            <Button maly>Do koszyka</Button>
            <Button wariant="ghost" maly>
              Filtruj
            </Button>
          </Prezentacja>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Prezentacja ciasno>
              <input className="field field-search" placeholder="Szukaj w katalogu" />
            </Prezentacja>
            <Prezentacja ciasno>
              <input className="field field-form" placeholder="Adres e-mail" />
            </Prezentacja>
          </div>
        </Sekcja>

        <Sekcja
          tytul="Znaczniki"
          opis="Stany zamówienia dzielą jeden neutralny odcień. Kolor zostaje dla pieniędzy i rabatu — inaczej tabela zamienia się w witraż, w którym nic nie wystaje."
        >
          <Prezentacja>
            <Badge>nowe</Badge>
            <Badge>spakowane</Badge>
            <Badge>wysłane</Badge>
            <Badge>dostarczone</Badge>
            <Badge odcien="ok">opłacone</Badge>
            <Badge odcien="wait">oczekuje</Badge>
            <Badge odcien="solid">Nowość</Badge>
            <Badge odcien="sale">−19%</Badge>
          </Prezentacja>
        </Sekcja>

        <Sekcja tytul="Promienie" opis="Cztery wartości na cały system. Piąta znaczy, że coś poszło nie tak.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROMIENIE.map((p) => (
              <div key={p.nazwa} className="border border-border p-5">
                <div className={`h-16 bg-surface ${p.klasa}`} />
                <p className="t-small mt-4">{p.nazwa}</p>
                <code className="t-caption text-ink-3">{p.wartosc}</code>
              </div>
            ))}
          </div>
        </Sekcja>

        <Sekcja
          tytul="Katalog"
          opis="Karta produktu bez ramki — kadr w głębszym beżu robi za obramowanie i za miejsce po zdjęciu, którego jeszcze nie ma."
        >
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {PRODUKTY.map((p) => (
              <KartaProduktu key={p.id} produkt={p} />
            ))}
          </div>
        </Sekcja>

        <Sekcja
          tytul="Panel — pulpit"
          opis="Kafle na czystej bieli, rozdzielone jedną kratą hairline’ów zamiast ramki wokół każdego."
        >
          <Kafle>
            <Stat etykieta="Utarg dziś" wartosc={cena(181899)} meta="+318,00 zł wobec tego dnia tydzień temu" />
            <Stat etykieta="Do wysłania" wartosc="6" meta="zamówień czeka na paczkę" />
            <Stat etykieta="Marża w miesiącu" wartosc={cena(1292684)} meta="wszystkie pozycje mają koszt" />
            <Stat etykieta="Średni koszyk" wartosc={cena(271524)} meta="8 zamówień" />
          </Kafle>
        </Sekcja>

        <Sekcja
          tytul="Panel — tabela"
          opis="Nagłówki Interem w wersalikach, kwoty do prawej na cyfrach tabelarycznych, hairline pod każdym wierszem."
        >
          <Tabela kolumny={KOLUMNY} wiersze={ZAMOWIENIA} />
        </Sekcja>
      </main>

      <footer className="border-t border-border bg-nav-bg">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-4 px-6 py-8">
          <p className="t-caption">
            System wizualny — React 19 · Vite · Tailwind CSS v4. Tokeny w <code>src/index.css</code>.
          </p>
          <p className="t-caption text-ink-3">Instrument Serif + Inter</p>
        </div>
      </footer>
    </div>
  );
}
