# Audyt logiki sklepu — mapa wywołań

Dokument w budowie. Ta część jest zweryfikowana: powstała z odczytu kodu,
nie z pamięci. Sekcje oznaczone **DO ZROBIENIA** czekają na kolejne przejście.

## Skala

| warstwa | rozmiar |
|---|---|
| funkcje SQL w `public` | 30 |
| akcje serwerowe (`web/app/actions/`) | 10 plików, 1135 linii |
| `web/lib/queries.ts` | 1054 linie |
| migracje | 33, wszystkie wdrożone na produkcji |
| ekrany magazynu | 7 |

## Kto wywołuje co

Zestawienie z `grep` po `rpc('…')` w każdym pliku akcji. Puste pole znaczy,
że plik nie sięga do funkcji bazy wcale — pracuje na zwykłych zapytaniach
albo na Auth.

| akcja | wywoływane funkcje SQL |
|---|---|
| `account.ts` | `cancel_order`, `ustaw_stan_zamowienia` |
| `magazyn.ts` | `koryguj_stan`, `nadaj_przesylke`, `przyjmij_zwrot`, `ustaw_stan_zamowienia` |
| `panel.ts` | `nadaj_paczke`, `nadaj_role`, `potwierdz_doreczenie`, `ustaw_stan_zamowienia` |
| `shop.ts` | `quote_order`, `zglos_zwrot` |
| `opinie.ts` | `dodaj_opinie` |
| `auth.ts` | — |
| `catalog.ts` | — |
| `checkout.ts` | — |
| `skan.ts` | — |
| `slad.ts` | — |

### Pierwsze wnioski

**`ustaw_stan_zamowienia` ma trzech wywołujących** — `account.ts` (klient
anuluje), `magazyn.ts` (magazynier pakuje i wysyła) i `panel.ts` (obsługa
zmienia ręcznie). To jedyne miejsce w tej mapie, gdzie trzy różne role
sięgają po tę samą funkcję. Granice stanów muszą więc siedzieć w niej samej,
nie w interfejsie — sprawdzenie tego jest pierwszą rzeczą do zrobienia.

**`checkout.ts` nie woła żadnej funkcji SQL.** Płatność idzie przez funkcję
brzegową Supabase (`supabase/functions/create-checkout`) i webhook Stripe'a
(`stripe-webhook`), a te są poza tą mapą. Osobne przejście.

**`queries.ts` nie ma ani jednego `rpc(`.** Czyli odczyty idą wyłącznie
przez zapytania i widoki — cała logika zapisu siedzi w akcjach. To dobra
granica i warto ją utrzymać.

## DO ZROBIENIA

- [ ] Funkcje bez wywołania z aplikacji — pierwszy przebieg skryptem dał
      wynik niewiarygodny (pusty po obu stronach). Powtórzyć uczciwie,
      z listą 30 nazw wprost, i sprawdzić też wywołania z wnętrza innych
      funkcji SQL oraz z wyzwalaczy.
- [ ] Granice stanów zamówienia — czy `ustaw_stan_zamowienia` pilnuje
      przejść, czy tylko zapisuje. Sprawdzić sondą SQL, nie z interfejsu.
      Patrz zasada: ukryty przycisk to nie zabezpieczenie.
- [ ] RLS — które tabele puszczają odczyt szerzej, niż trzeba.
- [ ] `take_stock` / `return_stock` / `adjust_stock` / `koryguj_stan` —
      cztery funkcje ruszają stanem. Ustalić, która jest kanoniczna
      i czy któraś nie jest pozostałością.
- [ ] Ścieżka płatności: `create-checkout`, `stripe-webhook`,
      `mark_order_paid` — kto komu ufa i co się dzieje przy powtórce
      webhooka.
- [ ] Dziennik audytu — czy `zapisz_w_dzienniku` jest wołany ze wszystkich
      operacji zmieniających, czy tylko z części.
