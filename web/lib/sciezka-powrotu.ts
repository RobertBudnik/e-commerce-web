/**
 * Sprawdzenie parametru `powrot` — dokąd wolno odesłać po zalogowaniu.
 *
 * Wartość przychodzi z adresu (`/logowanie?powrot=…`) i z ukrytego pola
 * formularza, czyli w całości spod kontroli tego, kto wysyła link. Bez
 * sprawdzenia `redirect()` przyjmował adres bezwzględny i sklep odsyłał
 * gościa na obcą domenę — z zaufaniem wyrobionym przez prawdziwe logowanie
 * pod prawdziwym adresem. Klasyczny nośnik wyłudzenia.
 *
 * Przepuszczamy wyłącznie ścieżkę we własnym serwisie. Odrzucamy:
 *
 *   https://obcy/…   adres bezwzględny
 *   //obcy/…         adres bez schematu — przeglądarka dołoży bieżący
 *   /\obcy/…         to samo backslashem; silniki czytają `/\` jak `//`
 *   `/`+TAB+`/obcy`  przeglądarka usuwa znaki sterujące z adresu i zostaje `//obcy`
 *
 * Stąd kolejność: najpierw wycinamy znaki sterujące, potem sprawdzamy
 * początek. Odwrotna kolejność przepuszcza ostatni przypadek.
 */
const DOMYSLNA = '/konto';

/** Znaki, które przeglądarka usuwa z adresu, zanim go zinterpretuje. */
const STERUJACE = /[\u0000-\u0020\u007f]/g;

export function sciezkaPowrotu(wartosc: unknown, domyslna: string = DOMYSLNA): string {
  if (typeof wartosc !== 'string') return domyslna;

  const czysta = wartosc.replace(STERUJACE, '');

  if (!czysta.startsWith('/')) return domyslna;
  if (czysta.startsWith('//') || czysta.startsWith('/\\')) return domyslna;

  return czysta;
}
