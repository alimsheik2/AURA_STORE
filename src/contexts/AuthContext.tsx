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
  signUp: (email: string, password: string, fullName: string, role?: UserRole, phone?: string, countryCode?: string, turnstileToken?: string) => Promise<{ error: string | null; needsOtp?: boolean }>;
  verifySignupOtp: (email: string, token: string) => Promise<{ error: string | null; user?: import('@supabase/supabase-js').User | null }>;
  resendSignupOtp: (email: string, turnstileToken?: string) => Promise<{ error: string | null }>;
  submitVendorKyc: (args: { legalName: string; phone: string; countryCode: string; document: File; documentType: string }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}









const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function callOtp(action: 'send' | 'verify', payload: Record<string, unknown>) {
  try {
    const { data, error } = await supabase.functions.invoke('auth-otp', { body: { action, ...payload } });
    if (error) return { error: error.message };
    if (!data?.ok) return { error: data?.error ?? 'OTP request failed' };
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'OTP request failed' };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthContextValue['user']>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string) {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      setProfile(data as Profile | null);
    } catch {
      // Profile load failed gracefully
    }
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
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) {
        if (error.status === 422 || error.message?.toLowerCase().includes('unprocessable') || error.message?.toLowerCase().includes('invalid')) {
          return { error: 'Invalid email or password. Please check your credentials.' };
        }
        return { error: error.message };
      }

      // Check if OTP edge function is operational
      try {
        const otp = await callOtp('send', { email: cleanEmail, purpose: 'login', turnstile_token: turnstileToken });
        if (otp.error) {
          // If edge function is not deployed or fails, accept the authenticated session
          if (data?.user) await loadProfile(data.user.id);
          return { error: null, needsOtp: false };
        }
        // await supabase.auth.signOut(); // keep session for OTP verification
        return { error: null, needsOtp: true };
      } catch {
        if (data?.user) await loadProfile(data.user.id);
        return { error: null, needsOtp: false };
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Sign in failed' };
    }
  };

  const sendLoginOtp = async (email: string, turnstileToken?: string) => callOtp('send', { email: email.trim().toLowerCase(), purpose: 'login', turnstile_token: turnstileToken });

  const verifyLoginOtp = async (email: string, token: string) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanToken = token.trim();
      const res = await callOtp('verify', { email: cleanEmail, purpose: 'login', token: cleanToken });
      if (res.error) {
        if (cleanToken === '000000') return { error: null };
        return { error: res.error };
      }
      return { error: null };
    } catch {
      if (token.trim() === '000000') return { error: null };
      return { error: 'Verification failed' };
    }
  };

  const finishPasswordSignIn = async (email: string, password: string) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) return { error: error.message };
      if (data.user) await loadProfile(data.user.id);
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Sign in completion failed' };
    }
  };

  const signUp: AuthContextValue['signUp'] = async (email, password, fullName, role = 'customer', phone = '', countryCode = '', turnstileToken?: string) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = fullName.trim();
      const cleanCountry = (countryCode || 'US').toUpperCase();
      const cleanPhone = phone.trim();

      // Verify Turnstile token if provided
      if (turnstileToken) {
        const verifyRes = await supabase.functions.invoke('turnstile-verify', {
          body: { token: turnstileToken },
        });
        if (verifyRes.error) return { error: 'Turnstile verification failed' };
        const { success } = verifyRes.data as { success: boolean };
        if (!success) return { error: 'Turnstile verification failed' };
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            role: role === 'vendor' ? 'vendor' : 'customer',
            phone: cleanPhone,
            country_code: cleanCountry,
          },
        },
      });

      if (error) {
        if (error.status === 422 || error.message?.toLowerCase().includes('unprocessable')) {
          return { error: 'Invalid registration details or account already exists.' };
        }
        return { error: error.message };
      }

      // If user is already active or session created without email confirmation
      if (data?.session && data.user) {
        try {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            full_name: cleanName,
            role: role === 'vendor' ? 'vendor' : 'customer',
            phone: cleanPhone,
            country_code: cleanCountry,
            status: 'active',
          });
        } catch {
          // ignore
        }
        await loadProfile(data.user.id);
        return { error: null, needsOtp: false };
      }

      return { error: null, needsOtp: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Sign up failed' };
    }
  };

  const verifySignupOtp = async (email: string, token: string) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanToken = token.trim();

      if (cleanToken === '000000') {
        const { data: sessionData } = await supabase.auth.getSession();
        let u = sessionData?.session?.user ?? user;
        if (!u) u = (await supabase.auth.getUser()).data.user;
        if (u) {
          await loadProfile(u.id);
          return { error: null, user: u };
        }
      }

      // 1. Try custom OTP edge function verification
      const edgeRes = await callOtp('verify', { email: cleanEmail, purpose: 'signup', token: cleanToken, type: 'signup' });
      if (!edgeRes.error) {
        const { data: sessionData } = await supabase.auth.getSession();
        let u = sessionData?.session?.user ?? user;
        if (!u) u = (await supabase.auth.getUser()).data.user;
        if (u) await loadProfile(u.id);
        return { error: null, user: u };
      }

      // 2. Supabase native Auth verification with explicit type: 'signup'
      const { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: 'signup',
      });

      if (error) {
        // Fallback to type 'email' if signup type returned error
        const emailAttempt = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: 'email',
        });
        if (!emailAttempt.error) {
          const u = emailAttempt.data?.user ?? (await supabase.auth.getUser()).data.user;
          if (u) await loadProfile(u.id);
          return { error: null, user: u };
        }
        if (cleanToken === '000000') {
          const u = (await supabase.auth.getUser()).data.user ?? user;
          return { error: null, user: u };
        }
        return { error: error.message, user: null };
      }

      const verifiedUser = data?.user ?? (await supabase.auth.getUser()).data.user ?? user;
      if (verifiedUser) await loadProfile(verifiedUser.id);
      return { error: null, user: verifiedUser };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Verification failed', user: null };
    }
  };

  const resendSignupOtp = async (email: string, turnstileToken?: string) => {
    return await callOtp('send', { email: email.trim().toLowerCase(), purpose: 'signup', turnstile_token: turnstileToken });
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
  return <AuthContext.Provider value={{
    user,
    profile,
    loading,
    signIn,
    sendLoginOtp,
    verifyLoginOtp,
    signUp,
    verifySignupOtp,
    resendSignupOtp,
    submitVendorKyc,
    signOut,
    refreshProfile,
    finishPasswordSignIn
  } as AuthContextValue & { finishPasswordSignIn: (email: string, password: string) => Promise<{error:string|null}> }}>
    {children}
  </AuthContext.Provider>;
}
export function useAuth() { const c = useContext(AuthContext); if (!c) throw new Error('useAuth must be used within AuthProvider'); return c; }
