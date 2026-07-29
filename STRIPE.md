# Stripe — podpięcie płatności

Klucze ustawiasz sam. Nie trafiają do repozytorium ani do rozmowy z asystentem:
klucz sekretny pozwala pobierać płatności w Twoim imieniu.

Kod jest gotowy po obu stronach — brakuje wyłącznie wartości:

| element | plik | co robi |
|---|---|---|
| tworzenie sesji płatności | `supabase/functions/create-checkout/index.ts` | po `create_order()` zakłada Stripe Checkout i oddaje adres bramki |
| potwierdzenie płatności | `supabase/functions/stripe-webhook/index.ts` | weryfikuje podpis HMAC i woła `mark_order_paid()` albo `cancel_order()` |

---

## Lokalnie — tryb testowy

### 1. Klucz testowy

Panel Stripe → **Developers → API keys** → *Secret key* w trybie **Test**
(zaczyna się od `sk_test_`). Klucza publikowalnego (`pk_`) ten projekt nie
używa — sesję zakłada serwer.

```bash
cp supabase/functions/.env.example supabase/functions/.env
```

Wpisz `STRIPE_SECRET_KEY=sk_test_...` i zostaw `STRIPE_WEBHOOK_SECRET` pusty
na razie. `SITE_URL` ustaw na `http://localhost:3000` (wersja Next.js).

Plik jest w `.gitignore` i ma tam zostać.

### 2. Restart stacku

CLI wczytuje `supabase/functions/.env` przy starcie, więc po zmianie:

```bash
npm run db:stop && npm run db:start
```

### 3. Webhook na lokalną maszynę

Stripe nie dosięgnie `127.0.0.1`, więc zdarzenia trzeba przekierować:

```bash
brew install stripe/stripe-cli/stripe
stripe login
```

```bash
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
```

Komenda wypisze `whsec_...` — to wartość `STRIPE_WEBHOOK_SECRET`. Wpisz ją do
`supabase/functions/.env` i zrestartuj stack jeszcze raz. `stripe listen`
musi działać przez cały czas testów.

### 4. Zamówienie testowe

W sklepie dodaj produkt do koszyka i złóż zamówienie. Powinno przerzucić na
stronę Stripe. Karta testowa:

```
4242 4242 4242 4242 · dowolna data w przyszłości · dowolny CVC
```

Po zapłacie wracasz na `/zamowienie/NOR-...`. Sprawdź:

- w oknie `stripe listen` widać `checkout.session.completed`
- w bazie `orders.payment_status = 'opłacone'`, `status = 'w realizacji'`
- ponowne wysłanie tego samego zdarzenia (`stripe events resend <id>`) niczego
  nie psuje — `mark_order_paid()` jest idempotentne

Anulowanie płatności (`checkout.session.expired`) zwraca towar na magazyn.

---

## Produkcja

Klucze **live** ustawia się sekretami projektu, nie plikiem:

```bash
npx supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_... SITE_URL=https://twoja-domena
```

Endpoint w panelu Stripe (**Developers → Webhooks → Add endpoint**):

```
https://<ref-projektu>.supabase.co/functions/v1/stripe-webhook
```

Zdarzenia do subskrypcji:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.expired`
- `checkout.session.async_payment_failed`

Funkcja webhooka musi być wdrożona bez weryfikacji JWT — Stripe nie nosi tokenu
użytkownika, autentyczność potwierdza podpis:

```bash
npx supabase functions deploy stripe-webhook --no-verify-jwt
npx supabase functions deploy create-checkout
```

BLIK, Przelewy24 i raty włącza się w panelu Stripe (**Settings → Payment
methods**). Kod nie narzuca listy metod — przy pustej Stripe sam dobiera je
do kraju i waluty.

---

## Bez klucza też działa

Puste `STRIPE_SECRET_KEY` to świadomy tryb pracy lokalnej: `create-checkout`
zakłada zamówienie, rezerwuje towar i zwraca numer bez adresu bramki, a klient
ląduje na stronie potwierdzenia ze statusem „oczekuje". Cała ścieżka zakupu
jest wtedy przeklikiwalna bez konta Stripe — i tak była testowana do tej pory.
