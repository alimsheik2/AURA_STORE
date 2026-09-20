import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Smartphone,
  Shirt,
  Sofa,
  Dumbbell,
  Heart,
  Watch,
  Laptop,
  Utensils,
  ArrowRight,
  Sparkles,
  Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product, Category } from '@/lib/types';
import ProductCard from '@/components/ProductCard';
import { useI18n } from '@/contexts/I18nContext';
import { formatPriceSimple, discountPercent } from '@/lib/utils';

const iconMap: Record<string, typeof Smartphone> = {
  Smartphone,
  Shirt,
  Sofa,
  Dumbbell,
  Heart,
  Watch,
  Laptop,
  Utensils,
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
      title: t('home.bannerTechTitle'),
      subtitle: t('home.bannerTechSubtitle'),
      cta: t('home.bannerTechCta'),
      link: '/search?category=electronics',
      icon: Smartphone,
    },
    {
      title: t('home.bannerFashionTitle'),
      subtitle: t('home.bannerFashionSubtitle'),
      cta: t('home.bannerFashionCta'),
      link: '/search?category=fashion',
      icon: Shirt,
    },
    {
      title: t('home.bannerHomeTitle'),
      subtitle: t('home.bannerHomeSubtitle'),
      cta: t('home.bannerHomeCta'),
      link: '/search?category=home-living',
      icon: Sofa,
    },
  ];

  return (
    <div className="bg-white min-h-screen">
      {/* Hero */}
      <section className="relative bg-slate-900 overflow-hidden text-white">
        <div className="relative max-w-7xl mx-auto px-4 py-16 md:py-24">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-sky-500/10 text-sky-400 border border-sky-500/20 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <Sparkles size={16} />
              {t('home.badge')}
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-4">
              {t('hero.title')}
            </h1>
            <p className="text-lg text-slate-300 mb-8 max-w-xl">
              {t('hero.subtitle')}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/search"
                className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-sm"
              >
                {t('hero.shopNow')} <ArrowRight size={20} className="rtl:rotate-180" />
              </Link>
              <Link
                to="/become-vendor"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-xl transition-colors border border-white/20"
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
                className="group relative overflow-hidden rounded-2xl bg-white border border-gray-200 p-6 h-44 flex flex-col justify-between transition-all hover:border-sky-300 hover:shadow-md shadow-sm"
              >
                <div className="absolute -end-4 -bottom-4 opacity-5 pointer-events-none">
                  <Icon size={120} className="text-slate-900" />
                </div>
                <div className="relative">
                  <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center mb-3">
                    <Icon className="text-sky-500" size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{b.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">{b.subtitle}</p>
                </div>
                <span className="relative text-sm font-semibold text-sky-600 flex items-center gap-1 group-hover:gap-2 transition-all">
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
          <h2 className="text-2xl font-bold text-slate-900">{t('home.topCategories')}</h2>
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
                className="group flex flex-col items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-sky-400 hover:shadow-sm transition-all"
              >
                <div className="w-14 h-14 rounded-full bg-sky-50 group-hover:bg-sky-100 flex items-center justify-center transition-colors">
                  <Icon className="text-sky-500" size={24} />
                </div>
                <span className="text-xs font-medium text-slate-700 text-center">
                  {t(`category.${cat.slug}`) !== `category.${cat.slug}` ? t(`category.${cat.slug}`) : cat.name}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Deals of the Day */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-500 rounded-lg flex items-center justify-center">
                <Zap className="text-white" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{t('home.dealsOfDay')}</h2>
                <p className="text-sm text-slate-500">{t('home.limitedOffers')}</p>
              </div>
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-slate-100 rounded-xl h-72 animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {deals.map((p) => (
                <Link
                  key={p.id}
                  to={`/product/${p.id}`}
                  className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-sky-300 hover:shadow-md transition-all flex flex-col"
                >
                  <div className="aspect-square overflow-hidden bg-slate-50">
                    {p.images?.[0]?.url && (
                      <img
                        src={p.images[0].url}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-slate-900 line-clamp-1">{p.name}</h3>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-lg font-bold text-slate-900">{formatPriceSimple(p.price)}</span>
                        {p.compare_price && (
                          <span className="text-xs text-slate-400 line-through">
                            {formatPriceSimple(p.compare_price)}
                          </span>
                        )}
                      </div>
                    </div>
                    {p.compare_price && (
                      <span className="inline-block mt-2 text-xs font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded w-fit">
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
          <h2 className="text-2xl font-bold text-slate-900">{t('home.featuredProducts')}</h2>
          <Link to="/search" className="text-sm font-medium text-sky-600 hover:text-sky-700 flex items-center gap-1">
            {t('home.viewAll')} <ArrowRight size={16} className="rtl:rotate-180" />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="bg-slate-100 rounded-xl h-80 animate-pulse"></div>
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
