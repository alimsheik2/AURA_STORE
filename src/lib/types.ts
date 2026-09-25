export type UserRole = 'customer' | 'vendor' | 'admin';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string;
  avatar_url: string;
  created_at: string;
  status?: 'active' | 'pending' | 'suspended' | 'rejected';
  country_code?: string;
  last_login_at?: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  parent_id: string | null;
  commission_rate: number;
  created_at: string;
}

export interface Shop {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string;
  banner_url: string;
  status: 'pending' | 'approved' | 'suspended' | 'rejected';
  created_at: string;
}

export interface Product {
  id: string;
  shop_id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string;
  price: number;
  compare_price: number | null;
  brand: string;
  rating: number;
  rating_count: number;
  status: 'active' | 'draft' | 'archived';
  created_at: string;
  inventory_stock?: number;
  currency?: string;
  translations?: Record<string, unknown>;
  shop?: Shop;
  category?: Category;
  images?: ProductImage[];
  variations?: ProductVariation[];
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  position: number;
}

export interface ProductVariation {
  id: string;
  product_id: string;
  color: string;
  size: string;
  sku: string;
  stock: number;
  price_adjustment: number;
}

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  variation_id: string | null;
  quantity: number;
  product?: Product;
  variation?: ProductVariation;
}

export interface Order {
  id: string;
  user_id: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  customer_name: string;
  customer_phone: string;
  shipping_address: string;
  city: string;
  notes: string;
  payment_method: string;
  payment_status?: string;
  tracking_number?: string | null;
  destination_country?: string;
  created_at: string;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variation_id: string | null;
  shop_id: string;
  product_name: string;
  variation_name: string;
  price: number;
  quantity: number;
  product_image: string;
  shop?: Shop;
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
  profile?: Profile;
}
