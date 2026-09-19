import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product, Category, Shop } from '@/lib/types';
import ProductCard from '@/components/ProductCard';
import { useI18n } from '@/contexts/I18nContext';
import { classNames } from '@/lib/utils';

type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest';

export default function Search() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') ?? '');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedShop, setSelectedShop] = useState('');
  const [sort, setSort] = useState<SortOption>('relevance');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('products')
      .select('*, shop:shops(name, slug), category:categories(name, slug), images:product_images(url)')
      .eq('status', 'active');

    if (query.trim()) q = q.ilike('name', `%${query.trim()}%`);
    if (selectedCategory) q = q.eq('category.slug', selectedCategory);
    if (minRating > 0) q = q.gte('rating', minRating);
    if (selectedBrand) q = q.eq('brand', selectedBrand);
    if (selectedShop) q = q.eq('shop.slug', selectedShop);
    if (minPrice) q = q.gte('price', parseFloat(minPrice));
    if (maxPrice) q = q.lte('price', parseFloat(maxPrice));

    switch (sort) {
      case 'price_asc': q = q.order('price', { ascending: true }); break;
      case 'price_desc': q = q.order('price', { ascending: false }); break;
      case 'rating': q = q.order('rating', { ascending: false }); break;
      case 'newest': q = q.order('created_at', { ascending: false }); break;
      default: q = q.order('rating_count', { ascending: false });
    }

    const { data } = await q.limit(60);
    setProducts((data as Product[]) ?? []);
    setLoading(false);
  }, [query, selectedCategory, minRating, selectedBrand, selectedShop, minPrice, maxPrice, sort]);

  useEffect(() => {
    supabase.from('categories').select('*').order('name').then(({ data }) => setCategories((data as Category[]) ?? []));
    supabase.from('shops').select('*').eq('status', 'approved').order('name').then(({ data }) => setShops((data as Shop[]) ?? []));
  }, []);

  useEffect(() => {
    setQuery(searchParams.get('q') ?? '');
    setSelectedCategory(searchParams.get('category') ?? '');
  }, [searchParams]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const brands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean)));

  const updateCategory = (slug: string) => {
    setSelectedCategory(slug);
    const params = new URLSearchParams(searchParams);
    if (slug) params.set('category', slug); else params.delete('category');
    setSearchParams(params);
  };

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Category */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('common.category')}</h3>
        <div className="space-y-1.5">
          <button
            onClick={() => updateCategory('')}
            className={classNames(
              'block w-full text-start text-sm px-3 py-1.5 rounded-lg transition-colors',
              !selectedCategory ? 'bg-sky-50 text-sky-600 font-medium' : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            {t('common.allCategories')}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => updateCategory(c.slug)}
              className={classNames(
                'block w-full text-start text-sm px-3 py-1.5 rounded-lg transition-colors',
                selectedCategory === c.slug ? 'bg-sky-50 text-sky-600 font-medium' : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Price */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('common.price')}</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="w-full h-9 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400"
          />
          <span className="text-gray-400"></span>
          <input
            type="number"
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-full h-9 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-sky-400"
          />
        </div>
      </div>

      {/* Rating */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('common.rating')}</h3>
        <div className="space-y-1.5">
          {[0, 3, 4, 4.5].map((r) => (
            <button
              key={r}
              onClick={() => setMinRating(r)}
              className={classNames(
                'block w-full text-start text-sm px-3 py-1.5 rounded-lg transition-colors',
                minRating === r ? 'bg-sky-50 text-sky-600 font-medium' : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              {r === 0 ? 'All ratings' : `${r}+ stars`}
            </button>
          ))}
        </div>
      </div>

      {/* Brand */}
      {brands.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('common.brand')}</h3>
          <div className="space-y-1.5">
            <button
              onClick={() => setSelectedBrand('')}
              className={classNames(
                'block w-full text-start text-sm px-3 py-1.5 rounded-lg transition-colors',
                !selectedBrand ? 'bg-sky-50 text-sky-600 font-medium' : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              All brands
            </button>
            {brands.map((b) => (
              <button
                key={b}
                onClick={() => setSelectedBrand(b)}
                className={classNames(
                  'block w-full text-start text-sm px-3 py-1.5 rounded-lg transition-colors',
                  selectedBrand === b ? 'bg-sky-50 text-sky-600 font-medium' : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Vendor */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('common.vendor')}</h3>
        <div className="space-y-1.5">
          <button
            onClick={() => setSelectedShop('')}
            className={classNames(
              'block w-full text-start text-sm px-3 py-1.5 rounded-lg transition-colors',
              !selectedShop ? 'bg-sky-50 text-sky-600 font-medium' : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            All vendors
          </button>
          {shops.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedShop(s.slug)}
              className={classNames(
                'block w-full text-start text-sm px-3 py-1.5 rounded-lg transition-colors',
                selectedShop === s.slug ? 'bg-sky-50 text-sky-600 font-medium' : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar - desktop */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-32">
              <FilterContent />
            </div>
          </aside>

          {/* Main */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {query ? `Results for "${query}"` : 'All Products'}
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {loading ? '...' : `${products.length} ${t('common.results')}`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFilters(true)}
                  className="lg:hidden flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                >
                  <SlidersHorizontal size={16} /> {t('common.filters')}
                </button>

                <div className="relative">
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortOption)}
                    className="appearance-none h-10 ps-4 pe-10 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-sky-400 cursor-pointer"
                  >
                    <option value="relevance">{t('search.mostPopular')}</option>
                    <option value="price_asc">{t('search.lowToHigh')}</option>
                    <option value="price_desc">{t('search.highToLow')}</option>
                    <option value="rating">{t('search.highestRated')}</option>
                    <option value="newest">{t('search.newest')}</option>
                  </select>
                  <ChevronDown className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                </div>
              </div>
            </div>

            {/* Products grid */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-white rounded-xl h-80 animate-pulse"></div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <p className="text-gray-500">{t('common.noResults')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      {showFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowFilters(false)} />
          <div className="absolute end-0 top-0 bottom-0 w-80 max-w-[85%] bg-white overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">{t('common.filters')}</h2>
              <button onClick={() => setShowFilters(false)}><X size={22} /></button>
            </div>
            <FilterContent />
            <button
              onClick={() => setShowFilters(false)}
              className="w-full h-11 bg-sky-500 text-white font-medium rounded-lg mt-6"
            >
              Show {products.length} results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
