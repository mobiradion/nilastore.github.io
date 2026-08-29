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

## 🛠️ Variation Importer (Web Form & CLI)

### 1. Launch Interactive Web Form
```bash
python import_server.py
```
Open **`http://localhost:8080`** in your browser to:
- Select or create custom category paths (e.g., `Women > Western Wear Ladies > Top`)
- Paste catalog JSON or upload `.json` product files
- Configure price markups (Regular Price & Sale Price)
- Preview size variations, pricing, and images
- Import directly to Supabase with real-time streaming progress

### 2. Command-Line Import
```bash
# Import with custom category and JSON file
python variation_import_supabase.py --category "Women > Ethnic Wear > Kurtis" --file my_catalog.json

# Import with custom pricing markups
python variation_import_supabase.py --category "Men > Western Wear > Casual Shirts" --regular-markup 350 --sale-markup 75
```

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
- WhatsApp Checkout integration
- 100% Cloud database-driven with Supabase PostgreSQL
