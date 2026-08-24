/**
 * Content-Security-Policy sklepu.
 *
 * Reszta nagłówków bezpieczeństwa stoi w `next.config.ts`, bo są stałe.
 * Ten nie może — niesie nonce losowany dla każdego żądania, więc powstaje
 * w middleware i tam jest doklejany do odpowiedzi.
 */

/**
 * Supabase: zapytania, logowanie i zdjęcia produktów. Adres bierzemy ze
 * zmiennej, tej samej, z której korzysta `next.config.ts` przy `next/image` —
 * lokalnie 127.0.0.1, na wdrożeniu domena projektu. Wpisanie tu domeny na
 * sztywno oznaczałoby, że polityka działa na jednym środowisku, a na drugim
 * ucina cały katalog.
 */
const SUPABASE = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321').origin;

/**
 * Ten sam host, tylko gniazdo — tak `supabase-js` łączy się po realtime.
 * Sklep dziś z tego nie korzysta, ale host jest już zaufany dla zapytań,
 * więc wpis niczego nowego nie otwiera, a oszczędza awarii w dniu, w którym
 * ktoś doda podgląd stanów magazynowych na żywo.
 */
const SUPABASE_GNIAZDO = SUPABASE.replace(/^http/, 'ws');

const DEWELOPERSKI = process.env.NODE_ENV !== 'production';

/**
 * Egzekwowanie jest domyślnie wyłączone i to nie jest niedbałość.
 *
 * Polityka, która przy pierwszym wdrożeniu wywali koszyk, zostanie wyłączona
 * w panice i nigdy nie wróci. W trybie zgłoszeniowym przeglądarka liczy
 * dokładnie te same naruszenia i wypisuje je w konsoli, tylko niczego nie
 * blokuje — więc błąd w polityce kosztuje wpis w konsoli, a nie utracone
 * zamówienie.
 *
 * Zgłoszenia lądują wyłącznie w konsoli przeglądarki: nie ma tu `report-uri`,
 * bo nie ma dokąd go kierować. Zanim włączysz egzekwowanie, przeklikaj
 * ścieżkę zakupu, panel i magazyn z otwartą konsolą — to jest ten zbiór
 * raportów.
 *
 * Uwaga na przełączanie: middleware jedzie na brzegu, a tam Next wstawia
 * wartości zmiennych w kod przy buildzie. Zmiana `CSP_EGZEKWUJ` w panelu
 * hostingu wymaga ponownego wdrożenia, samo zapisanie zmiennej nic nie da.
 */
export const CSP_EGZEKWOWANA = process.env.CSP_EGZEKWUJ === '1';

export const NAGLOWEK_CSP = CSP_EGZEKWOWANA
  ? 'Content-Security-Policy'
  : 'Content-Security-Policy-Report-Only';

/** Nonce jedzie do layoutu osobnym nagłówkiem żądania, pod własną nazwą. */
export const NAGLOWEK_NONCE = 'x-nordo-nonce';

/**
 * Nonce ma być nie do odgadnięcia — inaczej jest tylko ozdobą. 16 losowych
 * bajtów z generatora kryptograficznego, w base64, bo tego formatu oczekuje
 * składnia `'nonce-…'`.
 */
export function losujNonce(): string {
  const bajty = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bajty));
}

export function politykaCsp(nonce: string): string {
  const dyrektywy: string[] = [
    // Wszystko, czego nie wymieniono niżej, wolno brać wyłącznie z własnej
    // domeny. To jest właściwa treść polityki; reszta to odstępstwa.
    "default-src 'self'",

    /**
     * Skrypty: własna domena i jeden nonce. Nonce obsługuje skrypt motywu
     * z layoutu oraz wstawki, którymi Next przekazuje dane strony i budzi
     * Reacta — te ostatnie oznacza sam, wyłuskując nonce z nagłówka polityki
     * doklejonego do żądania.
     *
     * Bez `'strict-dynamic'` świadomie. Byłoby ciaśniej, ale wtedy lista
     * hostów przestaje cokolwiek znaczyć i nie ma jak dopuścić skryptu,
     * który wstrzykuje sam hosting — pasek komentarzy Vercela na wdrożeniach
     * podglądowych. Polityka, której nie da się przećwiczyć na podglądzie,
     * nie zostanie włączona na produkcji.
     *
     * `'unsafe-eval'` tylko lokalnie: kompilator w trybie deweloperskim
     * podaje moduły przez `eval`, a odświeżanie komponentów bez tego nie
     * działa. Do buildu produkcyjnego ta zgoda nie wchodzi.
     */
    `script-src 'self' 'nonce-${nonce}'${DEWELOPERSKI ? " 'unsafe-eval'" : ''}`,

    /**
     * Style muszą przepuścić `'unsafe-inline'` i nie ma tu wyboru: sklep ma
     * kilkadziesiąt atrybutów `style` w komponentach, a nonce ich nie
     * obejmuje — dotyczy znaczników `<style>`, nie atrybutów. Co gorsza,
     * dopisanie nonce do tej dyrektywy skasowałoby `'unsafe-inline'`
     * (przeglądarka ignoruje je, gdy jest nonce), czyli wyłączyłoby te
     * atrybuty zamiast je uszczelnić.
     */
    "style-src 'self' 'unsafe-inline'",

    /**
     * Zdjęcia produktów leżą w Supabase Storage i część widoków bierze je
     * wprost, z pominięciem `/_next/image`. `blob:` jest pod podgląd zdjęcia
     * wybranego w panelu, zanim pójdzie na serwer; `data:` pod ikony.
     */
    `img-src 'self' data: blob: ${SUPABASE}`,

    // Kroje serwuje `next/font` z `/_next/static/media`, czyli własna domena.
    "font-src 'self'",

    /**
     * Zapytania: własna domena (w tym tunel Sentry pod `/monitoring`, przez
     * który zgłoszenia omijają blokady reklam) i Supabase. Lokalnie dochodzi
     * gniazdo serwera deweloperskiego, którym Next podaje przeładowania —
     * bez niego strona przestaje się odświeżać przy zapisie pliku.
     */
    [
      "connect-src 'self'",
      SUPABASE,
      SUPABASE_GNIAZDO,
      DEWELOPERSKI ? 'ws://localhost:* ws://127.0.0.1:*' : '',
    ]
      .filter(Boolean)
      .join(' '),

    // Skaner kodów w magazynie pokazuje obraz z aparatu; strumień z kamery
    // nie jest adresem, ale zapis klatki do podglądu bywa `blob:`.
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",

    // Nie ma tu wtyczek ani osadzonych obiektów, więc nie ma czego wpuszczać.
    "object-src 'none'",

    // Adres bazowy na sztywno: bez tego wstrzyknięty `<base>` przekierowałby
    // wszystkie ścieżki względne, łącznie ze skryptami z własnej domeny.
    "base-uri 'self'",

    // Formularze i akcje serwerowe wracają do nas. Nigdzie indziej.
    "form-action 'self'",

    // To samo, co `X-Frame-Options: DENY` z `next.config.ts`, tylko że tę
    // wersję rozumieją nowe przeglądarki. Oba zostają — starsze czytają tamto.
    "frame-ancestors 'none'",
  ];

  /**
   * Podniesienie do HTTPS tylko tam, gdzie Supabase już na nim stoi. Lokalnie
   * baza chodzi po http pod 127.0.0.1 i ta dyrektywa zerwałaby połączenie
   * z nią przy pierwszym zapytaniu o katalog.
   */
  if (SUPABASE.startsWith('https:')) dyrektywy.push('upgrade-insecure-requests');

  return dyrektywy.join('; ');
}
