import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Marquee } from '@/components/ruch/Marquee';
import { TekstDekodujacy } from '@/components/ruch/TekstDekodujacy';
import { Licznik } from '@/components/ruch/Licznik';
import { PrzyciskMagnetyczny } from '@/components/ruch/PrzyciskMagnetyczny';
import { PoleCzastek } from '@/components/ruch/PoleCzastek';
import { StrzepkaPrzeciagana } from '@/components/ruch/StrzepkaPrzeciagana';
import { SekcjaPrzypieta } from '@/components/ruch/SekcjaPrzypieta';
import { KadrZoom } from '@/components/ruch/KadrZoom';
import { ProductCard } from '@/components/product/ProductCard';
import { RecentlyViewed } from '@/components/product/RecentlyViewed';
import { getCategories, getProducts } from '@/lib/queries';
import { ile, PRODUKTY } from '@/lib/odmiana';
import { JAK_TO_DZIALA, MARKA, OBIETNICE, STATYSTYKI, WARUNKI } from '@/lib/dane-sklepu';

/** Katalog zmienia się rzadko — strona główna może stać w cache przez minutę. */
export const revalidate = 60;

export default async function HomePage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  // Strzępka pokazuje cały asortyment, nie cztery pozycje: przy czterech
  // kartach lista mieści się w kontenerze na szerokim ekranie i nie ma czego
  // przeciągać — zostaje kilkadziesiąt pikseli zapasu.
  const featured = [...products].sort((a, b) => b.rating - a.rating);

  return (
    <main>
      {/* Pasek niesie wyłącznie obietnice z `web/lib/dane-sklepu.ts`. Pusto =
          nie ma czego przewijać, więc paska nie ma — zamiast haseł z szablonu,
          którymi sklep byłby związany wobec kupującego. */}
      {OBIETNICE.length > 0 && <Marquee hasla={OBIETNICE.map((o) => o.tytul)} />}

      {/* Hero z makiety: ograniczona karta w obrysie strony, tekst po lewej,
          kadr po prawej. Ilustracja wraca do siatki jako druga kolumna —
          wcześniej leżała pod spodem jako tło na całą wysokość ekranu i to
          ona spychała pierwszy rząd produktów pod zgięcie.

          Nic z zawartości nie ubyło: nadtytuł, hasło, akapit, oba przyciski
          i statystyki są tam, gdzie były. */}
      <section className="hero">
        <PoleCzastek />
        <div className="hero-inner">
          <div>
            <span className="label">{MARKA.nadtytulHero}</span>
            <h1>
              <TekstDekodujacy tekst={MARKA.hasloHero} />
            </h1>
            <p className="lede">{MARKA.podtytulHero}</p>
            <div className="hero-actions">
              <PrzyciskMagnetyczny href="/sklep">Przeglądaj sklep</PrzyciskMagnetyczny>
              <Link className="btn btn-ghost" href="/sklep?sort=rating">
                Zobacz bestsellery
              </Link>
            </div>
            {STATYSTYKI.length > 0 && (
              <div className="hero-stats">
                {STATYSTYKI.map((s) => (
                  <div key={s.etykieta}>
                    <strong className="num">
                      <Licznik do={s.do} ulamek={s.ulamek} sufiks={s.sufiks} etykieta={s.etykieta} />
                    </strong>
                    <span>{s.opis}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <KadrZoom className="hero-media">
            <div role="img" aria-label="Ilustracja produktu">
              <Icon name="headphones" />
            </div>
          </KadrZoom>
        </div>
      </section>

      {OBIETNICE.length > 0 && (
        <div className="band">
          <div className="features-wrap">
            <div className="features">
              {OBIETNICE.map((o) => (
                <div className="feature" key={o.tytul}>
                  <strong>{o.tytul}</strong>
                  <span>{o.opis}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
        <StrzepkaPrzeciagana>
          {featured.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              categoryName={categories.find((c) => c.id === product.category)?.name ?? product.category}
              delay={0}
            />
          ))}
        </StrzepkaPrzeciagana>
      </section>

      {JAK_TO_DZIALA.length > 0 && <SekcjaPrzypieta kroki={[...JAK_TO_DZIALA]} />}

      <RecentlyViewed categories={categories} className="section container" />

      {/* Newsletter pokazuje się dopiero po wpisaniu rabatu w `dane-sklepu.ts`
          i po podpięciu formularza do prawdziwej listy. Zgoda marketingowa musi
          być uprzednia i odrębna, stąd osobny checkbox — nie wolno jej wyprowadzać
          z samego wpisania adresu. Dopóki `action` jest puste, sekcja przyjmuje
          adres i go gubi, co jest gorsze niż jej brak. */}
      {WARUNKI.rabatNewsletter && (
        <section className="newsletter">
          <div className="container newsletter-inner">
            <div>
              <h2>Newsletter</h2>
              <p>{WARUNKI.rabatNewsletter}</p>
            </div>
            <form>
              <label className="sr-only" htmlFor="nl-email">
                Adres e-mail
              </label>
              <input id="nl-email" type="email" required placeholder="twoj@email.pl" />
              <button className="btn" type="submit">
                Zapisz się
              </button>
              <label className="nl-zgoda">
                <input type="checkbox" name="zgoda" required />
                Chcę dostawać informacje handlowe na podany adres. Zgodę mogę wycofać
                w każdej chwili — zasady w{' '}
                <Link href="/informacje/polityka-prywatnosci">polityce prywatności</Link>.
              </label>
            </form>
          </div>
        </section>
      )}
    </main>
  );
}
