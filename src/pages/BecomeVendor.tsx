import { useI18n } from '@/contexts/I18nContext';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Store, Loader2, Check, ArrowRight, Truck, TrendingUp, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { slugify } from '@/lib/utils';

export default function BecomeVendor() {
  const { t } = useI18n();
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [shopName, setShopName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md shadow-sm">
          <Store className="mx-auto text-slate-300 mb-4" size={48} />
          <h1 className="text-xl font-bold text-slate-900 mb-2">{t('vendor.signInTitle')}</h1>
          <p className="text-slate-500 text-sm mb-6">{t('vendor.signInText')}</p>
          <div className="flex gap-3 justify-center">
            <Link to="/signin" className="px-6 py-2.5 bg-sky-500 text-white font-medium rounded-lg hover:bg-sky-600 transition-colors">{t('auth.signin')}</Link>
            <Link to="/signup" className="px-6 py-2.5 border border-gray-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors">{t('auth.signup')}</Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const slug = slugify(shopName) + '-' + Date.now().toString(36);
      const { error } = await supabase.from('shops').insert({
        owner_id: user.id,
        name: shopName,
        slug,
        description,
        status: 'pending',
      });

      if (error) throw error;

      if (profile?.role === 'customer') {
        await supabase.from('profiles').update({ role: 'vendor' }).eq('id', user.id);
        await refreshProfile();
      }

      setSuccess(true);
      setTimeout(() => navigate('/vendor'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register shop');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md shadow-sm">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="text-emerald-500" size={48} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{t('vendor.shopRegistered')}</h1>
          <p className="text-slate-500 text-sm mb-4">
            {t('vendor.submittedForApproval')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="bg-slate-900 rounded-2xl p-8 text-white mb-6 shadow-sm">
          <h1 className="text-3xl font-bold mb-2">{t('vendor.startSelling')}</h1>
          <p className="text-slate-300">{t('vendor.join')}</p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            { icon: TrendingUp, title: t('vendor.growSales'), desc: t('vendor.growSalesText') },
            { icon: Truck, title: t('vendor.easyFulfillment'), desc: t('vendor.easyFulfillmentText') },
            { icon: Shield, title: t('vendor.securePlatform'), desc: t('vendor.securePlatformText') },
          ].map((b, i) => {
            const Icon = b.icon;
            return (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="w-10 h-10 bg-sky-50 rounded-lg flex items-center justify-center mb-3">
                  <Icon className="text-sky-500" size={20} />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">{b.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{b.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">{t('vendor.register')}</h2>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('vendor.shopName')}</label>
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full h-11 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                placeholder={t('vendor.shopPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('vendor.shopDescription')}</label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 resize-none"
                placeholder={t('vendor.descriptionPlaceholder')}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-sky-500 text-white font-medium rounded-lg hover:bg-sky-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <>{t('vendor.submitApproval')} <ArrowRight size={18} className="rtl:rotate-180" /></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
