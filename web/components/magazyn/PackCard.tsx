'use client';

import { useState, useTransition } from 'react';
import { Icon } from '@/components/Icon';
import { setOrderStatusAction } from '@/app/actions/account';
import { money } from '@/lib/format';
import type { Order, OrderStatus } from '@/lib/types';

/** Następny krok w obsłudze paczki. Cofanie zostaje w panelu na biurku. */
const NASTEPNY: Partial<Record<OrderStatus, { status: OrderStatus; etykieta: string }>> = {
  nowe: { status: 'w realizacji', etykieta: 'Biorę do pakowania' },
  'w realizacji': { status: 'wysłane', etykieta: 'Wysłane' },
};

export function PackCard({ order }: { order: Order }) {
  const [rozwiniete, setRozwiniete] = useState(false);
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [blad, setBlad] = useState<string | null>(null);
  const [czeka, start] = useTransition();

  const krok = NASTEPNY[status];
  const nieoplacone = order.paymentStatus !== 'opłacone';

  function dalej() {
    if (!krok) return;
    setBlad(null);
    start(async () => {
      const wynik = await setOrderStatusAction(order.id, krok.status);
      if (wynik.ok) setStatus(krok.status);
      else setBlad(wynik.error);
    });
  }

  return (
    <article className={`pack${status === 'wysłane' ? ' pack-done' : ''}`}>
      <button
        type="button"
        className="pack-head"
        onClick={() => setRozwiniete((v) => !v)}
        aria-expanded={rozwiniete}
      >
        <span className="pack-head-main">
          <span className="pack-nr num">{order.number}</span>
          <span className="pack-customer">{order.customer}</span>
        </span>
        <span className="pack-head-side">
          <span className="num">{money(order.total)}</span>
          <span className={`pack-status pack-status-${status.replace(/\s+/g, '-')}`}>{status}</span>
        </span>
      </button>

      {/* Nieopłacone zamówienie nie powinno wyjechać z magazynu — ostrzeżenie
          jest widoczne od razu, bez rozwijania karty. */}
      {nieoplacone && (
        <p className="pack-warn">
          <Icon name="info" />
          Płatność: {order.paymentStatus} — sprawdź przed wysyłką
        </p>
      )}

      {rozwiniete && (
        <div className="pack-body">
          <ul className="pack-items">
            {order.items.map((p, i) => (
              <li key={`${p.productId ?? p.name}-${i}`}>
                <span className="pack-qty num">{p.qty}×</span>
                <span className="pack-item-name">{p.name}</span>
                <span className="num">{money(p.price * p.qty)}</span>
              </li>
            ))}
          </ul>

          <dl className="pack-meta">
            <dt>Adres</dt>
            <dd>{order.address || '—'}</dd>
            <dt>Telefon</dt>
            <dd>
              {order.phone ? <a href={`tel:${order.phone.replace(/\s+/g, '')}`}>{order.phone}</a> : '—'}
            </dd>
            <dt>E-mail</dt>
            <dd>
              <a href={`mailto:${order.email}`}>{order.email}</a>
            </dd>
          </dl>
        </div>
      )}

      {blad && <p className="pack-error">{blad}</p>}

      {krok && (
        <button type="button" className="btn btn-block pack-cta" onClick={dalej} disabled={czeka}>
          {czeka ? 'Zapisuję…' : krok.etykieta}
        </button>
      )}
    </article>
  );
}
