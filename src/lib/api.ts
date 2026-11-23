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
  const res = await fetch(path, {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    let message = 'Terjadi kesalahan pada server.';
    try {
      const errJson = await res.json();
      if (errJson?.error) message = errJson.error;
    } catch {
      // ignore json parse error
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}
