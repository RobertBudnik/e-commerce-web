/**
 * Warstwa dostępu do Supabase.
 *
 * Jedyne miejsce w froncie, które wie o istnieniu bazy. Reszta kodu woła
 * `Backend.*` i dostaje dane w kształcie, którego używała od początku
 * (ceny w złotówkach, pole `icon`, `specs` jako obiekt) — dzięki temu
 * podpinanie idzie ekran po ekranie, bez przepisywania wszystkiego naraz.
 *
 * Gdy BACKEND_ENABLED jest false, każda metoda zwraca null i wywołujący
 * spada na dotychczasową ścieżkę z localStorage.
 */
const Backend = {
  client: null,
  ready: false,

  /** Ładuje bibliotekę i tworzy klienta. Wołane raz, przy starcie strony. */
  async init() {
    if (!BACKEND_ENABLED) return false;
    if (this.ready) return true;

    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true },
      });
      this.ready = true;
      return true;
    } catch (e) {
      console.warn('Nie udało się połączyć z backendem, zostajemy na danych lokalnych:', e);
      return false;
    }
  },

  // -------------------------------------------------------------------------
  // Katalog
  // -------------------------------------------------------------------------

  /** Nazwa kubełka ze zdjęciami produktów. */
  bucket: 'product-images',

  /**
   * Ścieżka z bazy → publiczny adres pliku. W tabeli trzymamy samą ścieżkę,
   * bo adres projektu zmienia się przy przejściu na domenę, a ścieżka nie.
   */
  imageUrl(path) {
    if (!path || !this.client) return null;
    return this.client.storage.from(this.bucket).getPublicUrl(path).data.publicUrl;
  },

  /** Wiersz z bazy → kształt, którego używa reszta frontu. */
  toProduct(row) {
    return {
      id: row.id,
      slug: row.slug,
      imagePath: row.image_path ?? null,
      image: this.imageUrl(row.image_path),
      name: row.name,
      short: row.short ?? '',
      category: row.category_id,
      price: row.price_cents / 100,
      oldPrice: row.old_price_cents ? row.old_price_cents / 100 : null,
      rating: Number(row.rating) || 0,
      reviews: row.reviews_count ?? 0,
      stock: row.stock ?? 0,
      icon: row.icon ?? 'grid',
      badge: row.badge ?? null,
      specs: row.specs ?? {},
      isActive: row.is_active,
    };
  },

  /** Nazwa → slug bez polskich znaków. Kolumna jest NOT NULL i unikalna. */
  slugify(name) {
    return String(name ?? '')
      .toLowerCase()
      .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l')
      .replace(/ń/g, 'n').replace(/ó/g, 'o').replace(/ś/g, 's').replace(/[żź]/g, 'z')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'produkt';
  },

  /** Odwrotna zamiana — do zapisu z panelu produktów. */
  toRow(product) {
    return {
      // Formularz panelu nie zna slugów, a kolumna jest NOT NULL — przy edycji
      // niesie go edytowany produkt, przy nowym składamy go z nazwy.
      slug: product.slug || this.slugify(product.name),
      image_path: product.imagePath ?? null,
      name: product.name,
      short: product.short,
      category_id: product.category,
      price_cents: Math.round(product.price * 100),
      old_price_cents: product.oldPrice ? Math.round(product.oldPrice * 100) : null,
      rating: product.rating,
      reviews_count: product.reviews,
      stock: product.stock,
      icon: product.icon,
      badge: product.badge,
      specs: product.specs,
    };
  },

  async fetchCatalog() {
    if (!(await this.init())) return null;

    const [products, categories] = await Promise.all([
      this.client.from('products').select('*').order('created_at', { ascending: true }),
      this.client.from('categories').select('*').order('position', { ascending: true }),
    ]);

    if (products.error) {
      console.warn('Błąd pobierania produktów:', products.error.message);
      return null;
    }

    return {
      products: products.data.map((row) => this.toProduct(row)),
      categories: (categories.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        desc: c.description,
        icon: c.icon,
      })),
    };
  },

  async saveProduct(product) {
    if (!(await this.init())) return null;

    const row = this.toRow(product);
    const save = (r) =>
      product.id
        ? this.client.from('products').update(r).eq('id', product.id).select().single()
        : this.client.from('products').insert(r).select().single();

    let { data, error } = await save(row);

    // Dwa produkty o tej samej nazwie dają ten sam slug — druga próba
    // z krótką końcówką zamiast błędu w twarz
    if (error?.code === '23505') {
      ({ data, error } = await save({ ...row, slug: `${row.slug}-${Math.random().toString(36).slice(2, 6)}` }));
    }

    if (error) throw new Error(error.message);
    return this.toProduct(data);
  },

  async deleteProduct(id) {
    if (!(await this.init())) return null;
    const { error } = await this.client.from('products').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  },

  /**
   * Wgrywa zdjęcie produktu i oddaje ścieżkę w kubełku. Nazwa pliku jest
   * losowa: nazwy od klienta bywają zajęte, mają spacje i polskie znaki.
   * Uprawnienia sprawdza polityka na `storage.objects`, nie ten kod.
   */
  async uploadProductImage(file) {
    if (!(await this.init())) return null;

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${crypto.randomUUID()}.${ext}`;

    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(path, file, { cacheControl: '31536000', contentType: file.type, upsert: false });

    if (error) throw new Error(error.message);
    return path;
  },

  /** Kasuje plik po podmianie zdjęcia. Błąd tu nie może wywrócić zapisu produktu. */
  async removeProductImage(path) {
    if (!path || !(await this.init())) return null;
    const { error } = await this.client.storage.from(this.bucket).remove([path]);
    if (error) console.warn('Nie udało się skasować starego zdjęcia:', error.message);
    return true;
  },

  // -------------------------------------------------------------------------
  // Sesja
  // -------------------------------------------------------------------------

  /** Sesja + rola z tokenu. Rolę wystawia hook custom_access_token_hook. */
  async currentUser() {
    if (!(await this.init())) return null;

    const { data } = await this.client.auth.getSession();
    if (!data.session) return null;

    const payload = this.decodeClaims(data.session.access_token);
    const meta = data.session.user.user_metadata ?? {};

    return {
      id: data.session.user.id,
      email: data.session.user.email,
      name: meta.full_name || data.session.user.email.split('@')[0],
      // Hook dokłada `user_role` do access tokenu; przy braku hooka zostaje klient
      role: payload?.user_role === 'owner' || payload?.user_role === 'manager' || payload?.user_role === 'staff'
        ? 'admin'
        : 'customer',
      rawRole: payload?.user_role ?? 'customer',
    };
  },

  decodeClaims(token) {
    try {
      const [, payload] = token.split('.');
      return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return null;
    }
  },

  async signIn(email, password) {
    if (!(await this.init())) return null;
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data;
  },

  async signUp(email, password, fullName) {
    if (!(await this.init())) return null;
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async signOut() {
    if (!(await this.init())) return null;
    await this.client.auth.signOut();
    return true;
  },

  // -------------------------------------------------------------------------
  // Zamówienia
  // -------------------------------------------------------------------------

  /** Adres z kolumny jsonb → jedna linijka do wyświetlenia. */
  formatAddress(addr) {
    if (!addr) return '';
    const line = [addr.street, [addr.postal_code, addr.city].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', ');
    return line;
  },

  /** Wiersz zamówienia → kształt, którego używa panel konta. */
  toOrder(row) {
    const addr = row.shipping_address ?? {};
    return {
      id: row.order_number,
      uuid: row.id,
      date: row.created_at,
      status: row.status,
      paymentStatus: row.payment_status,
      customer: addr.recipient || row.email,
      email: row.email,
      phone: row.phone ?? addr.phone ?? '',
      address: this.formatAddress(addr),
      subtotal: row.subtotal_cents / 100,
      discount: row.discount_cents / 100,
      shipping: row.shipping_cents / 100,
      total: row.total_cents / 100,
      items: (row.order_items ?? []).map((i) => ({
        id: i.product_id,
        name: i.name,
        qty: i.qty,
        price: i.unit_price_cents / 100,
      })),
    };
  },

  /**
   * Zamówienia widoczne dla zalogowanego konta. Zakres wycina RLS:
   * klient dostaje wyłącznie swoje, konto z `orders.read_all` — wszystkie.
   * Front niczego tu nie filtruje, bo filtr w przeglądarce nie jest filtrem.
   */
  async myOrders() {
    if (!(await this.init())) return null;
    const { data, error } = await this.client
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('Błąd pobierania zamówień:', error.message);
      return null;
    }
    return data.map((row) => this.toOrder(row));
  },

  /** Ustawienia sklepu — próg darmowej dostawy i koszt wysyłki z bazy. */
  async storeSettings() {
    if (!(await this.init())) return null;
    const { data, error } = await this.client
      .from('store_settings')
      .select('shipping_flat_cents, free_shipping_threshold_cents, currency')
      .maybeSingle();
    if (error) return null;
    return data;
  },

  /**
   * Podgląd sumy koszyka policzony w bazie: ceny z katalogu, rabat z tabeli
   * kuponów, dostawa z ustawień sklepu. Nic nie zapisuje — te same reguły
   * zastosuje potem create_order, więc kwota na podsumowaniu i na zamówieniu
   * nie mają prawa się rozjechać.
   */
  async quote({ items, coupon }) {
    if (!(await this.init())) return null;

    const { data, error } = await this.client.rpc('quote_order', {
      p_items: items.map((i) => ({ product_id: i.id, qty: i.qty })),
      p_coupon: coupon ?? null,
    });

    if (error) {
      console.warn('Błąd wyceny koszyka:', error.message);
      return null;
    }

    return {
      subtotal: data.subtotal_cents / 100,
      discount: data.discount_cents / 100,
      shipping: data.shipping_cents / 100,
      total: data.total_cents / 100,
      coupon: data.coupon,
      couponValid: data.coupon_valid,
      percentOff: data.percent_off,
      freeShippingFrom: data.free_shipping_threshold_cents / 100,
      freeShippingMissing: data.free_shipping_missing_cents / 100,
      lines: (data.lines ?? []).map((l) => ({
        id: l.product_id,
        name: l.name,
        qty: l.qty,
        price: l.unit_price_cents / 100,
        total: l.line_total_cents / 100,
        stock: l.stock,
        inStock: l.in_stock,
      })),
    };
  },

  /**
   * Składa zamówienie. Ceny, rabat i dostawę liczy baza — stąd lecą
   * wyłącznie identyfikatory i ilości.
   */
  async checkout({ items, email, phone, address, coupon }) {
    if (!(await this.init())) return null;

    const { data, error } = await this.client.functions.invoke('create-checkout', {
      body: {
        items: items.map((i) => ({ product_id: i.id, qty: i.qty })),
        email,
        phone: phone ?? null,
        shipping_address: address ?? null,
        coupon: coupon ?? null,
      },
    });

    // FunctionsHttpError chowa treść odpowiedzi w `context` — bez tego do
    // klienta dociera samo „non-2xx status code" zamiast powodu odmowy.
    if (error) {
      const body = await error.context?.json?.().catch(() => null);
      throw new Error(body?.error ?? error.message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  },

  /**
   * Zmiana statusu zamówienia. Wpuszcza wyłącznie polityka „zamówienia: obsługa",
   * czyli konto z uprawnieniem `orders.write` — klient dostanie zero wierszy,
   * a nie błąd, bo RLS na UPDATE po prostu nie widzi cudzego zamówienia.
   */
  async setOrderStatus(orderId, status) {
    if (!(await this.init())) return null;

    const { data, error } = await this.client
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .select('*, order_items(*)');

    if (error) throw new Error(error.message);
    if (!data.length) throw new Error('Brak uprawnień do zmiany statusu tego zamówienia');
    return this.toOrder(data[0]);
  },

  /**
   * Anulowanie. Idzie przez funkcję, nie przez UPDATE, bo poza statusem musi
   * wrócić towar na magazyn — a tego przeglądarce zrobić nie wolno.
   */
  async cancelOrder(orderId) {
    if (!(await this.init())) return null;

    const { data, error } = await this.client.rpc('cancel_order', { p_order_id: orderId });
    if (error) throw new Error(error.message);
    return data ? this.toOrder(Array.isArray(data) ? data[0] : data) : null;
  },

  /**
   * Jedno zamówienie po numerze. RLS oddaje je właścicielowi zamówienia
   * albo zapleczu — zamówienie gościa nie jest widoczne dla nikogo innego,
   * więc strona potwierdzenia musi umieć pokazać sam numer.
   */
  async orderByNumber(orderNumber) {
    if (!(await this.init())) return null;

    const { data, error } = await this.client
      .from('orders')
      .select('*, order_items(*)')
      .eq('order_number', orderNumber)
      .maybeSingle();

    if (error || !data) return null;
    return this.toOrder(data);
  },

  // -------------------------------------------------------------------------
  // Profil i adresy
  // -------------------------------------------------------------------------

  /**
   * Profil zalogowanego konta. Filtr po `id` jest konieczny: konto zaplecza
   * ma `customers.read`, więc bez niego RLS wypuściłby wszystkie wiersze.
   */
  async profile() {
    if (!(await this.init())) return null;
    const user = await this.currentUser();
    if (!user) return null;

    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) return null;
    return data;
  },

  async saveProfile(patch) {
    if (!(await this.init())) return null;
    const user = await this.currentUser();
    if (!user) return null;

    const { error } = await this.client
      .from('profiles')
      .update({ full_name: patch.name, phone: patch.phone, newsletter: patch.newsletter })
      .eq('id', user.id);

    if (error) throw new Error(error.message);
    return true;
  },

  /** Domyślny adres dostawy konta; brak wpisu = null. */
  async defaultAddress() {
    if (!(await this.init())) return null;
    const user = await this.currentUser();
    if (!user) return null;

    const { data, error } = await this.client
      .from('addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) return null;
    return data?.[0] ?? null;
  },

  /**
   * Zapis adresu dostawy. Jeden adres domyślny na konto — kolejny zapis
   * nadpisuje istniejący wiersz zamiast mnożyć kopie.
   */
  async saveAddress(addr) {
    if (!(await this.init())) return null;
    const user = await this.currentUser();
    if (!user) return null;

    const row = {
      user_id: user.id,
      recipient: addr.recipient || user.email,
      street: addr.street,
      postal_code: addr.zip,
      city: addr.city,
      phone: addr.phone || null,
      is_default: true,
    };

    const current = await this.defaultAddress();
    const query = current
      ? this.client.from('addresses').update(row).eq('id', current.id)
      : this.client.from('addresses').insert(row);

    const { error } = await query;
    if (error) throw new Error(error.message);
    return true;
  },

  // -------------------------------------------------------------------------
  // Lista życzeń
  // -------------------------------------------------------------------------

  /** Produkty z listy życzeń. RLS nie wypuszcza cudzych wpisów. */
  async wishlist() {
    if (!(await this.init())) return null;

    const { data, error } = await this.client
      .from('wishlists')
      .select('product_id, products(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Błąd pobierania listy życzeń:', error.message);
      return null;
    }

    return data.filter((r) => r.products).map((r) => this.toProduct(r.products));
  },

  async addToWishlist(productId) {
    if (!(await this.init())) return null;
    const user = await this.currentUser();
    if (!user) return null;

    const { error } = await this.client
      .from('wishlists')
      .upsert({ user_id: user.id, product_id: productId }, { onConflict: 'user_id,product_id' });

    if (error) throw new Error(error.message);
    return true;
  },

  async removeFromWishlist(productId) {
    if (!(await this.init())) return null;
    const user = await this.currentUser();
    if (!user) return null;

    const { error } = await this.client
      .from('wishlists')
      .delete()
      .eq('user_id', user.id)
      .eq('product_id', productId);

    if (error) throw new Error(error.message);
    return true;
  },
};
