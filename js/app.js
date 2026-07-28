/**
 * Logika szablonu: koszyk w localStorage, render list produktów,
 * strona produktu, strona koszyka. Zero zależności.
 */

/* ---------- Konfiguracja ---------- */
const CART_KEY = 'shop.cart.v1';
const USER_KEY = 'shop.user.v1';
const CATALOG_KEY = 'shop.catalog.v1';

// Wartości zapasowe dla trybu bez bazy. Z włączonym backendem prawdą są
// `store_settings` i tabela `coupons` — patrz obiekt Store i Backend.quote().
const SHIPPING_FLAT = 19.99;
const FREE_SHIPPING_FROM = 300;
const COUPONS = { NOWY10: 0.10, LATO20: 0.20 };

/* ---------- Helpers ---------- */
const money = (n) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(n);

const stars = (r) => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));

const findProduct = (id) => PRODUCTS.find((p) => p.id === id);

const categoryName = (id) => CATEGORIES.find((c) => c.id === id)?.name ?? id;

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

/* ---------- Koszyk ---------- */
const Cart = {
  read() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(raw) ? raw.filter((i) => findProduct(i.id)) : [];
    } catch {
      return [];
    }
  },
  write(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    document.dispatchEvent(new CustomEvent('cart:change', { detail: items }));
  },
  add(id, qty = 1) {
    const stock = findProduct(id)?.stock ?? 0;
    if (stock <= 0) return;
    const items = Cart.read();
    const found = items.find((i) => i.id === id);
    if (found) {
      found.qty = Math.min(found.qty + qty, stock);
    } else {
      items.push({ id, qty: Math.min(qty, stock) });
    }
    Cart.write(items);
  },
  setQty(id, qty) {
    const stock = findProduct(id)?.stock ?? 0;
    const items = Cart.read()
      .map((i) => (i.id === id ? { ...i, qty: Math.max(0, Math.min(qty, stock)) } : i))
      .filter((i) => i.qty > 0);
    Cart.write(items);
  },
  remove(id) {
    Cart.write(Cart.read().filter((i) => i.id !== id));
  },
  clear() {
    Cart.write([]);
  },
  count() {
    return Cart.read().reduce((sum, i) => sum + i.qty, 0);
  },
  subtotal() {
    return Cart.read().reduce((sum, i) => sum + (findProduct(i.id)?.price ?? 0) * i.qty, 0);
  },
};

/* ---------- Sesja ----------
 * Źródłem prawdy jest Supabase Auth: hasło z formularza leci do bazy,
 * sesję trzyma klient supabase-js, a rolę niesie claim `user_role`
 * w access tokenie (dokłada go hook custom_access_token_hook).
 * Gdy backend jest wyłączony albo nie odpowiada, zostaje dotychczasowa
 * atrapa na localStorage — ten sam wzorzec fallbacku co w Catalog.
 *
 * `Auth.load()` leci raz w bootstrapie i odkłada użytkownika w `cached`,
 * dzięki czemu `Auth.user()` zostaje synchroniczne i render nie musi czekać.
 */
const Auth = {
  /** Skąd ostatecznie przyszła sesja — 'baza' albo 'localStorage'. */
  source: 'localStorage',

  /** Użytkownik z ostatniego load()/logowania. null = niezalogowany. */
  cached: null,

  async load() {
    // Ścieżka docelowa: sesja z Supabase. Gdy backend nie jest skonfigurowany
    // albo nie odpowiada, spadamy na atrapę z localStorage i strona działa dalej.
    if (typeof BACKEND_ENABLED !== 'undefined' && BACKEND_ENABLED) {
      if (await Backend.init()) {
        Auth.source = 'baza';
        Auth.cached = await Backend.currentUser();
        return Auth.cached;
      }
      console.warn('Backend nie odpowiedział — sesja z danych lokalnych.');
    }

    Auth.cached = Auth.readLocal();
    return Auth.cached;
  },

  /** Synchroniczny odczyt dla renderu — stan z ostatniego load()/logowania. */
  user() {
    return Auth.cached;
  },

  /**
   * Logowanie hasłem. W trybie 'baza' hasło idzie prosto do Supabase i nigdzie
   * nie jest zapisywane po stronie przeglądarki. Błędy lecą wyżej — formularz
   * pokazuje je przy polu.
   */
  async signIn(email, password) {
    if (Auth.source === 'baza') {
      await Backend.signIn(email, password);
      Auth.cached = await Backend.currentUser();
      Auth.emit();
      return Auth.cached;
    }
    return Auth.signInLocal({ email });
  },

  /**
   * Rejestracja. Przy `enable_confirmations = true` Supabase nie zwraca sesji —
   * konto czeka na kliknięcie linku z maila i nie wolno udawać zalogowania.
   * Stąd `needsConfirmation` w odpowiedzi.
   */
  async signUp({ name, email, password }) {
    if (Auth.source === 'baza') {
      const data = await Backend.signUp(email, password, name);
      if (!data?.session) return { user: null, needsConfirmation: true };
      Auth.cached = await Backend.currentUser();
      Auth.emit();
      return { user: Auth.cached, needsConfirmation: false };
    }
    return { user: Auth.signInLocal({ name, email }), needsConfirmation: false };
  },

  async signOut() {
    if (Auth.source === 'baza') await Backend.signOut();
    localStorage.removeItem(USER_KEY);
    Auth.cached = null;
    Auth.emit();
  },

  /**
   * O roli decyduje token, nie adres e-mail: hook wystawia `user_role`
   * (owner/manager/staff/customer), backend.js mapuje go na `role` + `rawRole`.
   */
  isAdmin() {
    return Auth.user()?.role === 'admin';
  },

  /** Zmiana wyświetlanego imienia z panelu konta. Zapis do bazy — praca 2. */
  rename(name) {
    if (!Auth.cached || !name || Auth.cached.name === name) return;
    Auth.cached = { ...Auth.cached, name };
    if (Auth.source !== 'baza') localStorage.setItem(USER_KEY, JSON.stringify(Auth.cached));
    Auth.emit();
  },

  /* --- Ścieżka offline: dotychczasowa atrapa na localStorage --- */

  readLocal() {
    try {
      const u = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
      if (!u || !u.email) return null;
      return { ...u, role: u.role === 'admin' ? 'admin' : 'customer', rawRole: u.role ?? 'customer' };
    } catch {
      return null;
    }
  },

  /** Zapamiętuje imię i e-mail, żeby pokazać stan zalogowany. Hasła nie rusza. */
  signInLocal({ name, email }) {
    const stored = Auth.readLocal();
    const same = stored?.email === email;
    const user = {
      name: name || (same ? stored.name : '') || email.split('@')[0],
      email,
      // Bez backendu nikt tu nie jest organizacją — rolę można podmienić
      // wyłącznie ręcznie w localStorage (patrz README, „To nie jest zabezpieczenie").
      role: same ? stored.role : 'customer',
    };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    Auth.cached = { ...user, rawRole: user.role };
    Auth.emit();
    return Auth.cached;
  },

  emit() {
    document.dispatchEvent(new CustomEvent('auth:change', { detail: Auth.cached }));
  },

  initials(user) {
    return (user?.name || user?.email || '?')
      .split(/[\s.@_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  },
};

/** Komunikat z Supabase → jedno zdanie po polsku pod formularzem. */
function authError(err) {
  const msg = String(err?.message ?? err ?? '');
  const short = msg.match(/password should be at least (\d+)/i);
  const wait = msg.match(/only request this after (\d+)/i);

  if (/invalid login credentials/i.test(msg)) return 'Nieprawidłowy e-mail lub hasło.';
  if (/email not confirmed/i.test(msg)) return 'Konto czeka na potwierdzenie — kliknij link z wiadomości e-mail.';
  if (/already registered|already exists/i.test(msg)) return 'Konto z tym adresem już istnieje — zaloguj się.';
  if (short) return `Hasło jest za krótkie — minimum ${short[1]} znaków.`;
  if (/unable to validate email address|invalid email/i.test(msg)) return 'Nieprawidłowy adres e-mail.';
  if (wait) return `Za dużo prób — spróbuj ponownie za ${wait[1]} s.`;
  if (/signups not allowed|signup is disabled/i.test(msg)) return 'Rejestracja jest wyłączona.';
  if (/failed to fetch|networkerror|load failed/i.test(msg)) return 'Brak połączenia z serwerem — spróbuj za chwilę.';
  return `Nie udało się: ${msg}`;
}

/* ---------- Profil klienta ----------
 * Dane kontaktowe z `public.profiles`, adres dostawy z `public.addresses`.
 * Formularz widzi jeden płaski obiekt — sklejanie i rozbijanie na dwie tabele
 * siedzi tutaj. Bez backendu zostaje dotychczasowy wpis w localStorage.
 */
const PROFILE_KEY = 'shop.profile.v1';
const Profile = {
  /** Skąd przyszły dane — 'baza' albo 'localStorage'. */
  source: 'localStorage',
  cached: {},

  async load() {
    if (Auth.source === 'baza' && Auth.user()) {
      const [prof, addr] = await Promise.all([Backend.profile(), Backend.defaultAddress()]);
      if (prof) {
        Profile.source = 'baza';
        Profile.cached = {
          name: prof.full_name ?? '',
          email: prof.email ?? '',
          phone: prof.phone ?? '',
          street: addr?.street ?? '',
          zip: addr?.postal_code ?? '',
          city: addr?.city ?? '',
          newsletter: Boolean(prof.newsletter),
        };
        return Profile.cached;
      }
      console.warn('Backend nie oddał profilu — dane z localStorage.');
    }

    Profile.source = 'localStorage';
    Profile.cached = Profile.readLocal();
    return Profile.cached;
  },

  /** Synchroniczny odczyt dla renderu — stan z ostatniego load()/save(). */
  read() {
    return Profile.cached;
  },

  /**
   * Zapis. W trybie 'baza' idzie w dwa miejsca: dane kontaktowe do `profiles`,
   * adres do `addresses`. E-mail należy do sesji Supabase i tu się nie zmienia.
   */
  async save(data) {
    if (Profile.source === 'baza') {
      await Backend.saveProfile({
        name: data.name,
        phone: data.phone,
        newsletter: data.newsletter,
      });

      if (data.street || data.zip || data.city) {
        await Backend.saveAddress({
          recipient: data.name,
          street: data.street,
          zip: data.zip,
          city: data.city,
          phone: data.phone,
        });
      }

      Profile.cached = { ...Profile.cached, ...data };
      return;
    }

    Profile.writeLocal(data);
    Profile.cached = Profile.readLocal();
  },

  /* --- Ścieżka offline --- */

  readLocal() {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') || {};
    } catch {
      return {};
    }
  },
  writeLocal(data) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...Profile.readLocal(), ...data }));
  },
};

/* ---------- Zamówienia ----------
 * Zakres wycina RLS, nie przeglądarka: klient dostaje z bazy wyłącznie swoje
 * zamówienia, konto zaplecza wszystkie. Bez backendu zostaje atrapa z data.js.
 */
const ORDER_STATUSES = ['nowe', 'w realizacji', 'wysłane', 'dostarczone', 'anulowane'];

const Orders = {
  source: 'localStorage',
  list: [],

  /**
   * Zmiana statusu z panelu zaplecza. Anulowanie idzie przez `cancel_order`,
   * bo poza statusem musi wrócić towar na magazyn; reszta to zwykły UPDATE,
   * który i tak przepuści dopiero polityka „zamówienia: obsługa".
   */
  async setStatus(order, status) {
    if (Orders.source !== 'baza') {
      order.status = status;
      return order;
    }

    const updated = status === 'anulowane'
      ? await Backend.cancelOrder(order.uuid)
      : await Backend.setOrderStatus(order.uuid, status);

    const i = Orders.list.findIndex((o) => o.uuid === order.uuid);
    // cancel_order oddaje samo zamówienie, bez pozycji — zostawiamy stare
    if (i >= 0 && updated) {
      Orders.list[i] = { ...Orders.list[i], ...updated, items: updated.items.length ? updated.items : Orders.list[i].items };
    }
    return Orders.list[i] ?? updated;
  },

  async load() {
    if (Auth.source === 'baza' && Auth.user()) {
      const rows = await Backend.myOrders();
      if (rows) {
        Orders.source = 'baza';
        Orders.list = rows;
        return Orders.list;
      }
      console.warn('Backend nie oddał zamówień — atrapa z data.js.');
    }

    Orders.source = 'localStorage';
    Orders.list = ORDERS;
    return Orders.list;
  },
};

/* ---------- Ustawienia sklepu ----------
 * Koszt dostawy i próg darmowej wysyłki trzyma `store_settings` (odczyt
 * publiczny). Stałe z góry pliku zostają wyłącznie dla trybu bez bazy.
 */
const Store = {
  source: 'localStorage',
  shippingFlat: SHIPPING_FLAT,
  freeFrom: FREE_SHIPPING_FROM,

  async load() {
    if (typeof BACKEND_ENABLED !== 'undefined' && BACKEND_ENABLED) {
      const s = await Backend.storeSettings();
      if (s) {
        Store.source = 'baza';
        Store.shippingFlat = s.shipping_flat_cents / 100;
        Store.freeFrom = s.free_shipping_threshold_cents / 100;
        return Store;
      }
    }
    Store.source = 'localStorage';
    return Store;
  },
};

/* ---------- Wycena koszyka ----------
 * Kwoty liczy baza (`quote_order`) tymi samymi regułami, których użyje
 * `create_order` przy składaniu zamówienia — dzięki temu podsumowanie
 * w koszyku i kwota na zamówieniu nie mają jak się rozjechać.
 * Kody rabatowe sprawdza tabela `coupons`; front żadnej listy kodów nie zna.
 */
const Quote = {
  source: 'localStorage',

  async forCart(coupon) {
    const items = Cart.read();

    if (typeof BACKEND_ENABLED !== 'undefined' && BACKEND_ENABLED && items.length) {
      const q = await Backend.quote({ items, coupon });
      if (q) {
        Quote.source = 'baza';
        return q;
      }
      console.warn('Backend nie wycenił koszyka — liczymy lokalnie.');
    }

    Quote.source = 'localStorage';
    return Quote.local(items, coupon);
  },

  /** Ta sama arytmetyka co w bazie: grosze jako liczby całkowite. */
  local(items, coupon) {
    const code = String(coupon ?? '').trim().toUpperCase();
    const percent = COUPONS[code] ? Math.round(COUPONS[code] * 100) : 0;

    const lines = items
      .map((i) => {
        const p = findProduct(i.id);
        if (!p) return null;
        return {
          id: p.id,
          name: p.name,
          qty: i.qty,
          price: p.price,
          total: p.price * i.qty,
          stock: p.stock,
          inStock: p.stock >= i.qty,
        };
      })
      .filter(Boolean);

    const subtotal = lines.reduce((s, l) => s + Math.round(l.price * 100) * l.qty, 0);
    const discount = Math.floor((subtotal * percent) / 100);
    const freeFrom = Math.round(Store.freeFrom * 100);
    const shipping = subtotal === 0 || subtotal - discount >= freeFrom
      ? 0
      : Math.round(Store.shippingFlat * 100);

    return {
      subtotal: subtotal / 100,
      discount: discount / 100,
      shipping: shipping / 100,
      total: (subtotal - discount + shipping) / 100,
      coupon: code || null,
      couponValid: percent > 0,
      percentOff: percent,
      freeShippingFrom: Store.freeFrom,
      freeShippingMissing: shipping === 0 ? 0 : Math.max(freeFrom - (subtotal - discount), 0) / 100,
      lines,
    };
  },
};

/* ---------- Lista życzeń ----------
 * W bazie tabela `wishlists` (RLS: wyłącznie własne wpisy, zaplecze też
 * nie zagląda). Bez backendu — lista identyfikatorów w localStorage.
 */
const WISHLIST_KEY = 'shop.wishlist.v1';
const Wish = {
  source: 'localStorage',
  ids: [],

  async load() {
    if (Auth.source === 'baza' && Auth.user()) {
      const items = await Backend.wishlist();
      if (items) {
        Wish.source = 'baza';
        Wish.ids = items.map((p) => p.id);
        return Wish.ids;
      }
      console.warn('Backend nie oddał listy życzeń — dane z localStorage.');
    }

    Wish.source = 'localStorage';
    Wish.ids = Wish.readLocal();
    return Wish.ids;
  },

  has(id) {
    return Wish.ids.includes(id);
  },

  /** Zwraca stan po przełączeniu albo null, gdy operacja wymaga logowania. */
  async toggle(id) {
    if (Auth.source === 'baza' && !Auth.user()) return null;

    const on = !Wish.has(id);

    if (Auth.source === 'baza') {
      if (on) await Backend.addToWishlist(id);
      else await Backend.removeFromWishlist(id);
      Wish.source = 'baza';
    }

    Wish.ids = on ? [...Wish.ids, id] : Wish.ids.filter((x) => x !== id);
    if (Wish.source !== 'baza') localStorage.setItem(WISHLIST_KEY, JSON.stringify(Wish.ids));

    document.dispatchEvent(new CustomEvent('wishlist:change', { detail: Wish.ids }));
    return on;
  },

  readLocal() {
    try {
      const list = JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  },
};

/* ---------- Katalog ----------
 * PRODUCTS z data.js to ziarno. Po pierwszym uruchomieniu katalog żyje
 * w localStorage, żeby panel admina miał co edytować bez backendu.
 * Zawartość tablicy PRODUCTS jest podmieniana w miejscu — reszta kodu
 * czyta ją tak samo jak wcześniej.
 */
const Catalog = {
  /** Skąd ostatecznie przyszedł katalog — 'baza' albo 'localStorage'. */
  source: 'localStorage',

  async load() {
    // Ścieżka docelowa: katalog z bazy. Gdy backend nie jest skonfigurowany
    // albo nie odpowiada, spadamy na dane lokalne i strona działa dalej.
    if (typeof BACKEND_ENABLED !== 'undefined' && BACKEND_ENABLED) {
      const remote = await Backend.fetchCatalog();
      if (remote) {
        PRODUCTS.length = 0;
        PRODUCTS.push(...remote.products);
        if (remote.categories.length) {
          CATEGORIES.length = 0;
          CATEGORIES.push(...remote.categories);
        }
        Catalog.source = 'baza';
        return;
      }
      console.warn('Backend nie odpowiedział — katalog z danych lokalnych.');
    }

    try {
      const stored = JSON.parse(localStorage.getItem(CATALOG_KEY) || 'null');
      if (Array.isArray(stored) && stored.length) {
        PRODUCTS.length = 0;
        PRODUCTS.push(...stored);
        return;
      }
    } catch {
      /* uszkodzony wpis — wracamy do ziarna */
    }
    Catalog.save();
  },
  save() {
    if (Catalog.source === 'baza') return;
    localStorage.setItem(CATALOG_KEY, JSON.stringify(PRODUCTS));
    document.dispatchEvent(new CustomEvent('catalog:change'));
  },
  nextId() {
    const nums = PRODUCTS.map((p) => parseInt(String(p.id).replace(/\D/g, ''), 10) || 0);
    return `p-${String(Math.max(0, ...nums) + 1).padStart(3, '0')}`;
  },
  async upsert(product) {
    if (Catalog.source === 'baza') {
      // Uprawnień pilnuje RLS: konto bez products.write dostanie tu odmowę
      const saved = await Backend.saveProduct(product);
      const i = PRODUCTS.findIndex((p) => p.id === saved.id);
      if (i >= 0) PRODUCTS[i] = saved;
      else PRODUCTS.push(saved);
      document.dispatchEvent(new CustomEvent('catalog:change'));
      return saved;
    }

    const i = PRODUCTS.findIndex((p) => p.id === product.id);
    if (i >= 0) PRODUCTS[i] = product;
    else PRODUCTS.push(product);
    Catalog.save();
    return product;
  },
  async remove(id) {
    if (Catalog.source === 'baza') {
      await Backend.deleteProduct(id);
    }
    const i = PRODUCTS.findIndex((p) => p.id === id);
    if (i >= 0) PRODUCTS.splice(i, 1);
    if (Catalog.source === 'baza') {
      document.dispatchEvent(new CustomEvent('catalog:change'));
    } else {
      Catalog.save();
    }
  },
  reset() {
    localStorage.removeItem(CATALOG_KEY);
    location.reload();
  },
};

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

/* ---------- Licznik w nagłówku ---------- */
function refreshCartBadge() {
  const badge = document.querySelector('[data-cart-count]');
  if (!badge) return;
  const n = Cart.count();
  const changed = badge.textContent !== String(n);
  badge.textContent = n;
  badge.hidden = n === 0;

  // Skok licznika przy każdej zmianie — jedyny sygnał, że coś doszło,
  // gdy szuflada jest zamknięta
  if (changed && n > 0) {
    badge.classList.remove('is-bump');
    void badge.offsetWidth; // restart animacji
    badge.classList.add('is-bump');
  }
}

/* ---------- Menu konta w nagłówku ---------- */
function renderAccountMenu() {
  const root = document.querySelector('[data-account]');
  if (!root) return;
  const user = Auth.user();

  root.innerHTML = user
    ? `
      <button class="icon-btn" type="button" data-account-toggle aria-expanded="false" aria-haspopup="true">
        <span class="avatar">${escapeHtml(Auth.initials(user))}</span>
        <span class="account-name">${escapeHtml(user.name)}</span>
      </button>
      <div class="menu" data-account-menu data-open="false">
        <div class="menu-head">
          <strong>${escapeHtml(user.name)}</strong>
          <span>${escapeHtml(user.email)}</span>
        </div>
        <a href="account.html">${icon('user')} Moje konto</a>
        <a href="account.html#wishlist">${icon('heart')} Lista życzeń</a>
        <a href="account.html#settings">${icon('pin')} Dane i adres</a>
        ${
          user.role === 'admin'
            ? `<div class="menu-sep"></div>
               <a href="account.html#orders">${icon('box')} Zamówienia</a>
               <a href="admin.html">${icon('shield')} Panel produktów</a>`
            : ''
        }
        <div class="menu-sep"></div>
        <button type="button" data-signout>${icon('logout')} Wyloguj</button>
      </div>`
    : `
      <button class="icon-btn" type="button" data-account-toggle aria-expanded="false" aria-haspopup="true">
        ${icon('user')} Konto
      </button>
      <div class="menu" data-account-menu data-open="false">
        <a href="login.html">${icon('logout')} Zaloguj się</a>
        <a href="login.html#register">${icon('user')} Załóż konto</a>
      </div>`;
}

function initAccountMenu() {
  renderAccountMenu();
  document.addEventListener('auth:change', renderAccountMenu);

  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-account-toggle]');
    const menu = document.querySelector('[data-account-menu]');
    if (!menu) return;

    if (toggle) {
      const open = menu.dataset.open !== 'true';
      menu.dataset.open = String(open);
      toggle.setAttribute('aria-expanded', String(open));
      return;
    }
    if (e.target.closest('[data-signout]')) {
      // Wylogowanie ze strony za logowaniem odsyła na stronę główną, nie na
      // formularz: klient kończy zakupy, a nie zaczyna kolejne logowanie.
      const guarded = document.querySelector('[data-account-root], [data-admin-root]');
      Auth.signOut().then(() => {
        toast('Wylogowano');
        if (guarded) location.href = 'index.html';
      });
      return;
    }
    if (!e.target.closest('[data-account-menu]')) {
      menu.dataset.open = 'false';
      document.querySelector('[data-account-toggle]')?.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const menu = document.querySelector('[data-account-menu]');
    if (!menu) return;
    menu.dataset.open = 'false';
    document.querySelector('[data-account-toggle]')?.setAttribute('aria-expanded', 'false');
  });
}

/* ---------- Logowanie / rejestracja ---------- */
function initLogin() {
  const root = document.querySelector('[data-auth-root]');
  if (!root) return;

  const tabs = root.querySelectorAll('button[data-tab]');
  const forms = root.querySelectorAll('[data-auth-form]');

  function show(mode) {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === mode)));
    forms.forEach((f) => (f.hidden = f.dataset.authForm !== mode));
  }

  root.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-tab]');
    if (trigger) show(trigger.dataset.tab);
  });
  show(location.hash === '#register' ? 'register' : 'login');

  // Odesłani z panelu produktów wracają tam po zalogowaniu, o ile mają rolę
  const wantsAdmin = location.hash === '#admin';

  /* Komunikat przy formularzu zamiast toasta: błąd logowania musi zostać
     na ekranie, a nie zniknąć po dwóch sekundach. */
  function message(form, text, kind = 'error') {
    let box = form.querySelector('[data-auth-msg]');
    if (!box) {
      box = document.createElement('p');
      box.className = 'notice';
      box.setAttribute('role', 'alert');
      box.dataset.authMsg = '';
      form.prepend(box);
    }
    box.classList.toggle('notice-error', Boolean(text) && kind === 'error');
    box.classList.toggle('notice-ok', Boolean(text) && kind === 'ok');
    box.textContent = text;
    box.hidden = !text;
  }

  forms.forEach((form) =>
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const register = form.dataset.authForm === 'register';
      const submitBtn = form.querySelector('button[type="submit"]');
      const label = submitBtn.textContent;
      let leaving = false;

      message(form, '');
      submitBtn.disabled = true;
      submitBtn.textContent = register ? 'Zakładam konto…' : 'Loguję…';

      try {
        const email = String(data.get('email') ?? '').trim();
        const password = String(data.get('password') ?? '');

        if (register) {
          const { needsConfirmation } = await Auth.signUp({
            name: String(data.get('name') ?? '').trim(),
            email,
            password,
          });
          if (needsConfirmation) {
            message(form, 'Konto założone. Sprawdź skrzynkę i kliknij link potwierdzający, potem zaloguj się.', 'ok');
            form.reset();
            return;
          }
        } else {
          await Auth.signIn(email, password);
        }

        leaving = true;
        message(form, 'Zalogowano — przenosimy Cię do konta.', 'ok');
        const target = wantsAdmin && Auth.isAdmin() ? 'admin.html' : 'account.html';
        setTimeout(() => (location.href = target), 500);
      } catch (err) {
        message(form, authError(err));
      } finally {
        if (!leaving) {
          submitBtn.disabled = false;
          submitBtn.textContent = label;
        }
      }
    })
  );
}

/** Stos statusów przy zamówieniu — ten sam komponent co sortowanie w sklepie. */
function statusStack(o) {
  return `
    <div class="sortbox sortbox-sm" data-status-stack data-order="${escapeHtml(o.id)}">
      <span class="sr-only" id="status-label-${escapeHtml(o.id)}">Status zamówienia ${escapeHtml(o.id)}</span>
      <button class="sortbox-btn" type="button" data-stack-toggle aria-haspopup="listbox"
        aria-expanded="false" aria-labelledby="status-label-${escapeHtml(o.id)}">
        <span data-stack-value>${escapeHtml(o.status)}</span>
        <span class="sortbox-chevron" aria-hidden="true"></span>
      </button>
      <ul class="sortbox-menu" role="listbox" data-stack-menu tabindex="-1" hidden
        aria-labelledby="status-label-${escapeHtml(o.id)}">
        ${ORDER_STATUSES.map(
          (s) => `<li role="option" data-value="${s}" tabindex="-1"
            aria-selected="${String(s === o.status)}">${s}</li>`
        ).join('')}
      </ul>
    </div>`;
}

/** Kafelek zamówienia. `withCustomer` dokłada dane kontaktowe — tylko zaplecze. */
function orderRow(o, withCustomer) {
  const names = o.items
    .map((i) => `${i.name ?? findProduct(i.id)?.name ?? i.id} × ${i.qty}`)
    .join(', ');
  const done = o.status === 'dostarczone';
  const dead = o.status === 'anulowane';
  const pill = dead ? 'pill' : done ? 'pill pill-done' : 'pill pill-way';
  const date = new Date(o.date).toLocaleDateString('pl-PL', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return `
    <div class="order">
      <div>
        <div class="order-id">${escapeHtml(o.id)}</div>
        <div class="order-meta">${date} · <span class="${pill}">${escapeHtml(o.status)}</span></div>
      </div>
      <div class="order-total">${money(o.total)}</div>
      <div class="order-items">${escapeHtml(names)}</div>
      ${withCustomer ? `
      <div class="order-items">
        ${escapeHtml(o.customer)}${o.phone ? ` · ${escapeHtml(o.phone)}` : ''}${o.address ? ` · ${escapeHtml(o.address)}` : ''}
        <span class="muted">— dostawa ${o.shipping === 0 ? 'gratis' : money(o.shipping)}</span>
      </div>` : `
      <div class="order-items muted">
        Dostawa ${o.shipping === 0 ? 'gratis' : money(o.shipping)}${o.discount ? ` · rabat −${money(o.discount)}` : ''}
      </div>`}
      ${orderActions(o, withCustomer)}
    </div>`;
}

/**
 * Akcje przy zamówieniu. Zaplecze przestawia status stosem, klient może
 * wycofać zamówienie, którego jeszcze nikt nie ruszył. Jedno i drugie
 * dopuszcza baza — front tylko nie proponuje tego, co i tak dostanie odmowę.
 */
function orderActions(o, isStaff) {
  if (isStaff) {
    return `
      <div class="order-actions">
        <span class="label">Status</span>
        ${statusStack(o)}
      </div>`;
  }

  if (o.status !== 'nowe') return '';
  return `
    <div class="order-actions">
      <button class="btn-link" type="button" data-cancel-order="${escapeHtml(o.id)}">
        Anuluj zamówienie
      </button>
    </div>`;
}

/* ---------- Panel konta ----------
 * Widok zależy od roli:
 *  - admin      — przegląd sklepu, wszystkie zamówienia z kosztami, klienci i adresy
 *  - klient     — własne zamówienia, lista życzeń, dane kontaktowe i adres
 *
 * Ukrywanie sekcji w przeglądarce to wyłącznie UX. O zakresie danych decyduje
 * RLS: `orders` oddaje klientowi wyłącznie wiersze z jego `user_id`, a dane
 * kontaktowe innych kont wymagają uprawnienia `customers.read`.
 */
async function initAccountPage() {
  const root = document.querySelector('[data-account-root]');
  if (!root) return;

  const user = Auth.user();
  if (!user) {
    location.replace('login.html');
    return;
  }
  const isAdmin = user.role === 'admin';

  await Promise.all([Orders.load(), Profile.load()]);

  // Nagłówek
  root.querySelector('[data-user-initials]').textContent = Auth.initials(user);
  root.querySelector('[data-user-name]').textContent = user.name;
  root.querySelector('[data-user-email]').textContent = user.email;
  const roleBadge = root.querySelector('[data-role-badge]');
  roleBadge.textContent = isAdmin ? 'organizacja' : 'klient';
  roleBadge.className = `pill ${isAdmin ? 'pill-admin' : ''}`;

  // Sekcje dostępne tylko dla organizacji
  if (!isAdmin) {
    root.querySelectorAll('[data-role="admin"]').forEach((el) => el.remove());
  }

  // Przegląd przeliczamy też po każdej zmianie statusu — obrót i lista
  // „do obsłużenia" muszą nadążać za tym, co robi zaplecze w zakładce obok.
  function renderOverview() {
    if (!isAdmin) return;

    const list = Orders.list;
    // Anulowane zamówienia nie liczą się do obrotu — towar wrócił na magazyn
    const billable = list.filter((o) => o.status !== 'anulowane');
    const spent = billable.reduce((s, o) => s + o.total, 0);
    const shippingCost = billable.reduce((s, o) => s + o.shipping, 0);
    const pending = list.filter((o) => o.status !== 'dostarczone' && o.status !== 'anulowane');

    root.querySelector('[data-stat-orders]').textContent = billable.length;
    root.querySelector('[data-stat-spent]').textContent = money(spent);
    root.querySelector('[data-stat-shipping]').textContent = money(shippingCost);
    root.querySelector('[data-catalog-count]').textContent = PRODUCTS.length;
    root.querySelector('[data-pending]').textContent = pending.length
      ? `${pending.length} w realizacji — ${pending.map((o) => o.id).join(', ')}.`
      : 'Wszystkie zamówienia zamknięte.';

    // Klienci: jeden wiersz na adres e-mail, sumowany po jego zamówieniach
    const seen = new Map();
    list.forEach((o) => seen.set(o.email, o));
    root.querySelector('[data-customers]').innerHTML = seen.size
      ? [...seen.values()]
          .map((o) => {
            const own = list.filter((x) => x.email === o.email);
            const sum = own.reduce((s, x) => s + x.total, 0);
            return `
        <div class="order">
          <div>
            <div class="order-id">${escapeHtml(o.customer)}</div>
            <div class="order-meta">${escapeHtml(o.email)}${o.phone ? ` · ${escapeHtml(o.phone)}` : ''}</div>
          </div>
          <div class="order-total">${money(sum)}</div>
          <div class="order-items">${escapeHtml(o.address)} · ${own.length} zamówień</div>
        </div>`;
          })
          .join('')
      : '<p class="muted">Brak klientów — nikt jeszcze nie złożył zamówienia.</p>';
  }

  renderOverview();

  // Zamówienia: zaplecze widzi wszystkie z danymi klienta, klient wyłącznie swoje
  const ordersBox = root.querySelector('[data-orders]');
  const ordersLede = root.querySelector('[data-orders-lede]');
  if (ordersLede) {
    ordersLede.textContent = isAdmin
      ? 'Wszystkie zamówienia z danymi klienta, adresem i kosztami. Status przestawiasz stosem przy zamówieniu.'
      : 'Twoje zamówienia — status, pozycje i koszt dostawy.';
  }

  let statusFilter = 'all';

  function renderOrders() {
    if (!ordersBox) return;

    const list = statusFilter === 'all'
      ? Orders.list
      : Orders.list.filter((o) => o.status === statusFilter);

    const chips = isAdmin
      ? `<div class="chips chips-tight">
          ${['all', ...ORDER_STATUSES]
            .map((s) => {
              const n = s === 'all' ? Orders.list.length : Orders.list.filter((o) => o.status === s).length;
              return `<button class="chip" type="button" data-status-filter="${s}"
                aria-pressed="${String(s === statusFilter)}">${s === 'all' ? 'Wszystkie' : s} <span class="num">${n}</span></button>`;
            })
            .join('')}
        </div>`
      : '';

    ordersBox.innerHTML =
      chips +
      (list.length
        ? list.map((o) => orderRow(o, isAdmin)).join('')
        : `<p class="muted">${
            Orders.list.length
              ? 'Brak zamówień w tym statusie.'
              : isAdmin ? 'Brak zamówień w sklepie.' : 'Nie masz jeszcze żadnych zamówień.'
          }</p>`);

    // Każdy stos statusu dostaje obsługę po przerysowaniu listy
    ordersBox.querySelectorAll('[data-status-stack]').forEach((box) => {
      const order = Orders.list.find((o) => o.id === box.dataset.order);
      stackSelect(box, (status) => changeStatus(order, status));
    });
  }

  async function changeStatus(order, status) {
    if (!order || order.status === status) return;
    const previous = order.status;

    try {
      await Orders.setStatus(order, status);
      toast(status === 'anulowane'
        ? `Zamówienie ${order.id} anulowane — towar wrócił na magazyn`
        : `Status ${order.id}: ${status}`);
    } catch (err) {
      order.status = previous;
      toast(`Nie udało się zmienić statusu: ${err.message}`);
    }
    renderOrders();
    renderOverview();
  }

  ordersBox?.addEventListener('click', async (e) => {
    const chip = e.target.closest('[data-status-filter]');
    if (chip) {
      statusFilter = chip.dataset.statusFilter;
      renderOrders();
      return;
    }

    const cancelBtn = e.target.closest('[data-cancel-order]');
    if (cancelBtn) {
      const order = Orders.list.find((o) => o.id === cancelBtn.dataset.cancelOrder);
      if (order && confirm(`Anulować zamówienie ${order.id}? Towar wróci na magazyn.`)) {
        await changeStatus(order, 'anulowane');
      }
    }
  });

  renderOrders();

  // Lista życzeń — produkty z tabeli wishlists (albo z localStorage bez bazy)
  const wish = root.querySelector('[data-grid="wishlist"]');
  if (wish) {
    const renderWish = () => {
      const items = Wish.ids.map((id) => findProduct(id)).filter(Boolean);
      if (!items.length) {
        wish.innerHTML = '<p class="muted">Lista życzeń jest pusta — dodaj produkty sercem na kafelku.</p>';
        return;
      }
      renderGrid(wish, items);
    };
    renderWish();
    document.addEventListener('wishlist:change', renderWish);
  }

  // Dane i adres klienta
  const profileForm = root.querySelector('[data-profile-form]');
  if (profileForm) {
    const profile = Profile.read();
    const f = profileForm.elements;
    f.name.value = profile.name || user.name;
    f.email.value = profile.email || user.email;
    f.phone.value = profile.phone || '';
    f.street.value = profile.street || '';
    f.zip.value = profile.zip || '';
    f.city.value = profile.city || '';
    f.newsletter.checked = Boolean(profile.newsletter);

    // E-mail należy do sesji Supabase — zmiana adresu to osobna operacja
    // w Auth (z potwierdzeniem mailem), nie edycja profilu.
    if (Profile.source === 'baza') {
      f.email.readOnly = true;
      f.email.title = 'Adres logowania zmienia się w ustawieniach konta Supabase.';
    }

    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = profileForm.querySelector('button[type="submit"]');
      btn.disabled = true;

      try {
        await Profile.save({
          name: f.name.value.trim(),
          email: f.email.value.trim(),
          phone: f.phone.value.trim(),
          street: f.street.value.trim(),
          zip: f.zip.value.trim(),
          city: f.city.value.trim(),
          newsletter: f.newsletter.checked,
        });
        // Imię w nagłówku i menu ma nadążyć za formularzem.
        Auth.rename(f.name.value.trim());
        root.querySelector('[data-user-name]').textContent = f.name.value.trim() || user.name;
        toast(Profile.source === 'baza' ? 'Dane zapisane' : 'Dane zapisane lokalnie — podłącz bazę');
      } catch (err) {
        toast(`Nie udało się zapisać: ${err.message}`);
      } finally {
        btn.disabled = false;
      }
    });
  }

  // Zakładki panelu
  const navBtns = root.querySelectorAll('.side-nav button[data-panel-tab]');
  const panels = root.querySelectorAll('[data-panel]');

  function openPanel(name) {
    navBtns.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.panelTab === name)));
    panels.forEach((p) => (p.hidden = p.dataset.panel !== name));
  }

  root.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-panel-tab]');
    if (!trigger) return;
    e.preventDefault();
    openPanel(trigger.dataset.panelTab);
    history.replaceState(null, '', `#${trigger.dataset.panelTab}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  const wanted = location.hash.slice(1);
  const available = [...panels].map((p) => p.dataset.panel);
  openPanel(available.includes(wanted) ? wanted : available[0]);
}

/* ---------- Panel admina ---------- */
function initAdmin() {
  const root = document.querySelector('[data-admin-root]');
  if (!root) return;

  // Przekierowanie to wyłącznie UX — kto zna adres, i tak otworzy ten plik.
  // O zapisie decyduje RLS w bazie: konto bez products.write dostanie odmowę
  // przy każdym żądaniu, niezależnie od tego, co pokazuje przeglądarka.
  if (!Auth.isAdmin()) {
    location.replace('login.html#admin');
    return;
  }

  const form = root.querySelector('[data-admin-form]');
  const list = root.querySelector('[data-admin-list]');
  const formTitle = root.querySelector('[data-form-title]');
  const cancelBtn = root.querySelector('[data-cancel-edit]');
  const idField = form.elements.id;

  // Wypełnienie list wyboru
  form.elements.category.innerHTML = CATEGORIES.map(
    (c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`
  ).join('');
  form.elements.icon.innerHTML = Object.keys(ICON_PATHS)
    .map((k) => `<option value="${k}">${k}</option>`)
    .join('');

  const specsToText = (specs) =>
    Object.entries(specs || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

  const textToSpecs = (text) =>
    Object.fromEntries(
      text
        .split('\n')
        .map((line) => line.split(/:(.+)/))
        .filter((parts) => parts[0]?.trim() && parts[1]?.trim())
        .map((parts) => [parts[0].trim(), parts[1].trim()])
    );

  function renderList() {
    root.querySelector('[data-admin-count]').textContent = PRODUCTS.length;
    list.innerHTML = PRODUCTS.map(
      (p) => `
      <div class="admin-row">
        <div class="admin-thumb">${productMedia(p, { sizes: '52px' })}</div>
        <div>
          <div class="admin-name">${escapeHtml(p.name)}</div>
          <div class="order-meta">${escapeHtml(p.slug ?? p.id)} · ${escapeHtml(categoryName(p.category))} ·
            ${p.stock > 0 ? `${p.stock} szt.` : 'brak w magazynie'}</div>
        </div>
        <div class="order-total">${money(p.price)}</div>
        <div class="admin-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-edit="${p.id}">Edytuj</button>
          <button class="btn-link" type="button" data-delete="${p.id}">Usuń</button>
        </div>
      </div>`
    ).join('');
  }

  function startEdit(p) {
    formTitle.textContent = `Edycja: ${p.name}`;
    cancelBtn.hidden = false;
    idField.value = p.id;
    form.elements.name.value = p.name;
    form.elements.category.value = p.category;
    form.elements.price.value = p.price;
    form.elements.oldPrice.value = p.oldPrice ?? '';
    form.elements.stock.value = p.stock;
    form.elements.rating.value = p.rating;
    form.elements.reviews.value = p.reviews;
    form.elements.icon.value = p.icon;
    form.elements.badge.value = p.badge ?? '';
    form.elements.short.value = p.short;
    form.elements.specs.value = specsToText(p.specs);
    currentImagePath = p.imagePath ?? null;
    dropImage = false;
    if (imageInput) imageInput.value = '';
    showPreview(p.image ?? null);
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* --- Zdjęcie produktu --- */
  const imageInput = form.elements.image;
  const preview = root.querySelector('[data-image-preview]');
  const clearImageBtn = root.querySelector('[data-image-clear]');
  const imageHint = root.querySelector('[data-image-hint]');
  // Stan formularza: ścieżka zdjęcia edytowanego produktu i decyzja o jej skasowaniu
  let currentImagePath = null;
  let dropImage = false;

  function showPreview(src) {
    if (!preview) return;
    preview.innerHTML = src
      ? `<img class="media-img" src="${escapeHtml(src)}" alt="">`
      : `<span class="uploader-empty">${icon('camera')}</span>`;
    if (clearImageBtn) clearImageBtn.hidden = !src;
  }

  imageInput?.addEventListener('change', () => {
    const file = imageInput.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast('Zdjęcie waży ponad 5 MB — kubełek go nie przyjmie');
      imageInput.value = '';
      return;
    }

    dropImage = false;
    // Podgląd z pliku, zanim cokolwiek poleci na serwer
    showPreview(URL.createObjectURL(file));
    if (imageHint) imageHint.textContent = `Do wgrania: ${file.name}`;
  });

  clearImageBtn?.addEventListener('click', () => {
    imageInput.value = '';
    dropImage = Boolean(currentImagePath);
    showPreview(null);
    if (imageHint) imageHint.textContent = 'Zdjęcie zniknie po zapisaniu produktu.';
  });

  function resetForm() {
    form.reset();
    idField.value = '';
    formTitle.textContent = 'Nowy produkt';
    cancelBtn.hidden = true;
    currentImagePath = null;
    dropImage = false;
    showPreview(null);
    if (imageHint) {
      imageHint.textContent = 'JPG, PNG, WebP lub AVIF, do 5 MB. Bez zdjęcia kafelek pokazuje ikonę.';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements;
    const editing = Boolean(idField.value);
    const submitBtn = form.querySelector('button[type="submit"]');
    const edited = editing ? findProduct(idField.value) : null;
    const product = {
      id: idField.value || Catalog.nextId(),
      // Slug jest w bazie NOT NULL i nie ma go w formularzu — przy edycji
      // niesie go edytowany produkt, przy nowym składa go warstwa Backend
      slug: edited?.slug,
      name: f.name.value.trim(),
      category: f.category.value,
      price: Number(f.price.value),
      oldPrice: f.oldPrice.value ? Number(f.oldPrice.value) : null,
      rating: Number(f.rating.value) || 0,
      reviews: Number(f.reviews.value) || 0,
      stock: Number(f.stock.value) || 0,
      icon: f.icon.value,
      badge: f.badge.value.trim() || null,
      short: f.short.value.trim(),
      specs: textToSpecs(f.specs.value),
      imagePath: dropImage ? null : currentImagePath,
    };

    const file = imageInput?.files?.[0];
    submitBtn.disabled = true;
    const label = submitBtn.textContent;

    try {
      // Najpierw plik: gdyby wgranie padło, produkt nie zapisze się z martwą ścieżką
      if (file) {
        if (Catalog.source !== 'baza') {
          throw new Error('Zdjęcia wymagają bazy — ustaw dane Supabase w js/config.js');
        }
        submitBtn.textContent = 'Wgrywam zdjęcie…';
        product.imagePath = await Backend.uploadProductImage(file);
      }

      submitBtn.textContent = 'Zapisuję…';
      await Catalog.upsert(product);

      // Stary plik kasujemy dopiero po udanym zapisie; osierocony plik
      // w kubełku jest mniej szkodliwy niż produkt bez zdjęcia
      const replaced = currentImagePath && currentImagePath !== product.imagePath;
      if (replaced && Catalog.source === 'baza') await Backend.removeProductImage(currentImagePath);

      toast(editing ? 'Produkt zaktualizowany' : 'Produkt dodany');
      resetForm();
    } catch (err) {
      toast(`Nie zapisano: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = label;
    }
  });

  cancelBtn.addEventListener('click', resetForm);

  // Notka i przycisk resetu zależą od źródła katalogu. Z bazą „przywrócenie
  // katalogu startowego" nie miałoby czego kasować — ziarno siedzi w seedzie.
  const note = root.querySelector('[data-catalog-note]');
  const resetBtn = root.querySelector('[data-reset-catalog]');

  if (Catalog.source === 'baza') {
    if (note) {
      note.innerHTML =
        'Katalog jedzie z bazy — zmiany widzą wszyscy od razu. Zapis przepuszcza dopiero ' +
        'polityka RLS <code>produkty: edycja</code>, więc konto bez uprawnienia ' +
        '<code>products.write</code> dostanie odmowę niezależnie od tego, co pokazuje ten formularz.';
    }
    resetBtn?.remove();
  } else {
    if (note) {
      note.innerHTML =
        'Tryb bez bazy: katalog trzyma <code>localStorage</code> tej przeglądarki, więc zmiany ' +
        'widzi tylko to urządzenie. Ustaw dane Supabase w <code>js/config.js</code>, żeby ' +
        'katalog był wspólny dla wszystkich.';
    }
    resetBtn?.addEventListener('click', () => {
      if (confirm('Przywrócić katalog startowy? Wszystkie dodane produkty znikną.')) Catalog.reset();
    });
  }

  list.addEventListener('click', (e) => {
    const edit = e.target.closest('[data-edit]');
    if (edit) {
      const p = findProduct(edit.dataset.edit);
      if (p) startEdit(p);
      return;
    }
    const del = e.target.closest('[data-delete]');
    if (del) {
      const p = findProduct(del.dataset.delete);
      if (p && confirm(`Usunąć „${p.name}"?`)) {
        Catalog.remove(p.id)
          .then(async () => {
            // Wiersz zniknął, więc plik nie ma już do czego należeć
            if (p.imagePath && Catalog.source === 'baza') await Backend.removeProductImage(p.imagePath);
            toast('Produkt usunięty');
            if (idField.value === p.id) resetForm();
          })
          .catch((err) => toast(`Nie usunięto: ${err.message}`));
      }
    }
  });

  document.addEventListener('catalog:change', renderList);
  resetForm();
  renderList();
}

/* ---------- Zdjęcie produktu ----------
 * Jedno miejsce decyduje, czy leci prawdziwe zdjęcie z kubełka, czy ikona
 * zastępcza. Produkt bez `image` wygląda jak dotąd — katalog może mieć
 * zdjęcia tylko przy części pozycji.
 */
function productMedia(p, { sizes = '(max-width: 700px) 92vw, 300px', eager = false } = {}) {
  if (!p?.image) return icon(p?.icon);

  return `<img class="media-img" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}"
    loading="${eager ? 'eager' : 'lazy'}" decoding="async" sizes="${sizes}">`;
}

/* ---------- Kafelek produktu ---------- */
function productCard(p) {
  const out = p.stock === 0;
  return `
    <article class="card" data-reveal>
      <div class="card-media">
        <a class="card-media-link" href="product.html?id=${encodeURIComponent(p.id)}" aria-label="${escapeHtml(p.name)}">
          ${productMedia(p, { sizes: '(max-width: 700px) 46vw, 270px' })}
        </a>
        ${p.badge ? `<span class="badge ${/^-/.test(p.badge) ? '' : 'badge-neutral'}">${escapeHtml(p.badge)}</span>` : ''}
        <button class="wish-btn" type="button" data-wish="${p.id}"
          aria-pressed="${Wish.has(p.id)}" title="Lista życzeń" aria-label="Dodaj do listy życzeń">
          ${icon('heart')}
        </button>
        <button class="card-quick" type="button" data-quick="${p.id}">
          ${icon('eye')} Szybki podgląd
        </button>
      </div>
      <div class="card-body">
        <span class="card-cat">${escapeHtml(categoryName(p.category))}</span>
        <h3 class="card-title"><a href="product.html?id=${encodeURIComponent(p.id)}">${escapeHtml(p.name)}</a></h3>
        <span class="rating"><span class="stars" aria-hidden="true">${stars(p.rating)}</span>
          <span class="sr-only">Ocena ${p.rating} na 5.</span> ${p.reviews} opinii</span>
        <div class="price-row">
          <span class="price">${money(p.price)}</span>
          ${p.oldPrice ? `<span class="price-old">${money(p.oldPrice)}</span>` : ''}
        </div>
        <div class="card-cta">
          <button class="btn btn-ghost btn-block" data-add="${p.id}" ${out ? 'disabled' : ''}>
            ${out ? 'Niedostępny' : 'Do koszyka'}
          </button>
        </div>
      </div>
    </article>`;
}

function renderGrid(target, list) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  el.innerHTML = list.length
    ? list.map(productCard).join('')
    : `<p class="muted">Brak produktów spełniających kryteria.</p>`;

  // Kafelki wchodzą kaskadą, gdy siatka pojawi się w oknie
  Reveal.stagger(el);
  Reveal.scan(el);
}

/* ---------- Strona główna ---------- */
function initHome() {
  const featured = document.querySelector('[data-grid="featured"]');
  if (featured) {
    renderGrid(featured, [...PRODUCTS].sort((a, b) => b.rating - a.rating).slice(0, 4));
  }

  const cats = document.querySelector('[data-categories]');
  if (cats) {
    cats.innerHTML = CATEGORIES.map(
      (c) => `
      <a class="category" href="shop.html#${c.id}" data-reveal>
        ${icon(c.icon)}
        <strong>${escapeHtml(c.name)}</strong>
        <span>${escapeHtml(c.desc)}</span>
        <span class="muted">${PRODUCTS.filter((p) => p.category === c.id).length} produktów</span>
      </a>`
    ).join('');
    Reveal.stagger(cats);
    Reveal.scan(cats);
  }

  // Wracającemu klientowi pokazujemy, co oglądał ostatnio
  Recent.render();
}

/* ---------- Wysuwany stos wyboru ----------
 * Zachowuje się jak natywny listbox: strzałki chodzą po opcjach, Home/End
 * skacze na krańce, Enter wybiera, Escape zamyka i oddaje ostrość przyciskowi.
 * Natywnego <select> nie da się animować, stąd własny — używa go sortowanie
 * w sklepie i zmiana statusu zamówienia w panelu.
 */
function stackSelect(box, onPick) {
  if (!box || box.dataset.stackReady) return;
  box.dataset.stackReady = '1';

  const btn = box.querySelector('[data-stack-toggle]');
  const menu = box.querySelector('[data-stack-menu]');
  const value = box.querySelector('[data-stack-value]');
  const options = [...menu.querySelectorAll('[role="option"]')];
  let cursor = options.findIndex((o) => o.getAttribute('aria-selected') === 'true');

  const highlight = (i) => {
    cursor = (i + options.length) % options.length;
    options.forEach((o, idx) => o.classList.toggle('is-active', idx === cursor));
    options[cursor].scrollIntoView({ block: 'nearest' });
  };

  function open() {
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => menu.classList.add('is-open'));
    highlight(Math.max(cursor, 0));
    menu.focus();
  }

  function close({ focusBtn = true } = {}) {
    if (menu.hidden) return;
    menu.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    const done = () => (menu.hidden = true);
    if (stillMode()) done();
    else setTimeout(done, 220);
    if (focusBtn) btn.focus();
  }

  function pick(option) {
    options.forEach((o) => o.setAttribute('aria-selected', String(o === option)));
    value.textContent = option.textContent;
    cursor = options.indexOf(option);
    close();
    onPick(option.dataset.value);
  }

  btn.addEventListener('click', () => (menu.hidden ? open() : close()));
  menu.addEventListener('click', (e) => {
    const option = e.target.closest('[role="option"]');
    if (option) pick(option);
  });

  menu.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); highlight(cursor + 1); break;
      case 'ArrowUp': e.preventDefault(); highlight(cursor - 1); break;
      case 'Home': e.preventDefault(); highlight(0); break;
      case 'End': e.preventDefault(); highlight(options.length - 1); break;
      case 'Enter':
      case ' ': e.preventDefault(); pick(options[cursor]); break;
      case 'Escape': e.preventDefault(); close(); break;
      case 'Tab': close({ focusBtn: false }); break;
      default: break;
    }
  });

  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  });

  // Klik poza stosem zamyka; Escape obsługuje już listener na menu
  document.addEventListener('click', (e) => {
    if (!box.contains(e.target)) close({ focusBtn: false });
  });
}

/* ---------- Lista produktów: filtry, sortowanie, szukanie ---------- */
function initShop() {
  const grid = document.querySelector('[data-grid="shop"]');
  if (!grid) return;

  const state = { category: 'all', sort: 'popular', query: '' };

  function apply() {
    const list = PRODUCTS.filter(
      (p) =>
        (state.category === 'all' || p.category === state.category) &&
        (state.query === '' ||
          p.name.toLowerCase().includes(state.query) ||
          p.short.toLowerCase().includes(state.query))
    );

    const sorters = {
      popular: (a, b) => b.reviews - a.reviews,
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      rating: (a, b) => b.rating - a.rating,
      name: (a, b) => a.name.localeCompare(b.name, 'pl'),
    };
    list.sort(sorters[state.sort] ?? sorters.popular);

    renderGrid(grid, list);
    const counter = document.querySelector('[data-result-count]');
    if (counter) counter.textContent = `${list.length} ${list.length === 1 ? 'produkt' : 'produktów'}`;
  }

  document.querySelectorAll('[data-filter]').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-filter]').forEach((c) => c.setAttribute('aria-pressed', 'false'));
      chip.setAttribute('aria-pressed', 'true');
      state.category = chip.dataset.filter;
      apply();
    });
  });

  stackSelect(document.querySelector('[data-sortbox]'), (value) => {
    state.sort = value;
    apply();
  });

  document.querySelectorAll('[data-search]').forEach((input) => {
    input.addEventListener('input', (e) => {
      state.query = e.target.value.trim().toLowerCase();
      apply();
    });
  });

  apply();
}

/* ---------- Strona produktu ---------- */
function initProduct() {
  const root = document.querySelector('[data-product]');
  if (!root) return;

  const id = new URLSearchParams(location.search).get('id');
  const p = findProduct(id) ?? PRODUCTS[0];
  const out = p.stock === 0;

  document.title = `${p.name} — Nordo`;

  root.innerHTML = `
    <div class="product-media">${productMedia(p, { sizes: '(max-width: 900px) 92vw, 560px', eager: true })}</div>
    <div class="product-info">
      <span class="label">${escapeHtml(categoryName(p.category))}</span>
      <h1>${escapeHtml(p.name)}</h1>
      <p class="rating"><span class="stars" aria-hidden="true">${stars(p.rating)}</span> ${p.rating}
        <span class="muted">· ${p.reviews} opinii</span></p>
      <p class="lede">${escapeHtml(p.short)}</p>
      <div class="price-row">
        <span class="product-price">${money(p.price)}</span>
        ${p.oldPrice ? `<span class="price-old">${money(p.oldPrice)}</span>` : ''}
      </div>
      <p class="stock ${out ? 'out' : ''}">${out ? 'Chwilowo niedostępny' : `Dostępny — ${p.stock} szt. w magazynie`}</p>
      <div class="buy-row">
        <div class="qty">
          <button type="button" data-step="-1" aria-label="Zmniejsz ilość">−</button>
          <input type="number" id="qty" value="1" min="1" max="${p.stock || 1}" aria-label="Ilość">
          <button type="button" data-step="1" aria-label="Zwiększ ilość">+</button>
        </div>
        <button class="btn" data-add-detail="${p.id}" ${out ? 'disabled' : ''}>
          ${out ? 'Niedostępny' : 'Dodaj do koszyka'}
        </button>
        <button class="btn btn-ghost" type="button" data-wish="${p.id}" aria-pressed="${Wish.has(p.id)}">
          ${icon('heart')} Do listy życzeń
        </button>
      </div>
      <p><a class="arrow-link" href="cart.html">Przejdź do koszyka</a></p>
      <h2 class="label spec-head">Specyfikacja</h2>
      <table class="specs">
        <tbody>
          ${Object.entries(p.specs)
            .map(([k, v]) => `<tr><th scope="row">${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
            .join('')}
        </tbody>
      </table>
    </div>`;

  const crumb = document.querySelector('[data-crumb]');
  if (crumb) crumb.textContent = p.name;

  const input = root.querySelector('#qty');
  root.querySelectorAll('[data-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = (parseInt(input.value, 10) || 1) + Number(btn.dataset.step);
      input.value = Math.max(1, Math.min(next, p.stock || 1));
    });
  });

  root.querySelector('[data-add-detail]')?.addEventListener('click', () => {
    Cart.add(p.id, parseInt(input.value, 10) || 1);
    MiniCart.open();
  });

  const related = document.querySelector('[data-grid="related"]');
  if (related) {
    renderGrid(
      related,
      PRODUCTS.filter((x) => x.category === p.category && x.id !== p.id).slice(0, 4)
    );
  }

  // Historia oglądania: najpierw render (bez bieżącej pozycji), potem zapis,
  // żeby na własnej karcie nie pokazywać jej samej
  Recent.render(p.id);
  Recent.push(p.id);
  initBuyBar(p);
}

/* ---------- Koszyk ---------- */
async function initCart() {
  const root = document.querySelector('[data-cart-root]');
  if (!root) return;

  const online = typeof BACKEND_ENABLED !== 'undefined' && BACKEND_ENABLED;

  let couponCode = '';
  let quote = null;
  let sending = false;
  let checkoutError = '';

  // Dane do formularza: profil zalogowanego konta, inaczej puste pola
  await Profile.load();

  async function refresh() {
    quote = await Quote.forCart(couponCode);
    render();
  }

  function render() {
    const items = Cart.read();

    if (items.length === 0) {
      root.innerHTML = `
        <div class="empty">
          <h1>Koszyk jest pusty</h1>
          <p>Dodaj produkty, żeby kontynuować zakupy.</p>
          <a class="btn" href="shop.html">Przejdź do sklepu</a>
        </div>`;
      return;
    }

    const subtotal = quote?.subtotal ?? Cart.subtotal();
    const discountValue = quote?.discount ?? 0;
    const shipping = quote?.shipping ?? 0;
    const total = quote?.total ?? subtotal;
    const shortages = (quote?.lines ?? []).filter((l) => !l.inStock);
    const user = Auth.user();
    const profile = Profile.read();

    root.innerHTML = `
      <div class="cart-layout">
        <section>
          <div class="cart-head">
            <h1>Koszyk</h1>
            <span class="muted num">${Cart.count()} szt.</span>
          </div>
          ${items
            .map((i) => {
              const p = findProduct(i.id);
              return `
              <div class="cart-item">
                <div class="cart-item-media">${productMedia(p, { sizes: '96px' })}</div>
                <div>
                  <a class="cart-item-title" href="product.html?id=${encodeURIComponent(p.id)}">${escapeHtml(p.name)}</a>
                  <div class="cart-item-meta">${escapeHtml(categoryName(p.category))} · ${money(p.price)} / szt.</div>
                  <div class="cart-item-actions">
                    <div class="qty">
                      <button type="button" data-qty="${p.id}" data-step="-1" aria-label="Zmniejsz ilość">−</button>
                      <input type="number" value="${i.qty}" min="1" max="${p.stock}" data-qty-input="${p.id}" aria-label="Ilość">
                      <button type="button" data-qty="${p.id}" data-step="1" aria-label="Zwiększ ilość">+</button>
                    </div>
                    <button class="btn-link" data-remove="${p.id}">Usuń</button>
                  </div>
                </div>
                <div class="cart-item-total">${money(p.price * i.qty)}</div>
              </div>`;
            })
            .join('')}
          <div class="cart-foot">
            <a class="arrow-link" href="shop.html">Kontynuuj zakupy</a>
            <button class="btn-link" data-clear>Wyczyść koszyk</button>
          </div>

          <form class="card-box checkout" data-checkout-form>
            <h2>Dane do zamówienia</h2>
            <p class="lede">Ceny, rabat i dostawę przelicza serwer przy składaniu zamówienia.</p>

            <div class="field-row">
              <div class="field">
                <label for="co-name">Imię i nazwisko</label>
                <input id="co-name" name="name" type="text" autocomplete="name" required
                  value="${escapeHtml(profile.name || user?.name || '')}">
              </div>
              <div class="field">
                <label for="co-phone">Telefon</label>
                <input id="co-phone" name="phone" type="tel" autocomplete="tel"
                  placeholder="+48 600 000 000" value="${escapeHtml(profile.phone || '')}">
              </div>
            </div>
            <div class="field">
              <label for="co-email">E-mail</label>
              <input id="co-email" name="email" type="email" autocomplete="email" required
                value="${escapeHtml(profile.email || user?.email || '')}">
            </div>
            <div class="field">
              <label for="co-street">Ulica i numer</label>
              <input id="co-street" name="street" type="text" autocomplete="street-address" required
                placeholder="Krucza 12/4" value="${escapeHtml(profile.street || '')}">
            </div>
            <div class="field-row">
              <div class="field">
                <label for="co-zip">Kod pocztowy</label>
                <input id="co-zip" name="zip" type="text" autocomplete="postal-code" required
                  placeholder="00-001" value="${escapeHtml(profile.zip || '')}">
              </div>
              <div class="field">
                <label for="co-city">Miasto</label>
                <input id="co-city" name="city" type="text" autocomplete="address-level2" required
                  placeholder="Warszawa" value="${escapeHtml(profile.city || '')}">
              </div>
            </div>

            ${checkoutError ? `<p class="notice notice-error" role="alert">${escapeHtml(checkoutError)}</p>` : ''}
            ${online ? '' : '<p class="summary-note">Tryb bez bazy — zamówienia nie da się złożyć. Ustaw dane Supabase w <code>js/config.js</code>.</p>'}

            <button class="btn btn-block" type="submit" style="margin-top:20px"
              ${!online || sending || shortages.length ? 'disabled' : ''}>
              ${sending ? 'Składam zamówienie…' : `Zamawiam i płacę · ${money(total)}`}
            </button>
            <p class="summary-note" style="text-align:center">
              Zamówienie rezerwuje towar; płatność potwierdza operator.
            </p>
          </form>
        </section>

        <aside class="summary">
          <h2>Podsumowanie</h2>
          <div class="summary-row"><span>Wartość produktów</span><span>${money(subtotal)}</span></div>
          ${discountValue ? `<div class="summary-row"><span>Rabat · ${escapeHtml(quote?.coupon ?? couponCode)}</span><span>−${money(discountValue)}</span></div>` : ''}
          <div class="summary-row"><span>Dostawa</span><span>${shipping === 0 ? 'Gratis' : money(shipping)}</span></div>
          ${shipBar(subtotal - discountValue)}
          <form class="coupon" data-coupon>
            <input type="text" placeholder="Kod rabatowy" aria-label="Kod rabatowy" value="${escapeHtml(couponCode)}">
            <button class="btn btn-ghost btn-sm" type="submit">Zastosuj</button>
          </form>
          <div class="summary-row total"><span>Razem</span><span>${money(total)}</span></div>
          ${shortages.length
            ? `<p class="notice notice-error" role="alert">Brakuje sztuk: ${shortages
                .map((l) => `${escapeHtml(l.name)} (zostało ${l.stock})`)
                .join(', ')}.</p>`
            : ''}
          <p class="summary-note" style="text-align:center">
            ${Quote.source === 'baza' ? 'Kwoty policzone w bazie' : 'Kwoty policzone lokalnie'} ·
            darmowy zwrot w 30 dni
          </p>
        </aside>
      </div>`;
  }

  /** Składa zamówienie przez Edge Function. Kwoty liczy baza, nie ten formularz. */
  async function submitOrder(form) {
    const f = form.elements;
    checkoutError = '';
    sending = true;
    render();

    try {
      const res = await Backend.checkout({
        items: Cart.read(),
        email: f.email.value.trim(),
        phone: f.phone.value.trim() || null,
        coupon: quote?.couponValid ? quote.coupon : null,
        address: {
          recipient: f.name.value.trim(),
          street: f.street.value.trim(),
          postal_code: f.zip.value.trim(),
          city: f.city.value.trim(),
          country: 'PL',
          phone: f.phone.value.trim() || null,
        },
      });

      if (!res?.order_number) throw new Error('Serwer nie zwrócił numeru zamówienia');

      // Zamówienie stoi w bazie, towar zarezerwowany — koszyk może odejść
      Cart.clear();

      // Z kluczem operatora idziemy na jego stronę płatności; bez niego
      // (praca lokalna) zostaje potwierdzenie z numerem zamówienia.
      location.href = res.checkout_url
        ? res.checkout_url
        : `order-confirmed.html?order=${encodeURIComponent(res.order_number)}`;
    } catch (err) {
      checkoutError = checkoutMessage(err);
      sending = false;
      render();
    }
  }

  root.addEventListener('click', (e) => {
    const stepBtn = e.target.closest('[data-qty]');
    if (stepBtn) {
      const id = stepBtn.dataset.qty;
      const current = Cart.read().find((i) => i.id === id)?.qty ?? 1;
      Cart.setQty(id, current + Number(stepBtn.dataset.step));
      return;
    }
    const removeBtn = e.target.closest('[data-remove]');
    if (removeBtn) {
      Cart.remove(removeBtn.dataset.remove);
      toast('Usunięto z koszyka');
      return;
    }
    if (e.target.closest('[data-clear]')) {
      Cart.clear();
      return;
    }
  });

  root.addEventListener('change', (e) => {
    const input = e.target.closest('[data-qty-input]');
    if (input) Cart.setQty(input.dataset.qtyInput, parseInt(input.value, 10) || 0);
  });

  root.addEventListener('submit', async (e) => {
    const couponForm = e.target.closest('[data-coupon]');
    if (couponForm) {
      e.preventDefault();
      couponCode = couponForm.querySelector('input').value.trim().toUpperCase();
      await refresh();
      // Kod sprawdza baza, nie front — stąd komunikat dopiero po wycenie
      if (couponCode) toast(quote?.couponValid ? `Kod ${couponCode} zastosowany` : 'Nieprawidłowy kod rabatowy');
      if (couponCode && !quote?.couponValid) couponCode = '';
      return;
    }

    const checkoutForm = e.target.closest('[data-checkout-form]');
    if (checkoutForm) {
      e.preventDefault();
      if (sending) return;
      await submitOrder(checkoutForm);
    }
  });

  document.addEventListener('cart:change', refresh);
  await refresh();
}

/* ---------- Potwierdzenie zamówienia ----------
 * Strona powrotu z płatności. Sam powrót niczego nie potwierdza — status
 * płatności ustawia webhook operatora, więc tu pokazujemy stan z bazy.
 * Zamówienia gościa nie widzi nikt poza zapleczem, stąd wariant z samym numerem.
 */
async function initOrderConfirmed() {
  const root = document.querySelector('[data-order-root]');
  if (!root) return;

  const number = new URLSearchParams(location.search).get('order');

  if (!number) {
    root.innerHTML = `
      <div class="empty">
        <h1>Brak numeru zamówienia</h1>
        <p>Ten adres otwiera się po złożeniu zamówienia.</p>
        <a class="btn" href="shop.html">Przejdź do sklepu</a>
      </div>`;
    return;
  }

  const order = (typeof BACKEND_ENABLED !== 'undefined' && BACKEND_ENABLED)
    ? await Backend.orderByNumber(number)
    : null;

  const head = `
    <div class="order-done">
      <span class="order-done-mark">${icon('check')}</span>
      <h1>Zamówienie przyjęte</h1>
      <p class="lede">Numer <strong>${escapeHtml(number)}</strong> — potwierdzenie idzie na e-mail.</p>
    </div>`;

  if (!order) {
    root.innerHTML = `
      ${head}
      <div class="card-box">
        <p class="muted">Szczegóły zamówienia widzi konto, na które zostało złożone.
          Zaloguj się tym adresem e-mail, żeby śledzić status w panelu konta.</p>
        <p style="margin-top:14px"><a class="arrow-link" href="shop.html">Wróć do sklepu</a></p>
      </div>`;
    return;
  }

  const paid = order.paymentStatus === 'opłacone';
  root.innerHTML = `
    ${head}
    <div class="card-box">
      <div class="summary-row"><span>Status zamówienia</span><span>${escapeHtml(order.status)}</span></div>
      <div class="summary-row"><span>Płatność</span><span>${escapeHtml(order.paymentStatus)}</span></div>
      <div class="summary-row"><span>Wartość produktów</span><span>${money(order.subtotal)}</span></div>
      ${order.discount ? `<div class="summary-row"><span>Rabat</span><span>−${money(order.discount)}</span></div>` : ''}
      <div class="summary-row"><span>Dostawa</span><span>${order.shipping === 0 ? 'Gratis' : money(order.shipping)}</span></div>
      <div class="summary-row total"><span>Razem</span><span>${money(order.total)}</span></div>
      <p class="summary-note">${paid
        ? 'Płatność potwierdzona przez operatora.'
        : 'Czekamy na potwierdzenie płatności — status zmieni się automatycznie.'}</p>
    </div>
    <div class="card-box">
      <h3>Pozycje</h3>
      ${order.items
        .map((i) => `<div class="summary-row"><span>${escapeHtml(i.name)} × ${i.qty}</span><span>${money(i.price * i.qty)}</span></div>`)
        .join('')}
      ${order.address ? `<p class="summary-note">Dostawa: ${escapeHtml(order.customer)}, ${escapeHtml(order.address)}</p>` : ''}
      <p style="margin-top:14px"><a class="arrow-link" href="account.html#orders">Moje zamówienia</a></p>
    </div>`;
}

/** Błąd z create_order / Edge Function → jedno zdanie dla klienta. */
function checkoutMessage(err) {
  const msg = String(err?.message ?? err ?? '');
  const stock = msg.match(/Za mało sztuk: (.+?) \(dostępne (\d+)\)/);

  if (stock) return `Zabrakło towaru: ${stock[1]} — zostało ${stock[2]} szt.`;
  if (/Kod rabatowy .* nieprawidłowy|wygasł/i.test(msg)) return 'Kod rabatowy jest nieprawidłowy lub wygasł.';
  if (/Nieprawidłowy adres e-mail/i.test(msg)) return 'Sprawdź adres e-mail.';
  if (/Puste zamówienie|Koszyk jest pusty/i.test(msg)) return 'Koszyk jest pusty.';
  if (/niedostępny/i.test(msg)) return 'Któryś z produktów zniknął z katalogu — odśwież koszyk.';
  if (/failed to fetch|networkerror|load failed/i.test(msg)) return 'Brak połączenia z serwerem — spróbuj za chwilę.';
  return `Nie udało się złożyć zamówienia: ${msg}`;
}

/* ==========================================================================
   Ruch i wzorce sklepowe
   ========================================================================== */

/** Czy użytkownik prosi o spokój — wtedy zamiast animacji od razu stan końcowy. */
const stillMode = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Ujawnianie treści przy przewijaniu ----------
 * Jeden obserwator na całą stronę; element po wejściu przestaje być śledzony.
 * Przy wyłączonym ruchu nic nie chowamy — treść musi być widoczna od razu.
 */
const Reveal = {
  io: null,

  scan(root = document) {
    const targets = root.querySelectorAll('[data-reveal]:not(.is-in)');
    if (!targets.length) return;

    if (stillMode()) {
      targets.forEach((el) => el.classList.add('is-in'));
      return;
    }

    if (!this.io) {
      this.io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            // Wejście animujemy tylko od dołu. Element, który wjechał od góry
            // (powrót na stronie, skok do kotwicy), pojawia się bez zapowiedzi —
            // animowanie go wyglądałoby jak usterka, nie jak efekt.
            if (entry.boundingClientRect.top < 0) entry.target.classList.add('is-instant');

            entry.target.classList.add('is-in');
            this.io.unobserve(entry.target);
          });
        },
        // Dolny margines ujemny: kafelek rusza dopiero, gdy wejdzie na dobre
        // w okno, a nie gdy dotknie jego krawędzi.
        { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
      );
    }

    targets.forEach((el) => this.io.observe(el));
  },

  /**
   * Kaskada w siatce. Opóźnienie rośnie pierwiastkowo, więc początek jest
   * wyraźny, a ósmy kafelek nie każe czekać pół sekundy.
   */
  stagger(container) {
    [...container.children].forEach((el, i) => {
      const step = Math.round(70 * Math.sqrt(Math.min(i, 11)));
      el.style.setProperty('--reveal-delay', `${step}ms`);
    });
  },
};

/* ---------- Ostatnio oglądane ----------
 * Lista identyfikatorów w localStorage, najnowsze z przodu. Świadomie tylko
 * lokalnie: to podpowiedź nawigacyjna, nie dane konta.
 */
const RECENT_KEY = 'shop.recent.v1';
const RECENT_MAX = 8;
const Recent = {
  read() {
    try {
      const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(list) ? list.filter((id) => findProduct(id)) : [];
    } catch {
      return [];
    }
  },
  push(id) {
    const list = [id, ...Recent.read().filter((x) => x !== id)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  },
  /** Wypełnia sekcję albo zostawia ją ukrytą, gdy nie ma czego pokazać. */
  render(skipId) {
    const section = document.querySelector('[data-recent-section]');
    const grid = document.querySelector('[data-grid="recent"]');
    if (!section || !grid) return;

    const items = Recent.read()
      .filter((id) => id !== skipId)
      .map((id) => findProduct(id))
      .filter(Boolean)
      .slice(0, 4);

    section.hidden = items.length === 0;
    if (items.length) {
      renderGrid(grid, items);
      Reveal.stagger(grid);
      Reveal.scan(grid);
    }
  },
};

/* ---------- Pasek do darmowej dostawy ----------
 * Ten sam kawałek w mini-koszyku i w podsumowaniu: ile brakuje do progu.
 */
function shipBar(afterDiscount) {
  const goal = Store.freeFrom;
  const done = afterDiscount >= goal;
  const percent = goal > 0 ? Math.min(100, Math.round((afterDiscount / goal) * 100)) : 100;

  return `
    <div class="ship-bar ${done ? 'is-free' : ''}">
      <p>${done
        ? 'Dostawa gratis — próg osiągnięty.'
        : `Do darmowej dostawy brakuje <strong class="num">${money(goal - afterDiscount)}</strong>.`}</p>
      <div class="ship-bar-track" role="progressbar" aria-valuemin="0" aria-valuemax="100"
        aria-valuenow="${percent}" aria-label="Postęp do darmowej dostawy">
        <div class="ship-bar-fill" style="width:${percent}%"></div>
      </div>
    </div>`;
}

/* ---------- Wspólna obsługa nakładek ----------
 * Escape, klik w tło, blokada przewijania i powrót ostrości na element,
 * z którego nakładkę otwarto.
 */
const Overlay = {
  active: null,
  lastFocus: null,
  backdrop: null,

  show(panel, onClose) {
    if (!this.backdrop) {
      this.backdrop = document.createElement('div');
      this.backdrop.className = 'overlay';
      this.backdrop.hidden = true;
      this.backdrop.addEventListener('click', () => Overlay.hide());
      document.body.appendChild(this.backdrop);
    }

    // Nakładka potrafi otworzyć następną (podgląd → mini-koszyk). Domykanie
    // poprzedniej jest opóźnione o czas animacji, więc trzeba je odwołać —
    // inaczej jego timer schowałby tło już pod nową nakładką.
    clearTimeout(this.timer);

    this.lastFocus = document.activeElement;
    this.active = { panel, onClose };

    this.backdrop.hidden = false;
    panel.hidden = false;
    // Dwie klatki: przeglądarka musi zdążyć policzyć stan początkowy,
    // inaczej przejście nie ma z czego wystartować.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        this.backdrop.classList.add('is-open');
        panel.classList.add('is-open');
      })
    );

    document.body.style.overflow = 'hidden';
    panel.querySelector('[data-autofocus]')?.focus();
  },

  hide() {
    if (!this.active) return;
    const { panel, onClose } = this.active;
    this.active = null;

    panel.classList.remove('is-open');
    this.backdrop.classList.remove('is-open');
    document.body.style.overflow = '';

    const done = () => {
      // W międzyczasie mogła otworzyć się kolejna nakładka — wtedy zostawiamy
      // jej tło w spokoju i chowamy wyłącznie swój panel.
      panel.hidden = true;
      if (!this.active) this.backdrop.hidden = true;
      onClose?.();
    };
    if (stillMode()) done();
    else this.timer = setTimeout(done, 280);

    this.lastFocus?.focus?.();
  },
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') Overlay.hide();
});

/* ---------- Mini-koszyk ----------
 * Szuflada zamiast skoku na osobną stronę po każdym „do koszyka".
 * Kwoty bierze z tej samej wyceny co koszyk, więc nic się nie rozjeżdża.
 */
const MiniCart = {
  el: null,

  build() {
    if (this.el) return this.el;

    const el = document.createElement('aside');
    el.className = 'drawer';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'minicart-title');
    el.innerHTML = `
      <div class="drawer-head">
        <h2 id="minicart-title">Koszyk</h2>
        <button class="icon-close" type="button" data-minicart-close aria-label="Zamknij koszyk" data-autofocus>
          ${icon('close')}
        </button>
      </div>
      <div class="drawer-body" data-minicart-body></div>
      <div class="drawer-foot" data-minicart-foot></div>`;

    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-minicart-close]')) Overlay.hide();
    });

    document.body.appendChild(el);
    this.el = el;
    return el;
  },

  async open() {
    const el = this.build();
    await this.render();
    Overlay.show(el);
  },

  async render() {
    const el = this.build();
    const body = el.querySelector('[data-minicart-body]');
    const foot = el.querySelector('[data-minicart-foot]');
    const items = Cart.read();

    if (!items.length) {
      body.innerHTML = `
        <p class="muted">Koszyk jest pusty.</p>
        <p style="margin-top:14px"><a class="arrow-link" href="shop.html">Przejdź do sklepu</a></p>`;
      foot.innerHTML = '';
      return;
    }

    const quote = await Quote.forCart(null);

    body.innerHTML =
      shipBar(quote.subtotal - quote.discount) +
      items
        .map((i) => {
          const p = findProduct(i.id);
          if (!p) return '';
          return `
          <div class="drawer-item">
            <div class="drawer-item-media">${productMedia(p, { sizes: '56px' })}</div>
            <div>
              <a class="drawer-item-name" href="product.html?id=${encodeURIComponent(p.id)}">${escapeHtml(p.name)}</a>
              <div class="drawer-item-meta">${i.qty} × ${money(p.price)}</div>
              <div class="cart-item-actions" style="margin-top:8px">
                <div class="qty">
                  <button type="button" data-qty="${p.id}" data-step="-1" aria-label="Zmniejsz ilość">−</button>
                  <input type="number" value="${i.qty}" min="1" max="${p.stock}" data-qty-input="${p.id}" aria-label="Ilość">
                  <button type="button" data-qty="${p.id}" data-step="1" aria-label="Zwiększ ilość">+</button>
                </div>
                <button class="btn-link" data-remove="${p.id}">Usuń</button>
              </div>
            </div>
            <div class="drawer-item-total num">${money(p.price * i.qty)}</div>
          </div>`;
        })
        .join('');

    foot.innerHTML = `
      <div class="summary-row"><span>Wartość produktów</span><span class="num">${money(quote.subtotal)}</span></div>
      ${quote.discount ? `<div class="summary-row"><span>Rabat</span><span class="num">−${money(quote.discount)}</span></div>` : ''}
      <div class="summary-row"><span>Dostawa</span><span class="num">${quote.shipping === 0 ? 'Gratis' : money(quote.shipping)}</span></div>
      <div class="summary-row total"><span>Razem</span><span class="num">${money(quote.total)}</span></div>
      <a class="btn btn-block" href="cart.html" style="margin-top:16px">Przejdź do kasy</a>
      <button class="btn btn-ghost btn-block" type="button" data-minicart-close style="margin-top:10px">
        Kontynuuj zakupy
      </button>`;
  },
};

/* ---------- Szybki podgląd ----------
 * Karta produktu bez opuszczania listy: specyfikacja, ilość, dodanie do koszyka.
 */
const QuickView = {
  el: null,

  build() {
    if (this.el) return this.el;

    const el = document.createElement('div');
    el.className = 'quick';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'quick-title');
    el.innerHTML = '<div class="quick-panel" data-quick-panel></div>';

    el.addEventListener('click', (e) => {
      // Klik obok panelu zamyka — tło pod nakładką nie łapie tych zdarzeń
      if (e.target === el || e.target.closest('[data-quick-close]')) Overlay.hide();
    });

    document.body.appendChild(el);
    this.el = el;
    return el;
  },

  open(id) {
    const p = findProduct(id);
    if (!p) return;

    const el = this.build();
    const out = p.stock === 0;

    el.querySelector('[data-quick-panel]').innerHTML = `
      <button class="icon-close quick-close" type="button" data-quick-close aria-label="Zamknij podgląd" data-autofocus>
        ${icon('close')}
      </button>
      <div class="quick-grid">
        <div class="quick-media">${productMedia(p, { sizes: '(max-width: 700px) 92vw, 280px', eager: true })}</div>
        <div>
          <span class="label">${escapeHtml(categoryName(p.category))}</span>
          <h2 id="quick-title">${escapeHtml(p.name)}</h2>
          <p class="rating"><span class="stars" aria-hidden="true">${stars(p.rating)}</span>
            <span class="sr-only">Ocena ${p.rating} na 5.</span> ${p.reviews} opinii</p>
          <p class="lede" style="margin-top:12px">${escapeHtml(p.short)}</p>
          <div class="price-row">
            <span class="product-price">${money(p.price)}</span>
            ${p.oldPrice ? `<span class="price-old">${money(p.oldPrice)}</span>` : ''}
          </div>
          <p class="stock ${out ? 'out' : ''}">${out ? 'Chwilowo niedostępny' : `Dostępny — ${p.stock} szt.`}</p>
          <div class="buy-row">
            <div class="qty">
              <button type="button" data-quick-step="-1" aria-label="Zmniejsz ilość">−</button>
              <input type="number" id="quick-qty" value="1" min="1" max="${p.stock || 1}" aria-label="Ilość">
              <button type="button" data-quick-step="1" aria-label="Zwiększ ilość">+</button>
            </div>
            <button class="btn" type="button" data-quick-add="${p.id}" ${out ? 'disabled' : ''}>
              ${out ? 'Niedostępny' : 'Do koszyka'}
            </button>
            <button class="btn btn-ghost" type="button" data-wish="${p.id}" aria-pressed="${Wish.has(p.id)}">
              ${icon('heart')} Zapisz
            </button>
          </div>
          <p><a class="arrow-link" href="product.html?id=${encodeURIComponent(p.id)}">Pełna karta produktu</a></p>
          <table class="specs">
            <tbody>
              ${Object.entries(p.specs)
                .slice(0, 4)
                .map(([k, v]) => `<tr><th scope="row">${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
                .join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    const input = el.querySelector('#quick-qty');
    el.querySelectorAll('[data-quick-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = (parseInt(input.value, 10) || 1) + Number(btn.dataset.quickStep);
        input.value = Math.max(1, Math.min(next, p.stock || 1));
      });
    });

    el.querySelector('[data-quick-add]')?.addEventListener('click', () => {
      Cart.add(p.id, parseInt(input.value, 10) || 1);
      Overlay.hide();
      MiniCart.open();
    });

    Overlay.show(el);
  },
};

/* ---------- Pasek zakupu na karcie produktu ----------
 * Pokazuje się dopiero, gdy właściwy przycisk zjedzie za ekran.
 */
function initBuyBar(product) {
  const anchor = document.querySelector('[data-product] .buy-row');
  if (!anchor || product.stock === 0) return;

  const bar = document.createElement('div');
  bar.className = 'buy-bar';
  bar.innerHTML = `
    <div class="container buy-bar-inner">
      <div class="buy-bar-info">
        <div class="buy-bar-name">${escapeHtml(product.name)}</div>
        <div class="buy-bar-price num">${money(product.price)}</div>
      </div>
      <button class="btn" type="button" data-add="${product.id}">Do koszyka</button>
    </div>`;
  document.body.appendChild(bar);

  new IntersectionObserver(
    ([entry]) => bar.classList.toggle('is-open', !entry.isIntersecting && entry.boundingClientRect.top < 0),
    { threshold: 0 }
  ).observe(anchor);
}

/* ---------- Szkielety na czas ładowania katalogu ---------- */
function paintSkeletons() {
  document.querySelectorAll('[data-grid]').forEach((grid) => {
    if (grid.children.length) return;
    grid.innerHTML = Array.from({ length: 4 })
      .map(
        () => `
        <div class="skeleton">
          <div class="skeleton-box skeleton-media"></div>
          <div class="skeleton-box skeleton-line w-40"></div>
          <div class="skeleton-box skeleton-line w-70"></div>
          <div class="skeleton-box skeleton-line w-40"></div>
        </div>`
      )
      .join('');
  });
}

/* ---------- Spięcie globalne ---------- */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-add]');
  if (!btn) return;
  Cart.add(btn.dataset.add, 1);
  // Zamiast samego toasta: szuflada pokazuje, co jest w koszyku i ile brakuje
  // do darmowej dostawy. Na stronie koszyka byłaby zasłoną na to samo.
  if (document.querySelector('[data-cart-root]')) toast('Dodano do koszyka');
  else MiniCart.open();
});

// Szybki podgląd z kafelka
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-quick]');
  if (!btn) return;
  e.preventDefault();
  QuickView.open(btn.dataset.quick);
});

// Ikona koszyka w nagłówku otwiera szufladę zamiast przeładowywać stronę
document.addEventListener('click', (e) => {
  const link = e.target.closest('.cart-btn');
  if (!link || document.querySelector('[data-cart-root]')) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  MiniCart.open();
});

// Ilości i usuwanie działają też w szufladzie
document.addEventListener('click', (e) => {
  const drawer = e.target.closest('.drawer');
  if (!drawer) return;

  const stepBtn = e.target.closest('[data-qty]');
  if (stepBtn) {
    const id = stepBtn.dataset.qty;
    const current = Cart.read().find((i) => i.id === id)?.qty ?? 1;
    Cart.setQty(id, current + Number(stepBtn.dataset.step));
    return;
  }

  const removeBtn = e.target.closest('[data-remove]');
  if (removeBtn) Cart.remove(removeBtn.dataset.remove);
});

document.addEventListener('change', (e) => {
  const input = e.target.closest('.drawer [data-qty-input]');
  if (input) Cart.setQty(input.dataset.qtyInput, parseInt(input.value, 10) || 0);
});

// Zawartość szuflady nadąża za koszykiem, ale tylko gdy jest otwarta
document.addEventListener('cart:change', () => {
  if (MiniCart.el && !MiniCart.el.hidden) MiniCart.render();
});

// Serce na kafelku i na karcie produktu. Zapis leci do tabeli wishlists,
// więc lista jedzie z kontem — bez logowania nie ma gdzie jej trzymać.
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-wish]');
  if (!btn) return;
  e.preventDefault();

  const id = btn.dataset.wish;
  btn.disabled = true;
  try {
    const on = await Wish.toggle(id);
    if (on === null) {
      toast('Zaloguj się, żeby zapisać listę życzeń');
      return;
    }
    if (on) {
      btn.classList.remove('is-added');
      void btn.offsetWidth;
      btn.classList.add('is-added');
    }
    toast(on ? 'Dodano do listy życzeń' : 'Usunięto z listy życzeń');
  } catch (err) {
    toast(`Nie udało się: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
});

// Stan serc po każdej zmianie — kafelki bywają przerysowywane niezależnie
document.addEventListener('wishlist:change', () => {
  document.querySelectorAll('[data-wish]').forEach((b) => {
    b.setAttribute('aria-pressed', String(Wish.has(b.dataset.wish)));
  });
});

document.addEventListener('cart:change', refreshCartBadge);

document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('[data-icon]').forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
  });

  // Katalog leci z bazy — do czasu odpowiedzi siatki trzymają szkielety
  // zamiast pustego miejsca, które podskakuje przy pojawieniu się kart.
  paintSkeletons();

  // Sesja przed katalogiem: klient Supabase powstaje raz, a zapytania
  // o produkty lecą już z tokenem — RLS widzi rolę zalogowanego konta.
  // Oba wywołania idą po kolei, żeby nie zbudować dwóch klientów naraz.
  await Auth.load();
  await Catalog.load();
  // Lista życzeń przed renderem kafelków — serca mają od razu znać swój stan
  await Wish.load();
  // Próg darmowej dostawy z bazy; bez niej zostają stałe z góry pliku
  await Store.load();
  refreshCartBadge();
  initAccountMenu();
  initAdmin();
  initHome();
  initShop();
  initProduct();
  await initCart();
  initLogin();
  await initAccountPage();
  await initOrderConfirmed();

  document.querySelector('[data-newsletter]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    toast('Dziękujemy za zapis');
    e.target.reset();
  });

  // preselekcja kategorii z #hash (linki z kafelków na stronie głównej)
  const hash = location.hash.slice(1);
  if (hash) document.querySelector(`[data-filter="${CSS.escape(hash)}"]`)?.click();

  // Reszta treści wchodzi tym samym ruchem co kafelki: nagłówki sekcji,
  // pasek korzyści (kaskadą), newsletter i kolumna opisu produktu.
  document
    .querySelectorAll('.section-head, .newsletter-inner, .product-info, .order, .card-box')
    .forEach((el) => el.setAttribute('data-reveal', ''));

  const features = document.querySelector('.features');
  if (features) {
    [...features.children].forEach((el) => el.setAttribute('data-reveal', ''));
    Reveal.stagger(features);
  }

  Reveal.scan();
});
