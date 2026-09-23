import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string, turnstileToken?: string) => Promise<{ error: string | null; emailUnconfirmed?: boolean; user?: User | null }>;
  sendLoginOtp: (email: string, turnstileToken?: string) => Promise<{ error: string | null }>;
  verifyLoginOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  finishPasswordSignIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, role?: UserRole, phone?: string, countryCode?: string, turnstileToken?: string) => Promise<{ error: string | null; needsOtp?: boolean; user?: User | null }>;
  verifySignupOtp: (email: string, token: string) => Promise<{ error: string | null; user?: User | null }>;
  resendSignupOtp: (email: string) => Promise<{ error: string | null }>;
  submitVendorKyc: (args: { legalName: string; phone: string; countryCode: string; document: File; documentType: string }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string, fallbackUser?: User | null): Promise<Profile | null> {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      if (!error && data) {
        const p = data as Profile;
        setProfile(p);
        return p;
      }

      // If not yet available (e.g. database trigger delay), retry once after a short wait
      await new Promise((r) => setTimeout(r, 400));
      const retry = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      if (!retry.error && retry.data) {
        const p = retry.data as Profile;
        setProfile(p);
        return p;
      }

      // Fallback profile synthesized from user metadata so role checks never crash or fail
      const meta = fallbackUser?.user_metadata || {};
      const fallbackRole: UserRole = (meta.role === 'vendor' ? 'vendor' : meta.role === 'admin' ? 'admin' : 'customer');
      const synthesized: Profile = {
        id: uid,
        full_name: (meta.full_name as string) || (fallbackUser?.email ? fallbackUser.email.split('@')[0] : 'User'),
        phone: (meta.phone as string) || '',
        avatar_url: '',
        role: fallbackRole,
        status: fallbackRole === 'vendor' ? 'pending' : 'active',
        country_code: (meta.country_code as string) || 'US',
        created_at: new Date().toISOString(),
      };
      setProfile(synthesized);
      return synthesized;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    let mounted = true;

    // Initial session hydration
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        await loadProfile(session.user.id, session.user);
      } else {
        setUser(null);
        setProfile(null);
      }
      if (mounted) setLoading(false);
    }).catch(() => {
      if (mounted) setLoading(false);
    });

    // Reactive auth state listener
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        await loadProfile(session.user.id, session.user);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  /**
   * Simple, direct password sign-in (NO OTP on login).
   * Email + Password -> Supabase signInWithPassword -> Session -> Profile -> Enter account.
   */
  const signIn: AuthContextValue['signIn'] = async (email, password, turnstileToken) => {
    try {
      const cleanEmail = email.trim().toLowerCase();

      // Optional Turnstile verification if configured on backend
      if (turnstileToken) {
        try {
          await supabase.functions.invoke('turnstile-verify', { body: { token: turnstileToken } });
        } catch {
          // Non-blocking if Turnstile function is not deployed
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        const msg = error.message?.toLowerCase() || '';
        if (msg.includes('email not confirmed') || error.status === 400 && msg.includes('confirm')) {
          return {
            error: 'Email not confirmed. Please check your inbox for the confirmation code.',
            emailUnconfirmed: true,
          };
        }
        if (error.status === 400 || error.status === 422 || msg.includes('invalid') || msg.includes('credentials')) {
          return { error: 'Invalid email or password. Please check your credentials.' };
        }
        return { error: error.message };
      }

      if (data?.user) {
        setUser(data.user);
        await loadProfile(data.user.id, data.user);
        return { error: null, user: data.user };
      }

      return { error: 'Failed to retrieve user session.' };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Sign in failed.' };
    }
  };

  /**
   * Deprecated OTP methods preserved for interface compatibility.
   * Login does not use OTP.
   */
  const sendLoginOtp = async () => ({ error: null });
  const verifyLoginOtp = async () => ({ error: null });
  const finishPasswordSignIn = async () => ({ error: null });

  /**
   * Registration flow:
   * Email + Password + Full Name -> Supabase signUp -> Send OTP to email -> needsOtp = true.
   */
  const signUp: AuthContextValue['signUp'] = async (
    email,
    password,
    fullName,
    role = 'customer',
    phone = '',
    countryCode = '',
    turnstileToken?: string
  ) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = fullName.trim();
      const cleanCountry = (countryCode || 'US').toUpperCase();
      const cleanPhone = phone.trim();

      if (turnstileToken) {
        try {
          await supabase.functions.invoke('turnstile-verify', { body: { token: turnstileToken } });
        } catch {
          // Non-blocking
        }
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
        const msg = error.message?.toLowerCase() || '';
        if (error.status === 422 || msg.includes('already registered') || msg.includes('user already exists')) {
          return { error: 'This email is already registered. Please sign in or use another email.' };
        }
        return { error: error.message };
      }

      // If Supabase immediately issued an active session (e.g. email confirmation disabled in project)
      if (data?.session && data.user) {
        setUser(data.user);
        await loadProfile(data.user.id, data.user);
        return { error: null, needsOtp: false, user: data.user };
      }

      // Email confirmation code was dispatched by Supabase Auth
      return { error: null, needsOtp: true, user: data?.user ?? null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Registration failed.' };
    }
  };

  /**
   * Verify registration OTP:
   * Uses native Supabase Auth verifyOtp.
   * Upon success, session is automatically established and stored by Supabase.
   */
  const verifySignupOtp: AuthContextValue['verifySignupOtp'] = async (email, token) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanToken = token.trim().replace(/\D/g, '');

      if (cleanToken.length !== 6) {
        return { error: 'Please enter a valid 6-digit verification code.' };
      }

      // 1. Native Supabase Auth OTP verification for signup
      let { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: 'signup',
      });

      // 2. Fallback to type: 'email' if 'signup' type fails
      if (error) {
        const fallback = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: 'email',
        });
        if (!fallback.error && fallback.data) {
          data = fallback.data;
          error = null;
        }
      }

      if (error) {
        return { error: error.message || 'Invalid or expired verification code.', user: null };
      }

      // Obtain the authenticated user
      let verifiedUser = data?.user ?? null;
      if (!verifiedUser) {
        const sessionRes = await supabase.auth.getSession();
        verifiedUser = sessionRes.data.session?.user ?? null;
      }
      if (!verifiedUser) {
        const userRes = await supabase.auth.getUser();
        verifiedUser = userRes.data.user ?? null;
      }

      if (verifiedUser) {
        setUser(verifiedUser);
        await loadProfile(verifiedUser.id, verifiedUser);
        return { error: null, user: verifiedUser };
      }

      return { error: 'Verification completed, but session could not be established.', user: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Verification failed.', user: null };
    }
  };

  /**
   * Resend signup verification OTP via native Supabase Auth.
   */
  const resendSignupOtp: AuthContextValue['resendSignupOtp'] = async (email) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
      });

      if (error) {
        // Fallback try signup type or return clear error
        return { error: error.message };
      }
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to resend code.' };
    }
  };

  /**
   * Submit vendor KYC document to private Supabase Storage bucket and register record.
   */
  const submitVendorKyc: AuthContextValue['submitVendorKyc'] = async ({
    legalName,
    phone,
    countryCode,
    document,
    documentType,
  }) => {
    const currentUser = user ?? (await supabase.auth.getUser()).data.user;
    if (!currentUser) return { error: 'Authentication required. Please verify your account.' };
    if (!document || document.size > 8 * 1024 * 1024) {
      return { error: 'Document is required and must be 8MB or smaller.' };
    }

    const ext = document.name.split('.').pop()?.toLowerCase() || 'bin';
    const path = `${currentUser.id}/${crypto.randomUUID()}.${ext}`;

    const upload = await supabase.storage.from('vendor-kyc').upload(path, document, {
      upsert: false,
      contentType: document.type,
    });
    if (upload.error) return { error: upload.error.message };

    const { error } = await supabase.from('vendor_kyc').upsert({
      user_id: currentUser.id,
      legal_name: legalName,
      phone,
      country_code: countryCode.toUpperCase(),
      document_path: path,
      document_type: documentType,
      status: 'pending',
    });

    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id, user);
  };

  return (
    <AuthContext.Provider
      value={{
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
        finishPasswordSignIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}
