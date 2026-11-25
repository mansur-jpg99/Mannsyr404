import {
  clearLocalAuthSession,
  getValidSession,
  initSupabaseClient,
} from './supabase.ts';

export class SessionExpiredError extends Error {
  constructor(
    message = 'Sesi login Anda telah berakhir atau tidak valid. Silakan masuk kembali.'
  ) {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

type AuthInvalidatedListener = (reason: string) => void;
let onAuthInvalidatedListener: AuthInvalidatedListener | null = null;

export function setOnAuthInvalidated(
  listener: AuthInvalidatedListener | null
): void {
  onAuthInvalidatedListener = listener;
}

function notifyAuthInvalidated(reason: string): void {
  if (onAuthInvalidatedListener) {
    onAuthInvalidatedListener(reason);
  }
}

async function resolveBearerToken(forceRefresh = false): Promise<string> {
  const supabase = await initSupabaseClient();
  if (!supabase) {
    throw new Error('Konfigurasi Supabase belum lengkap.');
  }

  const result = await getValidSession(forceRefresh);

  if (result.session?.access_token) {
    return result.session.access_token;
  }

  if (result.networkError) {
    throw new Error(
      'Tidak dapat memperbarui sesi karena gangguan jaringan. Periksa koneksi internet Anda lalu klik Coba Lagi.'
    );
  }

  const message =
    'Sesi login Anda telah berakhir atau tidak valid. Silakan masuk kembali.';
  await clearLocalAuthSession();
  notifyAuthInvalidated(message);
  throw new SessionExpiredError(message);
}

async function parseJsonSafe(res: Response): Promise<any> {
  const contentType = res.headers.get('content-type') || '';
  const rawText = await res.text();
  if (!rawText) return null;

  if (
    contentType.includes('application/json') ||
    rawText.trim().startsWith('{') ||
    rawText.trim().startsWith('[')
  ) {
    try {
      return JSON.parse(rawText);
    } catch {
      return null;
    }
  }
  return null;
}

async function performAuthorizedFetch(
  path: string,
  token: string,
  options?: RequestInit
): Promise<Response> {
  try {
    return await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error(
      'Tidak dapat terhubung ke server API. Periksa koneksi internet Anda.'
    );
  }
}

export async function apiRequest<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  let token = await resolveBearerToken(false);
  let res = await performAuthorizedFetch(path, token, options);

  // Jika server menolak dengan 401 (mis. token baru saja kedaluwarsa/dicabut), coba refresh token 1x lalu ulangi permintaan
  if (res.status === 401) {
    const refreshed = await getValidSession(true);
    if (
      refreshed.session?.access_token &&
      refreshed.session.access_token !== token
    ) {
      token = refreshed.session.access_token;
      res = await performAuthorizedFetch(path, token, options);
    } else if (refreshed.networkError) {
      throw new Error(
        'Tidak dapat memverifikasi ulang sesi karena gangguan jaringan. Klik Coba Lagi.'
      );
    }
  }

  const parsedJson = await parseJsonSafe(res);

  if (res.status === 401) {
    const message =
      'Sesi login Anda telah berakhir atau tidak valid. Silakan masuk kembali.';
    await clearLocalAuthSession();
    notifyAuthInvalidated(message);
    throw new SessionExpiredError(message);
  }

  if (!res.ok) {
    if (parsedJson?.error) {
      throw new Error(String(parsedJson.error));
    }
    if (parsedJson?.message) {
      throw new Error(String(parsedJson.message));
    }
    if (res.status === 404) {
      throw new Error(
        `Endpoint API (${path}) tidak ditemukan (HTTP 404). Pastikan backend server aktif.`
      );
    }
    if (res.status >= 500) {
      throw new Error(
        `Server backend mengalami gangguan (HTTP ${res.status}). Periksa konfigurasi database & environment server.`
      );
    }
    throw new Error(`Permintaan gagal dengan status HTTP ${res.status}.`);
  }

  if (parsedJson === null) {
    throw new Error(
      'Respons API tidak valid (bukan JSON). Pastikan routing /api tidak mengarah ke halaman HTML.'
    );
  }

  return parsedJson as T;
}
