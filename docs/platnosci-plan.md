# Płatności — co jest, czego brakuje, w jakiej kolejności

Nordo ma już kod płatności po obu stronach: `create-checkout` zakłada sesję
u operatora, `stripe-webhook` potwierdza wpłatę i woła `mark_order_paid()`.
Ten dokument nie jest planem wdrożenia od zera — jest listą tego, co zostało
między działającym kodem a przyjmowaniem prawdziwych pieniędzy.

Podpięcie kluczy krok po kroku opisuje [STRIPE.md](../STRIPE.md); tutaj są
decyzje i braki, nie komendy.

---

## 1. Operator — decyzja

**Stripe zostaje.** Kod jest napisany pod niego, a dla polskiego sklepu
pokrywa to, co trzeba: BLIK i Przelewy24 włącza się przełącznikiem w panelu
(**Settings → Payment methods**), bez zmiany ani jednej linijki — funkcja
świadomie nie narzuca listy metod, więc operator dobiera je do kraju i waluty.

BLIK to ponad 60% płatności w polskim e-commerce. Sklep bez BLIK-a nie jest
sklepem dla polskiego klienta — to pierwsza rzecz do włączenia w panelu.

Kiedy warto przemyśleć zmianę: przy stałym obrocie prowizja u operatorów
lokalnych (Przelewy24, PayU, Tpay) bywa niższa niż u Stripe'a, zwłaszcza na
BLIK-u. **Sprawdź aktualne stawki w cennikach, zanim policzysz różnicę** —
zmieniają się częściej niż ten plik. Przy kilkudziesięciu zamówieniach
miesięcznie różnica jest w groszach i nie jest warta przepisywania integracji.

### Apple i In-App Purchase — nie dotyczy

Dwa niezależne powody:

1. **Sklep sprzedaje towar fizyczny.** Wytyczna App Store 3.1.3(e) mówi
   wprost, że zakupy konsumowane poza aplikacją mają iść **poza** IAP —
   kartą albo Apple Pay. Prowizja Apple dotyczy treści cyfrowych, nie
   elektroniki wysyłanej kurierem.
2. **Aplikacja iOS w tym repozytorium nie zawiera sklepu.** `ios/NordoMagazyn`
   to powłoka wokół `/magazyn` — cztery zakładki magazynowe, instalowana
   kablem, poza App Store. Koszyka tam nie ma i nie ma czego kupić.

Wniosek: temat IAP wraca dopiero, gdyby powstała konsumencka aplikacja Nordo
w App Store — i nawet wtedy przy towarze fizycznym odpowiedzią jest Apple Pay
przez Stripe'a, nie IAP.

---

## 2. Model danych — gotowy, jedna dziura

Jest już wszystko, czego wymaga sprzedaż jednorazowa:

| tabela / kolumna | rola |
|---|---|
| `orders.payment_status` | `oczekuje` → `opłacone` / `nieudane` / `zwrócone` |
| `orders.payment_provider` | nazwa operatora, dziś zawsze `stripe` |
| `orders.payment_intent_id` | identyfikator wpłaty; **indeks unikalny częściowy** |
| `orders.total_cents` | kwota w groszach, liczona w bazie |
| RLS `zamówienia: odczyt własnych` | klient widzi swoje, zaplecze wszystkie |

Subskrypcji nie ma i nie ma po co ich dokładać — sklep z elektroniką sprzedaje
sztuki, nie abonamenty. Gdyby kiedyś doszły, wtedy powstaje osobna tabela
`subscriptions` z `stripe_subscription_id` i `current_period_end`; dzisiaj to
byłby pusty schemat pod przyszłość, która może nie nadejść.

**Czego brakuje: tabeli przetworzonych zdarzeń operatora.**

`mark_order_paid()` jest idempotentna względem *stanu* zamówienia i to wystarcza
przy powtórce tego samego zdarzenia. Nie wystarcza, gdy operator dośle zdarzenia
w innej kolejności albo gdy dojdzie zwrot: nie ma śladu, które `event.id` już
przeszły przez webhook.

```sql
create table public.platnosci_zdarzenia (
  event_id text primary key,           -- evt_... od operatora
  typ text not null,
  order_id uuid references public.orders (id) on delete set null,
  odebrane_at timestamptz not null default now()
);
alter table public.platnosci_zdarzenia enable row level security;
-- Bez polityk: pisze wyłącznie webhook kluczem service_role, który omija RLS.
-- Odczyt dla zaplecza dopiszemy, gdy powstanie ekran historii płatności.
```

Webhook wstawia wiersz **przed** obsługą; konflikt na kluczu głównym znaczy
„to już było" i kończy 200 bez ruszania zamówienia.

---

## 3. Zaplecze — co poprawić w funkcjach Edge

Kolejność od najpilniejszego.

- [x] **Adresy powrotu.** `success_url` i `cancel_url` wskazywały
      `/order-confirmed.html` i `/cart.html` ze statycznej wersji sklepu — obie
      dają dziś 404. Naprawione: `/zamowienie/{numer}` i `/koszyk`.
- [ ] **Klucz idempotencji przy zakładaniu sesji.** `create-checkout` wysyła
      POST do Stripe'a bez nagłówka `Idempotency-Key`. Zerwane połączenie po
      stronie klienta i ponowne dotknięcie „Zamawiam" zakłada drugą sesję
      płatności na to samo zamówienie. Nagłówek `Idempotency-Key: <order.id>`
      sprawia, że operator oddaje tę samą sesję zamiast tworzyć nową.
- [ ] **Tabela zdarzeń** z punktu 2 — wstawka na wejściu do webhooka.
- [ ] **Zwroty pieniędzy.** Dziś webhook obsługuje cztery zdarzenia sesji.
      Brakuje `charge.refunded` → `payment_status = 'zwrócone'`. Bez tego
      zwrot zrobiony w panelu Stripe'a nie dociera do bazy i zamówienie
      zostaje „opłacone" na zawsze. Dopisać zdarzenie w panelu operatora
      **i** gałąź w `switch`.
- [ ] **Wygasanie sesji a rezerwacja towaru.** `create_order()` zdejmuje stan
      od razu, a `checkout.session.expired` przychodzi domyślnie po 24 godzinach.
      Przez dobę towar porzuconego koszyka jest niedostępny dla innych. Do
      rozważenia: `expires_at` na sesji ustawiony na 30–60 minut (minimum
      Stripe'a to 30 minut).
- [ ] **Anulowanie a zwrot środków.** `cancel_order()` zwraca towar na magazyn,
      ale nie dotyka `payment_status`. Po poprawce z migracji
      `20260807160000` klient nie anuluje już opłaconego zamówienia sam — robi
      to obsługa, więc zwrot pieniędzy pozostaje decyzją człowieka. Warto to
      wpisać do procedury obsługi, nie do kodu.

**Sekrety.** Zostają tam, gdzie są: `npx supabase secrets set`. Do repozytorium
nie trafia ani klucz `sk_`, ani `whsec_`. `service_role` omija RLS i jego jedyne
miejsce to funkcje Edge, gdzie wstrzykuje go platforma.

---

## 4. Front — czego brakuje klientowi

- [ ] **Stan „przekierowuję do płatności".** Dziś po udanym `checkoutAction`
      leci `window.location.href` i przez moment nic się nie dzieje. Przy wolnym
      łączu wygląda to jak zawieszony przycisk. Wystarczy zmiana napisu na
      „Przenoszę do płatności…" przed przekierowaniem.
- [ ] **Powrót z anulowanej płatności.** `cancel_url` prowadzi na `/koszyk`,
      ale koszyk jest już wtedy wyczyszczony (`clear()` leci przed
      przekierowaniem do operatora). Klient wraca do pustego koszyka mimo
      istniejącego zamówienia. Do decyzji: albo czyścić koszyk dopiero po
      potwierdzeniu, albo prowadzić `cancel_url` na `/zamowienie/{numer}`
      z komunikatem „płatność przerwana — dokończ albo anuluj".
- [ ] **Ponowienie płatności.** Zamówienie w stanie `oczekuje` nie ma dziś
      przycisku „Zapłać teraz" w panelu konta. Bez tego jedyną drogą jest
      złożenie zamówienia od nowa.
- [ ] **Wybór metody płatności** zostaje po stronie Stripe Checkout — własnego
      ekranu z kartą nie budujemy i nie wolno go budować (patrz punkt 6).

---

## 5. Testowanie

Tryb testowy jest opisany w [STRIPE.md](../STRIPE.md). Scenariusze, które muszą
przejść przed pierwszą prawdziwą złotówką:

| scenariusz | jak wywołać | czego oczekiwać |
|---|---|---|
| udana płatność kartą | `4242 4242 4242 4242` | `payment_status = 'opłacone'`, `status = 'w realizacji'`, stan magazynu zdjęty |
| karta odrzucona | `4000 0000 0000 0002` | powrót na `cancel_url`, zamówienie zostaje `oczekuje` |
| wymagane 3D Secure | `4000 0025 0000 3155` | po uwierzytelnieniu ta sama ścieżka co udana |
| BLIK | tryb testowy z panelu | jak wyżej; sprawdzić, czy metoda w ogóle się pokazuje |
| powtórka zdarzenia | `stripe events resend <id>` | nic się nie zmienia drugi raz |
| wygaśnięcie sesji | `checkout.session.expired` | `cancel_order()`, towar wraca na stan |
| zły podpis | `curl` z podmienionym nagłówkiem | 400 „Nieprawidłowy podpis" |
| webhook przed powrotem klienta | zapłać i zamknij kartę przed przekierowaniem | zamówienie i tak opłacone |

Ostatni jest najważniejszy i najczęściej pomijany: powrót na stronę sukcesu
niczego nie potwierdza, potwierdza webhook.

---

## 6. Zgodność prawna

- [ ] **Dane karty nigdy nie dotykają tego serwera.** Tak jest dziś i tak ma
      zostać: numer karty klient wpisuje na stronie operatora, sklep dostaje
      wyłącznie identyfikator wpłaty. Własny formularz karty oznacza PCI DSS
      w pełnym zakresie — i nie ma po co go zdobywać.
- [ ] **Faktury i paragony.** Sklep ich dziś nie wystawia. Najprościej:
      włączyć **Stripe Invoicing / receipts** dla potwierdzeń, a fakturę VAT
      wystawiać w programie księgowym po numerze zamówienia. Wymóg prawny,
      nie ozdoba — do ustalenia z księgowością przed startem.
- [ ] **Obowiązek informacyjny przed zapłatą.** Regulamin i polityka
      prywatności są w `web/lib/strony-informacyjne.ts` jako **rusztowanie**
      z listą „do uzupełnienia". Każda z tych stron mówi wprost, czego brakuje.
      Dokumentów nie generuje się automatem — musi je przejrzeć prawnik.
- [ ] **RODO przy płatnościach.** Stripe jest podmiotem przetwarzającym:
      trzeba go wymienić w polityce prywatności razem z hostingiem
      (Vercel), bazą (Supabase) i przewoźnikiem. Do tego umowa powierzenia
      (DPA) — u Stripe'a i Supabase akceptuje się ją w panelu.
- [ ] **Prawo odstąpienia (14 dni).** Strona `odstapienie-od-umowy` istnieje;
      zwrot pieniędzy ma nastąpić w 14 dni od oświadczenia. Dziś obieg zwrotu
      towaru jest w kodzie (`zglos_zwrot` → `przyjmij_zwrot`), ale zwrot
      **pieniędzy** robi człowiek w panelu Stripe'a. To akceptowalne przy
      obecnej skali — pod warunkiem że ktoś tego pilnuje.
- [ ] **Region danych.** Projekt Supabase w UE (Frankfurt), Vercel `fra1`.
      Zgodne z tym, co obiecuje polityka prywatności. Nie zmieniać bez
      przejrzenia dokumentów.

---

## Kolejność wdrażania

1. Klucz testowy Stripe, `stripe listen`, przeklikanie ośmiu scenariuszy z §5.
2. Włączenie BLIK i Przelewy24 w panelu operatora.
3. `Idempotency-Key` w `create-checkout`.
4. Tabela `platnosci_zdarzenia` + wstawka na wejściu webhooka.
5. Obsługa `charge.refunded`.
6. Front: stan przekierowania, powrót z anulowanej płatności, „Zapłać teraz".
7. Faktury i uzupełnienie dokumentów prawnych — równolegle, bo to nie kod.
8. Klucze `live`, endpoint webhooka na domenie, pierwsze zamówienie na własnej
   karcie i sprawdzenie, czy pieniądze doszły.
