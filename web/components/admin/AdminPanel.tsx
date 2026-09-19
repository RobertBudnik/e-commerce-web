'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, ICON_PATHS } from '@/components/Icon';
import { deleteProductAction, saveProductAction } from '@/app/actions/catalog';
import { GaleriaPanelu } from './GaleriaPanelu';
import { ProductCard } from '@/components/product/ProductCard';
import { toast } from '@/components/ui/ToastHost';
import { money } from '@/lib/format';
import { specsToText } from '@/lib/specs';
import type { Category, Product } from '@/lib/types';

const MAX_BAJTOW = 5 * 1024 * 1024;
const KLUCZ_SZKICU = 'nordo-szkic-produktu';
const PODPOWIEDZ_ZDJECIA = 'Przeciągnij plik, wklej ze schowka albo wybierz z dysku. JPG, PNG, WebP lub AVIF, do 5 MB.';

/** Pola, które widać na kafelku — tylko one muszą żyć w stanie. */
type Szkic = {
  name: string;
  short: string;
  category: string;
  price: string;
  oldPrice: string;
  stock: string;
  badge: string;
  rating: string;
  reviews: string;
  icon: string;
};

const PUSTY_SZKIC: Szkic = {
  name: '',
  short: '',
  category: '',
  price: '',
  oldPrice: '',
  stock: '0',
  badge: '',
  rating: '0',
  reviews: '0',
  icon: 'grid',
};

function szkicZProduktu(p: Product): Szkic {
  return {
    name: p.name,
    short: p.short,
    category: p.category,
    price: String(p.price),
    oldPrice: p.oldPrice != null ? String(p.oldPrice) : '',
    stock: String(p.stock),
    badge: p.badge ?? '',
    rating: String(p.rating),
    reviews: String(p.reviews),
    icon: p.icon,
  };
}

export function AdminPanel({ products, categories }: { products: Product[]; categories: Category[] }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState<Product | null>(null);
  const [szkic, setSzkic] = useState<Szkic>(PUSTY_SZKIC);
  const [preview, setPreview] = useState<string | null>(null);
  const [dropImage, setDropImage] = useState(false);
  const [hint, setHint] = useState(PODPOWIEDZ_ZDJECIA);
  const [nadPolem, setNadPolem] = useState(false);
  const [sprawdzaj, setSprawdzaj] = useState(false);
  const [szukaj, setSzukaj] = useState('');
  const [saving, startSave] = useTransition();

  /* --- szkic w pamięci przeglądarki ------------------------------------- */

  // Odświeżenie karty w połowie wpisywania produktu kosztowało dotąd całą
  // robotę od nowa. Szkic dotyczy wyłącznie nowego produktu — przy edycji
  // źródłem prawdy jest wiersz z bazy, nie to, co ktoś zostawił w karcie.
  useEffect(() => {
    try {
      const zapis = localStorage.getItem(KLUCZ_SZKICU);
      if (zapis) setSzkic({ ...PUSTY_SZKIC, ...JSON.parse(zapis) });
    } catch {
      /* prywatne okno albo uszkodzony wpis — szkic to wygoda, nie wymóg */
    }
  }, []);

  useEffect(() => {
    if (editing) return;
    try {
      const cos = Object.values(szkic).some((v) => v && v !== '0' && v !== 'grid');
      if (cos) localStorage.setItem(KLUCZ_SZKICU, JSON.stringify(szkic));
      else localStorage.removeItem(KLUCZ_SZKICU);
    } catch {
      /* jw. */
    }
  }, [szkic, editing]);

  /* --- podgląd na żywo --------------------------------------------------- */

  const rodzajNazwa = szkic.category.trim();
  const podglad: Product = useMemo(
    () => ({
      id: 'podglad',
      slug: 'podglad',
      name: szkic.name.trim() || 'Nazwa produktu',
      short: szkic.short,
      category: rodzajNazwa,
      price: Number(szkic.price) || 0,
      oldPrice: szkic.oldPrice ? Number(szkic.oldPrice) : null,
      // Podgląd w panelu nie ma historii cen, więc nie ma skąd wziąć
      // najniższej z 30 dni. `null` jest tu poprawną odpowiedzią: karta
      // pokaże cenę bez obniżki, zamiast obniżki bez wymaganej informacji.
      najnizsza30: null,
      rating: Number(szkic.rating) || 0,
      reviews: Number(szkic.reviews) || 0,
      stock: Number(szkic.stock) || 0,
      barcode: null,
      sku: null,
      progNiski: editing?.progNiski ?? 5,
      icon: szkic.icon || 'grid',
      badge: szkic.badge.trim() || null,
      specs: {},
      imagePath: null,
      image: preview,
    }),
    [szkic, rodzajNazwa, preview, editing]
  );

  const rabat =
    podglad.oldPrice && podglad.oldPrice > podglad.price
      ? Math.round((1 - podglad.price / podglad.oldPrice) * 100)
      : null;

  const stanNiski = podglad.progNiski > 0 && podglad.stock <= podglad.progNiski;

  /* --- formularz --------------------------------------------------------- */

  // Jeden uchwyt na cały formularz zamiast `onChange` przy każdym polu:
  // formularz zostaje niekontrolowany (zapis leci z `FormData`), a do stanu
  // trafia tylko to, co odrysowuje kafelek.
  function naWpis(e: React.FormEvent<HTMLFormElement>) {
    const el = e.target as HTMLInputElement;
    if (!el.name || !(el.name in PUSTY_SZKIC)) return;
    setSzkic((s) => ({ ...s, [el.name]: el.value }));
  }

  function startEdit(product: Product) {
    setEditing(product);
    setSzkic(szkicZProduktu(product));
    setDropImage(false);
    setPreview(product.image);
    setSprawdzaj(false);
    setHint(PODPOWIEDZ_ZDJECIA);
    if (fileInput.current) fileInput.current.value = '';
    form.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const resetForm = useCallback(() => {
    setEditing(null);
    setSzkic(PUSTY_SZKIC);
    setDropImage(false);
    setPreview(null);
    setSprawdzaj(false);
    setHint(PODPOWIEDZ_ZDJECIA);
    form.current?.reset();
    try {
      localStorage.removeItem(KLUCZ_SZKICU);
    } catch {
      /* jw. */
    }
  }, []);

  /* --- zdjęcie: wybór, przeciągnięcie, wklejenie ------------------------- */

  const przyjmijPlik = useCallback((file: File | null | undefined) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast('To nie jest obrazek');
      return;
    }
    if (file.size > MAX_BAJTOW) {
      toast('Zdjęcie waży ponad 5 MB — kubełek go nie przyjmie');
      return;
    }

    // Plik z przeciągnięcia i ze schowka nie przechodzi przez `<input>`,
    // a akcja serwerowa czyta właśnie stamtąd — przekładamy go ręcznie.
    if (fileInput.current) {
      const paczka = new DataTransfer();
      paczka.items.add(file);
      fileInput.current.files = paczka.files;
    }

    setDropImage(false);
    setPreview(URL.createObjectURL(file));
    setHint(`Do wgrania: ${file.name}`);
  }, []);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    przyjmijPlik(e.target.files?.[0]);
  }

  function clearImage() {
    if (fileInput.current) fileInput.current.value = '';
    setDropImage(Boolean(editing?.imagePath));
    setPreview(null);
    setHint('Zdjęcie zniknie po zapisaniu produktu.');
  }

  // Wklejanie ze schowka: zrzut ekranu albo skopiowany obrazek trafia prosto
  // w formularz, bez zapisywania go wcześniej na dysk.
  useEffect(() => {
    function naWklejenie(e: ClipboardEvent) {
      const plik = [...(e.clipboardData?.items ?? [])]
        .find((i) => i.kind === 'file' && i.type.startsWith('image/'))
        ?.getAsFile();
      if (plik) przyjmijPlik(plik);
    }
    document.addEventListener('paste', naWklejenie);
    return () => document.removeEventListener('paste', naWklejenie);
  }, [przyjmijPlik]);

  /* --- skróty klawiaturowe ---------------------------------------------- */

  useEffect(() => {
    function naKlawisz(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        form.current?.requestSubmit();
        return;
      }
      // Escape wychodzi z edycji, ale nie wtedy, gdy ktoś jest w polu —
      // tam kasuje wpisywany tekst i przerwanie całej edycji byłoby napadem.
      if (e.key === 'Escape' && editing) {
        const w = document.activeElement?.tagName;
        if (w !== 'INPUT' && w !== 'TEXTAREA' && w !== 'SELECT') resetForm();
      }
    }
    document.addEventListener('keydown', naKlawisz);
    return () => document.removeEventListener('keydown', naKlawisz);
  }, [editing, resetForm]);

  /* --- zapis ------------------------------------------------------------- */

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSprawdzaj(true);

    const formData = new FormData(e.currentTarget);
    formData.set('dropImage', dropImage ? '1' : '0');

    startSave(async () => {
      const result = await saveProductAction(formData);
      if (!result.ok) {
        toast(`Nie zapisano: ${result.error}`);
        return;
      }
      toast(editing ? 'Produkt zaktualizowany' : 'Produkt dodany — jest już w sklepie');
      resetForm();
      router.refresh();
    });
  }

  function remove(product: Product) {
    if (!confirm(`Usunąć „${product.name}"?`)) return;

    startSave(async () => {
      const result = await deleteProductAction(product.id, product.imagePath);
      if (!result.ok) {
        toast(`Nie usunięto: ${result.error}`);
        return;
      }
      toast('Produkt usunięty');
      if (editing?.id === product.id) resetForm();
      router.refresh();
    });
  }

  /* --- lista ------------------------------------------------------------- */

  const widoczne = useMemo(() => {
    const f = szukaj.trim().toLowerCase();
    if (!f) return products;
    return products.filter((p) =>
      [p.name, p.slug, p.category, p.barcode ?? ''].some((v) => v.toLowerCase().includes(f))
    );
  }, [products, szukaj]);

  const brakNazwy = sprawdzaj && !szkic.name.trim();
  const brakCeny = sprawdzaj && !szkic.price;

  return (
    <>
      <div className="panel-produkt">
        <form
          id="formularz-produktu"
          ref={form}
          onSubmit={submit}
          onInput={naWpis}
          key={editing?.id ?? 'new'}
          noValidate
        >
          <input type="hidden" name="id" value={editing?.id ?? ''} />
          <input type="hidden" name="slug" value={editing?.slug ?? ''} />
          <input type="hidden" name="currentImagePath" value={editing?.imagePath ?? ''} />

          <section className="panel-sekcja" style={{ ['--krok' as string]: 0 }}>
            <h2 className="panel-sekcja-tytul">
              <span className="label">Krok pierwszy</span>
              Podstawy
            </h2>

            <div className="field">
              <label htmlFor="a-name">Nazwa</label>
              <input
                id="a-name"
                name="name"
                type="text"
                placeholder="Słuchawki bezprzewodowe Aura X"
                aria-invalid={brakNazwy}
                defaultValue={editing?.name ?? szkic.name}
              />
              {brakNazwy && <p className="pole-blad">Bez nazwy produkt nie trafi na półkę.</p>}
            </div>

            <div className="field">
              <label htmlFor="a-short">Krótki opis</label>
              <input
                id="a-short"
                name="short"
                type="text"
                placeholder="Jedno zdanie, które widać na karcie produktu"
                defaultValue={editing?.short ?? szkic.short}
              />
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="a-category">Rodzaj</label>
                <input
                  id="a-category"
                  name="category"
                  type="text"
                  list="rodzaje-produktow"
                  placeholder="Audio"
                  autoComplete="off"
                  defaultValue={
                    editing
                      ? categories.find((c) => c.id === editing.category)?.name ?? editing.category
                      : szkic.category
                  }
                />
                <datalist id="rodzaje-produktow">
                  {categories.map((c) => (
                    <option value={c.name} key={c.id} />
                  ))}
                </datalist>
                <p className="field-hint">
                  Wpisz własny albo wybierz z użytych. Nowy rodzaj zakłada się sam i od razu
                  pojawia się w filtrze sklepu.
                </p>
              </div>
              <div className="field">
                <label htmlFor="a-icon">Ikona zastępcza</label>
                <select id="a-icon" name="icon" defaultValue={editing?.icon ?? szkic.icon}>
                  {Object.keys(ICON_PATHS).map((key) => (
                    <option value={key} key={key}>
                      {key}
                    </option>
                  ))}
                </select>
                <p className="field-hint">Widoczna, gdy produkt nie ma zdjęcia.</p>
              </div>
            </div>
          </section>

          <section className="panel-sekcja" style={{ ['--krok' as string]: 1 }}>
            <h2 className="panel-sekcja-tytul">
              <span className="label">Krok drugi</span>
              Cena i stan
            </h2>

            <div className="field-row">
              <div className="field">
                <label htmlFor="a-price">Cena (zł)</label>
                <input
                  id="a-price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  aria-invalid={brakCeny}
                  defaultValue={editing?.price ?? szkic.price}
                />
                {brakCeny && <p className="pole-blad">Podaj cenę — bez niej nie da się kupić.</p>}
              </div>
              <div className="field">
                <label htmlFor="a-oldprice">Cena przed obniżką</label>
                <input
                  id="a-oldprice"
                  name="oldPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="puste = brak"
                  defaultValue={editing?.oldPrice ?? szkic.oldPrice}
                />
                <p className="field-hint">
                  {rabat !== null ? (
                    <span className="pole-rabat num">Klient zobaczy −{rabat}%</span>
                  ) : (
                    'Musi być wyższa od ceny, inaczej promocji nie widać.'
                  )}
                </p>
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="a-stock">Stan magazynowy</label>
                <input
                  id="a-stock"
                  name="stock"
                  type="number"
                  min="0"
                  defaultValue={editing?.stock ?? szkic.stock}
                />
                {stanNiski && (
                  <p className="field-hint pole-uwaga">
                    {podglad.stock === 0
                      ? 'Zero na stanie — kafelek pokaże „Chwilowo niedostępny".'
                      : `Pod progiem ostrzegania (${podglad.progNiski} szt.).`}
                  </p>
                )}
              </div>
              <div className="field">
                <label htmlFor="a-barcode">Kod kreskowy</label>
                <input
                  id="a-barcode"
                  name="barcode"
                  type="text"
                  inputMode="numeric"
                  placeholder="EAN z opakowania"
                  defaultValue={editing?.barcode ?? ''}
                />
                <p className="field-hint">Po nim skaner w magazynie znajduje produkt.</p>
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="a-badge">Plakietka</label>
                <input
                  id="a-badge"
                  name="badge"
                  type="text"
                  placeholder="-19% albo Nowość"
                  defaultValue={editing?.badge ?? szkic.badge}
                />
              </div>
              <div className="field">
                <label htmlFor="a-rating">Ocena i opinie</label>
                <div className="pole-para">
                  <input
                    id="a-rating"
                    name="rating"
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    aria-label="Ocena od 0 do 5"
                    defaultValue={editing?.rating ?? szkic.rating}
                  />
                  <input
                    name="reviews"
                    type="number"
                    min="0"
                    aria-label="Liczba opinii"
                    defaultValue={editing?.reviews ?? szkic.reviews}
                  />
                </div>
                <p className="field-hint">
                  Prawdziwe oceny liczy baza z opinii kupujących. Wpisane ręcznie zostaną
                  nadpisane przy pierwszej opinii.
                </p>
              </div>
            </div>
          </section>

          <section className="panel-sekcja" style={{ ['--krok' as string]: 2 }}>
            <h2 className="panel-sekcja-tytul">
              <span className="label">Krok trzeci</span>
              Zdjęcia
            </h2>

            <div
              className={`dropzone${nadPolem ? ' dropzone-nad' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setNadPolem(true);
              }}
              onDragLeave={() => setNadPolem(false)}
              onDrop={(e) => {
                e.preventDefault();
                setNadPolem(false);
                przyjmijPlik(e.dataTransfer.files?.[0]);
              }}
            >
              <div className="dropzone-podglad">
                {preview ? (
                  <Image className="media-img" src={preview} alt="" fill sizes="112px" unoptimized />
                ) : (
                  <Icon name="camera" />
                )}
              </div>
              <div className="dropzone-tresc">
                <p className="field-hint">{hint}</p>
                <div className="dropzone-akcje">
                  <label className="btn btn-ghost btn-sm" htmlFor="a-image">
                    Wybierz plik
                  </label>
                  {preview && (
                    <button className="btn-link" type="button" onClick={clearImage}>
                      Usuń zdjęcie
                    </button>
                  )}
                </div>
                <input
                  id="a-image"
                  name="image"
                  type="file"
                  className="sr-only"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  ref={fileInput}
                  onChange={onFile}
                />
              </div>
            </div>

            {/* Dopiero przy istniejącym produkcie: nowy nie ma identyfikatora,
                do którego dałoby się przypiąć plik. */}
            {editing && <GaleriaPanelu productId={editing.id} />}
          </section>

          <section className="panel-sekcja" style={{ ['--krok' as string]: 3 }}>
            <h2 className="panel-sekcja-tytul">
              <span className="label">Krok czwarty</span>
              Specyfikacja
            </h2>
            <div className="field">
              <label htmlFor="a-specs" className="sr-only">
                Specyfikacja
              </label>
              <textarea
                id="a-specs"
                name="specs"
                rows={5}
                placeholder={'Typ: Nauszne, zamknięte\nŁączność: Bluetooth 5.3'}
                defaultValue={editing ? specsToText(editing.specs) : ''}
              />
              <p className="field-hint">
                Jedna linia = <code>Klucz: wartość</code>. Trafia do tabeli na karcie produktu.
              </p>
            </div>
          </section>
        </form>

        <aside className="panel-podglad">
          <div className="panel-podglad-pin">
            <h2 className="panel-sekcja-tytul">
              <span className="label">Na żywo</span>
              Tak zobaczy to klient
            </h2>

            {/* Prawdziwy kafelek ze sklepu, nie jego kopia — inaczej podgląd
                rozjeżdżałby się z katalogiem po każdej zmianie w karcie.
                Interakcje wyłączone: to obraz, nie działający produkt. */}
            <div className="panel-podglad-kafel" aria-hidden="true">
              <ProductCard product={podglad} categoryName={rodzajNazwa || 'Rodzaj'} />
            </div>

            <dl className="panel-fakty">
              <div>
                <dt>Cena</dt>
                <dd className="num">{money(podglad.price)}</dd>
              </div>
              {rabat !== null && (
                <div>
                  <dt>Obniżka</dt>
                  <dd className="num">−{rabat}%</dd>
                </div>
              )}
              <div>
                <dt>Stan</dt>
                <dd className={`num${stanNiski ? ' pole-uwaga' : ''}`}>{podglad.stock} szt.</dd>
              </div>
            </dl>

            {/* Przycisk stoi w kolumnie podglądu, a formularz w sąsiedniej —
                atrybut `form` wiąże je przez DOM, bez przenoszenia znacznika. */}
            <button className="btn btn-block" type="submit" form="formularz-produktu" disabled={saving}>
              {saving ? 'Zapisuję…' : editing ? 'Zapisz zmiany' : 'Dodaj produkt'}
            </button>
            {editing && (
              <button
                className="btn btn-ghost btn-block"
                type="button"
                style={{ marginTop: 10 }}
                onClick={resetForm}
              >
                Anuluj edycję
              </button>
            )}
            <p className="field-hint panel-skrot">
              <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>S</kbd> zapisuje{editing ? ', ' : '.'}
              {editing && (
                <>
                  <kbd>Esc</kbd> wychodzi z edycji.
                </>
              )}
            </p>
          </div>
        </aside>
      </div>

      <section className="panel-lista">
        <div className="section-head">
          <div>
            <span className="label">Katalog</span>
            {/* Wynik filtrowania czytany na głos — pole szukania nie mówi
                samo z siebie, ile zostało po wpisaniu frazy. */}
            <h2 aria-live="polite">
              {widoczne.length === products.length
                ? `${products.length} pozycji`
                : `${widoczne.length} z ${products.length}`}
            </h2>
          </div>
          <input
            className="panel-szukajka"
            type="search"
            value={szukaj}
            onChange={(e) => setSzukaj(e.target.value)}
            placeholder="Szukaj po nazwie, rodzaju albo kodzie"
            aria-label="Szukaj w katalogu"
          />
        </div>

        {widoczne.length === 0 ? (
          <p className="muted">{`Nic nie pasuje do „${szukaj}".`}</p>
        ) : (
          widoczne.map((product) => (
            <div className="admin-row" key={product.id}>
              <div className="admin-thumb">
                {product.image ? (
                  <Image className="media-img" src={product.image} alt="" fill sizes="52px" />
                ) : (
                  <Icon name={product.icon} />
                )}
              </div>
              <div>
                <div className="admin-name">{product.name}</div>
                <div className="order-meta">
                  {product.slug} ·{' '}
                  {categories.find((c) => c.id === product.category)?.name ?? product.category} ·{' '}
                  {product.stock > 0 ? `${product.stock} szt.` : 'brak w magazynie'}
                </div>
              </div>
              <div className="order-total">{money(product.price)}</div>
              <div className="admin-actions">
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => startEdit(product)}>
                  Edytuj
                </button>
                <button className="btn-link" type="button" onClick={() => remove(product)}>
                  Usuń
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </>
  );
}
