# Praca w Codespaces

Kontener wstaje z Node 20 i Dockerem w środku, więc lokalny Supabase działa
tak samo jak na własnej maszynie. Zależności instalują się same po utworzeniu.

## Start

```bash
npm run db:start
```

```bash
npm run dev
```

Porty 3000 (sklep) i 54323 (Studio) są przekierowane — Codespaces pokaże
adresy w zakładce **Ports**.

## Logowanie w Codespaces

Adres sklepu nie jest tu `http://localhost:3000`, tylko wygenerowanym adresem
`*.app.github.dev`. Supabase Auth odrzuca przekierowania spoza swojej listy,
więc przed `db:start` podaj mu ten adres:

```bash
export SITE_URL="https://$CODESPACE_NAME-3000.$GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN"
```

`db:start` i `db:reset` czytają `SITE_URL` oraz `ADDITIONAL_REDIRECT_URL` —
bez tego logowanie kończy się odbiciem na stronę główną.

Do tego port 3000 domyślnie jest prywatny; ustaw mu widoczność **Public**
w zakładce Ports, jeśli chcesz pokazać sklep komuś z zewnątrz.

## Testy

```bash
npm run db:test
```

```bash
npm run test:e2e
```

Playwright potrzebuje przeglądarki — za pierwszym razem:

```bash
npx --prefix web playwright install --with-deps chromium
```

## Koszt

Student Pack daje 90 rdzeniogodzin miesięcznie. Maszyna 4-rdzeniowa zjada je
w tempie 4 na godzinę, czyli ~22 godziny pracy. Zatrzymuj codespace po sesji —
sam usypia dopiero po 30 minutach bezczynności.
