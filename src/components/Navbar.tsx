import { Link, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import {
  Search, ShoppingCart, User, Menu, X, Store, LayoutDashboard,
  Shield, LogOut, Package, Globe, ChevronDown
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useI18n } from '@/contexts/I18nContext';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/types';
import { classNames } from '@/lib/utils';

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const { itemCount } = useCart();
  const { t, lang, setLanguage } = useI18n();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggest(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('products')
        .select('*, shop:shops(name), images:product_images(url)')
        .eq('status', 'active')
        .ilike('name', `%${searchQuery.trim()}%`)
        .limit(5);
      setSuggestions((data as Product[]) ?? []);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setShowSuggest(false);
      setMobileOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      {/* Top bar */}
      <div className="bg-slate-800 text-white text-xs">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-9">
          <p className="hidden sm:block">{t('nav.freeShipping')}</p>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1 hover:text-sky-300 transition-colors cursor-pointer">
              <Globe size={14} />
              <span className="sr-only">{t('nav.language')}</span>
              <select value={lang} onChange={(e) => setLanguage(e.target.value as typeof lang)} className="bg-transparent border-0 outline-none text-white text-xs cursor-pointer">
                <option value="ar">العربية</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="es">Español</option>
                <option value="de">Deutsch</option>
                <option value="zh">中文</option>
                <option value="ru">Русский</option>
              </select>
            </label>
            {user && profile?.role === 'vendor' && (
              <Link to="/vendor" className="hidden sm:flex items-center gap-1 hover:text-sky-300 transition-colors">
                <LayoutDashboard size={14} /> {t('nav.dashboard')}
              </Link>
            )}
            {user && profile?.role === 'admin' && (
              <Link to="/admin" className="hidden sm:flex items-center gap-1 hover:text-sky-300 transition-colors">
                <Shield size={14} /> {t('nav.admin')}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main nav */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-4 h-16">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden text-gray-600"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-sky-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Store className="text-white" size={20} />
            </div>
            <span className="text-xl font-bold text-gray-900 hidden sm:block">{t('brand.name')}</span>
          </Link>

          {/* Search */}
          <div ref={searchRef} className="flex-1 max-w-2xl relative">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowSuggest(true); }}
                  onFocus={() => setShowSuggest(true)}
                  placeholder={t('nav.productsPlaceholder')}
                  className="w-full h-10 ps-4 pe-10 rounded-full border border-gray-300 bg-gray-50 text-sm focus:outline-none focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all"
                />
                <button type="submit" className="absolute end-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-sky-500">
                  <Search size={20} />
                </button>
              </div>
            </form>

            {/* Autocomplete */}
            {showSuggest && suggestions.length > 0 && (
              <div className="absolute top-full mt-2 w-full bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden z-50">
                {suggestions.map((p) => (
                  <Link
                    key={p.id}
                    to={`/product/${p.id}`}
                    onClick={() => { setShowSuggest(false); setSearchQuery(''); }}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
                  >
                    {p.images?.[0]?.url && (
                      <img src={p.images[0].url} alt={p.name} className="w-12 h-12 rounded-lg object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.shop?.name}</p>
                    </div>
                    <span className="text-sm font-bold text-sky-600">${p.price.toFixed(2)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Cart */}
            <Link to="/cart" className="relative p-2 text-gray-600 hover:text-sky-600 transition-colors">
              <ShoppingCart size={24} />
              {itemCount > 0 && (
                <span className="absolute -top-1 -end-1 bg-rose-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>

            {/* User menu */}
            {user ? (
              <div ref={userMenuRef} className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-1 p-2 text-gray-600 hover:text-sky-600 transition-colors"
                >
                  <User size={24} />
                  <ChevronDown size={16} className="hidden sm:block" />
                </button>
                {userMenuOpen && (
                  <div className="absolute end-0 top-full mt-2 w-56 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden z-50">
                    <div className="p-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900">{profile?.full_name || 'User'}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <div className="py-1">
                      <Link to="/orders" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        <Package size={16} /> {t('nav.orders')}
                      </Link>
                      {profile?.role === 'vendor' && (
                        <Link to="/vendor" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <LayoutDashboard size={16} /> {t('nav.dashboard')}
                        </Link>
                      )}
                      {profile?.role === 'admin' && (
                        <Link to="/admin" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <Shield size={16} /> {t('nav.admin')}
                        </Link>
                      )}
                      <Link to="/become-vendor" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        <Store size={16} /> {t('nav.becomeVendor')}
                      </Link>
                    </div>
                    <div className="border-t border-gray-100 py-1">
                      <button
                        onClick={() => { signOut(); setUserMenuOpen(false); navigate('/'); }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 w-full text-start"
                      >
                        <LogOut size={16} /> {t('nav.signout')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Link to="/signin" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-sky-600 transition-colors">
                  {t('nav.signin')}
                </Link>
                <Link to="/signup" className="px-4 py-2 text-sm font-medium text-white bg-sky-500 rounded-lg hover:bg-sky-600 transition-colors">
                  {t('nav.signup')}
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Category bar - desktop */}
        <nav className="hidden lg:flex items-center gap-6 h-10 text-sm text-gray-600 border-t border-gray-100">
          <Link to="/" className="hover:text-sky-600 transition-colors font-medium">{t('nav.home')}</Link>
          <Link to="/search" className="hover:text-sky-600 transition-colors">{t('common.allCategories')}</Link>
          <Link to="/search?category=electronics" className="hover:text-sky-600 transition-colors">{t('nav.electronics')}</Link>
          <Link to="/search?category=fashion" className="hover:text-sky-600 transition-colors">{t('nav.fashion')}</Link>
          <Link to="/search?category=home-living" className="hover:text-sky-600 transition-colors">{t('nav.homeLiving')}</Link>
          <Link to="/search?category=accessories" className="hover:text-sky-600 transition-colors">{t('nav.accessories')}</Link>
          <Link to="/search?category=sports-outdoors" className="hover:text-sky-600 transition-colors">{t('nav.sports')}</Link>
          <Link to="/become-vendor" className="hover:text-sky-600 transition-colors ms-auto flex items-center gap-1">
            <Store size={16} /> {t('nav.becomeVendor')}
          </Link>
        </nav>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-gray-200 bg-white px-4 py-4 space-y-3">
          <Link to="/" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700 hover:text-sky-600">{t('nav.home')}</Link>
          <Link to="/search" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700 hover:text-sky-600">{t('common.allCategories')}</Link>
          <Link to="/search?category=electronics" onClick={() => setMobileOpen(false)} className="block text-sm text-gray-600">{t('nav.electronics')}</Link>
          <Link to="/search?category=fashion" onClick={() => setMobileOpen(false)} className="block text-sm text-gray-600">{t('nav.fashion')}</Link>
          <Link to="/search?category=home-living" onClick={() => setMobileOpen(false)} className="block text-sm text-gray-600">{t('nav.homeLiving')}</Link>
          <Link to="/search?category=accessories" onClick={() => setMobileOpen(false)} className="block text-sm text-gray-600">{t('nav.accessories')}</Link>
          <Link to="/become-vendor" onClick={() => setMobileOpen(false)} className="block text-sm text-gray-600">{t('nav.becomeVendor')}</Link>
          {!user && (
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <Link to="/signin" onClick={() => setMobileOpen(false)} className="flex-1 text-center px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg">{t('nav.signin')}</Link>
              <Link to="/signup" onClick={() => setMobileOpen(false)} className="flex-1 text-center px-4 py-2 text-sm font-medium text-white bg-sky-500 rounded-lg">{t('nav.signup')}</Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
