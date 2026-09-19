import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/lib/types';

interface AuthContextValue {
  user: import('@supabase/supabase-js').User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string, turnstileToken?: string) => Promise<{ error: string | null; needsOtp?: boolean }>;
  sendLoginOtp: (email: string, turnstileToken?: string) => Promise<{ error: string | null }>;
  verifyLoginOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  finishPasswordSignIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, role?: UserRole, phone?: string, countryCode?: string) => Promise<{ error: string | null; needsOtp?: boolean }>;
  verifySignupOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  submitVendorKyc: (input: { legalName: string; phone: string; countryCode: string; document: File; documentType: string }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function callOtp(action: 'send' | 'verify', payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('auth-otp', { body: { action, ...payload } });
  if (error) return { error: error.message };
  if (!data?.ok) return { error: data?.error ?? 'OTP request failed' };
  return { error: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthContextValue['user']>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    setProfile(data as Profile | null);
  }

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id).finally(() => mounted && setLoading(false));
      else setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) void loadProfile(session.user.id); else setProfile(null);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  const signIn: AuthContextValue['signIn'] = async (email, password, turnstileToken) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    const otp = await callOtp('send', { email, purpose: 'login', turnstile_token: turnstileToken });
    await supabase.auth.signOut();
    return otp.error ? { error: otp.error } : { error: null, needsOtp: true };
  };

  const sendLoginOtp = async (email: string, turnstileToken?: string) => callOtp('send', { email, purpose: 'login', turnstile_token: turnstileToken });

  const verifyLoginOtp = async (email: string, token: string) => callOtp('verify', { email, purpose: 'login', token });

  const finishPasswordSignIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.user) await loadProfile(data.user.id);
    return { error: null };
  };

  const signUp: AuthContextValue['signUp'] = async (email, password, fullName, role = 'customer', phone = '', countryCode = '') => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: role === 'vendor' ? 'vendor' : 'customer', phone, country_code: countryCode } },
    });
    if (error) return { error: error.message };
    return { error: null, needsOtp: true };
  };

  const verifySignupOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
    return { error: error?.message ?? null };
  };

  const submitVendorKyc: AuthContextValue['submitVendorKyc'] = async ({ legalName, phone, countryCode, document, documentType }) => {
    const currentUser = user ?? (await supabase.auth.getUser()).data.user;
    if (!currentUser) return { error: 'Authentication required' };
    if (!document || document.size > 8 * 1024 * 1024) return { error: 'Document is required and must be 8MB or smaller' };
    const ext = document.name.split('.').pop()?.toLowerCase() || 'bin';
    const path = `${currentUser.id}/${crypto.randomUUID()}.${ext}`;
    const upload = await supabase.storage.from('vendor-kyc').upload(path, document, { upsert: false, contentType: document.type });
    if (upload.error) return { error: upload.error.message };
    const { error } = await supabase.from('vendor_kyc').upsert({ user_id: currentUser.id, legal_name: legalName, phone, country_code: countryCode.toUpperCase(), document_path: path, document_type: documentType, status: 'pending' });
    return { error: error?.message ?? null };
  };

  const signOut = async () => { await supabase.auth.signOut(); setUser(null); setProfile(null); };
  const refreshProfile = async () => { if (user) await loadProfile(user.id); };
  return <AuthContext.Provider value={{ user, profile, loading, signIn, sendLoginOtp, verifyLoginOtp, signUp, verifySignupOtp, submitVendorKyc, signOut, refreshProfile, finishPasswordSignIn } as AuthContextValue & { finishPasswordSignIn: (email: string, password: string) => Promise<{error:string|null}> }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const c = useContext(AuthContext); if (!c) throw new Error('useAuth must be used within AuthProvider'); return c; }
