import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;
let initialized = false;

function stripWrappingQuotes(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function normalizeSupabaseUrl(raw: string): string {
  const trimmed = stripWrappingQuotes(raw);
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return '';
    }
    if (
      parsed.hostname === 'supabase.com' &&
      parsed.pathname.startsWith('/dashboard/project/')
    ) {
      const ref = parsed.pathname.split('/')[3];
      if (ref) return `https://${ref}.supabase.co`;
    }
    return parsed.origin;
  } catch {
    return '';
  }
}

let runtimeUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL || '');
let runtimeAnonKey = stripWrappingQuotes(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    ''
);

export function getMissingSupabaseConfig(): string[] {
  const missing: string[] = [];
  if (!runtimeUrl) {
    missing.push('VITE_SUPABASE_URL');
  }
  if (!runtimeAnonKey) {
    missing.push('VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_ANON_KEY');
  }
  return missing;
}

export async function initSupabaseClient(): Promise<SupabaseClient | null> {
  if (supabaseInstance) return supabaseInstance;

  if (!initialized && (!runtimeUrl || !runtimeAnonKey)) {
    try {
      const res = await fetch('/api/auth-config');
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const cfg = (await res.json()) as {
            supabaseUrl?: string;
            supabaseAnonKey?: string;
          };
          if (!runtimeUrl && cfg.supabaseUrl) {
            runtimeUrl = normalizeSupabaseUrl(cfg.supabaseUrl);
          }
          if (!runtimeAnonKey && cfg.supabaseAnonKey) {
            runtimeAnonKey = stripWrappingQuotes(cfg.supabaseAnonKey);
          }
        }
      }
    } catch {
      // Ignore network error during config probe
    }
  }

  if (getMissingSupabaseConfig().length > 0) {
    return null;
  }

  initialized = true;

  supabaseInstance = createClient(runtimeUrl, runtimeAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return supabaseInstance;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;
  if (getMissingSupabaseConfig().length > 0) return null;
  supabaseInstance = createClient(runtimeUrl, runtimeAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return supabaseInstance;
}
