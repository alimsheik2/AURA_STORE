import { useI18n } from '@/contexts/I18nContext';
import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Package, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Order } from '@/lib/types';
import { formatPriceSimple, formatDateTime } from '@/lib/utils';
import { useCart } from '@/contexts/CartContext';

export default function OrderConfirmed() {
  const { t } = useI18n();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id && searchParams.get('payment') === 'success') {
      supabase.from('orders').select('payment_method,provider_payment_id').eq('id', id).maybeSingle().then(({ data }) => {
        if (data?.payment_method === 'paypal' && data.provider_payment_id) {
          supabase.functions.invoke('capture-paypal', { body: { order_id: id, paypal_order_id: data.provider_payment_id } }).then(() => clearCart());
        } else if (data?.payment_method === 'stripe') {
          clearCart();
        }
      });
    }
  }, [id, searchParams, clearCart]);

  useEffect(() => {
    async function loadOrder() {
      const { data } = await supabase
        .from('orders')
        .select('*, order_items:order_items(*)')
        .eq('id', id!)
        .maybeSingle();
      setOrder(data as Order | null);
      setLoading(false);
    }
    loadOrder();
  }, [id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-gray-400">{t('common.loading')}</div></div>;
  }

  return (
    <div className="bg-gray-50 min-h-screen flex items-center justify-center px-4 py-8">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="text-emerald-500" size={48} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('confirmed.title')}</h1>
          <p className="text-gray-500 text-sm mb-6">
            {t('confirmed.thanks')}
          </p>

          {order && (
            <div className="bg-gray-50 rounded-xl p-4 text-start mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">{t('confirmed.orderId')}</span>
                <span className="font-mono font-medium text-gray-900">#{order.id.slice(0, 8)}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">{t('confirmed.date')}</span>
                <span className="text-gray-900">{formatDateTime(order.created_at)}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">{t('confirmed.payment')}</span>
                <span className="text-gray-900">{t('checkout.cod')}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">{t('confirmed.items')}</span>
                <span className="text-gray-900">{order.order_items?.length ?? 0}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                <span className="font-bold text-gray-900">{t('confirmed.total')}</span>
                <span className="font-bold text-sky-600">{formatPriceSimple(order.total)}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/orders"
              className="flex-1 h-11 flex items-center justify-center gap-2 bg-sky-500 text-white font-medium rounded-lg hover:bg-sky-600 transition-colors"
            >
              <Package size={18} /> {t('orders.track')}
            </Link>
            <Link
              to="/search"
              className="flex-1 h-11 flex items-center justify-center gap-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t('cart.continueShopping')} <ArrowRight size={18} className="rtl:rotate-180" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
