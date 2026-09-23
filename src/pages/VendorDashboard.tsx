import { useI18n } from '@/contexts/I18nContext';
import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingBag, BarChart3, Settings,
  Plus, Edit2, Trash2, X, Loader2, TrendingUp, DollarSign, AlertCircle,
  Store, Check
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Shop, Product, Order, Category } from '@/lib/types';
import { formatPriceSimple, formatDate, classNames, slugify } from '@/lib/utils';

type Tab = 'overview' | 'products' | 'orders' | 'analytics' | 'settings';

export default function VendorDashboard() {
  const { t } = useI18n();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);

  const loadShop = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('shops')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle();
    setShop(data as Shop | null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadShop();
  }, [loadShop]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-sky-500" size={32} /></div>;
  }

  if (!user) {
    navigate('/signin');
    return null;
  }

  if (profile?.role !== 'vendor' && profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md">
          <Store className="mx-auto text-gray-300 mb-4" size={48} />
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t('vendor.notYet')}</h1>
          <p className="text-gray-500 text-sm mb-6">{t('vendor.registerPrompt')}</p>
          <Link to="/become-vendor" className="inline-block px-6 py-3 bg-sky-500 text-white font-medium rounded-lg hover:bg-sky-600">
            {t('nav.becomeVendor')}
          </Link>
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md">
          <Store className="mx-auto text-gray-300 mb-4" size={48} />
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t('vendor.noShop')}</h1>
          <p className="text-gray-500 text-sm mb-6">{t('vendor.noShopText')}</p>
          <Link to="/become-vendor" className="inline-block px-6 py-3 bg-sky-500 text-white font-medium rounded-lg hover:bg-sky-600">
            {t('vendor.register')}
          </Link>
        </div>
      </div>
    );
  }

  if (profile?.status !== 'active' || shop?.status !== 'approved') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-lg">
          <Store className="mx-auto text-amber-500 mb-4" size={48} />
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t('vendor.pendingTitle')}</h1>
          <p className="text-gray-500 text-sm">{t('vendor.pendingText')}</p>
          <div className="mt-5 text-xs text-gray-500">Account: {profile?.status ?? 'pending'} · Shop: {shop?.status ?? 'not created'}</div>
          <Link to="/" className="inline-block mt-5 px-6 py-3 bg-sky-500 text-white font-medium rounded-lg hover:bg-sky-600">{t('vendor.backStore')}</Link>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: t('vendor.overview'), icon: LayoutDashboard },
    { id: 'products', label: t('vendor.products'), icon: Package },
    { id: 'orders', label: t('vendor.orders'), icon: ShoppingBag },
    { id: 'analytics', label: t('vendor.analytics'), icon: BarChart3 },
    { id: 'settings', label: t('vendor.settings'), icon: Settings },
  ];

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Shop header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-sky-500 rounded-xl flex items-center justify-center shadow-sm">
                <Store className="text-white" size={28} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{shop.name}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={classNames(
                    'text-xs font-bold px-2 py-0.5 rounded-full',
                    shop.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                    shop.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    'bg-rose-100 text-rose-700'
                  )}>
                    {shop.status === 'approved' ? t('common.active') : shop.status === 'pending' ? t('common.pending') : t('common.suspended')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto border-b border-gray-200">
          {tabs.map((tb) => {
            const Icon = tb.icon;
            return (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={classNames(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap',
                  tab === tb.id ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                )}
              >
                <Icon size={18} /> {tb.label}
              </button>
            );
          })}
        </div>

        {tab === 'overview' && <OverviewTab shopId={shop.id} />}
        {tab === 'products' && <ProductsTab shopId={shop.id} />}
        {tab === 'orders' && <OrdersTab shopId={shop.id} />}
        {tab === 'analytics' && <AnalyticsTab shopId={shop.id} />}
        {tab === 'settings' && <SettingsTab shop={shop} onUpdate={loadShop} />}
      </div>
    </div>
  );
}

function OverviewTab({ shopId }: { shopId: string }) {
  const { t } = useI18n();
  const [stats, setStats] = useState({ products: 0, orders: 0, revenue: 0, lowStock: 0 });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [prodRes, ordersRes] = await Promise.all([
        supabase.from('products').select('id, variations:product_variations(stock)').eq('shop_id', shopId),
        supabase.from('order_items').select('order:orders(*), price, quantity').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(5),
      ]);

      const products = (prodRes.data as { id: string; variations?: { stock: number }[] }[]) ?? [];
      let lowStock = 0;
      products.forEach((p) => {
        if (p.variations && p.variations.length > 0) {
          p.variations.forEach((v) => { if (v.stock < 10) lowStock++; });
        }
      });

      const orderItems = (ordersRes.data as unknown as { order: Order; price: number; quantity: number }[]) ?? [];
      const revenue = orderItems.reduce((sum, oi) => sum + oi.price * oi.quantity, 0);

      setStats({
        products: products.length,
        orders: orderItems.length,
        revenue,
        lowStock,
      });
      setRecentOrders(orderItems.map((oi) => oi.order).filter(Boolean));
      setLoading(false);
    }
    load();
  }, [shopId]);

  if (loading) return <div className="py-20 text-center text-gray-400">{t('common.loading')}</div>;

  const cards = [
    { label: t('vendor.totalProducts'), value: stats.products, icon: Package, color: 'sky' },
    { label: t('vendor.totalOrders'), value: stats.orders, icon: ShoppingBag, color: 'emerald' },
    { label: t('vendor.totalRevenue'), value: formatPriceSimple(stats.revenue), icon: DollarSign, color: 'amber' },
    { label: t('vendor.lowStock'), value: stats.lowStock, icon: AlertCircle, color: 'rose' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">{c.label}</span>
                <div className={`w-9 h-9 bg-${c.color}-50 rounded-lg flex items-center justify-center`}>
                  <Icon className={`text-${c.color}-500`} size={18} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-4">{t('vendor.recentOrders')}</h2>
        {recentOrders.length === 0 ? (
          <p className="text-gray-500 text-sm">{t('vendor.noOrders')}</p>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{t('orders.orderNumber', { id: o.id.slice(0, 8) })}</p>
                  <p className="text-xs text-gray-500">{formatDate(o.created_at)} - {o.customer_name}</p>
                </div>
                <div className="text-end">
                  <p className="text-sm font-bold text-gray-900">{formatPriceSimple(o.total)}</p>
                  <span className="text-xs text-gray-500 capitalize">{t(`common.${o.status}`)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductsTab({ shopId }: { shopId: string }) {
  const { t } = useI18n();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const loadProducts = useCallback(async () => {
    const [prodRes, catRes] = await Promise.all([
      supabase.from('products').select('*, category:categories(name), images:product_images(url), variations:product_variations(*)').eq('shop_id', shopId).order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('name'),
    ]);
    setProducts((prodRes.data as Product[]) ?? []);
    setCategories((catRes.data as Category[]) ?? []);
    setLoading(false);
  }, [shopId]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    await supabase.from('products').delete().eq('id', id);
    loadProducts();
  };

  if (loading) return <div className="py-20 text-center text-gray-400">{t('common.loading')}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">{t('vendor.products')} ({products.length})</h2>
        <button
          onClick={() => { setEditingProduct(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 h-10 bg-sky-500 text-white text-sm font-medium rounded-lg hover:bg-sky-600"
        >
          <Plus size={18} /> {t('vendor.addProduct')}
        </button>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Package className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500 mb-4">{t('vendor.noProducts')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-start text-xs font-semibold text-gray-600 px-4 py-3">{t('vendor.product')}</th>
                <th className="text-start text-xs font-semibold text-gray-600 px-4 py-3 hidden sm:table-cell">{t('vendor.category')}</th>
                <th className="text-start text-xs font-semibold text-gray-600 px-4 py-3">{t('vendor.price')}</th>
                <th className="text-start text-xs font-semibold text-gray-600 px-4 py-3 hidden sm:table-cell">{t('vendor.status')}</th>
                <th className="text-end text-xs font-semibold text-gray-600 px-4 py-3">{t('vendor.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.images?.[0]?.url ? (
                        <img src={p.images[0].url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center"><Package size={20} className="text-gray-400" /></div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.variations?.length ?? 0} variations</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{p.category?.name ?? '-'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatPriceSimple(p.price)}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={classNames(
                      'text-xs font-bold px-2 py-0.5 rounded-full',
                      p.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                      p.status === 'draft' ? 'bg-gray-100 text-gray-700' : 'bg-rose-100 text-rose-700'
                    )}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setEditingProduct(p); setShowModal(true); }} className="p-1.5 text-gray-400 hover:text-sky-500 hover:bg-sky-50 rounded-lg">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ProductModal
          shopId={shopId}
          categories={categories}
          product={editingProduct}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadProducts(); }}
        />
      )}
    </div>
  );
}

function ProductModal({ shopId, categories, product, onClose, onSaved }: {
  shopId: string;
  categories: Category[];
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product?.price?.toString() ?? '');
  const [comparePrice, setComparePrice] = useState(product?.compare_price?.toString() ?? '');
  const [brand, setBrand] = useState(product?.brand ?? '');
  const [categoryId, setCategoryId] = useState(product?.category_id ?? '');
  const [status, setStatus] = useState<'active' | 'draft'>(product?.status === 'draft' ? 'draft' : 'active');
  const [imageUrl, setImageUrl] = useState(product?.images?.[0]?.url ?? '');
  const [inventoryStock, setInventoryStock] = useState(product ? String((product as Product & { inventory_stock?: number }).inventory_stock ?? 0) : '0');
  const [variations, setVariations] = useState(
    product?.variations?.map(v => ({ color: v.color, size: v.size, sku: v.sku, stock: v.stock.toString(), price_adjustment: v.price_adjustment.toString() })) ??
    [{ color: '', size: '', sku: '', stock: '', price_adjustment: '0' }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    if (!name.trim() || !description.trim() || !categoryId || !brand.trim() || !price || Number(price) <= 0 || !imageUrl.trim()) {
      setError('Name, description, brand, category, positive price, and at least one image are required.');
      setSaving(false);
      return;
    }
    if (!product && status === 'active') {
      if (Number(inventoryStock) < 0) { setError('Stock cannot be negative.'); setSaving(false); return; }
    }
    try {
      const slug = slugify(name) + '-' + Date.now().toString(36);
      const productData: Record<string, unknown> = {
        shop_id: shopId,
        category_id: categoryId || null,
        name,
        slug,
        description,
        price: parseFloat(price) || 0,
        compare_price: comparePrice ? parseFloat(comparePrice) : null,
        brand,
        status: 'draft',
        inventory_stock: Math.floor(Number(inventoryStock) || 0),
      };

      let productId = product?.id;
      if (product) {
        const { error } = await supabase.from('products').update(productData).eq('id', product.id);
        if (error) throw error;
        await supabase.from('product_images').delete().eq('product_id', product.id);
        await supabase.from('product_variations').delete().eq('product_id', product.id);
      } else {
        const { data, error } = await supabase.from('products').insert(productData).select().single();
        if (error) throw error;
        productId = (data as { id: string }).id;
      }

      if (imageUrl && productId) {
        await supabase.from('product_images').insert({ product_id: productId, url: imageUrl, position: 0 });
      }

      if (productId) {
        const varData = variations
          .filter(v => v.color || v.size || v.sku)
          .map(v => ({
            product_id: productId,
            color: v.color,
            size: v.size,
            sku: v.sku,
            stock: parseInt(v.stock) || 0,
            price_adjustment: parseFloat(v.price_adjustment) || 0,
          }));
        if (varData.length > 0) {
          await supabase.from('product_variations').insert(varData);
        }
      }

      if (productId && status === 'active') {
        const { error: publishError } = await supabase.from('products').update({ status: 'active' }).eq('id', productId);
        if (publishError) throw publishError;
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{product ? t('vendor.editProduct') : t('vendor.addProduct')}</h2>
          <button onClick={onClose}><X size={22} /></button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-600">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('vendor.productName')}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full h-11 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('common.description')}</label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('vendor.priceDollar')}</label>
              <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full h-11 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('vendor.comparePrice')}</label>
              <input type="number" step="0.01" value={comparePrice} onChange={(e) => setComparePrice(e.target.value)} className="w-full h-11 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('common.brand')}</label>
              <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full h-11 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('vendor.category')}</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full h-11 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400">
                <option value="">{t('vendor.selectCategory')}</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('vendor.imageUrl')}</label>
            <input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full h-11 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400" placeholder="https://..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('vendor.stock')}</label>
              <input
                type="number"
                min="0"
                value={inventoryStock}
                onChange={(e) => setInventoryStock(e.target.value)}
                className="w-full h-11 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('vendor.status')}</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'draft')} className="w-full h-11 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400">
                <option value="active">{t('common.active')}</option>
                <option value="draft">{t('vendor.draft')}</option>
              </select>
            </div>
          </div>

          {/* Variations */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Variations</label>
              <button onClick={() => setVariations([...variations, { color: '', size: '', sku: '', stock: '', price_adjustment: '0' }])} className="text-sm text-sky-600 font-medium flex items-center gap-1">
                <Plus size={14} /> {t('admin.add')}
              </button>
            </div>
            <div className="space-y-2">
              {variations.map((v, i) => (
                <div key={i} className="grid grid-cols-5 gap-2">
                  <input type="text" placeholder={t('common.color')} value={v.color} onChange={(e) => { const nv = [...variations]; nv[i] = { ...v, color: e.target.value }; setVariations(nv); }} className="h-9 px-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400" />
                  <input type="text" placeholder={t('common.size')} value={v.size} onChange={(e) => { const nv = [...variations]; nv[i] = { ...v, size: e.target.value }; setVariations(nv); }} className="h-9 px-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400" />
                  <input type="text" placeholder={t('vendor.sku')} value={v.sku} onChange={(e) => { const nv = [...variations]; nv[i] = { ...v, sku: e.target.value }; setVariations(nv); }} className="h-9 px-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400" />
                  <input type="number" placeholder={t('vendor.stock')} value={v.stock} onChange={(e) => { const nv = [...variations]; nv[i] = { ...v, stock: e.target.value }; setVariations(nv); }} className="h-9 px-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400" />
                  <button onClick={() => setVariations(variations.filter((_, idx) => idx !== i))} className="h-9 flex items-center justify-center text-gray-400 hover:text-rose-500 border border-gray-300 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 h-10 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-5 h-10 text-sm font-medium text-white bg-sky-500 rounded-lg hover:bg-sky-600 disabled:opacity-50 flex items-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

function OrdersTab({ shopId }: { shopId: string }) {
  const { t } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('order_items')
        .select('order:orders(*)')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });
      const orderMap = new Map<string, Order>();
      ((data as unknown as { order: Order }[]) ?? []).forEach((oi) => {
        const o = oi.order;
        if (o && !orderMap.has(o.id)) orderMap.set(o.id, o);
      });
      setOrders(Array.from(orderMap.values()));
      setLoading(false);
    }
    load();
  }, [shopId]);

  if (loading) return <div className="py-20 text-center text-gray-400">{t('common.loading')}</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {orders.length === 0 ? (
        <div className="p-12 text-center">
          <ShoppingBag className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500">{t('vendor.noOrders')}</p>
        </div>
      ) : (
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-start text-xs font-semibold text-gray-600 px-4 py-3">{t('confirmed.orderId')}</th>
              <th className="text-start text-xs font-semibold text-gray-600 px-4 py-3 hidden sm:table-cell">{t('auth.customer')}</th>
              <th className="text-start text-xs font-semibold text-gray-600 px-4 py-3">{t('confirmed.date')}</th>
              <th className="text-start text-xs font-semibold text-gray-600 px-4 py-3">{t('confirmed.total')}</th>
              <th className="text-start text-xs font-semibold text-gray-600 px-4 py-3">{t('vendor.status')}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">#{o.id.slice(0, 8)}</td>
                <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{o.customer_name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{formatDate(o.created_at)}</td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900">{formatPriceSimple(o.total)}</td>
                <td className="px-4 py-3">
                  <span className={classNames('text-xs font-bold px-2 py-0.5 rounded-full capitalize',
                    o.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    o.status === 'confirmed' ? 'bg-sky-100 text-sky-700' :
                    o.status === 'shipped' ? 'bg-indigo-100 text-indigo-700' :
                    o.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-rose-100 text-rose-700'
                  )}>{t(`common.${o.status}`)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AnalyticsTab({ shopId }: { shopId: string }) {
  const { t } = useI18n();
  const [stats, setStats] = useState({ totalRevenue: 0, totalOrders: 0, totalProducts: 0, avgOrderValue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [prodRes, itemsRes] = await Promise.all([
        supabase.from('products').select('id').eq('shop_id', shopId),
        supabase.from('order_items').select('price, quantity, order:orders(status)').eq('shop_id', shopId),
      ]);
      const products = (prodRes.data as unknown as { id: string }[]) ?? [];
      const items = (itemsRes.data as { price: number; quantity: number }[]) ?? [];
      const revenue = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      setStats({
        totalProducts: products.length,
        totalOrders: items.length,
        totalRevenue: revenue,
        avgOrderValue: items.length > 0 ? revenue / items.length : 0,
      });
      setLoading(false);
    }
    load();
  }, [shopId]);

  if (loading) return <div className="py-20 text-center text-gray-400">{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: formatPriceSimple(stats.totalRevenue), icon: DollarSign, color: 'emerald' },
          { label: 'Total Orders', value: stats.totalOrders, icon: ShoppingBag, color: 'sky' },
          { label: 'Avg Order Value', value: formatPriceSimple(stats.avgOrderValue), icon: TrendingUp, color: 'amber' },
          { label: 'Total Products', value: stats.totalProducts, icon: Package, color: 'indigo' },
        ].map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">{c.label}</span>
                <div className={`w-9 h-9 bg-${c.color}-50 rounded-lg flex items-center justify-center`}>
                  <Icon className={`text-${c.color}-500`} size={18} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Revenue Overview</h2>
        <div className="h-48 flex items-end justify-around gap-2 pt-4">
          {[40, 65, 50, 80, 55, 90, 70, 85, 60, 95, 75, 100].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-gradient-to-t from-sky-500 to-sky-300 rounded-t-lg transition-all hover:from-sky-600 hover:to-sky-400" style={{ height: `${h}%` }} />
              <span className="text-[10px] text-gray-400">M{i + 1}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsTab({ shop, onUpdate }: { shop: Shop; onUpdate: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState(shop.name);
  const [description, setDescription] = useState(shop.description);
  const [logoUrl, setLogoUrl] = useState(shop.logo_url);
  const [bannerUrl, setBannerUrl] = useState(shop.banner_url);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('shops').update({ name, description, logo_url: logoUrl, banner_url: bannerUrl }).eq('id', shop.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onUpdate();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Shop Settings</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('vendor.shopName')}</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full h-11 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400 resize-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('vendor.logoUrl')}</label>
          <input type="text" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="w-full h-11 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400" placeholder="https://..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Banner URL</label>
          <input type="text" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} className="w-full h-11 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400" placeholder="https://..." />
        </div>
        <button onClick={handleSave} disabled={saving} className="px-5 h-11 text-sm font-medium text-white bg-sky-500 rounded-lg hover:bg-sky-600 disabled:opacity-50 flex items-center gap-2">
          {saving ? <Loader2 size={18} className="animate-spin" /> : saved ? <Check size={18} /> : null}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
