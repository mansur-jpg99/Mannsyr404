import { initSupabaseClient } from './supabase.ts';

async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = await initSupabaseClient();
  if (!supabase) {
    throw new Error('Konfigurasi Supabase belum lengkap.');
  }
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error('Pengguna belum masuk.');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function apiRequest<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const headers = await getAuthHeaders();
  let res: Response;
  try {
    res = await fetch(path, {
      ...options,
      headers: {
        ...headers,
        ...(options?.headers || {}),
      },
    });
  } catch {
    throw new Error('Tidak dapat terhubung ke server API. Periksa koneksi internet Anda.');
  }

  const contentType = res.headers.get('content-type') || '';
  const rawText = await res.text();
  let parsedJson: any = null;

  if (rawText && contentType.includes('application/json')) {
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      parsedJson = null;
    }
  } else if (rawText && (rawText.trim().startsWith('{') || rawText.trim().startsWith('['))) {
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      parsedJson = null;
    }
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
