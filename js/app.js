/**
 * Logika szablonu: koszyk w localStorage, render list produktów,
 * strona produktu, strona koszyka. Zero zależności.
 */

/* ---------- Konfiguracja ---------- */
const CART_KEY = 'shop.cart.v1';
const USER_KEY = 'shop.user.v1';
const CATALOG_KEY = 'shop.catalog.v1';

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
 * Dane kontaktowe i adres wpisane przez klienta. Docelowo PUT /api/me.
 */
const PROFILE_KEY = 'shop.profile.v1';
const Profile = {
  read() {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') || {};
    } catch {
      return {};
    }
  },
  write(data) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...Profile.read(), ...data }));
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
  badge.textContent = n;
  badge.hidden = n === 0;
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
      // Strony za logowaniem odsyłamy do formularza — bez sesji nie mają co pokazać
      const guarded = document.querySelector('[data-account-root], [data-admin-root]');
      Auth.signOut().then(() => {
        toast('Wylogowano');
        if (guarded) location.href = 'login.html';
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

/* ---------- Panel konta ----------
 * Widok zależy od roli:
 *  - admin      — przegląd sklepu, wszystkie zamówienia z kosztami, klienci i adresy
 *  - klient     — lista życzeń oraz własne dane, kontakt i adres
 * Filtrowanie po stronie klienta jest tylko kosmetyką. Dane wrażliwe
 * (cudze zamówienia, adresy) w prawdziwym sklepie nie mogą trafić do przeglądarki
 * klienta — endpoint musi je odciąć po sprawdzeniu roli w sesji.
 */
function initAccountPage() {
  const root = document.querySelector('[data-account-root]');
  if (!root) return;

  const user = Auth.user();
  if (!user) {
    location.replace('login.html');
    return;
  }
  const isAdmin = user.role === 'admin';

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

  if (isAdmin) {
    const spent = ORDERS.reduce((s, o) => s + o.total, 0);
    const shippingCost = ORDERS.reduce((s, o) => s + o.shipping, 0);
    const pending = ORDERS.filter((o) => o.status !== 'dostarczone');

    root.querySelector('[data-stat-orders]').textContent = ORDERS.length;
    root.querySelector('[data-stat-spent]').textContent = money(spent);
    root.querySelector('[data-stat-shipping]').textContent = money(shippingCost);
    root.querySelector('[data-catalog-count]').textContent = PRODUCTS.length;
    root.querySelector('[data-pending]').textContent = pending.length
      ? `${pending.length} zamówienie w drodze — ${pending.map((o) => o.id).join(', ')}.`
      : 'Wszystkie zamówienia dostarczone.';

    root.querySelector('[data-orders]').innerHTML = ORDERS.map((o) => {
      const names = o.items
        .map((i) => `${findProduct(i.id)?.name ?? i.id} × ${i.qty}`)
        .join(', ');
      const done = o.status === 'dostarczone';
      return `
        <div class="order">
          <div>
            <div class="order-id">${escapeHtml(o.id)}</div>
            <div class="order-meta">${new Date(o.date).toLocaleDateString('pl-PL', {
              day: 'numeric', month: 'long', year: 'numeric',
            })} · <span class="pill ${done ? 'pill-done' : 'pill-way'}">${escapeHtml(o.status)}</span></div>
          </div>
          <div class="order-total">${money(o.total)}</div>
          <div class="order-items">${escapeHtml(names)}</div>
          <div class="order-items">
            ${escapeHtml(o.customer)} · ${escapeHtml(o.phone)} · ${escapeHtml(o.address)}
            <span class="muted">— dostawa ${o.shipping === 0 ? 'gratis' : money(o.shipping)}</span>
          </div>
        </div>`;
    }).join('');

    const seen = new Map();
    ORDERS.forEach((o) => seen.set(o.email, o));
    root.querySelector('[data-customers]').innerHTML = [...seen.values()]
      .map((o) => {
        const own = ORDERS.filter((x) => x.email === o.email);
        const sum = own.reduce((s, x) => s + x.total, 0);
        return `
        <div class="order">
          <div>
            <div class="order-id">${escapeHtml(o.customer)}</div>
            <div class="order-meta">${escapeHtml(o.email)} · ${escapeHtml(o.phone)}</div>
          </div>
          <div class="order-total">${money(sum)}</div>
          <div class="order-items">${escapeHtml(o.address)} · ${own.length} zamówień</div>
        </div>`;
      })
      .join('');
  }

  // Lista życzeń — demo na podstawie katalogu
  const wish = root.querySelector('[data-grid="wishlist"]');
  if (wish) renderGrid(wish, PRODUCTS.filter((p) => ['p-002', 'p-007'].includes(p.id)).slice(0, 4));

  // Dane i adres klienta
  const profileForm = root.querySelector('[data-profile-form]');
  if (profileForm) {
    const profile = Profile.read();
    profileForm.elements.name.value = profile.name || user.name;
    profileForm.elements.email.value = profile.email || user.email;
    profileForm.elements.phone.value = profile.phone || '';
    profileForm.elements.street.value = profile.street || '';
    profileForm.elements.zip.value = profile.zip || '';
    profileForm.elements.city.value = profile.city || '';
    profileForm.elements.newsletter.checked = Boolean(profile.newsletter);

    profileForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = profileForm.elements;
      Profile.write({
        name: f.name.value.trim(),
        email: f.email.value.trim(),
        phone: f.phone.value.trim(),
        street: f.street.value.trim(),
        zip: f.zip.value.trim(),
        city: f.city.value.trim(),
        newsletter: f.newsletter.checked,
      });
      // Imię w nagłówku i menu ma nadążyć za formularzem. E-mail należy do
      // sesji Supabase — jego zmiana to osobna operacja w Auth, nie profil.
      Auth.rename(f.name.value.trim());
      toast('Dane zapisane lokalnie — podłącz API');
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
        <div class="admin-thumb">${icon(p.icon)}</div>
        <div>
          <div class="admin-name">${escapeHtml(p.name)}</div>
          <div class="order-meta">${escapeHtml(p.id)} · ${escapeHtml(categoryName(p.category))} ·
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
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetForm() {
    form.reset();
    idField.value = '';
    formTitle.textContent = 'Nowy produkt';
    cancelBtn.hidden = true;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements;
    const editing = Boolean(idField.value);
    const submitBtn = form.querySelector('button[type="submit"]');
    const product = {
      id: idField.value || Catalog.nextId(),
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
    };
    submitBtn.disabled = true;
    try {
      await Catalog.upsert(product);
      toast(editing ? 'Produkt zaktualizowany' : 'Produkt dodany');
      resetForm();
    } catch (err) {
      toast(`Nie zapisano: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
    }
  });

  cancelBtn.addEventListener('click', resetForm);

  root.querySelector('[data-reset-catalog]').addEventListener('click', () => {
    if (confirm('Przywrócić katalog startowy? Wszystkie dodane produkty znikną.')) Catalog.reset();
  });

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
          .then(() => {
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

/* ---------- Kafelek produktu ---------- */
function productCard(p) {
  const out = p.stock === 0;
  return `
    <article class="card">
      <a class="card-media" href="product.html?id=${encodeURIComponent(p.id)}" aria-label="${escapeHtml(p.name)}">
        ${p.badge ? `<span class="badge ${/^-/.test(p.badge) ? '' : 'badge-neutral'}">${escapeHtml(p.badge)}</span>` : ''}
        ${icon(p.icon)}
      </a>
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
      <a class="category" href="shop.html#${c.id}">
        ${icon(c.icon)}
        <strong>${escapeHtml(c.name)}</strong>
        <span>${escapeHtml(c.desc)}</span>
        <span class="muted">${PRODUCTS.filter((p) => p.category === c.id).length} produktów</span>
      </a>`
    ).join('');
  }
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

  document.querySelector('[data-sort]')?.addEventListener('change', (e) => {
    state.sort = e.target.value;
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
    <div class="product-media">${icon(p.icon)}</div>
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
    toast('Dodano do koszyka');
  });

  const related = document.querySelector('[data-grid="related"]');
  if (related) {
    renderGrid(
      related,
      PRODUCTS.filter((x) => x.category === p.category && x.id !== p.id).slice(0, 4)
    );
  }
}

/* ---------- Koszyk ---------- */
function initCart() {
  const root = document.querySelector('[data-cart-root]');
  if (!root) return;

  let discount = 0;
  let couponCode = '';

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

    const subtotal = Cart.subtotal();
    const discountValue = subtotal * discount;
    const afterDiscount = subtotal - discountValue;
    const shipping = afterDiscount >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FLAT;

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
                <div class="cart-item-media">${icon(p.icon)}</div>
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
        </section>

        <aside class="summary">
          <h2>Podsumowanie</h2>
          <div class="summary-row"><span>Wartość produktów</span><span>${money(subtotal)}</span></div>
          ${discount ? `<div class="summary-row"><span>Rabat · ${escapeHtml(couponCode)}</span><span>−${money(discountValue)}</span></div>` : ''}
          <div class="summary-row"><span>Dostawa</span><span>${shipping === 0 ? 'Gratis' : money(shipping)}</span></div>
          ${
            shipping > 0
              ? `<p class="summary-note">Do darmowej dostawy brakuje ${money(FREE_SHIPPING_FROM - afterDiscount)}.</p>`
              : ''
          }
          <form class="coupon" data-coupon>
            <input type="text" placeholder="Kod rabatowy" aria-label="Kod rabatowy" value="${escapeHtml(couponCode)}">
            <button class="btn btn-ghost btn-sm" type="submit">Zastosuj</button>
          </form>
          <div class="summary-row total"><span>Razem</span><span>${money(afterDiscount + shipping)}</span></div>
          <button class="btn btn-block" style="margin-top:18px" data-checkout>Do kasy</button>
          <p class="summary-note" style="text-align:center">Darmowy zwrot w 30 dni</p>
        </aside>
      </div>`;
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
    if (e.target.closest('[data-checkout]')) {
      toast('Podłącz tu swój checkout / bramkę płatności');
    }
  });

  root.addEventListener('change', (e) => {
    const input = e.target.closest('[data-qty-input]');
    if (input) Cart.setQty(input.dataset.qtyInput, parseInt(input.value, 10) || 0);
  });

  root.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-coupon]');
    if (!form) return;
    e.preventDefault();
    const code = form.querySelector('input').value.trim().toUpperCase();
    if (COUPONS[code]) {
      discount = COUPONS[code];
      couponCode = code;
      toast(`Kod ${code} zastosowany`);
    } else {
      discount = 0;
      couponCode = '';
      toast('Nieprawidłowy kod rabatowy');
    }
    render();
  });

  document.addEventListener('cart:change', render);
  render();
}

/* ---------- Spięcie globalne ---------- */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-add]');
  if (!btn) return;
  Cart.add(btn.dataset.add, 1);
  toast('Dodano do koszyka');
});

document.addEventListener('cart:change', refreshCartBadge);

document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('[data-icon]').forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
  });

  // Sesja przed katalogiem: klient Supabase powstaje raz, a zapytania
  // o produkty lecą już z tokenem — RLS widzi rolę zalogowanego konta.
  // Oba wywołania idą po kolei, żeby nie zbudować dwóch klientów naraz.
  await Auth.load();
  await Catalog.load();
  refreshCartBadge();
  initAccountMenu();
  initAdmin();
  initHome();
  initShop();
  initProduct();
  initCart();
  initLogin();
  initAccountPage();

  document.querySelector('[data-newsletter]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    toast('Dziękujemy za zapis');
    e.target.reset();
  });

  // preselekcja kategorii z #hash (linki z kafelków na stronie głównej)
  const hash = location.hash.slice(1);
  if (hash) document.querySelector(`[data-filter="${CSS.escape(hash)}"]`)?.click();
});
