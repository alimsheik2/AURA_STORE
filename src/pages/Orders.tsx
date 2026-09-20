import { useI18n } from '@/contexts/I18nContext';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Order } from '@/lib/types';
import { formatPriceSimple, formatDateTime, classNames } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  confirmed: 'bg-sky-50 text-sky-700 border border-sky-200',
  shipped: 'bg-blue-50 text-blue-700 border border-blue-200',
  delivered: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 border border-rose-200',
};

export default function Orders() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrders() {
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('orders')
        .select('*, order_items:order_items(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setOrders((data as Order[]) ?? []);
      setLoading(false);
    }
    loadOrders();
  }, [user]);

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-sky-500" size={32} /></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">{t('orders.signIn')}</p>
          <Link to="/signin" className="text-sky-600 font-medium hover:text-sky-700">{t('auth.signin')}</Link>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md shadow-sm">
          <Package className="mx-auto text-slate-300 mb-4" size={48} />
          <h1 className="text-xl font-bold text-slate-900 mb-2">{t('orders.noOrders')}</h1>
          <p className="text-slate-500 text-sm mb-6">{t('orders.emptyText')}</p>
          <Link to="/search" className="inline-block px-6 py-3 bg-sky-500 text-white font-medium rounded-lg hover:bg-sky-600 transition-colors">
            {t('cart.continueShopping')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">{t('orders.title')}</h1>

        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Order #{order.id.slice(0, 8)}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(order.created_at)}</p>
                </div>
                <span className={classNames('text-xs font-semibold px-3 py-1 rounded-full capitalize', statusStyles[order.status] ?? 'bg-gray-100 text-gray-700')}>
                  {t(`common.${order.status}`)}
                </span>
              </div>

              <div className="space-y-3">
                {order.order_items?.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    {item.product_image && (
                      <img src={item.product_image} alt="" className="w-14 h-14 rounded-lg object-cover border border-gray-100" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{item.product_name}</p>
                      {item.variation_name && <p className="text-xs text-slate-500">{item.variation_name}</p>}
                      <p className="text-xs text-slate-500">{t('orders.qtyLabel')}: {item.quantity}</p>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{formatPriceSimple(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-100">
                <div className="text-sm text-slate-600">
                  <span className="text-slate-400">{t('orders.totalLabel')} </span>
                  <span className="font-bold text-slate-900">{formatPriceSimple(order.total)}</span>
                </div>
                <div className="text-sm text-slate-500">
                  {order.payment_method === 'cod' ? t('checkout.cod') : order.payment_method.toUpperCase()}
                  {order.tracking_number && <div className="text-xs text-sky-600 mt-1">{t('orders.tracking')}: {order.tracking_number}</div>}
                </div>
              </div>

              {/* Status tracker */}
              <div className="flex items-center gap-2 mt-4">
                {['pending', 'confirmed', 'shipped', 'delivered'].map((s, i) => {
                  const currentIdx = ['pending', 'confirmed', 'shipped', 'delivered'].indexOf(order.status);
                  const active = i <= currentIdx && order.status !== 'cancelled';
                  return (
                    <div key={s} className="flex items-center flex-1 last:flex-none">
                      <div className={classNames(
                        'w-2.5 h-2.5 rounded-full transition-colors',
                        active ? 'bg-sky-500' : 'bg-gray-200'
                      )} />
                      {i < 3 && <div className={classNames('flex-1 h-0.5 mx-1', active && i < currentIdx ? 'bg-sky-500' : 'bg-gray-200')} />}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
                <span>{t('orders.placed')}</span>
                <span>{t('orders.confirmed')}</span>
                <span>{t('orders.shipped')}</span>
                <span>{t('orders.delivered')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
