import type { SupabaseClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import { getSqlDb, isSqlDatabaseConfigured } from './index.ts';
import { profiles, tradingAccounts } from './schema.ts';
import { ensureSupabaseUserProfileAndAccount } from './supabase-repository.ts';

export async function ensureUserProfileAndAccount(
  uid: string,
  email: string,
  displayName?: string,
  supabase?: SupabaseClient
) {
  if (!isSqlDatabaseConfigured()) {
    if (!supabase) {
      throw new Error('Client Supabase tidak tersedia untuk sinkronisasi profil.');
    }
    return ensureSupabaseUserProfileAndAccount(supabase, uid, email, displayName);
  }

  try {
    const db = getSqlDb();
    const existingProfiles = await db
      .select()
      .from(profiles)
      .where(eq(profiles.uid, uid))
      .limit(1);

    let profile = existingProfiles[0];
    if (!profile) {
      const inserted = await db
        .insert(profiles)
        .values({
          uid,
          email,
          fullName: displayName || email.split('@')[0] || 'Trader',
          traderStyle: 'Inner Circle Trader',
        })
        .onConflictDoUpdate({
          target: profiles.uid,
          set: { email },
        })
        .returning();
      profile = inserted[0];
    }

    const existingAccounts = await db
      .select()
      .from(tradingAccounts)
      .where(eq(tradingAccounts.userId, uid));

    if (existingAccounts.length === 0) {
      await db.insert(tradingAccounts).values({
        userId: uid,
        name: 'Akun Utama USD',
        broker: 'Standard Broker',
        currency: 'USD',
        initialBalance: 10000,
        isActive: true,
      });
    }

    return profile;
  } catch (error) {
    console.error('Database query failed in ensureUserProfileAndAccount:', error);
    throw new Error('Gagal menyinkronkan profil pengguna.', { cause: error });
  }
}
