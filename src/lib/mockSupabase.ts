/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  INITIAL_CATEGORIES,
  INITIAL_SHOPS,
  INITIAL_PRODUCTS,
  INITIAL_REVIEWS,
  DEMO_PROFILES,
} from './mockData';
import type { CartItem, Order, Profile, UserRole } from './types';
import type { User } from '@supabase/supabase-js';

// In-memory / local storage persistence helpers
const STORAGE_PREFIX = 'aura_store_';

function getStorage<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(STORAGE_PREFIX + key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

function setStorage<T>(key: string, val: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(val));
  } catch {
    // ignore
  }
}

// State collections
const mockCategories = getStorage('categories', INITIAL_CATEGORIES);
let mockShops = getStorage('shops', INITIAL_SHOPS);
let mockProducts = getStorage('products', INITIAL_PRODUCTS);
const mockReviews = getStorage('reviews', INITIAL_REVIEWS);
let mockProfiles = getStorage('profiles', DEMO_PROFILES);
let mockCartItems: CartItem[] = getStorage('cart_items', []);
let mockOrders: Order[] = getStorage('orders', []);
let mockKyc: Record<string, unknown>[] = getStorage('kyc', []);
let mockSettings: Record<string, unknown> = getStorage('settings', {
  key: 'marketplace',
  value: {
    default_commission_rate: 10,
    default_currency: 'USD',
    support_cod: true,
    support_stripe: false,
    support_paypal: false,
  },
  is_public: true,
});

export function createMockUser(id: string, email: string, metadata: Record<string, unknown> = {}): User {
  return {
    id,
    app_metadata: {},
    user_metadata: metadata,
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    email,
    phone: '',
    role: 'authenticated',
    updated_at: new Date().toISOString(),
  };
}

// Current user state
let currentUser: User | null = getStorage('current_user', null);
const authListeners = new Set<(event: string, session: { user: unknown } | null) => void>();

function notifyAuthChange(event: string) {
  const session = currentUser ? { user: currentUser } : null;
  authListeners.forEach((cb) => {
    try {
      cb(event, session);
    } catch (e) {
      console.error(e);
    }
  });
}

class MockQueryBuilder {
  private tableName: string;
  private filters: ((item: any) => boolean)[] = [];
  private orderFn: ((a: any, b: any) => number) | null = null;
  private limitCount: number | null = null;
  private isSingle = false;
  private isMaybeSingle = false;
  private isCountOnly = false;
  private isInsert = false;
  private isUpdate = false;
  private isDelete = false;
  private isUpsert = false;
  private insertData: any = null;
  private updateData: any = null;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(_cols?: string, options?: { count?: string; head?: boolean }) {
    if (options?.head || options?.count === 'exact') {
      this.isCountOnly = true;
    }
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters.push((item) => {
      const rec = item as Record<string, unknown> & { shop?: { owner_id?: unknown } };
      if (rec[col] === undefined && col === 'owner_id' && rec.shop?.owner_id) {
        return rec.shop.owner_id === val;
      }
      return rec[col] === val;
    });
    return this;
  }

  neq(col: string, val: unknown) {
    this.filters.push((item) => item[col] !== val);
    return this;
  }

  not(col: string, op: string, val: unknown) {
    if (op === 'is' && val === null) {
      this.filters.push((item) => item[col] !== null && item[col] !== undefined);
    }
    return this;
  }

  ilike(col: string, pattern: string) {
    const clean = pattern.replace(/%/g, '').toLowerCase();
    this.filters.push((item) => {
      const field = String(item[col] ?? '').toLowerCase();
      return field.includes(clean);
    });
    return this;
  }

  gte(col: string, val: unknown) {
    this.filters.push((item) => {
      const v = item[col];
      return typeof v === 'number' && typeof val === 'number' ? v >= val : String(v) >= String(val);
    });
    return this;
  }

  lte(col: string, val: unknown) {
    this.filters.push((item) => {
      const v = item[col];
      return typeof v === 'number' && typeof val === 'number' ? v <= val : String(v) <= String(val);
    });
    return this;
  }

  gt(col: string, val: unknown) {
    this.filters.push((item) => {
      const v = item[col];
      return typeof v === 'number' && typeof val === 'number' ? v > val : String(v) > String(val);
    });
    return this;
  }

  lt(col: string, val: unknown) {
    this.filters.push((item) => {
      const v = item[col];
      return typeof v === 'number' && typeof val === 'number' ? v < val : String(v) < String(val);
    });
    return this;
  }

  in(col: string, vals: unknown[]) {
    this.filters.push((item) => Array.isArray(vals) && vals.includes(item[col]));
    return this;
  }

  order(col: string, options?: { ascending?: boolean }) {
    const asc = options?.ascending !== false;
    this.orderFn = (a, b) => {
      const valA = a[col];
      const valB = b[col];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return asc ? valA - valB : valB - valA;
      }
      return asc
        ? String(valA ?? '').localeCompare(String(valB ?? ''))
        : String(valB ?? '').localeCompare(String(valA ?? ''));
    };
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  insert(data: any) {
    this.isInsert = true;
    this.insertData = data;
    return this;
  }

  update(data: any) {
    this.isUpdate = true;
    this.updateData = data;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  upsert(data: any) {
    this.isUpsert = true;
    this.insertData = data;
    return this;
  }

  private execute(): { data: unknown; count?: number; error: null } {
    let source: any[] = [];
    switch (this.tableName) {
      case 'categories':
        source = mockCategories;
        break;
      case 'shops':
        source = mockShops;
        break;
      case 'products':
        source = mockProducts;
        break;
      case 'product_images':
        source = mockProducts.flatMap((p) => p.images || []);
        break;
      case 'product_variations':
        source = mockProducts.flatMap((p) => p.variations || []);
        break;
      case 'cart_items':
        source = mockCartItems;
        break;
      case 'orders':
        source = mockOrders;
        break;
      case 'order_items':
        source = mockOrders.flatMap((o) => o.order_items || []);
        break;
      case 'reviews':
        source = mockReviews;
        break;
      case 'profiles':
        source = mockProfiles;
        break;
      case 'vendor_kyc':
        source = mockKyc;
        break;
      case 'platform_settings':
        source = [mockSettings];
        break;
      default:
        source = [];
    }

    // INSERT
    if (this.isInsert) {
      if (!this.insertData) return { data: null, error: null };
      const items = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
      const created = items.map((item: any) => {
        const id = item.id || `mock_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const fullItem: any = { ...item, id, created_at: item.created_at || new Date().toISOString() };
        if (this.tableName === 'products') {
          fullItem.shop = mockShops.find((s) => s.id === fullItem.shop_id);
          fullItem.category = mockCategories.find((c) => c.id === fullItem.category_id);
          fullItem.images = fullItem.images || [];
          fullItem.variations = fullItem.variations || [];
          mockProducts.unshift(fullItem);
          setStorage('products', mockProducts);
        } else if (this.tableName === 'shops') {
          mockShops.unshift(fullItem);
          setStorage('shops', mockShops);
        } else if (this.tableName === 'cart_items') {
          fullItem.product = mockProducts.find((p) => p.id === fullItem.product_id);
          mockCartItems.push(fullItem);
          setStorage('cart_items', mockCartItems);
        } else if (this.tableName === 'orders') {
          mockOrders.unshift(fullItem);
          setStorage('orders', mockOrders);
        } else if (this.tableName === 'categories') {
          mockCategories.push(fullItem);
          setStorage('categories', mockCategories);
        }
        return fullItem;
      });
      return { data: Array.isArray(this.insertData) ? created : created[0], error: null };
    }

    // UPSERT
    if (this.isUpsert) {
      if (this.tableName === 'platform_settings') {
        mockSettings = { ...mockSettings, ...(this.insertData as Record<string, unknown>) };
        setStorage('settings', mockSettings);
        return { data: mockSettings, error: null };
      }
      if (this.tableName === 'vendor_kyc') {
        const insertObj = this.insertData as Record<string, any>;
        mockKyc = mockKyc.filter((k: any) => k.user_id !== insertObj?.user_id);
        mockKyc.push(insertObj);
        setStorage('kyc', mockKyc);
        return { data: this.insertData, error: null };
      }
      return { data: this.insertData, error: null };
    }

    // UPDATE
    if (this.isUpdate) {
      if (this.tableName === 'cart_items') {
        mockCartItems = mockCartItems.map((item) => {
          if (this.filters.every((f) => f(item))) {
            return { ...item, ...this.updateData };
          }
          return item;
        });
        setStorage('cart_items', mockCartItems);
      } else if (this.tableName === 'orders') {
        mockOrders = mockOrders.map((item) => {
          if (this.filters.every((f) => f(item))) {
            return { ...item, ...this.updateData };
          }
          return item;
        });
        setStorage('orders', mockOrders);
      } else if (this.tableName === 'shops') {
        mockShops = mockShops.map((item) => {
          if (this.filters.every((f) => f(item))) {
            return { ...item, ...this.updateData };
          }
          return item;
        });
        setStorage('shops', mockShops);
      } else if (this.tableName === 'products') {
        mockProducts = mockProducts.map((item) => {
          if (this.filters.every((f) => f(item))) {
            return { ...item, ...this.updateData };
          }
          return item;
        });
        setStorage('products', mockProducts);
      } else if (this.tableName === 'profiles') {
        mockProfiles = mockProfiles.map((item) => {
          if (this.filters.every((f) => f(item))) {
            return { ...item, ...this.updateData };
          }
          return item;
        });
        setStorage('profiles', mockProfiles);
      }
      return { data: null, error: null };
    }

    // DELETE
    if (this.isDelete) {
      if (this.tableName === 'cart_items') {
        mockCartItems = mockCartItems.filter((item) => !this.filters.every((f) => f(item)));
        setStorage('cart_items', mockCartItems);
      } else if (this.tableName === 'products') {
        mockProducts = mockProducts.filter((item) => !this.filters.every((f) => f(item)));
        setStorage('products', mockProducts);
      }
      return { data: null, error: null };
    }

    // SELECT / QUERY
    let result = source.filter((item) => this.filters.every((f) => f(item)));
    const totalCount = result.length;

    if (this.isCountOnly) {
      return { data: [], count: totalCount, error: null };
    }

    if (this.orderFn) {
      result = [...result].sort(this.orderFn);
    }

    if (this.limitCount !== null) {
      result = result.slice(0, this.limitCount);
    }

    if (this.isSingle) {
      return { data: result[0] || null, error: null };
    }

    if (this.isMaybeSingle) {
      return { data: result[0] || null, error: null };
    }

    return { data: result, count: totalCount, error: null };
  }

  then(onfulfilled: (res: { data: unknown; count?: number; error: null }) => unknown) {
    return Promise.resolve(this.execute()).then(onfulfilled);
  }
}

export const mockSupabase = {
  from(tableName: string) {
    return new MockQueryBuilder(tableName);
  },

  auth: {
    async getSession() {
      return {
        data: {
          session: currentUser
            ? {
                user: currentUser,
                access_token: 'mock-token',
                token_type: 'bearer',
              }
            : null,
        },
        error: null,
      };
    },

    async getUser() {
      return {
        data: { user: currentUser },
        error: null,
      };
    },

    onAuthStateChange(cb: (event: string, session: { user: unknown } | null) => void) {
      authListeners.add(cb);
      setTimeout(() => {
        cb(currentUser ? 'SIGNED_IN' : 'SIGNED_OUT', currentUser ? { user: currentUser } : null);
      }, 0);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners.delete(cb);
            },
          },
        },
      };
    },

    async signInWithPassword({ email, password: _password }: { email: string; password?: string }) {
      // Find matching profile or create one
      let role: UserRole = 'customer';
      if (email.includes('vendor')) role = 'vendor';
      if (email.includes('admin')) role = 'admin';

      let existingProfile = mockProfiles.find((p) => p.id === email || p.full_name.toLowerCase().includes(email.split('@')[0]));
      if (!existingProfile) {
        existingProfile = {
          id: 'user-' + btoa(email).slice(0, 10),
          full_name: email.split('@')[0].toUpperCase(),
          role,
          phone: '',
          avatar_url: '',
          created_at: new Date().toISOString(),
          status: 'active',
        };
        mockProfiles.push(existingProfile);
        setStorage('profiles', mockProfiles);
      }

      currentUser = createMockUser(existingProfile.id, email, {
        full_name: existingProfile.full_name,
        role: existingProfile.role,
      });
      setStorage('current_user', currentUser);
      notifyAuthChange('SIGNED_IN');
      return {
        data: {
          user: currentUser,
          session: {
            user: currentUser,
            access_token: 'mock-token',
            token_type: 'bearer',
          },
        },
        error: null,
      };
    },

    async signUp({ email, options }: { email: string; password?: string; options?: { data?: { role?: string; full_name?: string; phone?: string; country_code?: string } } }) {
      const role: UserRole = options?.data?.role === 'vendor' ? 'vendor' : 'customer';
      const fullName = options?.data?.full_name || email.split('@')[0];
      const newProfile: Profile = {
        id: 'user-' + btoa(email).slice(0, 10),
        full_name: fullName,
        role,
        phone: options?.data?.phone || '',
        avatar_url: '',
        created_at: new Date().toISOString(),
        status: 'active',
        country_code: options?.data?.country_code || 'US',
      };
      mockProfiles.push(newProfile);
      setStorage('profiles', mockProfiles);

      currentUser = createMockUser(newProfile.id, email, {
        full_name: fullName,
        role,
      });
      setStorage('current_user', currentUser);
      notifyAuthChange('SIGNED_IN');
      return {
        data: {
          user: currentUser,
          session: {
            user: currentUser,
            access_token: 'mock-token',
            token_type: 'bearer',
          },
        },
        error: null,
      };
    },

    async verifyOtp({ email: _email }: { email: string; token: string; type?: string }) {
      return {
        data: {
          user: currentUser,
          session: currentUser
            ? {
                user: currentUser,
                access_token: 'mock-token',
                token_type: 'bearer',
              }
            : null,
        },
        error: null,
      };
    },

    async signOut() {
      currentUser = null;
      setStorage('current_user', null);
      notifyAuthChange('SIGNED_OUT');
      return { error: null };
    },
  },

  functions: {
    async invoke(functionName: string, options?: { body?: Record<string, unknown> }) {
      const body = options?.body || {};

      if (functionName === 'checkout') {
        const orderId = 'ord_' + Math.random().toString(36).substring(2, 10).toUpperCase();
        const items = (body.items as { product_id: string; variation_id?: string; quantity?: number }[]) || [];
        const orderItems = items.map((it) => {
          const product = mockProducts.find((p) => p.id === it.product_id);
          const variation = product?.variations?.find((v) => v.id === it.variation_id);
          const price = (product?.price || 0) + (variation?.price_adjustment || 0);
          return {
            id: 'item_' + Math.random().toString(36).substring(2, 8),
            order_id: orderId,
            product_id: it.product_id,
            variation_id: it.variation_id || null,
            shop_id: product?.shop_id || 'shop-1',
            product_name: product?.name || 'Product',
            variation_name: variation ? `${variation.color} ${variation.size}`.trim() : '',
            price,
            quantity: it.quantity || 1,
            product_image: product?.images?.[0]?.url || '',
            shop: product?.shop,
          };
        });

        const subtotal = orderItems.reduce((sum: number, it: { price: number; quantity: number }) => sum + it.price * it.quantity, 0);
        const newOrder: Order = {
          id: orderId,
          user_id: currentUser?.id || 'guest',
          status: 'confirmed',
          total: subtotal,
          customer_name: (body.customer_name as string) || 'Valued Customer',
          customer_phone: (body.customer_phone as string) || '',
          shipping_address: (body.shipping_address as string) || '',
          city: (body.city as string) || '',
          notes: (body.notes as string) || '',
          payment_method: (body.payment_method as string) || 'cod',
          payment_status: (body.payment_method as string) === 'cod' ? 'pending' : 'paid',
          destination_country: (body.destination_country as string) || 'US',
          created_at: new Date().toISOString(),
          order_items: orderItems,
        };

        mockOrders.unshift(newOrder);
        setStorage('orders', mockOrders);

        return {
          data: {
            order_id: orderId,
            subtotal,
            tax: 0,
            shipping: 0,
            total: subtotal,
            currency: 'USD',
          },
          error: null,
        };
      }

      if (functionName === 'auth-otp') {
        return { data: { ok: true }, error: null };
      }

      if (functionName === 'create-payment') {
        return {
          data: {
            checkout_url: `/order-confirmed/${body.order_id}?payment=success`,
          },
          error: null,
        };
      }

      if (functionName === 'capture-paypal') {
        return { data: { ok: true }, error: null };
      }

      if (functionName === 'turnstile-verify') {
        return { data: { ok: true, success: true }, error: null };
      }

      if (functionName === 'admin-vendor-review') {
        if (body.action === 'document_url') {
          return { data: { url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80' }, error: null };
        }
        return { data: { ok: true }, error: null };
      }

      return { data: { ok: true }, error: null };
    },
  },

  storage: {
    from(_bucket: string) {
      return {
        async upload(path: string, _file: unknown) {
          return { data: { path }, error: null };
        },
      };
    },
  },
};
