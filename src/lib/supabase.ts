/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { mockSupabase } from './mockSupabase';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || '') as string;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY || '') as string;

const isConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('placeholder')
);

let clientInstance: SupabaseClient<any, "public", any>;

if (isConfigured) {
  try {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  } catch (err) {
    console.warn('[AI Studio] Failed to initialize Supabase client, falling back to in-memory mock:', err);
    clientInstance = mockSupabase as unknown as SupabaseClient<any, "public", any>;
  }
} else {
  clientInstance = mockSupabase as unknown as SupabaseClient<any, "public", any>;
}

export const supabase = clientInstance;

