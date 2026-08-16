/* =========================================================
   Nila Store — client-side demo marketplace
   All data is local; cart persists via localStorage.
   ========================================================= */

const img = (seed, size = 400) => `https://picsum.photos/seed/${seed}/${size}/${size}`;

let CATEGORIES = [];
let PRODUCTS = [];

const CATEGORY_ICON_LOOKUP = {
  mobiles: '📱',
  electronics: '💻',
  mens: '👔',
  womens: '👗',
  home: '🛋️',
  beauty: '💄',
  health: '💊',
};

const CATEGORY_COLOR_LOOKUP = {
  mobiles: '#EEF1FF',
  electronics: '#E8F8F1',
  mens: '#FFF6E0',
  womens: '#FDEDEC',
  home: '#E9F6FF',
  beauty: '#F3ECFF',
  health: '#E9FBF0',
};

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function categoryIcon(id) {
  return CATEGORY_ICON_LOOKUP[id] || '🛍️';
}

function categoryColor(id) {
  return CATEGORY_COLOR_LOOKUP[id] || '#F3F4F8';
}

function normalizeImageList(images) {
  if (!images) return [];
  if (typeof images === 'string') {
    return images
      .split(/[,;\n]+/)
      .map(i => i.trim())
      .filter(Boolean);
  }
  if (Array.isArray(images)) {
    return images.flatMap((item) => {
      if (typeof item === 'string') return item.trim() ? [item.trim()] : [];
      if (item && typeof item === 'object') return item.url ? [String(item.url).trim()] : [];
      return [];
    });
  }
  if (typeof images === 'object' && images.url) {
    return [String(images.url).trim()];
  }
  return [];
}

function parseFirestoreTimestamp(value) {
  if (!value) return null;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  if (value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return null;
}

function parseCategoryPath(categoriesText) {
  return String(categoriesText || '')
    .split('>')
    .map(part => part.trim())
    .filter(Boolean);
}

function buildCategoriesFromProducts(products) {
  const rootMap = new Map();
  products.forEach((product) => {
    if (!product.categoriesPath.length) return;
    const [rootLabel, subLabel, childLabel] = product.categoriesPath;
    const rootId = slugify(rootLabel);
    if (!rootId) return;

    let root = rootMap.get(rootId);
    if (!root) {
      root = {
        id: rootId,
        label: rootLabel,
        emoji: categoryIcon(rootId),
        color: categoryColor(rootId),
        subcats: [],
      };
      rootMap.set(rootId, root);
    }

    if (!subLabel) return;
    const subId = slugify(subLabel);
    let sub = root.subcats.find((item) => item.id === subId);
    if (!sub) {
      sub = { id: subId, label: subLabel };
      root.subcats.push(sub);
    }

    if (childLabel) {
      sub.children = sub.children || [];
      const childId = slugify(childLabel);
      if (!sub.children.some((item) => item.id === childId)) {
        sub.children.push({ id: childId, label: childLabel });
      }
    }
  });

  CATEGORIES = Array.from(rootMap.values());
}

function groupVariantProducts(products) {
  const groupMap = new Map();

  products.forEach((product) => {
    if (product.parent === 'parent') {
      product.parent = '';
    }
    const parentKey = product.parent && product.parent !== '' ? String(product.parent) : '';
    const groupKey = parentKey || String(product.sku || product.id || '');
    if (!groupMap.has(groupKey)) groupMap.set(groupKey, []);
    groupMap.get(groupKey).push(product);
  });

  groupMap.forEach((variants, groupKey) => {
    const hasVariants = variants.some((item) => Boolean(item.parent));
    const representative = variants.find((item) => !item.parent) || variants[0];
    const optionName = variants.find((item) => item.attribute_1_name)?.attribute_1_name || '';
    // A parent SKU stores the complete size list; child rows may only contain
    // one size. Combine only rows already linked to this parent/SKU group.
    const optionValues = [...new Set(variants.flatMap(variationValuesForProduct))];
    const isVariation = hasVariants || variants.some((item) => item.type === 'variable') || optionValues.length > 1;
    const publishedAt = representative.publishedAt || variants.reduce((latest, item) => item.publishedAt && (!latest || item.publishedAt > latest) ? item.publishedAt : latest, representative.publishedAt);
    const deal = variants.some((item) => item.deal);

    variants.forEach((item) => {
      item.groupId = groupKey;
      item.groupVariants = variants;
      item.groupCount = variants.length;
      item.isVariation = isVariation;
      item.isVariable = isVariation;
      item.displayGroup = item === representative;
      item.groupTitle = representative.title || item.title;
      item.groupImage = representative.img;
      item.optionName = optionName;
      item.optionValues = optionValues;
      item.variantLabel = item.attribute_1_value || '';
      item.publishedAt = publishedAt;
      item.deal = deal;
    });
  });
}

function splitVariationValues(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function variationValuesForProduct(product) {
  const description = String(product.description || '');
  const sizesBlock = description.match(/(?:^|\n)Sizes:\s*([\s\S]*?)(?:\n\s*Dispatch:|$)/i)?.[1] || '';
  const sizesFromDescription = sizesBlock
    .split(/,|\n/)
    .map((item) => item.trim().replace(/\s*\([^)]*\)\s*$/, ''))
    .filter(Boolean);

  // Prefer the complete sizes list held by the parent product description.
  return sizesFromDescription.length ? sizesFromDescription : splitVariationValues(product.attribute_1_value);
}

function productHasVariationValue(product, value) {
  return variationValuesForProduct(product).includes(value);
}

function filterCatalogProducts(items) {
  return items.filter((product) => product.displayGroup !== false);
}

/* ============ State ============ */
// Robust persisted state with basic validation
let cart = {};
// PRODUCTS are loaded from Firestore.
const WHATSAPP_NUMBER = '918610769343';
const FIREBASE_CONFIG = {
   apiKey: "AIzaSyD-dUd1OnhKJ5UFWEtHJBaNmY44f1yU86I",
    authDomain: "nila-store-729c2.firebaseapp.com",
    projectId: "nila-store-729c2",
    storageBucket: "nila-store-729c2.firebasestorage.app",
    messagingSenderId: "371741649720",
    appId: "1:371741649720:web:ddd8187649a5e7c77d2fcd",
    measurementId: "G-886NBKM4J5"
};
const FIRESTORE_PRODUCTS_COLLECTION = 'products';
let firestoreDb = null;

function initFirestore() {
  if (!FIREBASE_CONFIG.projectId || !FIREBASE_CONFIG.apiKey) {
    console.warn('Firebase config is missing. Firestore product loading cannot proceed.');
    return null;
  }
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    firestoreDb = firebase.firestore();
    return firestoreDb;
  } catch (err) {
    console.warn('Failed to initialize Firestore:', err);
    return null;
  }
}

function inferCategory(categories) {
  if (!categories) return 'all';
  const text = categories.toString().toLowerCase();
  const lookup = ['mobiles', 'electronics', 'mens', 'womens', 'home', 'beauty', 'health'];
  return lookup.find(cat => text.includes(cat)) || 'all';
}

function normalizeFirestoreImage(images) {
  if (!images) return '';
  if (typeof images === 'string') {
    const url = images.trim();
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return `images/${url.replace(/^\/+/, '')}`;
  }
  if (Array.isArray(images) && images.length) {
    return normalizeFirestoreImage(images[0]);
  }
  if (typeof images === 'object' && images.url) {
    return normalizeFirestoreImage(images.url);
  }
  return '';
}

async function loadProductsFromFirestore() {
  const db = initFirestore();
  if (!db) return [];

  try {
    const snapshot = await db.collection(FIRESTORE_PRODUCTS_COLLECTION).get();
    const loaded = [];
    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      const categoriesPath = parseCategoryPath(data.categories);
      const images = normalizeImageList(data.images || data.imageUrl);
      const firstImage = images[0] || normalizeFirestoreImage(data.imageUrl) || img(doc.id);
      const createdAt = parseFirestoreTimestamp(data.createdAt || data.created_at || data.publishedAt || data.published_at);

      loaded.push({
        id: String(data.id || data.sku || doc.id),
        sku: String(data.sku || data.id || doc.id),
        cat: slugify(categoriesPath[0]) || inferCategory(data.categories),
        subcat: categoriesPath[1] ? slugify(categoriesPath[1]) : undefined,
        subsubcat: categoriesPath[2] ? slugify(categoriesPath[2]) : undefined,
        categoriesPath,
        categoriesLabel: String(data.categories || '').trim(),
        brand: String(data.brand || '').trim(),
        title: String(data.name || data.title || '').trim(),
        description: String(data.description || '').trim(),
        price: Number(data.sale_price ?? data.regular_price ?? 0),
        mrp: Number(data.regular_price ?? data.sale_price ?? data.price ?? 0),
        rating: Number(data.rating ?? 0),
        reviews: Number(data.reviews ?? 0),
        images,
        img: firstImage,
        deal: Boolean(data.deal || false),
        published: data.published,
        publishedAt: createdAt,
        in_stock: Boolean(data.in_stock ?? (data.stock > 0)),
        stock: Number(data.stock ?? 0),
        parent: data.parent ? String(data.parent).trim() : '',
        attribute_1_global: data.attribute_1_global,
        attribute_1_name: String(data.attribute_1_name || '').trim(),
        attribute_1_value: String(data.attribute_1_value || '').trim(),
        type: String(data.type || '').trim(),
      });
    });

    buildCategoriesFromProducts(loaded);
    groupVariantProducts(loaded);
    return loaded;
  } catch (err) {
    console.warn('Could not load products from Firestore —', err);
    return [];
  }
}

async function loadProductsFromLocalJson() {
  const sources = ['data.json', 'variation_data.json'];
  const loaded = [];

  for (const source of sources) {
    try {
      const response = await fetch(source);
      if (!response.ok) continue;
      const json = await response.json();
      const catalogs = Array.isArray(json.catalogs) ? json.catalogs : [];

      catalogs.forEach((item) => {
        const categories = String(item.categories || item.sub_sub_category_name || item.category_name || 'All').trim();
        const categoriesPath = parseCategoryPath(categories);
        const images = normalizeImageList(item.images || item.product_images || item.image || item.collage_image);
        const firstImage = images[0] || normalizeFirestoreImage(item.image) || img(item.hero_pid || item.id || item.product_id || String(Math.random()));
        const publishedAt = parseFirestoreTimestamp(item.created_iso || item.activated_iso || item.created || item.activated);

        loaded.push({
          id: String(item.hero_pid || item.product_id || item.id || item.slug || `${item.name}-${loaded.length}`),
          sku: String(item.hero_pid || item.product_id || item.id || item.slug || ''),
          cat: slugify(categoriesPath[0]) || inferCategory(categories),
          subcat: categoriesPath[1] ? slugify(categoriesPath[1]) : undefined,
          subsubcat: categoriesPath[2] ? slugify(categoriesPath[2]) : undefined,
          categoriesPath,
          categoriesLabel: categories,
          brand: String(item.brand || item.manufacturer || '').trim(),
          title: String(item.name || item.hero_product_name || item.title || '').trim(),
          description: String(item.description || item.full_details || '').trim(),
          price: Number(item.min_product_price ?? item.sale_price ?? item.regular_price ?? item.original_price ?? item.price ?? 0),
          mrp: Number(item.original_price ?? item.regular_price ?? item.min_product_price ?? item.price ?? 0),
          rating: Number(item.catalog_reviews_summary?.average_rating ?? item.rating ?? 0),
          reviews: Number(item.catalog_reviews_summary?.review_count ?? item.reviews ?? 0),
          images,
          img: firstImage,
          deal: Boolean(item.hot || item.deal || item.discount_text),
          published: item.published ?? true,
          publishedAt,
          in_stock: item.in_stock !== undefined ? Boolean(item.in_stock) : true,
          stock: Number(item.stock ?? 100),
          parent: item.parent ? String(item.parent).trim() : '',
          attribute_1_global: item.attribute_1_global,
          attribute_1_name: String(item.attribute_1_name || '').trim(),
          attribute_1_value: String(item.attribute_1_value || '').trim(),
          type: String(item.type || 'simple').trim(),
        });
      });
    } catch (err) {
      console.warn('Failed to load local product JSON:', source, err);
    }
  }

  return loaded;
}

async function loadProducts() {
  const firestoreProducts = await loadProductsFromFirestore();
  if (firestoreProducts.length) {
    PRODUCTS = firestoreProducts;
    buildCategoriesFromProducts(PRODUCTS);
    groupVariantProducts(PRODUCTS);
    return;
  }

  const localProducts = await loadProductsFromLocalJson();
  if (localProducts.length) {
    PRODUCTS = localProducts;
    buildCategoriesFromProducts(PRODUCTS);
    groupVariantProducts(PRODUCTS);
    console.warn('Using local fallback product data from JSON files.');
    return;
  }

  console.error('No products loaded from Firestore or local JSON. Please check Firebase config and product files.');
}

const CART_KEY = 'nila-store-cart';
const CART_SIZE_SEPARATOR = '::size=';
const WISHLIST_KEY = 'nila-store-wishlist';
let wishlist = new Set();
let lastFocusedElement = null;
let removeFocusTrap = null;

function cartProductId(lineId) {
  return String(lineId).split(CART_SIZE_SEPARATOR)[0];
}

function cartSelectedSize(lineId) {
  const separatorIndex = String(lineId).indexOf(CART_SIZE_SEPARATOR);
  return separatorIndex === -1 ? '' : decodeURIComponent(String(lineId).slice(separatorIndex + CART_SIZE_SEPARATOR.length));
}

function cartLineId(productId, size) {
  return size ? `${productId}${CART_SIZE_SEPARATOR}${encodeURIComponent(size)}` : productId;
}

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
    const isActive = wishlist.has(id);
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
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
  if (!product) return;

  const variants = product.groupVariants || [product];
  let selectedProduct = product;
  if (product.isVariation && Array.isArray(variants) && variants.length > 1) {
    selectedProduct = variants.find((item) => item.parent) || product;
  }
  let selectedSize = variationValuesForProduct(selectedProduct)[0] || '';

  const imageSources = [...new Set(variants.flatMap((item) => (item.images && item.images.length ? item.images : [item.img])))];
  const variantOptions = selectedProduct.optionValues || [];

  const renderImageThumbs = () => imageSources.map((src) => `
      <button type="button" class="variant-thumb${src === selectedProduct.img ? ' selected' : ''}" data-variant-img="${esc(src)}">
        <img src="${esc(src)}" alt="${esc(selectedProduct.title)}" width="64" height="64" loading="lazy" decoding="async">
      </button>`).join('');

  const renderOptionButtons = () => {
    if (!selectedProduct.isVariation || !selectedProduct.optionName || !variantOptions.length) return '';
    return `
      <div class="variation-options">
        <div class="variation-label">Choose ${esc(selectedProduct.optionName)}</div>
        <div class="variation-choices">
          ${variantOptions.map((value) => `
            <label class="variation-choice${selectedSize === value ? ' selected' : ''}">
              <input type="radio" name="variation-size" value="${esc(value)}" data-option-value="${esc(value)}"${selectedSize === value ? ' checked' : ''}>
              <span>${esc(value)}</span>
            </label>
          `).join('')}
        </div>
      </div>`;
  };

  const updateModalSelection = (newProduct, size = '') => {
    if (!newProduct) return;
    selectedProduct = newProduct;
    selectedSize = size || variationValuesForProduct(newProduct)[0] || selectedSize;
    const mainImage = modalEl.querySelector('.modal-media img');
    const modalTitle = modalEl.querySelector('.modal-title');
    const modalBrand = modalEl.querySelector('.modal-brand');
    const modalPrice = modalEl.querySelector('.modal-price-row .price-now');
    const modalMrp = modalEl.querySelector('.modal-price-row .price-was');
    const modalOff = modalEl.querySelector('.modal-price-row .price-off');
    const addButton = modalEl.querySelector('[data-modal-add]');
    const wishButton = modalEl.querySelector('[data-modal-wish]');

    if (mainImage) {
      mainImage.src = newProduct.img;
      mainImage.alt = esc(newProduct.title);
    }
    if (modalTitle) modalTitle.textContent = newProduct.title;
    if (modalBrand) modalBrand.textContent = newProduct.brand;
    if (modalPrice) modalPrice.textContent = rupee(newProduct.price);
    if (modalMrp) modalMrp.textContent = newProduct.mrp ? rupee(newProduct.mrp) : '';
    if (modalOff) modalOff.textContent = pctOff(newProduct) > 0 ? `${pctOff(newProduct)}% off` : '';
    if (addButton) {
      addButton.dataset.modalAdd = newProduct.id;
      addButton.dataset.selectedSize = selectedSize;
    }
    if (wishButton) {
      wishButton.dataset.modalWish = newProduct.id;
      wishButton.textContent = wishlist.has(newProduct.id) ? 'Remove wishlist' : 'Add to wishlist';
      wishButton.classList.toggle('active', wishlist.has(newProduct.id));
    }

    modalEl.querySelectorAll('.variant-thumb').forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.variantImg === newProduct.img);
    });
    modalEl.querySelectorAll('.variation-choice').forEach((choice) => {
      const input = choice.querySelector('input');
      const isSelected = input?.dataset.optionValue === selectedSize;
      choice.classList.toggle('selected', isSelected);
      if (input) input.checked = isSelected;
    });
  };

  const modalImages = renderImageThumbs();
  const modalOptions = renderOptionButtons();
  const title = selectedProduct.title;
  const brand = selectedProduct.brand;
  const price = rupee(selectedProduct.price);
  const mrp = selectedProduct.mrp ? rupee(selectedProduct.mrp) : '';
  const off = pctOff(selectedProduct);

  overlay.classList.add('open');
  modalEl.setAttribute('aria-hidden', 'false');
  modalEl.innerHTML = `
    <div class="modal-inner">
      <div class="modal-media">
        <button type="button" class="modal-close" aria-label="Close product preview">✕</button>
        <img src="${esc(selectedProduct.img)}" alt="${esc(title)}" width="500" height="500" loading="eager" decoding="async">
        <div class="modal-thumbs">${modalImages}</div>
      </div>
      <div class="modal-info">
        <div class="modal-header">
          <div>
            <span class="modal-brand">${esc(brand)}</span>
            <h2 class="modal-title">${esc(title)}</h2>
          </div>
        </div>
        <div class="modal-price-row">
          <span class="price-now">${price}</span>
          ${off > 0 ? `<span class="price-was">${mrp}</span><span class="price-off">${off}% off</span>` : ''}
        </div>
        ${modalOptions}
        <p class="modal-copy">Fast delivery across Chennai. Add your address at checkout and receive WhatsApp order confirmation instantly.</p>
        <div class="modal-actions">
          <button class="btn btn-primary" data-modal-add="${selectedProduct.id}" data-selected-size="${esc(selectedSize)}">Add to cart</button>
          <button class="btn btn-outline" data-modal-wish="${selectedProduct.id}">${wishlist.has(selectedProduct.id) ? 'Remove wishlist' : 'Add to wishlist'}</button>
        </div>
      </div>
    </div>`;

  modalEl.querySelectorAll('.variant-thumb').forEach((btn) => {
    btn.addEventListener('click', () => {
      const imageUrl = btn.dataset.variantImg;
      const candidate = variants.find((item) => (item.images && item.images.includes(imageUrl)) || item.img === imageUrl) || variants[0];
      if (candidate) updateModalSelection(candidate);
    });
  });

  modalEl.querySelectorAll('.variation-choice input').forEach((input) => {
    input.addEventListener('change', () => {
      const value = input.dataset.optionValue;
      const candidate = variants.find((item) => productHasVariationValue(item, value)) || selectedProduct;
      if (candidate) updateModalSelection(candidate, value);
    });
  });

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

function previewProducts(items, limit = 5) {
  return [...items]
    .sort((a, b) => {
      if (a.publishedAt && b.publishedAt) {
        return b.publishedAt - a.publishedAt;
      }
      if ((a.deal ? 1 : 0) !== (b.deal ? 1 : 0)) return b.deal - a.deal;
      if (b.rating !== a.rating) return b.rating - a.rating;
      return b.reviews - a.reviews;
    })
    .slice(0, limit);
}

function latestDealProducts(limit = 5) {
  return previewProducts(filterCatalogProducts(PRODUCTS).filter(p => p.deal), limit);
}

function parseQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    cat: params.get('cat'),
    subcat: params.get('subcat'),
    subsubcat: params.get('subsubcat'),
  };
}

function renderCategoryPage() {
  const pageContent = document.getElementById('categoryPageContent');
  const pageTitle = document.getElementById('categoryPageTitle');
  const pageDesc = document.getElementById('categoryPageDescription');
  if (!pageContent || !pageTitle || !pageDesc) return;

  const { cat, subcat, subsubcat } = parseQueryParams();
  const category = CATEGORIES.find(c => c.id === cat);
  if (!category) {
    pageTitle.textContent = 'Category not found';
    pageDesc.textContent = 'Please return to the homepage and choose a category.';
    pageContent.innerHTML = `<div class="empty-state"><div class="big-emoji">⚠️</div><h3>Unknown category</h3><p>Use the homepage to find available collections.</p><a href="index.html" class="btn btn-outline">Back to home</a></div>`;
    return;
  }

  const parentSubcat = category.subcats?.find(s => s.id === subcat);
  const childSubcat = parentSubcat?.children?.find(ch => ch.id === subsubcat);
  const items = filterCatalogProducts(PRODUCTS).filter(p =>
    p.cat === cat &&
    (!subcat || p.subcat === subcat) &&
    (!subsubcat || p.subsubcat === subsubcat)
  );

  const titleParts = [category.label];
  if (parentSubcat) titleParts.push(parentSubcat.label);
  if (childSubcat) titleParts.push(childSubcat.label);
  pageTitle.textContent = titleParts.join(' › ');
  pageDesc.textContent = `${items.length} product${items.length === 1 ? '' : 's'}${childSubcat ? ` in ${childSubcat.label}` : parentSubcat ? ` in ${parentSubcat.label}` : ''}.`;

  if (!items.length) {
    pageContent.innerHTML = `<div class="empty-state"><div class="big-emoji">😕</div><h3>No products found</h3><p>Try a different category or go back to the homepage.</p><a href="index.html" class="btn btn-outline">Back to home</a></div>`;
    return;
  }

  pageContent.innerHTML = `<div class="product-grid">${items.map(productCard).join('')}</div>`;
}

function renderCategoryChrome() {
  const rail = document.getElementById('categoryRail');
  if (!rail) return;

  rail.innerHTML = CATEGORIES.map(c => {
    const hasSub = Array.isArray(c.subcats) && c.subcats.length > 0;
    return `
      <div class="cat-chip-wrap" data-parent="${c.id}">
        <button type="button" class="cat-chip${hasSub ? ' has-sub' : ''}" aria-expanded="false">
          <span class="emoji">${c.emoji}</span>
          ${c.label}
          ${hasSub ? '<span class="chevron">▾</span>' : ''}
        </button>
        ${hasSub ? `
          <div class="cat-dropdown">
            ${c.subcats.map(s => s.children ? `
              <div class="dropdown-group">
                <span class="dropdown-heading">${s.label}</span>
                ${s.children.map(child => `<a href="#cat-${c.id}-${s.id}-${child.id}" data-target="${c.id}-${s.id}-${child.id}">${child.label}</a>`).join('')}
              </div>` : `<a href="#cat-${c.id}-${s.id}" data-target="${c.id}-${s.id}">${s.label}</a>`).join('')}
          </div>` : ''}
      </div>`;
  }).join('');

  const wraps = rail.querySelectorAll('.cat-chip-wrap');
  wraps.forEach(wrap => {
    const btn = wrap.querySelector('.cat-chip');
    const dropdown = wrap.querySelector('.cat-dropdown');
    if (!btn || !dropdown) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = wrap.classList.contains('open');
      wraps.forEach(w => w.classList.remove('open'));
      if (!isOpen) {
        positionDropdown(btn, dropdown);
        wrap.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      } else {
        btn.setAttribute('aria-expanded', 'false');
      }
    });

    wrap.querySelectorAll('.cat-dropdown a').forEach(a => {
      a.addEventListener('click', () => {
        setActiveChip(btn);
        wrap.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        const target = document.getElementById(`cat-${a.dataset.target}`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  });

  document.addEventListener('click', () => {
    wraps.forEach(w => w.classList.remove('open'));
    rail.querySelectorAll('.cat-chip').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
  });
  window.addEventListener('scroll', () => wraps.forEach(w => w.classList.remove('open')), { passive: true });
  window.addEventListener('resize', () => wraps.forEach(w => w.classList.remove('open')));

  function positionDropdown(btn, dropdown) {
    const rect = btn.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom + 8}px`;
    let left = rect.left;
    const maxLeft = window.innerWidth - 210;
    if (left > maxLeft) left = Math.max(8, maxLeft);
    dropdown.style.left = `${left}px`;
  }

  function setActiveChip(btn) {
    rail.querySelectorAll('.cat-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  const tileGrid = document.getElementById('tileGrid');
  if (tileGrid) {
    tileGrid.innerHTML = CATEGORIES.map(c => `
      <a class="tile" href="#cat-${c.id}">
        <div class="tile-icon" style="background:${c.color}">${c.emoji}</div>
        <span class="tile-label">${c.label}</span>
      </a>`).join('');
  }

  const mobileNavList = document.getElementById('mobileNavList');
  if (mobileNavList) {
    mobileNavList.innerHTML = CATEGORIES.map(c => {
      if (c.subcats) {
        return `
          <div class="mobile-nav-group">
            <a href="#cat-${c.id}" class="mobile-nav-link mobile-nav-parent"><span class="emoji">${c.emoji}</span> ${c.label}</a>
            <div class="mobile-nav-sublist">
              ${c.subcats.map(s => s.children ? `<a href="#cat-${c.id}-${s.id}" class="mobile-nav-link mobile-nav-sub">${s.label}</a>${s.children.map(child => `<a href="#cat-${c.id}-${s.id}-${child.id}" class="mobile-nav-link mobile-nav-sub mobile-nav-deep">${child.label}</a>`).join('')}` : `<a href="#cat-${c.id}-${s.id}" class="mobile-nav-link mobile-nav-sub">${s.label}</a>`).join('')}
            </div>
          </div>`;
      }
      return `<a href="#cat-${c.id}" class="mobile-nav-link"><span class="emoji">${c.emoji}</span> ${c.label}</a>`;
    }).join('');
    document.querySelectorAll('.mobile-nav-link').forEach(a => a.addEventListener('click', closeMobileNav));
  }
}

/* ============ Product card ============ */
function productCard(p) {
  const off = pctOff(p);
  const isWished = wishlist.has(p.id);

  return `
    <article class="card" data-id="${p.id}">
      <div class="card-media" data-open="${p.id}">
        ${off > 0 ? `<span class="discount-tag">${off}% OFF</span>` : ""}
        <button type="button" class="wishlist-btn ${isWished ? "active" : ""}" data-wish="${p.id}" aria-label="Toggle wishlist" aria-pressed="${isWished}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${isWished ? 'currentColor' : 'none'}"><path d="M12 21s-7.5-4.6-10-9.3C.4 8 2 4.5 5.6 4.1 8 3.8 10 5 12 7.5 14 5 16 3.8 18.4 4.1 22 4.5 23.6 8 22 11.7 19.5 16.4 12 21 12 21z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
        </button>
        <img src="${p.img}" alt="${esc(p.title)}" loading="lazy" width="400" height="400" decoding="async">
      </div>
      <div class="card-body">
        <span class="card-brand">${esc(p.brand)}</span>
        <span class="card-title" data-open="${p.id}">${esc(p.title)}</span>
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
  const row = document.getElementById('dealsRow');
  if (!row) return;
  const deals = latestDealProducts(5);
  row.innerHTML = deals.map(productCard).join('');
}

/* ============ Category sections ============ */
function renderCategorySections() {
  const container = document.getElementById('categorySections');
  if (!container) return;

  container.innerHTML = CATEGORIES.map(c => {
    if (Array.isArray(c.subcats) && c.subcats.length > 0) {
      const total = filterCatalogProducts(PRODUCTS).filter(p => p.cat === c.id).length;
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
              if (Array.isArray(s.children) && s.children.length > 0) {
                const directItems = filterCatalogProducts(PRODUCTS).filter(p => p.cat === c.id && p.subcat === s.id && !p.subsubcat);
                const directContent = directItems.length ? `
                    <div class="product-grid">${directItems.map(productCard).join('')}</div>` : '';

                const childBlocks = s.children.map(child => {
                  const items = filterCatalogProducts(PRODUCTS).filter(p => p.cat === c.id && p.subcat === s.id && p.subsubcat === child.id);
                  if (!items.length) return '';
                  const preview = previewProducts(items);
                  return `
                    <div class="subsubcat-block" id="cat-${c.id}-${s.id}-${child.id}">
                      <div class="subsubcat-header">
                        <h4>${child.label}</h4>
                        <a href="category.html?cat=${c.id}&subcat=${s.id}&subsubcat=${child.id}" class="btn btn-outline">View all</a>
                      </div>
                      <div class="product-grid">${preview.map(productCard).join('')}</div>
                    </div>`;
                }).join('');

                if (!directContent && !childBlocks) return '';
                return `
                  <div class="subcat-block" id="cat-${c.id}-${s.id}">
                    <h3 class="subcat-title">${s.label}</h3>
                    ${directContent}
                    ${childBlocks}
                  </div>`;
              }
              const items = filterCatalogProducts(PRODUCTS).filter(p => p.cat === c.id && p.subcat === s.id);
              if (!items.length) return '';
              return `
                <div class="subcat-block" id="cat-${c.id}-${s.id}">
                  <h3 class="subcat-title">${s.label}</h3>
                  <div class="product-grid">${items.map(productCard).join('')}</div>
                </div>`;
            }).join('')}
          </div>
        </section>`;
    }
    const items = filterCatalogProducts(PRODUCTS).filter(p => p.cat === c.id);
    return `
      <section class="cat-section" id="cat-${c.id}">
        <div class="wrap">
          <div class="section-head">
            <div>
              <h2>${c.emoji} ${c.label}</h2>
              <p class="section-sub">${items.length} handpicked products</p>
            </div>
            <a href="category.html?cat=${c.id}" class="btn btn-outline">View all</a>
          </div>
          <div class="product-grid">${items.map(productCard).join('')}</div>
        </div>
      </section>`;
  }).join('');
}

/* ============ Hero carousel ============ */
const SLIDES = [
  { eyebrow: "Big Billion Days", title: "Up to 70% off on Mobiles", sub: "Trade in your old phone & save even more.", cta: "Shop mobiles", bg: "linear-gradient(120deg,#2A4DE0,#5A73F0)", img: img("hero-mobile", 500) },
  { eyebrow: "New Season", title: "Men's & Women's styles from ₹499", sub: "Shirts, sarees, kurtis & more — fresh arrivals every week.", cta: "Explore Women's", bg: "linear-gradient(120deg,#E1483F,#FF7A6E)", img: img("hero-fashion", 500) },
  { eyebrow: "Home Refresh", title: "Kitchen & home up to 60% off", sub: "Everything you need to upgrade your space.", cta: "Shop home", bg: "linear-gradient(120deg,#17A673,#4FD9A9)", img: img("hero-home", 500) },
];

let carIndex = 0, carTimer;
function renderCarousel() {
  const track = document.getElementById('carouselTrack');
  const dots = document.getElementById('carDots');
  if (!track || !dots) return;
  track.innerHTML = SLIDES.map((s,i) => `
    <div class="slide" style="background:${s.bg}">
      <div class="slide-copy">
        <span class="slide-eyebrow">${esc(s.eyebrow)}</span>
        <h1 class="slide-title">${esc(s.title)}</h1>
        <p class="slide-sub">${esc(s.sub)}</p>
        <a href="#" class="slide-cta">${esc(s.cta)} →</a>
      </div>
      <div class="slide-visual"><img src="${s.img}" alt="${esc(s.title)}" width="500" height="500" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async"></div>
    </div>`).join('');
  dots.innerHTML = SLIDES.map((_, i) => `<button data-i="${i}" class="${i === 0 ? 'active' : ''}"></button>`).join('');
  dots.querySelectorAll('button').forEach(b => b.addEventListener('click', () => goToSlide(+b.dataset.i)));
  document.getElementById('carPrev')?.addEventListener('click', () => goToSlide(carIndex - 1));
  document.getElementById('carNext')?.addEventListener('click', () => goToSlide(carIndex + 1));
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
  if (!el) return;
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
function addToCart(id, qty = 1, requestedSize = '') {
  const product = PRODUCTS.find((item) => item.id === id);
  if (!product) return;

  // Product cards represent a variation group. Store a concrete, in-stock
  // variant so its selected option is preserved in the cart.
  const selectedProduct = product.attribute_1_value
    ? product
    : product.isVariation
      ? product.groupVariants.find((item) => item.attribute_1_value && item.in_stock !== false) || product
      : product;
  const selectedSize = requestedSize || variationValuesForProduct(selectedProduct)[0] || '';
  const cartId = cartLineId(selectedProduct.id, selectedSize);
  cart[cartId] = (cart[cartId] || 0) + qty;
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
  // Remove stale saved-cart entries when the catalogue has changed.
  const ids = Object.keys(cart).filter((id) => {
    const isAvailable = PRODUCTS.some((product) => product.id === cartProductId(id));
    if (!isAvailable) delete cart[id];
    return isAvailable;
  });
  saveCart();
  const body = document.getElementById("cartBody");
  const foot = document.getElementById("cartFoot");
  const countEl = document.getElementById("cartCount");
  if (!body || !foot || !countEl) return;
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
    const p = PRODUCTS.find(x => x.id === cartProductId(id));
    const qty = cart[id];
    if (!p) return '';
    subtotal += p.price * qty;
    const selectedSize = cartSelectedSize(id);
    return `
      <div class="cart-item">
        <img src="${p.img}" alt="${esc(p.title)}" width="64" height="64" decoding="async">
        <div class="cart-item-info">
          <div class="cart-item-title">${esc(p.title)}</div>
          ${selectedSize ? `<div class="cart-item-option">${esc(p.optionName || 'Size')}: ${esc(selectedSize)}</div>` : ''}
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
          <button type="button" class="btn btn-primary wishlist-add-btn" data-add="${p.id}">Add to cart</button>
          <button type="button" class="remove-link" data-remove-wish="${p.id}">Remove</button>
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
     const p = PRODUCTS.find(x => x.id === cartProductId(id));
     if (!p) return null;
     const selectedSize = cartSelectedSize(id);
     const sizeDetail = selectedSize ? ` (${p.optionName || 'Size'}: ${selectedSize})` : '';
     return `${qty} x ${p.title}${sizeDetail} @ ${rupee(p.price)} = ${rupee(p.price * qty)}`;
   }).filter(Boolean);
   const subtotal = cartEntries.reduce((sum, [id, qty]) => {
     const p = PRODUCTS.find(x => x.id === cartProductId(id));
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

  const matches = filterCatalogProducts(PRODUCTS).filter(p =>
    p.title.toLowerCase().includes(term) ||
    p.brand.toLowerCase().includes(term) ||
    p.categoriesLabel.toLowerCase().includes(term) ||
    p.cat.includes(term) ||
    (p.subcat || '').includes(term) ||
    (p.subsubcat || '').includes(term)
  );

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
  if (document.getElementById('categoryPageContent')) {
    renderCategoryPage();
  } else {
    renderCategorySections();
  }
  renderCart();
  startCountdown();

  // Global event delegation for dynamically generated controls
  document.body.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add], [data-modal-add]');
    if (add) { e.preventDefault(); addToCart(add.dataset.add || add.dataset.modalAdd, 1, add.dataset.selectedSize || ''); return; }
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

  document.getElementById("cartToggle")?.addEventListener("click", openCart);
  document.getElementById("wishlistToggle")?.addEventListener("click", openWishlist);
  document.getElementById("cartClose")?.addEventListener("click", closeCart);
  document.getElementById("wishlistClose")?.addEventListener("click", closeWishlist);
  document.getElementById("drawerOverlay")?.addEventListener("click", () => { closeCart(); closeWishlist(); closeModalIfOpen(); closeMobileNav(); });
  document.getElementById("modalOverlay")?.addEventListener("click", (e) => { if (e.target.id === "modalOverlay") closeModal(); });
  document.getElementById("menuToggle")?.addEventListener("click", openMobileNav);
  document.getElementById("mobileNavClose")?.addEventListener("click", closeMobileNav);
  document.getElementById("mobileNavOverlay")?.addEventListener("click", closeMobileNav);
  document.getElementById("checkoutBtn")?.addEventListener("click", () => {
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
  document.getElementById("searchBtn")?.addEventListener("click", () => doSearch(document.getElementById("searchInput")?.value || ''));
  document.getElementById("searchInput")?.addEventListener("keydown", e => { if (e.key === "Enter") doSearch(e.target.value); });
  document.getElementById("searchBtnMobile")?.addEventListener("click", () => doSearch(document.getElementById("searchInputMobile")?.value || ''));
  document.getElementById("searchInputMobile")?.addEventListener("keydown", e => { if (e.key === "Enter") doSearch(e.target.value); });

  document.getElementById("newsletterForm")?.addEventListener("submit", (e) => {
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
