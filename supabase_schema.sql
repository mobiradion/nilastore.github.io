-- ==========================================================
-- Nila Store: Supabase PostgreSQL Schema & Security Policies
-- ==========================================================
-- Instructions:
-- 1. Open your Supabase Dashboard (https://supabase.com/dashboard)
-- 2. Go to the "SQL Editor" tab on the left menu.
-- 3. Paste this script and click "Run".
-- ==========================================================

-- 1. Create the products table
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    sku TEXT,
    name TEXT,
    title TEXT,
    brand TEXT DEFAULT '',
    categories TEXT DEFAULT '',
    cat TEXT DEFAULT 'all',
    subcat TEXT,
    subsubcat TEXT,
    description TEXT DEFAULT '',
    price NUMERIC DEFAULT 0,
    regular_price NUMERIC DEFAULT 0,
    sale_price NUMERIC DEFAULT 0,
    mrp NUMERIC DEFAULT 0,
    rating NUMERIC DEFAULT 0,
    reviews INTEGER DEFAULT 0,
    images JSONB DEFAULT '[]'::jsonb,
    image_url TEXT DEFAULT '',
    deal BOOLEAN DEFAULT false,
    published BOOLEAN DEFAULT true,
    in_stock BOOLEAN DEFAULT true,
    stock INTEGER DEFAULT 100,
    parent TEXT DEFAULT '',
    type TEXT DEFAULT 'simple',
    attribute_1_global BOOLEAN DEFAULT false,
    attribute_1_name TEXT DEFAULT '',
    attribute_1_value TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Performance indexes for category browsing, variation lookup, and pagination
CREATE INDEX IF NOT EXISTS idx_products_cat ON public.products (cat);
CREATE INDEX IF NOT EXISTS idx_products_parent ON public.products (parent);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products (sku);
CREATE INDEX IF NOT EXISTS idx_products_published ON public.products (published);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products (created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 4. Allow public READ access for customers browsing your store
DROP POLICY IF EXISTS "Public Read Access" ON public.products;
CREATE POLICY "Public Read Access" 
ON public.products 
FOR SELECT 
USING (true);

-- 5. Allow full access with Service Role Key (used by your Python admin server / migration scripts)
DROP POLICY IF EXISTS "Service Role Full Access" ON public.products;
CREATE POLICY "Service Role Full Access" 
ON public.products 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- 6. Trigger to automatically update updated_at timestamp on edit
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.products;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
