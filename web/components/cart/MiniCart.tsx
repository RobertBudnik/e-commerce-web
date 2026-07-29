'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { ShipBar } from './ShipBar';
import { useCart } from './CartProvider';
import { cartMediaAction, quoteCartAction } from '@/app/actions/shop';
import { money } from '@/lib/format';
import type { Quote } from '@/lib/types';

type Media = Map<string, { icon: string; image: string | null; slug: string }>;

/**
 * Szuflada zamiast skoku na osobną stronę po każdym „do koszyka".
 * Kwoty bierze z tej samej wyceny co koszyk, więc nic się nie rozjeżdża.
 */
export function MiniCart() {
  const { lines, open, setOpen, setQty, remove } = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [media, setMedia] = useState<Media>(new Map());
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      const [q, m] = await Promise.all([
        quoteCartAction(lines),
        cartMediaAction(lines.map((l) => l.id)),
      ]);
      if (cancelled) return;
      setQuote(q);
      setMedia(new Map(m.map((row) => [row.id, row])));
    })();

    return () => {
      cancelled = true;
    };
  }, [open, lines]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [setOpen]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) closeBtn.current?.focus();
  }, [open]);

  const byId = new Map(quote?.lines.map((l) => [l.id, l]) ?? []);

  return (
    <>
      <div className={`overlay${open ? ' is-open' : ''}`} hidden={!open} onClick={() => setOpen(false)} />
      <aside
        className={`drawer${open ? ' is-open' : ''}`}
        hidden={!open}
        role="dialog"
        aria-modal="true"
        aria-labelledby="minicart-title"
      >
        <div className="drawer-head">
          <h2 id="minicart-title">Koszyk</h2>
          <button
            className="icon-close"
            type="button"
            aria-label="Zamknij koszyk"
            onClick={() => setOpen(false)}
            ref={closeBtn}
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="drawer-body">
          {!lines.length && (
            <>
              <p className="muted">Koszyk jest pusty.</p>
              <p style={{ marginTop: 14 }}>
                <Link className="arrow-link" href="/sklep" onClick={() => setOpen(false)}>
                  Przejdź do sklepu
                </Link>
              </p>
            </>
          )}

          {Boolean(lines.length) && quote && (
            <ShipBar value={quote.subtotal - quote.discount} goal={quote.freeShippingFrom} />
          )}

          {lines.map((line) => {
            const info = byId.get(line.id);
            const look = media.get(line.id);
            if (!info) return null;

            return (
              <div className="drawer-item" key={line.id}>
                <div className="drawer-item-media">
                  {look?.image ? (
                    <Image className="media-img" src={look.image} alt="" width={56} height={56} />
                  ) : (
                    <Icon name={look?.icon ?? 'grid'} />
                  )}
                </div>
                <div>
                  <Link
                    className="drawer-item-name"
                    href={`/produkt/${look?.slug ?? ''}`}
                    onClick={() => setOpen(false)}
                  >
                    {info.name}
                  </Link>
                  <div className="drawer-item-meta">
                    {line.qty} × {money(info.price)}
                  </div>
                  <div className="cart-item-actions" style={{ marginTop: 8 }}>
                    <div className="qty">
                      <button
                        type="button"
                        aria-label="Zmniejsz ilość"
                        onClick={() => setQty(line.id, line.qty - 1, info.stock)}
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
                        onClick={() => setQty(line.id, line.qty + 1, info.stock)}
                      >
                        +
                      </button>
                    </div>
                    <button className="btn-link" type="button" onClick={() => remove(line.id)}>
                      Usuń
                    </button>
                  </div>
                </div>
                <div className="drawer-item-total num">{money(info.total)}</div>
              </div>
            );
          })}
        </div>

        {Boolean(lines.length) && quote && (
          <div className="drawer-foot">
            <div className="summary-row">
              <span>Wartość produktów</span>
              <span className="num">{money(quote.subtotal)}</span>
            </div>
            {quote.discount > 0 && (
              <div className="summary-row">
                <span>Rabat</span>
                <span className="num">−{money(quote.discount)}</span>
              </div>
            )}
            <div className="summary-row">
              <span>Dostawa</span>
              <span className="num">{quote.shipping === 0 ? 'Gratis' : money(quote.shipping)}</span>
            </div>
            <div className="summary-row total">
              <span>Razem</span>
              <span className="num">{money(quote.total)}</span>
            </div>
            <Link className="btn btn-block" href="/koszyk" style={{ marginTop: 16 }} onClick={() => setOpen(false)}>
              Przejdź do kasy
            </Link>
            <button
              className="btn btn-ghost btn-block"
              type="button"
              style={{ marginTop: 10 }}
              onClick={() => setOpen(false)}
            >
              Kontynuuj zakupy
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
