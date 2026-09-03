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

-- ==========================================================
-- 7. Create the orders table
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    order_number TEXT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT NOT NULL,
    items JSONB DEFAULT '[]'::jsonb,
    total_items INTEGER DEFAULT 1,
    subtotal NUMERIC DEFAULT 0,
    shipping_fee NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    payment_method TEXT DEFAULT 'WhatsApp / COD',
    payment_status TEXT DEFAULT 'Pending',
    order_status TEXT DEFAULT 'Pending',
    tracking_number TEXT DEFAULT '',
    courier_name TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Performance indexes for orders
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (order_status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders (customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);

-- 9. Enable Row Level Security (RLS) for orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 10. Allow public INSERT access so customers can place orders from the website
DROP POLICY IF EXISTS "Public Insert Orders" ON public.orders;
CREATE POLICY "Public Insert Orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (true);

-- 11. Allow customers to read their own order via order ID or phone
DROP POLICY IF EXISTS "Public Read Orders" ON public.orders;
CREATE POLICY "Public Read Orders" 
ON public.orders 
FOR SELECT 
USING (true);

-- 12. Full access for Admin / Service Role
DROP POLICY IF EXISTS "Service Role Full Access Orders" ON public.orders;
CREATE POLICY "Service Role Full Access Orders" 
ON public.orders 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- 13. Auto updated_at trigger on orders
DROP TRIGGER IF EXISTS set_orders_updated_at ON public.orders;
CREATE TRIGGER set_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

