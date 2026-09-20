import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Minus, Plus, Store, ChevronRight, Check,
  Truck, Shield, RotateCcw, Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product, Review, Profile } from '@/lib/types';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import StarRating from '@/components/StarRating';
import ProductCard from '@/components/ProductCard';
import { formatPriceSimple, discountPercent, classNames } from '@/lib/utils';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { user } = useAuth();
  const { t } = useI18n();

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<(Review & { profile?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedVariation, setSelectedVariation] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      setLoading(true);
      setActiveImage(0);
      setQuantity(1);
      setAdded(false);

      const { data } = await supabase
        .from('products')
        .select('*, shop:shops(*), category:categories(*), images:product_images(*), variations:product_variations(*)')
        .eq('id', id!)
        .maybeSingle();

      const p = data as Product | null;
      setProduct(p);

      if (p) {
        if (p.variations && p.variations.length > 0) {
          setSelectedVariation(p.variations[0].id);
        } else {
          setSelectedVariation(null);
        }

        // Related
        if (p.category_id) {
          const { data: relData } = await supabase
            .from('products')
            .select('*, shop:shops(name), images:product_images(url)')
            .eq('status', 'active')
            .eq('category_id', p.category_id)
            .neq('id', p.id)
            .limit(5);
          setRelated((relData as Product[]) ?? []);
        }

        // Reviews
        const { data: revData } = await supabase
          .from('reviews')
          .select('*, profile:profiles(full_name)')
          .eq('product_id', p.id)
          .order('created_at', { ascending: false })
          .limit(10);
        setReviews((revData as (Review & { profile?: Profile })[]) ?? []);
      }

      setLoading(false);
    }
    loadProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-sky-500" size={32} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">{t('product.notFound')}</p>
        <Link to="/" className="text-sky-600 font-medium">{t('product.backHome')}</Link>
      </div>
    );
  }

  const variation = product.variations?.find((v) => v.id === selectedVariation) ?? null;
  const finalPrice = product.price + (variation?.price_adjustment ?? 0);
  const discount = discountPercent(finalPrice, product.compare_price);
  const inStock = variation ? variation.stock > 0 : true;

  const handleAddToCart = async () => {
    if (!user) {
      navigate('/signin');
      return;
    }
    setAdding(true);
    await addItem(product, variation, quantity);
    setAdding(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const colors = Array.from(new Set(product.variations?.map((v) => v.color).filter(Boolean) ?? []));
  const sizes = Array.from(new Set(product.variations?.map((v) => v.size).filter(Boolean) ?? []));

  return (
    <div className="bg-white min-h-screen">
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <nav className="flex items-center gap-1 text-sm text-slate-500">
          <Link to="/" className="hover:text-sky-600">{t('nav.home')}</Link>
          <ChevronRight size={14} className="rtl:rotate-180" />
          {product.category && (
            <>
              <Link to={`/search?category=${product.category.slug}`} className="hover:text-sky-600">{product.category.name}</Link>
              <ChevronRight size={14} className="rtl:rotate-180" />
            </>
          )}
          <span className="text-slate-900 font-medium truncate">{product.name}</span>
        </nav>
      </div>

      {/* Product main */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Images */}
            <div>
              <div className="aspect-square rounded-xl overflow-hidden bg-gray-50 mb-4">
                {product.images?.[activeImage]?.url ? (
                  <img src={product.images[activeImage].url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <ShoppingCart size={64} />
                  </div>
                )}
              </div>
              {product.images && product.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {product.images.map((img, i) => (
                    <button
                      key={img.id}
                      onClick={() => setActiveImage(i)}
                      className={classNames(
                        'w-20 h-20 rounded-lg overflow-hidden border-2 shrink-0 transition-all',
                        activeImage === i ? 'border-sky-500' : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link to={`/search?vendor=${product.shop?.slug}`} className="inline-flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-700 font-medium">
                  <Store size={16} /> {product.shop?.name}
                </Link>
                {product.brand && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span className="text-sm text-gray-500">{product.brand}</span>
                  </>
                )}
              </div>

              <h1 className="text-2xl font-bold text-gray-900 mb-3">{product.name}</h1>

              <div className="flex items-center gap-3 mb-4">
                <StarRating rating={product.rating} size={18} showNumber count={product.rating_count} />
                {discount > 0 && (
                  <span className="bg-rose-100 text-rose-600 text-xs font-bold px-2 py-1 rounded-md">
                    {t('product.discountOff', { discount })}
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-3 mb-6">
                <span className="text-3xl font-bold text-gray-900">{formatPriceSimple(finalPrice)}</span>
                {product.compare_price && discount > 0 && (
                  <span className="text-lg text-gray-400 line-through">{formatPriceSimple(product.compare_price)}</span>
                )}
              </div>

              {/* Variations */}
              {colors.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.color')}</label>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          const v = product.variations?.find((v) => v.color === c);
                          if (v) setSelectedVariation(v.id);
                        }}
                        className={classNames(
                          'px-3 py-2 text-sm border rounded-lg transition-all',
                          variation?.color === c ? 'border-sky-500 bg-sky-50 text-sky-600' : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {sizes.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.size')}</label>
                  <div className="flex flex-wrap gap-2">
                    {product.variations?.filter((v) => v.size).map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariation(v.id)}
                        disabled={v.stock === 0}
                        className={classNames(
                          'px-3 py-2 text-sm border rounded-lg transition-all disabled:opacity-40',
                          selectedVariation === v.id ? 'border-sky-500 bg-sky-50 text-sky-600' : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        {v.size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Stock */}
              <div className="mb-4">
                {inStock ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                    <Check size={16} /> {t('common.inStock')}
                    {variation && ` (${variation.stock} ${t('product.available')})`}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-rose-600 font-medium">
                    {t('common.outOfStock')}
                  </span>
                )}
              </div>

              {/* Quantity + Add to cart */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-11 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-12 text-center text-sm font-medium">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-10 h-11 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  disabled={!inStock || adding}
                  className="flex-1 h-11 bg-sky-500 text-white font-medium rounded-lg hover:bg-sky-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {adding ? <Loader2 size={18} className="animate-spin" /> : added ? <Check size={18} /> : <ShoppingCart size={18} />}
                  {added ? t('product.added') : t('common.addToCart')}
                </button>
              </div>

              {/* Trust badges */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-100">
                <div className="flex flex-col items-center text-center gap-1">
                  <Truck className="text-sky-500" size={24} />
                  <span className="text-xs text-gray-600">{t('product.fastDelivery')}</span>
                </div>
                <div className="flex flex-col items-center text-center gap-1">
                  <Shield className="text-sky-500" size={24} />
                  <span className="text-xs text-gray-600">{t('product.securePayment')}</span>
                </div>
                <div className="flex flex-col items-center text-center gap-1">
                  <RotateCcw className="text-sky-500" size={24} />
                  <span className="text-xs text-gray-600">{t('product.easyReturns')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mt-8 pt-8 border-t border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-3">{t('common.description')}</h2>
            <p className="text-gray-600 leading-relaxed">{product.description}</p>
          </div>
        </div>

        {/* Reviews */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">{t('common.reviews')} ({reviews.length})</h2>
          {reviews.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('product.noReviews')}</p>
          ) : (
            <div className="space-y-4">
              {reviews.map((r) => (
                <div key={r.id} className="pb-4 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 font-medium text-sm">
                      {(r.profile?.full_name || 'A')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.profile?.full_name || 'Anonymous'}</p>
                      <StarRating rating={r.rating} size={14} />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 ps-12">{r.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('common.relatedProducts')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
