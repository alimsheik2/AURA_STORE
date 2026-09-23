/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { mockSupabase } from './mockSupabase';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || '').trim() as string;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY || '').trim() as string;

const isConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseUrl.includes('your-supabase-project')
);

// Explicit opt-in for dev mock: only permitted in Vite development mode when explicitly enabled
const allowDevMock = Boolean(
  import.meta.env.DEV &&
  import.meta.env.VITE_USE_MOCK_SUPABASE === 'true'
);

let clientInstance: SupabaseClient<any, "public", any>;

if (isConfigured) {
  clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });
} else if (allowDevMock) {
  console.warn('[AURA STORE] Running in Development Mode with explicit in-memory Mock Supabase.');
  clientInstance = mockSupabase as unknown as SupabaseClient<any, "public", any>;
} else {
  // Production / normal mode without valid configuration must show clear error, NOT silently use mock auth
  console.error(
    '[AURA STORE] CRITICAL CONFIGURATION ERROR: Missing or invalid VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY.\n' +
    'Please set valid Supabase credentials in your environment variables (.env).'
  );
  // Create client with provided or placeholder url to avoid runtime undefined errors, ensuring standard Supabase error responses
  const fallbackUrl = supabaseUrl.startsWith('http') ? supabaseUrl : 'https://unconfigured-project.supabase.co';
  const fallbackKey = supabaseAnonKey || 'unconfigured-anon-key';
  clientInstance = createClient(fallbackUrl, fallbackKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export const supabase = clientInstance;
export const isSupabaseConfigured = isConfigured;
