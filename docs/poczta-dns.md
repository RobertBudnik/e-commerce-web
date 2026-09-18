# Poczta wychodząca — Resend, DNS i deliverability

Dokument opisuje, co trzeba ustawić **poza repozytorium**, żeby sklep mógł
wysyłać pocztę transakcyjną, która dochodzi do Gmaila i nie ląduje w spamie.
Kodu to nie dotyczy — wartości wklejasz u rejestratora domeny i w panelu
Resend, a nazwy zmiennych środowiskowych są na końcu.

## Dlaczego nie wbudowany mailer Supabase

Wbudowany mailer ma limit rzędu kilku wiadomości na godzinę i wysyła z domeny
Supabase. Od 2024 r. Gmail i Yahoo wymagają od nadawców masowych SPF, DKIM
i DMARC, a pocztę bez wyrównanej domeny traktują jako podejrzaną. Wbudowany
mailer nadaje się wyłącznie do lokalnego dewelopmentu, gdzie i tak przechwytuje
ją Inbucket.

## Stan dzisiejszy: tryb przejściowy, bez własnej domeny

Dopóki nie ma domeny, wysyłamy z `onboarding@resend.dev` — adresu testowego
Resend. **Trzeba wiedzieć, czego to nie potrafi:**

| rzecz | w trybie przejściowym |
| :--- | :--- |
| dostarczenie na dowolny adres | **nie** — wyłącznie na adres właściciela konta Resend |
| `SPF`, `DKIM` w nagłówkach | przechodzą, ale dla `resend.dev` |
| wyrównanie `DMARC` z marką | **nie** — domeną nadawcy jest `resend.dev`, nie nasza |
| ocena mail-tester.com | **niewykonalna** — mail-tester daje losowy adres, Resend go nie obsłuży |
| prawdziwa rejestracja klienta | **nie** |

Wniosek: `Confirm email` w Supabase zostaje **wyłączone**, dopóki domena nie
wejdzie. Inaczej pierwszy klient z ulicy założy konto, nie dostanie linku
i zostanie z martwym kontem.

## Kiedy będzie domena

### Krok 1. Subdomena wysyłkowa, nie domena główna

W Resend dodaj **`mail.twojadomena.pl`**, a nie `twojadomena.pl`.

Powód jest jeden i praktyczny: reputacja nadawcy przykleja się do domeny, z
której wychodzi poczta. Jeśli kampania trafi w filtry, na subdomenie ucierpi
tylko poczta transakcyjna sklepu — korespondencja firmowa z domeny głównej
zostaje nietknięta. Rozdzielenie jest darmowe i nieodwracalnie tanie; sklejenie
z powrotem kosztuje miesiące odbudowy reputacji.

### Krok 2. Rekordy DNS

Resend generuje własny klucz DKIM przy dodaniu domeny — **wartości `p=…` nie da
się podać z góry**, przepisujesz ją z panelu. Region dobrany pod bazę, która
stoi w `eu-west-1`.

| nazwa | typ | wartość | priorytet | TTL |
| :--- | :--- | :--- | :--- | :--- |
| `send.mail` | `MX` | `feedback-smtp.eu-west-1.amazonses.com` | `10` | 3600 |
| `send.mail` | `TXT` | `v=spf1 include:amazonses.com ~all` | — | 3600 |
| `resend._domainkey.mail` | `TXT` | `p=…` ← **z panelu Resend** | — | 3600 |
| `_dmarc.mail` | `TXT` | `v=DMARC1; p=none; rua=mailto:dmarc@twojadomena.pl; adkim=r; aspf=r` | — | 3600 |

Uwagi, które oszczędzają godzinę szukania:

- Nazwy są **względne wobec domeny w panelu rejestratora**. Jeśli panel oczekuje
  pełnej nazwy, wpisz `send.mail.twojadomena.pl` itd.
- **Nie dokładaj drugiego rekordu SPF.** Domena może mieć dokładnie jeden
  `v=spf1`. Jeśli na `send.mail` już coś stoi, scal `include:` w istniejący
  wpis, nie dopisuj kolejnej linii.
- `p=none` to polityka startowa: raportuje, ale niczego nie odrzuca. Zaostrzaj
  dopiero po tygodniu czystych raportów — najpierw `p=quarantine; pct=10`,
  potem w górę. Wejście od razu na `p=reject` wycina własną pocztę, zanim
  zdążysz zobaczyć, co jest źle skonfigurowane.
- `adkim=r`/`aspf=r` to wyrównanie swobodne — subdomena zdaje wobec domeny
  organizacyjnej. Przy `s` (ścisłym) wysyłka z `send.mail` nie wyrówna się
  z `mail` i DMARC padnie.

### Krok 3. Weryfikacja

W panelu Resend „Verify DNS Records". Propagacja bywa natychmiastowa, bywa
godzinna. Sprawdzenie z konsoli:

```bash
dig +short TXT send.mail.twojadomena.pl
dig +short TXT resend._domainkey.mail.twojadomena.pl
dig +short TXT _dmarc.mail.twojadomena.pl
dig +short MX  send.mail.twojadomena.pl
```

### Krok 4. Adres nadawcy

| pole | wartość |
| :--- | :--- |
| `From` | `dwie głowy <konto@mail.twojadomena.pl>` |
| `Reply-To` | prawdziwa skrzynka, którą ktoś czyta |

`From` i `Reply-To` celowo różne: `From` jest na subdomenie wysyłkowej, więc
DKIM się wyrównuje, a odpowiedzi klientów trafiają tam, gdzie ktoś na nie
odpisze. Adres w `From` nie musi przyjmować poczty, ale **nie może być**
`noreply@` — to sygnał dla filtrów i dla człowieka, że rozmowa jest
jednostronna.

## SMTP w Supabase

Auth → Project Settings → Authentication → SMTP Settings:

| pole | wartość |
| :--- | :--- |
| Host | `smtp.resend.com` |
| Port | `465` (SSL) — `587` jeśli port 465 jest gdzieś blokowany |
| Username | `resend` |
| Password | klucz API z Resend (`re_…`) |
| Sender email | adres z tabeli wyżej |
| Sender name | `dwie głowy` |

## Zmienne środowiskowe

Wyłącznie po stronie serwera. **Żadna nie może dostać prefiksu
`NEXT_PUBLIC_`** — ten prefiks wkłada wartość do paczki wysyłanej do
przeglądarki.

| nazwa | do czego | gdzie ustawić |
| :--- | :--- | :--- |
| `RESEND_API_KEY` | wysyłka maila powitalnego | Vercel + Supabase Edge Functions |
| `RESEND_FROM` | nadawca, np. `dwie głowy <konto@mail.…>` | tam samo |
| `RESEND_REPLY_TO` | skrzynka do odpowiedzi | tam samo |
| `SUPABASE_SERVICE_ROLE_KEY` | tylko jeśli mail powitalny pójdzie z Next.js | **nie jest potrzebny** przy wariancie z Edge Function |

## Bounce i skargi

Gdy domena wejdzie, dołóż w Resend webhook na `email.bounced`
i `email.complained`. Bez tego adresy, które odbijają, zostają na liście
i reputacja domeny osuwa się po cichu — zobaczysz to dopiero wtedy, gdy poczta
zacznie masowo lądować w spamie. To osobna praca, poza tą fazą.
