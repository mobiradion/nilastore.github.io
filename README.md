# Nila Store

A modern, fast e-commerce storefront (search-led home page, category navigation, deal cards, size variations, and a slide-in cart) powered by **Supabase PostgreSQL** and plain HTML/CSS/JS — ready for GitHub Pages.

---

## ⚡ Supabase Setup (Quickstart)

### 1. Create Supabase Table & Security Policies
1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase dashboard.
3. Paste the contents of `supabase_schema.sql` and click **Run**.

### 2. Configure Credentials
Add your Supabase Project URL and API Keys:

1. **Backend / Admin Importer**: Edit `supabase_config.json`:
```json
{
  "supabase_url": "https://your-project.supabase.co",
  "supabase_anon_key": "your-anon-key",
  "supabase_service_role_key": "your-service-role-key"
}
```

2. **Frontend Website**: In `script.js` (top of State section):
```javascript
const SUPABASE_CONFIG = {
  url: "https://your-project.supabase.co",
  anonKey: "your-anon-key"
};
```

---

## 🚀 Migrate Existing Products to Supabase
Run the automated migration tool to upload all products from `data.json` and `variation_data.json` directly into Supabase:

```bash
python migrate_to_supabase.py
```

---

## 🛠️ Admin Panel (Product Management, Orders & Importer)

### 1. Launch Admin Panel
```bash
python import_server.py
```
Or double-click `start_import_server.bat` to launch and open **`http://localhost:8080/admin.html`** in your browser.

### Key Capabilities in Admin:
- **🛍️ Product Management**:
  - Full catalog listing with instant search across title, SKU, brand, and category.
  - Multi-level category filtering, inventory status filters (In Stock, Low Stock, Out of Stock), and sorting.
  - One-click toggles: Published/Draft, In Stock/Out of Stock, and Deal of the Day ⭐.
  - Rich Product Editor modal: Create and edit products, manage pricing/MRP/discounts, inventory stock, multiple gallery images, and variable sizes.
  - Bulk actions: Multi-select products for bulk publish, unpublish, stock updates, and batch delete.
- **📦 Order Management**:
  - Live pipeline tracking: Pending ➔ Processing ➔ Shipped ➔ Delivered ➔ Cancelled.
  - Customer contact details with 1-click WhatsApp customer contact.
  - Line-item breakdown with product images, sizes, quantities, and price calculation.
  - Courier & tracking AWB assignment with automated timeline status updates.
  - Branded printable invoice & packing slip generator.
  - Manual order creation and 1-click CSV order export.
- **📥 Catalog Variation Importer**:
  - Paste catalog JSON or upload `.json` product files.
  - Dynamic pricing markups (Regular Price & Sale Price).
  - Preview size variations, pricing, and images before importing.
  - Real-time streaming progress to Supabase PostgreSQL.
- **📂 Categories & Banners Manager**:
  - Add, edit, or delete categories and store slider banners.

---

## 🌐 Deploy to GitHub Pages
1. Push your repository to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, select "Deploy from a branch" (`main` branch, root `/`).
4. Your storefront will be live immediately.

---

## What's included
- Sticky header with instant search (filters products by title, brand, or category)
- 100% Dynamic real-time category rail and hierarchy navigation from Supabase
- Deal cards, responsive grid, and live discount tags
- Variable product size selection and automated sibling variant clustering
- Slide-in cart and wishlist drawers, persisted via `localStorage`
- WhatsApp Checkout integration with unique Order ID recording & admin notification
- Complete Admin Panel with Product Management & Order Management
- 100% Cloud database-driven with Supabase PostgreSQL

