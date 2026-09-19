import { useI18n } from '@/contexts/I18nContext';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Store, Mail, Lock, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function SignIn() {
  const { t } = useI18n();
  const { signIn, verifyLoginOtp, finishPasswordSignIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false); const [otpMode, setOtpMode] = useState(false);
  const [pendingPassword, setPendingPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true);
    const r = await signIn(email, password); setLoading(false);
    if (r.error) setError(r.error); else if (r.needsOtp) { setPendingPassword(password); setOtpMode(true); }
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true);
    const r = await verifyLoginOtp(email, otp);
    if (r.error) { setLoading(false); setError(r.error); return; }
    const final = await finishPasswordSignIn(email, pendingPassword);
    setLoading(false);
    if (final.error) setError(final.error); else navigate('/');
  };

  if (otpMode) return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 flex items-center justify-center px-4"><div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8"><div className="flex flex-col items-center mb-8"><ShieldCheck className="text-sky-500 mb-3" size={42}/><h1 className="text-2xl font-bold text-gray-900">{t('auth.verifySignin')}</h1><p className="text-sm text-gray-500 mt-2 text-center">{t('auth.codeSent',{email})}</p></div>{error&&<div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-600">{error}</div>}<form onSubmit={verify} className="space-y-4"><input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} className="w-full h-14 text-center tracking-[0.6em] text-2xl rounded-lg border border-gray-300" placeholder="000000"/><button disabled={loading||otp.length!==6} className="w-full h-11 bg-sky-500 text-white font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">{loading&&<Loader2 size={18} className="animate-spin"/>}{t('auth.verifyAndSignIn')}</button></form></div></div>;

  return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 flex items-center justify-center px-4"><div className="w-full max-w-md"><div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8"><div className="flex flex-col items-center mb-8"><div className="w-14 h-14 bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl flex items-center justify-center mb-3"><Store className="text-white" size={28}/></div><h1 className="text-2xl font-bold text-gray-900">{t('auth.welcomeBack')}</h1><p className="text-sm text-gray-500 mt-1">{t('auth.secureSignin')}</p></div>{error&&<div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-600">{error}</div>}<form onSubmit={handleSubmit} className="space-y-4"><div><label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.email')}</label><div className="relative"><Mail className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full h-11 ps-10 pe-4 rounded-lg border border-gray-300 text-sm" placeholder={t('auth.emailPlaceholder')}/></div></div><div><label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.password')}</label><div className="relative"><Lock className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/><input type="password" required value={password} onChange={e=>setPassword(e.target.value)} className="w-full h-11 ps-10 pe-4 rounded-lg border border-gray-300 text-sm" placeholder="********"/></div></div><button type="submit" disabled={loading} className="w-full h-11 bg-sky-500 text-white font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">{loading&&<Loader2 size={18} className="animate-spin"/>}Sign In</button></form><p className="text-center text-sm text-gray-500 mt-6">{t('auth.noAccount')} <Link to="/signup" className="text-sky-600 font-medium">{t('auth.signup')}</Link></p></div></div></div>;
}
