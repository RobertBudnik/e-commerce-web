import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Kwadracik } from '@/components/home/Kwadracik';
import { SekcjaPrzypieta } from '@/components/ruch/SekcjaPrzypieta';
import { ProductCard } from '@/components/product/ProductCard';
import { getCategories, getProducts } from '@/lib/queries';
import { money } from '@/lib/format';
import { ile, PRODUKTY } from '@/lib/odmiana';
import {
  KATEGORIE_ZAPASOWE,
  MANIFEST,
  wybranePozycje,
  type KafelekKategorii,
} from '@/lib/strona-glowna';
import {
  DZIENNIK,
  JAK_TO_DZIALA,
  MARKA,
  OBIETNICE,
  PRACOWNIA,
  STATYSTYKI,
} from '@/lib/dane-sklepu';

/** Katalog zmienia się rzadko — strona główna może stać w cache przez minutę. */
export const revalidate = 60;

/**
 * Strona główna.
 *
 * Narracja jedzie numerowanymi sekcjami, bo to naprawdę jest kolejność, a nie
 * ozdoba: najpierw rzecz i ręka, która ją robi, potem pokoje, w które trafia,
 * potem wybór, na końcu notatki z pracowni.
 *
 * Każda sekcja czytająca dane znika, gdy danych nie ma. Pusty pasek albo
 * siatka bez kart wyglądają na awarię wdrożenia, a nie na młody sklep.
 */
export default async function HomePage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  // Baza, gdy coś w niej jest; tablica z `lib/strona-glowna.ts`, gdy pusto.
  // Kategorie to nawigacja, nie oferta, więc zapas jest tu uczciwy —
  // przy produktach byłby wystawianiem wymyślonego towaru z ceną.
  const kafelki: KafelekKategorii[] =
    categories.length > 0
      ? categories.map((c) => ({
          id: c.id,
          nazwa: c.name,
          opis: ile(products.filter((p) => p.category === c.id).length, PRODUKTY),
          ikona: c.icon,
        }))
      : [...KATEGORIE_ZAPASOWE];

  const wybor = wybranePozycje(products);
  const katalogPusty = products.length === 0;

  return (
    <main className="dg">
      {/* ---------- Hero ---------- */}
      <section className="dg-hero">
        <div className="dg-hero-slowo">
          <span className="dg-nadtytul">{MARKA.nadtytulHero}</span>

          {/* Hasło łamie się w miejscach z danych, nie automatycznie: makieta
              ma trzy linie o wyrównanej długości i to ten rytm niesie całą
              górę strony. `white-space: pre-line` w arkuszu robi resztę. */}
          <h1 className="dg-haslo">{MARKA.hasloHero}</h1>

          <p className="dg-lede">{MARKA.podtytulHero}</p>

          <div className="dg-hero-akcje">
            {/* Kotwica, nie osobna strona: `/informacje/o-nas` nie istnieje,
                a sekcja „Pracownia" niżej jest dokładnie tą treścią. Przycisk
                kończący się czterysta czwórką jest gorszy niż jego brak. */}
            <Link className="dg-btn" href="#pracownia">
              O nas
            </Link>
            <Link className="dg-btn dg-btn-ghost" href="/sklep">
              Zobacz wybór
            </Link>
          </div>
        </div>

        {/* Kwadracik stoi w hero, a nie niżej: to jedyna rzecz na stronie,
            która odpowiada na rękę, więc ma być widoczna bez przewijania. */}
        <div className="dg-hero-kwadrat">
          <Kwadracik />
        </div>
      </section>

      {OBIETNICE.length > 0 && (
        <ul className="dg-pasek">
          {OBIETNICE.map((o) => (
            <li key={o.tytul}>{o.tytul}</li>
          ))}
        </ul>
      )}

      {/* ---------- 01 Pokoje ---------- */}
      {kafelki.length > 0 && (
        <section className="dg-sekcja">
          <header className="dg-glowa">
            <span className="dg-numer">01 — Pokoje</span>
            <h2>Jeden język, każdy pokój</h2>
            <Link className="dg-link" href="/sklep">
              Zobacz wszystkie <span aria-hidden="true">→</span>
            </Link>
          </header>

          <div className="dg-pokoje">
            {kafelki.map((k) => (
              <Link className="dg-pokoj" href={`/sklep?kategoria=${k.id}`} key={k.id}>
                <span className="dg-pokoj-kadr" aria-hidden="true">
                  <Icon name={k.ikona} />
                </span>
                {/* Podpis pod kadrem, nie na nim. Napis na zdjęciu wymaga
                    przyciemnienia, a przyciemnienie mocne dość, żeby zawsze
                    działało, zjada samo zdjęcie. Pod kadrem czyta się zawsze. */}
                <span className="dg-pokoj-podpis">
                  <strong>{k.nazwa}</strong>
                  <span>{k.opis}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------- 02 Wybór ---------- */}
      <section className="dg-sekcja">
        <header className="dg-glowa">
          <span className="dg-numer">02 — Wybór</span>
          <h2>Rzeczy na cichy stół</h2>
          {!katalogPusty && (
            <Link className="dg-link" href="/sklep">
              Zobacz wszystkie <span aria-hidden="true">→</span>
            </Link>
          )}
        </header>

        {wybor.length > 0 ? (
          <>
            {katalogPusty && (
              <p className="dg-adnotacja">
                Pozycje poglądowe — katalog jest jeszcze pusty, więc nie da się ich kupić.
              </p>
            )}

            <div className="dg-siatka">
              {wybor.map((p, i) => {
                const produkt = p.zKatalogu ? products.find((x) => x.id === p.id) : undefined;

                // Prawdziwy towar idzie tą samą kartą co w sklepie — razem
                // z koszykiem, znacznikiem przeceny i stanem magazynowym.
                // Dublowanie tego tutaj oznaczałoby dwie karty produktu,
                // które rozjeżdżają się przy pierwszej zmianie.
                if (produkt) {
                  return (
                    <ProductCard
                      key={p.id}
                      product={produkt}
                      categoryName={
                        kafelki.find((k) => k.id === produkt.category)?.nazwa ?? ''
                      }
                      delay={i}
                    />
                  );
                }

                return (
                  <article className="dg-karta" key={p.id}>
                    <span className="dg-karta-kadr">
                      <span className="dg-kadr-znak" aria-hidden="true">
                        <Icon name="box" />
                      </span>
                    </span>
                    <div className="dg-karta-dol">
                      <div className="dg-karta-wiersz">
                        <span className="dg-karta-nazwa">{p.nazwa}</span>
                        <span className="dg-karta-cena num">{money(p.cena)}</span>
                      </div>
                      {p.opis && <p className="dg-karta-opis">{p.opis}</p>}
                      {/* Bez przycisku koszyka: pozycja poglądowa nie istnieje
                          w katalogu, a przycisk byłby zaproszeniem do kupienia
                          czegoś, czego nie ma. */}
                      <span className="dg-karta-brak">pozycja poglądowa</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          /* Uczciwy stan pusty. Siatka z wymyślonym towarem byłaby wygodniejsza
             wizualnie i nieuczciwa wobec kupującego. */
          <div className="dg-pusto">
            <span className="dg-pusto-znak" aria-hidden="true">
              <Icon name="box" />
            </span>
            <p>
              Pierwsza partia jest jeszcze w piecu. Zostaw adres przy koncie, a napiszemy, gdy
              stanie na półce.
            </p>
            <Link className="dg-btn dg-btn-ghost" href="/logowanie?tryb=rejestracja">
              Załóż konto
            </Link>
          </div>
        )}
      </section>

      {/* „Jak to działa" zostaje: jeden krok na wysokość ekranu, przypięty
          przy przewijaniu. Bez numeru z narracji, bo nie jest jej działem —
          to przerywnik między asortymentem a ludźmi, którzy go robią. */}
      {JAK_TO_DZIALA.length > 0 && <SekcjaPrzypieta kroki={[...JAK_TO_DZIALA]} />}

      {/* ---------- Manifest ---------- */}
      <section className="dg-manifest">
        <span className="dg-numer">{MANIFEST.nadtytul}</span>
        <blockquote className="dg-manifest-zdanie">{MANIFEST.zdanie}</blockquote>
        <p className="dg-manifest-akapit">{MANIFEST.akapit}</p>
        <cite className="dg-manifest-podpis">{MANIFEST.podpis}</cite>
      </section>

      {/* ---------- 03 Pracownia ---------- */}
      <section className="dg-pracownia" id="pracownia">
        <div className="dg-pracownia-tresc">
          <span className="dg-numer">03 — {PRACOWNIA.nadtytul}</span>
          <h2>{PRACOWNIA.haslo}</h2>

          {STATYSTYKI.length > 0 && (
            <dl className="dg-liczby">
              {STATYSTYKI.map((s) => (
                <div key={s.etykieta}>
                  <dt className="num">
                    {s.do}
                    {s.sufiks ?? ''}
                  </dt>
                  <dd>{s.opis}</dd>
                </div>
              ))}
            </dl>
          )}

          <Link className="dg-btn dg-btn-ghost dg-btn-ciemny" href={PRACOWNIA.przyciskHref}>
            {PRACOWNIA.przyciskEtykieta}
          </Link>
        </div>

        <div className="dg-pracownia-kadry" aria-hidden="true">
          <span className="dg-kadr-ciemny dg-kadr-wysoki">
            <Icon name="box" />
          </span>
          <span className="dg-kadr-ciemny">
            <Icon name="grid" />
          </span>
          <span className="dg-kadr-ciemny">
            <Icon name="shield" />
          </span>
        </div>
      </section>

      {/* ---------- 04 Dziennik ---------- */}
      {DZIENNIK.length > 0 && (
        <section className="dg-sekcja">
          <header className="dg-glowa">
            <span className="dg-numer">04 — Dziennik</span>
            <h2>Notatki od pieca</h2>
          </header>

          <ul className="dg-dziennik">
            {DZIENNIK.map((w) => (
              <li className="dg-wpis" key={w.tytul}>
                <span className="dg-wpis-kadr" aria-hidden="true">
                  <Icon name="box" />
                </span>
                <span className="dg-wpis-tresc">
                  <span className="dg-nadtytul">{w.dzial}</span>
                  <strong>{w.tytul}</strong>
                  <span className="dg-wpis-opis">{w.opis}</span>
                </span>
                <span className="dg-wpis-data">{w.data}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
