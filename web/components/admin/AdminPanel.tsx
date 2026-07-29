'use client';

import Image from 'next/image';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, ICON_PATHS } from '@/components/Icon';
import { deleteProductAction, saveProductAction } from '@/app/actions/catalog';
import { toast } from '@/components/ui/ToastHost';
import { money } from '@/lib/format';
import { specsToText } from '@/lib/specs';
import type { Category, Product } from '@/lib/types';

export function AdminPanel({ products, categories }: { products: Product[]; categories: Category[] }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState<Product | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dropImage, setDropImage] = useState(false);
  const [hint, setHint] = useState('JPG, PNG, WebP lub AVIF, do 5 MB. Bez zdjęcia kafelek pokazuje ikonę.');
  const [saving, startSave] = useTransition();

  function startEdit(product: Product) {
    setEditing(product);
    setDropImage(false);
    setPreview(product.image);
    setHint('JPG, PNG, WebP lub AVIF, do 5 MB.');
    if (fileInput.current) fileInput.current.value = '';
    form.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetForm() {
    setEditing(null);
    setDropImage(false);
    setPreview(null);
    setHint('JPG, PNG, WebP lub AVIF, do 5 MB. Bez zdjęcia kafelek pokazuje ikonę.');
    form.current?.reset();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast('Zdjęcie waży ponad 5 MB — kubełek go nie przyjmie');
      e.target.value = '';
      return;
    }

    setDropImage(false);
    // Podgląd z pliku, zanim cokolwiek poleci na serwer
    setPreview(URL.createObjectURL(file));
    setHint(`Do wgrania: ${file.name}`);
  }

  function clearImage() {
    if (fileInput.current) fileInput.current.value = '';
    setDropImage(Boolean(editing?.imagePath));
    setPreview(null);
    setHint('Zdjęcie zniknie po zapisaniu produktu.');
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('dropImage', dropImage ? '1' : '0');

    startSave(async () => {
      const result = await saveProductAction(formData);
      if (!result.ok) {
        toast(`Nie zapisano: ${result.error}`);
        return;
      }
      toast(editing ? 'Produkt zaktualizowany' : 'Produkt dodany');
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

  return (
    <div className="admin-layout">
      <section>
        <h2>{editing ? `Edycja: ${editing.name}` : 'Nowy produkt'}</h2>
        <div className="card-box">
          <form ref={form} onSubmit={submit} key={editing?.id ?? 'new'}>
            <input type="hidden" name="id" value={editing?.id ?? ''} />
            <input type="hidden" name="slug" value={editing?.slug ?? ''} />
            <input type="hidden" name="currentImagePath" value={editing?.imagePath ?? ''} />

            <div className="field">
              <label htmlFor="a-name">Nazwa</label>
              <input id="a-name" name="name" type="text" required defaultValue={editing?.name ?? ''} />
            </div>

            <div className="field">
              <label htmlFor="a-short">Krótki opis</label>
              <textarea id="a-short" name="short" rows={2} required defaultValue={editing?.short ?? ''} />
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="a-category">Kategoria</label>
                <select id="a-category" name="category" defaultValue={editing?.category ?? categories[0]?.id}>
                  {categories.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="a-icon">Ikona zastępcza</label>
                <select id="a-icon" name="icon" defaultValue={editing?.icon ?? 'grid'}>
                  {Object.keys(ICON_PATHS).map((key) => (
                    <option value={key} key={key}>
                      {key}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="a-image">Zdjęcie produktu</label>
              <div className="uploader">
                <div className="uploader-preview">
                  {preview ? (
                    <Image className="media-img" src={preview} alt="" fill sizes="96px" unoptimized />
                  ) : (
                    <span className="uploader-empty">
                      <Icon name="camera" />
                    </span>
                  )}
                </div>
                <div className="uploader-body">
                  <input
                    id="a-image"
                    name="image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    ref={fileInput}
                    onChange={onFile}
                  />
                  <p className="field-hint">{hint}</p>
                  {preview && (
                    <button className="btn-link" type="button" onClick={clearImage}>
                      Usuń zdjęcie
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="a-price">Cena (zł)</label>
                <input
                  id="a-price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={editing?.price ?? ''}
                />
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
                  defaultValue={editing?.oldPrice ?? ''}
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="a-stock">Stan magazynowy</label>
                <input id="a-stock" name="stock" type="number" min="0" required defaultValue={editing?.stock ?? 0} />
              </div>
              <div className="field">
                <label htmlFor="a-badge">Plakietka</label>
                <input
                  id="a-badge"
                  name="badge"
                  type="text"
                  placeholder="-19% albo Nowość"
                  defaultValue={editing?.badge ?? ''}
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="a-rating">Ocena (0–5)</label>
                <input
                  id="a-rating"
                  name="rating"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  defaultValue={editing?.rating ?? 0}
                />
              </div>
              <div className="field">
                <label htmlFor="a-reviews">Liczba opinii</label>
                <input id="a-reviews" name="reviews" type="number" min="0" defaultValue={editing?.reviews ?? 0} />
              </div>
            </div>

            <div className="field">
              <label htmlFor="a-specs">Specyfikacja</label>
              <textarea
                id="a-specs"
                name="specs"
                rows={5}
                placeholder="Typ: Nauszne, zamknięte"
                defaultValue={editing ? specsToText(editing.specs) : ''}
              />
              <p className="field-hint">Jedna linia = <code>Klucz: wartość</code>.</p>
            </div>

            <button className="btn btn-block" type="submit" disabled={saving} style={{ marginTop: 20 }}>
              {saving ? 'Zapisuję…' : editing ? 'Zapisz zmiany' : 'Dodaj produkt'}
            </button>
            {editing && (
              <button className="btn btn-ghost btn-block" type="button" style={{ marginTop: 10 }} onClick={resetForm}>
                Anuluj edycję
              </button>
            )}
          </form>
        </div>
      </section>

      <section>
        <h2>Katalog</h2>
        <div>
          {products.map((product) => (
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
                  {product.slug} · {categories.find((c) => c.id === product.category)?.name ?? product.category} ·{' '}
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
          ))}
        </div>
      </section>
    </div>
  );
}
