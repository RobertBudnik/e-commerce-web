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

**Doszła tabela przetworzonych zdarzeń operatora** (migracja
`20260920090000`).

`mark_order_paid()` jest idempotentna względem *stanu* zamówienia i to wystarcza
przy powtórce tego samego zdarzenia. Nie wystarczało, gdy operator dosłał
zdarzenia w innej kolejności albo gdy doszedł zwrot: nie było śladu, które
`event.id` już przeszły przez webhook.

```sql
create table public.platnosci_zdarzenia (
  event_id text primary key,           -- evt_... od operatora
  typ text not null,
  order_id uuid references public.orders (id) on delete set null,
  livemode boolean,
  stan text not null default 'w_toku' check (stan in ('w_toku', 'zrobione')),
  odebrane_at timestamptz not null default now(),
  zrobione_at timestamptz
);
```

Kolumna `stan` jest ważniejsza, niż wygląda, i pierwsza wersja tego planu miała
ją źle. Było tu napisane: „webhook wstawia wiersz **przed** obsługą; konflikt na
kluczu głównym znaczy »to już było«". To daje semantykę **co najwyżej raz**:
gdy funkcja padnie w połowie, ponowienie zobaczy wpis i grzecznie odpuści
zdarzenie, które nigdy nie zostało obsłużone. Przy płatności to najgorszy
możliwy wybór — cicho gubi pieniądze.

Dlatego wiersz powstaje na wejściu ze stanem `w_toku`, a dopiero udana obsługa
przestawia go na `zrobione`. Powtórka zdarzenia `zrobione` odpada bez ruszania
zamówienia; powtórka po padzie (`w_toku`) zostaje obsłużona jeszcze raz.
Wszystkie operacje pod spodem są idempotentne, więc drugie przejście niczego
nie psuje.

Tabela nie ma polityk RLS i to jest zamierzone: RLS jest włączone, więc bez
polityki nikt nie sięgnie do niej z przeglądarki. Pisze wyłącznie webhook
kluczem `service_role`, który RLS omija.

---

## 3. Zaplecze — co poprawić w funkcjach Edge

Kolejność od najpilniejszego.

- [x] **Adresy powrotu.** `success_url` i `cancel_url` wskazywały
      `/order-confirmed.html` i `/cart.html` ze statycznej wersji sklepu — obie
      dają dziś 404. Naprawione: `/zamowienie/{numer}` i `/koszyk`.
- [x] **Webhook nie umiał anulować.** `cancel_order()` sprawdza
      `authorize('orders.write')`, ta woła `current_role_name()`, a ta zwraca
      null przy pustym `auth.uid()`. Klucz `service_role` nie niesie
      użytkownika, więc webhook dostawał „Brak uprawnień", oddawał 500,
      operator ponawiał przez dobę i odpuszczał — **a zarezerwowany towar nie
      wracał na magazyn nigdy**. Potwierdzone sondą na produkcji.
      Naprawione osobną funkcją `anuluj_sesje_platnosci()`, wystawioną
      wyłącznie webhookowi; `cancel_order()` zostaje nietknięte, bo to ono
      obsługuje klienta.
- [x] **`checkout.session.completed` nie znaczy „zapłacono".** Przy metodach
      z odroczonym rozliczeniem sesja domyka się ze stanem `unpaid`,
      a pieniądze potwierdza dopiero `async_payment_succeeded`. Webhook
      oznaczał wpłatę od razu, więc zamówienie szło do realizacji przed
      zaksięgowaniem przelewu. Teraz sprawdza `payment_status` sesji.
- [x] **Kwota i waluta sprawdzane przed oznaczeniem wpłaty** — w webhooku
      wobec `orders.total_cents` i jeszcze raz w `mark_order_paid()`, po
      drugiej stronie granicy `service_role`.
- [x] **Klucz idempotencji przy zakładaniu sesji.** `Idempotency-Key: <order.id>`
      w `create-checkout`. Bez niego zerwane połączenie i ponowne dotknięcie
      „Zamawiam" zakładało drugą sesję płatności na to samo zamówienie.
- [x] **Tabela zdarzeń** z punktu 2 — `platnosci_zdarzenia`, ze znacznikiem
      zajęcia. Samo „wstaw na wejściu" gubiłoby zdarzenia po padzie w połowie
      obsługi, więc wiersz powstaje jako `w_toku` i dopiero udana obsługa
      przestawia go na `zrobione`.
- [x] **Zwroty pieniędzy.** `charge.refunded` → `oznacz_zwrot_platnosci()`.
      Zwrot częściowy zostawia stan „opłacone" — rozstrzyga o tym porównanie
      kwot, bo operator wysyła to samo zdarzenie w obu przypadkach.
      **Zdarzenie trzeba jeszcze dopisać w panelu operatora.**
- [x] **Rotacja sekretu webhooka.** Nagłówek podpisu niesie przez okno
      przejściowe kilka podpisów `v1`; `Object.fromEntries` zachowywało
      ostatni, więc w dniu rotacji połowa zdarzeń odpadłaby z 400.
- [x] **Limit składania zamówień po stronie bazy.** Zapora z `create-checkout`
      liczyła próby w funkcji brzegowej, a `create_order` jest wystawione
      gościom pod `/rest/v1/rpc`. Sesji płatności tą drogą nie da się założyć
      (testowanie kart dalej zamknięte), ale zdejmowanie stanu magazynowego
      już tak. Wyzwalacz na `orders`: dziesięć zamówień na godzinę na adres.
- [x] **Tryb endpointu (`STRIPE_TRYB`).** Podpis chroni przed obcym nadawcą,
      nie przed własną pomyłką: endpoint testowy wpięty w produkcyjny projekt
      podpisuje się poprawnie swoim sekretem.
- [x] **Wygasanie sesji a rezerwacja towaru.** `expires_at` ustawione na
      godzinę (`ZYCIE_SESJI_SEKUND`), więc porzucony koszyk zwalnia towar po
      godzinie zamiast po dobie. Działa dopiero razem z pierwszym punktem —
      bez niego zdarzenie o wygaśnięciu i tak odbijało się od uprawnień.
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
| powtórka zdarzenia | `stripe events resend <id>` | nic się nie zmienia drugi raz, w `platnosci_zdarzenia` dalej jeden wiersz |
| wygaśnięcie sesji | `stripe trigger checkout.session.expired` | zamówienie `anulowane`, **towar wraca na stan** |
| przelew w drodze | P24 w trybie testowym, sesja `unpaid` | zamówienie zostaje `oczekuje` do `async_payment_succeeded` |
| zwrot pełny | zwrot w panelu operatora | `payment_status = 'zwrócone'` |
| zwrot częściowy | zwrot części kwoty | `payment_status` zostaje `opłacone` |
| zły podpis | `curl` z podmienionym nagłówkiem | 400 „Nieprawidłowy podpis" |
| webhook przed powrotem klienta | zapłać i zamknij kartę przed przekierowaniem | zamówienie i tak opłacone |
| jedenaste zamówienie z adresu | `create_order` w pętli przez `/rest/v1/rpc` | odmowa „Za dużo zamówień" |

Przedostatni jest najważniejszy i najczęściej pomijany: powrót na stronę
sukcesu niczego nie potwierdza, potwierdza webhook.

Wiersze o wygaśnięciu, zwrocie i limicie nie wymagają Stripe'a — sprawdza je
`npm run db:test` na prawdziwym Postgresie, w tym samym kontekście
`service_role`, w którym pracuje webhook. Tam siedziała usterka, której żaden
test przez przeglądarkę by nie złapał.

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
- [ ] **Region danych.** Projekt Supabase stoi w `eu-west-1`, czyli
      **w Irlandii, a nie we Frankfurcie** — sprawdzone w panelu, wcześniej
      ten punkt mówił nieprawdę. Vercel `fra1`. Oba w UE, więc pod RODO nic
      się nie zmienia, ale polityka prywatności ma wymieniać to, co jest.
      Nie zmieniać bez przejrzenia dokumentów.

---

## Kolejność wdrażania

Punkty 1–2 są blokadami: bez nich reszta jest bezprzedmiotowa, bo sklep bez
danych sprzedawcy nie ma prawa przyjąć złotówki od konsumenta, a kod płatności
nie działa na schemacie sprzed jedenastu migracji.

1. **Dane sprzedawcy** w `web/lib/dane-sklepu.ts` → `SPRZEDAWCA` i przepisanie
   regulaminu oraz polityki prywatności na treść. Dziś strona
   `/informacje/regulamin` wyświetla klientowi instrukcję dla programisty.
2. **Wdrożenie migracji** — `Actions → Migracje na produkcję → WDRAZAM`.
   Produkcja stoi za repozytorium; brakuje m.in. `limity_poczty` (bez niej
   zapora kasy przepuszcza wszystko, bo jest napisana tak, żeby awaria licznika
   nie zamykała sklepu) i `kolejka_zadan` (bez niej nie wychodzi potwierdzenie
   zamówienia).
3. **Wdrożenie funkcji brzegowych.** `stripe-webhook` nie jest wdrożony
   w ogóle — dziś klient zapłaciłby, a zamówienie zostałoby `oczekuje`
   na zawsze:

   ```bash
   npx supabase functions deploy stripe-webhook --no-verify-jwt
   npx supabase functions deploy create-checkout
   ```

4. Klucz testowy Stripe, `stripe listen`, przeklikanie scenariuszy z §5.
5. Włączenie BLIK i Przelewy24 w panelu operatora, dopisanie `charge.refunded`
   i `charge.dispute.created` do subskrypcji endpointu.
6. Front: stan przekierowania, powrót z anulowanej płatności, „Zapłać teraz".
   To jedyne, czego ta tura nie ruszała — są to braki konwersji, nie dziury
   w bezpieczeństwie.
7. Faktury i uzupełnienie pozostałych dokumentów — równolegle, bo to nie kod.
8. Klucze `live`, `STRIPE_TRYB=live`, endpoint webhooka na domenie, pierwsze
   zamówienie na własnej karcie i sprawdzenie, czy pieniądze doszły.
