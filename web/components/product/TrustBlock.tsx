import { Icon } from '@/components/Icon';
import { OBIETNICE, PLATNOSCI } from '@/lib/dane-sklepu';

/**
 * Blok zaufania stoi bezpośrednio pod przyciskiem zakupu, nie w stopce.
 * Wątpliwości o zwrot i gwarancję pojawiają się w momencie decyzji, więc
 * odpowiedź ma być w zasięgu wzroku, a nie po przewinięciu całej strony.
 *
 * Treść pochodzi z `web/lib/dane-sklepu.ts`. Puste tablice ukrywają blok
 * w całości — obietnica przy przycisku zakupu jest wiążąca, więc sklep bez
 * wpisanych warunków woli nie mówić nic, niż powtórzyć hasła z szablonu.
 */
export function TrustBlock() {
  if (OBIETNICE.length === 0 && PLATNOSCI.length === 0) return null;

  return (
    <section className="trust" aria-label="Warunki zakupu">
      {OBIETNICE.length > 0 && (
        <ul className="trust-list">
          {OBIETNICE.map((o) => (
            <li key={o.tytul}>
              <Icon name="check" />
              <span>{o.opis ? `${o.tytul} — ${o.opis}` : o.tytul}</span>
            </li>
          ))}
        </ul>
      )}
      {PLATNOSCI.length > 0 && (
        <div className="trust-pay">
          <span className="label">Płatność</span>
          <ul>
            {PLATNOSCI.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
