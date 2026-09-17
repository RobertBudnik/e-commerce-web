import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { SekcjaPrzypieta } from '@/components/ruch/SekcjaPrzypieta';
import { ProductMedia } from '@/components/product/ProductMedia';
import { getCategories, getProducts } from '@/lib/queries';
import { money } from '@/lib/format';
import { ile, PRODUKTY } from '@/lib/odmiana';
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
 * Strona główna wg makiety „dwie głowy" (Claude Design, 17.09.2026).
 *
 * Narracja jedzie numerowanymi sekcjami, bo to naprawdę jest kolejność, a nie
 * ozdoba: najpierw wybór rzeczy, potem pokoje, w które trafiają, potem ludzie,
 * którzy je robią, na końcu notatki z pracowni. Numer w nadtytule niesie tę
 * kolejność i dlatego stoi w treści, a nie w CSS.
 *
 * Sekcje czytają dane z `lib/dane-sklepu.ts` i znikają, gdy tablica jest pusta.
 * Ta zasada zostaje z poprzedniej rundy: pusty dziennik albo pasek bez pokrycia
 * wygląda na awarię, a hasło bez pokrycia wiąże sklep wobec kupującego.
 */
export default async function HomePage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  // Dwa rzędy po cztery — tyle, ile makieta pokazuje w jednym geście,
  // bez zamiany strony głównej w drugi katalog.
  const wybor = [...products].sort((a, b) => b.rating - a.rating).slice(0, 8);

  return (
    <main className="dg">
      <section className="dg-hero">
        <span className="dg-nadtytul">{MARKA.nadtytulHero}</span>

        {/* Hasło łamie się w miejscach z danych, nie automatycznie: makieta ma
            trzy linie o wyrównanej długości i to ten rytm niesie całą górę
            strony. `white-space: pre-line` w arkuszu robi resztę. */}
        <h1 className="dg-haslo">{MARKA.hasloHero}</h1>

        <div className="dg-hero-dol">
          <p className="dg-lede">{MARKA.podtytulHero}</p>
          <div className="dg-hero-akcje">
            <Link className="dg-btn" href="/sklep">
              Zobacz wybór
            </Link>
            <Link className="dg-btn dg-btn-ghost" href={PRACOWNIA.przyciskHref}>
              {PRACOWNIA.przyciskEtykieta}
            </Link>
          </div>
        </div>

        <div className="dg-hero-kadr">
          <span className="dg-kadr-znak" aria-hidden="true">
            <Icon name="box" />
          </span>
        </div>
      </section>

      {OBIETNICE.length > 0 && (
        <ul className="dg-pasek">
          {OBIETNICE.map((o) => (
            <li key={o.tytul}>{o.tytul}</li>
          ))}
        </ul>
      )}

      {wybor.length > 0 && (
        <section className="dg-sekcja">
          <header className="dg-glowa">
            <span className="dg-numer">01 — Wybór</span>
            <h2>Rzeczy na cichy stół</h2>
            <Link className="dg-link" href="/sklep">
              Zobacz wszystkie <span aria-hidden="true">→</span>
            </Link>
          </header>

          <div className="dg-siatka">
            {wybor.map((p) => (
              <Link className="dg-karta" href={`/produkt/${p.slug}`} key={p.id}>
                <span className="dg-karta-kadr">
                  <ProductMedia product={p} sizes="(max-width: 700px) 92vw, 300px" />
                </span>
                <span className="dg-karta-wiersz">
                  <span className="dg-karta-nazwa">{p.name}</span>
                  <span className="dg-karta-cena num">{money(p.price)}</span>
                </span>
                {p.short && <span className="dg-karta-opis">{p.short}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {categories.length > 0 && (
        <section className="dg-sekcja">
          <header className="dg-glowa">
            <span className="dg-numer">02 — Pokoje</span>
            <h2>Jeden język, każdy pokój</h2>
          </header>

          <div className="dg-siatka">
            {categories.map((c) => (
              <Link className="dg-pokoj" href={`/sklep?kategoria=${c.id}`} key={c.id}>
                <span className="dg-karta-kadr">
                  <span className="dg-kadr-znak" aria-hidden="true">
                    <Icon name={c.icon} />
                  </span>
                </span>
                {/* Podpis leży na kadrze pod przyciemnieniem — jak w makiecie.
                    Gradient jest w arkuszu, żeby nazwa zostawała czytelna także
                    wtedy, gdy pod spód wejdzie jasne zdjęcie. */}
                <span className="dg-pokoj-podpis">
                  <strong>{c.name}</strong>
                  <span>{ile(products.filter((p) => p.category === c.id).length, PRODUKTY)}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* „Jak to działa" zostaje na stronie głównej — jeden krok na wysokość
          ekranu, przypięty przy przewijaniu. Nie dostaje numeru z narracji
          makiety (01–04), bo nie jest jej działem: to przerywnik między
          asortymentem a ludźmi, którzy go robią. */}
      {JAK_TO_DZIALA.length > 0 && <SekcjaPrzypieta kroki={[...JAK_TO_DZIALA]} />}

      <section className="dg-pracownia">
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

      {DZIENNIK.length > 0 && (
        <section className="dg-sekcja">
          <header className="dg-glowa">
            <span className="dg-numer">04 — Dziennik</span>
            <h2>Notatki od pieca</h2>
          </header>

          {/* Bez odsyłacza „wszystkie wpisy": osobnej strony dziennika w tym
              serwisie nie ma, a przycisk kończący się czterysta czwórką jest
              gorszy niż jego brak. Dojdzie razem z tą stroną. */}
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
