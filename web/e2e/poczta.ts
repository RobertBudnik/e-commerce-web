/**
 * Odczyt poczty złapanej przez lokalny Supabase.
 *
 * Supabase podnosi obok bazy łapacz poczty na porcie 54324. Nowsze wersje CLI
 * dają tam Mailpit, starsze Inbucket — a te dwa mają różne API. Zamiast
 * zgadywać, która wersja stoi na maszynie i w CI, pytamy obie i bierzemy tę,
 * która odpowie. Koszt to jedno dodatkowe żądanie przy pierwszym użyciu;
 * zysk — zestaw, który nie wywraca się po podbiciu CLI.
 */
const POCZTA = process.env.E2E_POCZTA_URL ?? 'http://127.0.0.1:54324';

export type Wiadomosc = { temat: string; html: string; tekst: string };

async function json(url: string): Promise<unknown | null> {
  try {
    const odpowiedz = await fetch(url);
    if (!odpowiedz.ok) return null;
    return await odpowiedz.json();
  } catch {
    return null;
  }
}

/** Mailpit: lista wszystkich wiadomości, filtrowana po odbiorcy. */
async function zMailpita(adres: string): Promise<Wiadomosc | null> {
  const lista = (await json(`${POCZTA}/api/v1/messages?limit=50`)) as
    | { messages?: { ID: string; To?: { Address?: string }[]; Subject?: string }[] }
    | null;
  if (!lista?.messages) return null;

  const trafienie = lista.messages.find((m) =>
    (m.To ?? []).some((o) => o.Address?.toLowerCase() === adres.toLowerCase())
  );
  if (!trafienie) return null;

  const pelna = (await json(`${POCZTA}/api/v1/message/${trafienie.ID}`)) as
    | { HTML?: string; Text?: string }
    | null;
  if (!pelna) return null;

  return { temat: trafienie.Subject ?? '', html: pelna.HTML ?? '', tekst: pelna.Text ?? '' };
}

/** Inbucket: skrzynka nazwana częścią adresu przed małpą. */
async function zInbucketa(adres: string): Promise<Wiadomosc | null> {
  const skrzynka = adres.split('@')[0]!;
  const lista = (await json(`${POCZTA}/api/v1/mailbox/${skrzynka}`)) as
    | { id: string; subject?: string }[]
    | null;
  if (!Array.isArray(lista) || lista.length === 0) return null;

  const ostatnia = lista[lista.length - 1]!;
  const pelna = (await json(`${POCZTA}/api/v1/mailbox/${skrzynka}/${ostatnia.id}`)) as
    | { body?: { html?: string; text?: string }; header?: { Subject?: string[] } }
    | null;
  if (!pelna) return null;

  return {
    temat: pelna.header?.Subject?.[0] ?? ostatnia.subject ?? '',
    html: pelna.body?.html ?? '',
    tekst: pelna.body?.text ?? '',
  };
}

/**
 * Czeka na wiadomość dla tego adresu.
 *
 * Wysyłka idzie przez SMTP, a więc poza transakcją żądania — odpowiedź
 * z formularza wraca, zanim list dotrze do łapacza. Odpytywanie jest tu
 * jedynym uczciwym rozwiązaniem: nie ma czego nasłuchiwać.
 */
export async function poczekajNaList(adres: string, limitMs = 20_000): Promise<Wiadomosc> {
  const koniec = Date.now() + limitMs;

  while (Date.now() < koniec) {
    const wiadomosc = (await zMailpita(adres)) ?? (await zInbucketa(adres));
    if (wiadomosc) return wiadomosc;
    await new Promise((gotowe) => setTimeout(gotowe, 500));
  }

  throw new Error(
    `Nie doszła żadna wiadomość na ${adres} w ${limitMs / 1000} s. ` +
      `Sprawdź, czy łapacz poczty stoi pod ${POCZTA} (npx supabase status) ` +
      'i czy `enable_confirmations` jest włączone w supabase/config.toml.'
  );
}

/**
 * Adres potwierdzenia z treści wiadomości.
 *
 * Bierzemy go z HTML-a, a nie z wersji tekstowej, bo szablony Auth idą
 * wyłącznie w HTML — Supabase nie ma pola na `text/plain`.
 */
export function linkZListu(wiadomosc: Wiadomosc): string {
  const trafienie = wiadomosc.html.match(/https?:\/\/[^"'\s<]*\/auth\/callback[^"'\s<]*/);
  if (!trafienie) {
    throw new Error(`W wiadomości „${wiadomosc.temat}" nie ma adresu /auth/callback.`);
  }
  // Klienty poczty i szablony potrafią zakodować ampersand — bez tego
  // `type` i `next` sklejają się w jeden parametr.
  return trafienie[0].replaceAll('&amp;', '&');
}

/** Adres na jeden przebieg. Skrzynka jest wspólna, więc musi być unikalny. */
export function nowyAdres(etykieta: string): string {
  return `${etykieta}.${Date.now()}.${Math.floor(Math.random() * 1000)}@example.com`;
}
