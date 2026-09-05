
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

/* ==========================================================================
   NILA STORE — STATIC CATEGORY NAVIGATION
   Configured to match the exact categories & subcategories in your database.
   ========================================================================== */

let CATEGORIES = [
  {
    id: 'women',
    label: 'Women',
    emoji: '👗',
    subcats: [
      {
        id: 'sarees',
        label: 'Sarees',
        children: [
          { id: 'cotton-sarees', label: 'Cotton Sarees' },
          { id: 'silk-sarees', label: 'Silk Sarees' }
        ]
      }
    ]
  },
  {
    id: 'men',
    label: 'Men',
    emoji: '👔',
    subcats: [
      { id: 'shirts', label: 'Shirts' },
      { id: 't-shirts', label: 'T-Shirts' }
    ]
  },
  {
    id: 'kids',
    label: 'Kids',
    emoji: '🧸',
    subcats: [
      { id: 'boys', label: 'Boys' },
      { id: 'girls', label: 'Girls' }
    ]
  },
  {
    id: 'jewellery',
    label: 'Jewellery',
    emoji: '💍',
    subcats: [
      { id: 'bangles-and-bracelets', label: 'Bangles & Bracelets' },
      { id: 'earrings', label: 'Earrings' },
      { id: 'jewellery-sets', label: 'Jewellery Sets' },
      { id: 'necklaces-and-chains', label: 'Necklaces & Chains' }
    ]
  },
  {
    id: 'beauty',
    label: 'Beauty',
    emoji: '💄',
    subcats: [
      { id: 'face-wash', label: 'Face Wash' },
      { id: 'hair-oil-shampoo', label: 'Hair Oil & Shampoo' },
      { id: 'lipstick', label: 'Lipstick' }
    ]
  },
  {
    id: 'kitchen',
    label: 'Kitchen',
    emoji: '🍳',
    subcats: [
      { id: 'kitchen-appliances', label: 'Kitchen Appliances' },
      { id: 'kitchen-tools', label: 'Kitchen Tools' },
      { id: 'storage-and-organisers', label: 'Storage & Organisers' }
    ]
  },
  {
    id: 'home',
    label: 'Home',
    emoji: '🛋️',
    subcats: [
      { id: 'bedsheets', label: 'Bedsheets' },
      { id: 'pillow-cushion-and-covers', label: 'Pillow, Cushion & Covers' }
    ]
  },
  {
    id: 'electronics',
    label: 'Electronics',
    emoji: '💻',
    subcats: [
      { id: 'bluetooth-headphones', label: 'Bluetooth Headphones' },
      { id: 'bluetooth-speakers', label: 'Bluetooth Speakers' }
    ]
  },
  {
    id: 'health',
    label: 'Health',
    emoji: '💊',
    subcats: [
      { id: 'ayurveda-and-nutrition', label: 'Ayurveda & Nutrition' }
    ]
  }
];

let PRODUCTS = [];

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function categoryIcon(id) {
  const s = String(id || '').toLowerCase();
  const matched = CATEGORIES.find(c => c.id === s || slugify(c.label) === s);
  if (matched && matched.emoji) return matched.emoji;
  if (s.includes('women') || s.includes('saree') || s.includes('dress') || s.includes('kurti')) return '👗';
  if (s.includes('men') || s.includes('shirt') || s.includes('pant') || s.includes('trouser')) return '👔';
  if (s.includes('mobile') || s.includes('phone')) return '📱';
  if (s.includes('electronic') || s.includes('audio') || s.includes('headphone') || s.includes('speaker') || s.includes('laptop')) return '💻';
  if (s.includes('home') || s.includes('decor') || s.includes('kitchen') || s.includes('bed') || s.includes('curtain')) return '🛋️';
  if (s.includes('beauty') || s.includes('skincare') || s.includes('makeup') || s.includes('hair') || s.includes('face')) return '💄';
  if (s.includes('health') || s.includes('wellness') || s.includes('supplement') || s.includes('nutrition')) return '💊';
  if (s.includes('jewel') || s.includes('necklace') || s.includes('earring') || s.includes('bangle') || s.includes('ring')) return '💍';
  if (s.includes('kid') || s.includes('boy') || s.includes('girl') || s.includes('baby') || s.includes('toy')) return '🧸';
  if (s.includes('footwear') || s.includes('shoe') || s.includes('sandal') || s.includes('slipper')) return '👟';
  if (s.includes('watch')) return '⌚';
  if (s.includes('bag') || s.includes('wallet') || s.includes('purse')) return '👜';
  if (s.includes('grocery') || s.includes('food')) return '🛒';
  return '🛍️';
}

function categoryColor(id) {
  return '#F3F4F8';
}

const FALLBACK_PRODUCT_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23F8FAFC'/%3E%3Ctext x='50%25' y='48%25' font-family='sans-serif' font-size='48' fill='%23CBD5E1' text-anchor='middle' dominant-baseline='middle'%3E🛍️%3C/text%3E%3Ctext x='50%25' y='64%25' font-family='sans-serif' font-size='15' font-weight='600' fill='%2394A3B8' text-anchor='middle'%3ENila Store%3C/text%3E%3C/svg%3E";

function img(id) {
  return FALLBACK_PRODUCT_IMAGE;
}

function normalizeProductImage(images) {
  if (!images) return '';
  if (typeof images === 'string') {
    let url = images.trim();
    if (!url) return '';
    if (/^(https?:|\/\/|data:)/i.test(url)) return url;
    // Strip redundant leading "images/", "/images/", "images\", etc.
    url = url.replace(/^[\/\\]+/, '').replace(/^images[\/\\]+/i, '').replace(/^[\/\\]+/, '');
    return `images/${url}`;
  }
  if (Array.isArray(images) && images.length) {
    return normalizeProductImage(images[0]);
  }
  if (typeof images === 'object' && images.url) {
    return normalizeProductImage(images.url);
  }
  return '';
}
const normalizeFirestoreImage = normalizeProductImage;

function normalizeImageList(images) {
  if (!images) return [];
  if (typeof images === 'string') {
    return images
      .split(/[,;\n]+/)
      .map(i => normalizeProductImage(i.trim()))
      .filter(Boolean);
  }
  if (Array.isArray(images)) {
    return images.flatMap((item) => {
      if (typeof item === 'string') {
        const norm = normalizeProductImage(item);
        return norm ? [norm] : [];
      }
      if (item && typeof item === 'object' && item.url) {
        const norm = normalizeProductImage(item.url);
        return norm ? [norm] : [];
      }
      return [];
    });
  }
  if (typeof images === 'object' && images.url) {
    const norm = normalizeProductImage(images.url);
    return norm ? [norm] : [];
  }
  return [];
}

function parseTimestamp(value) {
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
const parseFirestoreTimestamp = parseTimestamp;

function parseCategoryPath(categoriesText) {
  return String(categoriesText || '')
    .split('>')
    .map(part => part.trim())
    .filter(Boolean);
}

function loadCategories() {
  renderCategoryChrome();
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
  if (!Array.isArray(items) || !items.length) return [];
  const reps = items.filter((product) => product.displayGroup !== false);
  if (!reps.length) {
    const noParent = items.filter(p => !p.parent);
    return noParent.length ? noParent : items;
  }
  return reps;
}

/* ============ State ============ */
// Robust persisted state with basic validation
let cart = {};
// PRODUCTS are loaded from Supabase (with automatic fallback to local JSON).
const WHATSAPP_NUMBER = '918610769343';

// Supabase Configuration
// Update these values with your Supabase Project URL and Anon Public Key
const SUPABASE_CONFIG = {
  url: "https://vbwasvblogmvlkfmuevy.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZid2FzdmJsb2dtdmxrZm11ZXZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5NDkzMzMsImV4cCI6MjEwMzUyNTMzM30.lUu9HM0JBV0Kwtz2nFnnU1qv6MI_IWL_ED6ra0PdKbk"
};

let supabaseClient = null;

function initSupabase() {
  if (supabaseClient) return supabaseClient;
  if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
    if (SUPABASE_CONFIG.url && !SUPABASE_CONFIG.url.includes('YOUR_SUPABASE_PROJECT_ID') &&
        SUPABASE_CONFIG.anonKey && !SUPABASE_CONFIG.anonKey.includes('YOUR_SUPABASE_ANON')) {
      try {
        supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        return supabaseClient;
      } catch (err) {
        console.warn('Failed to initialize Supabase client:', err);
      }
    }
  }
  return null;
}

// Backwards compatibility alias
function initFirestore() {
  return initSupabase();
}

function inferCategory(categories) {
  if (!categories) return 'all';
  const parts = parseCategoryPath(categories);
  if (parts.length && parts[0]) {
    return slugify(parts[0]);
  }
  return slugify(categories) || 'all';
}

function mapSupabaseDoc(row) {
  if (!row) return null;
  const data = typeof row.data === 'function' ? (row.data() || {}) : (row || {});
  const docId = data.id || data.sku || '';
  const categoriesPath = parseCategoryPath(data.categories || data.category);
  const images = normalizeImageList(data.images || data.image_url || data.imageUrl || data.product_images);
  const firstImage = images[0] || normalizeProductImage(data.image_url || data.imageUrl || data.image) || img(docId || '1');
  const createdAt = parseFirestoreTimestamp(data.created_at || data.createdAt || data.published_at || data.publishedAt);

  return {
    id: String(data.id || data.sku || docId),
    sku: String(data.sku || data.id || docId),
    cat: slugify(categoriesPath[0]) || data.cat || inferCategory(data.categories || data.category),
    subcat: categoriesPath[1] ? slugify(categoriesPath[1]) : (data.subcat ? slugify(data.subcat) : undefined),
    subsubcat: categoriesPath[2] ? slugify(categoriesPath[2]) : (data.subsubcat ? slugify(data.subsubcat) : undefined),
    categoriesPath,
    categoriesLabel: String(data.categories || data.category || '').trim(),
    brand: String(data.brand || '').trim(),
    title: String(data.name || data.title || '').trim(),
    description: String(data.description || data.full_details || '').trim(),
    price: Number(data.sale_price ?? data.regular_price ?? data.price ?? 0),
    mrp: Number(data.regular_price ?? data.sale_price ?? data.mrp ?? data.price ?? 0),
    rating: Number(data.rating ?? data.catalog_reviews_summary?.average_rating ?? 0),
    reviews: Number(data.reviews ?? data.catalog_reviews_summary?.review_count ?? 0),
    images,
    img: firstImage,
    deal: Boolean(data.deal || data.hot || false),
    published: data.published !== false,
    publishedAt: createdAt,
    in_stock: Boolean(data.in_stock ?? (data.stock > 0 || data.stock === undefined)),
    stock: Number(data.stock ?? 100),
    parent: data.parent ? String(data.parent).trim() : '',
    attribute_1_global: data.attribute_1_global,
    attribute_1_name: String(data.attribute_1_name || '').trim(),
    attribute_1_value: String(data.attribute_1_value || '').trim(),
    type: String(data.type || 'simple').trim(),
  };
}
const mapFirestoreDoc = mapSupabaseDoc;

let currentSupabasePage = 0;
let hasMoreSupabaseProducts = true;
let isFetchingSupabaseChunk = false;

function mergeProductsIntoGlobal(newItems) {
  if (!Array.isArray(newItems) || !newItems.length) return;
  const existingMap = new Map();
  PRODUCTS.forEach(p => {
    const key = String(p.id || p.sku || '');
    if (key) existingMap.set(key, p);
  });

  newItems.forEach(item => {
    if (!item) return;
    const key = String(item.id || item.sku || '');
    if (key) {
      existingMap.set(key, item);
    }
  });

  PRODUCTS = Array.from(existingMap.values());
  groupVariantProducts(PRODUCTS);
}

async function fetchProductsChunk({ limit = 20, reset = false, category = '', subcat = '' } = {}) {
  const sb = initSupabase();
  if (!sb) {
    hasMoreSupabaseProducts = false;
    return [];
  }

  if (reset) {
    currentSupabasePage = 0;
    hasMoreSupabaseProducts = true;
  }

  if (!hasMoreSupabaseProducts || isFetchingSupabaseChunk) {
    return [];
  }

  isFetchingSupabaseChunk = true;

  try {
    const from = currentSupabasePage * limit;
    const to = from + limit - 1;

    let query = sb
      .from('products')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (category && category !== 'all') {
      query = query.eq('cat', category);
    }

    const res = await Promise.race([
      query,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 6000))
    ]);

    const data = res?.data || [];
    const error = res?.error;

    if (error || !data || data.length === 0) {
      hasMoreSupabaseProducts = false;
      return [];
    }

    if (data.length < limit) {
      hasMoreSupabaseProducts = false;
    }

    currentSupabasePage++;

    const chunk = [];
    data.forEach(row => {
      const mapped = mapSupabaseDoc(row);
      if (mapped) chunk.push(mapped);
    });

    mergeProductsIntoGlobal(chunk);
    return chunk;
  } catch (err) {
    console.warn('Chunk fetch skipped / offline:', err);
    hasMoreSupabaseProducts = false;
    return [];
  } finally {
    isFetchingSupabaseChunk = false;
  }
}

async function fetchSingleProduct(targetId) {
  if (!targetId) return null;
  const target = String(targetId).trim();
  const rawId = extractProductIdFromSlug(target);

  // 1. Check in-memory PRODUCTS first
  let found = findProductById(target);
  if (found) return found;

  // 2. Query Supabase directly for this specific document / SKU / ID
  const sb = initSupabase();
  if (sb) {
    try {
      let orFilter = `id.eq."${target}",sku.eq."${target}"`;
      if (rawId && rawId !== target) {
        orFilter += `,id.eq."${rawId}",sku.eq."${rawId}"`;
      }
      const res = await Promise.race([
        sb.from('products').select('*').or(orFilter).limit(1),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
      ]);

      const items = res?.data || [];
      if (items.length > 0) {
        const item = mapSupabaseDoc(items[0]);
        if (item) {
          const parentKey = item.parent || item.groupId || item.sku;
          if (parentKey) {
            try {
              const varRes = await sb.from('products').select('*').eq('parent', parentKey).limit(50);
              const siblingRows = varRes?.data || [];
              const siblingVariants = siblingRows.map(vDoc => mapSupabaseDoc(vDoc)).filter(Boolean);
              mergeProductsIntoGlobal([item, ...siblingVariants]);
            } catch (e) {
              mergeProductsIntoGlobal([item]);
            }
          } else {
            mergeProductsIntoGlobal([item]);
          }
          return findProductById(target) || item;
        }
      }
    } catch (e) {
      console.warn('Single product fetch from Supabase skipped:', e);
    }
  }

  // 3. Final attempt from PRODUCTS
  return findProductById(target);
}

async function loadProductsFromSupabase() {
  return loadProducts();
}
const loadProductsFromFirestore = loadProductsFromSupabase;

async function loadProducts() {
  // Load real-time products directly from Supabase PostgreSQL database
  const sb = initSupabase();
  if (sb) {
    try {
      const res = await Promise.race([
        sb.from('products').select('*').eq('published', true).order('created_at', { ascending: false }).limit(2000),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000))
      ]);
      const data = res?.data || [];
      if (data.length > 0) {
        const mapped = data.map(mapSupabaseDoc).filter(Boolean);
        mergeProductsIntoGlobal(mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('Failed to load real-time products from Supabase:', err);
    }
  }
  return [];
}

/* ============ Instant Local Storage Cache Layer ============ */
const CACHE_KEY_PRODUCTS = 'nila_store_products_v5';
const CACHE_KEY_BANNERS = 'nila_store_banners_v5';

function cleanupLegacyCaches() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('nila_store_products_v1') ||
        key.startsWith('nila_store_products_v2') ||
        key.startsWith('nila_store_products_v3') ||
        key.startsWith('nila_store_products_v4') ||
        key.startsWith('nila_store_banners_v1') ||
        key.startsWith('nila_store_banners_v2') ||
        key.startsWith('nila_store_banners_v3') ||
        key.startsWith('nila_store_banners_v4') ||
        key === 'nila_store_products' ||
        key === 'nila_store_banners'
      )) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => {
      try { localStorage.removeItem(k); } catch (e) { }
    });
  } catch (e) { }
}

function minifyProductForCache(p) {
  return {
    id: String(p.id || p.sku || ''),
    sku: String(p.sku || p.id || ''),
    cat: p.cat || '',
    subcat: p.subcat || '',
    subsubcat: p.subsubcat || '',
    categoriesPath: Array.isArray(p.categoriesPath) ? p.categoriesPath : parseCategoryPath(p.categoriesLabel || p.categories || p.cat),
    categoriesLabel: p.categoriesLabel || '',
    brand: p.brand || '',
    title: p.title || '',
    description: typeof p.description === 'string' ? p.description.slice(0, 350) : '',
    price: Number(p.price) || 0,
    mrp: Number(p.mrp) || 0,
    rating: Number(p.rating) || 0,
    reviews: Number(p.reviews) || 0,
    img: p.img || '',
    images: Array.isArray(p.images) ? p.images.slice(0, 2) : [],
    deal: Boolean(p.deal),
    in_stock: p.in_stock !== false,
    parent: p.parent || '',
    attribute_1_name: p.attribute_1_name || '',
    attribute_1_value: p.attribute_1_value || '',
    type: p.type || 'simple'
  };
}

function loadProductsFromCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PRODUCTS);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      PRODUCTS = parsed.map(p => ({
        ...p,
        id: String(p.id || p.sku || ''),
        sku: String(p.sku || p.id || ''),
        categoriesPath: Array.isArray(p.categoriesPath) ? p.categoriesPath : parseCategoryPath(p.categoriesLabel || p.categories || p.cat)
      }));
      groupVariantProducts(PRODUCTS);
      return true;
    }
  } catch (e) {
    console.warn('Failed to parse cached products:', e);
  }
  return false;
}

function saveProductsToCache(products) {
  if (!Array.isArray(products) || !products.length) return;
  cleanupLegacyCaches();

  const minified = products.map(minifyProductForCache);

  // Attempt 1: Save full minified catalog
  try {
    localStorage.setItem(CACHE_KEY_PRODUCTS, JSON.stringify(minified));
    return;
  } catch (e1) {
    // Quota reached: purge and retry with compact top catalog
    try { localStorage.removeItem(CACHE_KEY_PRODUCTS); } catch (e) { }
  }

  // Attempt 2: Cache top 80 products for fast-path above-the-fold render
  try {
    const subset = minified.slice(0, 80);
    localStorage.setItem(CACHE_KEY_PRODUCTS, JSON.stringify(subset));
    return;
  } catch (e2) {
    try { localStorage.removeItem(CACHE_KEY_PRODUCTS); } catch (e) { }
  }

  // Attempt 3: Ultra-compact top 40 products
  try {
    const micro = minified.slice(0, 40).map(p => ({
      id: p.id,
      sku: p.sku,
      cat: p.cat,
      title: p.title,
      price: p.price,
      mrp: p.mrp,
      img: p.img,
      deal: p.deal
    }));
    localStorage.setItem(CACHE_KEY_PRODUCTS, JSON.stringify(micro));
  } catch (e3) {
    // If browser localStorage is completely exhausted by other origins, safely ignore
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
      const minifiedBanners = banners.slice(0, 10).map(b => ({
        id: b.id || '',
        title: b.title || '',
        image: b.image || '',
        url: b.url || ''
      }));
      localStorage.setItem(CACHE_KEY_BANNERS, JSON.stringify(minifiedBanners));
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

function extractProductIdFromSlug(slugOrId) {
  if (!slugOrId) return '';
  const str = String(slugOrId).trim();
  // If format is slug-{id} (e.g. bluetooth-headphones-and-earphones-540792198)
  const lastDash = str.lastIndexOf('-');
  if (lastDash > 0) {
    const candidate = str.slice(lastDash + 1).trim();
    if (candidate && (/^\d+$/.test(candidate) || candidate.length >= 4)) {
      return candidate;
    }
  }
  return str;
}

function findProductById(id) {
  if (id === undefined || id === null || id === '') return null;
  const target = String(id).trim();
  const targetSlug = slugify(target);
  const targetLower = target.toLowerCase();

  // 1. Direct EXACT ID / SKU / groupId / parent match (Raw untouched value)
  for (const p of PRODUCTS) {
    if (
      String(p.id || '').trim() === target ||
      String(p.sku || '').trim().toLowerCase() === targetLower ||
      (p.groupId && String(p.groupId).trim() === target) ||
      (p.parent && String(p.parent).trim() === target)
    ) {
      return p;
    }
  }

  // 2. Direct EXACT match inside nested group variants
  for (const p of PRODUCTS) {
    if (p.groupVariants && Array.isArray(p.groupVariants)) {
      for (const v of p.groupVariants) {
        if (
          String(v.id || '').trim() === target ||
          String(v.sku || '').trim().toLowerCase() === targetLower ||
          (v.groupId && String(v.groupId).trim() === target) ||
          (v.parent && String(v.parent).trim() === target)
        ) {
          return v;
        }
      }
    }
  }

  // 3. Exact full getProductSlug(p) match (e.g. bluetooth-headphones-and-earphones-540792198)
  for (const p of PRODUCTS) {
    if (getProductSlug(p) === targetSlug) {
      return p;
    }
  }
  for (const p of PRODUCTS) {
    if (p.groupVariants && Array.isArray(p.groupVariants)) {
      for (const v of p.groupVariants) {
        if (getProductSlug(v) === targetSlug) {
          return v;
        }
      }
    }
  }

  // 4. Match by slugified SKU / ID suffix in getProductSlug
  for (const p of PRODUCTS) {
    const pSkuSlug = slugify(p.sku || p.id || '');
    if (pSkuSlug && targetSlug.endsWith(pSkuSlug)) {
      return p;
    }
  }

  // 5. Fallback title slug match (for legacy URLs)
  for (const p of PRODUCTS) {
    if (slugify(p.title || '') === targetSlug) {
      return p;
    }
  }

  // 6. Fallback partial/fuzzy match
  if (targetSlug.length > 3) {
    for (const p of PRODUCTS) {
      const pSlug = slugify(p.title || '');
      if (pSlug && (pSlug.includes(targetSlug) || targetSlug.includes(pSlug))) {
        return p;
      }
    }
  }

  return null;
}

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
  if (!product) return '';
  const titleSlug = slugify(product.title || product.name || 'product');
  const uniqueId = String(product.sku || product.id || '').trim();
  if (uniqueId && !titleSlug.endsWith(uniqueId)) {
    return `${titleSlug}-${uniqueId}`;
  }
  return titleSlug || uniqueId;
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
  const p = findProductById(productId);
  if (!p) return;
  const sizeDetail = requestedSize ? ` (Size: ${requestedSize})` : '';
  const itemSku = p.sku || p.id || '';
  const skuDetail = itemSku ? ` (N-Item No: ${itemSku})` : '';
  const totalVal = rupee(p.price * requestedQty);
  const text = `Hello Nila Store, I would like to order this product:\n\n*${p.title}*${sizeDetail}${skuDetail}\nQuantity: ${requestedQty}\nPrice: ${rupee(p.price)} each\nTotal: ${totalVal}\nProduct Link: ${getProductAbsoluteUrl(p)}\n\nPlease confirm availability and delivery details.`;
  openWhatsAppUrl(text);
}

async function shareProduct(productId) {
  const product = findProductById(productId);
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
  const product = findProductById(targetId);
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

async function renderProductPage() {
  const pageContent = document.getElementById('productPageContent');
  if (!pageContent) return;

  const params = new URLSearchParams(window.location.search);
  const targetId = params.get('product') || params.get('name') || params.get('id') || params.get('p') || params.get('sku');

  if (!targetId) {
    pageContent.innerHTML = `
      <div class="empty-state fade-in">
        <div class="big-emoji">🛍️</div>
        <h2>Select a product to view details</h2>
        <p>Browse our top collections and deals from the homepage.</p>
        <a href="index.html" class="btn btn-primary" style="margin-top: 14px; display: inline-block;">Back to Homepage</a>
      </div>`;
    return;
  }

  // Display smooth shimmer skeleton immediately while resolving single product
  pageContent.innerHTML = `
    <div class="pdp-wrap pdp-skeleton fade-in">
      <div class="skeleton-line w-40" style="margin-bottom: 20px; height: 16px;"></div>
      <div class="pdp-skeleton-grid">
        <div class="skeleton-media" style="aspect-ratio: 1/1; border-radius: 12px;"></div>
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div class="skeleton-line w-80" style="height: 28px;"></div>
          <div class="skeleton-line w-40" style="height: 20px;"></div>
          <div class="skeleton-line w-60" style="height: 40px; margin-top: 8px;"></div>
          <div class="skeleton-line" style="height: 48px; border-radius: 8px; margin-top: 14px;"></div>
        </div>
      </div>
    </div>`;

  const product = await fetchSingleProduct(targetId);

  if (!product) {
    pageContent.innerHTML = `
      <div class="empty-state fade-in">
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
            <img src="${esc(src)}" alt="${esc(selectedProduct.title)}" width="64" height="64" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${FALLBACK_PRODUCT_IMAGE}'">
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
    <div class="pdp-wrap fade-in">
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
              <img id="pdpMainImage" src="${esc(currentImg)}" alt="${esc(selectedProduct.title)}" width="600" height="600" loading="eager" fetchpriority="high" decoding="async" onerror="this.onerror=null;this.src='${FALLBACK_PRODUCT_IMAGE}'">
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
              <button type="button" class="btn btn-primary pdp-btn-cart" id="pdpAddToCartBtn" data-pdp-add="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                Add to Cart
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
          <button type="button" class="btn btn-primary pdp-btn-cart" id="pdpMobileAddToCart" data-pdp-add="true">
            Add to Cart
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
  const handleAddToCart = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    addToCart(selectedProduct.id, selectedQty, selectedSize);
  };
  window.currentPdpAddToCart = handleAddToCart;
  document.getElementById('pdpAddToCartBtn')?.addEventListener('click', handleAddToCart);
  document.getElementById('pdpMobileAddToCart')?.addEventListener('click', handleAddToCart);

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

function matchesSearchQuery(product, query) {
  if (!product || !query) return false;
  const q = String(query).trim().toLowerCase();
  if (!q) return false;
  const qClean = q.replace(/[^a-z0-9]/gi, '');
  const qWords = q.split(/\s+/).filter((w) => w.length > 1);

  const checkItem = (item) => {
    if (!item) return false;
    const idStr = String(item.id || '').trim().toLowerCase();
    const skuStr = String(item.sku || '').trim().toLowerCase();
    const groupIdStr = String(item.groupId || '').trim().toLowerCase();
    const parentStr = String(item.parent || '').trim().toLowerCase();
    const titleStr = String(item.title || item.name || '').trim().toLowerCase();
    const brandStr = String(item.brand || '').trim().toLowerCase();
    const descStr = String(item.description || '').trim().toLowerCase();
    const catLabelStr = String(item.categoriesLabel || item.categories || '').trim().toLowerCase();
    const catStr = String(item.cat || '').trim().toLowerCase();
    const subcatStr = String(item.subcat || '').trim().toLowerCase();
    const subsubcatStr = String(item.subsubcat || '').trim().toLowerCase();

    // 1. Exact or sanitized SKU / ID / Code match
    if (idStr === q || skuStr === q || groupIdStr === q || parentStr === q) return true;
    if (qClean && (idStr.replace(/[^a-z0-9]/gi, '') === qClean || skuStr.replace(/[^a-z0-9]/gi, '') === qClean)) return true;

    // 2. Partial SKU / ID match
    if (idStr.includes(q) || skuStr.includes(q) || (qClean.length >= 4 && (idStr.includes(qClean) || skuStr.includes(qClean)))) return true;

    // 3. Text match across title, brand, categories, description
    if (
      titleStr.includes(q) ||
      brandStr.includes(q) ||
      catLabelStr.includes(q) ||
      catStr.includes(q) ||
      subcatStr.includes(q) ||
      subsubcatStr.includes(q) ||
      descStr.includes(q)
    ) return true;

    // 4. Clean unspaced match (e.g. "facewash" matches "face wash", "tshirt" matches "t-shirt")
    if (qClean.length >= 3) {
      const fullCleanText = `${titleStr} ${brandStr} ${catLabelStr} ${descStr}`.replace(/[^a-z0-9]/gi, '');
      if (fullCleanText.includes(qClean)) return true;
    }

    // 5. Multi-word match: all search words must be found in item text
    if (qWords.length > 1) {
      const combined = `${titleStr} ${brandStr} ${catLabelStr} ${catStr} ${subcatStr} ${descStr}`;
      if (qWords.every((w) => combined.includes(w))) return true;
    }

    return false;
  };

  // Check top-level product
  if (checkItem(product)) return true;

  // Check all nested groupVariants
  if (Array.isArray(product.groupVariants)) {
    for (const variant of product.groupVariants) {
      if (checkItem(variant)) return true;
    }
  }

  return false;
}

let categoryObserver = null;
async function renderCategoryPage() {
  const pageContent = document.getElementById('categoryPageContent');
  const pageTitle = document.getElementById('categoryPageTitle');
  const pageDesc = document.getElementById('categoryPageDescription');
  if (!pageContent) return;

  const { cat, subcat, subsubcat, search } = parseQueryParams();

  // If PRODUCTS array is empty on cold load or direct link visit, fetch from Supabase first
  if (!PRODUCTS.length) {
    pageContent.innerHTML = `<div class="empty-state"><div class="loader-spinner" style="margin: 0 auto 16px;"></div><h3>Loading products...</h3></div>`;
    await loadProducts();
  }

  const catalog = filterCatalogProducts(PRODUCTS);

  // 1. Search Query Mode
  if (search) {
    let matches = catalog.filter((p) => matchesSearchQuery(p, search));

    if (!matches.length) {
      const rawMatches = PRODUCTS.filter((p) => matchesSearchQuery(p, search));
      const seen = new Set();
      matches = rawMatches.filter((p) => {
        const key = p.groupId || p.parent || p.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    if (pageTitle) pageTitle.textContent = `Search results for "${search}"`;
    if (pageDesc) pageDesc.textContent = `${matches.length} product${matches.length === 1 ? '' : 's'} found.`;

    if (!matches.length) {
      pageContent.innerHTML = `<div class="empty-state"><div class="big-emoji">🔍</div><h3>No products found for "${esc(search)}"</h3><p>Try searching with product name, SKU / code, or category.</p><a href="index.html" class="btn btn-outline">Back to home</a></div>`;
      return;
    }
    renderProgressiveProductGrid(pageContent, matches);
    return;
  }

  // 2. Matching helpers with resilient punctuation, ampersand and stopword normalization
  const normalizeForMatch = (val) => {
    return String(val || '')
      .toLowerCase()
      .replace(/[&_/-]+/g, ' ')
      .replace(/\band\b/g, ' ')
      .replace(/[^a-z0-9]+/g, '')
      .replace(/s$/, '');
  };

  const matchCat = (p, targetCat) => {
    if (!targetCat) return true;
    const nc = normalizeForMatch(targetCat);
    if (!nc) return true;
    const pCatAll = normalizeForMatch(`${p.cat || ''} ${p.categoriesLabel || ''} ${(Array.isArray(p.categoriesPath) ? p.categoriesPath.join(' ') : '')}`);
    return pCatAll.includes(nc);
  };

  const matchSub = (p, targetSub) => {
    if (!targetSub) return true;
    const ns = normalizeForMatch(targetSub);
    if (!ns) return true;
    const pSubAll = normalizeForMatch(`${p.subcat || ''} ${p.categoriesLabel || ''} ${(Array.isArray(p.categoriesPath) ? p.categoriesPath.join(' ') : '')} ${p.title || ''}`);
    return pSubAll.includes(ns);
  };

  const matchSubsub = (p, targetSubsub) => {
    if (!targetSubsub) return true;
    const nss = normalizeForMatch(targetSubsub);
    if (!nss) return true;
    const pSubsubAll = normalizeForMatch(`${p.subsubcat || ''} ${p.categoriesLabel || ''} ${(Array.isArray(p.categoriesPath) ? p.categoriesPath.join(' ') : '')} ${p.title || ''}`);
    return pSubsubAll.includes(nss);
  };

  let items = [];
  if (cat || subcat || subsubcat) {
    items = catalog.filter((p) => matchCat(p, cat) && matchSub(p, subcat) && matchSubsub(p, subsubcat));
    if (!items.length) {
      const rawMatches = PRODUCTS.filter((p) => matchCat(p, cat) && matchSub(p, subcat) && matchSubsub(p, subsubcat));
      const seen = new Set();
      items = rawMatches.filter(p => {
        const k = p.groupId || p.parent || p.id;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
  } else {
    items = catalog.length ? catalog : PRODUCTS;
  }

  // Build interactive breadcrumbs matching product page
  const breadcrumbsEl = document.getElementById('categoryBreadcrumbs');
  const cleanCat = cat ? cat.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'All Collections';
  const cleanSub = subcat ? subcat.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
  const cleanSubsub = subsubcat ? subsubcat.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';

  if (breadcrumbsEl) {
    if (search) {
      breadcrumbsEl.innerHTML = `
        <a href="index.html">Home</a>
        <span class="sep">›</span>
        <span class="current">Search: "${esc(search)}" (${items.length})</span>
      `;
    } else if (cat) {
      let bHtml = `<a href="index.html">Home</a><span class="sep">›</span>`;
      const category = CATEGORIES.find((c) => c.id === cat || slugify(c.id) === slugify(cat) || normalizeForMatch(c.id) === normalizeForMatch(cat) || normalizeForMatch(c.label) === normalizeForMatch(cat));
      const catLabel = category ? category.label : cleanCat;
      const catId = category ? category.id : cat;

      if (!subcat && !subsubcat) {
        bHtml += `<span class="current">${esc(catLabel)} (${items.length})</span>`;
      } else {
        bHtml += `<a href="category.html?cat=${encodeURIComponent(catId)}">${esc(catLabel)}</a><span class="sep">›</span>`;
        if (subcat && !subsubcat) {
          const parentSub = category?.subcats?.find((s) => s.id === subcat || slugify(s.id) === slugify(subcat) || normalizeForMatch(s.id) === normalizeForMatch(subcat) || normalizeForMatch(s.label) === normalizeForMatch(subcat));
          const subLabel = parentSub ? parentSub.label : cleanSub;
          bHtml += `<span class="current">${esc(subLabel)} (${items.length})</span>`;
        } else if (subcat && subsubcat) {
          const parentSub = category?.subcats?.find((s) => s.id === subcat || slugify(s.id) === slugify(subcat) || normalizeForMatch(s.id) === normalizeForMatch(subcat) || normalizeForMatch(s.label) === normalizeForMatch(subcat));
          const subLabel = parentSub ? parentSub.label : cleanSub;
          const subId = parentSub ? parentSub.id : subcat;
          bHtml += `<a href="category.html?cat=${encodeURIComponent(catId)}&subcat=${encodeURIComponent(subId)}">${esc(subLabel)}</a><span class="sep">›</span>`;
          const childSub = parentSub?.children?.find((ch) => ch.id === subsubcat || slugify(ch.id) === slugify(subsubcat) || normalizeForMatch(ch.id) === normalizeForMatch(subsubcat) || normalizeForMatch(ch.label) === normalizeForMatch(subsubcat));
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

  renderProgressiveProductGrid(pageContent, items, { cat });
}

function populateSearchCategoryDropdown() {
  const searchCatSelects = document.querySelectorAll('#searchCat');
  if (!searchCatSelects.length) return;

  const urlParams = new URLSearchParams(window.location.search);
  const currentCat = urlParams.get('cat') || 'all';

  searchCatSelects.forEach((select) => {
    const existingVal = select.value || currentCat;
    const options = [`<option value="all">All categories</option>`];
    CATEGORIES.forEach((c) => {
      const isSelected = c.id === existingVal ? ' selected' : '';
      options.push(`<option value="${esc(c.id)}"${isSelected}>${esc(c.label)}</option>`);
    });
    select.innerHTML = options.join('');
  });
}

function renderProgressiveProductGrid(container, items, queryContext = {}) {
  const CHUNK_SIZE = 20;
  let renderedCount = 0;

  container.innerHTML = `
    <div class="product-grid" id="categoryProductGrid"></div>
    <div id="categorySentinel" style="height: 40px; margin-top: 15px; display: flex; align-items: center; justify-content: center;"></div>
  `;

  const grid = document.getElementById('categoryProductGrid');
  const sentinel = document.getElementById('categorySentinel');

  const appendChunk = async () => {
    // 1. Render in-memory items first
    if (renderedCount < items.length) {
      const nextBatch = items.slice(renderedCount, renderedCount + CHUNK_SIZE);
      grid.insertAdjacentHTML('beforeend', nextBatch.map((p, i) => productCard(p, renderedCount + i)).join(''));
      renderedCount += nextBatch.length;
    }

    // 2. If finished in-memory list and Supabase has more, load next chunk
    if (renderedCount >= items.length && typeof hasMoreSupabaseProducts !== 'undefined' && hasMoreSupabaseProducts && !isFetchingSupabaseChunk) {
      if (sentinel) {
        sentinel.innerHTML = `<div class="pagination-loader"><div class="pagination-spinner"></div><span>Loading more products...</span></div>`;
      }
      try {
        const moreProducts = await fetchProductsChunk({ limit: CHUNK_SIZE, category: queryContext.cat || '' });
        if (moreProducts && moreProducts.length) {
          const newMatching = moreProducts.filter(p => {
            if (queryContext.cat && !matchCat(p, queryContext.cat)) return false;
            if (queryContext.search && !matchesSearchQuery(p, queryContext.search)) return false;
            return true;
          });
          if (newMatching.length) {
            grid.insertAdjacentHTML('beforeend', newMatching.map((p, i) => productCard(p, renderedCount + i)).join(''));
            renderedCount += newMatching.length;
          }
        }
      } catch (e) { }
    }

    if ((typeof hasMoreSupabaseProducts === 'undefined' || !hasMoreSupabaseProducts) && renderedCount >= items.length) {
      if (categoryObserver && sentinel) categoryObserver.unobserve(sentinel);
      if (sentinel) sentinel.innerHTML = '';
    }
  };

  appendChunk();

  if (sentinel) {
    if (categoryObserver) categoryObserver.disconnect();
    categoryObserver = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        appendChunk();
      }
    }, { rootMargin: '350px' });
    categoryObserver.observe(sentinel);
  }
}

function positionMobileCategoryDropdown(wrap, btn, dropdown) {
  if (!dropdown || window.innerWidth > 768) return;
  
  // Measure button rect relative to viewport
  const rect = btn.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  
  // Set vertical position below chip
  dropdown.style.top = `${Math.round(rect.bottom + 6)}px`;
  
  // Determine width constrained by screen
  const targetWidth = Math.min(230, viewportWidth - 24);
  dropdown.style.width = `${targetWidth}px`;
  
  // Center dropdown below button if possible, but keep within viewport bounds [12px, viewportWidth - targetWidth - 12px]
  let left = Math.round(rect.left + (rect.width / 2) - (targetWidth / 2));
  if (left + targetWidth > viewportWidth - 12) {
    left = viewportWidth - targetWidth - 12;
  }
  if (left < 12) {
    left = 12;
  }
  dropdown.style.left = `${left}px`;
}

function renderCategoryChrome() {
  populateSearchCategoryDropdown();

  const rail = document.getElementById('categoryRail');
  if (rail) {
    // Only generate HTML if the category rail is completely empty in HTML
    if (!rail.children.length && Array.isArray(CATEGORIES) && CATEGORIES.length > 0) {
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
    }

    const wraps = rail.querySelectorAll('.cat-chip-wrap');
    const closeAllCategoryDropdowns = () => {
      wraps.forEach(w => {
        w.classList.remove('open');
        const b = w.querySelector('.cat-chip');
        if (b) b.setAttribute('aria-expanded', 'false');
      });
    };

    wraps.forEach(wrap => {
      const btn = wrap.querySelector('.cat-chip');
      const dropdown = wrap.querySelector('.cat-dropdown');
      if (!btn) return;

      btn.onclick = (e) => {
        if (!dropdown) {
          window.location.href = `category.html?cat=${btn.dataset.catId || slugify(btn.textContent)}`;
          return;
        }
        // Toggle on touch/mobile screens
        if (window.innerWidth <= 768) {
          e.stopPropagation();
          const isOpen = wrap.classList.contains('open');
          closeAllCategoryDropdowns();
          if (!isOpen) {
            positionMobileCategoryDropdown(wrap, btn, dropdown);
            wrap.classList.add('open');
            btn.setAttribute('aria-expanded', 'true');
          }
        }
      };
    });

    // Close open dropdowns when scrolling the horizontal rail
    rail.addEventListener('scroll', closeAllCategoryDropdowns, { passive: true });

    // Close open dropdowns when scrolling the window or resizing
    window.addEventListener('scroll', closeAllCategoryDropdowns, { passive: true });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        rail.querySelectorAll('.cat-dropdown').forEach(d => {
          d.style.top = '';
          d.style.left = '';
          d.style.width = '';
        });
      }
      closeAllCategoryDropdowns();
    }, { passive: true });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.cat-chip-wrap')) {
        closeAllCategoryDropdowns();
      }
    });
  }

  const mobileNavList = document.getElementById('mobileNavList');
  if (mobileNavList && !mobileNavList.children.length && Array.isArray(CATEGORIES) && CATEGORIES.length > 0) {
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
        <img src="${imageSrc}" alt="${esc(p.title || 'Product')}" loading="${isPriority ? 'eager' : 'lazy'}" onerror="this.onerror=null;this.src='${FALLBACK_PRODUCT_IMAGE}'" decoding="async"${isPriority ? ' fetchpriority="high"' : ''} width="400" height="400">
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
  const validCategories = CATEGORIES.filter(c => allCatalog.some(p => p.cat === c.id || slugify(p.cat) === c.id));
  const selectedCategories = validCategories.slice(0, 6);

  container.innerHTML = selectedCategories.map(c => {
    const catProducts = allCatalog.filter(p => p.cat === c.id || slugify(p.cat) === c.id);
    const randomProducts = shuffleArray(catProducts).slice(0, 8);
    if (!randomProducts.length) return '';

    return `
      <section class="cat-section" id="cat-${c.id}">
        <div class="wrap">
          <div class="section-head">
            <div>
              <h2>${c.emoji ? c.emoji + ' ' : ''}${c.label}</h2>
              <p class="section-sub">Explore best styles &amp; deals</p>
            </div>
            <a href="category.html?cat=${c.id}" class="view-all-link">View all ›</a>
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
    const sb = initSupabase();
    if (sb) {
      const res = await sb.from('banners').select('*').eq('active', true);
      const data = res?.data || [];
      if (data.length) {
        const loaded = [];
        data.forEach(d => {
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
    console.warn('Could not load banners from Supabase —', e);
  }
}

let carIndex = 0;
let carTimer = null;
let isCarouselDragging = false;
let carDragStartX = 0;
let carDragCurrentX = 0;
let hasCarDragMoved = false;

function renderCarousel() {
  const track = document.getElementById('carouselTrack');
  const dots = document.getElementById('carDots');
  const carouselEl = document.getElementById('carousel');
  const prevBtn = document.getElementById('carPrev');
  const nextBtn = document.getElementById('carNext');
  if (!track || !BANNER_SLIDES.length) return;

  track.innerHTML = BANNER_SLIDES.map((s, i) => {
    const targetUrl = s.url || '#';
    const isExternal = /^https?:\/\//i.test(targetUrl) && !targetUrl.includes(window.location.hostname);
    return `
      <a href="${esc(targetUrl)}" class="slide" ${isExternal ? 'target="_blank" rel="noopener noreferrer"' : ''} title="${esc(s.title || 'Banner Slide')}">
        <img src="${esc(s.image)}" alt="${esc(s.title || 'Special Promotion')}" class="slide-banner-img" loading="${i === 0 ? 'eager' : 'lazy'}"${i === 0 ? ' fetchpriority="high"' : ''} decoding="async" draggable="false">
      </a>
    `;
  }).join('');

  if (dots) {
    dots.innerHTML = BANNER_SLIDES.map((_, i) => `<button type="button" data-i="${i}" class="${i === 0 ? 'active' : ''}" aria-label="Go to slide ${i + 1}"></button>`).join('');
    dots.querySelectorAll('button').forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        goToSlide(+b.dataset.i);
      };
    });
  }

  // Navigation Arrow Buttons
  if (prevBtn) {
    prevBtn.onclick = (e) => {
      e.stopPropagation();
      goToSlide(carIndex - 1);
    };
  }
  if (nextBtn) {
    nextBtn.onclick = (e) => {
      e.stopPropagation();
      goToSlide(carIndex + 1);
    };
  }

  // Prevent link click when dragging
  track.querySelectorAll('.slide').forEach(slide => {
    slide.onclick = (e) => {
      if (hasCarDragMoved) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
  });

  // Desktop Mouse Drag & Mobile Touch Gestures
  const onDragStart = (clientX) => {
    isCarouselDragging = true;
    hasCarDragMoved = false;
    carDragStartX = clientX;
    carDragCurrentX = clientX;
    clearInterval(carTimer);
    track.classList.add('is-dragging');
  };

  const onDragMove = (clientX) => {
    if (!isCarouselDragging) return;
    const diff = clientX - carDragStartX;
    if (Math.abs(diff) > 5) {
      hasCarDragMoved = true;
    }
    carDragCurrentX = clientX;
    const trackWidth = track.offsetWidth || 1;
    const percentDiff = (diff / trackWidth) * 100;
    const currentPercent = -(carIndex * 100) + percentDiff;
    track.style.transform = `translateX(${currentPercent}%)`;
  };

  const onDragEnd = () => {
    if (!isCarouselDragging) return;
    isCarouselDragging = false;
    track.classList.remove('is-dragging');
    const diff = carDragCurrentX - carDragStartX;
    const threshold = 40; // min drag distance in px

    if (diff < -threshold) {
      goToSlide(carIndex + 1);
    } else if (diff > threshold) {
      goToSlide(carIndex - 1);
    } else {
      goToSlide(carIndex); // snap back
    }
    setTimeout(() => { hasCarDragMoved = false; }, 50);
  };

  // Mouse events
  track.onmousedown = (e) => {
    if (e.button !== 0) return; // Left click only
    onDragStart(e.clientX);
  };
  window.onmousemove = (e) => {
    if (isCarouselDragging) onDragMove(e.clientX);
  };
  window.onmouseup = () => {
    if (isCarouselDragging) onDragEnd();
  };

  // Touch events
  track.ontouchstart = (e) => {
    if (e.touches && e.touches.length) onDragStart(e.touches[0].clientX);
  };
  track.ontouchmove = (e) => {
    if (e.touches && e.touches.length) onDragMove(e.touches[0].clientX);
  };
  track.ontouchend = () => {
    onDragEnd();
  };

  // Pause on hover, resume on mouseleave
  if (carouselEl) {
    carouselEl.onmouseenter = () => clearInterval(carTimer);
    carouselEl.onmouseleave = () => startCarouselAuto();
  }

  // Keyboard navigation
  carouselEl.setAttribute('tabindex', '0');
  carouselEl.onkeydown = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goToSlide(carIndex - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goToSlide(carIndex + 1);
    }
  };

  goToSlide(0);
}

function goToSlide(i) {
  if (!BANNER_SLIDES.length) return;
  carIndex = (i + BANNER_SLIDES.length) % BANNER_SLIDES.length;
  const track = document.getElementById("carouselTrack");
  if (track) {
    track.classList.remove('is-dragging');
    track.style.transform = `translateX(-${carIndex * 100}%)`;
  }
  document.querySelectorAll(".carousel-dots button").forEach((b, idx) => b.classList.toggle("active", idx === carIndex));
  startCarouselAuto();
}

function startCarouselAuto() {
  clearInterval(carTimer);
  if (BANNER_SLIDES.length > 1) {
    carTimer = setInterval(() => {
      if (!isCarouselDragging) {
        goToSlide(carIndex + 1);
      }
    }, 4500);
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
  term = (term || '').trim();
  if (!term) return;

  const catContainer = document.getElementById('categorySections') || document.getElementById('categoryPageContent');
  if (!catContainer) {
    window.location.href = `category.html?search=${encodeURIComponent(term)}`;
    return;
  }

  const catalog = filterCatalogProducts(PRODUCTS);
  let matches = catalog.filter((p) => matchesSearchQuery(p, term));

  if (!matches.length) {
    const rawMatches = PRODUCTS.filter((p) => matchesSearchQuery(p, term));
    const seen = new Set();
    matches = rawMatches.filter((p) => {
      const key = p.groupId || p.parent || p.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  if (document.getElementById('categoryPageTitle')) {
    document.getElementById('categoryPageTitle').textContent = `Search results for "${term}"`;
  }
  if (document.getElementById('categoryPageDescription')) {
    document.getElementById('categoryPageDescription').textContent = `${matches.length} product${matches.length === 1 ? '' : 's'} found.`;
  }

  if (document.getElementById('categoryPageContent')) {
    if (!matches.length) {
      document.getElementById('categoryPageContent').innerHTML = `
        <div class="empty-state">
          <div class="big-emoji">🔍</div>
          <h3>No products found for "${esc(term)}"</h3>
          <p>Try searching with product name, SKU / code, or category.</p>
          <a href="index.html" class="btn btn-outline">Back to home</a>
        </div>`;
      return;
    }
    renderProgressiveProductGrid(document.getElementById('categoryPageContent'), matches);
    return;
  }

  catContainer.innerHTML = `
    <section class="cat-section">
      <div class="wrap">
        <div class="section-head">
          <div>
            <h2>Search results for "${esc(term)}"</h2>
            <p class="section-sub">${matches.length} product${matches.length === 1 ? '' : 's'} found</p>
          </div>
        </div>
        ${!matches.length ? `
          <div class="empty-state">
            <div class="big-emoji">🔍</div>
            <h3>No products found for "${esc(term)}"</h3>
            <p>Try searching with product name, SKU / code, or category.</p>
          </div>
        ` : `
          <div class="product-grid">${matches.map((p, i) => productCard(p, i)).join("")}</div>
        `}
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
let lastAddToCartTime = 0;
function addToCart(id, qty = 1, requestedSize = '') {
  const now = Date.now();
  if (now - lastAddToCartTime < 150) return;
  lastAddToCartTime = now;

  let product = findProductById(id);
  if (!product) {
    const params = new URLSearchParams(window.location.search);
    const targetParam = params.get('product') || params.get('name') || params.get('id') || params.get('sku');
    if (targetParam) {
      product = findProductById(targetParam);
    }
  }
  if (!product) {
    console.warn('addToCart: unable to find product for ID:', id);
    return;
  }

  const selectedProduct = product;
  const selectedSize = requestedSize || (selectedProduct.optionValues && selectedProduct.optionValues[0]) || variationValuesForProduct(selectedProduct)[0] || '';
  const cartId = cartLineId(selectedProduct.id, selectedSize);
  cart[cartId] = (cart[cartId] || 0) + (Number(qty) || 1);
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
  // Prune stale entries only when full product catalog is loaded
  if (Array.isArray(PRODUCTS) && PRODUCTS.length > 0) {
    Object.keys(cart).forEach((id) => {
      const isAvailable = Boolean(findProductById(cartProductId(id)));
      if (!isAvailable) delete cart[id];
    });
    saveCart();
  }

  const ids = Object.keys(cart);
  const body = document.getElementById("cartBody");
  const foot = document.getElementById("cartFoot");
  const countEl = document.getElementById("cartCount");
  const checkoutBtn = document.getElementById("checkoutBtn");
  const checkoutPanel = document.getElementById("checkoutPanel");
  if (!body || !foot || !countEl) return;
  const totalQty = ids.reduce((s, id) => s + (Number(cart[id]) || 0), 0);
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
    const p = findProductById(cartProductId(id));
    const qty = cart[id];
    if (!p) return '';
    subtotal += p.price * qty;
    const selectedSize = cartSelectedSize(id);
    return `
      <div class="cart-item">
        <img src="${p.img || FALLBACK_PRODUCT_IMAGE}" alt="${esc(p.title)}" width="64" height="64" decoding="async" onerror="this.onerror=null;this.src='${FALLBACK_PRODUCT_IMAGE}'">
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
      <img src="${p.img || FALLBACK_PRODUCT_IMAGE}" alt="${esc(p.title)}" width="64" height="64" decoding="async" onerror="this.onerror=null;this.src='${FALLBACK_PRODUCT_IMAGE}'">
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

function buildWhatsAppMessage(name, phone, address, orderId = '') {
  const cartEntries = Object.entries(cart);
  const items = cartEntries.map(([id, qty]) => {
    const p = findProductById(cartProductId(id));
    if (!p) return null;
    const selectedSize = cartSelectedSize(id);
    const sizeDetail = selectedSize ? ` (${p.optionName || 'Size'}: ${selectedSize})` : '';
    const itemSku = p.sku || p.id || '';
    const skuDetail = itemSku ? ` (N-Item No: ${itemSku})` : '';
    return `${qty} x ${p.title}${sizeDetail}${skuDetail} @ ${rupee(p.price)} = ${rupee(p.price * qty)}`;
  }).filter(Boolean);
  const subtotal = cartEntries.reduce((sum, [id, qty]) => {
    const p = findProductById(cartProductId(id));
    return p ? sum + p.price * qty : sum;
  }, 0);
  const totalItems = cartEntries.reduce((sum, [, qty]) => sum + qty, 0);
  const orderRefText = orderId ? `\n*Order Reference: #${orderId}*` : '';
  const message = `Hello Nila Store, I would like to place an order.${orderRefText}\n\nName: ${name}\nPhone: ${phone}\nAddress: ${address}\n\nOrder details:\n${items.join('\n')}\n\nTotal items: ${totalItems}\nSubtotal: ${rupee(subtotal)}\n\nPlease confirm availability and delivery details.`;
  return encodeURIComponent(message);
}

function showOrderConfirmation(orderId = '') {
  const body = document.getElementById('cartBody');
  const foot = document.getElementById('cartFoot');
  if (!body || !foot) return;
  const orderBadge = orderId ? `<div style="background: #e0f2fe; color: #0284c7; padding: 0.4rem 0.8rem; border-radius: 6px; font-weight: 700; margin: 0.5rem auto 0.75rem; display: inline-block; font-size: 0.95rem;">Order Reference: #${orderId}</div>` : '';
  body.innerHTML = `
      <div class="cart-empty" style="padding: 2rem 1rem; text-align: center;">
        <div class="big-emoji" style="font-size: 3rem; margin-bottom: 0.5rem;">🎉</div>
        <h3 style="color: #0f172a; font-weight: 800; font-size: 1.25rem;">Order Recorded!</h3>
        ${orderBadge}
        <p style="color: #64748b; font-size: 0.9rem; line-height: 1.5; margin-bottom: 1.25rem;">Redirecting to WhatsApp to send your order details. Your order has also been registered in our system.</p>
        <button class="btn btn-primary btn-block" data-action="continue-shopping">Continue shopping</button>
      </div>`;
  foot.style.display = 'none';
}

async function sendCheckoutWhatsApp(event) {
  event.preventDefault();
  const name = document.getElementById('checkoutName')?.value.trim();
  const address = document.getElementById('checkoutAddress')?.value.trim();
  const phone = document.getElementById('checkoutPhone')?.value.trim();
  if (!name || !address || !phone) {
    showToast('Please complete the address and phone fields.');
    return;
  }
  const cartEntries = Object.entries(cart);
  if (!cartEntries.length) {
    showToast('Your cart is empty. Add items before checkout.');
    return;
  }

  // 1. Generate Order ID
  const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
  
  // 2. Build items payload
  const itemsArray = cartEntries.map(([id, qty]) => {
    const p = findProductById(cartProductId(id));
    if (!p) return null;
    const selectedSize = cartSelectedSize(id);
    const itemImg = (p.images && p.images.length > 0) 
      ? (typeof p.images[0] === 'string' ? p.images[0] : (p.images[0].url || '')) 
      : (p.image_url || '');
    return {
      id: p.id,
      title: p.title || p.name || 'Product',
      sku: p.sku || p.id || '',
      size: selectedSize || (p.attribute_1_value || 'Standard'),
      qty: Number(qty) || 1,
      price: Number(p.price || p.sale_price || 0),
      image: itemImg
    };
  }).filter(Boolean);

  const subtotal = cartEntries.reduce((sum, [id, qty]) => {
    const p = findProductById(cartProductId(id));
    return p ? sum + (Number(p.price) || 0) * qty : sum;
  }, 0);
  const totalItems = cartEntries.reduce((sum, [, qty]) => sum + qty, 0);

  const orderDoc = {
    id: orderId,
    order_number: orderId,
    customer_name: name,
    customer_phone: phone,
    customer_address: address,
    items: itemsArray,
    total_items: totalItems,
    subtotal: subtotal,
    shipping_fee: 0,
    total_amount: subtotal,
    payment_method: 'WhatsApp / COD',
    payment_status: 'Pending',
    order_status: 'Pending',
    notes: 'Order placed from Storefront',
    created_at: new Date().toISOString()
  };

  // 3. Persist order to Supabase / Backend Server & localStorage
  try {
    // Save to local storage
    try {
      const localOrders = JSON.parse(localStorage.getItem('nila_orders') || '[]');
      localOrders.unshift(orderDoc);
      localStorage.setItem('nila_orders', JSON.stringify(localOrders));
    } catch (e) {}

    // Post to backend API if available
    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderDoc)
    }).catch(() => {});

    // Save directly to Supabase client
    const sb = initSupabase();
    if (sb) {
      sb.from('orders').insert([orderDoc]).then(({ error }) => {
        if (error) console.warn('Direct Supabase order insert notice:', error);
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('Order persistence notice:', err);
  }

  // 4. Open WhatsApp
  const text = buildWhatsAppMessage(name, phone, address, orderId);
  openWhatsAppUrl(text);

  // 5. Reset cart and show confirmation
  cart = {};
  saveCart();
  renderCart();
  closeCheckoutPanel();
  showOrderConfirmation(orderId);
  showToast(`Order #${orderId} created! Redirecting to WhatsApp...`);
  setTimeout(() => {
    if (document.getElementById('cartDrawer')?.classList.contains('open')) {
      closeCart();
    }
  }, 6000);
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

  // Load dynamic category tree
  loadCategories();

  renderCategoryChrome();
  renderCarousel();
  renderDeals();
  if (document.getElementById('productPageContent')) {
    await renderProductPage();
  } else if (document.getElementById('categoryPageContent')) {
    await renderCategoryPage();
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

      // Re-render PDP only if not already rendered with product content
      if (document.getElementById('productPageContent')) {
        const hasContent = document.getElementById('productPageContent').querySelector('.pdp-details-card, .pdp-grid, .pdp-title');
        if (!hasContent) {
          renderProductPage();
        }
      } else if (document.getElementById('categoryPageContent')) {
        renderCategoryPage();
      } else {
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

  // Run network sync
  if (!hasCachedProducts || !PRODUCTS.length) {
    await syncData();
  } else {
    syncData();
  }

  // Global event delegation for dynamically generated controls
  document.body.addEventListener('click', (e) => {
    const pdpAdd = e.target.closest('[data-pdp-add], #pdpAddToCartBtn, #pdpMobileAddToCart');
    if (pdpAdd) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof window.currentPdpAddToCart === 'function') {
        window.currentPdpAddToCart(e);
      }
      return;
    }
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
