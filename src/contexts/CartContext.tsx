import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import type { CartItem, Product, ProductVariation } from '@/lib/types';

interface CartContextValue {
  items: CartItem[];
  loading: boolean;
  addItem: (product: Product, variation: ProductVariation | null, quantity?: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  itemCount: number;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCart = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('cart_items')
      .select(`
        *,
        product:products(*, shop:shops(*), category:categories(*), images:product_images(*), variations:product_variations(*)),
        variation:product_variations(*)
      `)
      .eq('user_id', user.id);
    setItems((data as CartItem[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addItem: CartContextValue['addItem'] = async (product, variation, quantity = 1) => {
    if (!user) return;
    const existing = items.find(
      (i) => i.product_id === product.id && i.variation_id === (variation?.id ?? null)
    );
    if (existing) {
      await updateQuantity(existing.id, existing.quantity + quantity);
    } else {
      await supabase.from('cart_items').insert({
        user_id: user.id,
        product_id: product.id,
        variation_id: variation?.id ?? null,
        quantity,
      });
      await fetchCart();
    }
  };

  const removeItem: CartContextValue['removeItem'] = async (itemId) => {
    if (!user) return;
    await supabase.from('cart_items').delete().eq('id', itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const updateQuantity: CartContextValue['updateQuantity'] = async (itemId, quantity) => {
    if (!user || quantity < 1) return;
    await supabase.from('cart_items').update({ quantity }).eq('id', itemId);
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, quantity } : i)));
  };

  const clearCart: CartContextValue['clearCart'] = async () => {
    if (!user) return;
    await supabase.from('cart_items').delete().eq('user_id', user.id);
    setItems([]);
  };

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => {
    const price = i.product?.price ?? 0;
    const adj = i.variation?.price_adjustment ?? 0;
    return sum + (price + adj) * i.quantity;
  }, 0);

  return (
    <CartContext.Provider value={{ items, loading, addItem, removeItem, updateQuantity, clearCart, itemCount, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
