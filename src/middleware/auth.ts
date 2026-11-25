import type { Request, Response, NextFunction } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ensureUserProfileAndAccount } from '../db/users.ts';

export interface AuthUserPayload {
  uid: string;
  email: string;
  name?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUserPayload;
  supabaseClient?: SupabaseClient;
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

function getServerSupabaseConfig() {
  const rawUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    '';
  const supabaseUrl = normalizeServerSupabaseUrl(rawUrl);

  const serviceRoleKey = stripQuotes(
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  const publicKey = stripQuotes(
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      ''
  );

  const supabaseKey = serviceRoleKey || publicKey;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return { supabaseUrl, supabaseKey, isServiceRole: Boolean(serviceRoleKey) };
}

function createServerSupabaseClient(userToken?: string): SupabaseClient | null {
  const cfg = getServerSupabaseConfig();
  if (!cfg) return null;

  return createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    global:
      !cfg.isServiceRole && userToken
        ? {
            headers: {
              Authorization: `Bearer ${userToken}`,
            },
          }
        : undefined,
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
    return res
      .status(401)
      .json({ error: 'Sesi tidak valid. Silakan login kembali.' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res
      .status(401)
      .json({ error: 'Token sesi kosong. Silakan login kembali.' });
  }

  const supabase = createServerSupabaseClient(token);
  if (!supabase) {
    return res.status(500).json({
      error:
        'Konfigurasi Supabase di server belum lengkap (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).',
    });
  }

  let verifiedUser: AuthUserPayload;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      const errName = String((error as any)?.name || '');
      const errStatus =
        typeof (error as any)?.status === 'number' ? (error as any).status : 0;
      const errMsg = String((error as any)?.message || '').toLowerCase();

      if (
        errName === 'AuthRetryableFetchError' ||
        errStatus >= 500 ||
        errMsg.includes('failed to fetch') ||
        errMsg.includes('network') ||
        errMsg.includes('timeout')
      ) {
        return res.status(502).json({
          error: 'Gagal terhubung ke layanan autentikasi Supabase.',
        });
      }

      return res.status(401).json({
        error: 'Token autentikasi Supabase tidak valid atau kedaluwarsa.',
        code: 'AUTH_TOKEN_INVALID',
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
  req.supabaseClient = supabase;

  try {
    await ensureUserProfileAndAccount(
      verifiedUser.uid,
      verifiedUser.email,
      verifiedUser.name,
      supabase
    );
    next();
  } catch (error: any) {
    console.error('Database sync error in requireAuth:', error);
    return res.status(500).json({
      error:
        error?.message || 'Gagal menyinkronkan profil pengguna di database.',
    });
  }
};
