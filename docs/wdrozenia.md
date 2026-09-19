# Wdrożenia, schemat i zakres PCI

Notatka o tym, co w tym sklepie wdraża się samo, co trzeba wdrożyć ręcznie
i czego lepiej nie dotykać bez zastanowienia.

---

## Dwa tory wdrożenia, tylko jeden automatyczny

| co | czym | kiedy |
|---|---|---|
| aplikacja (Next.js) | Vercel | **samo**, przy każdym scaleniu do `main` |
| migracje bazy | `.github/workflows/migracje.yml` | **ręcznie**, przyciskiem |
| funkcje brzegowe | `supabase functions deploy` | **ręcznie**, z laptopa |

To jest źródło jedynej poważnej awarii, jaką ten projekt do tej pory miał.

**19.09.2026** produkcja stała siedem migracji za repozytorium. Kod wołał
funkcje `katalog_szukaj` i `najnizsza_cena_30dni`, których w produkcyjnej
bazie nie było — bo nikt nigdy nie zrobił `db push`. Zmierzone:

```
katalog_szukaj         HTTP 404  PGRST202
najnizsza_cena_30dni   HTTP 404  PGRST202
```

Wyszukiwarka oddawałaby stronę błędu. Nie zauważył tego nikt, bo produkcję
zasłaniał Attack Challenge Mode.

**Wniosek, który warto zapamiętać:** zielone CI mówi wyłącznie o tym, że kod
działa na *świeżej* bazie zbudowanej z zera na czas testów. O produkcyjnym
schemacie nie mówi nic.

### Jak sprawdzić rozjazd bez zgadywania

```bash
curl -s https://nordo-one.vercel.app/api/zdrowie | python3 -m json.tool
```

Sonda odpowiada, czy baza żyje, czy kolejka drenuje i **czego brakuje
w schemacie**. `stan: degradacja` z niepustą listą w `schemat.brakuje`
znaczy dokładnie jedno: uruchom wdrożenie migracji.

---

## Migracje wstecznie zgodne (expand / contract)

Aplikacja i baza nigdy nie zmieniają się w tej samej sekundzie. Zawsze jest
okno, w którym **stary kod rozmawia z nowym schematem** albo odwrotnie.
Migracja, która o tym nie pamięta, wywraca sklep w środku wdrożenia.

Stąd trzy kroki zamiast jednego. Zmiana nazwy kolumny `short` → `opis_krotki`:

**1. Expand** — dołóż, nie ruszaj starego
```sql
alter table products add column opis_krotki text;
update products set opis_krotki = short;
-- wyzwalacz utrzymujący obie kolumny w zgodzie
```
Stary kod dalej czyta `short` i działa.

**2. Migracja kodu** — aplikacja zaczyna pisać i czytać `opis_krotki`.
Wdrażana osobno, po tym jak krok 1 jest już na produkcji.

**3. Contract** — dopiero teraz kasuj stare
```sql
alter table products drop column short;
```
Wykonywane, gdy żadna żyjąca wersja aplikacji już o `short` nie pyta.

Między krokiem 2 a 3 powinien minąć co najmniej jeden dzień. To nie jest
przesada — to czas na zauważenie, że krok 2 czegoś nie przewidział, póki
wycofanie jest jeszcze możliwe.

**Czego nigdy nie robimy w jednej migracji:** `drop column`, `rename column`,
`alter type` zawężającego typ i `add column not null` bez wartości domyślnej
na tabeli z danymi.

---

## Zakres PCI DSS

Sklep używa **hostowanej kasy Stripe'a** — klient jest przekierowywany na
`checkout.stripe.com`, wpisuje kartę tam i wraca. Numer karty nigdy nie
przechodzi przez nasz serwer, naszą przeglądarkę ani nasze logi.

To daje **SAQ-A** — najlżejszy wariant samooceny, kilkanaście pytań,
bez skanów ASV i bez testów penetracyjnych.

**Co wyrzuca nas z SAQ-A do SAQ-A-EP** (około 190 pytań, kwartalne skany
zewnętrzne, istotny koszt roczny):

- własny formularz karty na naszej domenie (Stripe Elements, Payment Element)
- dowolny skrypt na stronie, z której zbierane są dane karty
- pośredniczenie w danych karty „tylko do przekazania dalej"

Dlatego przejście na wbudowany formularz płatności **nie jest decyzją
o wyglądzie**. To decyzja o zakresie zgodności i o pieniądzach. Jeśli
kiedyś ma to nastąpić, najpierw policz koszt SAQ-A-EP, potem projektuj.

Praktyczne skutki dla codziennej pracy:

- nigdy nie logujemy ciał żądań z endpointów płatności
- nie dokładamy skryptów firm trzecich na `/koszyk` bez zastanowienia
- `STRIPE_SECRET_KEY` żyje wyłącznie w sekretach funkcji brzegowych

---

## Co jest zarządzane, a czego musimy pilnować sami

Warto to rozumieć, bo połowa list „co musi umieć chmurowy sklep" dotyczy
rzeczy, które w tym stosie są już kupione w cenie usługi.

**Robi za nas platforma:**

| rzecz | kto |
|---|---|
| autoskalowanie | Vercel (funkcje bezserwerowe) |
| CDN i cache brzegowy | Vercel |
| WAF, ochrona DDoS | Vercel |
| certyfikaty TLS i odnowienia | Vercel |
| pula połączeń do Postgresa | Supabase (PostgREST ma własną) |
| kopie zapasowe bazy i PITR | Supabase |
| magazyn obiektowy na zdjęcia | Supabase Storage |
| przetwarzanie obrazów (WebP/AVIF) | `next/image` |

Z tego wynika, że Docker, Kubernetes, ECS, RDS Proxy, osobny Redis i Terraform
**nie są tu brakami**. Byłyby kosztem utrzymaniowym bez ani jednej sprzedaży
w zamian.

**Zostaje na nas:**

- wdrażanie migracji (patrz wyżej — to jest ten ważny)
- wdrażanie funkcji brzegowych i ich sekretów
- idempotencja płatności i spójność stanów magazynowych
- kolejka zadań w tle i jej drenowanie
- obserwowalność: Sentry, sonda zdrowia, alarmy
- zgodność: Omnibus, RODO, prawo odstąpienia
- FinOps — Vercel i Supabase skalują się też w górę rachunku

---

## Kolejność przy wdrażaniu zmiany dotykającej bazy

1. Scal PR — aplikacja wchodzi na Vercela sama
2. Uruchom **Migracje na produkcję** (Actions → przycisk → wpisz `WDRAZAM`)
3. Gdy zmiana dotyczy funkcji brzegowych:
   ```bash
   supabase functions deploy zadania --no-verify-jwt
   supabase functions deploy stripe-webhook --no-verify-jwt
   supabase functions deploy alert-magazyn --no-verify-jwt
   supabase functions deploy mail-powitalny --no-verify-jwt
   ```
4. Sprawdź sondę:
   ```bash
   curl -s https://nordo-one.vercel.app/api/zdrowie | python3 -m json.tool
   ```
   Cel: `"stan": "ok"`.

Punkt 1 przed 2 jest bezpieczny wyłącznie przy migracjach wstecznie
zgodnych. Przy zmianie łamiącej — najpierw baza, potem kod.
