'use client';

import { SortStack } from '@/components/ui/SortStack';
import { ZgloszenieZwrotu } from './ZgloszenieZwrotu';
import { formatDate, money } from '@/lib/format';
import type { Order, OrderStatus } from '@/lib/types';

/** Wszystkie stany, jakie zamówienie może mieć — do filtrowania listy. */
export const ORDER_STATUSES: OrderStatus[] = [
  'nowe',
  'w realizacji',
  'spakowane',
  'wysłane',
  'dostarczone',
  'anulowane',
];

/**
 * Stany, które wolno ustawić z tego ekranu.
 *
 * Krótsza lista niż wyżej i taka ma być: „wysłane" nadaje panel wysyłek razem
 * z listem przewozowym, a „dostarczone" przychodzi od przewoźnika. Wybór, po
 * którym baza odpowiada odmową, jest gorszy niż brak wyboru — wygląda jak
 * awaria, choć jest regułą.
 */
export const STANY_DO_USTAWIENIA: OrderStatus[] = ['nowe', 'spakowane', 'anulowane'];

/** Kafelek zamówienia. `staff` dokłada dane kontaktowe i stos statusów. */
export function OrderRow({
  order,
  staff,
  busy,
  onStatus,
  onCancel,
}: {
  order: Order;
  staff: boolean;
  busy: boolean;
  onStatus: (status: OrderStatus) => void;
  onCancel: () => void;
}) {
  const done = order.status === 'dostarczone';
  const dead = order.status === 'anulowane';
  const pill = dead ? 'pill' : done ? 'pill pill-done' : 'pill pill-way';

  return (
    <div className="order">
      <div>
        <div className="order-id">{order.number}</div>
        <div className="order-meta">
          {formatDate(order.date)} · <span className={pill}>{order.status}</span>
        </div>
      </div>
      <div className="order-total">{money(order.total)}</div>
      <div className="order-items">
        {order.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}
      </div>

      {staff ? (
        <div className="order-items">
          {order.customer}
          {order.phone && ` · ${order.phone}`}
          {order.address && ` · ${order.address}`}
          <span className="muted"> — dostawa {order.shipping === 0 ? 'gratis' : money(order.shipping)}</span>
        </div>
      ) : (
        <div className="order-items muted">
          Dostawa {order.shipping === 0 ? 'gratis' : money(order.shipping)}
          {order.discount > 0 && ` · rabat −${money(order.discount)}`}
        </div>
      )}

      {staff ? (
        <div className="order-actions">
          <span className="label">Status</span>
          <SortStack
            compact
            label={`Status zamówienia ${order.number}`}
            options={STANY_DO_USTAWIENIA.map((s) => ({ value: s, label: s }))}
            value={order.status}
            onChange={(value) => onStatus(value as OrderStatus)}
          />
          {busy && <span className="muted">zapisuję…</span>}
        </div>
      ) : (
        /* Anulowanie ma sens, dopóki paczka nie ruszyła; zwrot dopiero gdy
           dojechała. To dwie różne sytuacje i nigdy nie występują razem. */
        <div className="order-actions">
          {order.status === 'nowe' && (
            <button className="btn-link" type="button" disabled={busy} onClick={onCancel}>
              {busy ? 'Anuluję…' : 'Anuluj zamówienie'}
            </button>
          )}
          {order.status === 'dostarczone' && <ZgloszenieZwrotu order={order} />}
        </div>
      )}
    </div>
  );
}
