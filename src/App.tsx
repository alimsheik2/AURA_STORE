import { useI18n } from '@/contexts/I18nContext';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { I18nProvider } from '@/contexts/I18nContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Home from '@/pages/Home';
import Search from '@/pages/Search';
import ProductDetail from '@/pages/ProductDetail';
import Cart from '@/pages/Cart';
import Checkout from '@/pages/Checkout';
import OrderConfirmed from '@/pages/OrderConfirmed';
import Orders from '@/pages/Orders';
import SignIn from '@/pages/SignIn';
import SignUp from '@/pages/SignUp';
import BecomeVendor from '@/pages/BecomeVendor';
import VendorDashboard from '@/pages/VendorDashboard';
import AdminPanel from '@/pages/AdminPanel';
import AdminRevenue from '@/pages/AdminRevenue';
import AdminCommission from '@/pages/AdminCommission';
import AdminShipping from '@/pages/AdminShipping';
import Wishlist from '@/pages/Wishlist';
import PublicStorefront from '@/pages/PublicStorefront';
import Disputes from '@/pages/Disputes';
import Profile from '@/pages/Profile';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}


function RequireAuth({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">{t('common.loading')}</div>;
  return user ? <>{children}</> : <Navigate to="/signin" replace />;
}

function RequireRole({ role, children }: { role: 'admin' | 'vendor'; children: ReactNode }) {
  const { t } = useI18n();
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">{t('common.loading')}</div>;
  if (!user) return <Navigate to="/signin" replace />;
  const effectiveRole = profile?.role || (user.user_metadata?.role as 'admin' | 'vendor' | 'customer');
  if (effectiveRole !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Layout() {
  const { pathname } = useLocation();
  const isAuthPage = pathname === '/signin' || pathname === '/signup';

  return (
    <>
      <ScrollToTop />
      {!isAuthPage && <Navbar />}
      <main className={isAuthPage ? '' : 'min-h-screen'}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
          <Route path="/order-confirmed/:id" element={<OrderConfirmed />} />
          <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
          <Route path="/wishlist" element={<RequireAuth><Wishlist /></RequireAuth>} />
          <Route path="/store/:slug" element={<PublicStorefront />} />
          <Route path="/disputes" element={<RequireAuth><Disputes /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/become-vendor" element={<BecomeVendor />} />
          <Route path="/vendor" element={<RequireRole role="vendor"><VendorDashboard /></RequireRole>} />
          <Route path="/admin" element={<RequireRole role="admin"><AdminPanel /></RequireRole>} />
          <Route path="/admin/revenue" element={<RequireRole role="admin"><AdminRevenue /></RequireRole>} />
          <Route path="/admin/commission" element={<RequireRole role="admin"><AdminCommission /></RequireRole>} />
          <Route path="/admin/shipping" element={<RequireRole role="admin"><AdminShipping /></RequireRole>} />
        </Routes>
      </main>
      {!isAuthPage && <Footer />}
    </>
  );
}

function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <Layout />
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </I18nProvider>
  );
}

export default App;
