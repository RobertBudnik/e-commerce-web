import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { money } from '@/lib/format';
import { getOrderByNumber } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'Zamówienie przyjęte',
  robots: { index: false },
};

/**
 * Strona powrotu z płatności. Sam powrót niczego nie potwierdza — status
 * płatności ustawia webhook operatora, więc pokazujemy stan z bazy.
 *
 * Zamówienia gościa nie widzi nikt poza zapleczem, stąd wariant z samym numerem.
 */
export default async function OrderPage({ params }: { params: Promise<{ numer: string }> }) {
  const { numer } = await params;
  const order = await getOrderByNumber(decodeURIComponent(numer));

  const head = (
    <div className="order-done">
      <span className="order-done-mark">
        <Icon name="check" />
      </span>
      <h1>Zamówienie przyjęte</h1>
      {/* Szablon nie ma jeszcze nadawcy poczty, więc strona nie obiecuje
          wiadomości, której nikt nie wyśle. Po podpięciu wysyłki zmień to zdanie:
          potwierdzenie umowy na trwałym nośniku jest przy sprzedaży konsumenckiej
          obowiązkowe, a nie miłym dodatkiem. */}
      <p className="lede">
        Numer <strong>{decodeURIComponent(numer)}</strong> — zapisz go sobie. Status zamówienia
        śledzisz w panelu konta.
      </p>
    </div>
  );

  if (!order) {
    return (
      <main className="container section">
        {head}
        <div className="card-box">
          <p className="muted">
            Szczegóły zamówienia widzi konto, na które zostało złożone. Zaloguj się tym adresem
            e-mail, żeby śledzić status w panelu konta.
          </p>
          <p style={{ marginTop: 14 }}>
            <Link className="arrow-link" href="/sklep">
              Wróć do sklepu
            </Link>
          </p>
        </div>
      </main>
    );
  }

  const paid = order.paymentStatus === 'opłacone';

  return (
    <main className="container section">
      {head}

      <div className="card-box">
        <div className="summary-row">
          <span>Status zamówienia</span>
          <span>{order.status}</span>
        </div>
        <div className="summary-row">
          <span>Płatność</span>
          <span>{order.paymentStatus}</span>
        </div>
        <div className="summary-row">
          <span>Wartość produktów</span>
          <span className="num">{money(order.subtotal)}</span>
        </div>
        {order.discount > 0 && (
          <div className="summary-row">
            <span>Rabat</span>
            <span className="num">−{money(order.discount)}</span>
          </div>
        )}
        <div className="summary-row">
          <span>Dostawa</span>
          <span className="num">{order.shipping === 0 ? 'Gratis' : money(order.shipping)}</span>
        </div>
        <div className="summary-row total">
          <span>Razem</span>
          <span className="num">{money(order.total)}</span>
        </div>
        <p className="summary-note">
          {paid
            ? 'Płatność potwierdzona przez operatora.'
            : 'Czekamy na potwierdzenie płatności — status zmieni się automatycznie.'}
        </p>
      </div>

      <div className="card-box">
        <h3>Pozycje</h3>
        {order.items.map((item, i) => (
          <div className="summary-row" key={`${item.productId ?? item.name}-${i}`}>
            <span>
              {item.name} × {item.qty}
            </span>
            <span className="num">{money(item.price * item.qty)}</span>
          </div>
        ))}
        {order.address && (
          <p className="summary-note">
            Dostawa: {order.customer}, {order.address}
          </p>
        )}
        <p style={{ marginTop: 14 }}>
          <Link className="arrow-link" href="/konto#orders">
            Moje zamówienia
          </Link>
        </p>
      </div>
    </main>
  );
}
