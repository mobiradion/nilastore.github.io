/* =========================================================
   Nila Store — client-side demo marketplace
   All data is local; cart persists via localStorage.
   ========================================================= */

const img = (seed, size = 400) => `https://picsum.photos/seed/${seed}/${size}/${size}`;

const CATEGORIES = [
  { id: "mobiles",     label: "Mobiles",        emoji: "📱", color: "#EEF1FF" },
  { id: "electronics", label: "Electronics",    emoji: "💻", color: "#E8F8F1" },
  { id: "mens",        label: "Men's",          emoji: "👔", color: "#FFF6E0",
    subcats: [
      { id: "shirts",  label: "Shirts" },
      { id: "pants",   label: "Pants" },
      { id: "tshirts", label: "T-Shirts" },
    ] },
  { id: "womens",      label: "Women's",        emoji: "👗", color: "#FDEDEC",
    subcats: [
      { id: "silk-sarees",   label: "Silk Sarees" },
      { id: "cotton-sarees", label: "Cotton Sarees" },
      { id: "kurtis",        label: "Kurtis" },
      { id: "poonam-sarees", label: "Poonam Sarees" },
    ] },
  { id: "home",        label: "Home & Kitchen", emoji: "🛋️", color: "#E9F6FF" },
  { id: "beauty",      label: "Beauty",         emoji: "💄", color: "#F3ECFF" },
  { id: "health",      label: "Health",         emoji: "💊", color: "#E9FBF0" },
];

let PRODUCTS = [
  // Mobiles
  { id: "m1", cat: "mobiles", brand: "Novatel", title: "Nova X12 5G (8GB RAM, 128GB, Midnight Blue)", price: 15999, mrp: 24999, rating: 4.3, reviews: 8342, img: img("nova-x12"), deal: true },
  { id: "m2", cat: "mobiles", brand: "Pixelio", title: "Pixelio Air 5 (12GB RAM, 256GB, Storm Grey)", price: 28999, mrp: 36999, rating: 4.5, reviews: 5211, img: img("pixelio-air5") },
  { id: "m3", cat: "mobiles", brand: "Orbiq", title: "Orbiq Lite 4G (4GB RAM, 64GB, Coral)", price: 8499, mrp: 10999, rating: 4.0, reviews: 3021, img: img("orbiq-lite"), deal: true },
  { id: "m4", cat: "mobiles", brand: "Novatel", title: "Nova Fold (12GB RAM, 512GB, Onyx Black)", price: 89999, mrp: 109999, rating: 4.6, reviews: 941, img: img("nova-fold") },
  { id: "m5", cat: "mobiles", brand: "Zenphone", title: "Zenphone S3 (6GB RAM, 128GB, Sunrise Gold)", price: 13999, mrp: 17999, rating: 4.1, reviews: 2210, img: img("zenphone-s3") },
  { id: "m6", cat: "mobiles", brand: "Pixelio", title: "Pixelio Nano (6GB RAM, 128GB, Sea Green)", price: 11499, mrp: 15499, rating: 3.9, reviews: 1875, img: img("pixelio-nano") },

  // Electronics
  { id: "e1", cat: "electronics", brand: "Beatbox", title: "Beatbox Pulse Wireless Headphones, 40H Battery", price: 1799, mrp: 3999, rating: 4.2, reviews: 12043, img: img("beatbox-pulse"), deal: true },
  { id: "e2", cat: "electronics", brand: "Streamline", title: "Streamline 43\" 4K Smart LED TV", price: 22990, mrp: 34990, rating: 4.4, reviews: 3987, img: img("streamline-tv") },
  { id: "e3", cat: "electronics", brand: "CoreTech", title: "CoreTech AirBook 14\" Laptop (i5, 16GB, 512GB SSD)", price: 52999, mrp: 64999, rating: 4.5, reviews: 1654, img: img("coretech-airbook") },
  { id: "e4", cat: "electronics", brand: "Beatbox", title: "Beatbox Boom Portable Bluetooth Speaker", price: 1299, mrp: 2299, rating: 4.1, reviews: 6720, img: img("beatbox-boom"), deal: true },
  { id: "e5", cat: "electronics", brand: "Pixelio", title: "Pixelio Watch Fit 2 (Smartwatch, GPS)", price: 3499, mrp: 5999, rating: 4.0, reviews: 4102, img: img("pixelio-watch") },
  { id: "e6", cat: "electronics", brand: "CoreTech", title: "CoreTech PowerBank 20000mAh Fast Charge", price: 999, mrp: 1799, rating: 4.3, reviews: 9021, img: img("coretech-powerbank") },

  // Men's — Shirts
  { id: "mn1", cat: "mens", subcat: "shirts", brand: "Urban Weave", title: "Men's Slim Fit Cotton Casual Shirt", price: 599, mrp: 1499, rating: 4.0, reviews: 2310, img: img("urbanweave-shirt"), deal: true },
  { id: "mn2", cat: "mens", subcat: "shirts", brand: "Urban Weave", title: "Men's Checked Formal Shirt, Full Sleeve", price: 749, mrp: 1699, rating: 4.2, reviews: 1543, img: img("urbanweave-checkshirt") },

  // Men's — Pants
  { id: "mn3", cat: "mens", subcat: "pants", brand: "Urban Weave", title: "Men's Slim Fit Denim Jeans", price: 899, mrp: 1999, rating: 4.1, reviews: 3305, img: img("urbanweave-jeans") },
  { id: "mn4", cat: "mens", subcat: "pants", brand: "Stridewell", title: "Men's Regular Fit Formal Trousers", price: 799, mrp: 1799, rating: 4.0, reviews: 987, img: img("stridewell-trousers"), deal: true },

  // Men's — T-Shirts
  { id: "mn5", cat: "mens", subcat: "tshirts", brand: "Stridewell", title: "Men's Round Neck Cotton T-Shirt, Pack of 2", price: 499, mrp: 999, rating: 4.3, reviews: 5210, img: img("stridewell-tshirt") },
  { id: "mn6", cat: "mens", subcat: "tshirts", brand: "Urban Weave", title: "Men's Polo T-Shirt, Pique Cotton", price: 649, mrp: 1299, rating: 4.1, reviews: 2109, img: img("urbanweave-polo"), deal: true },

  // Women's — Silk Sarees
  { id: "wm1", cat: "womens", subcat: "silk-sarees", brand: "Saanvi", title: "Kanjivaram Silk Saree with Zari Border", price: 3499, mrp: 6999, rating: 4.6, reviews: 812, img: img("saanvi-kanjivaram") },
  { id: "wm2", cat: "womens", subcat: "silk-sarees", brand: "Saanvi", title: "Banarasi Silk Saree, Woven Design", price: 2999, mrp: 5999, rating: 4.5, reviews: 654, img: img("saanvi-banarasi"), deal: true },

  // Women's — Cotton Sarees
  { id: "wm3", cat: "womens", subcat: "cotton-sarees", brand: "Saanvi", title: "Handloom Cotton Saree, Everyday Wear", price: 899, mrp: 1799, rating: 4.3, reviews: 1980, img: img("saanvi-handloom") },
  { id: "wm4", cat: "womens", subcat: "cotton-sarees", brand: "Saanvi", title: "Chettinad Cotton Saree, Checked Pattern", price: 1099, mrp: 2199, rating: 4.4, reviews: 1342, img: img("saanvi-chettinad"), deal: true },

  // Women's — Kurtis
  { id: "wm5", cat: "womens", subcat: "kurtis", brand: "Saanvi", title: "Women's Printed A-Line Kurta", price: 749, mrp: 1899, rating: 4.3, reviews: 4109, img: img("saanvi-kurta") },
  { id: "wm6", cat: "womens", subcat: "kurtis", brand: "Saanvi", title: "Women's Anarkali Kurti, Embroidered", price: 1099, mrp: 2399, rating: 4.2, reviews: 2033, img: img("saanvi-anarkali") },

  // Women's — Poonam Sarees
  { id: "wm7", cat: "womens", subcat: "poonam-sarees", brand: "Poonam Sarees", title: "Poonam Sarees Georgette Saree, Floral Print", price: 1299, mrp: 2599, rating: 4.4, reviews: 1120, img: img("poonam-georgette"), deal: true },
  { id: "wm8", cat: "womens", subcat: "poonam-sarees", brand: "Poonam Sarees", title: "Poonam Sarees Designer Party Wear Saree", price: 1899, mrp: 3799, rating: 4.5, reviews: 764, img: img("poonam-designer") },

  // Home & Kitchen
  { id: "h1", cat: "home", brand: "Homery", title: "Non-Stick Cookware Set, 5 Pieces", price: 1499, mrp: 2999, rating: 4.3, reviews: 2871, img: img("homery-cookware"), deal: true },
  { id: "h2", cat: "home", brand: "CozyNest", title: "Memory Foam Pillow, Pack of 2", price: 799, mrp: 1599, rating: 4.1, reviews: 4021, img: img("cozynest-pillow") },
  { id: "h3", cat: "home", brand: "Homery", title: "Stainless Steel Insulated Water Bottle, 1L", price: 399, mrp: 799, rating: 4.5, reviews: 7654, img: img("homery-bottle") },
  { id: "h4", cat: "home", brand: "BrightHome", title: "LED Study Lamp with Adjustable Arm", price: 549, mrp: 1199, rating: 4.0, reviews: 1230, img: img("brighthome-lamp"), deal: true },
  { id: "h5", cat: "home", brand: "CozyNest", title: "Cotton Bedsheet Set, Queen Size (King Fits Too)", price: 899, mrp: 2199, rating: 4.2, reviews: 3410, img: img("cozynest-bedsheet") },
  { id: "h6", cat: "home", brand: "Homery", title: "Compact Storage Organizer, 3 Tier", price: 699, mrp: 1399, rating: 3.9, reviews: 845, img: img("homery-organizer") },

  // Beauty
  { id: "b1", cat: "beauty", brand: "Petalskin", title: "Vitamin C Brightening Face Serum, 30ml", price: 449, mrp: 899, rating: 4.4, reviews: 5601, img: img("petalskin-serum"), deal: true },
  { id: "b2", cat: "beauty", brand: "Meraki", title: "Matte Finish Lipstick Combo, Set of 3", price: 599, mrp: 1299, rating: 4.2, reviews: 2980, img: img("meraki-lipstick") },
  { id: "b3", cat: "beauty", brand: "Petalskin", title: "Aloe Hydrating Face Wash, 150ml", price: 249, mrp: 449, rating: 4.3, reviews: 6120, img: img("petalskin-facewash") },
  { id: "b4", cat: "beauty", brand: "Meraki", title: "Argan Oil Hair Serum, 100ml", price: 349, mrp: 699, rating: 4.1, reviews: 1876, img: img("meraki-hairoil"), deal: true },
  { id: "b5", cat: "beauty", brand: "Petalskin", title: "SPF 50 Sunscreen Gel, 75g", price: 399, mrp: 799, rating: 4.5, reviews: 3320, img: img("petalskin-sunscreen") },

  // Health
  { id: "he1", cat: "health", brand: "VitaCare", title: "Multivitamin Tablets, 60 Count", price: 349, mrp: 599, rating: 4.4, reviews: 3140, img: img("vitacare-multivitamin"), deal: true },
  { id: "he2", cat: "health", brand: "WellnessPro", title: "Whey Protein Powder, 1kg, Chocolate", price: 1899, mrp: 2799, rating: 4.5, reviews: 5210, img: img("wellnesspro-whey") },
  { id: "he3", cat: "health", brand: "MediSafe", title: "Digital Infrared Thermometer", price: 799, mrp: 1299, rating: 4.3, reviews: 2870, img: img("medisafe-thermometer") },
  { id: "he4", cat: "health", brand: "MediSafe", title: "Hand Sanitizer, 500ml, Pack of 3", price: 299, mrp: 499, rating: 4.2, reviews: 4021, img: img("medisafe-sanitizer"), deal: true },
  { id: "he5", cat: "health", brand: "VitaCare", title: "Immunity Booster Effervescent Tablets", price: 399, mrp: 699, rating: 4.1, reviews: 1980, img: img("vitacare-immunity") },
  { id: "he6", cat: "health", brand: "MediSafe", title: "Compact First Aid Kit, 40 Pieces", price: 549, mrp: 999, rating: 4.4, reviews: 1230, img: img("medisafe-firstaid") },
];

/* ============ State ============ */
// Robust persisted state with basic validation
let cart = {};
// PRODUCTS are loaded from an external JSON file to make data maintenance easier.
const WHATSAPP_NUMBER = '918610769343';
async function loadProducts() {
  try {
    const res = await fetch('data/products.json');
    if (!res.ok) throw new Error('Failed to fetch products');
    PRODUCTS = await res.json();
  } catch (err) {
    console.error('Could not load data/products.json —', err);
    // Keep the embedded product list as a fallback.
  }
}

const CART_KEY = 'nila-store-cart';
const WISHLIST_KEY = 'nila-store-wishlist';
let wishlist = new Set();
let lastFocusedElement = null;
let removeFocusTrap = null;

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function rupee(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function pctOff(product) {
  if (!product.mrp || product.price >= product.mrp) return 0;
  return Math.round(((product.mrp - product.price) / product.mrp) * 100);
}

function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    // ignore storage failures in private mode
  }
}

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const data = raw ? JSON.parse(raw) : {};
    cart = data && typeof data === 'object' ? data : {};
  } catch {
    cart = {};
  }
}

function saveWishlist() {
  try {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify([...wishlist]));
  } catch {
    // ignore storage failures
  }
}

function loadWishlist() {
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    const data = raw ? JSON.parse(raw) : [];
    wishlist = new Set(Array.isArray(data) ? data : []);
  } catch {
    wishlist = new Set();
  }
}

function toggleWishlist(id, button) {
  if (!id) return;
  if (wishlist.has(id)) {
    wishlist.delete(id);
    showToast('Removed from wishlist');
  } else {
    wishlist.add(id);
    showToast('Added to wishlist');
  }
  saveWishlist();
  updateWishlistCount();
  document.querySelectorAll(`[data-wish="${id}"], [data-modal-wish="${id}"]`).forEach(btn => {
    btn.classList.toggle('active', wishlist.has(id));
  });
  if (document.getElementById('wishlistDrawer')?.classList.contains('open')) {
    renderWishlist();
  }
}

function trapFocus(container) {
  const focusable = Array.from(container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter(el => el.offsetParent !== null);
  if (!focusable.length) return () => {};

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const handler = (event) => {
    if (event.key !== 'Tab') return;
    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  container.addEventListener('keydown', handler);
  return () => container.removeEventListener('keydown', handler);
}

function openModal(targetId) {
  const overlay = document.getElementById('modalOverlay');
  const modalEl = document.getElementById('productModal');
  if (!overlay || !modalEl) return;

  const product = PRODUCTS.find((p) => p.id === targetId);
  const title = product ? product.title : 'Product preview';
  const brand = product ? product.brand : 'Nila Store';
  const price = product ? rupee(product.price) : '—';
  const mrp = product && product.mrp ? rupee(product.mrp) : '';
  const off = product ? pctOff(product) : 0;
  const rating = product ? product.rating.toFixed(1) : '0.0';
  const reviews = product ? product.reviews.toLocaleString('en-IN') : '0';
  const image = product ? product.img : `https://picsum.photos/seed/${esc(targetId)}/500/500`;

  overlay.classList.add('open');
  modalEl.setAttribute('aria-hidden', 'false');
  modalEl.innerHTML = `
    <div class="modal-inner">
      <div class="modal-media">
        <button type="button" class="modal-close" aria-label="Close product preview">✕</button>
        <img src="${image}" alt="${esc(title)}" width="500" height="500" loading="eager" decoding="async">
      </div>
      <div class="modal-info">
        <div class="modal-header">
          <div>
            <span class="modal-brand">${esc(brand)}</span>
            <h2 class="modal-title">${esc(title)}</h2>
          </div>
          <div class="modal-rating">${rating} ★ <span>(${reviews})</span></div>
        </div>
        <div class="modal-price-row">
          <span class="price-now">${price}</span>
          ${off > 0 ? `<span class="price-was">${mrp}</span><span class="price-off">${off}% off</span>` : ''}
        </div>
        <p class="modal-copy">Fast delivery across Chennai. Add your address at checkout and receive WhatsApp order confirmation instantly.</p>
        <div class="modal-actions">
          <button class="btn btn-primary" data-modal-add="${targetId}">Add to cart</button>
          <button class="btn btn-outline" data-modal-wish="${targetId}">${wishlist.has(targetId) ? 'Remove wishlist' : 'Add to wishlist'}</button>
        </div>
      </div>
    </div>`;

  if (removeFocusTrap) { removeFocusTrap(); removeFocusTrap = null; }
  lastFocusedElement = document.activeElement;
  removeFocusTrap = trapFocus(modalEl);
  modalEl.focus?.();
}

function closeModal() {
  const overlay = document.getElementById("modalOverlay");
  const modalEl = document.getElementById("productModal");
  if (overlay) overlay.classList.remove("open");
  if (modalEl) modalEl.setAttribute('aria-hidden', 'true');
  if (removeFocusTrap) { removeFocusTrap(); removeFocusTrap = null; }
  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') lastFocusedElement.focus();
}

function renderCategoryChrome() {
  const rail = document.getElementById("categoryRail");
  if (!rail) return;

  rail.innerHTML = CATEGORIES.map(c => {
    const hasSub = Array.isArray(c.subcats) && c.subcats.length > 0;
    return `
      <div class="cat-chip-wrap" data-parent="${c.id}">
        <button type="button" class="cat-chip${hasSub ? " has-sub" : ""}" aria-expanded="false">
          <span class="emoji">${c.emoji}</span>
          ${c.label}
          ${hasSub ? '<span class="chevron">▾</span>' : ""}
        </button>
        ${hasSub ? `
          <div class="cat-dropdown">
            ${c.subcats.map(s => `<a href="#cat-${c.id}-${s.id}" data-sub="${s.id}">${s.label}</a>`).join("")}
          </div>` : ""}
      </div>`;
  }).join("");

  const wraps = rail.querySelectorAll(".cat-chip-wrap");
  wraps.forEach(wrap => {
    const btn = wrap.querySelector(".cat-chip");
    const dropdown = wrap.querySelector(".cat-dropdown");
    if (!btn || !dropdown) return;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = wrap.classList.contains("open");
      wraps.forEach(w => w.classList.remove("open"));
      if (!isOpen) {
        positionDropdown(btn, dropdown);
        wrap.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      } else {
        btn.setAttribute("aria-expanded", "false");
      }
    });

    wrap.querySelectorAll(".cat-dropdown a").forEach(a => {
      a.addEventListener("click", () => {
        setActiveChip(btn);
        wrap.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
        const target = document.getElementById(`cat-${a.dataset.sub}`);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  });

  document.addEventListener("click", () => {
    wraps.forEach(w => w.classList.remove("open"));
    rail.querySelectorAll(".cat-chip").forEach(btn => btn.setAttribute("aria-expanded", "false"));
  });
  window.addEventListener("scroll", () => wraps.forEach(w => w.classList.remove("open")), { passive: true });
  window.addEventListener("resize", () => wraps.forEach(w => w.classList.remove("open")));

  function positionDropdown(btn, dropdown) {
    const rect = btn.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom + 8}px`;
    let left = rect.left;
    const maxLeft = window.innerWidth - 210; // keep within viewport (dropdown min-width 190 + margin)
    if (left > maxLeft) left = Math.max(8, maxLeft);
    dropdown.style.left = `${left}px`;
  }

  function setActiveChip(btn) {
    rail.querySelectorAll(".cat-chip").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  }

  const tileGrid = document.getElementById("tileGrid");
  tileGrid.innerHTML = CATEGORIES.map(c => `
    <a class="tile" href="#cat-${c.id}">
      <div class="tile-icon" style="background:${c.color}">${c.emoji}</div>
      <span class="tile-label">${c.label}</span>
    </a>`).join("");

  document.getElementById("mobileNavList").innerHTML = CATEGORIES.map(c => {
    if (c.subcats) {
      return `
        <div class="mobile-nav-group">
          <a href="#cat-${c.id}" class="mobile-nav-link mobile-nav-parent"><span class="emoji">${c.emoji}</span> ${c.label}</a>
          <div class="mobile-nav-sublist">
            ${c.subcats.map(s => `<a href="#cat-${c.id}-${s.id}" class="mobile-nav-link mobile-nav-sub">${s.label}</a>`).join("")}
          </div>
        </div>`;
    }
    return `<a href="#cat-${c.id}" class="mobile-nav-link"><span class="emoji">${c.emoji}</span> ${c.label}</a>`;
  }).join("");
  document.querySelectorAll(".mobile-nav-link").forEach(a => a.addEventListener("click", closeMobileNav));
}

/* ============ Product card ============ */
function productCard(p) {
  const off = pctOff(p);
  const isWished = wishlist.has(p.id);
  return `
    <article class="card" data-id="${p.id}">
      <div class="card-media" data-open="${p.id}">
        ${off > 0 ? `<span class="discount-tag">${off}% OFF</span>` : ""}
        <button type="button" class="wishlist-btn ${isWished ? "active" : ""}" data-wish="${p.id}" aria-label="Toggle wishlist">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${isWished ? 'currentColor' : 'none'}"><path d="M12 21s-7.5-4.6-10-9.3C.4 8 2 4.5 5.6 4.1 8 3.8 10 5 12 7.5 14 5 16 3.8 18.4 4.1 22 4.5 23.6 8 22 11.7 19.5 16.4 12 21 12 21z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
        </button>
        <img src="${p.img}" alt="${esc(p.title)}" loading="lazy" width="400" height="400" decoding="async">
      </div>
      <div class="card-body">
        <span class="card-brand">${esc(p.brand)}</span>
        <span class="card-title" data-open="${p.id}">${esc(p.title)}</span>
        <span class="card-rating"><span class="rating-badge">${p.rating} ★</span> (${p.reviews.toLocaleString("en-IN")})</span>
        <div class="card-price-row">
          <span class="price-now">${rupee(p.price)}</span>
          ${off > 0 ? `<span class="price-was">${rupee(p.mrp)}</span><span class="price-off">${off}% off</span>` : ""}
        </div>
        <div class="card-actions">
          <button class="btn btn-primary btn-sm" data-add="${p.id}">Add to cart</button>
        </div>
      </div>
    </article>`;
}

function attachCardEvents(root) {
  root.querySelectorAll("[data-add]").forEach(btn =>
    btn.addEventListener("click", (e) => { e.stopPropagation(); addToCart(btn.dataset.add); }));
  root.querySelectorAll("[data-wish]").forEach(btn =>
    btn.addEventListener("click", (e) => { e.stopPropagation(); toggleWishlist(btn.dataset.wish, btn); }));
  root.querySelectorAll("[data-open]").forEach(el =>
    el.addEventListener("click", () => openModal(el.dataset.open)));
}

/* ============ Deals row ============ */
function renderDeals() {
  const deals = PRODUCTS.filter(p => p.deal);
  const row = document.getElementById("dealsRow");
  row.innerHTML = deals.map(productCard).join("");
  // Events handled via delegation
}

/* ============ Category sections ============ */
function renderCategorySections() {
  const container = document.getElementById("categorySections");
  container.innerHTML = CATEGORIES.map(c => {
    if (c.subcats) {
      const total = PRODUCTS.filter(p => p.cat === c.id).length;
      return `
        <section class="cat-section" id="cat-${c.id}">
          <div class="wrap">
            <div class="section-head">
              <div>
                <h2>${c.emoji} ${c.label}</h2>
                <p class="section-sub">${total} handpicked products across ${c.subcats.length} collections</p>
              </div>
            </div>
            ${c.subcats.map(s => {
              const items = PRODUCTS.filter(p => p.cat === c.id && p.subcat === s.id);
              if (!items.length) return "";
              return `
                <div class="subcat-block" id="cat-${c.id}-${s.id}">
                  <h3 class="subcat-title">${s.label}</h3>
                  <div class="product-grid">${items.map(productCard).join("")}</div>
                </div>`;
            }).join("")}
          </div>
        </section>`;
    }
    const items = PRODUCTS.filter(p => p.cat === c.id);
    return `
      <section class="cat-section" id="cat-${c.id}">
        <div class="wrap">
          <div class="section-head">
            <div>
              <h2>${c.emoji} ${c.label}</h2>
              <p class="section-sub">${items.length} handpicked products</p>
            </div>
            <a href="#" class="btn btn-outline">View all</a>
          </div>
          <div class="product-grid">${items.map(productCard).join("")}</div>
        </div>
      </section>`;
  }).join("");
  // Events handled via delegation
}

/* ============ Hero carousel ============ */
const SLIDES = [
  { eyebrow: "Big Billion Days", title: "Up to 70% off on Mobiles", sub: "Trade in your old phone & save even more.", cta: "Shop mobiles", bg: "linear-gradient(120deg,#2A4DE0,#5A73F0)", img: img("hero-mobile", 500) },
  { eyebrow: "New Season", title: "Men's & Women's styles from ₹499", sub: "Shirts, sarees, kurtis & more — fresh arrivals every week.", cta: "Explore Women's", bg: "linear-gradient(120deg,#E1483F,#FF7A6E)", img: img("hero-fashion", 500) },
  { eyebrow: "Home Refresh", title: "Kitchen & home up to 60% off", sub: "Everything you need to upgrade your space.", cta: "Shop home", bg: "linear-gradient(120deg,#17A673,#4FD9A9)", img: img("hero-home", 500) },
];

let carIndex = 0, carTimer;
function renderCarousel() {
  const track = document.getElementById("carouselTrack");
  const dots = document.getElementById("carDots");
  track.innerHTML = SLIDES.map((s,i) => `
    <div class="slide" style="background:${s.bg}">
      <div class="slide-copy">
        <span class="slide-eyebrow">${esc(s.eyebrow)}</span>
        <h1 class="slide-title">${esc(s.title)}</h1>
        <p class="slide-sub">${esc(s.sub)}</p>
        <a href="#" class="slide-cta">${esc(s.cta)} →</a>
      </div>
      <div class="slide-visual"><img src="${s.img}" alt="${esc(s.title)}" width="500" height="500" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async"></div>
    </div>`).join("");
  dots.innerHTML = SLIDES.map((_, i) => `<button data-i="${i}" class="${i === 0 ? 'active' : ''}"></button>`).join("");
  dots.querySelectorAll("button").forEach(b => b.addEventListener("click", () => goToSlide(+b.dataset.i)));
  document.getElementById("carPrev").addEventListener("click", () => goToSlide(carIndex - 1));
  document.getElementById("carNext").addEventListener("click", () => goToSlide(carIndex + 1));
  startCarouselAuto();
}
function goToSlide(i) {
  carIndex = (i + SLIDES.length) % SLIDES.length;
  document.getElementById("carouselTrack").style.transform = `translateX(-${carIndex * 100}%)`;
  document.querySelectorAll(".carousel-dots button").forEach((b, idx) => b.classList.toggle("active", idx === carIndex));
  startCarouselAuto();
}
function startCarouselAuto() {
  clearInterval(carTimer);
  carTimer = setInterval(() => goToSlide(carIndex + 1), 5000);
}

/* ============ Countdown ============ */
function startCountdown() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const el = document.getElementById("countdownClock");
  function tick() {
    const diff = Math.max(0, end - new Date());
    const h = String(Math.floor(diff / 3.6e6)).padStart(2, "0");
    const m = String(Math.floor((diff % 3.6e6) / 6e4)).padStart(2, "0");
    const s = String(Math.floor((diff % 6e4) / 1000)).padStart(2, "0");
    el.textContent = `${h}:${m}:${s}`;
  }
  tick();
  setInterval(tick, 1000);
}

/* ============ Cart ============ */
function addToCart(id, qty = 1) {
  cart[id] = (cart[id] || 0) + qty;
  saveCart();
  renderCart();
  showToast("Added to cart 🛒");
  openCart();
}
function updateQty(id, delta) {
  if (!cart[id]) return;
  cart[id] += delta;
  if (cart[id] <= 0) delete cart[id];
  saveCart();
  renderCart();
}
function removeFromCart(id) {
  delete cart[id];
  saveCart();
  renderCart();
}
function renderCart() {
  const ids = Object.keys(cart);
  const body = document.getElementById("cartBody");
  const foot = document.getElementById("cartFoot");
  const countEl = document.getElementById("cartCount");
  const totalQty = ids.reduce((s, id) => s + cart[id], 0);
  countEl.textContent = totalQty;
  countEl.style.display = totalQty > 0 ? "flex" : "none";

  if (ids.length === 0) {
    body.innerHTML = `<div class="cart-empty"><div class="big-emoji">🛒</div><h3>Your cart is empty</h3><p>Add something you love.</p></div>`;
    foot.style.display = "none";
    return;
  }
  foot.style.display = "block";
  let subtotal = 0;
  body.innerHTML = ids.map(id => {
    const p = PRODUCTS.find(x => x.id === id);
    const qty = cart[id];
    subtotal += p.price * qty;
    return `
      <div class="cart-item">
        <img src="${p.img}" alt="${esc(p.title)}" width="64" height="64" decoding="async">
        <div class="cart-item-info">
          <div class="cart-item-title">${esc(p.title)}</div>
          <div class="cart-item-price">${rupee(p.price)}</div>
          <div class="qty-row">
            <button class="qty-btn" data-dec="${id}">−</button>
            <span>${qty}</span>
            <button class="qty-btn" data-inc="${id}">+</button>
            <button class="remove-link" data-remove="${id}">Remove</button>
          </div>
        </div>
      </div>`;
  }).join("");
  document.getElementById("cartSubtotal").textContent = rupee(subtotal);

  body.querySelectorAll("[data-inc]").forEach(b => b.addEventListener("click", () => updateQty(b.dataset.inc, 1)));
  body.querySelectorAll("[data-dec]").forEach(b => b.addEventListener("click", () => updateQty(b.dataset.dec, -1)));
  body.querySelectorAll("[data-remove]").forEach(b => b.addEventListener("click", () => removeFromCart(b.dataset.remove)));
}

function updateWishlistCount() {
  const badge = document.getElementById('wishlistCount');
  if (!badge) return;
  badge.textContent = wishlist.size;
  badge.style.display = wishlist.size > 0 ? 'inline-flex' : 'none';
}

function renderWishlist() {
  const body = document.getElementById('wishlistBody');
  if (!body) return;
  const items = PRODUCTS.filter((p) => wishlist.has(p.id));
  if (!items.length) {
    body.innerHTML = `<div class="empty-state"><div class="big-emoji">💗</div><h3>Your wishlist is empty</h3><p>Add items by tapping the heart icon on any product.</p></div>`;
    return;
  }

  body.innerHTML = items.map((p) => `
    <div class="cart-item">
      <img src="${p.img}" alt="${esc(p.title)}" width="64" height="64" decoding="async">
      <div class="cart-item-info">
        <div class="cart-item-title">${esc(p.title)}</div>
        <div class="cart-item-price">${rupee(p.price)}</div>
        <div class="qty-row">
          <button class="qty-btn" data-add="${p.id}">Add to cart</button>
          <button class="remove-link" data-remove-wish="${p.id}">Remove</button>
        </div>
      </div>
    </div>`).join('');
}

function openCart() {
  const drawer = document.getElementById("cartDrawer");
  const overlay = document.getElementById("drawerOverlay");
  drawer.classList.add("open");
  overlay.classList.add("open");
  drawer.setAttribute('aria-hidden', 'false');
  lastFocusedElement = document.activeElement;
  if (removeFocusTrap) { removeFocusTrap(); removeFocusTrap = null; }
  removeFocusTrap = trapFocus(drawer);
  const closeBtn = document.getElementById('cartClose'); if (closeBtn) closeBtn.focus();
}
function closeCart() {
  const drawer = document.getElementById("cartDrawer");
  const overlay = document.getElementById("drawerOverlay");
  drawer.classList.remove("open");
  overlay.classList.remove("open");
  drawer.setAttribute('aria-hidden', 'true');
   closeCheckoutPanel();
   if (removeFocusTrap) { removeFocusTrap(); removeFocusTrap = null; }
   if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') lastFocusedElement.focus();
 }

function openWishlist() {
  const drawer = document.getElementById('wishlistDrawer');
  const overlay = document.getElementById('drawerOverlay');
  if (!drawer || !overlay) return;
  renderWishlist();
  drawer.classList.add('open');
  overlay.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  lastFocusedElement = document.activeElement;
  if (removeFocusTrap) { removeFocusTrap(); removeFocusTrap = null; }
  removeFocusTrap = trapFocus(drawer);
  const closeBtn = document.getElementById('wishlistClose'); if (closeBtn) closeBtn.focus();
}

function closeWishlist() {
  const drawer = document.getElementById('wishlistDrawer');
  const overlay = document.getElementById('drawerOverlay');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  if (drawer) drawer.setAttribute('aria-hidden', 'true');
  if (removeFocusTrap) { removeFocusTrap(); removeFocusTrap = null; }
  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') lastFocusedElement.focus();
 }
 
function openCheckoutPanel() {
  renderCart();
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('drawerOverlay');
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (drawer) {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
  }
  if (overlay) {
    overlay.classList.add('open');
  }

  const panel = document.getElementById('checkoutPanel');
  if (!panel) {
    console.warn('Checkout panel element not found');
    return;
  }
  panel.style.display = 'block';
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  if (checkoutBtn) checkoutBtn.style.display = 'none';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function closeCheckoutPanel() {
  const panel = document.getElementById('checkoutPanel');
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (!panel) return;
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  panel.style.display = 'none';
  if (checkoutBtn) {
    checkoutBtn.style.display = Object.keys(cart).length > 0 ? 'block' : 'none';
  }
}
 
 function buildWhatsAppMessage(name, phone, address) {
   const cartEntries = Object.entries(cart);
   const items = cartEntries.map(([id, qty]) => {
     const p = PRODUCTS.find(x => x.id === id);
     if (!p) return null;
     return `${qty} x ${p.title} @ ${rupee(p.price)} = ${rupee(p.price * qty)}`;
   }).filter(Boolean);
   const subtotal = cartEntries.reduce((sum, [id, qty]) => {
     const p = PRODUCTS.find(x => x.id === id);
     return p ? sum + p.price * qty : sum;
   }, 0);
   const totalItems = cartEntries.reduce((sum, [, qty]) => sum + qty, 0);
   const message = `Hello Nila Store, I would like to place an order.\n\nName: ${name}\nPhone: ${phone}\nAddress: ${address}\n\nOrder details:\n${items.join('\n')}\n\nTotal items: ${totalItems}\nSubtotal: ${rupee(subtotal)}\n\nPlease confirm availability and delivery details.`;
   return encodeURIComponent(message);
 }
 
 function showOrderConfirmation() {
   const body = document.getElementById('cartBody');
   const foot = document.getElementById('cartFoot');
   if (!body || !foot) return;
   body.innerHTML = `
     <div class="cart-empty">
       <div class="big-emoji">✅</div>
       <h3>Your order has been placed</h3>
       <p>We redirected you to WhatsApp. This drawer will close in a few seconds.</p>
       <button class="btn btn-primary btn-block" data-action="continue-shopping">Continue shopping</button>
     </div>`;
   foot.style.display = 'none';
 }
 
 function sendCheckoutWhatsApp(event) {
   event.preventDefault();
   const name = document.getElementById('checkoutName')?.value.trim();
   const address = document.getElementById('checkoutAddress')?.value.trim();
   const phone = document.getElementById('checkoutPhone')?.value.trim();
   if (!name || !address || !phone) {
     showToast('Please complete the address and phone fields.');
     return;
   }
   const cartItems = Object.keys(cart);
   if (!cartItems.length) {
     showToast('Your cart is empty. Add items before checkout.');
     return;
   }
   const text = buildWhatsAppMessage(name, phone, address);
   const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
   window.open(url, '_blank');
   cart = {};
   saveCart();
   renderCart();
   closeCheckoutPanel();
   showOrderConfirmation();
   showToast('Your order placed');
   setTimeout(() => {
     if (document.getElementById('cartDrawer')?.classList.contains('open')) {
       closeCart();
     }
   }, 5000);
 }
 function closeModal() {
  const overlay = document.getElementById("modalOverlay");
  const modalEl = document.getElementById("productModal");
  overlay.classList.remove("open");
  modalEl.setAttribute('aria-hidden', 'true');
  if (removeFocusTrap) { removeFocusTrap(); removeFocusTrap = null; }
  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') lastFocusedElement.focus();
}

/* ============ Mobile nav ============ */
function openMobileNav() {
  document.getElementById("mobileNav").classList.add("open");
  document.getElementById("mobileNavOverlay").classList.add("open");
}
function closeMobileNav() {
  document.getElementById("mobileNav").classList.remove("open");
  document.getElementById("mobileNavOverlay").classList.remove("open");
}

/* ============ Search ============ */
function runSearch(term) {
  term = term.trim().toLowerCase();
  const mainEl = document.querySelector("main");
  const catContainer = document.getElementById("categorySections");
  const dealSection = document.querySelector(".section-alt");
  const tilesSection = document.querySelectorAll(".section")[0];
  const heroSection = document.querySelector(".hero");
  const trustSection = document.querySelector(".trust-strip");

  if (!term) {
    [catContainer, dealSection, tilesSection, heroSection, trustSection].forEach(s => s && (s.style.display = ""));
    renderCategorySections();
    return;
  }
  [dealSection, tilesSection, heroSection, trustSection].forEach(s => s && (s.style.display = "none"));

  const matches = PRODUCTS.filter(p =>
    p.title.toLowerCase().includes(term) || p.brand.toLowerCase().includes(term) || p.cat.includes(term));

  if (matches.length === 0) {
    catContainer.innerHTML = `<div class="empty-state"><div class="big-emoji">🔍</div><h3>No results for "${esc(term)}"</h3><p>Try a different search term.</p></div>`;
    return;
  }
  catContainer.innerHTML = `
    <section class="cat-section">
      <div class="wrap">
        <div class="section-head"><div><h2>Search results for "${esc(term)}"</h2><p class="section-sub">${matches.length} products found</p></div></div>
        <div class="product-grid">${matches.map(productCard).join("")}</div>
      </div>
    </section>`;
  attachCardEvents(catContainer);
}

/* ============ Toast ============ */
let toastTimer;
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ============ Init ============ */
async function init() {
  loadCart();
  loadWishlist();
  updateWishlistCount();
  // load product data before rendering UI
  await loadProducts();
  renderCategoryChrome();
  renderCarousel();
  renderDeals();
  renderCategorySections();
  renderCart();
  startCountdown();

  // Global event delegation for dynamically generated controls
  document.body.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add], [data-modal-add]');
    if (add) { e.preventDefault(); addToCart(add.dataset.add || add.dataset.modalAdd); return; }
    const wish = e.target.closest('[data-wish], [data-modal-wish]');
    if (wish) { e.preventDefault(); toggleWishlist(wish.dataset.wish || wish.dataset.modalWish, wish); return; }
    const open = e.target.closest('[data-open]');
    if (open) { e.preventDefault(); openModal(open.dataset.open); return; }
    const continueBtn = e.target.closest('[data-action="continue-shopping"]');
    if (continueBtn) { e.preventDefault(); closeCart(); return; }
    const modalClose = e.target.closest('.modal-close');
    if (modalClose) { e.preventDefault(); closeModal(); return; }
    const inc = e.target.closest('[data-inc]');
    if (inc) { e.preventDefault(); updateQty(inc.dataset.inc, 1); return; }
    const dec = e.target.closest('[data-dec]');
    if (dec) { e.preventDefault(); updateQty(dec.dataset.dec, -1); return; }
    const rem = e.target.closest('[data-remove]');
    if (rem) { e.preventDefault(); removeFromCart(rem.dataset.remove); return; }
    const remWish = e.target.closest('[data-remove-wish]');
    if (remWish) { e.preventDefault(); toggleWishlist(remWish.dataset.removeWish, remWish); renderWishlist(); return; }
  });

  document.getElementById("cartToggle").addEventListener("click", openCart);
  document.getElementById("wishlistToggle").addEventListener("click", openWishlist);
  document.getElementById("cartClose").addEventListener("click", closeCart);
  document.getElementById("wishlistClose").addEventListener("click", closeWishlist);
  document.getElementById("drawerOverlay").addEventListener("click", () => { closeCart(); closeWishlist(); closeModalIfOpen(); closeMobileNav(); });
  document.getElementById("modalOverlay").addEventListener("click", (e) => { if (e.target.id === "modalOverlay") closeModal(); });
  document.getElementById("menuToggle").addEventListener("click", openMobileNav);
  document.getElementById("mobileNavClose").addEventListener("click", closeMobileNav);
  document.getElementById("mobileNavOverlay").addEventListener("click", closeMobileNav);
  document.getElementById("checkoutBtn").addEventListener("click", () => {
    renderCart();
    if (Object.keys(cart).length === 0) {
      showToast('Add items to cart before checkout.');
      return;
    }
    openCart();
    openCheckoutPanel();
  });
  document.getElementById('checkoutCancel')?.addEventListener('click', closeCheckoutPanel);
  document.getElementById('checkoutForm')?.addEventListener('submit', sendCheckoutWhatsApp);

  const doSearch = (val) => runSearch(val);
  document.getElementById("searchBtn").addEventListener("click", () => doSearch(document.getElementById("searchInput").value));
  document.getElementById("searchInput").addEventListener("keydown", e => { if (e.key === "Enter") doSearch(e.target.value); });
  document.getElementById("searchBtnMobile").addEventListener("click", () => doSearch(document.getElementById("searchInputMobile").value));
  document.getElementById("searchInputMobile").addEventListener("keydown", e => { if (e.key === "Enter") doSearch(e.target.value); });

  document.getElementById("newsletterForm").addEventListener("submit", (e) => {
    e.preventDefault();
    e.target.reset();
    showToast("Subscribed! Watch your inbox 📬");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeCart(); closeWishlist(); closeModal(); closeMobileNav(); }
  });
}
function closeModalIfOpen() { closeModal(); }

document.addEventListener("DOMContentLoaded", init);