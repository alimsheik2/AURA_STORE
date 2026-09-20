/*
# Multi-Vendor E-Commerce Marketplace Schema

## Overview
Creates the complete database schema for a multi-vendor e-commerce marketplace (Amazon-inspired) with customer storefront, vendor dashboard, and admin control panel.

## New Tables
1. **profiles** — Extends auth.users with role (customer/vendor/admin), full name, phone, avatar.
2. **categories** — Product categories with commission rates, icons, and optional parent for nesting.
3. **shops** — Vendor shop profiles linked to a user (owner). Status: pending/approved/suspended.
4. **products** — Products listed by shops, with price, compare price, rating, status.
5. **product_images** — Multiple images per product with position ordering.
6. **product_variations** — Color/size/SKU/stock variations per product.
7. **cart_items** — Shopping cart items per user, supporting product + variation selection.
8. **orders** — Orders with COD payment, customer details, shipping address, status tracking.
9. **order_items** — Line items per order, each linked to a product and shop for vendor visibility.
10. **reviews** — Product ratings and comments by users.

## Security (RLS)
- All tables have RLS enabled.
- Public read access (anon + authenticated) on: categories, shops (approved only), products (active only), product_images, product_variations, reviews.
- Authenticated users can CRUD their own cart_items, orders, reviews.
- Vendors can manage their own shops, products, product_images, product_variations, and view order_items for their shop.
- Admins have full access to shops, orders, order_items, categories.
- Role checks use a helper function `user_role()` that reads from profiles.

## Triggers
- `on_auth_user_created` — Auto-creates a profile row when a new auth.user signs up (default role: customer).
*/

-- ============================================================
-- STEP 1: CREATE ALL TABLES (no policies yet)
-- ============================================================

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'vendor', 'admin')),
  phone text DEFAULT '',
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- 2. CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  icon text DEFAULT '',
  parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  commission_rate numeric(5,2) NOT NULL DEFAULT 10.00 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  created_at timestamptz DEFAULT now()
);

-- 3. SHOPS
CREATE TABLE IF NOT EXISTS public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text DEFAULT '',
  logo_url text DEFAULT '',
  banner_url text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended')),
  created_at timestamptz DEFAULT now()
);

-- 4. PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text DEFAULT '',
  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  compare_price numeric(10,2) DEFAULT NULL CHECK (compare_price IS NULL OR compare_price >= 0),
  brand text DEFAULT '',
  rating numeric(3,2) DEFAULT 0,
  rating_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(shop_id, slug)
);

-- 5. PRODUCT IMAGES
CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url text NOT NULL,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 6. PRODUCT VARIATIONS
CREATE TABLE IF NOT EXISTS public.product_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  color text DEFAULT '',
  size text DEFAULT '',
  sku text DEFAULT '',
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  price_adjustment numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 7. CART ITEMS
CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variation_id uuid REFERENCES public.product_variations(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz DEFAULT now()
);

-- 8. ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  total numeric(10,2) NOT NULL DEFAULT 0,
  customer_name text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  shipping_address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  notes text DEFAULT '',
  payment_method text NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod')),
  created_at timestamptz DEFAULT now()
);

-- 9. ORDER ITEMS
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variation_id uuid REFERENCES public.product_variations(id) ON DELETE SET NULL,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  variation_name text DEFAULT '',
  price numeric(10,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  product_image text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- 10. REVIEWS
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  comment text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- STEP 2: HELPER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- STEP 3: ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 4: POLICIES (all tables exist now, safe to reference)
-- ============================================================

-- PROFILES
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR public.user_role() = 'admin');

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- CATEGORIES
DROP POLICY IF EXISTS "categories_select_all" ON public.categories;
CREATE POLICY "categories_select_all" ON public.categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "categories_insert_admin" ON public.categories;
CREATE POLICY "categories_insert_admin" ON public.categories FOR INSERT
  TO authenticated WITH CHECK (public.user_role() = 'admin');

DROP POLICY IF EXISTS "categories_update_admin" ON public.categories;
CREATE POLICY "categories_update_admin" ON public.categories FOR UPDATE
  TO authenticated USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');

DROP POLICY IF EXISTS "categories_delete_admin" ON public.categories;
CREATE POLICY "categories_delete_admin" ON public.categories FOR DELETE
  TO authenticated USING (public.user_role() = 'admin');

-- SHOPS
DROP POLICY IF EXISTS "shops_select_public" ON public.shops;
CREATE POLICY "shops_select_public" ON public.shops FOR SELECT
  TO anon, authenticated USING (
    status = 'approved' OR owner_id = auth.uid() OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "shops_insert_owner" ON public.shops;
CREATE POLICY "shops_insert_owner" ON public.shops FOR INSERT
  TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "shops_update_owner_admin" ON public.shops;
CREATE POLICY "shops_update_owner_admin" ON public.shops FOR UPDATE
  TO authenticated USING (owner_id = auth.uid() OR public.user_role() = 'admin')
  WITH CHECK (owner_id = auth.uid() OR public.user_role() = 'admin');

DROP POLICY IF EXISTS "shops_delete_owner" ON public.shops;
CREATE POLICY "shops_delete_owner" ON public.shops FOR DELETE
  TO authenticated USING (owner_id = auth.uid());

-- PRODUCTS
DROP POLICY IF EXISTS "products_select_public" ON public.products;
CREATE POLICY "products_select_public" ON public.products FOR SELECT
  TO anon, authenticated USING (
    status = 'active'
    OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = products.shop_id AND s.owner_id = auth.uid())
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "products_insert_vendor" ON public.products;
CREATE POLICY "products_insert_vendor" ON public.products FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = products.shop_id AND s.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "products_update_vendor" ON public.products;
CREATE POLICY "products_update_vendor" ON public.products FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = products.shop_id AND s.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = products.shop_id AND s.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "products_delete_vendor" ON public.products;
CREATE POLICY "products_delete_vendor" ON public.products FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = products.shop_id AND s.owner_id = auth.uid())
  );

-- PRODUCT IMAGES
DROP POLICY IF EXISTS "product_images_select_all" ON public.product_images;
CREATE POLICY "product_images_select_all" ON public.product_images FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "product_images_insert_vendor" ON public.product_images;
CREATE POLICY "product_images_insert_vendor" ON public.product_images FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.shops s ON s.id = p.shop_id
      WHERE p.id = product_images.product_id AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "product_images_update_vendor" ON public.product_images;
CREATE POLICY "product_images_update_vendor" ON public.product_images FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.shops s ON s.id = p.shop_id
      WHERE p.id = product_images.product_id AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "product_images_delete_vendor" ON public.product_images;
CREATE POLICY "product_images_delete_vendor" ON public.product_images FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.shops s ON s.id = p.shop_id
      WHERE p.id = product_images.product_id AND s.owner_id = auth.uid()
    )
  );

-- PRODUCT VARIATIONS
DROP POLICY IF EXISTS "product_variations_select_all" ON public.product_variations;
CREATE POLICY "product_variations_select_all" ON public.product_variations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "product_variations_insert_vendor" ON public.product_variations;
CREATE POLICY "product_variations_insert_vendor" ON public.product_variations FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.shops s ON s.id = p.shop_id
      WHERE p.id = product_variations.product_id AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "product_variations_update_vendor" ON public.product_variations;
CREATE POLICY "product_variations_update_vendor" ON public.product_variations FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.shops s ON s.id = p.shop_id
      WHERE p.id = product_variations.product_id AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "product_variations_delete_vendor" ON public.product_variations;
CREATE POLICY "product_variations_delete_vendor" ON public.product_variations FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.shops s ON s.id = p.shop_id
      WHERE p.id = product_variations.product_id AND s.owner_id = auth.uid()
    )
  );

-- CART ITEMS
DROP POLICY IF EXISTS "cart_select_own" ON public.cart_items;
CREATE POLICY "cart_select_own" ON public.cart_items FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "cart_insert_own" ON public.cart_items;
CREATE POLICY "cart_insert_own" ON public.cart_items FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "cart_update_own" ON public.cart_items;
CREATE POLICY "cart_update_own" ON public.cart_items FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "cart_delete_own" ON public.cart_items;
CREATE POLICY "cart_delete_own" ON public.cart_items FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- ORDERS
DROP POLICY IF EXISTS "orders_select_own_admin" ON public.orders;
CREATE POLICY "orders_select_own_admin" ON public.orders FOR SELECT
  TO authenticated USING (
    user_id = auth.uid() OR public.user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.order_items oi WHERE oi.order_id = orders.id AND oi.shop_id IN (
        SELECT s.id FROM public.shops s WHERE s.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "orders_insert_own" ON public.orders;
CREATE POLICY "orders_insert_own" ON public.orders FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "orders_update_own_admin" ON public.orders;
CREATE POLICY "orders_update_own_admin" ON public.orders FOR UPDATE
  TO authenticated USING (user_id = auth.uid() OR public.user_role() = 'admin')
  WITH CHECK (user_id = auth.uid() OR public.user_role() = 'admin');

-- ORDER ITEMS
DROP POLICY IF EXISTS "order_items_select_own_admin_vendor" ON public.order_items;
CREATE POLICY "order_items_select_own_admin_vendor" ON public.order_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
    OR public.user_role() = 'admin'
    OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = order_items.shop_id AND s.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "order_items_insert_own" ON public.order_items;
CREATE POLICY "order_items_insert_own" ON public.order_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "order_items_update_admin" ON public.order_items;
CREATE POLICY "order_items_update_admin" ON public.order_items FOR UPDATE
  TO authenticated USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');

-- REVIEWS
DROP POLICY IF EXISTS "reviews_select_all" ON public.reviews;
CREATE POLICY "reviews_select_all" ON public.reviews FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;
CREATE POLICY "reviews_insert_own" ON public.reviews FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "reviews_delete_own" ON public.reviews;
CREATE POLICY "reviews_delete_own" ON public.reviews FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- STEP 5: INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_shop ON public.products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_rating ON public.products(rating DESC);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variations_product ON public.product_variations(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_user ON public.cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_shop ON public.order_items(shop_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_shops_owner ON public.shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_shops_status ON public.shops(status);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);

-- ============================================================
-- STEP 6: TRIGGER — Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();