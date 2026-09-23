import { useI18n } from '@/contexts/I18nContext';
import { useState, useEffect, useRef } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { countryOptions } from '@/constants/countries';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/lib/types';
import { slugify, classNames } from '@/lib/utils';
import { Loader2, Store, ShoppingBag, Truck, FileUp, AlertCircle, CheckCircle } from 'lucide-react';

export default function SignUp() {
  const { t } = useI18n();
  const { signUp, verifySignupOtp, resendSignupOtp, submitVendorKyc } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('IQ');
  const [role, setRole] = useState<UserRole>('customer');
  const [document, setDocument] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('identity');
  const [legalName, setLegalName] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [otp, setOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  const otpInputRef = useRef<HTMLInputElement>(null);

  // Check URL parameters for preselected role or verifyEmail redirection
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roleParam = params.get('role');
    if (roleParam === 'vendor') {
      setRole('vendor');
    }
    const verifyEmailParam = params.get('verifyEmail');
    if (verifyEmailParam) {
      setEmail(verifyEmailParam.trim().toLowerCase());
      setOtpMode(true);
      setInfoMessage(t('auth.codeSent', { email: verifyEmailParam }));
    }
  }, [location.search, t]);

  // Focus OTP input on entering OTP mode
  useEffect(() => {
    if (otpMode && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [otpMode]);

  // Countdown timer for resending OTP
  useEffect(() => {
    if (resendTimer > 0) {
      const id = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(id);
    }
  }, [resendTimer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();

    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!cleanName) {
      setError('Please enter your full name.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your password confirmation.');
      return;
    }
    if (role === 'vendor') {
      if (!legalName.trim()) {
        setError('Please enter your legal business name.');
        return;
      }
      if (!phone.trim()) {
        setError('Please enter your contact phone number.');
        return;
      }
      if (!document) {
        setError('Identity or business document is required for vendor registration.');
        return;
      }
    }

    setLoading(true);
    const r = await signUp(cleanEmail, password, cleanName, role, phone, countryCode, turnstileToken ?? undefined);
    if (r.error) {
      setLoading(false);
      setError(r.error);
    } else if (r.needsOtp) {
      setLoading(false);
      setOtpMode(true);
      setResendTimer(60);
      setInfoMessage(t('auth.codeSent', { email: cleanEmail }));
    } else {
      // Auto-confirmed or immediate session
      if (role === 'vendor' && document) {
        const k = await submitVendorKyc({ legalName: legalName.trim(), phone: phone.trim(), countryCode, document, documentType });
        setLoading(false);
        if (k.error) {
          setError(k.error);
          return;
        }
        navigate('/vendor');
      } else {
        setLoading(false);
        navigate(role === 'vendor' ? '/vendor' : '/');
      }
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = otp.trim().replace(/\D/g, '');

    if (cleanToken.length !== 6) {
      setError('Please enter all 6 digits of your verification code.');
      return;
    }

    setLoading(true);
    const result = await verifySignupOtp(cleanEmail, cleanToken);

    if (result.error) {
      setLoading(false);
      setError(result.error);
      return;
    }

    const currentUser = result.user || (await supabase.auth.getUser()).data.user;
    if (!currentUser) {
      setLoading(false);
      setError('Account verified. Please sign in to continue.');
      navigate('/signin');
      return;
    }

    if (role === 'vendor') {
      try {
        const slug = `${slugify(legalName.trim() || 'shop')}-${Date.now().toString(36)}`;
        await supabase.from('shops').insert({
          owner_id: currentUser.id,
          name: legalName.trim() || 'My Shop',
          slug,
          description: '',
          status: 'pending',
        });

        await supabase.from('profiles').update({ role: 'vendor', status: 'pending' }).eq('id', currentUser.id);

        if (document) {
          await submitVendorKyc({
            legalName: legalName.trim(),
            phone: phone.trim(),
            countryCode,
            document,
            documentType,
          });
        }

        setLoading(false);
        navigate('/vendor');
      } catch (err) {
        setLoading(false);
        setError(err instanceof Error ? err.message : 'Vendor shop registration setup failed.');
        return;
      }
    } else {
      setLoading(false);
      navigate('/');
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || loading) return;
    setError(null);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const res = await resendSignupOtp(cleanEmail);
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      setResendTimer(60);
      setInfoMessage('Verification code resent successfully. Please check your inbox.');
    }
  };

  if (otpMode) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center mb-3">
              <CheckCircle size={28} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{t('auth.verifyEmail')}</h1>
            <p className="text-sm text-slate-500 mt-2">
              {t('auth.codeSent', { email })}
            </p>
          </div>

          {infoMessage && !error && (
            <div className="mb-4 p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800 flex items-center gap-2">
              <CheckCircle size={16} className="shrink-0 text-sky-600" />
              <span>{infoMessage}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 text-center">
                6-Digit Verification Code
              </label>
              <input
                ref={otpInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && otp.length === 6) {
                    handleVerifyOtp(e);
                  }
                }}
                className="w-full h-14 text-center tracking-[0.5em] text-3xl font-mono rounded-xl border border-slate-300 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all text-slate-900"
                placeholder="••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full h-11 bg-sky-500 text-white font-medium rounded-xl disabled:opacity-50 hover:bg-sky-600 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {t('auth.verify')}
            </button>

            <div className="pt-2 text-center">
              {resendTimer > 0 ? (
                <span className="text-xs text-slate-500">
                  {t('auth.resendIn', { seconds: resendTimer })}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleResend}
                  className="text-xs font-medium text-sky-600 hover:text-sky-700 hover:underline"
                >
                  {t('auth.resend')}
                </button>
              )}
            </div>
          </form>

          <p className="text-center text-xs text-slate-400 mt-6 pt-4 border-t border-slate-100">
            Entered the wrong email?{' '}
            <button
              type="button"
              onClick={() => { setOtpMode(false); setOtp(''); setError(null); }}
              className="text-sky-600 font-medium hover:underline"
            >
              Change email
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex flex-col items-center mb-8 text-center">
            <Link to="/" className="w-14 h-14 bg-sky-500 rounded-2xl flex items-center justify-center mb-3 shadow-sm hover:bg-sky-600 transition-colors">
              <Store className="text-white" size={28} />
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">{t('auth.createAccount')}</h1>
            <p className="text-sm text-slate-500 mt-1">{t('auth.onboarding')}</p>
          </div>

          {error && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-start gap-2.5">
              <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => setRole('customer')}
              className={classNames(
                'p-3.5 rounded-xl border-2 text-center transition-all',
                role === 'customer'
                  ? 'border-sky-500 bg-sky-50/60 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              )}
            >
              <ShoppingBag className="mx-auto mb-1.5 text-sky-500" size={22} />
              <p className="text-sm font-semibold text-slate-900">{t('auth.customer')}</p>
            </button>
            <button
              type="button"
              onClick={() => setRole('vendor')}
              className={classNames(
                'p-3.5 rounded-xl border-2 text-center transition-all',
                role === 'vendor'
                  ? 'border-sky-500 bg-sky-50/60 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              )}
            >
              <Truck className="mx-auto mb-1.5 text-sky-500" size={22} />
              <p className="text-sm font-semibold text-slate-900">{t('auth.vendor')}</p>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{t('auth.fullName')}</label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 text-slate-900"
                placeholder={t('auth.fullName')}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{t('auth.email')}</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 text-slate-900"
                placeholder={t('auth.emailPlaceholder')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">{t('auth.password')}</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 text-slate-900"
                  placeholder="Min. 8 chars"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 text-slate-900"
                  placeholder="Repeat password"
                />
              </div>
            </div>

            {role === 'vendor' && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">{t('auth.legalName')}</label>
                  <input
                    required
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 text-slate-900"
                    placeholder="e.g. Acme Retail Ltd"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t('auth.phone')}</label>
                    <input
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 text-slate-900"
                      placeholder="+1234567890"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Country</label>
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 text-slate-900 bg-white"
                    >
                      {countryOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label || opt.value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Document Type</label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 text-slate-900 bg-white"
                  >
                    <option value="identity">{t('auth.identityDocument')}</option>
                    <option value="business_registration">{t('auth.businessRegistration')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">KYC Document (PDF/Image)</label>
                  <label className="flex items-center gap-3 p-3 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-sky-500 hover:bg-slate-50 transition-colors">
                    <FileUp className="text-sky-500 shrink-0" size={20} />
                    <span className="text-xs text-slate-600 truncate">{document?.name || t('auth.uploadDocument')}</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      required
                      onChange={(e) => setDocument(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}

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
              className="w-full h-11 bg-sky-500 text-white font-medium rounded-xl disabled:opacity-50 hover:bg-sky-600 transition-colors flex items-center justify-center gap-2 shadow-sm mt-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {t('auth.createAccount')}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6 pt-4 border-t border-slate-100">
            {t('auth.alreadyAccount')}{' '}
            <Link to="/signin" className="text-sky-600 font-medium hover:text-sky-700 transition-colors">
              {t('auth.signin')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
