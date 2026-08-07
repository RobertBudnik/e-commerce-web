/** Błąd z `create_order` albo z Edge Function → jedno zdanie dla klienta. */
export function checkoutMessage(raw: unknown): string {
  const message = String((raw as Error)?.message ?? raw ?? '');
  const stock = message.match(/Za mało sztuk: (.+?) \(dostępne (\d+)\)/);

  if (stock) return `Zabrakło towaru: ${stock[1]} — zostało ${stock[2]} szt.`;
  if (/Kod rabatowy .* nieprawidłowy|wygasł/i.test(message)) return 'Kod rabatowy jest nieprawidłowy lub wygasł.';
  if (/Nieprawidłowy adres e-mail/i.test(message)) return 'Sprawdź adres e-mail.';
  if (/Puste zamówienie|Koszyk jest pusty/i.test(message)) return 'Koszyk jest pusty.';
  if (/niedostępny/i.test(message)) return 'Któryś z produktów zniknął z katalogu — odśwież koszyk.';
  if (/wykorzystany do końca/i.test(message))
    return 'Ten kod rabatowy właśnie się wyczerpał — zamów bez niego albo wpisz inny.';
  if (/failed to fetch|networkerror|fetch failed|load failed/i.test(message))
    return 'Brak połączenia z serwerem — spróbuj za chwilę.';
  return `Nie udało się złożyć zamówienia: ${message}`;
}
