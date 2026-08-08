import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Marquee } from '@/components/ruch/Marquee';
import { TekstDekodujacy } from '@/components/ruch/TekstDekodujacy';
import { Licznik } from '@/components/ruch/Licznik';
import { PrzyciskMagnetyczny } from '@/components/ruch/PrzyciskMagnetyczny';
import { PoleCzastek } from '@/components/ruch/PoleCzastek';
import { ProductGrid } from '@/components/product/ProductGrid';
import { RecentlyViewed } from '@/components/product/RecentlyViewed';
import { getCategories, getProducts } from '@/lib/queries';
import { ile, PRODUKTY } from '@/lib/odmiana';

/** Katalog zmienia się rzadko — strona główna może stać w cache przez minutę. */
export const revalidate = 60;

export default async function HomePage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  const featured = [...products].sort((a, b) => b.rating - a.rating).slice(0, 4);

  return (
    <main>
      <Marquee
        hasla={[
          'Darmowa dostawa od 300 zł',
          '30 dni na zwrot',
          'Wysyłka w 24 h',
          '2 lata gwarancji door-to-door',
          'BLIK · Przelewy24 · raty 0%',
        ]}
      />

      <section className="hero">
        <PoleCzastek />
        <div className="container hero-inner">
          <div>
            <span className="label">Kolekcja 2026</span>
            <h1>
              <TekstDekodujacy tekst="Elektronika bez zbędnego hałasu" />
            </h1>
            <p className="lede">
              Wąski, przemyślany wybór sprzętu. Darmowa dostawa od 300 zł, trzydzieści dni na zwrot.
            </p>
            <div className="hero-actions">
              <PrzyciskMagnetyczny href="/sklep">Przeglądaj sklep</PrzyciskMagnetyczny>
              <Link className="btn btn-ghost" href="/sklep?sort=rating">
                Zobacz bestsellery
              </Link>
            </div>
            <div className="hero-stats">
              <div>
                <strong className="num">
                  <Licznik do={120} sufiks="k" etykieta="120 tysięcy zamówień" />
                </strong>
                <span>zamówień</span>
              </div>
              <div>
                <strong className="num">
                  <Licznik do={4.8} ulamek={1} etykieta="Średnia ocen 4,8" />
                </strong>
                <span>średnia ocen</span>
              </div>
              <div>
                <strong className="num">
                  <Licznik do={24} sufiks=" h" etykieta="Wysyłka w 24 godziny" />
                </strong>
                <span>wysyłka</span>
              </div>
            </div>
          </div>
          <div className="hero-media" role="img" aria-label="Ilustracja produktu">
            <Icon name="headphones" />
          </div>
        </div>
      </section>

      <div className="band">
        <div className="features-wrap">
          <div className="features">
            <div className="feature">
              <strong>Wysyłka 24 h</strong>
              <span>Zamówienia do 15:00 tego samego dnia</span>
            </div>
            <div className="feature">
              <strong>30 dni na zwrot</strong>
              <span>Bez podawania przyczyny</span>
            </div>
            <div className="feature">
              <strong>2 lata gwarancji</strong>
              <span>Serwis door-to-door</span>
            </div>
            <div className="feature">
              <strong>Płatności</strong>
              <span>BLIK, karta, raty 0%</span>
            </div>
          </div>
        </div>
      </div>

      <section className="section container">
        <div className="section-head">
          <div>
            <span className="label">Asortyment</span>
            <h2>Kategorie</h2>
          </div>
          <Link className="arrow-link" href="/sklep">
            Zobacz wszystko
          </Link>
        </div>
        <div className="categories">
          {categories.map((c) => (
            <Link className="category" href={`/sklep?kategoria=${c.id}`} key={c.id}>
              <Icon name={c.icon} />
              <strong>{c.name}</strong>
              <span>{c.desc}</span>
              <span className="muted">
                {ile(products.filter((p) => p.category === c.id).length, PRODUKTY)}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <hr className="rule" />

      <section className="section container">
        <div className="section-head">
          <div>
            <span className="label">Wybór redakcji</span>
            <h2>Polecane produkty</h2>
          </div>
          <Link className="arrow-link" href="/sklep">
            Wszystkie produkty
          </Link>
        </div>
        <ProductGrid products={featured} categories={categories} />
      </section>

      <RecentlyViewed categories={categories} className="section container" />

      <section className="newsletter">
        <div className="container newsletter-inner">
          <div>
            <h2>Newsletter</h2>
            <p>Rabat 10% na pierwsze zamówienie i wcześniejszy dostęp do promocji.</p>
          </div>
          <form>
            <label className="sr-only" htmlFor="nl-email">
              Adres e-mail
            </label>
            <input id="nl-email" type="email" required placeholder="twoj@email.pl" />
            <button className="btn" type="submit">
              Zapisz się
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
