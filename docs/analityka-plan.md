# Analityka — tracking klientów i sprzedaży

Punkt wyjścia jest lepszy, niż wygląda: tabela `shop_events` razem z typem
zdarzeń, indeksami, politykami RLS i grantami jest wdrożona od migracji
`20260805120000_zdarzenia_sklepu`. Funkcja zapisująca `zapiszZdarzenie`
(`web/app/actions/slad.ts`) też istnieje.

**I nikt jej nie woła.** Zero wywołań w całym kodzie, zero wierszy w tabeli,
zero ekranów, które by ją czytały. Fundament został położony i zapomniany —
pierwszy etap to nie budowa, tylko podpięcie.

---

## 1. Tracking — co zbierać i gdzie to podpiąć

Typ `shop_event` ma sześć wartości i to wystarczy. Więcej zdarzeń znaczy
zwykle tyle, że nikt ich potem nie odróżnia.

| zdarzenie | gdzie podpiąć | uwaga |
|---|---|---|
| `wejscie_na_produkt` | `RecentlyViewed` (`track={product.id}`) | efekt kliencki, nie komponent serwerowy — inaczej liczyłoby się prefetchowanie Next.js i wejścia robotów |
| `szukanie` | `ShopBrowser`, pole `#szukaj` | z odbiciem 600 ms, żeby „laptop" nie dało siedmiu wierszy |
| `dodanie_do_koszyka` | `CartProvider.add` | razem z `qty` |
| `usuniecie_z_koszyka` | `CartProvider.remove` | najcenniejsze zdarzenie w całym zestawie — mówi, co ludzie odkładają |
| `wejscie_do_kasy` | `CartPage`, przy pierwszym renderze z niepustym koszykiem | licznik porzuceń liczy się z różnicy wobec zamówień |
| `zamowienie_zlozone` | `checkoutAction`, po udanym wywołaniu | **po stronie serwera** — jedyne zdarzenie, które musi być pewne |

Zasada, którą trzyma już sama funkcja: **zapis śladu nigdy nie może przerwać
zakupu.** `zapiszZdarzenie` łyka każdy wyjątek i nie zwraca błędu do interfejsu.
Statystyka jest miła, zamówienie jest ważne.

### Prywatność — decyzje już podjęte

Projekt tabeli jest świadomie ubogi i tak ma zostać:

- **bez adresu IP, bez odcisku przeglądarki, bez ciasteczka analitycznego** —
  zdarzenie niesie typ, produkt, ewentualną frazę i `user_id`, jeśli ktoś był
  zalogowany. Gość zostaje anonimowy.
- **`user_id` bierze się z sesji po stronie serwera**, nie z tego, co przyśle
  przeglądarka. Polityka `zdarzenia: zapis` i tak przepuszcza wyłącznie
  `user_id is null or user_id = auth.uid()`.
- **odczyt tylko dla zaplecza** (`orders.read_all`). Zachowania klientów nie
  są danymi publicznymi.
- **żadnego wysyłania na zewnątrz.** Bez GA, bez Piksela, bez Hotjara. Dane
  zostają w tej samej bazie co zamówienia, w tym samym regionie UE.

Co z tego wynika prawnie: brak ciasteczek analitycznych i brak profilowania to
najmocniejszy argument za tym, że **baner zgody na te zdarzenia nie jest
potrzebny**. Nie jest to jednak porada prawna — przy sklepie przyjmującym
płatności warto, żeby ktoś to potwierdził razem z regulaminem, który i tak
czeka na przejrzenie. Fraza wyszukiwania jest przycinana do 120 znaków
(wklejka to nie zapytanie), ale zdarza się, że ludzie wpisują w wyszukiwarkę
rzeczy, których nie powinni — do rozważenia okresowe czyszczenie `detail`
starszego niż kilkadziesiąt dni.

### Retencja — od razu, nie potem

`shop_events` rośnie szybciej niż `orders` o dwa rzędy wielkości. Zanim ruszy
prawdziwy ruch, warto mieć:

```sql
-- Zdarzenia surowe żyją 90 dni; agregaty dzienne zostają na zawsze.
delete from public.shop_events where created_at < now() - interval '90 days';
```

Uruchamiane `pg_cron`-em raz na dobę. Bez tego po roku widok „co się dzieje
w sklepie" będzie skanował miliony wierszy, żeby narysować siedem słupków.

---

## 2. Analiza sprzedaży — widoki SQL

Sprzedaż liczy się z `orders` i `order_items`, nie ze zdarzeń. Zdarzenia mówią
o zainteresowaniu, zamówienia o pieniądzach — mieszanie tych dwóch źródeł to
najprostsza droga do dwóch różnych liczb na jednym ekranie.

Definicja przychodu, jedna dla wszystkich widoków: **zamówienia opłacone,
nieanulowane**. Zamówienie ze statusem `oczekuje` nie jest sprzedażą, tylko
nadzieją.

```sql
-- Przychód w czasie, liczba transakcji, średnia wartość zamówienia
create or replace view public.sprzedaz_dziennie as
select
  date_trunc('day', created_at)::date as dzien,
  count(*)                            as zamowien,
  sum(total_cents)                    as przychod_cents,
  sum(total_cents) / count(*)         as srednia_cents,
  sum(discount_cents)                 as rabaty_cents,
  sum(shipping_cents)                 as dostawa_cents
from public.orders
where payment_status = 'opłacone'
  and status <> 'anulowane'
group by 1
order by 1 desc;

-- Najlepiej sprzedające się produkty
create or replace view public.sprzedaz_produktow as
select
  oi.product_id,
  oi.name,                             -- nazwa z chwili zakupu, odporna na zmiany katalogu
  sum(oi.qty)                          as sztuk,
  sum(oi.line_total_cents)             as przychod_cents,
  count(distinct oi.order_id)          as zamowien
from public.order_items oi
join public.orders o on o.id = oi.order_id
where o.payment_status = 'opłacone'
  and o.status <> 'anulowane'
group by 1, 2
order by przychod_cents desc;
```

Widoki dziedziczą RLS tabel źródłowych tylko przy `security_invoker = true` —
w Postgresie 15+ ustawia się to wprost i **trzeba to zrobić**, inaczej widok
wykonuje się z prawami właściciela i klient zobaczy cudze zamówienia:

```sql
alter view public.sprzedaz_dziennie set (security_invoker = true);
alter view public.sprzedaz_produktow set (security_invoker = true);
```

Przy `security_invoker` klient dostanie z tych widoków wyłącznie własne
zamówienia — czyli bezsensowną, ale bezpieczną statystykę. Ekran i tak jest
za `wymagajZaplecza`.

---

## 3. Zainteresowanie produktem — konwersja, nie surowe odsłony

Sama liczba odsłon nic nie mówi: produkt na stronie głównej zawsze wygra
z produktem z trzeciej kategorii. Miarą jest **stosunek odsłon do zakupów**.

```sql
create or replace view public.zainteresowanie_produktow as
with odslony as (
  select product_id, count(*) as odslon
  from public.shop_events
  where event = 'wejscie_na_produkt'
    and product_id is not null
    and created_at > now() - interval '30 days'
  group by 1
),
koszyki as (
  select product_id, count(*) as do_koszyka
  from public.shop_events
  where event = 'dodanie_do_koszyka'
    and product_id is not null
    and created_at > now() - interval '30 days'
  group by 1
),
zakupy as (
  select oi.product_id, sum(oi.qty) as kupionych
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.payment_status = 'opłacone'
    and o.status <> 'anulowane'
    and o.created_at > now() - interval '30 days'
  group by 1
)
select
  p.id,
  p.name,
  p.stock,
  coalesce(o.odslon, 0)      as odslon,
  coalesce(k.do_koszyka, 0)  as do_koszyka,
  coalesce(z.kupionych, 0)   as kupionych,
  -- Konwersja w promilach: liczba całkowita czyta się lepiej niż 0.0234
  case when coalesce(o.odslon, 0) = 0 then null
       else (coalesce(z.kupionych, 0) * 1000) / o.odslon
  end as konwersja_promile
from public.products p
left join odslony o on o.product_id = p.id
left join koszyki k on k.product_id = p.id
left join zakupy  z on z.product_id = p.id
where p.is_active
order by odslon desc;

alter view public.zainteresowanie_produktow set (security_invoker = true);
```

Trzy liczby, które warto z tego czytać:

- **dużo odsłon, mało koszyków** → problem z ceną albo z opisem produktu
- **dużo koszyków, mało zakupów** → problem z kosztem dostawy albo z kasą
- **zero odsłon przy zdrowym stanie magazynu** → produktu nie da się znaleźć

Czasu spędzonego na ekranie **nie mierzymy.** Wymagałby to bicia serca co kilka
sekund z przeglądarki — czyli setek wierszy na jedną wizytę i licznika, który
myli przewijanie z czytaniem. Stosunek odsłon do zakupów mówi to samo, kosztem
jednego wiersza.

### Odciążenie bazy

- Zdarzenia idą **jednym wstawieniem, bez odczytu** — najtańsza operacja, jaką
  Postgres zna.
- Indeksy `shop_events_czas` i `shop_events_produkt` już są.
- Raporty za dłuższe okresy liczyć z **tabeli agregatów dziennych**, nie
  z surowych zdarzeń:

```sql
create table public.zdarzenia_dziennie (
  dzien date not null,
  event public.shop_event not null,
  product_id uuid references public.products (id) on delete set null,
  ile integer not null,
  primary key (dzien, event, product_id)
);
```

Wypełniana raz na dobę `pg_cron`-em z wczorajszych zdarzeń, tuż przed
kasowaniem surowych wierszy sprzed 90 dni.

---

## 4. Panel — jeden ekran, bez biblioteki wykresów

Nowy widok `/panel/analityka`, za `wymagajZaplecza`, w stylu istniejącego
panelu produktów.

Cztery liczby na górze (kafle jak `.mag-kafel`):

- przychód 30 dni
- liczba zamówień
- średnia wartość zamówienia
- porzucone koszyki (`wejscie_do_kasy` minus `zamowienie_zlozone`)

Pod tym dwie tabele: **najlepiej sprzedające się** i **najczęściej oglądane bez
zakupu**. Druga jest ważniejsza — pierwszą właściciel i tak zna z magazynu.

**Bez biblioteki wykresów.** Sklep waży dziś ok. 102 kB JS-u plus Sentry;
dokładanie Rechartsa dla siedmiu słupków byłoby drożej niż wszystko, co ten
ekran pokazuje. Słupki rysuje się `<svg>` z serwera, kolorami z tokenów
(`--accent`, `--line`), monochromatycznie — zgodnie z
[`.claude/skills/nordo-design`](../.claude/skills/nordo-design/SKILL.md).
Komponent serwerowy, zero `'use client'`.

---

## 5. Kolejność wdrażania

1. **Podpiąć `zapiszZdarzenie` w sześciu miejscach z §1.** Jeden dzień pracy,
   po którym dane zaczynają się zbierać. Wszystko poniżej wymaga danych, więc
   ten krok idzie pierwszy i nie ma sensu go dzielić.
2. Odczekać tydzień. Bez tego każdy wykres pokazuje szum.
3. Migracja z trzema widokami z §2 i §3 (razem z `security_invoker`).
4. Ekran `/panel/analityka` — najpierw same liczby, bez słupków.
5. Tabela `zdarzenia_dziennie` + zadanie `pg_cron` na agregację i czyszczenie.
6. Słupki i tabela „oglądane bez zakupu".
7. Przejrzenie polityki prywatności pod kątem tego, co faktycznie zbieramy —
   dopiero teraz, gdy to już wiadomo, a nie na podstawie planu.

Kroki 1–2 dają wartość same z siebie. Kroki 5–6 mają sens dopiero przy ruchu,
którego sklep jeszcze nie ma.
