
/* ============ Page Loading Mask ============ */
function hidePageLoader() {
  const loader = document.getElementById('pageLoader');
  if (loader && !loader.classList.contains('hidden')) {
    loader.classList.add('hidden');
    setTimeout(() => {
      if (loader.parentNode) loader.remove();
    }, 400);
  }
}
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
  if (!Array.isArray(products) || !products.length) return;
  const rootMap = new Map();
  products.forEach((product) => {
    if (!product) return;
    if (!Array.isArray(product.categoriesPath) || !product.categoriesPath.length) {
      if (product.categoriesLabel) {
        product.categoriesPath = parseCategoryPath(product.categoriesLabel);
      } else if (product.cat) {
        product.categoriesPath = [product.cat];
      } else {
        return;
      }
    }
    if (!product.categoriesPath.length) return;
    const [rootLabel, subLabel, childLabel] = product.categoriesPath;
    if (!rootLabel) return;
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
    if (!subId) return;
    let sub = root.subcats.find((item) => item.id === subId);
    if (!sub) {
      sub = { id: subId, label: subLabel, children: [] };
      root.subcats.push(sub);
    }

    if (childLabel) {
      sub.children = sub.children || [];
      const childId = slugify(childLabel);
      if (childId && !sub.children.some((item) => item.id === childId)) {
        sub.children.push({ id: childId, label: childLabel });
      }
    }
  });

  const categoryList = Array.from(rootMap.values());
  categoryList.sort((a, b) => (a.label || '').localeCompare(b.label || '', undefined, { sensitivity: 'base' }));
  categoryList.forEach((root) => {
    if (Array.isArray(root.subcats)) {
      root.subcats.sort((a, b) => (a.label || '').localeCompare(b.label || '', undefined, { sensitivity: 'base' }));
      root.subcats.forEach((sub) => {
        if (Array.isArray(sub.children)) {
          sub.children.sort((a, b) => (a.label || '').localeCompare(b.label || '', undefined, { sensitivity: 'base' }));
        }
      });
    }
  });

  CATEGORIES = categoryList;
}

function groupVariantProducts(products) {
  if (!Array.isArray(products) || !products.length) return;
  const groupMap = new Map();

  products.forEach((product) => {
    if (!product) return;
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

function parseSizeBlock(text) {
  const items = [];
  let current = [];
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '(') {
      depth++;
      current.push(char);
    } else if (char === ')') {
      depth = Math.max(0, depth - 1);
      current.push(char);
    } else if ((char === ',' || char === '\n' || char === ';') && depth === 0) {
      const token = current.join('').trim();
      if (token) items.push(token);
      current = [];
    } else {
      current.push(char);
    }
  }
  const token = current.join('').trim();
  if (token) items.push(token);
  return items;
}

function extractCleanSizeLabel(sizeStr) {
  if (!sizeStr) return '';
  return String(sizeStr).replace(/\s*\(.*$/, '').trim() || String(sizeStr).trim();
}

function getDetailedSizeChart(description) {
  const desc = String(description || '');
  const sizesMatch = desc.match(/(?:^|\n)Sizes:\s*([\s\S]*?)(?:\n\s*Dispatch:|\n\s*Country of Origin:|\n\s*Fabric:|\n\s*Pattern:|\n\s*Multipack:|\n\s*Net Quantity:|$)/i);
  if (!sizesMatch) return [];
  const rawList = parseSizeBlock(sizesMatch[1]);
  return rawList.map((s) => s.trim()).filter(Boolean);
}

function splitVariationValues(value) {
  return parseSizeBlock(String(value || '')).map(extractCleanSizeLabel).filter(Boolean);
}

function variationValuesForProduct(product) {
  const description = String(product.description || '');
  const detailedSizes = getDetailedSizeChart(description);
  const cleanSizes = detailedSizes.map(extractCleanSizeLabel).filter(Boolean);

  if (cleanSizes.length) {
    return cleanSizes;
  }
  return splitVariationValues(product.attribute_1_value);
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
  if (typeof firebase === 'undefined' || typeof firebase.initializeApp !== 'function' || !FIREBASE_CONFIG.projectId || !FIREBASE_CONFIG.apiKey) {
    return null;
  }
  try {
    if (!firebase.apps || !firebase.apps.length) {
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
    const fetchPromise = db.collection(FIRESTORE_PRODUCTS_COLLECTION).get();
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 3500));
    const snapshot = await Promise.race([fetchPromise, timeoutPromise]);
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
        let categories = String(item.categories || '').trim();
        if (!categories) {
          const catName = item.category_name || '';
          const subcatName = item.sub_category_name || '';
          const subsubName = item.sub_sub_category_name || '';
          const parts = [catName, subcatName, subsubName].filter(Boolean);
          if (parts.length >= 2) {
            categories = parts.join(' > ');
          } else {
            const titleLower = String(item.name || item.hero_product_name || item.title || '').toLowerCase();
            if (titleLower.includes('speaker') || titleLower.includes('karaoke') || titleLower.includes('headphone') || titleLower.includes('audio')) {
              categories = 'Electronics > Audio > Bluetooth Speakers';
            } else if (titleLower.includes('top') || titleLower.includes('tunic') || titleLower.includes('kurti') || titleLower.includes('saree') || titleLower.includes('dress') || titleLower.includes('women')) {
              categories = 'Women > Western Wear > Tops & Tunics';
            } else if (titleLower.includes('t-shirt') || titleLower.includes('shirt') || titleLower.includes('men')) {
              categories = 'Men > Top Wear > T-Shirts';
            } else {
              categories = subsubName || catName || 'All';
            }
          }
        }
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
  // 1. Fast local catalog load (<5ms)
  const localProducts = await loadProductsFromLocalJson();
  if (localProducts && localProducts.length) {
    PRODUCTS = localProducts;
    buildCategoriesFromProducts(PRODUCTS);
    groupVariantProducts(PRODUCTS);
  }

  // 2. Query Firestore if online
  try {
    const firestoreProducts = await loadProductsFromFirestore();
    if (firestoreProducts && firestoreProducts.length) {
      PRODUCTS = firestoreProducts;
      buildCategoriesFromProducts(PRODUCTS);
      groupVariantProducts(PRODUCTS);
    }
  } catch (err) {
    console.warn('Firestore products fetch skipped or offline:', err);
  }
}

/* ============ Instant Local Storage Cache Layer ============ */
const CACHE_KEY_PRODUCTS = 'nila_store_products_v3';
const CACHE_KEY_BANNERS = 'nila_store_banners_v3';

function loadProductsFromCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PRODUCTS);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      PRODUCTS = parsed;
      buildCategoriesFromProducts(PRODUCTS);
      groupVariantProducts(PRODUCTS);
      return true;
    }
  } catch (e) {
    console.warn('Failed to parse cached products:', e);
  }
  return false;
}

function saveProductsToCache(products) {
  try {
    if (!Array.isArray(products) || !products.length) return;
    const minified = products.map((p) => ({
      id: p.id,
      sku: p.sku,
      cat: p.cat,
      subcat: p.subcat,
      subsubcat: p.subsubcat,
      categoriesPath: p.categoriesPath,
      categoriesLabel: p.categoriesLabel,
      brand: p.brand,
      title: p.title,
      description: p.description,
      price: p.price,
      mrp: p.mrp,
      rating: p.rating,
      reviews: p.reviews,
      images: p.images,
      img: p.img,
      deal: p.deal,
      published: p.published,
      in_stock: p.in_stock,
      stock: p.stock,
      parent: p.parent,
      attribute_1_global: p.attribute_1_global,
      attribute_1_name: p.attribute_1_name,
      attribute_1_value: p.attribute_1_value,
      type: p.type
    }));
    localStorage.setItem(CACHE_KEY_PRODUCTS, JSON.stringify(minified));
  } catch (e) {
    console.warn('Failed to save products to localStorage:', e);
  }
}

function loadBannersFromCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY_BANNERS);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      BANNER_SLIDES = parsed;
      return true;
    }
  } catch (e) { }
  return false;
}

function saveBannersToCache(banners) {
  try {
    if (Array.isArray(banners) && banners.length) {
      localStorage.setItem(CACHE_KEY_BANNERS, JSON.stringify(banners));
    }
  } catch (e) { }
}

function renderSkeletonCards(count = 6) {
  return Array.from({ length: count }, () => `
    <div class="skeleton-card" aria-hidden="true">
      <div class="skeleton-media"></div>
      <div class="skeleton-body">
        <div class="skeleton-line w-40"></div>
        <div class="skeleton-line w-60"></div>
      </div>
    </div>
  `).join('');
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
  id = String(id);
  const isCurrentlyWished = wishlist.has(id);
  if (isCurrentlyWished) {
    wishlist.delete(id);
    showToast('Removed from wishlist');
  } else {
    wishlist.add(id);
    showToast('Added to wishlist');
  }
  saveWishlist();
  updateWishlistCount();

  const isNowWished = wishlist.has(id);
  document.querySelectorAll(`[data-wish="${id}"], [data-modal-wish="${id}"]`).forEach(btn => {
    btn.classList.toggle('active', isNowWished);
    btn.setAttribute('aria-pressed', String(isNowWished));
    const svg = btn.querySelector('svg');
    if (svg) svg.setAttribute('fill', isNowWished ? 'currentColor' : 'none');
  });

  const wishBtn2 = document.getElementById('pdpWishlistBtn2');
  if (wishBtn2) {
    wishBtn2.textContent = isNowWished ? '❤️ In Wishlist' : '🤍 Add to Wishlist';
  }

  if (document.getElementById('wishlistDrawer')?.classList.contains('open')) {
    renderWishlist();
  }
}

function trapFocus(container) {
  const focusable = Array.from(container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter(el => el.offsetParent !== null);
  if (!focusable.length) return () => { };

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

function productHasVariationValue(product, value) {
  const cleanVal = extractCleanSizeLabel(value);
  const prodVal = extractCleanSizeLabel(product.attribute_1_value);
  if (prodVal && prodVal === cleanVal) return true;
  return variationValuesForProduct(product).includes(cleanVal);
}

function getProductSlug(product) {
  return slugify(product?.title || product?.id || '');
}

function getProductUrl(product) {
  if (!product) return 'product.html';
  const slug = getProductSlug(product);
  if (slug) {
    return `product.html?product=${encodeURIComponent(slug)}`;
  }
  if (product.id) {
    return `product.html?id=${encodeURIComponent(product.id)}`;
  }
  return 'product.html';
}

function getProductAbsoluteUrl(product) {
  const relUrl = getProductUrl(product);
  try {
    const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    return new URL(relUrl, base).toString();
  } catch {
    return relUrl;
  }
}

function parseProductSpecs(description, product) {
  const desc = String(description || '');
  const specs = [];

  const fabricMatch = desc.match(/(?:^|\n)\s*Fabric:\s*([^\n]+)/i);
  if (fabricMatch) specs.push({ label: 'Fabric', value: fabricMatch[1].trim() });

  const patternMatch = desc.match(/(?:^|\n)\s*Pattern:\s*([^\n]+)/i);
  if (patternMatch) specs.push({ label: 'Pattern', value: patternMatch[1].trim() });

  const originMatch = desc.match(/(?:^|\n)\s*Country of Origin:\s*([^\n]+)/i);
  if (originMatch) specs.push({ label: 'Country of Origin', value: originMatch[1].trim() });

  const dispatchMatch = desc.match(/(?:^|\n)\s*Dispatch:\s*([^\n]+)/i);
  if (dispatchMatch) specs.push({ label: 'Dispatch', value: dispatchMatch[1].trim() });

  const netQtyMatch = desc.match(/(?:^|\n)\s*Net Quantity:\s*([^\n]+)/i);
  if (netQtyMatch) specs.push({ label: 'Net Quantity', value: netQtyMatch[1].trim() });

  if (product.categoriesLabel) {
    specs.push({ label: 'Category', value: product.categoriesLabel });
  }

  if (product.sku || product.id) {
    specs.push({ label: 'Product Code / SKU', value: product.sku || product.id });
  }

  return specs;
}

function openWhatsAppUrl(rawText) {
  const encodedText = typeof rawText === 'string' && (rawText.startsWith('%') || rawText.includes('%20')) ? rawText : encodeURIComponent(rawText);
  // api.whatsapp.com is standard and reliable across WebViews, Chrome, Safari, and Desktop
  const url = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodedText}`;

  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 200);
  } catch (err) {
    window.location.href = url;
  }
}

function orderProductOnWhatsApp(productId, requestedSize = '', requestedQty = 1) {
  const p = PRODUCTS.find((x) => x.id === productId || slugify(x.title) === slugify(productId) || x.sku === productId);
  if (!p) return;
  const sizeDetail = requestedSize ? ` (Size: ${requestedSize})` : '';
  const itemSku = p.sku || p.id || '';
  const skuDetail = itemSku ? ` (N-Item No: ${itemSku})` : '';
  const totalVal = rupee(p.price * requestedQty);
  const text = `Hello Nila Store, I would like to order this product:\n\n*${p.title}*${sizeDetail}${skuDetail}\nQuantity: ${requestedQty}\nPrice: ${rupee(p.price)} each\nTotal: ${totalVal}\nProduct Link: ${getProductAbsoluteUrl(p)}\n\nPlease confirm availability and delivery details.`;
  openWhatsAppUrl(text);
}

async function shareProduct(productId) {
  const product = PRODUCTS.find((p) => p.id === productId || slugify(p.title) === productId || p.sku === productId);
  if (!product) return;
  const shareUrl = getProductAbsoluteUrl(product);
  const shareData = {
    title: `${product.title} — Nila Store`,
    text: `Check out ${product.title} on Nila Store for ${rupee(product.price)}:`,
    url: shareUrl,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Product link copied to clipboard! 📋');
      return;
    }
  } catch (e) { }

  window.prompt('Copy product link:', shareUrl);
}

function openModal(targetId) {
  if (!targetId) return;
  const targetSlug = slugify(targetId);
  const product = PRODUCTS.find((p) => p.id === targetId || slugify(p.title) === targetSlug || p.sku === targetId);
  if (product) {
    window.location.href = getProductUrl(product);
  }
}

function closeModal() {
  const overlay = document.getElementById("modalOverlay");
  const modalEl = document.getElementById("productModal");
  if (overlay) overlay.classList.remove("open");
  if (modalEl) modalEl.setAttribute('aria-hidden', 'true');
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function previewProducts(items, limit = 6) {
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

function latestDealProducts(limit = 6) {
  const catalog = filterCatalogProducts(PRODUCTS);
  if (!catalog.length) return [];
  // Prioritize items with discount / top ratings, or random products shuffled on each refresh
  const discounted = catalog.filter((p) => pctOff(p) > 0);
  const pool = discounted.length >= limit ? discounted : catalog;
  return shuffleArray(pool).slice(0, limit);
}

function parseQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    cat: params.get('cat') || '',
    subcat: params.get('subcat') || '',
    subsubcat: params.get('subsubcat') || '',
    search: params.get('search') || params.get('q') || '',
  };
}

function renderProductPage() {
  const pageContent = document.getElementById('productPageContent');
  if (!pageContent) return;

  const params = new URLSearchParams(window.location.search);
  const targetId = params.get('product') || params.get('name') || params.get('id') || params.get('p') || params.get('sku');

  if (!targetId) {
    pageContent.innerHTML = `
      <div class="empty-state">
        <div class="big-emoji">🛍️</div>
        <h2>Select a product to view details</h2>
        <p>Browse our top collections and deals from the homepage.</p>
        <a href="index.html" class="btn btn-primary" style="margin-top: 14px; display: inline-block;">Back to Homepage</a>
      </div>`;
    return;
  }

  // If products are still loading, show a skeleton placeholder instead of premature "Product not found"
  if (!PRODUCTS || PRODUCTS.length === 0) {
    pageContent.innerHTML = `
      <div class="pdp-wrap" style="padding: 24px 0 60px;">
        <div class="skeleton" style="height: 18px; width: 220px; margin-bottom: 20px; border-radius: 4px;"></div>
        <div class="pdp-grid">
          <div class="skeleton" style="aspect-ratio: 1/1; width: 100%; border-radius: 12px;"></div>
          <div style="display: flex; flex-direction: column; gap: 14px;">
            <div class="skeleton" style="height: 28px; width: 85%; border-radius: 6px;"></div>
            <div class="skeleton" style="height: 20px; width: 35%; border-radius: 6px;"></div>
            <div class="skeleton" style="height: 44px; width: 55%; border-radius: 8px;"></div>
            <div class="skeleton" style="height: 48px; width: 100%; border-radius: 8px; margin-top: 14px;"></div>
          </div>
        </div>
      </div>`;
    return;
  }

  const targetSlug = slugify(targetId);
  let product = PRODUCTS.find((p) =>
    slugify(p.title) === targetSlug ||
    getProductSlug(p) === targetSlug ||
    String(p.id) === String(targetId) ||
    String(p.sku || '').toLowerCase() === String(targetId).toLowerCase()
  );

  // Check variants if not matched directly
  if (!product) {
    for (const p of PRODUCTS) {
      if (p.groupVariants && p.groupVariants.length) {
        const match = p.groupVariants.find((v) =>
          String(v.id) === String(targetId) ||
          String(v.sku || '').toLowerCase() === String(targetId).toLowerCase() ||
          slugify(v.title) === targetSlug
        );
        if (match) {
          product = p;
          break;
        }
      }
    }
  }

  // Fuzzy partial match as fallback
  if (!product && targetSlug.length > 3) {
    product = PRODUCTS.find((p) =>
      slugify(p.title).includes(targetSlug) ||
      targetSlug.includes(slugify(p.title))
    );
  }

  if (!product) {
    pageContent.innerHTML = `
      <div class="empty-state">
        <div class="big-emoji">🔍</div>
        <h2>Product not found</h2>
        <p>The product you are looking for might have expired or the link is invalid.</p>
        <a href="index.html" class="btn btn-primary" style="margin-top: 14px; display: inline-block;">Explore Other Products</a>
      </div>`;
    return;
  }

  // Ensure clean product name in URL bar if accessed via ?id= or legacy parameter
  const productSlug = getProductSlug(product);
  if (productSlug && params.get('product') !== productSlug) {
    const cleanUrl = new URL(window.location);
    cleanUrl.searchParams.delete('id');
    cleanUrl.searchParams.delete('name');
    cleanUrl.searchParams.delete('p');
    cleanUrl.searchParams.delete('sku');
    cleanUrl.searchParams.set('product', productSlug);
    window.history.replaceState({ productId: product.id, productSlug }, '', cleanUrl);
  }

  // Update Page Title and SEO Meta
  document.title = `${product.title} — Nila Store`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute('content', `Buy ${product.title} at Nila Store for ${rupee(product.price)}. Fast delivery, cash on delivery, and easy 7-day returns.`);
  }

  const variants = product.groupVariants || [product];
  const representative = variants.find((item) => !item.parent) || variants[0] || product;
  let selectedProduct = representative;
  let selectedQty = 1;

  const productDesc = selectedProduct.description || variants.find((v) => v.description)?.description || product.description || '';
  let selectedSize = variationValuesForProduct(selectedProduct)[0] || '';

  const imageSources = [...new Set(variants.flatMap((item) => (item.images && item.images.length ? item.images : [item.img])))].filter(Boolean);
  let currentImg = selectedProduct.img || imageSources[0] || '';

  const variantOptions = selectedProduct.optionValues && selectedProduct.optionValues.length
    ? selectedProduct.optionValues
    : variationValuesForProduct(selectedProduct);

  const isFreeSize = (options) => {
    if (!options || !options.length) return true;
    const cleanList = options.map(extractCleanSizeLabel).map(s => s.toLowerCase().trim()).filter(Boolean);
    if (!cleanList.length) return true;
    if (cleanList.length === 1) {
      const val = cleanList[0].replace(/[\s\-_]/g, '');
      return val === 'freesize' || val === 'free' || val === 'onesize' || val === 'standard' || val === 'na' || val === 'all';
    }
    return false;
  };

  const showVariants = variantOptions && variantOptions.length && !isFreeSize(variantOptions);
  const sizeChartItems = getDetailedSizeChart(productDesc);
  const hasDetailedSpecs = sizeChartItems.length > 0 && sizeChartItems.some((item) => item.includes('('));

  // Category breadcrumbs
  const category = CATEGORIES.find(c => c.id === selectedProduct.cat);
  const parentSubcat = category?.subcats?.find(s => s.id === selectedProduct.subcat);
  const childSubcat = parentSubcat?.children?.find(ch => ch.id === selectedProduct.subsubcat);

  const breadcrumbsHtml = `
    <nav class="pdp-breadcrumbs" aria-label="Breadcrumb">
      <a href="index.html">Home</a>
      <span class="sep">›</span>
      ${category ? `<a href="category.html?cat=${category.id}">${esc(category.label)}</a><span class="sep">›</span>` : ''}
      ${parentSubcat ? `<a href="category.html?cat=${category?.id}&subcat=${parentSubcat.id}">${esc(parentSubcat.label)}</a><span class="sep">›</span>` : ''}
      ${childSubcat ? `<a href="category.html?cat=${category?.id}&subcat=${parentSubcat.id}&subsubcat=${childSubcat.id}">${esc(childSubcat.label)}</a><span class="sep">›</span>` : ''}
      <span class="current" title="${esc(selectedProduct.title)}">${esc(selectedProduct.title)}</span>
    </nav>`;

  const specsList = parseProductSpecs(productDesc, selectedProduct);

  const renderThumbsHtml = () => {
    if (imageSources.length <= 1) return '';
    return `
      <div class="pdp-thumbs" id="pdpThumbs">
        ${imageSources.map((src) => `
          <button type="button" class="pdp-thumb-btn${src === currentImg ? ' selected' : ''}" data-pdp-img="${esc(src)}" aria-label="View photo">
            <img src="${esc(src)}" alt="${esc(selectedProduct.title)}" width="64" height="64" loading="lazy" decoding="async">
          </button>
        `).join('')}
      </div>`;
  };

  const renderVariantsHtml = () => {
    if (!showVariants) return '';
    const optName = selectedProduct.optionName || 'Size';
    return `
      <div class="pdp-variants-section">
        <div class="pdp-variants-head">
          <span class="pdp-variants-title">Select ${esc(optName)}</span>
          ${hasDetailedSpecs ? `<button type="button" id="pdpSizeChartBtn" class="pdp-sizechart-btn">📏 Size Chart</button>` : ''}
        </div>
        <div class="pdp-variant-chips" id="pdpVariantChips">
          ${variantOptions.map((value) => {
      const cleanVal = extractCleanSizeLabel(value);
      const isSelected = selectedSize === cleanVal;
      return `
              <label class="pdp-chip-label${isSelected ? ' selected' : ''}">
                <input type="radio" name="pdp-variation" value="${esc(cleanVal)}"${isSelected ? ' checked' : ''}>
                <span class="pdp-chip-box">${esc(cleanVal)}</span>
              </label>`;
    }).join('')}
        </div>
        ${hasDetailedSpecs ? `
          <div id="pdpSizeChartDetails" class="size-chart-box" style="display: none; margin-top: 0.75rem; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 0.85rem 1rem; font-size: 0.82rem; line-height: 1.6; color: #334155;">
            <div style="font-weight: 700; color: #0f172a; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.4rem;">
              <span>📏 Size Chart &amp; Measurements</span>
              <span style="font-size: 0.72rem; color: #64748b; font-weight: normal;">(Inches / Specs)</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.4rem;">
              ${sizeChartItems.map((item) => {
      const label = extractCleanSizeLabel(item);
      const specs = item.includes('(') ? item.replace(/^[^(]*\(/, '(') : '';
      return `
                  <div style="display: flex; gap: 0.6rem; align-items: baseline;">
                    <span style="font-weight: 700; color: #1e293b; min-width: 2.4rem; background: #e2e8f0; border-radius: 4px; text-align: center; padding: 0.15rem 0.4rem; font-size: 0.78rem;">${esc(label)}</span>
                    <span style="color: #475569; font-size: 0.82rem;">${esc(specs || item)}</span>
                  </div>`;
    }).join('')}
            </div>
          </div>` : ''}
      </div>`;
  };

  const off = pctOff(selectedProduct);
  const isWished = wishlist.has(selectedProduct.id);

  pageContent.innerHTML = `
    <div class="pdp-wrap">
      ${breadcrumbsHtml}

      <div class="pdp-grid">
        <!-- Gallery Column -->
        <div class="pdp-gallery-col">
          <div class="pdp-gallery-card">
            <div class="pdp-main-media">
              ${off > 0 ? `<span class="discount-tag" id="pdpDiscountTag">${off}% OFF</span>` : '<span class="discount-tag" id="pdpDiscountTag" style="display:none;"></span>'}
              <div class="pdp-media-actions">
                <button type="button" class="pdp-icon-btn ${isWished ? 'active' : ''}" id="pdpWishlistBtn" data-wish="${selectedProduct.id}" aria-label="Add to wishlist" aria-pressed="${isWished}">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="${isWished ? 'currentColor' : 'none'}"><path d="M12 21s-7.5-4.6-10-9.3C.4 8 2 4.5 5.6 4.1 8 3.8 10 5 12 7.5 14 5 16 3.8 18.4 4.1 22 4.5 23.6 8 22 11.7 19.5 16.4 12 21 12 21z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
                </button>
                <button type="button" class="pdp-icon-btn" id="pdpShareBtn" title="Share product link">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                </button>
              </div>
              <img id="pdpMainImage" src="${esc(currentImg)}" alt="${esc(selectedProduct.title)}" width="600" height="600" loading="eager" fetchpriority="high" decoding="async">
            </div>
            ${renderThumbsHtml()}
          </div>
        </div>

        <!-- Info Column -->
        <div class="pdp-info-col">
          <div class="pdp-header">
            ${selectedProduct.brand ? `<span class="pdp-brand-tag">${esc(selectedProduct.brand)}</span>` : ''}
            <h1 class="pdp-title" id="pdpTitle">${esc(selectedProduct.title)}</h1>
            <div class="pdp-rating-strip">
              <span class="pdp-rating-badge">★ ${selectedProduct.rating ? selectedProduct.rating.toFixed(1) : '4.2'}</span>
              <span>${selectedProduct.reviews ? `${selectedProduct.reviews} ratings` : '50+ verified buyers'}</span>
              <span class="pdp-verified-badge">✓ In Stock &amp; Ready to Ship</span>
            </div>
          </div>

          <!-- Price Box -->
          <div class="pdp-price-box">
            <div class="pdp-price-row">
              <span class="pdp-price-now" id="pdpPriceNow">${rupee(selectedProduct.price)}</span>
              ${off > 0 ? `<span class="pdp-price-was" id="pdpPriceWas">${rupee(selectedProduct.mrp)}</span>` : '<span class="pdp-price-was" id="pdpPriceWas" style="display:none;"></span>'}
              ${off > 0 ? `<span class="pdp-price-off" id="pdpPriceOff">${off}% OFF</span>` : '<span class="pdp-price-off" id="pdpPriceOff" style="display:none;"></span>'}
            </div>
            <!--<span class="pdp-tax-note">Inclusive of all taxes • Free delivery on orders over ₹499</span>-->
          </div>

          <!-- Variant / Size Choices -->
          ${renderVariantsHtml()}

          <!-- Quantity & Action Buttons -->
          <div class="pdp-action-group">
            <div class="pdp-qty-row">
              <span class="pdp-qty-label">Quantity:</span>
              <div class="pdp-qty-picker">
                <button type="button" class="pdp-qty-btn" id="pdpQtyDec" aria-label="Decrease quantity">−</button>
                <span class="pdp-qty-num" id="pdpQtyNum">1</span>
                <button type="button" class="pdp-qty-btn" id="pdpQtyInc" aria-label="Increase quantity">+</button>
              </div>
            </div>

            <div class="pdp-main-buttons">
              <button type="button" class="btn btn-primary pdp-btn-cart" id="pdpAddToCartBtn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                Add to Cart
              </button>
              <button type="button" class="pdp-btn-whatsapp" id="pdpWhatsAppBtn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Order on WhatsApp
              </button>
            </div>

            <div class="pdp-secondary-buttons">
              <button type="button" class="btn btn-outline" id="pdpWishlistBtn2">
                ${isWished ? '❤️ In Wishlist' : '🤍 Add to Wishlist'}
              </button>
              <button type="button" class="btn btn-outline" id="pdpShareBtn2">
                🔗 Share Link
              </button>
            </div>
          </div>

          <!-- Value Perks Banner -->
          <div class="pdp-perks-grid">
            <!--<div class="pdp-perk-item">
              <span class="pdp-perk-icon">🚚</span>
              <span>Free Delivery Above ₹499</span>
            </div>-->
            <div class="pdp-perk-item">
              <span class="pdp-perk-icon">🔄</span>
              <span>7-Day Easy Returns</span>
            </div>
            <div class="pdp-perk-item">
              <span class="pdp-perk-icon">💵</span>
              <span>Cash on Delivery</span>
            </div>
            <div class="pdp-perk-item">
              <span class="pdp-perk-icon">🛡️</span>
              <span>100% Quality Checked</span>
            </div>
          </div>

          <!-- Product Details and Specifications Card -->
          <div class="pdp-details-card">
            <div>
              <h3>Product Description</h3>
              <p class="pdp-description-text">${esc(productDesc) || 'No additional description available.'}</p>
            </div>

            ${specsList.length ? `
              <div>
                <h3>Product Specifications</h3>
                <table class="pdp-specs-table">
                  <tbody>
                    ${specsList.map(s => `<tr><th>${esc(s.label)}</th><td>${esc(s.value)}</td></tr>`).join('')}
                  </tbody>
                </table>
              </div>` : ''}
          </div>
        </div>
      </div>

      <!-- Mobile Sticky Action Bar -->
      <div class="pdp-mobile-sticky-bar" id="pdpMobileStickyBar">
        <div class="pdp-mobile-sticky-price">
          <span class="now" id="pdpMobilePrice">${rupee(selectedProduct.price)}</span>
          ${off > 0 ? `<span class="off">${off}% OFF</span>` : ''}
        </div>
        <div class="pdp-mobile-sticky-buttons">
          <button type="button" class="btn btn-primary pdp-btn-cart" id="pdpMobileAddToCart">
            Add to Cart
          </button>
          <button type="button" class="pdp-btn-whatsapp" id="pdpMobileWhatsApp">
            WhatsApp Buy
          </button>
        </div>
      </div>
    </div>`;

  // Attach interactive listeners for PDP
  const mainImgEl = document.getElementById('pdpMainImage');
  const priceNowEl = document.getElementById('pdpPriceNow');
  const priceWasEl = document.getElementById('pdpPriceWas');
  const priceOffEl = document.getElementById('pdpPriceOff');
  const discountTagEl = document.getElementById('pdpDiscountTag');
  const mobilePriceEl = document.getElementById('pdpMobilePrice');
  const qtyNumEl = document.getElementById('pdpQtyNum');
  const sizeChartDetails = document.getElementById('pdpSizeChartDetails');
  const sizeChartBtn = document.getElementById('pdpSizeChartBtn');

  // Thumbnail switching
  pageContent.querySelectorAll('.pdp-thumb-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const src = btn.dataset.pdpImg;
      if (!src) return;
      currentImg = src;
      if (mainImgEl) mainImgEl.src = src;
      pageContent.querySelectorAll('.pdp-thumb-btn').forEach((b) => b.classList.toggle('selected', b === btn));
    });
  });

  // Size Chart toggle
  if (sizeChartBtn && sizeChartDetails) {
    sizeChartBtn.addEventListener('click', () => {
      const isHidden = sizeChartDetails.style.display === 'none' || !sizeChartDetails.style.display;
      sizeChartDetails.style.display = isHidden ? 'block' : 'none';
      sizeChartBtn.textContent = isHidden ? '✕ Hide Size Chart' : '📏 Size Chart';
    });
  }

  // Variant change
  pageContent.querySelectorAll('#pdpVariantChips input').forEach((radio) => {
    radio.addEventListener('change', () => {
      selectedSize = radio.value;
      pageContent.querySelectorAll('.pdp-chip-label').forEach((lbl) => {
        const inp = lbl.querySelector('input');
        lbl.classList.toggle('selected', inp?.value === selectedSize);
      });
      // Check if another variant object exists with this size
      const candidate = variants.find((v) => productHasVariationValue(v, selectedSize)) || selectedProduct;
      if (candidate && candidate !== selectedProduct) {
        selectedProduct = candidate;
        if (candidate.img && imageSources.includes(candidate.img)) {
          currentImg = candidate.img;
          if (mainImgEl) mainImgEl.src = currentImg;
          pageContent.querySelectorAll('.pdp-thumb-btn').forEach((b) => b.classList.toggle('selected', b.dataset.pdpImg === currentImg));
        }
        const newOff = pctOff(selectedProduct);
        if (priceNowEl) priceNowEl.textContent = rupee(selectedProduct.price);
        if (mobilePriceEl) mobilePriceEl.textContent = rupee(selectedProduct.price);
        if (priceWasEl) {
          priceWasEl.textContent = selectedProduct.mrp ? rupee(selectedProduct.mrp) : '';
          priceWasEl.style.display = newOff > 0 ? '' : 'none';
        }
        if (priceOffEl) {
          priceOffEl.textContent = newOff > 0 ? `${newOff}% OFF` : '';
          priceOffEl.style.display = newOff > 0 ? '' : 'none';
        }
        if (discountTagEl) {
          discountTagEl.textContent = newOff > 0 ? `${newOff}% OFF` : '';
          discountTagEl.style.display = newOff > 0 ? '' : 'none';
        }
      }
    });
  });

  // Quantity changes
  document.getElementById('pdpQtyInc')?.addEventListener('click', () => {
    selectedQty = Math.min(20, selectedQty + 1);
    if (qtyNumEl) qtyNumEl.textContent = selectedQty;
  });
  document.getElementById('pdpQtyDec')?.addEventListener('click', () => {
    selectedQty = Math.max(1, selectedQty - 1);
    if (qtyNumEl) qtyNumEl.textContent = selectedQty;
  });

  // Add to Cart
  const handleAddToCart = () => {
    addToCart(selectedProduct.id, selectedQty, selectedSize);
  };
  document.getElementById('pdpAddToCartBtn')?.addEventListener('click', handleAddToCart);
  document.getElementById('pdpMobileAddToCart')?.addEventListener('click', handleAddToCart);

  // WhatsApp Buy Now
  const handleWhatsAppBuy = () => {
    orderProductOnWhatsApp(selectedProduct.id, selectedSize, selectedQty);
  };
  document.getElementById('pdpWhatsAppBtn')?.addEventListener('click', handleWhatsAppBuy);
  document.getElementById('pdpMobileWhatsApp')?.addEventListener('click', handleWhatsAppBuy);

  // Wishlist toggle
  const wishBtn1 = document.getElementById('pdpWishlistBtn');
  const wishBtn2 = document.getElementById('pdpWishlistBtn2');
  const handleWishlistToggle = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    toggleWishlist(selectedProduct.id, wishBtn1);
  };
  wishBtn1?.addEventListener('click', handleWishlistToggle);
  wishBtn2?.addEventListener('click', handleWishlistToggle);

  // Share
  const handleShare = () => shareProduct(selectedProduct.id);
  document.getElementById('pdpShareBtn')?.addEventListener('click', handleShare);
  document.getElementById('pdpShareBtn2')?.addEventListener('click', handleShare);

  // Render Related Products
  const relatedSection = document.getElementById('relatedProductsSection');
  const relatedGrid = document.getElementById('relatedProductsGrid');
  if (relatedSection && relatedGrid) {
    const catalog = filterCatalogProducts(PRODUCTS);
    const related = catalog.filter((p) => p.cat === selectedProduct.cat && p.id !== selectedProduct.id);
    const selectedRelated = shuffleArray(related).slice(0, 6);
    if (selectedRelated.length > 0) {
      relatedGrid.innerHTML = selectedRelated.map(productCard).join('');
      relatedSection.style.display = 'block';
    } else {
      relatedSection.style.display = 'none';
    }
  }
}

let categoryObserver = null;
function renderCategoryPage() {
  const pageContent = document.getElementById('categoryPageContent');
  const pageTitle = document.getElementById('categoryPageTitle');
  const pageDesc = document.getElementById('categoryPageDescription');
  if (!pageContent) return;

  const { cat, subcat, subsubcat, search } = parseQueryParams();
  const catalog = filterCatalogProducts(PRODUCTS);

  // 1. Search Query Mode
  if (search) {
    const sTerm = search.trim().toLowerCase();
    const matches = catalog.filter((p) =>
      p.title.toLowerCase().includes(sTerm) ||
      p.brand.toLowerCase().includes(sTerm) ||
      (p.categoriesLabel && p.categoriesLabel.toLowerCase().includes(sTerm)) ||
      p.cat.includes(sTerm) ||
      (p.subcat || '').includes(sTerm) ||
      (p.subsubcat || '').includes(sTerm)
    );

    if (pageTitle) pageTitle.textContent = `Search results for "${search}"`;
    if (pageDesc) pageDesc.textContent = `${matches.length} product${matches.length === 1 ? '' : 's'} found.`;

    if (!matches.length) {
      pageContent.innerHTML = `<div class="empty-state"><div class="big-emoji">🔍</div><h3>No products found for "${esc(search)}"</h3><p>Try a different search keyword or browse categories.</p><a href="index.html" class="btn btn-outline">Back to home</a></div>`;
      return;
    }
    renderProgressiveProductGrid(pageContent, matches);
    return;
  }

  // 2. Matching helpers for fuzzy plural / hierarchical matching
  const matchCat = (p, targetCat) => {
    if (!targetCat) return true;
    const targetSlug = slugify(targetCat);
    const cleanTarget = targetSlug.replace(/s$/, '');
    if (p.cat && (slugify(p.cat) === targetSlug || slugify(p.cat).replace(/s$/, '') === cleanTarget)) return true;
    if (Array.isArray(p.categoriesPath) && p.categoriesPath.some((cp) => slugify(cp) === targetSlug || slugify(cp).replace(/s$/, '') === cleanTarget)) return true;
    if (p.categoriesLabel && (slugify(p.categoriesLabel).includes(targetSlug) || slugify(p.categoriesLabel).includes(cleanTarget))) return true;
    return false;
  };

  const matchSub = (p, targetSub) => {
    if (!targetSub) return true;
    const targetSlug = slugify(targetSub);
    const cleanTarget = targetSlug.replace(/s$/, '');
    if (p.subcat && (slugify(p.subcat) === targetSlug || slugify(p.subcat).replace(/s$/, '') === cleanTarget)) return true;
    if (p.subsubcat && (slugify(p.subsubcat) === targetSlug || slugify(p.subsubcat).replace(/s$/, '') === cleanTarget)) return true;
    if (Array.isArray(p.categoriesPath) && p.categoriesPath.some((cp) => slugify(cp) === targetSlug || slugify(cp).replace(/s$/, '') === cleanTarget)) return true;
    if (p.categoriesLabel && (slugify(p.categoriesLabel).includes(targetSlug) || slugify(p.categoriesLabel).includes(cleanTarget))) return true;
    if (p.title && (slugify(p.title).includes(targetSlug) || slugify(p.title).includes(cleanTarget))) return true;
    return false;
  };

  let items = [];
  if (cat || subcat || subsubcat) {
    items = catalog.filter((p) => matchCat(p, cat) && matchSub(p, subcat) && matchSub(p, subsubcat));
  } else {
    items = catalog;
  }

  // Build interactive breadcrumbs matching product page
  const breadcrumbsEl = document.getElementById('categoryBreadcrumbs');
  const cleanCat = cat ? cat.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'All Collections';
  const cleanSub = subcat ? subcat.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
  const cleanSubsub = subsubcat ? subsubcat.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';

  if (breadcrumbsEl) {
    if (search) {
      breadcrumbsEl.innerHTML = `
        <a href="index.html">Home</a>
        <span class="sep">›</span>
        <span class="current">Search: "${esc(search)}" (${items.length})</span>
      `;
    } else if (cat) {
      let bHtml = `<a href="index.html">Home</a><span class="sep">›</span>`;
      const category = CATEGORIES.find((c) => c.id === cat || slugify(c.id) === slugify(cat) || slugify(c.label) === slugify(cat));
      const catLabel = category ? category.label : cleanCat;
      const catId = category ? category.id : cat;

      if (!subcat && !subsubcat) {
        bHtml += `<span class="current">${esc(catLabel)} (${items.length})</span>`;
      } else {
        bHtml += `<a href="category.html?cat=${encodeURIComponent(catId)}">${esc(catLabel)}</a><span class="sep">›</span>`;
        if (subcat && !subsubcat) {
          const parentSub = category?.subcats?.find((s) => s.id === subcat || slugify(s.id) === slugify(subcat) || slugify(s.label) === slugify(subcat));
          const subLabel = parentSub ? parentSub.label : cleanSub;
          bHtml += `<span class="current">${esc(subLabel)} (${items.length})</span>`;
        } else if (subcat && subsubcat) {
          const parentSub = category?.subcats?.find((s) => s.id === subcat || slugify(s.id) === slugify(subcat) || slugify(s.label) === slugify(subcat));
          const subLabel = parentSub ? parentSub.label : cleanSub;
          const subId = parentSub ? parentSub.id : subcat;
          bHtml += `<a href="category.html?cat=${encodeURIComponent(catId)}&subcat=${encodeURIComponent(subId)}">${esc(subLabel)}</a><span class="sep">›</span>`;
          const childSub = parentSub?.children?.find((ch) => ch.id === subsubcat || slugify(ch.id) === slugify(subsubcat) || slugify(ch.label) === slugify(subsubcat));
          const subsubLabel = childSub ? childSub.label : cleanSubsub;
          bHtml += `<span class="current">${esc(subsubLabel)} (${items.length})</span>`;
        }
      }
      breadcrumbsEl.innerHTML = bHtml;
    } else {
      breadcrumbsEl.innerHTML = `
        <a href="index.html">Home</a>
        <span class="sep">›</span>
        <span class="current">All Collections (${items.length})</span>
      `;
    }
  } else if (pageTitle) {
    const titleParts = [cleanCat];
    if (cleanSub) titleParts.push(cleanSub);
    if (cleanSubsub) titleParts.push(cleanSubsub);
    pageTitle.textContent = titleParts.join(' › ');
  }

  if (pageDesc) pageDesc.textContent = `${items.length} product${items.length === 1 ? '' : 's'} available.`;

  if (!items.length) {
    pageContent.innerHTML = `<div class="empty-state"><div class="big-emoji">😕</div><h3>No products found</h3><p>Try a different category or go back to the homepage.</p><a href="index.html" class="btn btn-outline">Back to home</a></div>`;
    return;
  }

  renderProgressiveProductGrid(pageContent, items);
}

function renderProgressiveProductGrid(container, items) {
  const CHUNK_SIZE = 16;
  let renderedCount = 0;

  container.innerHTML = `
    <div class="product-grid" id="categoryProductGrid"></div>
    <div id="categorySentinel" style="height: 30px; margin-top: 10px;"></div>
  `;

  const grid = document.getElementById('categoryProductGrid');
  const sentinel = document.getElementById('categorySentinel');

  const appendChunk = () => {
    if (renderedCount >= items.length) {
      if (categoryObserver && sentinel) categoryObserver.unobserve(sentinel);
      if (sentinel) sentinel.remove();
      return;
    }
    const nextBatch = items.slice(renderedCount, renderedCount + CHUNK_SIZE);
    grid.insertAdjacentHTML('beforeend', nextBatch.map((p, i) => productCard(p, renderedCount + i)).join(''));
    renderedCount += nextBatch.length;

    if (renderedCount >= items.length && sentinel) {
      if (categoryObserver) categoryObserver.unobserve(sentinel);
      sentinel.remove();
    }
  };

  appendChunk();

  if (items.length > CHUNK_SIZE && sentinel) {
    if (categoryObserver) categoryObserver.disconnect();
    categoryObserver = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        appendChunk();
      }
    }, { rootMargin: '350px' });
    categoryObserver.observe(sentinel);
  }
}

function renderCategoryChrome() {
  const rail = document.getElementById('categoryRail');
  if (rail) {
    rail.innerHTML = CATEGORIES.map(c => {
      const hasSub = Array.isArray(c.subcats) && c.subcats.length > 0;
      return `
        <div class="cat-chip-wrap" data-parent="${c.id}">
          <button type="button" class="cat-chip${hasSub ? ' has-sub' : ''}" aria-expanded="false" data-cat-id="${c.id}">
            ${c.label}
            ${hasSub ? '<span class="chevron">▾</span>' : ''}
          </button>
          ${hasSub ? `
            <div class="cat-dropdown">
              ${c.subcats.map(s => (s.children && s.children.length) ? `
                <div class="dropdown-group">
                  <a href="category.html?cat=${c.id}&subcat=${s.id}" class="dropdown-heading-link">${s.label}</a>
                  ${s.children.map(child => `<a href="category.html?cat=${c.id}&subcat=${s.id}&subsubcat=${child.id}">${child.label}</a>`).join('')}
                </div>` : `<a href="category.html?cat=${c.id}&subcat=${s.id}">${s.label}</a>`).join('')}
            </div>` : ''}
        </div>`;
    }).join('');

    const wraps = rail.querySelectorAll('.cat-chip-wrap');
    wraps.forEach(wrap => {
      const btn = wrap.querySelector('.cat-chip');
      const dropdown = wrap.querySelector('.cat-dropdown');
      if (!btn) return;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!dropdown) {
          window.location.href = `category.html?cat=${btn.dataset.catId}`;
          return;
        }
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

      if (dropdown) {
        wrap.addEventListener('mouseenter', () => {
          if (window.innerWidth > 768) {
            positionDropdown(btn, dropdown);
            wrap.classList.add('open');
            btn.setAttribute('aria-expanded', 'true');
          }
        });
        wrap.addEventListener('mouseleave', () => {
          if (window.innerWidth > 768) {
            wrap.classList.remove('open');
            btn.setAttribute('aria-expanded', 'false');
          }
        });
      }
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
  }

  const mobileNavList = document.getElementById('mobileNavList');
  if (mobileNavList) {
    mobileNavList.innerHTML = CATEGORIES.map(c => {
      if (c.subcats && c.subcats.length) {
        return `
          <div class="mobile-nav-group">
            <a href="category.html?cat=${c.id}" class="mobile-nav-link mobile-nav-parent">${c.label}</a>
            <div class="mobile-nav-sublist">
              ${c.subcats.map(s => (s.children && s.children.length) ? `
                <a href="category.html?cat=${c.id}&subcat=${s.id}" class="mobile-nav-link mobile-nav-sub">${s.label}</a>
                ${s.children.map(child => `<a href="category.html?cat=${c.id}&subcat=${s.id}&subsubcat=${child.id}" class="mobile-nav-link mobile-nav-sub mobile-nav-deep">${child.label}</a>`).join('')}
              ` : `<a href="category.html?cat=${c.id}&subcat=${s.id}" class="mobile-nav-link mobile-nav-sub">${s.label}</a>`).join('')}
            </div>
          </div>`;
      }
      return `<a href="category.html?cat=${c.id}" class="mobile-nav-link">${c.label}</a>`;
    }).join('');
    document.querySelectorAll('.mobile-nav-link').forEach(a => a.addEventListener('click', closeMobileNav));
  }
}

/* ============ Product card ============ */
function productCard(p, index) {
  if (!p) return '';
  const off = pctOff(p);
  const isWished = wishlist && wishlist.has(p.id);
  const url = getProductUrl(p);
  const isPriority = typeof index === 'number' && index < 4;
  const imageSrc = p.img || (Array.isArray(p.images) && p.images[0]) || img(p.id || '1');

  return `
    <a href="${url}" class="card" data-id="${p.id || ''}">
      <div class="card-media">
        ${off > 0 ? `<span class="discount-tag">${off}% OFF</span>` : ""}
        <button type="button" class="wishlist-btn ${isWished ? "active" : ""}" data-wish="${p.id || ''}" aria-label="Toggle wishlist" aria-pressed="${isWished}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${isWished ? 'currentColor' : 'none'}"><path d="M12 21s-7.5-4.6-10-9.3C.4 8 2 4.5 5.6 4.1 8 3.8 10 5 12 7.5 14 5 16 3.8 18.4 4.1 22 4.5 23.6 8 22 11.7 19.5 16.4 12 21 12 21z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
        </button>
        <img src="${imageSrc}" alt="${esc(p.title || 'Product')}" loading="${isPriority ? 'eager' : 'lazy'}" decoding="async"${isPriority ? ' fetchpriority="high"' : ''} width="400" height="400">
      </div>
      <div class="card-body">
        <div class="card-price-row">
          <span class="price-now">${rupee(p.price || 0)}</span>
          ${off > 0 ? `<span class="price-was">${rupee(p.mrp || 0)}</span><span class="price-off">${off}% off</span>` : ""}
        </div>
      </div>
    </a>`;
}

function attachCardEvents(root) {
  root.querySelectorAll("[data-add]").forEach(btn =>
    btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); addToCart(btn.dataset.add); }));
  root.querySelectorAll("[data-wish]").forEach(btn =>
    btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(btn.dataset.wish, btn); }));
}

/* ============ Deals row ============ */
function renderDeals() {
  const row = document.getElementById('dealsRow');
  if (!row) return;
  const deals = latestDealProducts(6);
  if (!deals.length) return;
  row.innerHTML = deals.map((p, i) => productCard(p, i)).join('');
}

/* ============ Category sections ============ */
function renderCategorySections() {
  const container = document.getElementById('categorySections');
  if (!container) return;

  const allCatalog = filterCatalogProducts(PRODUCTS);
  if (!allCatalog.length) return;
  const validCategories = CATEGORIES.filter(c => allCatalog.some(p => p.cat === c.id));
  const selectedCategories = shuffleArray(validCategories).slice(0, 5);

  container.innerHTML = selectedCategories.map(c => {
    const catProducts = allCatalog.filter(p => p.cat === c.id);
    const randomProducts = shuffleArray(catProducts).slice(0, 6);
    if (!randomProducts.length) return '';

    return `
      <section class="cat-section" id="cat-${c.id}">
        <div class="wrap">
          <div class="section-head">
            <div>
              <h2>${c.label}</h2>
              <p class="section-sub">${catProducts.length} items available in this category</p>
            </div>
            <a href="category.html?cat=${c.id}" class="btn btn-outline">View all ${c.label}</a>
          </div>
          <div class="product-grid">${randomProducts.map((p, i) => productCard(p, i)).join('')}</div>
        </div>
      </section>`;
  }).join('');
}

/* ============ Hero banner image carousel ============ */
const DEFAULT_BANNERS = [
  {
    image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1200&h=347&auto=format&fit=crop",
    title: "Mega Fashion Sale - Up to 70% Off on Women's & Men's Styles",
    url: "#cat-women",
    active: true
  },
  {
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&h=347&auto=format&fit=crop",
    title: "Fresh Arrivals - Trending Outfits & Ethnic Collections",
    url: "#cat-men",
    active: true
  },
  {
    image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=1200&h=347&auto=format&fit=crop",
    title: "Home & Kitchen Refresh - Premium Decor & Living Essentials",
    url: "#cat-home",
    active: true
  }
];

let BANNER_SLIDES = [...DEFAULT_BANNERS];

async function loadBanners() {
  try {
    const res = await fetch('banners.json?v=' + Date.now());
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        BANNER_SLIDES = data.filter(b => b.active !== false && b.image);
        return;
      }
    }
  } catch (e) { }

  try {
    const db = initFirestore();
    if (db) {
      const snapshot = await db.collection('banners').get();
      if (!snapshot.empty) {
        const loaded = [];
        snapshot.forEach(doc => {
          const d = doc.data();
          if (d && d.active !== false && (d.image || d.imageUrl)) {
            loaded.push({
              image: d.image || d.imageUrl,
              title: d.title || '',
              url: d.url || d.link || '#',
              active: true
            });
          }
        });
        if (loaded.length) {
          BANNER_SLIDES = loaded;
          return;
        }
      }
    }
  } catch (e) {
    console.warn('Could not load banners from Firestore —', e);
  }
}

let carIndex = 0;
let carTimer = null;

function renderCarousel() {
  const track = document.getElementById('carouselTrack');
  const dots = document.getElementById('carDots');
  const carouselEl = document.getElementById('carousel');
  if (!track || !BANNER_SLIDES.length) return;

  track.innerHTML = BANNER_SLIDES.map((s, i) => {
    const targetUrl = s.url || '#';
    const isExternal = /^https?:\/\//i.test(targetUrl) && !targetUrl.includes(window.location.hostname);
    return `
      <a href="${esc(targetUrl)}" class="slide" ${isExternal ? 'target="_blank" rel="noopener noreferrer"' : ''} title="${esc(s.title || 'Banner Slide')}">
        <img src="${esc(s.image)}" alt="${esc(s.title || 'Special Promotion')}" class="slide-banner-img" loading="${i === 0 ? 'eager' : 'lazy'}"${i === 0 ? ' fetchpriority="high"' : ''} decoding="async">
      </a>
    `;
  }).join('');

  if (dots) {
    dots.innerHTML = BANNER_SLIDES.map((_, i) => `<button type="button" data-i="${i}" class="${i === 0 ? 'active' : ''}" aria-label="Go to slide ${i + 1}"></button>`).join('');
    dots.querySelectorAll('button').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation();
      goToSlide(+b.dataset.i);
    }));
  }

  document.getElementById('carPrev')?.addEventListener('click', (e) => {
    e.stopPropagation();
    goToSlide(carIndex - 1);
  });
  document.getElementById('carNext')?.addEventListener('click', (e) => {
    e.stopPropagation();
    goToSlide(carIndex + 1);
  });

  // Touch Swipe gesture support
  let touchStartX = 0, touchEndX = 0;
  track.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });
  track.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    if (touchStartX - touchEndX > 50) goToSlide(carIndex + 1);
    if (touchEndX - touchStartX > 50) goToSlide(carIndex - 1);
  }, { passive: true });

  // Pause on hover
  carouselEl?.addEventListener('mouseenter', () => clearInterval(carTimer));
  carouselEl?.addEventListener('mouseleave', () => startCarouselAuto());

  goToSlide(0);
}

function goToSlide(i) {
  if (!BANNER_SLIDES.length) return;
  carIndex = (i + BANNER_SLIDES.length) % BANNER_SLIDES.length;
  const track = document.getElementById("carouselTrack");
  if (track) track.style.transform = `translateX(-${carIndex * 100}%)`;
  document.querySelectorAll(".carousel-dots button").forEach((b, idx) => b.classList.toggle("active", idx === carIndex));
  startCarouselAuto();
}

function startCarouselAuto() {
  clearInterval(carTimer);
  if (BANNER_SLIDES.length > 1) {
    carTimer = setInterval(() => goToSlide(carIndex + 1), 5000);
  }
}

/* ============ Countdown ============ */
function startCountdown() {
  const el = document.getElementById("countdownClock");
  if (!el) return;
  const end = new Date();
  end.setHours(23, 59, 59, 999);
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
function pad(n) { return String(n).padStart(2, '0'); }

/* ============ Search ============ */
function runSearch(term) {
  term = (term || '').trim().toLowerCase();
  if (!term) return;

  const catContainer = document.getElementById('categorySections') || document.getElementById('categoryPageContent');
  if (!catContainer) {
    window.location.href = `category.html?search=${encodeURIComponent(term)}`;
    return;
  }

  const catalog = filterCatalogProducts(PRODUCTS);
  const matches = catalog.filter(p =>
    p.title.toLowerCase().includes(term) ||
    p.brand.toLowerCase().includes(term) ||
    (p.categoriesLabel && p.categoriesLabel.toLowerCase().includes(term))
  );

  catContainer.innerHTML = `
    <section class="cat-section">
      <div class="wrap">
        <div class="section-head"><div><h2>Search results for "${esc(term)}"</h2><p class="section-sub">${matches.length} products found</p></div></div>
        <div class="product-grid">${matches.map((p, i) => productCard(p, i)).join("")}</div>
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
  const checkoutBtn = document.getElementById("checkoutBtn");
  const checkoutPanel = document.getElementById("checkoutPanel");
  if (!body || !foot || !countEl) return;
  const totalQty = ids.reduce((s, id) => s + cart[id], 0);
  countEl.textContent = totalQty;
  countEl.style.display = totalQty > 0 ? "flex" : "none";

  if (ids.length === 0) {
    body.innerHTML = `<div class="cart-empty"><div class="big-emoji">🛒</div><h3>Your cart is empty</h3><p>Add something you love.</p></div>`;
    foot.style.display = "none";
    if (checkoutPanel) {
      checkoutPanel.classList.remove('open');
      checkoutPanel.style.display = 'none';
      checkoutPanel.setAttribute('aria-hidden', 'true');
    }
    body.style.display = 'block';
    return;
  }

  foot.style.display = "block";
  const isPanelOpen = checkoutPanel && checkoutPanel.classList.contains('open');
  if (checkoutBtn) {
    checkoutBtn.style.display = isPanelOpen ? 'none' : 'block';
  }

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
  if (!drawer || !overlay) return;
  closeCheckoutPanel();
  renderCart();
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
  if (drawer) drawer.classList.remove("open");
  if (overlay) overlay.classList.remove("open");
  if (drawer) drawer.setAttribute('aria-hidden', 'true');
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
  const body = document.getElementById('cartBody');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const panel = document.getElementById('checkoutPanel');
  if (drawer) {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
  }
  if (overlay) {
    overlay.classList.add('open');
  }

  if (!panel) {
    console.warn('Checkout panel element not found');
    return;
  }
  panel.style.display = 'block';
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  if (body) body.style.display = 'none';
  if (checkoutBtn) checkoutBtn.style.display = 'none';
  const nameInput = document.getElementById('checkoutName');
  if (nameInput) setTimeout(() => nameInput.focus(), 120);
}
function closeCheckoutPanel() {
  const panel = document.getElementById('checkoutPanel');
  const body = document.getElementById('cartBody');
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (!panel) return;
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  panel.style.display = 'none';
  if (body) body.style.display = 'block';
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
    const itemSku = p.sku || p.id || '';
    const skuDetail = itemSku ? ` (N-Item No: ${itemSku})` : '';
    return `${qty} x ${p.title}${sizeDetail}${skuDetail} @ ${rupee(p.price)} = ${rupee(p.price * qty)}`;
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
  openWhatsAppUrl(text);
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
  document.getElementById("mobileNav")?.classList.add("open");
  document.getElementById("mobileNavOverlay")?.classList.add("open");
}
function closeMobileNav() {
  document.getElementById("mobileNav")?.classList.remove("open");
  document.getElementById("mobileNavOverlay")?.classList.remove("open");
}

/* ============ Init ============ */
async function init() {
  loadCart();
  loadWishlist();
  updateWishlistCount();

  // 1. FAST PATH: Instant local storage cache render (0ms delay)
  const hasCachedProducts = loadProductsFromCache();
  loadBannersFromCache();

  renderCategoryChrome();
  renderCarousel();
  renderDeals();
  if (document.getElementById('productPageContent')) {
    renderProductPage();
  } else if (document.getElementById('categoryPageContent')) {
    renderCategoryPage();
  } else {
    renderCategorySections();
  }
  renderCart();
  startCountdown();
  hidePageLoader();

  // 2. BACKGROUND PATH: Stale-While-Revalidate data fetch
  const syncData = async () => {
    try {
      const prevCount = PRODUCTS.length;
      await loadProducts();
      await loadBanners();
      saveProductsToCache(PRODUCTS);
      saveBannersToCache(BANNER_SLIDES);

      // Always re-render PDP and Category pages to ensure fresh product data is displayed
      if (document.getElementById('productPageContent')) {
        renderProductPage();
      } else if (document.getElementById('categoryPageContent')) {
        renderCategoryPage();
      } else if (!hasCachedProducts || PRODUCTS.length !== prevCount) {
        renderCategoryChrome();
        renderCarousel();
        renderDeals();
        renderCategorySections();
      }
    } catch (err) {
      console.warn('Sync data error:', err);
    } finally {
      hidePageLoader();
    }
  };

  // Run network sync in background
  if (!hasCachedProducts) {
    await syncData();
  } else {
    syncData();
  }

  // Global event delegation for dynamically generated controls
  document.body.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add], [data-modal-add]');
    if (add) { e.preventDefault(); addToCart(add.dataset.add || add.dataset.modalAdd, 1, add.dataset.selectedSize || ''); return; }
    const wish = e.target.closest('[data-wish], [data-modal-wish]');
    if (wish) { e.preventDefault(); e.stopPropagation(); toggleWishlist(wish.dataset.wish || wish.dataset.modalWish, wish); return; }
    const share = e.target.closest('[data-modal-share]');
    if (share) { e.preventDefault(); e.stopPropagation(); shareProduct(share.dataset.modalShare); return; }
    const open = e.target.closest('[data-open]');
    if (open) {
      // If any lingering data-open exists, navigate to product page instead of modal
      e.preventDefault();
      const targetSlug = open.dataset.open;
      const matched = PRODUCTS.find((p) => p.id === targetSlug || slugify(p.title) === slugify(targetSlug) || p.sku === targetSlug);
      if (matched) {
        window.location.href = getProductUrl(matched);
      }
      return;
    }
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

  // Legacy URL Redirect: if index.html or category.html is opened with ?product= or ?p= or ?id=
  const urlParams = new URLSearchParams(window.location.search);
  const initialProductParam = urlParams.get('product') || urlParams.get('p') || urlParams.get('id');
  if (initialProductParam && !window.location.pathname.includes('product.html')) {
    const slugTarget = slugify(initialProductParam);
    const matched = PRODUCTS.find((p) => slugify(p.title) === slugTarget || p.id === initialProductParam || p.sku === initialProductParam);
    if (matched) {
      window.location.replace(getProductUrl(matched));
      return;
    }
  }

  window.addEventListener('popstate', () => {
    if (document.getElementById('productPageContent')) {
      renderProductPage();
    }
  });
}
function closeModalIfOpen() { closeModal(); }

// Safe fallback
window.addEventListener('load', () => setTimeout(hidePageLoader, 100));
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await init();
  } finally {
    hidePageLoader();
  }
});
