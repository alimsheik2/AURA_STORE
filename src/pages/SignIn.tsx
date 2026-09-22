import { useI18n } from '@/contexts/I18nContext';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Turnstile } from '@marsidev/react-turnstile';
import { Store, Mail, Lock, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function SignIn() {
  const { t } = useI18n();
  const { signIn, verifyLoginOtp, finishPasswordSignIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [pendingPassword, setPendingPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
    const r = await signIn(cleanEmail, password, turnstileToken ?? undefined);
    setLoading(false);
    if (r.error) {
      setError(r.error);
    } else if (r.needsOtp) {
      setPendingPassword(password);
      setOtpMode(true);
    } else {
      navigate('/');
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const r = await verifyLoginOtp(cleanEmail, otp);
    if (r.error) {
      setLoading(false);
      setError(r.error);
      return;
    }
    const final = await finishPasswordSignIn(cleanEmail, pendingPassword);
    setLoading(false);
    if (final.error) setError(final.error);
    else navigate('/');
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('demo1234');
    setError(null);
  };

  if (otpMode) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex flex-col items-center mb-8">
            <ShieldCheck className="text-sky-500 mb-3" size={42} />
            <h1 className="text-2xl font-bold text-slate-900">{t('auth.verifySignin')}</h1>
            <p className="text-sm text-slate-500 mt-2 text-center">
              {t('auth.codeSent', { email })}<br />
              <span className="text-xs text-sky-600 font-medium">{t('auth.demoOtpHint')}</span>
            </p>
          </div>
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-600">
              {error}
            </div>
          )}
          <form onSubmit={verify} className="space-y-4">
            <input
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full h-14 text-center tracking-[0.6em] text-2xl rounded-lg border border-gray-300 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              placeholder="000000"
            />
            <button
              disabled={loading || otp.length !== 6}
              className="w-full h-11 bg-sky-500 text-white font-medium rounded-lg disabled:opacity-50 hover:bg-sky-600 transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {t('auth.verifyAndSignIn')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-sky-500 rounded-2xl flex items-center justify-center mb-3 shadow-sm">
              <Store className="text-white" size={28} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{t('auth.welcomeBack')}</h1>
            <p className="text-sm text-slate-500 mt-1">{t('auth.secureSignin')}</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-600">
              {error}
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 ps-10 pe-4 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-slate-900"
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 ps-10 pe-4 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-slate-900"
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
              className="w-full h-11 bg-sky-500 text-white font-medium rounded-lg disabled:opacity-50 hover:bg-sky-600 transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {t('auth.signin')}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-slate-500 text-center mb-2.5">{t('auth.quickDemo')}</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillDemo('customer@aura.store')}
                className="py-1.5 px-2 text-xs bg-slate-50 hover:bg-sky-50 hover:text-sky-600 text-slate-700 rounded-lg transition-colors font-medium border border-slate-200"
              >
                {t('auth.customerAccount')}
              </button>
              <button
                type="button"
                onClick={() => fillDemo('vendor@aura.store')}
                className="py-1.5 px-2 text-xs bg-slate-50 hover:bg-sky-50 hover:text-sky-600 text-slate-700 rounded-lg transition-colors font-medium border border-slate-200"
              >
                {t('auth.vendorAccount')}
              </button>
              <button
                type="button"
                onClick={() => fillDemo('admin@aura.store')}
                className="py-1.5 px-2 text-xs bg-slate-50 hover:bg-sky-50 hover:text-sky-600 text-slate-700 rounded-lg transition-colors font-medium border border-slate-200"
              >
                {t('nav.admin')}
              </button>
            </div>
          </div>

          <p className="text-center text-sm text-slate-500 mt-6">
            {t('auth.noAccount')}{' '}
            <Link to="/signup" className="text-sky-600 font-medium hover:text-sky-700">
              {t('auth.signup')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
