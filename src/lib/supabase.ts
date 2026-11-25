import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;
let refreshPromise: Promise<SessionRefreshResult> | null = null;

export interface SessionRefreshResult {
  session: Session | null;
  invalidSession: boolean;
  networkError: boolean;
  errorMessage?: string;
}

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

let runtimeUrl = normalizeSupabaseUrl(
  (import.meta.env ? import.meta.env.VITE_SUPABASE_URL : '') || ''
);
let runtimeAnonKey = stripWrappingQuotes(
  (import.meta.env
    ? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.VITE_SUPABASE_ANON_KEY
    : '') || ''
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

function isNetworkAuthError(error: any): boolean {
  if (!error) return false;
  const name = String(error.name || '');
  const msg = String(error.message || '').toLowerCase();
  const status = typeof error.status === 'number' ? error.status : 0;

  if (name === 'AuthRetryableFetchError') return true;
  if (status >= 500) return true;
  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('network request failed') ||
    msg.includes('timeout')
  ) {
    return true;
  }
  return false;
}

function isInvalidRefreshError(error: any): boolean {
  if (!error || isNetworkAuthError(error)) return false;
  const msg = String(error.message || '').toLowerCase();
  const code = String(error.code || '').toLowerCase();
  const status = typeof error.status === 'number' ? error.status : 0;

  return (
    code.includes('refresh_token') ||
    code.includes('invalid_grant') ||
    code.includes('session_not_found') ||
    msg.includes('refresh token') ||
    msg.includes('invalid_grant') ||
    msg.includes('invalid jwt') ||
    msg.includes('jwt expired') ||
    msg.includes('session from session_id claim') ||
    status === 400 ||
    status === 401 ||
    status === 403
  );
}

export function isSessionExpired(session: Session | null | undefined): boolean {
  if (!session?.access_token) return true;
  if (!session.expires_at) return false;
  return session.expires_at * 1000 <= Date.now();
}

export function isSessionExpiringSoon(
  session: Session | null | undefined,
  bufferSeconds = 60
): boolean {
  if (!session?.access_token) return true;
  if (!session.expires_at) return false;
  return session.expires_at * 1000 <= Date.now() + bufferSeconds * 1000;
}

export async function initSupabaseClient(): Promise<SupabaseClient | null> {
  if (supabaseInstance) return supabaseInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const res = await fetch('/api/auth-config', { cache: 'no-store' });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const cfg = (await res.json()) as {
            supabaseUrl?: string;
            supabaseAnonKey?: string;
          };
          const serverUrl = cfg.supabaseUrl
            ? normalizeSupabaseUrl(cfg.supabaseUrl)
            : '';
          const serverKey = cfg.supabaseAnonKey
            ? stripWrappingQuotes(cfg.supabaseAnonKey)
            : '';

          // Selaraskan dengan konfigurasi runtime backend agar token selalu diverifikasi pada project Supabase yang sama
          if (serverUrl) {
            runtimeUrl = serverUrl;
          }
          if (serverKey) {
            runtimeAnonKey = serverKey;
          }
        }
      }
    } catch {
      // Gunakan fallback import.meta.env jika endpoint config tidak dapat dijangkau
    }

    if (getMissingSupabaseConfig().length > 0) {
      initPromise = null;
      return null;
    }

    if (!supabaseInstance) {
      supabaseInstance = createClient(runtimeUrl, runtimeAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    }

    return supabaseInstance;
  })();

  return initPromise;
}

export function getSupabaseClient(): SupabaseClient | null {
  return supabaseInstance;
}

export async function clearLocalAuthSession(): Promise<void> {
  const supabase = supabaseInstance ?? (await initSupabaseClient());
  if (!supabase) return;
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Abaikan error pembersihan sesi lokal
  }
}

export async function refreshSessionLocked(
  supabase: SupabaseClient
): Promise<SessionRefreshResult> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async (): Promise<SessionRefreshResult> => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session?.access_token) {
        if (isNetworkAuthError(error)) {
          return {
            session: null,
            invalidSession: false,
            networkError: true,
            errorMessage: error?.message || 'Gangguan jaringan saat memperbarui sesi.',
          };
        }

        const invalid =
          isInvalidRefreshError(error) || !data.session?.access_token;
        if (invalid) {
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch {
            // Abaikan error saat membersihkan sesi lokal
          }
        }

        return {
          session: null,
          invalidSession: invalid,
          networkError: false,
          errorMessage: error?.message || 'Sesi autentikasi telah berakhir.',
        };
      }

      return {
        session: data.session,
        invalidSession: false,
        networkError: false,
      };
    } catch (err: any) {
      if (isNetworkAuthError(err)) {
        return {
          session: null,
          invalidSession: false,
          networkError: true,
          errorMessage: err?.message || 'Gangguan jaringan saat memperbarui sesi.',
        };
      }
      return {
        session: null,
        invalidSession: true,
        networkError: false,
        errorMessage: err?.message || 'Gagal memperbarui sesi autentikasi.',
      };
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function getValidSession(
  forceRefresh = false
): Promise<SessionRefreshResult> {
  const supabase = await initSupabaseClient();
  if (!supabase) {
    return {
      session: null,
      invalidSession: false,
      networkError: false,
      errorMessage: 'Konfigurasi Supabase belum lengkap.',
    };
  }

  let currentSession: Session | null = null;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      return await refreshSessionLocked(supabase);
    }
    currentSession = data.session ?? null;
  } catch (err: any) {
    if (isNetworkAuthError(err)) {
      return {
        session: null,
        invalidSession: false,
        networkError: true,
        errorMessage: err?.message || 'Gagal membaca sesi autentikasi.',
      };
    }
    return await refreshSessionLocked(supabase);
  }

  if (!currentSession) {
    return {
      session: null,
      invalidSession: false,
      networkError: false,
    };
  }

  if (!forceRefresh && !isSessionExpiringSoon(currentSession, 60)) {
    return {
      session: currentSession,
      invalidSession: false,
      networkError: false,
    };
  }

  // Token mendekati kedaluwarsa, sudah kedaluwarsa, atau refresh paksa diminta
  const refreshed = await refreshSessionLocked(supabase);
  if (refreshed.session) {
    return refreshed;
  }

  // Jika gagal refresh karena gangguan jaringan sementara dan token saat ini belum benar-benar habis masa berlakunya,
  // tetap gunakan token yang masih valid; jangan pernah gunakan token yang sudah kedaluwarsa.
  if (refreshed.networkError && !isSessionExpired(currentSession)) {
    return {
      session: currentSession,
      invalidSession: false,
      networkError: false,
    };
  }

  return refreshed;
}
