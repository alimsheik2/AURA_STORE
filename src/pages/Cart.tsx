import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Loader2, Store } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { formatPriceSimple } from '@/lib/utils';

export default function Cart() {
  const { items, loading, updateQuantity, removeItem, subtotal, itemCount } = useCart();
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-sky-500" size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md">
          <ShoppingBag className="mx-auto text-gray-300 mb-4" size={48} />
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t('cart.signInText')}</h1>
          <Link to="/signin" className="inline-block mt-4 px-6 py-3 bg-sky-500 text-white font-medium rounded-lg hover:bg-sky-600 transition-colors">
            {t('nav.signin')}
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md">
          <ShoppingBag className="mx-auto text-gray-300 mb-4" size={48} />
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t('cart.emptyTitle')}</h1>
          <p className="text-gray-500 text-sm mb-6">{t('cart.emptyText')}</p>
          <Link to="/search" className="inline-flex items-center gap-2 px-6 py-3 bg-sky-500 text-white font-medium rounded-lg hover:bg-sky-600 transition-colors">
            {t('cart.continueShopping')} <ArrowRight size={18} className="rtl:rotate-180" />
          </Link>
        </div>
      </div>
    );
  }

  // Group by shop
  const byShop = items.reduce((acc, item) => {
    const shopName = item.product?.shop?.name ?? 'Unknown';
    if (!acc[shopName]) acc[shopName] = [];
    acc[shopName].push(item);
    return acc;
  }, {} as Record<string, typeof items>);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('nav.cart')} ({itemCount})</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Items */}
          <div className="lg:col-span-2 space-y-4">
            {Object.entries(byShop).map(([shopName, shopItems]) => (
              <div key={shopName} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 pb-3 mb-3 border-b border-gray-100">
                  <Store className="text-sky-500" size={18} />
                  <span className="text-sm font-semibold text-gray-900">{shopName}</span>
                </div>
                <div className="space-y-4">
                  {shopItems.map((item) => {
                    const price = (item.product?.price ?? 0) + (item.variation?.price_adjustment ?? 0);
                    return (
                      <div key={item.id} className="flex gap-4">
                        <Link to={`/product/${item.product_id}`} className="shrink-0">
                          <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-50">
                            {item.product?.images?.[0]?.url ? (
                              <img src={item.product.images[0].url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <ShoppingBag size={24} />
                              </div>
                            )}
                          </div>
                        </Link>

                        <div className="flex-1 min-w-0">
                          <Link to={`/product/${item.product_id}`}>
                            <h3 className="text-sm font-medium text-gray-900 hover:text-sky-600 line-clamp-2">{item.product?.name}</h3>
                          </Link>
                          {item.variation && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {item.variation.color}{item.variation.color && item.variation.size ? ' / ' : ''}{item.variation.size}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="w-8 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="w-10 text-center text-sm font-medium">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="w-8 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-gray-900">{formatPriceSimple(price * item.quantity)}</span>
                              <button
                                onClick={() => removeItem(item.id)}
                                className="text-gray-400 hover:text-rose-500 transition-colors"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-32">
              <h2 className="text-lg font-bold text-gray-900 mb-4">{t('cart.summary')}</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>{t('common.subtotal')} ({itemCount} items)</span>
                  <span>{formatPriceSimple(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>{t('cart.shipping')}</span>
                  <span className="text-emerald-600 font-medium">{t('cart.free')}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>{t('cart.estimatedTax')}</span>
                  <span>{formatPriceSimple(subtotal * 0.08)}</span>
                </div>
              </div>
              <div className="border-t border-gray-100 mt-4 pt-4 flex justify-between items-baseline">
                <span className="text-lg font-bold text-gray-900">{t('common.total')}</span>
                <span className="text-2xl font-bold text-sky-600">{formatPriceSimple(subtotal + subtotal * 0.08)}</span>
              </div>
              <button
                onClick={() => navigate('/checkout')}
                className="w-full h-11 bg-sky-500 text-white font-medium rounded-lg hover:bg-sky-600 transition-colors mt-4 flex items-center justify-center gap-2"
              >
                {t('common.checkout')} <ArrowRight size={18} className="rtl:rotate-180" />
              </button>
              <Link to="/search" className="block text-center text-sm text-sky-600 mt-3 hover:text-sky-700">
                {t('cart.continueShopping')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
