import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Smartphone, Shirt, Sofa, Dumbbell, Heart, Watch, Laptop, Utensils,
  ArrowRight, Sparkles, Zap
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product, Category } from '@/lib/types';
import ProductCard from '@/components/ProductCard';
import { useI18n } from '@/contexts/I18nContext';
import { formatPriceSimple, discountPercent } from '@/lib/utils';

const iconMap: Record<string, typeof Smartphone> = {
  Smartphone, Shirt, Sofa, Dumbbell, Heart, Watch, Laptop, Utensils,
};

export default function Home() {
  const { t } = useI18n();
  const [featured, setFeatured] = useState<Product[]>([]);
  const [deals, setDeals] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [featRes, dealsRes, catRes] = await Promise.all([
        supabase
          .from('products')
          .select('*, shop:shops(name, slug), category:categories(name), images:product_images(url)')
          .eq('status', 'active')
          .order('rating', { ascending: false })
          .limit(10),
        supabase
          .from('products')
          .select('*, shop:shops(name, slug), category:categories(name), images:product_images(url)')
          .eq('status', 'active')
          .not('compare_price', 'is', null)
          .order('rating_count', { ascending: false })
          .limit(5),
        supabase.from('categories').select('*').order('name'),
      ]);
      setFeatured((featRes.data as Product[]) ?? []);
      setDeals((dealsRes.data as Product[]) ?? []);
      setCategories((catRes.data as Category[]) ?? []);
      setLoading(false);
    }
    loadData();
  }, []);

  const banners = [
    {
      title: 'Tech That Moves With You',
      subtitle: 'Up to 40% off premium electronics',
      cta: 'Shop Electronics',
      link: '/search?category=electronics',
      gradient: 'from-sky-500 to-blue-700',
      icon: Smartphone,
    },
    {
      title: 'Refresh Your Style',
      subtitle: 'New season fashion from top vendors',
      cta: 'Shop Fashion',
      link: '/search?category=fashion',
      gradient: 'from-emerald-500 to-teal-700',
      icon: Shirt,
    },
    {
      title: 'Make It Feel Like Home',
      subtitle: 'Cozy essentials for every room',
      cta: 'Shop Home',
      link: '/search?category=home-living',
      gradient: 'from-amber-500 to-orange-700',
      icon: Sofa,
    },
  ];

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 start-20 w-72 h-72 bg-sky-400 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 end-20 w-96 h-96 bg-blue-500 rounded-full blur-3xl"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 py-16 md:py-24">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-sky-500/20 text-sky-300 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <Sparkles size={16} />
              Multi-vendor marketplace
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-4">
              {t('hero.title')}
            </h1>
            <p className="text-lg text-gray-300 mb-8 max-w-xl">
              {t('hero.subtitle')}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/search"
                className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white font-semibold px-6 py-3 rounded-xl transition-all hover:scale-105 shadow-lg shadow-sky-500/30"
              >
                {t('hero.shopNow')} <ArrowRight size={20} className="rtl:rotate-180" />
              </Link>
              <Link
                to="/become-vendor"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-xl transition-all border border-white/20"
              >
                {t('nav.becomeVendor')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Banners */}
      <section className="max-w-7xl mx-auto px-4 -mt-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {banners.map((b, i) => {
            const Icon = b.icon;
            return (
              <Link
                key={i}
                to={b.link}
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${b.gradient} p-6 h-44 flex flex-col justify-between transition-all hover:scale-[1.02] hover:shadow-xl`}
              >
                <div className="absolute -end-4 -bottom-4 opacity-20">
                  <Icon size={120} className="text-white" />
                </div>
                <div className="relative">
                  <h3 className="text-xl font-bold text-white">{b.title}</h3>
                  <p className="text-sm text-white/80 mt-1">{b.subtitle}</p>
                </div>
                <span className="relative text-sm font-semibold text-white flex items-center gap-1 group-hover:gap-2 transition-all">
                  {b.cta} <ArrowRight size={16} className="rtl:rotate-180" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{t('home.topCategories')}</h2>
          <Link to="/search" className="text-sm font-medium text-sky-600 hover:text-sky-700 flex items-center gap-1">
            {t('home.viewAll')} <ArrowRight size={16} className="rtl:rotate-180" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {categories.map((cat) => {
            const Icon = iconMap[cat.icon] ?? Smartphone;
            return (
              <Link
                key={cat.id}
                to={`/search?category=${cat.slug}`}
                className="group flex flex-col items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-sky-300 hover:shadow-md transition-all"
              >
                <div className="w-14 h-14 rounded-full bg-sky-50 group-hover:bg-sky-100 flex items-center justify-center transition-colors">
                  <Icon className="text-sky-500" size={24} />
                </div>
                <span className="text-xs font-medium text-gray-700 text-center">{cat.name}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Deals of the Day */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-gradient-to-r from-rose-50 to-orange-50 rounded-2xl p-6 border border-rose-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-500 rounded-lg flex items-center justify-center">
                <Zap className="text-white" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{t('home.dealsOfDay')}</h2>
                <p className="text-sm text-gray-500">{t('home.limitedOffers')}</p>
              </div>
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl h-72 animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {deals.map((p) => (
                <Link
                  key={p.id}
                  to={`/product/${p.id}`}
                  className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all"
                >
                  <div className="aspect-square overflow-hidden bg-gray-50">
                    {p.images?.[0]?.url && (
                      <img src={p.images[0].url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-1">{p.name}</h3>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-lg font-bold text-rose-500">{formatPriceSimple(p.price)}</span>
                      {p.compare_price && (
                        <span className="text-xs text-gray-400 line-through">{formatPriceSimple(p.compare_price)}</span>
                      )}
                    </div>
                    {p.compare_price && (
                      <span className="inline-block mt-1 text-xs font-bold text-rose-500">
                        -{discountPercent(p.price, p.compare_price)}% OFF
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Products */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{t('home.featuredProducts')}</h2>
          <Link to="/search" className="text-sm font-medium text-sky-600 hover:text-sky-700 flex items-center gap-1">
            {t('home.viewAll')} <ArrowRight size={16} className="rtl:rotate-180" />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl h-80 animate-pulse"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
