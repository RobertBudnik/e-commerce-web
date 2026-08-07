# Vercel — lista kontrolna

Stan na sierpień 2026. Projekt: Next.js 15 App Router, region `fra1`,
bez API routes — cała komunikacja idzie przez Server Actions.

## Sekrety

- [x] `NEXT_PUBLIC_*` to zmienne **publiczne** — lądują w bundlu przeglądarki.
      Klucz `anon` może tam być, bo dostępu pilnuje RLS. `service_role` nigdy.
- [x] `.env.local` i `supabase/functions/.env` w `.gitignore`.
- [x] `SENTRY_AUTH_TOKEN` tylko w zmiennych środowiskowych Vercela, nie w repo.
- [ ] Zmienne rozdzielone na Production / Preview / Development. Podgląd nie ma
      powodu pisać do produkcyjnej bazy.

## Server Actions

Server Actions to publiczne punkty końcowe — nie są chronione tym, że nie ma
do nich linku. Każda akcja musi sama sprawdzić uprawnienia.

- [x] `allowedOrigins` zawężone; adresy prywatne wpuszczone tylko po to, żeby
      telefon dogadał się z serwerem deweloperskim w sieci lokalnej.
- [x] Limit `bodySizeLimit` podniesiony świadomie do 6 MB pod zdjęcia; kubełek
      i tak tnie na 5 MB.
- [ ] **Limit zapytań na akcjach zapisujących.** Od Next.js 15.5 zapora Vercela
      potrafi celować w konkretną nazwę akcji. Bez tego `checkoutAction`
      i logowanie stoją otworem na maszynowe próby.

      Tego nie da się ustawić z repozytorium — reguły żyją w panelu projektu
      (Firewall → Custom Rules). Do założenia trzy:

      | reguła | warunek | limit | akcja |
      |---|---|---|---|
      | `logowanie` | Path równa się `/logowanie` **i** Method = POST | 10 / 60 s na IP | Challenge |
      | `zamowienie` | Server Action = `checkoutAction` | 20 / 60 s na IP | Deny |
      | `akcje-ogolne` | Method = POST **i** Path zaczyna się od `/` | 120 / 60 s na IP | Log, potem Deny |

      Ostatnią zostawić najpierw na `Log` i podnieść do `Deny` po tygodniu
      obserwacji — inaczej pierwszy skok ruchu obetnie prawdziwych klientów.

      Osobno, w Supabase: Auth → Rate Limits pilnuje prób logowania po stronie
      dostawcy tożsamości i działa niezależnie od zapory Vercela.

      Świadomie **nie** dokładamy licznika w `middleware.ts`. Funkcje brzegowe
      są nietrwałe i rozproszone, więc licznik w pamięci procesu łapałby tylko
      część ruchu, a wyglądałby jak zabezpieczenie. Lepiej nie mieć go wcale
      niż mieć pozorny.

Źródło: [Vercel — Server Actions w zaporze](https://vercel.com/changelog/manage-next-js-server-actions-in-the-vercel-firewall),
[Add Rate Limiting with Vercel](https://vercel.com/kb/guide/add-rate-limiting-vercel).

## Zapora i boty

- [ ] Reguła ograniczająca ruch na `/logowanie` i akcji składającej zamówienie.
- [ ] BotID albo wyzwanie na endpointach uwierzytelniania — zapora Vercela
      rozsyła reguły po sieci brzegowej w ~300 ms, więc reakcja jest natychmiastowa.
- [x] Sentry przez tunel `/monitoring` — blokada reklam nie ucina zgłoszeń.

Źródło: [Vercel Bot Management](https://vercel.com/docs/bot-management).

## Nagłówki

Ustawione w `web/next.config.ts`:

- [x] `X-Frame-Options: DENY`
- [x] `X-Content-Type-Options: nosniff`
- [x] `Referrer-Policy: strict-origin-when-cross-origin`
- [x] `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [x] `Strict-Transport-Security: max-age=63072000; includeSubDomains`
- [ ] **Brak `Content-Security-Policy`.** Sklep ładuje skrypt motywu inline,
      więc CSP wymaga `nonce` przez middleware. Do zrobienia świadomie, nie
      przy okazji — źle napisane CSP wywala stronę ciszej niż jego brak.

> **Uwaga: `Permissions-Policy: camera=()` blokuje aparat na całej domenie.**
>
> Zmierzone: w silniku Blink `document.permissionsPolicy.allowsFeature('camera')`
> zwraca `false` — skaner w Chrome i na Androidzie nie ma prawa ruszyć.
> WebKit nie wystawia tego API i najwyraźniej dziś nagłówka nie egzekwuje,
> dlatego skaner w powłoce działa. To nie jest gwarancja na przyszłość:
> nagłówek mówi coś przeciwnego niż intencja funkcji, więc każde
> uszczelnienie WebKitu wyłączy skaner bez zmiany w kodzie.
>
> Poprawka: `camera=(self)`.

## CORS

Nie dotyczy: klient mobilny to `WKWebView` na tej samej domenie co sklep.
Gdyby kiedyś doszedł prawdziwy klient natywny wołający API wprost, CORS
konfiguruje się przy funkcjach brzegowych Supabase, nie przy Vercelu.

## Wydajność

- [x] Region `fra1` — najbliżej polskich klientów i tej samej strefy co baza.
- [x] Mapy źródeł wysyłane do Sentry i **kasowane** z serwera.
- [x] Sentry wchodzi tylko przy obecnym DSN; w trybie deweloperskim wtyczka
      buildowa potrafi rozciągnąć kompilację do dziesiątek sekund.
- [ ] `next build` raportuje rozmiar pierwszego ładowania — próg dla sklepu
      warto zapisać i pilnować w CI.

## Wdrożenie

- [x] Testy dymne po adresie podglądu (`.github/workflows/dym.yml`), wyłącznie
      odczyt — bezpieczne na produkcji.
- [x] CodeQL tygodniowo.
- [ ] Wersja Next.js pilnowana: dziś `15.5.22`, wydany jest `16.3.0`.
      `npm audit` czysty, ale gałąź 15.x ma ograniczony czas wsparcia.
