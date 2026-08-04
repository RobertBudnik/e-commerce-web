import { Icon } from '@/components/Icon';

const OBIETNICE = [
  'Wysyłka w 24 h — zamówienia do 15:00 tego samego dnia',
  '30 dni na zwrot, bez podawania przyczyny',
  '2 lata gwarancji door-to-door — odbieramy i odsyłamy na nasz koszt',
];

const PLATNOSCI = ['BLIK', 'Visa', 'Mastercard', 'Raty 0%'];

/**
 * Blok zaufania stoi bezpośrednio pod przyciskiem zakupu, nie w stopce.
 * Wątpliwości o zwrot i gwarancję pojawiają się w momencie decyzji, więc
 * odpowiedź ma być w zasięgu wzroku, a nie po przewinięciu całej strony.
 */
export function TrustBlock() {
  return (
    <section className="trust" aria-label="Warunki zakupu">
      <ul className="trust-list">
        {OBIETNICE.map((tekst) => (
          <li key={tekst}>
            <Icon name="check" />
            <span>{tekst}</span>
          </li>
        ))}
      </ul>
      <div className="trust-pay">
        <span className="label">Płatność</span>
        <ul>
          {PLATNOSCI.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
