import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://blwnhfhpckqbetwxamqr.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_g3pzBUEsZtPQ1sGJjrDxHw_ldR3dO49';

const url = import.meta.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;
