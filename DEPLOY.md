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

```bash
vercel --prod
```

Katalog główny projektu w ustawieniach Vercela: `web`.

**Klucz `service_role` nie ma tu wstępu.** Omija RLS; jego jedyne miejsce to
sekrety funkcji Edge, gdzie trafia automatycznie.

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
- **Statyczna wersja** w katalogu głównym repozytorium nie jest przeznaczona
  do wystawienia: przy `BACKEND_ENABLED = false` rolę da się podmienić
  w `localStorage`. Wystawiamy wyłącznie `web/`.

---

## Cofanie

- Front: `vercel rollback` albo poprzednie wdrożenie w panelu.
- Funkcje: `npx supabase functions deploy <nazwa>` z poprzedniego commita.
- Baza: migracji nie cofa się automatycznie. Nowa migracja z `drop`/`alter`
  albo odtworzenie z kopii — dlatego `db push` warto puszczać po przejrzeniu
  `npx supabase db diff`.
