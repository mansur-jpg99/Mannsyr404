import type { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { isDatabaseConfigured } from '../db/index.ts';
import { ensureUserProfileAndAccount } from '../db/users.ts';

export interface AuthUserPayload {
  uid: string;
  email: string;
  name?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUserPayload;
}

function stripQuotes(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function normalizeServerSupabaseUrl(raw: string): string {
  const trimmed = stripQuotes(raw);
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

  const supabaseKey = stripQuotes(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      ''
  );

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

  if (!isDatabaseConfigured()) {
    return res.status(500).json({
      error:
        'Konfigurasi database server belum lengkap (DATABASE_URL atau SQL_HOST).',
    });
  }

  const token = authHeader.split('Bearer ')[1];
  let verifiedUser: AuthUserPayload;
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

    verifiedUser = {
      uid: user.id,
      email: user.email || '',
      name: fullName,
    };
  } catch (error) {
    console.error('Error verifying Supabase token:', error);
    return res.status(502).json({
      error: 'Gagal terhubung ke layanan autentikasi Supabase.',
    });
  }

  req.user = verifiedUser;

  try {
    await ensureUserProfileAndAccount(
      verifiedUser.uid,
      verifiedUser.email,
      verifiedUser.name
    );
    next();
  } catch (error: any) {
    console.error('Database sync error in requireAuth:', error);
    return res.status(500).json({
      error: error?.message || 'Gagal menyinkronkan profil pengguna di database.',
    });
  }
};
