import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function getSupabaseCredentials(): { url: string; key: string; isConfigured: boolean } {
  const envUrl = import.meta.env?.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

  const localUrl = typeof window !== 'undefined' ? localStorage.getItem('dulang_supabase_url') || '' : '';
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('dulang_supabase_key') || '' : '';

  const defaultUrl = 'https://bfuqvjsvsnydyxqzwmbd.supabase.co';
  const defaultKey = 'sb_publishable_J46OsoGiMKfXFv9POphm-A_OY877-V3';

  const url = (localUrl || envUrl || defaultUrl).trim();
  const key = (localKey || envKey || defaultKey).trim();

  const isConfigured = Boolean(
    url &&
    key &&
    !url.includes('your-project') &&
    !key.includes('your-anon-key') &&
    url.startsWith('https://')
  );

  return { url, key, isConfigured };
}

let cachedClient: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key, isConfigured } = getSupabaseCredentials();
  if (!isConfigured) return null;

  if (cachedClient && lastUrl === url && lastKey === key) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key);
    lastUrl = url;
    lastKey = key;
    return cachedClient;
  } catch (err) {
    console.error('Failed to create Supabase client:', err);
    return null;
  }
}

export function saveSupabaseCredentials(url: string, key: string): boolean {
  try {
    const cleanUrl = url.trim();
    const cleanKey = key.trim();
    if (!cleanUrl || !cleanKey) return false;

    localStorage.setItem('dulang_supabase_url', cleanUrl);
    localStorage.setItem('dulang_supabase_key', cleanKey);
    cachedClient = null;
    return true;
  } catch (e) {
    console.error('Failed to save Supabase credentials:', e);
    return false;
  }
}

export function clearSupabaseCredentials(): void {
  try {
    localStorage.removeItem('dulang_supabase_url');
    localStorage.removeItem('dulang_supabase_key');
    cachedClient = null;
  } catch (e) {
    console.error('Failed to clear Supabase credentials:', e);
  }
}

export const isSupabaseConfigured = getSupabaseCredentials().isConfigured;
export const supabase = getSupabaseClient();
