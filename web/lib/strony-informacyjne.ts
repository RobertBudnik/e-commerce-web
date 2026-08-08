import { DOSTAWA, SPRZEDAWCA, WARUNKI, doUzupelnienia } from './dane-sklepu';

/**
 * Strony informacyjne wymagane przy sprzedaży konsumenckiej.
 *
 * Treść to rusztowanie, nie gotowy dokument prawny — każda strona mówi wprost,
 * co właściciel sklepu musi uzupełnić. Lepsze to niż wygenerowany regulamin,
 * który wygląda wiarygodnie, a nie odpowiada rzeczywistości sklepu.
 *
 * Liczby i dane pochodzą z `dane-sklepu.ts`, żeby termin zwrotu albo cena
 * dostawy nie rozjechały się między tą stroną, koszykiem a kartą produktu.
 * Rozjazd nie jest tu literówką: konsument trzyma się zapisu korzystniejszego
 * dla siebie, więc sklep i tak będzie związany dłuższym terminem.
 */
export type StronaInfo = {
  tytul: string;
  wstep: string;
  sekcje: { naglowek: string; tresc: string[] }[];
  doUzupelnienia: string[];
};

const dni = WARUNKI.dniNaOdstapienie;

/** Lista form dostawy albo jedno zdanie mówiące, gdzie je wpisać. */
const formyDostawy: string[] =
  DOSTAWA.length > 0
    ? DOSTAWA.map((d) => `${d.forma} — ${d.cena}, ${d.termin}.`)
    : ['Formy dostawy wpisz w web/lib/dane-sklepu.ts → DOSTAWA (forma, cena, termin).'];

/** Dane sprzedawcy do stopki dokumentu albo instrukcja, skąd je wziąć. */
const ktoSprzedaje: string =
  doUzupelnienia(SPRZEDAWCA.nazwa) || doUzupelnienia(SPRZEDAWCA.nip)
    ? 'Dane sprzedawcy wpisz w web/lib/dane-sklepu.ts → SPRZEDAWCA: nazwa, adres, NIP, REGON, kontakt.'
    : `Sprzedawcą jest ${SPRZEDAWCA.nazwa}, ${SPRZEDAWCA.adres}, NIP ${SPRZEDAWCA.nip}.`;

export const STRONY_INFO: Record<string, StronaInfo> = {
  'dostawa-i-platnosci': {
    tytul: 'Dostawa i płatności',
    wstep:
      'Warunki wysyłki i rozliczenia. Ceny na tej stronie muszą zgadzać się z tym, co nalicza koszyk.',
    sekcje: [
      {
        naglowek: 'Sposoby dostawy',
        tresc: [
          ...formyDostawy,
          WARUNKI.progDarmowejDostawy > 0
            ? `Powyżej ${WARUNKI.progDarmowejDostawy} zł dostawa jest bezpłatna niezależnie od wybranej formy.`
            : 'Próg darmowej dostawy ustawia się w dane-sklepu.ts → WARUNKI.progDarmowejDostawy, a stawkę w tabeli store_settings. Obie wartości muszą być zgodne.',
        ],
      },
      {
        naglowek: 'Formy płatności',
        tresc: [
          'Wpisz wyłącznie te formy, które masz uruchomione u operatora — lista w dane-sklepu.ts → PLATNOSCI.',
          'Płatność rozlicza operator; sklep nie przechowuje danych karty.',
        ],
      },
    ],
    doUzupelnienia: [
      'Przewoźnicy, z którymi faktycznie masz umowę, wraz z cennikiem',
      'Stawka dostawy w store_settings — musi być równa cenie podanej wyżej',
      'Terminy i koszty wysyłki zagranicznej, jeśli wysyłasz poza kraj',
    ],
  },

  'zwroty-i-reklamacje': {
    tytul: 'Zwroty i reklamacje',
    wstep: `Na odstąpienie od umowy masz ${dni} dni od odebrania przesyłki. Nie musisz podawać przyczyny.`,
    sekcje: [
      {
        naglowek: 'Zwrot towaru',
        tresc: [
          'Poinformuj nas o odstąpieniu — wystarczy wiadomość albo formularz odstąpienia.',
          'Odeślij towar w ciągu czternastu dni od złożenia oświadczenia.',
          'Zwracamy pieniądze niezwłocznie, nie później niż w czternaście dni od otrzymania oświadczenia.',
        ],
      },
      {
        naglowek: 'Niezgodność towaru z umową',
        tresc: [
          'Za zgodność towaru z umową odpowiadamy z mocy ustawy przez dwa lata od wydania rzeczy. To uprawnienie przysługuje niezależnie od jakiejkolwiek gwarancji i nie można go wyłączyć.',
          'Jeśli towar jest niezgodny z umową, możesz żądać naprawy albo wymiany. Gdy to niemożliwe lub zbyt uciążliwe, możesz żądać obniżenia ceny albo odstąpić od umowy.',
          'Naprawa i wymiana odbywają się na nasz koszt. W pierwszym roku od wydania domniemywa się, że niezgodność istniała już w chwili dostarczenia.',
        ],
      },
      {
        naglowek: 'Gwarancja',
        tresc: [
          WARUNKI.gwarancja
            ? WARUNKI.gwarancja
            : 'Nie udzielamy odrębnej gwarancji. Gwarancja jest dobrowolna — jeśli chcesz ją dawać, opisz gwaranta, okres i warunki w dane-sklepu.ts → WARUNKI.gwarancja. Nie zastępuje odpowiedzialności ustawowej opisanej wyżej.',
        ],
      },
      {
        naglowek: 'Reklamacje i spory',
        tresc: [
          'Reklamację rozpatrujemy w czternaście dni od jej otrzymania.',
          'Spór można skierować do polubownego rozwiązania — do wojewódzkiego inspektoratu Inspekcji Handlowej albo do miejskiego lub powiatowego rzecznika konsumentów.',
        ],
      },
    ],
    doUzupelnienia: [
      'Adres do zwrotów',
      'Kto pokrywa koszt odesłania towaru przy odstąpieniu',
      'Termin rozpatrzenia reklamacji, jeśli inny niż czternaście dni',
    ],
  },

  regulamin: {
    tytul: 'Regulamin',
    wstep: 'Regulamin określa zasady sprzedaży w sklepie i prawa przysługujące kupującemu.',
    sekcje: [
      {
        naglowek: 'Sprzedawca',
        tresc: [ktoSprzedaje],
      },
      {
        naglowek: 'Zawarcie umowy',
        tresc: [
          'Opisz, w którym momencie dochodzi do zawarcia umowy: złożenie zamówienia, potwierdzenie, opłacenie.',
          'Wymień wymagania techniczne potrzebne do korzystania ze sklepu — przeglądarka, aktywny adres e-mail.',
        ],
      },
      {
        naglowek: 'Ceny i płatność',
        tresc: [
          'Wszystkie ceny są cenami brutto i zawierają podatek.',
          'Wpisz termin płatności i to, co dzieje się z zamówieniem nieopłaconym.',
        ],
      },
      {
        naglowek: 'Dostawa',
        tresc: formyDostawy,
      },
      {
        naglowek: 'Odstąpienie od umowy',
        tresc: [
          `Konsument może odstąpić od umowy w ciągu ${dni} dni bez podawania przyczyny.`,
          'Opisz sposób złożenia oświadczenia, koszt odesłania i wyjątki, jeśli sprzedajesz towary, których prawo odstąpienia nie obejmuje.',
        ],
      },
      {
        naglowek: 'Zgodność towaru z umową',
        tresc: [
          'Odpowiadamy za zgodność towaru z umową na zasadach ustawowych przez dwa lata od wydania rzeczy. Szczegóły na stronie „Zwroty i reklamacje".',
        ],
      },
      {
        naglowek: 'Reklamacje',
        tresc: [
          'Opisz tryb składania reklamacji, adres, termin rozpatrzenia i sposób poinformowania o wyniku.',
          'Dodaj informację o pozasądowym rozwiązywaniu sporów.',
        ],
      },
      {
        naglowek: 'Dane osobowe',
        tresc: ['Administratorem danych jest sprzedawca. Zasady opisuje polityka prywatności.'],
      },
      {
        naglowek: 'Zmiany regulaminu',
        tresc: [
          'Opisz tryb zmiany regulaminu i to, że zamówienia złożone wcześniej rozliczane są według wersji obowiązującej w chwili zakupu.',
          'Podaj datę wersji dokumentu — bez niej nie da się wykazać, na co zgodził się kupujący.',
        ],
      },
    ],
    doUzupelnienia: [
      'Dane sprzedawcy w web/lib/dane-sklepu.ts → SPRZEDAWCA',
      'Treść sekcji powyżej — każda jest dziś instrukcją, nie postanowieniem',
      'Data wersji dokumentu i mechanizm jej zapisu przy zamówieniu',
      'Regulamin sprawdzony przez prawnika — to wymóg, nie formalność',
    ],
  },

  'polityka-prywatnosci': {
    tytul: 'Polityka prywatności',
    wstep:
      'Przetwarzamy dane wyłącznie w zakresie potrzebnym do realizacji zamówienia i prowadzenia konta.',
    sekcje: [
      {
        naglowek: 'Administrator',
        tresc: [ktoSprzedaje],
      },
      {
        naglowek: 'Jakie dane zbieramy',
        tresc: [
          'Adres e-mail i hasło — do prowadzenia konta.',
          'Imię, nazwisko, adres i telefon — do realizacji dostawy.',
          'Historia zamówień — do obsługi reklamacji i zwrotów.',
        ],
      },
      {
        naglowek: 'Komu przekazujemy dane',
        tresc: [
          'Supabase — hosting bazy danych i uwierzytelnianie.',
          'Vercel — hosting sklepu.',
          'Stripe — obsługa płatności.',
          'Sentry — monitoring błędów aplikacji; zgłoszenia idą przez własną domenę sklepu.',
          'Przewoźnik — dane odbiorcy potrzebne do doręczenia przesyłki. Uzupełnij nazwę.',
          'Z każdym z tych podmiotów potrzebna jest umowa powierzenia przetwarzania.',
        ],
      },
      {
        naglowek: 'Twoje prawa',
        tresc: [
          'Masz prawo dostępu do danych, ich sprostowania, usunięcia oraz przeniesienia.',
          'Możesz wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych.',
          'Opisz, w jaki sposób realizujesz usunięcie konta — dane rozliczeniowe zostają tak długo, jak wymagają tego przepisy podatkowe.',
        ],
      },
      {
        naglowek: 'Pamięć przeglądarki',
        tresc: [
          'Sklep zapisuje w przeglądarce koszyk, wybrany motyw i listę ostatnio oglądanych produktów. Sesję trzyma ciasteczko konieczne do działania sklepu.',
          'Nie korzystamy z analityki ani z narzędzi marketingowych. Jeśli je dodasz, potrzebna będzie zgoda przed ich uruchomieniem.',
        ],
      },
    ],
    doUzupelnienia: [
      'Dane administratora i, jeśli powołany, inspektora ochrony danych',
      'Nazwa przewoźnika i pozostałych odbiorców danych',
      'Okresy przechowywania dla każdej kategorii danych',
      'Ścieżka usunięcia konta — dziś nie ma jej w kodzie, więc nie obiecuj jej tutaj',
    ],
  },

  'odstapienie-od-umowy': {
    tytul: 'Odstąpienie od umowy',
    wstep: `Konsument może odstąpić od umowy w ciągu ${dni} dni bez podawania przyczyny.`,
    sekcje: [
      {
        naglowek: 'Wzór oświadczenia',
        tresc: [
          'Ja, niżej podpisana/podpisany, informuję o odstąpieniu od umowy sprzedaży następujących rzeczy:',
          'Data zamówienia, data odbioru, imię i nazwisko, adres, podpis (jeśli formularz wysyłany jest w wersji papierowej), data.',
        ],
      },
      {
        naglowek: 'Gdzie wysłać',
        tresc: [
          doUzupelnienia(SPRZEDAWCA.email)
            ? 'Adres do wysyłki oświadczenia wpisz w dane-sklepu.ts → SPRZEDAWCA.email oraz adresZwrotow.'
            : `Oświadczenie wyślij na ${SPRZEDAWCA.email} albo pocztą na ${SPRZEDAWCA.adresZwrotow || SPRZEDAWCA.adres}.`,
        ],
      },
    ],
    doUzupelnienia: ['Formularz odstąpienia do pobrania w PDF'],
  },
};

export const SLUGI_INFO = Object.keys(STRONY_INFO);
