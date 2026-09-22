import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import ProductCard from '@/components/ProductCard';
import type { Shop, Product } from '@/lib/types';
import { Store, UserCheck, UserPlus, Star, ShieldCheck } from 'lucide-react';

export default function PublicStorefront() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStorefront() {
      if (!slug) return;
      setLoading(true);
      try {
        const { data: shopData, error: shopError } = await supabase
          .from('shops')
          .select('*')
          .eq('slug', slug)
          .single();

        if (shopError || !shopData) {
          setLoading(false);
          return;
        }

        setShop(shopData as Shop);

        // Fetch products by shop_id
        const { data: prods } = await supabase
          .from('products')
          .select('*, shop:shops(*), images:product_images(*)')
          .eq('shop_id', shopData.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        setProducts((prods || []) as Product[]);

        // Fetch followers count
        const { count } = await supabase
          .from('store_followers')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', shopData.id);

        setFollowerCount(count || 0);

        // Check if user is following
        if (user) {
          const { data: follow } = await supabase
            .from('store_followers')
            .select('id')
            .eq('shop_id', shopData.id)
            .eq('user_id', user.id)
            .maybeSingle();

          setIsFollowing(!!follow);
        }
      } catch (err) {
        console.error('Error loading storefront:', err);
      } finally {
        setLoading(false);
      }
    }

    loadStorefront();
  }, [slug, user]);

  const toggleFollow = async () => {
    if (!user || !shop) return;
    if (isFollowing) {
      await supabase.from('store_followers').delete().eq('shop_id', shop.id).eq('user_id', user.id);
      setIsFollowing(false);
      setFollowerCount((prev) => Math.max(0, prev - 1));
    } else {
      await supabase.from('store_followers').insert({ shop_id: shop.id, user_id: user.id });
      setIsFollowing(true);
      setFollowerCount((prev) => prev + 1);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Loading storefront...</div>;
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <Store size={48} className="mx-auto text-slate-300 mb-4" />
          <h1 className="text-xl font-bold text-slate-900">Store Not Found</h1>
          <p className="text-sm text-slate-500 mt-2 mb-6">The store you are looking for does not exist or has been suspended.</p>
          <Link to="/" className="px-6 py-2.5 bg-sky-500 text-white rounded-lg font-medium">Return Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-12">
      {/* Banner Header */}
      <div className="bg-slate-900 text-white py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-slate-900 overflow-hidden shadow-md">
              {shop.logo_url ? (
                <img src={shop.logo_url} alt={shop.name} className="w-full h-full object-cover" />
              ) : (
                <Store size={40} className="text-sky-500" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{shop.name}</h1>
                <ShieldCheck size={20} className="text-sky-400" />
              </div>
              <p className="text-sm text-slate-300 mt-1 max-w-xl">{shop.description || 'Verified Marketplace Vendor Store'}</p>
              <div className="flex items-center gap-4 mt-3 text-xs text-slate-300">
                <span className="flex items-center gap-1"><Star size={14} className="text-amber-400 fill-amber-400" /> 4.9 (120 reviews)</span>
                <span>•</span>
                <span>{followerCount} Followers</span>
                <span>•</span>
                <span>{products.length} Products</span>
              </div>
            </div>
          </div>

          <div>
            <button
              onClick={toggleFollow}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-colors shadow-sm ${
                isFollowing
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  : 'bg-sky-500 hover:bg-sky-600 text-white'
              }`}
            >
              {isFollowing ? <UserCheck size={18} /> : <UserPlus size={18} />}
              {isFollowing ? 'Following Store' : 'Follow Store'}
            </button>
          </div>
        </div>
      </div>

      {/* Store Products */}
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <h2 className="text-xl font-bold text-slate-900">Store Products ({products.length})</h2>
        {products.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            This store currently has no published products.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
