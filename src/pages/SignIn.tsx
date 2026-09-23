import { useI18n } from '@/contexts/I18nContext';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Turnstile } from '@marsidev/react-turnstile';
import { Store, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function SignIn() {
  const { t } = useI18n();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUnconfirmedEmail(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    const result = await signIn(cleanEmail, password, turnstileToken ?? undefined);
    setLoading(false);

    if (result.error) {
      if (result.emailUnconfirmed) {
        setUnconfirmedEmail(cleanEmail);
      }
      setError(result.error);
      return;
    }

    // Redirect based on role if available, or to home
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex flex-col items-center mb-8 text-center">
            <Link to="/" className="w-14 h-14 bg-sky-500 rounded-2xl flex items-center justify-center mb-3 shadow-sm hover:bg-sky-600 transition-colors">
              <Store className="text-white" size={28} />
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">{t('auth.welcomeBack')}</h1>
            <p className="text-sm text-slate-500 mt-1">{t('auth.signin')}</p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-start gap-2.5">
              <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-500" />
              <div className="flex-1">
                <p>{error}</p>
                {unconfirmedEmail && (
                  <button
                    type="button"
                    onClick={() => navigate(`/signup?verifyEmail=${encodeURIComponent(unconfirmedEmail)}`)}
                    className="mt-2 text-xs font-semibold text-sky-600 hover:text-sky-700 underline block"
                  >
                    {t('auth.verifyEmail')} →
                  </button>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('auth.email')}</label>
              <div className="relative">
                <Mail className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 ps-10 pe-4 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 text-slate-900 transition-all"
                  placeholder={t('auth.emailPlaceholder')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('auth.password')}</label>
              <div className="relative">
                <Lock className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 ps-10 pe-4 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 text-slate-900 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {import.meta.env.VITE_TURNSTILE_SITE_KEY && (
              <div className="flex justify-center my-2">
                <Turnstile
                  siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                  onSuccess={(token: string) => setTurnstileToken(token)}
                  onError={() => setTurnstileToken(null)}
                  onExpire={() => setTurnstileToken(null)}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-sky-500 text-white font-medium rounded-xl disabled:opacity-50 hover:bg-sky-600 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {t('auth.signin')}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6 pt-4 border-t border-slate-100">
            {t('auth.noAccount')}{' '}
            <Link to="/signup" className="text-sky-600 font-medium hover:text-sky-700 transition-colors">
              {t('auth.signup')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
