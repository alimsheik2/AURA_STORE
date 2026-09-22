import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import ProductCard from '@/components/ProductCard';
import type { Product } from '@/lib/types';
import { Heart, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Wishlist() {
  const { user } = useAuth();
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWishlist = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('wishlists')
        .select('product_id, products(*, shop:shops(*), images:product_images(*))')
        .eq('user_id', user.id);

      if (!error && data) {
        const prods = data.map((item: { products: unknown }) => item.products).filter(Boolean);
        setWishlistProducts(prods as Product[]);
      }
    } catch (err) {
      console.error('Error fetching wishlist:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md">
          <Heart size={48} className="mx-auto text-rose-500 mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Sign in to view your Wishlist</h1>
          <p className="text-sm text-slate-500 mb-6">Save your favorite marketplace items and access them anytime.</p>
          <Link
            to="/signin"
            className="inline-block px-6 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-lg transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-100 text-rose-600 rounded-xl">
            <Heart size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Wishlist</h1>
            <p className="text-sm text-slate-500">{wishlistProducts.length} items saved for later</p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500">Loading wishlist...</div>
        ) : wishlistProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <ShoppingBag size={48} className="mx-auto text-slate-300 mb-4" />
            <h2 className="text-lg font-bold text-slate-900 mb-1">Your wishlist is empty</h2>
            <p className="text-sm text-slate-500 mb-6">Explore products and click the heart icon to save items.</p>
            <Link
              to="/search"
              className="inline-block px-6 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-lg transition-colors"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {wishlistProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
