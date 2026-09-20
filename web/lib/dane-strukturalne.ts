import 'server-only';

import { siteUrl } from '@/lib/site';
import { doUzupelnienia, SPRZEDAWCA } from '@/lib/dane-sklepu';
import type { Product } from '@/lib/types';

/**
 * Dane strukturalne schema.org dla Google.
 *
 * Bez nich wyszukiwarka pokazuje sam tytuł i opis. Z nimi pod wynikiem
 * stoi cena, dostępność i ocena — czyli dokładnie to, na co patrzy człowiek
 * porównujący trzy sklepy w trzech kartach.
 *
 * Zasada, od której nie ma tu odstępstwa: **opisujemy wyłącznie to, co jest
 * na stronie**. Google traktuje rozjazd między znacznikiem a treścią jako
 * spam i potrafi za to zdjąć wyniki rozszerzone całej domenie. Dlatego ocena
 * idzie tylko wtedy, gdy naprawdę są opinie, a cena bierze się z tego samego
 * pola, które renderuje karta.
 */

/** Wspólny kształt: obiekt gotowy do wstawienia w `<script type="application/ld+json">`. */
export type Znacznik = Record<string, unknown>;

/**
 * Sprzedawca jako `Organization`.
 *
 * Pola z `⟨…⟩` są jeszcze niewypełnione — wtedy pomijamy je zamiast wysyłać
 * Google'owi nawias kątowy jako nazwę firmy. `doUzupelnienia()` rozpoznaje ten znacznik.
 */
function sprzedawca(): Znacznik {
  const baza = siteUrl();
  const org: Znacznik = { '@type': 'Organization', name: 'dwie głowy', url: baza };

  if (!doUzupelnienia(SPRZEDAWCA.nazwa)) org.legalName = SPRZEDAWCA.nazwa;
  if (!doUzupelnienia(SPRZEDAWCA.nip)) org.taxID = SPRZEDAWCA.nip;
  if (!doUzupelnienia(SPRZEDAWCA.email)) org.email = SPRZEDAWCA.email;
  if (!doUzupelnienia(SPRZEDAWCA.telefon)) org.telephone = SPRZEDAWCA.telefon;
  if (!doUzupelnienia(SPRZEDAWCA.adres)) {
    org.address = { '@type': 'PostalAddress', streetAddress: SPRZEDAWCA.adres, addressCountry: 'PL' };
  }

  return org;
}

/**
 * `Product` + `Offer` + `AggregateRating`.
 *
 * `priceValidUntil` jest wymagane przez Google przy ofercie; bez niego
 * konsola zgłasza ostrzeżenie. Dajemy rok do przodu — to nie jest obietnica
 * ceny, tylko techniczny horyzont ważności znacznika.
 */
export function znacznikProduktu(opcje: {
  produkt: Product;
  nazwaKategorii: string;
  liczbaOpinii: number;
  srednia: number;
}): Znacznik {
  const { produkt, nazwaKategorii, liczbaOpinii, srednia } = opcje;
  const baza = siteUrl();
  const adres = `${baza}/produkt/${produkt.slug}`;

  const zaRok = new Date();
  zaRok.setFullYear(zaRok.getFullYear() + 1);

  const znacznik: Znacznik = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: produkt.name,
    description: produkt.short,
    category: nazwaKategorii,
    url: adres,
    offers: {
      '@type': 'Offer',
      url: adres,
      priceCurrency: 'PLN',
      // Cena jako łańcuch z kropką — Google odrzuca przecinek dziesiętny
      // i spacje rozdzielające tysiące, których używa polski zapis.
      price: produkt.price.toFixed(2),
      priceValidUntil: zaRok.toISOString().slice(0, 10),
      availability:
        produkt.stock > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: sprzedawca(),
    },
  };

  if (produkt.image) znacznik.image = [produkt.image];
  if (produkt.sku) znacznik.sku = produkt.sku;
  if (produkt.barcode) znacznik.gtin = produkt.barcode;

  // Ocena wyłącznie przy prawdziwych opiniach. `AggregateRating` bez
  // recenzji jest tym, za co Google nakłada ręczną karę na wyniki
  // rozszerzone — a przy zerze i tak nie ma czego uśredniać.
  if (liczbaOpinii > 0 && srednia > 0) {
    znacznik.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: srednia.toFixed(1),
      reviewCount: liczbaOpinii,
      bestRating: '5',
      worstRating: '1',
    };
  }

  return znacznik;
}

/**
 * `BreadcrumbList` — ścieżka okruszków w wyniku wyszukiwania.
 *
 * Google pokazuje ją zamiast surowego adresu, więc zamiast
 * „sklep.pl › produkt › kubek-popiolowy" widać „Sklep › Ceramika › Kubek".
 */
export function znacznikOkruszkow(
  okruszki: { nazwa: string; adres: string }[]
): Znacznik {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: okruszki.map((o, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: o.nazwa,
      item: o.adres,
    })),
  };
}

/**
 * Serializacja bezpieczna dla `<script>`.
 *
 * `</script>` w dowolnym polu tekstowym (nazwa produktu, opis) zamknąłby
 * znacznik i reszta JSON-a wylądowałaby w dokumencie jako HTML. Ucieczka
 * na `<` zamyka tę drogę — to nie jest teoretyczne, opisy produktów pisze
 * człowiek przez panel.
 */
export function jakoJson(znacznik: Znacznik): string {
  return JSON.stringify(znacznik).replace(/</g, '\\u003c');
}
