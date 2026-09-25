import { useI18n } from '@/contexts/I18nContext';
import { useState, useEffect } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import { Link, useNavigate } from 'react-router-dom';
import { countryOptions } from '@/constants/countries';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

import type { UserRole } from '@/lib/types';
import { slugify, classNames } from '@/lib/utils';
import { Loader2, Store, ShoppingBag, Truck, FileUp } from 'lucide-react';

export default function SignUp() {
  const { t } = useI18n();
  const { signUp, verifySignupOtp, resendSignupOtp, submitVendorKyc } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('IQ');
  const [role, setRole] = useState<UserRole>('customer');
  const [document, setDocument] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('identity');
  const [legalName, setLegalName] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [otp, setOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  useEffect(() => {
    if (resendTimer > 0) {
      const id = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(id);
    }
  }, [resendTimer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();

    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (role === 'vendor' && (!phone || !document || !legalName)) {
      setError('Vendor accounts require phone, legal name and an identity or business document.');
      return;
    }

    setLoading(true);
    const r = await signUp(cleanEmail, password, cleanName, role, phone, countryCode, turnstileToken ?? undefined);
    if (r.error) {
      setLoading(false);
      setError(r.error);
    } else if (r.needsOtp) {
      setLoading(false);
      setOtpMode(true);
    } else {
      if (role === 'vendor' && document) {
        const k = await submitVendorKyc({ legalName, phone, countryCode, document, documentType });
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

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const r = await verifySignupOtp(cleanEmail, otp);
    if (r.error) {
      setLoading(false);
      setError(r.error);
      return;
    }

    // Get verified user object directly from result or session/context
    const currentUser = r.user || (await supabase.auth.getUser()).data.user;
    if (!currentUser) {
      if (role === 'customer') {
        setLoading(false);
        navigate('/');
        return;
      }
      setLoading(false);
      setError('Session could not be resolved automatically. Please sign in to complete registration.');
      return;
    }

    if (role === 'vendor') {
      if (!document) {
        setLoading(false);
        setError('Document is required');
        return;
      }
      try {
        // Create shop record with unique slug
        const slug = `${slugify(legalName)}-${Date.now().toString(36)}`;
        const { error: shopError } = await supabase.from('shops').insert({
          owner_id: currentUser.id,
          name: legalName,
          slug,
          description: '',
          status: 'pending',
        });
        if (shopError) throw shopError;

        // Upgrade profile role to vendor
        const { error: roleError } = await supabase.from('profiles').update({ role: 'vendor' }).eq('id', currentUser.id);
        if (roleError) throw roleError;

        // Submit KYC document
        const kycRes = await submitVendorKyc({ legalName, phone, countryCode, document, documentType });
        if (kycRes.error) throw new Error(kycRes.error);

        setLoading(false);
        navigate('/vendor');
      } catch (err) {
        setLoading(false);
        setError(err instanceof Error ? err.message : 'Vendor registration failed');
        return;
      }
    } else {
      setLoading(false);
      navigate('/');
    }
  };

  if (otpMode) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{t('auth.verifyEmail')}</h1>
          <p className="text-sm text-slate-500 mb-6">
            {t('auth.verifyCode', { email })} {role === 'vendor' && t('auth.kycNotice')}
          </p>
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
              {t('auth.verify')}
            </button>
            {/* Resend OTP button with countdown */}
            <div className="mt-2 text-center">
              {resendTimer > 0 ? (
                <span className="text-sm text-gray-600">
                  {t('auth.resendIn', { seconds: resendTimer })}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={loading}
                  className="text-sm text-sky-600 hover:underline"
                  onClick={async () => {
                    setLoading(true);
                    const res = await resendSignupOtp(email);
                    setLoading(false);
                    if (res.error) {
                      setError(res.error);
                    } else {
                      setResendTimer(60);
                    }
                  }}
                >
                  {t('auth.resend')}
                </button>
              )}
            </div>
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
            <h1 className="text-2xl font-bold text-slate-900">{t('auth.createAccount')}</h1>
            <p className="text-sm text-slate-500 mt-1">{t('auth.onboarding')}</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-600">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => setRole('customer')}
              className={classNames(
                'p-4 rounded-xl border-2 text-center transition-all',
                role === 'customer' ? 'border-sky-500 bg-sky-50' : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <ShoppingBag className="mx-auto mb-2 text-sky-500" size={24} />
              <p className="text-sm font-medium text-slate-900">{t('auth.customer')}</p>
            </button>
            <button
              type="button"
              onClick={() => setRole('vendor')}
              className={classNames(
                'p-4 rounded-xl border-2 text-center transition-all',
                role === 'vendor' ? 'border-sky-500 bg-sky-50' : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <Truck className="mx-auto mb-2 text-sky-500" size={24} />
              <p className="text-sm font-medium text-slate-900">{t('auth.vendor')}</p>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-gray-300 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-slate-900"
              placeholder={t('auth.fullName')}
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-gray-300 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-slate-900"
              placeholder={t('auth.emailPlaceholder')}
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-gray-300 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-slate-900"
              placeholder={t('auth.passwordHint')}
            />
            {role === 'vendor' && (
              <>
                <input
                  required
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-gray-300 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-slate-900"
                  placeholder={t('auth.legalName')}
                />
                <input
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-gray-300 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-slate-900"
                  placeholder={t('auth.phone')}
                />
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg border border-gray-300 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-slate-900 bg-white"
                  >
                    {countryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(`country.${opt.value.toLowerCase()}`)}
                      </option>
                    ))}
                  </select>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-gray-300 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-slate-900 bg-white"
                >
                  <option value="identity">{t('auth.identityDocument')}</option>
                  <option value="business_registration">{t('auth.businessRegistration')}</option>
                </select>
                <label className="flex items-center gap-3 p-3 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-sky-500 transition-colors">
                  <FileUp className="text-sky-500" size={20} />
                  <span className="text-sm text-slate-600 truncate">{document?.name || t('auth.uploadDocument')}</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    required
                    onChange={(e) => setDocument(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
              </>
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
              className="w-full h-11 bg-sky-500 text-white font-medium rounded-lg disabled:opacity-50 hover:bg-sky-600 transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {t('auth.createAccount')}
            </button>
          </form>
          <p className="text-center text-sm text-slate-500 mt-6">
            {t('auth.alreadyAccount')}{' '}
            <Link to="/signin" className="text-sky-600 font-medium hover:text-sky-700">
              {t('auth.signin')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
