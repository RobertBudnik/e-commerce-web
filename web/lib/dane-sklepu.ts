/**
 * Dane konkretnego sklepu — jedyne miejsce, które wypełnia się przy wdrożeniu.
 *
 * To repozytorium jest szablonem: front sklepu plus magazyn zaplecza, który
 * przez Supabase synchronizuje produkty i stany. Wszystko, co odróżnia jeden
 * sklep od drugiego — nazwa, hasła, obietnice, dane sprzedawcy — siedzi tutaj,
 * a nie po komponentach. Rebranding to edycja jednego pliku.
 *
 * ## Konwencja
 *
 * Pole do wypełnienia wygląda tak: `'⟨nazwa sklepu⟩'`. Nawiasy kątowe są
 * celowo widoczne na stronie. Szablon, który udaje gotowy sklep, kończy się
 * tym, że „Kolekcja 2026" i cudzy adres jadą na produkcję — lepiej, żeby
 * niewypełnione miejsce kłuło w oczy.
 *
 * ## Obietnice handlowe — puste tablice są celowe
 *
 * `obietnice`, `platnosci`, `dostawa` i `gwarancja` startują puste. To nie jest
 * niedoróbka. Każde zdanie w tych polach jest wobec konsumenta wiążące: „wysyłka
 * w 24 h" i „2 lata gwarancji door-to-door" to zobowiązania, a nie ozdoby.
 * Sklep bez wpisu po prostu nie wyświetla sekcji — i to jest bezpieczny stan
 * domyślny. Wpisuj wyłącznie to, co faktycznie dowozisz.
 *
 * Po wypełnieniu sprawdź, czy nic nie zostało:
 *   node .claude/skills/zgodnosc-sklepu/scripts/audyt.mjs --etap sprzedaz
 */

/** Czy pole zostało wypełnione, czy nadal nosi znacznik `⟨…⟩`. */
export function doUzupelnienia(wartosc: string): boolean {
  return wartosc.includes('⟨');
}

/** Wartość albo null, gdy pole jest jeszcze niewypełnione. */
export function gotowe(wartosc: string): string | null {
  return doUzupelnienia(wartosc) ? null : wartosc;
}

// ---------------------------------------------------------------------------
// Marka i teksty na stronie
// ---------------------------------------------------------------------------

export const MARKA = {
  /**
   * Nazwa w nagłówku, stopce i tytułach kart.
   * Jedno miejsce — podmiana tutaj przechodzi przez cały sklep.
   */
  nazwa: 'dwie głowy',

  /** Jedno zdanie pod logo w stopce. Czym jest sklep, bez liczb i przechwałek. */
  opisStopki: 'Kamionka, len i dąb do codziennego użytku. Robione w dwie pary rąk w Krakowie.',

  /** Nadtytuł nad hasłem na stronie głównej — krótki, np. nazwa kolekcji. */
  nadtytulHero: 'Jesienny stół · Kraków · 2026',

  /** Hasło główne. Trzy linie ciężkiego grotesku — tak stoi w makiecie. */
  hasloHero: 'Dwie głowy,\njedna pracownia,\nłagodniejsze rzeczy.',

  /** Akapit pod hasłem. Tu wchodzą warunki, które faktycznie obowiązują. */
  podtytulHero:
    'Kamionka, len i dąb do codziennego użytku. Toczone, szkliwione i tkane przez dwoje ludzi na zapleczu przy Józefa — w partiach na tyle małych, że pamiętamy każdą.',

  /** Tekst sekcji z mocnym wyróżnieniem, w połowie strony głównej. */

  /** Tytuł karty przeglądarki na stronie głównej i w wynikach wyszukiwania. */
  tytulKarty: 'dwie głowy — kamionka, len i dąb z Krakowa',

  /**
   * Opis w metadanych — widoczny w wynikach wyszukiwania i przy udostępnianiu.
   * Nie wpisuj tu obietnic, których nie ma w `OBIETNICE`: to ta sama informacja
   * handlowa, tylko czytana poza sklepem.
   */
  opisMeta:
    'Kamionka, len i dąb do codziennego użytku — toczone, szkliwione i tkane w dwie pary rąk w Krakowie.',
} as const;

// ---------------------------------------------------------------------------
// Sprzedawca — wymagane przy sprzedaży konsumenckiej
// ---------------------------------------------------------------------------

/**
 * Dane identyfikujące przedsiębiorcę muszą być dostępne w sposób stały i łatwy
 * (art. 12 ustawy o prawach konsumenta, art. 5 ustawy o świadczeniu usług drogą
 * elektroniczną). Stopka i regulamin czytają je stąd.
 *
 * Dopóki tu stoją nawiasy, sklep nie jest gotowy do przyjmowania zamówień
 * od konsumentów — i sam to o sobie napisze w stopce.
 */
export const SPRZEDAWCA = {
  nazwa: '⟨pełna nazwa firmy, dokładnie jak w rejestrze⟩',
  adres: '⟨ulica i numer, kod pocztowy, miejscowość⟩',
  nip: '⟨NIP⟩',
  regon: '⟨REGON⟩',
  /** Spółki: numer KRS i sąd rejestrowy. Jednoosobowa działalność — zostaw puste. */
  krs: '',
  email: '⟨adres e-mail obsługi klienta⟩',
  telefon: '⟨telefon obsługi⟩',
  godziny: '⟨godziny pracy obsługi⟩',
  /** Adres do zwrotów, jeśli inny niż siedziba. Pusty = ten sam co siedziba. */
  adresZwrotow: '',
} as const;

// ---------------------------------------------------------------------------
// Obietnice — puste, dopóki nie masz pokrycia
// ---------------------------------------------------------------------------

/**
 * Warunki zakupu: pasek przewijany pod nagłówkiem, kafle pod hero i lista pod
 * przyciskiem zakupu. `tytul` jedzie sam na pasku, `opis` dochodzi w kaflach.
 *
 * Wpisy startują jako widoczne placeholdery, a nie jako gotowe hasła. Powód
 * jest dwojaki: układ strony zostaje na miejscu, więc widać, co się psuje przy
 * podmianie, a jednocześnie nikt przez pomyłkę nie wypuści „2 lata gwarancji
 * door-to-door" sklepu, który takiej gwarancji nie daje. Każdy z tych wpisów
 * jest wobec konsumenta wiążący — wpisuj wyłącznie to, co faktycznie dowozisz.
 *
 * Pusta tablica ukrywa pasek i kafle w całości. To prawidłowy stan dla sklepu,
 * który nie chce niczego obiecywać.
 */
/*
 * Z paska w makiecie wchodzą tu wyłącznie zdania o samej pracowni. Trzy
 * pozostałe hasła z makiety — „darmowa dostawa od 90", „60 dni na zwrot",
 * „naprawiamy zawsze" — są wobec kupującego wiążące i dziś **kłócą się
 * z konfiguracją sklepu**: `WARUNKI.dniNaOdstapienie` to 14, a
 * `WARUNKI.progDarmowejDostawy` to 0. Rozjazd między hasłem a rachunkiem
 * rozstrzyga się na korzyść konsumenta, więc sklep byłby związany dłuższym
 * terminem, którego kasa i tak nie liczy.
 *
 * Dopisz je dopiero razem z prawdziwymi liczbami w `WARUNKI` — wtedy pasek
 * urośnie sam, bo czyta tę tablicę.
 */
export const OBIETNICE: readonly { tytul: string; opis: string }[] = [
  {
    tytul: 'Zrobione w Krakowie',
    opis: 'Toczone i tkane na miejscu, przy Józefa — nie sprowadzane.',
  },
  {
    tytul: 'Bez sezonów, bez wyprzedaży',
    opis: 'Jedna cena przez cały rok. Nie przeceniamy, żeby zaraz podnieść.',
  },
];

/**
 * Formy płatności faktycznie uruchomione u operatora. „Raty 0%" wymagają
 * osobnej umowy z dostawcą usługi — nie wpisuj ich, jeśli jej nie ma.
 */
export const PLATNOSCI: readonly string[] = [];

/**
 * Formy dostawy. Ceny na stronie muszą zgadzać się z tym, co nalicza baza
 * (`store_settings.shipping_flat_cents`) — rozjazd między opisem a rachunkiem
 * jest praktyką wprowadzającą w błąd, nie literówką.
 */
export const DOSTAWA: readonly { forma: string; cena: string; termin: string }[] = [];

/**
 * Kroki „jak to działa" na stronie głównej — sekcja przypięta, jeden krok
 * na wysokość ekranu, więc trzy to rozsądny sufit. Opisz proces, który naprawdę
 * u ciebie zachodzi: terminy z tej sekcji też są informacją handlową.
 *
 * `ikona` bierze nazwę z `ICON_PATHS` w `web/components/Icon.tsx`
 * (m.in. `box`, `shield`, `check`, `truck`).
 */
export const JAK_TO_DZIALA: readonly {
  nadtytul: string;
  tytul: string;
  opis: string;
  ikona: string;
}[] = [
  {
    nadtytul: 'Krok pierwszy',
    tytul: '⟨co robi kupujący⟩',
    opis: '⟨jedno–dwa zdania; jeśli podajesz godzinę graniczną, musi być dotrzymywana⟩',
    ikona: 'box',
  },
  {
    nadtytul: 'Krok drugi',
    tytul: '⟨co robisz ty⟩',
    opis: '⟨jedno–dwa zdania o pakowaniu i nadaniu przesyłki⟩',
    ikona: 'shield',
  },
  {
    nadtytul: 'Krok trzeci',
    tytul: '⟨co kupujący dostaje po dostawie⟩',
    opis: '⟨np. zasady zwrotu — termin musi zgadzać się z WARUNKI.dniNaOdstapienie⟩',
    ikona: 'check',
  },
];

/**
 * Liczby w hero (zamówienia, średnia ocen, czas wysyłki). Animowane licznikiem,
 * więc `do` musi być liczbą.
 *
 * Pusto z tego samego powodu co obietnice: „ponad 120 000 zamówień" w sklepie,
 * który wystartował wczoraj, jest twierdzeniem nieprawdziwym, a nie ozdobą.
 * Wpisuj po pierwszym prawdziwym pomiarze.
 *
 * Przykład: [{ do: 4.8, ulamek: 1, sufiks: '', etykieta: 'Średnia ocen 4,8', opis: 'średnia ocen' }]
 */
export const STATYSTYKI: readonly {
  do: number;
  ulamek?: number;
  sufiks?: string;
  etykieta: string;
  opis: string;
}[] = [
  { do: 9, etykieta: '9 lat na Kazimierzu', opis: 'lat na Kazimierzu' },
  { do: 140, etykieta: '140 rzeczy miesięcznie', opis: 'rzeczy miesięcznie' },
  { do: 2, etykieta: '2 pary rąk', opis: 'pary rąk' },
];

// ---------------------------------------------------------------------------
// Pracownia i dziennik — sekcje redakcyjne strony głównej
// ---------------------------------------------------------------------------

/**
 * Ciemny blok „pracownia" w połowie strony głównej. Liczby bierze ze
 * `STATYSTYKI`, więc stoją w jednym miejscu z resztą pomiarów.
 *
 * `przyciskHref` celowo prowadzi do sklepu: strony „o nas" w tym serwisie
 * nie ma (`SLUGI_INFO` zna tylko dokumenty sprzedażowe), a przycisk
 * w ciemnym bloku nie ma prawa kończyć się czterysta czwórką. Gdy taka
 * strona powstanie, podmiana jest tutaj.
 */
export const PRACOWNIA = {
  nadtytul: 'Pracownia',
  haslo:
    'Robimy w parze. Jedno toczy, drugie tka, i nic nie wychodzi z pokoju, dopóki oboje nie zatrzymalibyśmy tego u siebie.',
  przyciskEtykieta: 'Zobacz, co powstało',
  przyciskHref: '/sklep',
} as const;

/**
 * Wpisy dziennika na stronie głównej. Pusta tablica ukrywa sekcję — tak samo
 * jak przy obietnicach, bo dziennik bez wpisów wygląda na awarię, a nie na
 * wybór. `data` jedzie tekstem, bo niesie miesiąc, nie dzień.
 */
export const DZIENNIK: readonly {
  dzial: string;
  tytul: string;
  opis: string;
  data: string;
}[] = [
  {
    dzial: 'Proces',
    tytul: 'Co powolny wypał robi ze szkliwem popiołowym',
    opis: 'Jedenaście godzin, dwa stożki i dlaczego przestaliśmy poganiać stygnięcie.',
    data: 'wrzesień 2026',
  },
  {
    dzial: 'U siebie',
    tytul: 'Nakrywanie do stołu we dwoje, byle jak',
    opis: 'Niedobrane talerze, jedna świeca, nic odmierzone.',
    data: 'sierpień 2026',
  },
  {
    dzial: 'Materiał',
    tytul: 'Len z Podlasia, prany cztery razy',
    opis: 'Jak trzecie pranie zmienia to, w jaki sposób narzuta układa się na krześle.',
    data: 'lipiec 2026',
  },
];

// ---------------------------------------------------------------------------
// Warunki sprzedaży — liczby, które muszą być spójne w całym sklepie
// ---------------------------------------------------------------------------

/**
 * Te wartości pojawiają się na stronie produktu, w koszyku i na stronach
 * informacyjnych. Trzymanie ich w jednym miejscu jest tu istotne prawnie:
 * rozjazd między „30 dni" w jednym miejscu a „14 dni" w drugim rozstrzyga się
 * na korzyść konsumenta, więc sklep i tak będzie związany dłuższym terminem.
 */
export const WARUNKI = {
  /** Dni na odstąpienie od umowy. Ustawowe minimum to 14; więcej wolno. */
  dniNaOdstapienie: 14,

  /**
   * Gwarancja producenta albo sprzedawcy — dobrowolna. Pusty tekst znaczy
   * „nie udzielamy", i wtedy konsumentowi zostaje odpowiedzialność ustawowa
   * za zgodność towaru z umową, która obowiązuje niezależnie od tego pola.
   */
  gwarancja: '',

  /** Próg darmowej dostawy w złotych. 0 = brak darmowej dostawy. */
  progDarmowejDostawy: 0,

  /** Zniżka za zapis do newslettera. Pusty tekst ukrywa całą sekcję. */
  rabatNewsletter: '',
} as const;

/**
 * Wersja regulaminu i polityki prywatności.
 *
 * Zgoda klienta dotyczy konkretnego brzmienia dokumentu, nie jego nazwy —
 * dlatego przy zamówieniu zapisujemy tę wartość, a nie samo „zgodził się".
 * Bez niej przy reklamacji nie da się odtworzyć, na co klient przystał.
 *
 * **Podnieś ją przy każdej zmianie treści regulaminu albo polityki.**
 * Format jest datą, żeby dało się ją posortować i porównać na oko.
 */
export const WERSJA_DOKUMENTOW = '2026-08-23';
