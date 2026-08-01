# Nordo — wyjście na produkcję

Kolejność ma znaczenie: najpierw baza, potem funkcje Edge, na końcu front.
Każdy krok da się cofnąć poza jednym — `db push` na zdalnej bazie.

Czego potrzebujesz przed startem: konta Supabase, konta hostingu (poniżej
Vercel) i konta Stripe. Sekrety ustawiasz sam — nie wolno ich wklejać
do repozytorium ani do czatu.

---

## 1. Projekt Supabase w chmurze

W panelu <https://supabase.com/dashboard> załóż projekt (region: Frankfurt
albo inny w UE — dane klientów). Zapisz hasło do bazy, pokazuje się raz.

```bash
npx supabase login
npx supabase link --project-ref <ref-projektu>
```

Migracje na zdalną bazę:

```bash
npx supabase db push
```

To wgrywa schemat, polityki RLS, funkcje handlowe i kubełek na zdjęcia.
**Seeda nie wgrywamy** — `supabase/seed.sql` zakłada konta z hasłami wpisanymi
w pliku i jest wyłącznie do pracy lokalnej.

Katalog startowy na produkcji wpisujesz sam, przez panel produktów albo
zapytaniem. Konto właściciela nadajesz istniejącemu użytkownikowi po jego
rejestracji:

```sql
insert into public.user_roles (user_id, role)
select id, 'owner' from auth.users where email = 'twoj@adres.pl';
```

### Hook roli w tokenie

W panelu: **Authentication → Hooks → Customize Access Token (JWT) Claims**
i wskaż `public.custom_access_token_hook`. Bez tego każdy zalogowany widzi
sklep jako klient — polityki czytają rolę z claimu.

### Adresy powrotu

**Authentication → URL Configuration**: Site URL na domenę sklepu, do
Redirect URLs dopisz `https://twoja-domena/logowanie`.

---

## 2. Funkcje Edge i sekrety

Sekrety projektu (nie trafiają do repozytorium):

```bash
npx supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_... SITE_URL=https://twoja-domena
```

```bash
npx supabase functions deploy create-checkout
npx supabase functions deploy stripe-webhook --no-verify-jwt
```

`--no-verify-jwt` przy webhooku jest konieczne: operator płatności nie nosi
tokenu użytkownika. Autentyczność żądania potwierdza podpis HMAC.

Szczegóły podpięcia Stripe — od klucza testowego po metody płatności —
opisuje [STRIPE.md](STRIPE.md).

W panelu Stripe (**Developers → Webhooks**) dodaj endpoint:

```
https://<ref-projektu>.supabase.co/functions/v1/stripe-webhook
```

Zdarzenia: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.expired`, `checkout.session.async_payment_failed`.

BLIK i Przelewy24 włącza się w panelu Stripe (**Settings → Payment methods**),
kod nie wymaga zmian.

---

## 3. Front na Vercelu

```bash
npm i -g vercel
cd web
vercel link
```

Zmienne środowiskowe (obie publiczne, lądują w przeglądarce — dostępu pilnuje RLS):

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
```

Wartości: **Project Settings → API** w panelu Supabase. `NEXT_PUBLIC_SITE_URL`
możesz pominąć — kod bierze wtedy `VERCEL_PROJECT_PRODUCTION_URL`.

Monitorowanie błędów (opcjonalne, patrz punkt 5):

```bash
vercel env add NEXT_PUBLIC_SENTRY_DSN production
vercel env add SENTRY_ORG production
vercel env add SENTRY_PROJECT production
vercel env add SENTRY_AUTH_TOKEN production
```

```bash
vercel --prod
```

Katalog główny projektu w ustawieniach Vercela: `web`.

**Klucz `service_role` nie ma tu wstępu.** Omija RLS; jego jedyne miejsce to
sekrety funkcji Edge, gdzie trafia automatycznie.

### Własna domena

Adres `*.vercel.app` działa, ale nie wygląda jak sklep. GitHub Student Pack
daje przez Namecheap darmową domenę `.me` na rok razem z certyfikatem.

1. Odbierz domenę na <https://education.github.com/pack> → Namecheap.
2. W panelu Vercela: **Project → Settings → Domains → Add**, wpisz domenę.
   Vercel poda rekordy do ustawienia.
3. W Namecheapie (**Domain List → Manage → Advanced DNS**) wpisz to, o co
   prosi Vercel — zwykle rekord `A` dla `@` i `CNAME` dla `www`.
4. Poczekaj na propagację (zwykle minuty, w najgorszym razie kilka godzin).
   Certyfikat Vercel wystawia sam, gdy DNS się zgadza.

Po przełączeniu domeny trzy miejsca wymagają aktualizacji, inaczej sklep
działa tylko z pozoru:

| gdzie | co ustawić |
|---|---|
| Supabase → Authentication → URL Configuration | Site URL i Redirect URLs na nową domenę — inaczej logowanie odbija w pustkę |
| sekrety funkcji Edge | `npx supabase secrets set SITE_URL=https://twoja-domena` — z tego adresu buduje się powrót ze Stripe'a |
| Vercel → zmienne | `NEXT_PUBLIC_SITE_URL=https://twoja-domena`, jeśli domena ma być w sitemapie i metadanych OG |

Endpoint webhooka Stripe zostaje bez zmian: wskazuje na Supabase, nie na front.

Nagłówek HSTS z `next.config.ts` zaczyna obowiązywać dopiero teraz — zanim
go zostawisz na dwa lata (`max-age=63072000`), upewnij się, że HTTPS na
domenie działa. Cofnięcie HSTS-a wymaga odczekania całego okresu.

---

## 4. Po wdrożeniu — sprawdź, zanim ogłosisz

| co | jak |
|---|---|
| rejestracja i logowanie | załóż konto, sprawdź czy wraca sesja i czy `document.cookie` jest puste |
| rola | nadaj sobie `owner` zapytaniem wyżej, wyloguj się i zaloguj ponownie (rola siedzi w tokenie) |
| katalog | dodaj produkt ze zdjęciem w `/panel`, sprawdź czy widać go w `/sklep` |
| zamówienie | złóż zamówienie kartą testową Stripe `4242 4242 4242 4242` |
| webhook | w panelu Stripe sprawdź dostarczenie zdarzenia, w bazie `payment_status = 'opłacone'` |
| stan magazynu | po zamówieniu `stock` spada, po anulowaniu wraca |
| sitemapa | `https://twoja-domena/sitemap.xml` i `/robots.txt` |

Część z tego chodzi automatycznie: po każdym wdrożeniu Vercela workflow
`.github/workflows/dym.yml` puszcza testy dymne po adresie podglądu.
Sprawdzają wyłącznie odczyt — katalog, kartę produktu, przekierowanie
z `/konto`, nagłówki i sitemapę. Zamówień nie składają.

Ręcznie po dowolnym adresie:

```bash
E2E_BASE_URL=https://twoja-domena npm run test:smoke
```

---

## 5. Zanim wpuścisz prawdziwy ruch

- **Limity prób logowania** — `[auth.rate_limit]` w `supabase/config.toml` ma
  wartości domyślne; na produkcji ustawia się je w panelu (**Authentication →
  Rate Limits**).
- **Potwierdzanie e-maila** — lokalnie wyłączone. Po włączeniu `signUp` nie
  zwraca sesji; kod to obsługuje (komunikat o linku), ale ścieżka nie była
  przeklikana.
- **Kopie zapasowe** — plan darmowy Supabase nie robi PITR. Przy pierwszym
  prawdziwym zamówieniu warto przejść na płatny.
- **Domena i HTTPS** — nagłówek HSTS jest ustawiony w `next.config.ts`
  i zadziała dopiero po HTTPS.
- **Testy E2E** — `npm run test:e2e` przechodzi po lokalnym stacku. Przed
  wdrożeniem warto puścić je jeszcze raz; na środowisku produkcyjnym nie należy
  ich uruchamiać, bo składają prawdziwe zamówienia. Po wdrożeniu służy do tego
  `npm run test:smoke` — ten zestaw tylko czyta.
- **Monitorowanie błędów** — bez `NEXT_PUBLIC_SENTRY_DSN` Sentry jest wyłączone
  w całości: nie ładuje się w przeglądarce i nie instrumentuje serwera. Żeby je
  włączyć, załóż projekt (plan dla studentów w GitHub Student Pack), wybierz
  **Next.js** i wpisz DSN w zmiennych Vercela. `SENTRY_AUTH_TOKEN` jest
  potrzebny wyłącznie do wysyłki map źródeł — bez niego zgłoszenia dochodzą,
  tylko ze zminifikowanym śladem stosu. Klient sklepu płaci za to ~86 kB
  dodatkowego JS-u przy pierwszym wejściu.

---

## Cofanie

- Front: `vercel rollback` albo poprzednie wdrożenie w panelu.
- Funkcje: `npx supabase functions deploy <nazwa>` z poprzedniego commita.
- Baza: migracji nie cofa się automatycznie. Nowa migracja z `drop`/`alter`
  albo odtworzenie z kopii — dlatego `db push` warto puszczać po przejrzeniu
  `npx supabase db diff`.
