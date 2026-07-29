'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Icon } from '@/components/Icon';
import { ShipBar } from './ShipBar';
import { useCart } from './CartProvider';
import { useCartQuote } from './useCartQuote';
import { checkoutAction } from '@/app/actions/checkout';
import { money } from '@/lib/format';
import { toast } from '@/components/ui/ToastHost';

type Defaults = {
  name: string;
  email: string;
  phone: string;
  street: string;
  zip: string;
  city: string;
};

export function CartPage({ defaults }: { defaults: Defaults }) {
  const { lines, ready, setQty, bump, remove, clear } = useCart();
  const router = useRouter();

  const [coupon, setCoupon] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [error, setError] = useState('');
  const [sending, startCheckout] = useTransition();

  // Wycena liczona w bazie tymi samymi regułami, których użyje create_order
  const { quote, media } = useCartQuote(lines, coupon || null, ready);

  // Kod rabatowy sprawdza baza, nie front — komunikat dopiero po wycenie
  useEffect(() => {
    if (coupon && quote && !quote.couponValid) {
      toast('Nieprawidłowy kod rabatowy');
      setCoupon('');
    }
  }, [coupon, quote]);

  if (!ready) return null;

  if (!lines.length) {
    return (
      <div className="empty">
        <h1>Koszyk jest pusty</h1>
        <p>Dodaj produkty, żeby kontynuować zakupy.</p>
        <Link className="btn" href="/sklep">
          Przejdź do sklepu
        </Link>
      </div>
    );
  }

  const byId = new Map(quote?.lines.map((l) => [l.id, l]) ?? []);
  const shortages = (quote?.lines ?? []).filter((l) => !l.inStock);
  const count = lines.reduce((sum, l) => sum + l.qty, 0);

  function applyCoupon(e: React.FormEvent) {
    e.preventDefault();
    setCoupon(couponInput.trim().toUpperCase());
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError('');

    startCheckout(async () => {
      const result = await checkoutAction({
        lines,
        coupon: quote?.couponValid ? quote.coupon : null,
        name: String(form.get('name') ?? ''),
        email: String(form.get('email') ?? ''),
        phone: String(form.get('phone') ?? ''),
        street: String(form.get('street') ?? ''),
        zip: String(form.get('zip') ?? ''),
        city: String(form.get('city') ?? ''),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Zamówienie stoi w bazie, towar zarezerwowany — koszyk może odejść
      clear();

      // Z kluczem operatora idziemy na jego stronę płatności; bez niego
      // (praca lokalna) zostaje potwierdzenie z numerem zamówienia.
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      router.push(`/zamowienie/${encodeURIComponent(result.orderNumber)}`);
    });
  }

  return (
    <div className="cart-layout">
      <section>
        <div className="cart-head">
          <h1>Koszyk</h1>
          <span className="muted num">{count} szt.</span>
        </div>

        {lines.map((line) => {
          const info = byId.get(line.id);
          const look = media.get(line.id);
          if (!info) return null;

          return (
            <div className="cart-item" key={line.id}>
              <div className="cart-item-media">
                {look?.image ? (
                  <Image className="media-img" src={look.image} alt="" width={96} height={96} />
                ) : (
                  <Icon name={look?.icon ?? 'grid'} />
                )}
              </div>
              <div>
                <Link className="cart-item-title" href={`/produkt/${look?.slug ?? ''}`}>
                  {info.name}
                </Link>
                <div className="cart-item-meta">{money(info.price)} / szt.</div>
                <div className="cart-item-actions">
                  <div className="qty">
                    <button
                      type="button"
                      aria-label="Zmniejsz ilość"
                      onClick={() => bump(line.id, -1, info.stock)}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={line.qty}
                      min={1}
                      max={info.stock}
                      aria-label="Ilość"
                      onChange={(e) => setQty(line.id, Number(e.target.value) || 0, info.stock)}
                    />
                    <button
                      type="button"
                      aria-label="Zwiększ ilość"
                      onClick={() => bump(line.id, 1, info.stock)}
                    >
                      +
                    </button>
                  </div>
                  <button className="btn-link" type="button" onClick={() => remove(line.id)}>
                    Usuń
                  </button>
                </div>
              </div>
              <div className="cart-item-total">{money(info.total)}</div>
            </div>
          );
        })}

        <div className="cart-foot">
          <Link className="arrow-link" href="/sklep">
            Kontynuuj zakupy
          </Link>
          <button
            className="btn-link"
            type="button"
            onClick={() => {
              clear();
              toast('Koszyk wyczyszczony');
            }}
          >
            Wyczyść koszyk
          </button>
        </div>

        <form className="card-box checkout" onSubmit={submit}>
          <h2>Dane do zamówienia</h2>
          <p className="lede">Ceny, rabat i dostawę przelicza serwer przy składaniu zamówienia.</p>

          <div className="field-row">
            <div className="field">
              <label htmlFor="co-name">Imię i nazwisko</label>
              <input id="co-name" name="name" type="text" autoComplete="name" required defaultValue={defaults.name} />
            </div>
            <div className="field">
              <label htmlFor="co-phone">Telefon</label>
              <input
                id="co-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+48 600 000 000"
                defaultValue={defaults.phone}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="co-email">E-mail</label>
            <input
              id="co-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={defaults.email}
            />
          </div>
          <div className="field">
            <label htmlFor="co-street">Ulica i numer</label>
            <input
              id="co-street"
              name="street"
              type="text"
              autoComplete="street-address"
              required
              placeholder="Krucza 12/4"
              defaultValue={defaults.street}
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="co-zip">Kod pocztowy</label>
              <input
                id="co-zip"
                name="zip"
                type="text"
                autoComplete="postal-code"
                required
                placeholder="00-001"
                defaultValue={defaults.zip}
              />
            </div>
            <div className="field">
              <label htmlFor="co-city">Miasto</label>
              <input
                id="co-city"
                name="city"
                type="text"
                autoComplete="address-level2"
                required
                placeholder="Warszawa"
                defaultValue={defaults.city}
              />
            </div>
          </div>

          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}

          <button
            className="btn btn-block"
            type="submit"
            style={{ marginTop: 20 }}
            disabled={sending || shortages.length > 0 || !quote}
          >
            {sending ? 'Składam zamówienie…' : `Zamawiam i płacę · ${money(quote?.total ?? 0)}`}
          </button>
          <p className="summary-note" style={{ textAlign: 'center' }}>
            Zamówienie rezerwuje towar; płatność potwierdza operator.
          </p>
        </form>
      </section>

      <aside className="summary">
        <h2>Podsumowanie</h2>
        <div className="summary-row">
          <span>Wartość produktów</span>
          <span className="num">{money(quote?.subtotal ?? 0)}</span>
        </div>
        {Boolean(quote?.discount) && (
          <div className="summary-row">
            <span>Rabat · {quote?.coupon}</span>
            <span className="num">−{money(quote!.discount)}</span>
          </div>
        )}
        <div className="summary-row">
          <span>Dostawa</span>
          <span className="num">{quote?.shipping === 0 ? 'Gratis' : money(quote?.shipping ?? 0)}</span>
        </div>

        {quote && <ShipBar value={quote.subtotal - quote.discount} goal={quote.freeShippingFrom} />}

        <form className="coupon" onSubmit={applyCoupon}>
          <input
            type="text"
            placeholder="Kod rabatowy"
            aria-label="Kod rabatowy"
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value)}
          />
          <button className="btn btn-ghost btn-sm" type="submit">
            Zastosuj
          </button>
        </form>

        <div className="summary-row total">
          <span>Razem</span>
          <span className="num">{money(quote?.total ?? 0)}</span>
        </div>

        {shortages.length > 0 && (
          <p className="notice notice-error" role="alert">
            Brakuje sztuk: {shortages.map((l) => `${l.name} (zostało ${l.stock})`).join(', ')}.
          </p>
        )}

        <p className="summary-note" style={{ textAlign: 'center' }}>
          Kwoty policzone w bazie · darmowy zwrot w 30 dni
        </p>
      </aside>
    </div>
  );
}
