/**
 * Strony informacyjne wymagane przy sprzedaży konsumenckiej.
 *
 * Treść to rusztowanie, nie gotowy dokument prawny — każda strona mówi wprost,
 * co właściciel sklepu musi uzupełnić. Lepsze to niż wygenerowany regulamin,
 * który wygląda wiarygodnie, a nie odpowiada rzeczywistości sklepu.
 */
export type StronaInfo = {
  tytul: string;
  wstep: string;
  sekcje: { naglowek: string; tresc: string[] }[];
  doUzupelnienia: string[];
};

export const STRONY_INFO: Record<string, StronaInfo> = {
  'dostawa-i-platnosci': {
    tytul: 'Dostawa i płatności',
    wstep:
      'Zamówienia złożone do 15:00 w dni robocze pakujemy tego samego dnia. Darmowa dostawa od 300 zł.',
    sekcje: [
      {
        naglowek: 'Sposoby dostawy',
        tresc: [
          'Kurier — 19,99 zł, dostawa następnego dnia roboczego.',
          'Paczkomat — 14,99 zł, przesyłka w punkcie po jednym–dwóch dniach roboczych.',
          'Powyżej 300 zł dostawa jest bezpłatna niezależnie od wybranej formy.',
        ],
      },
      {
        naglowek: 'Formy płatności',
        tresc: [
          'BLIK, karta płatnicza, Przelewy24 oraz raty 0%.',
          'Płatność rozliczana jest przez operatora; sklep nie przechowuje danych karty.',
        ],
      },
    ],
    doUzupelnienia: [
      'Nazwy i cenniki przewoźników, z którymi faktycznie masz umowę',
      'Terminy dostawy poza granice kraju, jeśli wysyłasz za granicę',
    ],
  },

  'zwroty-i-reklamacje': {
    tytul: 'Zwroty i reklamacje',
    wstep:
      'Na odstąpienie od umowy masz trzydzieści dni od odebrania przesyłki. Nie musisz podawać przyczyny.',
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
        naglowek: 'Reklamacja',
        tresc: [
          'Sprzęt objęty jest dwuletnią gwarancją door-to-door — odbieramy i odsyłamy na nasz koszt.',
          'Reklamację rozpatrujemy w czternaście dni od jej otrzymania.',
        ],
      },
    ],
    doUzupelnienia: [
      'Adres do zwrotów',
      'Zasady pokrywania kosztów odesłania towaru',
    ],
  },

  regulamin: {
    tytul: 'Regulamin',
    wstep:
      'Regulamin określa zasady sprzedaży w sklepie Nordo i prawa przysługujące kupującemu.',
    sekcje: [
      {
        naglowek: 'Zakres',
        tresc: [
          'Dokument obejmuje składanie zamówień, płatności, dostawę, odstąpienie od umowy i reklamacje.',
          'Kupujący będący konsumentem zachowuje wszystkie uprawnienia wynikające z przepisów bezwzględnie obowiązujących.',
        ],
      },
    ],
    doUzupelnienia: [
      'Pełne dane sprzedawcy: nazwa, adres, NIP, REGON, numer wpisu do rejestru',
      'Treść regulaminu sprawdzona przez prawnika — to wymóg, nie formalność',
      'Informacja o pozasądowym rozwiązywaniu sporów i platformie ODR',
    ],
  },

  'polityka-prywatnosci': {
    tytul: 'Polityka prywatności',
    wstep:
      'Przetwarzamy dane wyłącznie w zakresie potrzebnym do realizacji zamówienia i prowadzenia konta.',
    sekcje: [
      {
        naglowek: 'Jakie dane zbieramy',
        tresc: [
          'Adres e-mail i hasło — do prowadzenia konta.',
          'Imię, nazwisko, adres i telefon — do realizacji dostawy.',
          'Historia zamówień — do obsługi reklamacji i zwrotów.',
        ],
      },
      {
        naglowek: 'Twoje prawa',
        tresc: [
          'Masz prawo dostępu do danych, ich sprostowania, usunięcia oraz przeniesienia.',
          'Możesz w każdej chwili usunąć konto — dane rozliczeniowe zostaną tak długo, jak wymagają tego przepisy podatkowe.',
        ],
      },
    ],
    doUzupelnienia: [
      'Dane administratora i, jeśli powołany, inspektora ochrony danych',
      'Lista podmiotów przetwarzających: hosting, operator płatności, przewoźnik',
      'Okresy przechowywania dla każdej kategorii danych',
    ],
  },

  'odstapienie-od-umowy': {
    tytul: 'Odstąpienie od umowy',
    wstep:
      'Konsument może odstąpić od umowy w ciągu trzydziestu dni bez podawania przyczyny.',
    sekcje: [
      {
        naglowek: 'Wzór oświadczenia',
        tresc: [
          'Ja, niżej podpisana/podpisany, informuję o odstąpieniu od umowy sprzedaży następujących rzeczy:',
          'Data zamówienia, data odbioru, imię i nazwisko, adres, podpis (jeśli formularz wysyłany jest w wersji papierowej), data.',
        ],
      },
    ],
    doUzupelnienia: [
      'Adres, na który należy przesłać oświadczenie',
      'Formularz do pobrania w PDF',
    ],
  },
};

export const SLUGI_INFO = Object.keys(STRONY_INFO);
