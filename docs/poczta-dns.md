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

## Ustawienia Auth na produkcji — do wyklikania w dashboardzie

`supabase/config.toml` rządzi **wyłącznie lokalnym** Supabase. Projekt hostowany
(`dziislgqexclvgdzxnqi`) czyta własne ustawienia, więc poniższe trzeba ustawić
ręcznie. Wartości dobrane pod ten sklep.

### Authentication → URL Configuration

| pole | wartość |
| :--- | :--- |
| Site URL | `https://nordo-one.vercel.app` |

Redirect URLs — **wszystkie trzy**, brak którejkolwiek to najczęstsza przyczyna
„link nie działa":

```
https://nordo-one.vercel.app/**
https://*-robertbudniks-projects.vercel.app/**
http://localhost:3000/**
```

Drugi wpis obejmuje wdrożenia podglądowe Vercela — każdy PR dostaje własny host
z hashem, więc bez wzorca link z maila wysłanego z podglądu odbije.

### Authentication → Providers → Email

| pole | wartość | dlaczego |
| :--- | :--- | :--- |
| Confirm email | **OFF** na razie | patrz tryb przejściowy wyżej; ON dopiero po wejściu domeny i czystych testach |
| Secure email change | ON | zmiana adresu potwierdzana na starym i nowym |
| Minimum password length | `8` | |
| Password requirements | małe + wielkie litery + cyfry | |
| Leaked password protection | **ON** | HaveIBeenPwned; wisiało jako zalecenie z audytu bezpieczeństwa |
| Email OTP expiration | `3600` | jedna wartość na potwierdzenie, reset i magic link — Supabase nie rozdziela tego per szablon |

### Authentication → Rate Limits

| pole | wartość | dlaczego |
| :--- | :--- | :--- |
| Emails per hour | `30` | sklep tej wielkości nie wysyła więcej; wyżej tylko podnosi szkody przy nadużyciu |
| Minimum interval between emails | `60s` | zgrane z blokadą 60 s w interfejsie „wyślij ponownie" |
| Sign up / sign in per 5 min | `30` | domyślne, wystarcza |
| Token verifications per 5 min | `30` | domyślne |

Limit Supabase jest **po adresie IP**. Limit po adresie e-mail robimy sami
w bazie — patrz migracja `limity_poczty`.

## Mail powitalny — konfiguracja

Powitanie wysyła Edge Function `mail-powitalny`, wołana **przez bazę**, a nie
przez kod strony. Wyzwalaczem jest przejście `email_confirmed_at` z pustego na
wypełnione w `auth.users`.

Dlaczego tak, a nie z route handlera: potwierdzenie bywa klikane na innym
urządzeniu i godzinę później, gdy żądania z Next.js dawno nie ma. Baza widzi
każdą drogę potwierdzenia — także tę przez Admin API i tę z panelu Supabase.

### Wdrożenie

```bash
supabase functions deploy mail-powitalny --no-verify-jwt
```

`--no-verify-jwt` jest konieczne: funkcję woła baza, która nie nosi tokenu
użytkownika. Bezpieczeństwa pilnuje wspólny sekret w nagłówku, porównywany
w stałym czasie.

### Sekrety funkcji

```bash
supabase secrets set \
  RESEND_API_KEY=re_… \
  RESEND_FROM='dwie głowy <konto@mail.twojadomena.pl>' \
  RESEND_REPLY_TO=kontakt@twojadomena.pl \
  SEKRET_POWITANIA="$(openssl rand -hex 32)" \
  PUBLICZNY_ADRES=https://nordo-one.vercel.app
```

### Wskazanie funkcji bazie

Ten sam sekret i adres funkcji muszą trafić do tabeli `konfiguracja_poczty` —
wyzwalacz nie ma dostępu do zmiennych środowiskowych. Tabela ma włączone RLS
i **zero polityk**, więc czyta ją wyłącznie funkcja wyzwalacza; wpis trzeba
zrobić z SQL Editora w dashboardzie (rola `service_role` pomija RLS):

```sql
insert into public.konfiguracja_poczty (klucz, wartosc) values
  ('adres_powitania', 'https://dziislgqexclvgdzxnqi.supabase.co/functions/v1/mail-powitalny'),
  ('sekret_powitania', 'TEN_SAM_CIAG_CO_W_SEKRET_POWITANIA')
on conflict (klucz) do update set wartosc = excluded.wartosc, zmieniono = now();
```

Brak wpisu **nie wywraca rejestracji** — wyzwalacz wtedy po prostu nic nie
wysyła. Powitanie jest miłe, ale nie jest częścią zakładania konta.

## Czego ten system nie robi

Uczciwa lista ograniczeń, żeby nie odkrywać ich przy pierwszej awarii:

- **Wiadomości Auth idą wyłącznie w HTML.** Supabase nie przyjmuje wersji
  `text/plain` obok szablonu — ma jedno pole na treść. Wersję tekstową ma
  tylko mail powitalny, bo tamtego wysyłamy sami przez Resend, a Resend
  przyjmuje `html` i `text` naraz.
- **Jeden czas życia na wszystkie linki.** Supabase trzyma jedną wartość
  `OTP expiry`, nie rozdziela jej na potwierdzenie, reset i magic link.
- **Bounce i skargi nie są zbierane.** Webhook Resend to osobna praca, sensowna
  dopiero z własną domeną.
