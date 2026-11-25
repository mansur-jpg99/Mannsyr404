import type { SupabaseClient } from '@supabase/supabase-js';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, isSqlDatabaseConfigured } from './index.ts';
import {
  aiConversations,
  aiMessages,
  dailyReviews,
  profiles,
  tradeScreenshots,
  trades,
  tradingAccounts,
} from './schema.ts';
import {
  sbAppendAiMessages,
  sbCreateAiConversation,
  sbCreateTradeScreenshot,
  sbCreateUserAccount,
  sbCreateUserReview,
  sbCreateUserTrade,
  sbDeleteAiConversation,
  sbDeleteTradeScreenshot,
  sbDeleteUserAccount,
  sbDeleteUserReview,
  sbDeleteUserTrade,
  sbGetAiConversations,
  sbGetAiMessages,
  sbGetTradeScreenshots,
  sbGetUserAccounts,
  sbGetUserProfile,
  sbGetUserReviews,
  sbGetUserTrades,
  sbUpdateUserAccount,
  sbUpdateUserProfile,
  sbUpdateUserReview,
  sbUpdateUserTrade,
} from './supabase-repository.ts';

export interface TradePayload {
  accountId: number;
  tradeDate: string;
  tradeTime: string;
  pair: string;
  direction: string;
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number;
  takeProfit: number;
  lotSize: number;
  status: string;
  grossPl: number;
  commission: number;
  swap: number;
  netPl: number;
  strategy: string;
  session: string;
  emotion: string;
  entryReason: string;
  notes: string;
}

export interface AccountPayload {
  name: string;
  broker: string;
  currency: string;
  initialBalance: number;
}

export interface ReviewPayload {
  accountId: number;
  reviewDate: string;
  emotionalState: string;
  disciplineScore: number;
  mistakes: string;
  dailyReflection: string;
  progressNotes: string;
}

export interface ScreenshotPayload {
  tradeId: number;
  stage: string;
  fileName: string;
  mimeType: string;
  imageData: string;
  caption: string;
}

function requireSupabaseClient(supabase?: SupabaseClient): SupabaseClient {
  if (!supabase) {
    throw new Error('Client Supabase tidak tersedia.');
  }
  return supabase;
}

export async function getUserProfile(uid: string, supabase?: SupabaseClient) {
  if (!isSqlDatabaseConfigured()) {
    return sbGetUserProfile(requireSupabaseClient(supabase), uid);
  }
  try {
    const rows = await db
      .select()
      .from(profiles)
      .where(eq(profiles.uid, uid))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('getUserProfile failed:', error);
    throw new Error('Gagal memuat profil pengguna.', { cause: error });
  }
}

export async function updateUserProfile(
  uid: string,
  data: { fullName: string; traderStyle: string },
  supabase?: SupabaseClient
) {
  if (!isSqlDatabaseConfigured()) {
    return sbUpdateUserProfile(requireSupabaseClient(supabase), uid, data);
  }
  try {
    const rows = await db
      .update(profiles)
      .set({
        fullName: data.fullName,
        traderStyle: data.traderStyle,
        updatedAt: new Date(),
      })
      .where(eq(profiles.uid, uid))
      .returning();
    return rows[0];
  } catch (error) {
    console.error('updateUserProfile failed:', error);
    throw new Error('Gagal memperbarui profil pengguna.', { cause: error });
  }
}

export async function getUserAccounts(uid: string, supabase?: SupabaseClient) {
  if (!isSqlDatabaseConfigured()) {
    return sbGetUserAccounts(requireSupabaseClient(supabase), uid);
  }
  try {
    return await db
      .select()
      .from(tradingAccounts)
      .where(eq(tradingAccounts.userId, uid))
      .orderBy(tradingAccounts.createdAt);
  } catch (error) {
    console.error('getUserAccounts failed:', error);
    throw new Error('Gagal memuat daftar akun trading.', { cause: error });
  }
}

export async function createUserAccount(
  uid: string,
  payload: AccountPayload,
  supabase?: SupabaseClient
) {
  if (!isSqlDatabaseConfigured()) {
    return sbCreateUserAccount(requireSupabaseClient(supabase), uid, payload);
  }
  try {
    const rows = await db
      .insert(tradingAccounts)
      .values({
        userId: uid,
        name: payload.name,
        broker: payload.broker,
        currency: payload.currency,
        initialBalance: payload.initialBalance,
        isActive: true,
      })
      .returning();
    return rows[0];
  } catch (error) {
    console.error('createUserAccount failed:', error);
    throw new Error('Gagal membuat akun trading.', { cause: error });
  }
}

export async function updateUserAccount(
  uid: string,
  accountId: number,
  payload: AccountPayload,
  supabase?: SupabaseClient
) {
  if (!isSqlDatabaseConfigured()) {
    return sbUpdateUserAccount(
      requireSupabaseClient(supabase),
      uid,
      accountId,
      payload
    );
  }
  try {
    const rows = await db
      .update(tradingAccounts)
      .set({
        name: payload.name,
        broker: payload.broker,
        currency: payload.currency,
        initialBalance: payload.initialBalance,
      })
      .where(and(eq(tradingAccounts.id, accountId), eq(tradingAccounts.userId, uid)))
      .returning();
    return rows[0] || null;
  } catch (error) {
    console.error('updateUserAccount failed:', error);
    throw new Error('Gagal memperbarui akun trading.', { cause: error });
  }
}

export async function deleteUserAccount(
  uid: string,
  accountId: number,
  supabase?: SupabaseClient
) {
  if (!isSqlDatabaseConfigured()) {
    return sbDeleteUserAccount(requireSupabaseClient(supabase), uid, accountId);
  }
  try {
    const allAccounts = await getUserAccounts(uid);
    if (allAccounts.length <= 1) {
      throw new Error('Minimal satu akun trading harus dipertahankan.');
    }
    const rows = await db
      .delete(tradingAccounts)
      .where(and(eq(tradingAccounts.id, accountId), eq(tradingAccounts.userId, uid)))
      .returning();
    return rows[0] || null;
  } catch (error: any) {
    console.error('deleteUserAccount failed:', error);
    if (error?.message?.includes('Minimal satu akun')) {
      throw error;
    }
    throw new Error('Gagal menghapus akun trading.', { cause: error });
  }
}

export async function getUserTrades(
  uid: string,
  accountId?: number,
  supabase?: SupabaseClient
) {
  if (!isSqlDatabaseConfigured()) {
    return sbGetUserTrades(requireSupabaseClient(supabase), uid, accountId);
  }
  try {
    const conditions = accountId
      ? and(eq(trades.userId, uid), eq(trades.accountId, accountId))
      : eq(trades.userId, uid);

    const tradeRows = await db
      .select()
      .from(trades)
      .where(conditions)
      .orderBy(desc(trades.tradeDate), desc(trades.tradeTime), desc(trades.id));

    if (tradeRows.length === 0) {
      return [];
    }

    const tradeIds = tradeRows.map((t) => t.id);
    const screenshotMeta = await db
      .select({
        id: tradeScreenshots.id,
        tradeId: tradeScreenshots.tradeId,
        stage: tradeScreenshots.stage,
      })
      .from(tradeScreenshots)
      .where(and(eq(tradeScreenshots.userId, uid), inArray(tradeScreenshots.tradeId, tradeIds)));

    const countMap = new Map<number, number>();
    for (const s of screenshotMeta) {
      countMap.set(s.tradeId, (countMap.get(s.tradeId) || 0) + 1);
    }

    return tradeRows.map((t) => ({
      ...t,
      screenshotCount: countMap.get(t.id) || 0,
    }));
  } catch (error) {
    console.error('getUserTrades failed:', error);
    throw new Error('Gagal memuat riwayat transaksi.', { cause: error });
  }
}

export async function createUserTrade(
  uid: string,
  payload: TradePayload,
  supabase?: SupabaseClient
) {
  if (!isSqlDatabaseConfigured()) {
    return sbCreateUserTrade(requireSupabaseClient(supabase), uid, payload);
  }
  try {
    const ownedAccounts = await db
      .select()
      .from(tradingAccounts)
      .where(and(eq(tradingAccounts.id, payload.accountId), eq(tradingAccounts.userId, uid)))
      .limit(1);

    if (!ownedAccounts[0]) {
      throw new Error('Akun trading tidak ditemukan atau tidak memiliki akses.');
    }

    const rows = await db
      .insert(trades)
      .values({
        userId: uid,
        accountId: payload.accountId,
        tradeDate: payload.tradeDate,
        tradeTime: payload.tradeTime,
        pair: payload.pair.toUpperCase().trim(),
        direction: payload.direction,
        entryPrice: payload.entryPrice,
        exitPrice: payload.exitPrice,
        stopLoss: payload.stopLoss,
        takeProfit: payload.takeProfit,
        lotSize: payload.lotSize,
        status: payload.status,
        grossPl: payload.grossPl,
        commission: payload.commission,
        swap: payload.swap,
        netPl: payload.netPl,
        strategy: payload.strategy,
        session: payload.session,
        emotion: payload.emotion,
        entryReason: payload.entryReason,
        notes: payload.notes,
      })
      .returning();

    return { ...rows[0], screenshotCount: 0 };
  } catch (error: any) {
    console.error('createUserTrade failed:', error);
    if (error?.message?.includes('Akun trading tidak ditemukan')) {
      throw error;
    }
    throw new Error('Gagal menyimpan transaksi baru.', { cause: error });
  }
}

export async function updateUserTrade(
  uid: string,
  tradeId: number,
  payload: TradePayload,
  supabase?: SupabaseClient
) {
  if (!isSqlDatabaseConfigured()) {
    return sbUpdateUserTrade(
      requireSupabaseClient(supabase),
      uid,
      tradeId,
      payload
    );
  }
  try {
    const ownedAccounts = await db
      .select()
      .from(tradingAccounts)
      .where(and(eq(tradingAccounts.id, payload.accountId), eq(tradingAccounts.userId, uid)))
      .limit(1);

    if (!ownedAccounts[0]) {
      throw new Error('Akun trading tidak valid.');
    }

    const rows = await db
      .update(trades)
      .set({
        accountId: payload.accountId,
        tradeDate: payload.tradeDate,
        tradeTime: payload.tradeTime,
        pair: payload.pair.toUpperCase().trim(),
        direction: payload.direction,
        entryPrice: payload.entryPrice,
        exitPrice: payload.exitPrice,
        stopLoss: payload.stopLoss,
        takeProfit: payload.takeProfit,
        lotSize: payload.lotSize,
        status: payload.status,
        grossPl: payload.grossPl,
        commission: payload.commission,
        swap: payload.swap,
        netPl: payload.netPl,
        strategy: payload.strategy,
        session: payload.session,
        emotion: payload.emotion,
        entryReason: payload.entryReason,
        notes: payload.notes,
        updatedAt: new Date(),
      })
      .where(and(eq(trades.id, tradeId), eq(trades.userId, uid)))
      .returning();

    return rows[0] || null;
  } catch (error) {
    console.error('updateUserTrade failed:', error);
    throw new Error('Gagal memperbarui transaksi.', { cause: error });
  }
}

export async function deleteUserTrade(
  uid: string,
  tradeId: number,
  supabase?: SupabaseClient
) {
  if (!isSqlDatabaseConfigured()) {
    return sbDeleteUserTrade(requireSupabaseClient(supabase), uid, tradeId);
  }
  try {
    const rows = await db
      .delete(trades)
      .where(and(eq(trades.id, tradeId), eq(trades.userId, uid)))
      .returning();
    return rows[0] || null;
  } catch (error) {
    console.error('deleteUserTrade failed:', error);
    throw new Error('Gagal menghapus transaksi.', { cause: error });
  }
}

export async function getTradeScreenshots(
  uid: string,
  tradeId: number,
  supabase?: SupabaseClient
) {
  if (!isSqlDatabaseConfigured()) {
    return sbGetTradeScreenshots(requireSupabaseClient(supabase), uid, tradeId);
  }
  try {
    return await db
      .select()
      .from(tradeScreenshots)
      .where(and(eq(tradeScreenshots.tradeId, tradeId), eq(tradeScreenshots.userId, uid)))
      .orderBy(tradeScreenshots.createdAt);
  } catch (error) {
    console.error('getTradeScreenshots failed:', error);
    throw new Error('Gagal memuat screenshot transaksi.', { cause: error });
  }
}

export async function createTradeScreenshot(
  uid: string,
  payload: ScreenshotPayload,
  supabase?: SupabaseClient
) {
  if (!isSqlDatabaseConfigured()) {
    return sbCreateTradeScreenshot(requireSupabaseClient(supabase), uid, payload);
  }
  try {
    const ownedTrade = await db
      .select()
      .from(trades)
      .where(and(eq(trades.id, payload.tradeId), eq(trades.userId, uid)))
      .limit(1);

    if (!ownedTrade[0]) {
      throw new Error('Transaksi tidak ditemukan atau tidak memiliki akses.');
    }

    const rows = await db
      .insert(tradeScreenshots)
      .values({
        userId: uid,
        tradeId: payload.tradeId,
        stage: payload.stage,
        fileName: payload.fileName,
        mimeType: payload.mimeType,
        imageData: payload.imageData,
        caption: payload.caption,
      })
      .returning();

    return rows[0];
  } catch (error: any) {
    console.error('createTradeScreenshot failed:', error);
    if (error?.message?.includes('Transaksi tidak ditemukan')) {
      throw error;
    }
    throw new Error('Gagal mengunggah screenshot.', { cause: error });
  }
}

export async function deleteTradeScreenshot(
  uid: string,
  screenshotId: number,
  supabase?: SupabaseClient
) {
  if (!isSqlDatabaseConfigured()) {
    return sbDeleteTradeScreenshot(
      requireSupabaseClient(supabase),
      uid,
      screenshotId
    );
  }
  try {
    const rows = await db
      .delete(tradeScreenshots)
      .where(and(eq(tradeScreenshots.id, screenshotId), eq(tradeScreenshots.userId, uid)))
      .returning();
    return rows[0] || null;
  } catch (error) {
    console.error('deleteTradeScreenshot failed:', error);
    throw new Error('Gagal menghapus screenshot.', { cause: error });
  }
}

export async function getUserReviews(
  uid: string,
  accountId?: number,
  supabase?: SupabaseClient
) {
  if (!isSqlDatabaseConfigured()) {
    return sbGetUserReviews(requireSupabaseClient(supabase), uid, accountId);
  }
  try {
    const conditions = accountId
      ? and(eq(dailyReviews.userId, uid), eq(dailyReviews.accountId, accountId))
      : eq(dailyReviews.userId, uid);

    return await db
      .select()
      .from(dailyReviews)
      .where(conditions)
      .orderBy(desc(dailyReviews.reviewDate), desc(dailyReviews.id));
  } catch (error) {
    console.error('getUserReviews failed:', error);
    throw new Error('Gagal memuat evaluasi harian.', { cause: error });
  }
}

export async function createUserReview(
  uid: string,
  payload: ReviewPayload,
  supabase?: SupabaseClient
) {
  if (!isSqlDatabaseConfigured()) {
    return sbCreateUserReview(requireSupabaseClient(supabase), uid, payload);
  }
  try {
    const ownedAccounts = await db
      .select()
      .from(tradingAccounts)
      .where(and(eq(tradingAccounts.id, payload.accountId), eq(tradingAccounts.userId, uid)))
      .limit(1);

    if (!ownedAccounts[0]) {
      throw new Error('Akun trading tidak ditemukan.');
    }

    const rows = await db
      .insert(dailyReviews)
      .values({
        userId: uid,
        accountId: payload.accountId,
        reviewDate: payload.reviewDate,
        emotionalState: payload.emotionalState,
        disciplineScore: payload.disciplineScore,
        mistakes: payload.mistakes,
        dailyReflection: payload.dailyReflection,
        progressNotes: payload.progressNotes,
      })
      .returning();

    return rows[0];
  } catch (error) {
    console.error('createUserReview failed:', error);
    throw new Error('Gagal menyimpan evaluasi harian.', { cause: error });
  }
}

export async function updateUserReview(
  uid: string,
  reviewId: number,
  payload: ReviewPayload,
  supabase?: SupabaseClient
) {
  if (!isSqlDatabaseConfigured()) {
    return sbUpdateUserReview(
      requireSupabaseClient(supabase),
      uid,
      reviewId,
      payload
    );
  }
  try {
    const rows = await db
      .update(dailyReviews)
      .set({
        reviewDate: payload.reviewDate,
        emotionalState: payload.emotionalState,
        disciplineScore: payload.disciplineScore,
        mistakes: payload.mistakes,
        dailyReflection: payload.dailyReflection,
        progressNotes: payload.progressNotes,
        updatedAt: new Date(),
      })
      .where(and(eq(dailyReviews.id, reviewId), eq(dailyReviews.userId, uid)))
      .returning();

    return rows[0] || null;
  } catch (error) {
    console.error('updateUserReview failed:', error);
    throw new Error('Gagal memperbarui evaluasi harian.', { cause: error });
  }
}

export async function deleteUserReview(
  uid: string,
  reviewId: number,
  supabase?: SupabaseClient
) {
  if (!isSqlDatabaseConfigured()) {
    return sbDeleteUserReview(requireSupabaseClient(supabase), uid, reviewId);
  }
  try {
    const rows = await db
      .delete(dailyReviews)
      .where(and(eq(dailyReviews.id, reviewId), eq(dailyReviews.userId, uid)))
      .returning();
    return rows[0] || null;
  } catch (error) {
    console.error('deleteUserReview failed:', error);
    throw new Error('Gagal menghapus evaluasi harian.', { cause: error });
  }
}

function isDrizzleMissingTableError(error: any): boolean {
  const code = String(error?.code || error?.cause?.code || '');
  const message = String(error?.message || error?.cause?.message || '').toLowerCase();
  return code === '42P01' || message.includes('does not exist');
}

export async function getAiConversations(uid: string, supabase?: SupabaseClient) {
  if (supabase || !isSqlDatabaseConfigured()) {
    return sbGetAiConversations(requireSupabaseClient(supabase), uid);
  }
  try {
    const rows = await db
      .select()
      .from(aiConversations)
      .where(eq(aiConversations.userId, uid))
      .orderBy(desc(aiConversations.updatedAt));
    return {
      conversations: rows.map((r) => ({
        ...r,
        id: String(r.id),
        userId: String(r.userId),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      storageAvailable: true,
    };
  } catch (error: any) {
    if (isDrizzleMissingTableError(error)) {
      return { conversations: [], storageAvailable: false };
    }
    console.error('getAiConversations failed:', error);
    throw new Error('Gagal memuat riwayat percakapan MANSUR AI.', { cause: error });
  }
}

export async function getAiMessages(
  uid: string,
  conversationId: string,
  supabase?: SupabaseClient
) {
  if (supabase || !isSqlDatabaseConfigured()) {
    return sbGetAiMessages(requireSupabaseClient(supabase), uid, conversationId);
  }
  try {
    const owned = await db
      .select()
      .from(aiConversations)
      .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, uid)))
      .limit(1);
    if (!owned[0]) {
      return { messages: [], storageAvailable: true, found: false };
    }
    const rows = await db
      .select()
      .from(aiMessages)
      .where(and(eq(aiMessages.userId, uid), eq(aiMessages.conversationId, conversationId)))
      .orderBy(aiMessages.createdAt);
    return {
      messages: rows.map((r) => ({
        ...r,
        id: String(r.id),
        userId: String(r.userId),
        conversationId: String(r.conversationId),
        role: r.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        createdAt: r.createdAt.toISOString(),
      })),
      storageAvailable: true,
      found: true,
    };
  } catch (error: any) {
    if (isDrizzleMissingTableError(error)) {
      return { messages: [], storageAvailable: false, found: false };
    }
    console.error('getAiMessages failed:', error);
    throw new Error('Gagal memuat pesan percakapan.', { cause: error });
  }
}

export async function createAiConversation(
  uid: string,
  title: string,
  supabase?: SupabaseClient
) {
  if (supabase || !isSqlDatabaseConfigured()) {
    return sbCreateAiConversation(requireSupabaseClient(supabase), uid, title);
  }
  try {
    const rows = await db
      .insert(aiConversations)
      .values({ userId: uid, title })
      .returning();
    return {
      conversation: {
        ...rows[0],
        id: String(rows[0].id),
        userId: String(rows[0].userId),
        createdAt: rows[0].createdAt.toISOString(),
        updatedAt: rows[0].updatedAt.toISOString(),
      },
      storageAvailable: true,
    };
  } catch (error: any) {
    if (isDrizzleMissingTableError(error)) {
      return { conversation: null, storageAvailable: false };
    }
    console.error('createAiConversation failed:', error);
    throw new Error('Gagal membuat percakapan baru.', { cause: error });
  }
}

export async function appendAiMessages(
  uid: string,
  conversationId: string,
  userContent: string,
  assistantContent: string,
  supabase?: SupabaseClient
) {
  if (supabase || !isSqlDatabaseConfigured()) {
    return sbAppendAiMessages(
      requireSupabaseClient(supabase),
      uid,
      conversationId,
      userContent,
      assistantContent
    );
  }
  try {
    const nowMs = Date.now();
    const inserted = await db
      .insert(aiMessages)
      .values([
        {
          userId: uid,
          conversationId,
          role: 'user',
          content: userContent,
          createdAt: new Date(nowMs),
        },
        {
          userId: uid,
          conversationId,
          role: 'assistant',
          content: assistantContent,
          createdAt: new Date(nowMs + 1),
        },
      ])
      .returning();
    await db
      .update(aiConversations)
      .set({ updatedAt: new Date(nowMs + 1) })
      .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, uid)));
    return {
      messages: inserted.map((r) => ({
        ...r,
        id: String(r.id),
        userId: String(r.userId),
        conversationId: String(r.conversationId),
        role: r.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        createdAt: r.createdAt.toISOString(),
      })),
      storageAvailable: true,
    };
  } catch (error: any) {
    if (isDrizzleMissingTableError(error)) {
      return { messages: [], storageAvailable: false };
    }
    console.error('appendAiMessages failed:', error);
    throw new Error('Gagal menyimpan pesan percakapan.', { cause: error });
  }
}

export async function deleteAiConversation(
  uid: string,
  conversationId: string,
  supabase?: SupabaseClient
) {
  if (supabase || !isSqlDatabaseConfigured()) {
    return sbDeleteAiConversation(requireSupabaseClient(supabase), uid, conversationId);
  }
  try {
    const rows = await db
      .delete(aiConversations)
      .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, uid)))
      .returning();
    return {
      deleted: rows[0]
        ? {
            ...rows[0],
            id: String(rows[0].id),
            userId: String(rows[0].userId),
            createdAt: rows[0].createdAt.toISOString(),
            updatedAt: rows[0].updatedAt.toISOString(),
          }
        : null,
      storageAvailable: true,
    };
  } catch (error: any) {
    if (isDrizzleMissingTableError(error)) {
      return { deleted: null, storageAvailable: false };
    }
    console.error('deleteAiConversation failed:', error);
    throw new Error('Gagal menghapus percakapan.', { cause: error });
  }
}

