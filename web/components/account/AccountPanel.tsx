'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { Icon } from '@/components/Icon';
import { ProductGrid } from '@/components/product/ProductGrid';
import { ProfileForm } from './ProfileForm';
import { UsunKonto } from '@/components/account/UsunKonto';
import { ORDER_STATUSES, OrderRow } from './OrderRow';
import { cancelOrderAction, setOrderStatusAction } from '@/app/actions/account';
import { toast } from '@/components/ui/ToastHost';
import { money } from '@/lib/format';
import type { Category, Order, OrderStatus, Product, SessionUser } from '@/lib/types';
import { ile, ZAMOWIENIA } from '@/lib/odmiana';

type Profile = {
  name: string;
  email: string;
  phone: string;
  newsletter: boolean;
  street: string;
  zip: string;
  city: string;
} | null;

type Tab = 'overview' | 'orders' | 'customers' | 'wishlist' | 'settings';

export function AccountPanel({
  user,
  orders: initialOrders,
  wishlist,
  profile,
  categories,
  catalogCount,
}: {
  user: SessionUser;
  orders: Order[];
  wishlist: Product[];
  profile: Profile;
  categories: Category[];
  catalogCount: number;
}) {
  const staff = user.role === 'admin';
  const [orders, setOrders] = useState(initialOrders);
  const [tab, setTab] = useState<Tab>(staff ? 'overview' : 'orders');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startAction] = useTransition();

  // Wejście z linku typu /konto#orders — zakładka z adresu
  useEffect(() => {
    const wanted = window.location.hash.slice(1) as Tab;
    const available: Tab[] = staff
      ? ['overview', 'orders', 'customers', 'wishlist', 'settings']
      : ['orders', 'wishlist', 'settings'];
    if (available.includes(wanted)) setTab(wanted);
  }, [staff]);

  function open(next: Tab) {
    setTab(next);
    history.replaceState(null, '', `#${next}`);
  }

  function changeStatus(order: Order, status: OrderStatus) {
    if (order.status === status) return;
    setBusyId(order.id);

    startAction(async () => {
      const result =
        status === 'anulowane'
          ? await cancelOrderAction(order.id)
          : await setOrderStatusAction(order.id, status);
      setBusyId(null);

      if (!result.ok) {
        toast(`Nie udało się zmienić statusu: ${result.error}`);
        return;
      }

      // cancel_order oddaje samo zamówienie, bez pozycji — zostawiamy stare
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? { ...o, ...result.data, items: result.data.items.length ? result.data.items : o.items }
            : o
        )
      );
      toast(
        status === 'anulowane'
          ? `Zamówienie ${order.number} anulowane — towar wrócił na magazyn`
          : `Status ${order.number}: ${status}`
      );
    });
  }

  function cancelOwn(order: Order) {
    if (!confirm(`Anulować zamówienie ${order.number}? Towar wróci na magazyn.`)) return;
    changeStatus(order, 'anulowane');
  }

  // Anulowane nie liczą się do obrotu — towar wrócił na magazyn
  const billable = orders.filter((o) => o.status !== 'anulowane');
  const pending = orders.filter((o) => o.status !== 'dostarczone' && o.status !== 'anulowane');
  const visible = statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter);

  const customers = new Map<string, Order>();
  orders.forEach((o) => customers.set(o.email, o));

  return (
    <div className="account-layout">
      <nav className="side-nav" aria-label="Sekcje konta">
        {staff && (
          <button type="button" aria-current={tab === 'overview' ? 'page' : undefined} onClick={() => open('overview')}>
            <Icon name="user" /> Przegląd
          </button>
        )}
        <button type="button" aria-current={tab === 'orders' ? 'page' : undefined} onClick={() => open('orders')}>
          <Icon name="box" /> Zamówienia
        </button>
        {staff && (
          <button type="button" aria-current={tab === 'customers' ? 'page' : undefined} onClick={() => open('customers')}>
            <Icon name="pin" /> Klienci i adresy
          </button>
        )}
        <button type="button" aria-current={tab === 'wishlist' ? 'page' : undefined} onClick={() => open('wishlist')}>
          <Icon name="heart" /> Lista życzeń
        </button>
        <button type="button" aria-current={tab === 'settings' ? 'page' : undefined} onClick={() => open('settings')}>
          <Icon name="shield" /> Dane i hasło
        </button>
        {staff && (
          <>
            <div className="menu-sep" />
            <Link className="admin-link" href="/panel">
              <Icon name="grid" /> Panel firmy
            </Link>
          </>
        )}
      </nav>

      <div>
        {staff && tab === 'overview' && (
          <section className="panel">
            <h2>Przegląd sklepu</h2>
            <p className="lede">Podsumowanie zamówień i kosztów wszystkich klientów.</p>
            <div className="stat-row">
              <div className="stat">
                <strong className="num">{billable.length}</strong>
                <span>zamówień</span>
              </div>
              <div className="stat">
                <strong className="num">{money(billable.reduce((s, o) => s + o.total, 0))}</strong>
                <span>obrót</span>
              </div>
              <div className="stat">
                <strong className="num">{money(billable.reduce((s, o) => s + o.shipping, 0))}</strong>
                <span>koszty dostawy</span>
              </div>
            </div>
            <div className="card-box">
              <h3>Do obsłużenia</h3>
              <p className="muted">
                {pending.length
                  ? `${pending.length} w realizacji — ${pending.map((o) => o.number).join(', ')}.`
                  : 'Wszystkie zamówienia zamknięte.'}
              </p>
              <p style={{ marginTop: 14 }}>
                <button className="arrow-link" type="button" onClick={() => open('orders')}>
                  Przejdź do zamówień
                </button>
              </p>
            </div>
            <div className="card-box">
              <h3>Katalog</h3>
              <p className="muted">
                <span className="num">{catalogCount}</span> produktów w sklepie.
              </p>
              <p style={{ marginTop: 14 }}>
                <Link className="arrow-link" href="/panel/katalog">
                  Dodaj lub edytuj produkty
                </Link>
              </p>
            </div>
          </section>
        )}

        {tab === 'orders' && (
          <section className="panel">
            <h2>Zamówienia</h2>
            <p className="lede">
              {staff
                ? 'Wszystkie zamówienia z danymi klienta, adresem i kosztami. Status przestawiasz stosem przy zamówieniu.'
                : 'Twoje zamówienia — status, pozycje i koszt dostawy.'}
            </p>

            {staff && (
              <div className="chips chips-tight">
                {(['all', ...ORDER_STATUSES] as const).map((s) => {
                  const n = s === 'all' ? orders.length : orders.filter((o) => o.status === s).length;
                  return (
                    <button
                      className="chip"
                      type="button"
                      key={s}
                      aria-pressed={statusFilter === s}
                      onClick={() => setStatusFilter(s)}
                    >
                      {s === 'all' ? 'Wszystkie' : s} <span className="num">{n}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {visible.length ? (
              visible.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  staff={staff}
                  busy={busyId === order.id}
                  onStatus={(status) => changeStatus(order, status)}
                  onCancel={() => cancelOwn(order)}
                />
              ))
            ) : (
              <p className="muted">
                {orders.length
                  ? 'Brak zamówień w tym statusie.'
                  : staff
                    ? 'Brak zamówień w sklepie.'
                    : 'Nie masz jeszcze żadnych zamówień.'}
              </p>
            )}
          </section>
        )}

        {staff && tab === 'customers' && (
          <section className="panel">
            <h2>Klienci i adresy</h2>
            <p className="lede">Dane kontaktowe z zamówień.</p>
            {customers.size ? (
              [...customers.values()].map((o) => {
                const own = orders.filter((x) => x.email === o.email);
                return (
                  <div className="order" key={o.email}>
                    <div>
                      <div className="order-id">{o.customer}</div>
                      <div className="order-meta">
                        {o.email}
                        {o.phone && ` · ${o.phone}`}
                      </div>
                    </div>
                    <div className="order-total">
                      {money(own.reduce((s, x) => s + x.total, 0))}
                    </div>
                    <div className="order-items">
                      {o.address} · {ile(own.length, ZAMOWIENIA)}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="muted">Brak klientów — nikt jeszcze nie złożył zamówienia.</p>
            )}
          </section>
        )}

        {tab === 'wishlist' && (
          <section className="panel">
            <h2>Lista życzeń</h2>
            <p className="lede">Produkty odłożone na później.</p>
            <ProductGrid
              products={wishlist}
              categories={categories}
              empty="Lista życzeń jest pusta — dodaj produkty sercem na kafelku."
            />
          </section>
        )}

        {tab === 'settings' && (
          <section className="panel">
            <h2>Dane i hasło</h2>
            <p className="lede">Dane logowania, kontakt i adres dostawy.</p>
            <ProfileForm profile={profile} email={user.email} />
            <div className="card-box">
              <h3>Hasło</h3>
              <p className="muted">
                Zmianę hasła obsługuje Supabase Auth — ten formularz haseł nie przyjmuje ani nie
                przechowuje.
              </p>
            </div>
            {/* Zaplecze usuwa się inną drogą — konto pracownika bywa podpisane
                pod korektami stanu i zwrotami, więc jego kasowanie to decyzja
                właściciela. Funkcja w bazie i tak odmówi, ale pokazywanie
                przycisku, który zawsze odmawia, byłoby kłamstwem interfejsu. */}
            {!staff && <UsunKonto />}
          </section>
        )}
      </div>
    </div>
  );
}
