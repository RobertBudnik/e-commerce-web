import type { Metadata } from 'next';
import { AdminPanel } from '@/components/admin/AdminPanel';
import { PoleKosztu } from '@/components/panel/PoleKosztu';
import { wymagajBiura } from '@/lib/panel-dostep';
import { getCategories, getKosztyProduktow, getProducts } from '@/lib/queries';
import { money } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Katalog',
  robots: { index: false, follow: false },
};

export default async function Katalog() {
  await wymagajBiura('/panel/katalog');

  const [products, categories, koszty] = await Promise.all([
    getProducts(),
    getCategories(),
    getKosztyProduktow(),
  ]);

  return (
    <main className="container section">
      <div className="section-head">
        <div>
          <span className="label">Organizacja</span>
          <h1>Katalog</h1>
        </div>
        <div className="admin-toolbar">
          <span className="muted">
            <span className="num">{products.length}</span> pozycji w katalogu
          </span>
        </div>
      </div>

      <div className="notice">
        <span>
          Katalog jedzie z bazy — zmiany widzą wszyscy od razu. Zapis przepuszcza dopiero polityka
          RLS <code>produkty: edycja</code>, więc konto bez uprawnienia <code>products.write</code>{' '}
          dostanie odmowę niezależnie od tego, co pokazuje ten formularz. Każda zmiana ceny dopisuje
          się do historii — z niej liczy się najniższa cena z 30 dni przy obniżce.
        </span>
      </div>

      <AdminPanel products={products} categories={categories} />

      <section className="pw-sekcja">
        <div className="pw-sekcja-glowa">
          <h2>Koszt zakupu</h2>
        </div>
        <p className="muted">
          Cena, za którą kupujesz towar. Trzymana osobno od katalogu, bo katalog czyta każdy gość —
          marża nie jest informacją dla kupującego. Bez kosztu ekran Finansów pokaże przychód, ale
          nie zysk.
        </p>

        <div className="pw-tabela-kadr">
          <table className="pw-tabela">
            <thead>
              <tr>
                <th>Produkt</th>
                <th className="pw-do-prawej">Cena</th>
                <th className="pw-do-prawej">Koszt</th>
                <th className="pw-do-prawej">Marża</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const koszt = koszty.get(p.id);
                const marza = koszt === undefined ? null : p.price - koszt;
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="pw-do-prawej num">{money(p.price)}</td>
                    <td className="pw-do-prawej">
                      <PoleKosztu produktId={p.id} koszt={koszt ?? null} />
                    </td>
                    <td className="pw-do-prawej num">
                      {marza === null ? (
                        <span className="muted">—</span>
                      ) : (
                        `${money(marza)} · ${p.price ? Math.round((marza / p.price) * 100) : 0}%`
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
