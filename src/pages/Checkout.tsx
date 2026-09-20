import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Check, Truck, CreditCard, ClipboardCheck, Loader2, Store, WalletCards } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { secureCheckout } from '@/lib/checkout';
import { supabase } from '@/lib/supabase';
import { formatPriceSimple, classNames } from '@/lib/utils';

const steps = [
  { id: 0, label: 'Shipping', icon: Truck },
  { id: 1, label: 'Payment', icon: CreditCard },
  { id: 2, label: 'Review', icon: ClipboardCheck },
];

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'stripe' | 'paypal'>('cod');
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [paymentAvailability, setPaymentAvailability] = useState({ cod: true, stripe: false, paypal: false });
  const [country, setCountry] = useState(profile?.country_code ?? 'IQ');
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
    address: '',
    city: '',
    notes: '',
  });

  useEffect(() => {
    supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'marketplace')
      .maybeSingle()
      .then(({ data }) => {
        const v = data?.value as Record<string, boolean> | null;
        if (v) {
          setPaymentAvailability({
            cod: v.support_cod !== false,
            stripe: v.support_stripe === true,
            paypal: v.support_paypal === true,
          });
        }
      });
  }, []);

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">{t('cart.emptyTitle')}</p>
          <Link to="/search" className="text-sky-600 font-medium hover:text-sky-700">{t('checkout.browseProducts')}</Link>
        </div>
      </div>
    );
  }

  const handlePlaceOrder = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const result = await secureCheckout({
        items: items.map((item) => ({ product_id: item.product_id, variation_id: item.variation_id, quantity: item.quantity })),
        payment_method: paymentMethod,
        destination_country: country.toUpperCase(),
        customer_name: form.name.trim(),
        customer_phone: form.phone.trim(),
        shipping_address: form.address.trim(),
        city: form.city.trim(),
        notes: form.notes.trim(),
        idempotency_key: idempotencyKey,
      });
      if (paymentMethod === 'cod') {
        await clearCart();
        navigate(`/order-confirmed/${result.order_id}`);
        return;
      }
      const payment = await supabase.functions.invoke('create-payment', { body: { order_id: result.order_id, provider: paymentMethod } });
      if (payment.error || !payment.data?.checkout_url) throw new Error(payment.error?.message || payment.data?.error || 'Unable to start online payment');
      await clearCart();
      window.location.assign(payment.data.checkout_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to place order');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 0) return form.name && form.phone && form.address && form.city;
    if (step === 1) return true;
    return true;
  };

  // Group by shop
  const byShop = items.reduce((acc, item) => {
    const shopName = item.product?.shop?.name ?? 'Unknown';
    if (!acc[shopName]) acc[shopName] = [];
    acc[shopName].push(item);
    return acc;
  }, {} as Record<string, typeof items>);

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">{t('common.checkout')}</h1>

        {/* Steps */}
        <div className="flex items-center justify-center mb-8">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex items-center">
                <div className={classNames(
                  'flex flex-col items-center gap-1.5',
                  i <= step ? 'text-sky-600' : 'text-slate-400'
                )}>
                  <div className={classNames(
                    'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
                    i < step ? 'bg-sky-500 border-sky-500 text-white' :
                    i === step ? 'border-sky-500 bg-sky-50' : 'border-gray-200 bg-white'
                  )}>
                    {i < step ? <Check size={18} /> : <Icon size={18} />}
                  </div>
                  <span className="text-xs font-medium">
                    {s.id === 0 ? t('checkout.shipping') : s.id === 1 ? t('checkout.payment') : t('checkout.review')}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={classNames('w-16 h-0.5 mx-2 mb-5', i < step ? 'bg-sky-500' : 'bg-gray-200')} />
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {/* Step 0: Shipping */}
            {step === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">{t('checkout.shipping')}</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('checkout.fullName')}</label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full h-11 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('checkout.phone')}</label>
                      <input
                        type="tel"
                        required
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="w-full h-11 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('checkout.destinationCountry')}</label>
                    <input type="text" maxLength={2} value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} className="w-full h-11 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400" placeholder="IQ" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('checkout.shippingAddress')}</label>
                    <textarea
                      required
                      rows={3}
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 resize-none"
                      placeholder={t('checkout.addressPlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('checkout.city')}</label>
                    <input
                      type="text"
                      required
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className="w-full h-11 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('checkout.deliveryNotes')}</label>
                    <textarea
                      rows={2}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 resize-none"
                      placeholder={t('checkout.notesPlaceholder')}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Payment */}
            {step === 1 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">{t('checkout.payment')}</h2>
                <div className="space-y-3">
                  {[
                    {id:'cod' as const, title:t('checkout.cod'), desc:t('checkout.codDesc'), icon:Truck},
                    {id:'stripe' as const, title:t('checkout.stripe'), desc:t('checkout.stripeDesc'), icon:CreditCard},
                    {id:'paypal' as const, title:t('checkout.paypal'), desc:t('checkout.paypalDesc'), icon:WalletCards},
                  ].map(({id,title,desc,icon:Icon}) => (
                    <button type="button" key={id} onClick={()=>paymentAvailability[id] && setPaymentMethod(id)} disabled={!paymentAvailability[id]} className={classNames('w-full text-start border-2 rounded-xl p-4 flex items-center gap-3', paymentMethod===id ? 'border-sky-500 bg-sky-50' : 'border-gray-200 bg-white', !paymentAvailability[id] && 'opacity-50 cursor-not-allowed')}>
                      <div className={classNames('w-12 h-12 rounded-lg flex items-center justify-center', paymentMethod===id ? 'bg-sky-500' : 'bg-gray-100')}><Icon className={paymentMethod===id ? 'text-white' : 'text-gray-500'} size={24}/></div>
                      <div><p className="font-semibold text-gray-900">{title}</p><p className="text-sm text-gray-500">{paymentAvailability[id] ? desc : t('checkout.notEnabled')}</p></div>
                      {paymentMethod===id && <Check className="ms-auto text-sky-500" size={24}/>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Review */}
            {step === 2 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">{t('checkout.review')}</h2>

                <div className="mb-4 pb-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('checkout.shippingTo')}</h3>
                  <p className="text-sm text-gray-600">{form.name}</p>
                  <p className="text-sm text-gray-600">{form.phone}</p>
                  <p className="text-sm text-gray-600">{form.address}, {form.city}</p>
                  {form.notes && <p className="text-sm text-gray-500 mt-1">{t('checkout.noteLabel')}: {form.notes}</p>}
                </div>

                <div className="mb-4 pb-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('confirmed.payment')}</h3>
                  <p className="text-sm text-gray-600">{paymentMethod.toUpperCase()}</p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('confirmed.items')}</h3>
                  {Object.entries(byShop).map(([shopName, shopItems]) => (
                    <div key={shopName} className="mb-3">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                        <Store size={14} /> {shopName}
                      </div>
                      {shopItems.map((item) => (
                        <div key={item.id} className="flex gap-3 py-2">
                          {item.product?.images?.[0]?.url && (
                            <img src={item.product.images[0].url} alt="" className="w-14 h-14 rounded-lg object-cover" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{item.product?.name}</p>
                            {item.variation && (
                              <p className="text-xs text-gray-500">
                                {item.variation.color} {item.variation.size && `/ ${item.variation.size}`}
                              </p>
                            )}
                            <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                          </div>
                          <span className="text-sm font-bold text-gray-900">
                            {formatPriceSimple(((item.product?.price ?? 0) + (item.variation?.price_adjustment ?? 0)) * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between mt-4">
              {step > 0 ? (
                <button
                  onClick={() => setStep(step - 1)}
                  className="px-5 h-11 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  {t('common.back')}
                </button>
              ) : (
                <Link to="/cart" className="px-5 h-11 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center">
                  {t('cart.title')}
                </Link>
              )}

              {step < 2 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={!canProceed()}
                  className="px-6 h-11 text-sm font-medium text-white bg-sky-500 rounded-lg hover:bg-sky-600 disabled:opacity-50"
                >
                  {t('checkout.continue')}
                </button>
              ) : (
                <button
                  onClick={handlePlaceOrder}
                  disabled={loading}
                  className="px-6 h-11 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {loading && <Loader2 size={18} className="animate-spin" />}
                  {t('checkout.placeOrder')}
                </button>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-32">
              <h2 className="text-sm font-bold text-gray-900 mb-4">{t('cart.summary')}</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>{t('common.subtotal')}</span>
                  <span>{formatPriceSimple(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>{t('cart.shipping')}</span>
                  <span className="text-gray-500">{t('checkout.calculatedDestination')}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>{t('checkout.tax')}</span>
                  <span>{t('checkout.calculatedCheckout')}</span>
                </div>
              </div>
              <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between items-baseline">
                <span className="font-bold text-gray-900">{t('common.total')}</span>
                <span className="text-sm font-medium text-gray-500">Final total calculated securely by server</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
