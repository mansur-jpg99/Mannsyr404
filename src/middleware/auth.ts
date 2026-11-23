import type { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { ensureUserProfileAndAccount } from '../db/users.ts';

export interface AuthUserPayload {
  uid: string;
  email: string;
  name?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUserPayload;
}

export function normalizeServerSupabaseUrl(raw: string): string {
  const trimmed = raw.trim();
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

function getServerSupabaseClient() {
  const rawUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    '';
  const supabaseUrl = normalizeServerSupabaseUrl(rawUrl);

  const supabaseKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sesi tidak valid. Silakan login kembali.' });
  }

  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return res.status(500).json({
      error:
        'Konfigurasi Supabase di server belum lengkap (SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY).',
    });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({
        error: 'Token autentikasi Supabase tidak valid atau kedaluwarsa.',
      });
    }

    const user = data.user;
    const fullName =
      typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : undefined;

    req.user = {
      uid: user.id,
      email: user.email || '',
      name: fullName,
    };

    await ensureUserProfileAndAccount(
      req.user.uid,
      req.user.email,
      req.user.name
    );
    next();
  } catch (error) {
    console.error('Error verifying Supabase token:', error);
    return res.status(401).json({
      error: 'Gagal memverifikasi sesi autentikasi.',
    });
  }
};
