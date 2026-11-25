import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AccountPayload,
  ReviewPayload,
  ScreenshotPayload,
  TradePayload,
} from './repository.ts';

function handleSupabaseDbError(error: any, fallbackMessage: string): never {
  const code = String(error?.code || '');
  const message = String(error?.message || '');

  if (
    code === 'PGRST205' ||
    code === '42P01' ||
    message.includes('Could not find the table')
  ) {
    throw new Error(
      'Tabel database belum tersedia di Supabase. Jalankan skrip supabase/schema.sql pada Supabase SQL Editor Anda.'
    );
  }

  if (code === '42501' || message.toLowerCase().includes('row-level security')) {
    throw new Error(
      'Akses ditolak oleh kebijakan RLS Supabase. Pastikan policy pada supabase/schema.sql sudah diterapkan.'
    );
  }

  throw new Error(fallbackMessage, { cause: error });
}

function mapProfileRow(row: any) {
  if (!row) return null;
  return {
    id: Number(row.id),
    uid: String(row.uid),
    email: String(row.email),
    fullName: String(row.full_name ?? ''),
    traderStyle: String(row.trader_style ?? 'Inner Circle Trader'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAccountRow(row: any) {
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    broker: String(row.broker ?? ''),
    currency: String(row.currency ?? 'USD'),
    initialBalance: Number(row.initial_balance ?? 0),
    isActive: Boolean(row.is_active ?? true),
    createdAt: row.created_at,
  };
}

function mapTradeRow(row: any, screenshotCount = 0) {
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    accountId: Number(row.account_id),
    tradeDate: String(row.trade_date),
    tradeTime: String(row.trade_time ?? '09:00'),
    pair: String(row.pair),
    direction: String(row.direction),
    entryPrice: Number(row.entry_price),
    exitPrice:
      row.exit_price === null || row.exit_price === undefined
        ? null
        : Number(row.exit_price),
    stopLoss: Number(row.stop_loss),
    takeProfit: Number(row.take_profit),
    lotSize: Number(row.lot_size),
    status: String(row.status),
    grossPl: Number(row.gross_pl ?? 0),
    commission: Number(row.commission ?? 0),
    swap: Number(row.swap ?? 0),
    netPl: Number(row.net_pl ?? 0),
    strategy: String(row.strategy ?? ''),
    session: String(row.session ?? 'London'),
    emotion: String(row.emotion ?? 'Tenang'),
    entryReason: String(row.entry_reason ?? ''),
    notes: String(row.notes ?? ''),
    screenshotCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapScreenshotRow(row: any) {
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    tradeId: Number(row.trade_id),
    stage: String(row.stage),
    fileName: String(row.file_name),
    mimeType: String(row.mime_type),
    imageData: String(row.image_data),
    caption: String(row.caption ?? ''),
    createdAt: row.created_at,
  };
}

function mapReviewRow(row: any) {
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    accountId: Number(row.account_id),
    reviewDate: String(row.review_date),
    emotionalState: String(row.emotional_state),
    disciplineScore: Number(row.discipline_score ?? 8),
    mistakes: String(row.mistakes ?? ''),
    dailyReflection: String(row.daily_reflection ?? ''),
    progressNotes: String(row.progress_notes ?? ''),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function ensureSupabaseUserProfileAndAccount(
  supabase: SupabaseClient,
  uid: string,
  email: string,
  displayName?: string
) {
  const { data: existingProfile, error: selectProfileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('uid', uid)
    .limit(1)
    .maybeSingle();

  if (selectProfileErr) {
    handleSupabaseDbError(selectProfileErr, 'Gagal memeriksa profil pengguna di Supabase.');
  }

  let profile = existingProfile;
  if (!profile) {
    const { data: upsertedProfile, error: upsertErr } = await supabase
      .from('profiles')
      .upsert(
        {
          uid,
          email,
          full_name: displayName || email.split('@')[0] || 'Trader',
          trader_style: 'Inner Circle Trader',
        },
        { onConflict: 'uid' }
      )
      .select()
      .single();

    if (upsertErr) {
      handleSupabaseDbError(upsertErr, 'Gagal menyinkronkan profil pengguna di Supabase.');
    }
    profile = upsertedProfile;
  }

  const { data: existingAccounts, error: selectAccErr } = await supabase
    .from('trading_accounts')
    .select('id')
    .eq('user_id', uid)
    .limit(1);

  if (selectAccErr) {
    handleSupabaseDbError(selectAccErr, 'Gagal memeriksa akun trading di Supabase.');
  }

  if (!existingAccounts || existingAccounts.length === 0) {
    const { error: insertAccErr } = await supabase
      .from('trading_accounts')
      .insert({
        user_id: uid,
        name: 'Akun Utama USD',
        broker: 'Standard Broker',
        currency: 'USD',
        initial_balance: 10000,
        is_active: true,
      });

    if (insertAccErr) {
      handleSupabaseDbError(insertAccErr, 'Gagal membuat akun trading awal di Supabase.');
    }
  }

  return mapProfileRow(profile);
}

export async function sbGetUserProfile(supabase: SupabaseClient, uid: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('uid', uid)
    .limit(1)
    .maybeSingle();

  if (error) {
    handleSupabaseDbError(error, 'Gagal memuat profil pengguna.');
  }
  return mapProfileRow(data);
}

export async function sbUpdateUserProfile(
  supabase: SupabaseClient,
  uid: string,
  payload: { fullName: string; traderStyle: string }
) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: payload.fullName,
      trader_style: payload.traderStyle,
      updated_at: new Date().toISOString(),
    })
    .eq('uid', uid)
    .select()
    .maybeSingle();

  if (error) {
    handleSupabaseDbError(error, 'Gagal memperbarui profil pengguna.');
  }
  return mapProfileRow(data);
}

export async function sbGetUserAccounts(supabase: SupabaseClient, uid: string) {
  const { data, error } = await supabase
    .from('trading_accounts')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: true });

  if (error) {
    handleSupabaseDbError(error, 'Gagal memuat daftar akun trading.');
  }
  return (data || []).map(mapAccountRow);
}

export async function sbCreateUserAccount(
  supabase: SupabaseClient,
  uid: string,
  payload: AccountPayload
) {
  const { data, error } = await supabase
    .from('trading_accounts')
    .insert({
      user_id: uid,
      name: payload.name,
      broker: payload.broker,
      currency: payload.currency,
      initial_balance: payload.initialBalance,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    handleSupabaseDbError(error, 'Gagal membuat akun trading.');
  }
  return mapAccountRow(data);
}

export async function sbUpdateUserAccount(
  supabase: SupabaseClient,
  uid: string,
  accountId: number,
  payload: AccountPayload
) {
  const { data, error } = await supabase
    .from('trading_accounts')
    .update({
      name: payload.name,
      broker: payload.broker,
      currency: payload.currency,
      initial_balance: payload.initialBalance,
    })
    .eq('id', accountId)
    .eq('user_id', uid)
    .select()
    .maybeSingle();

  if (error) {
    handleSupabaseDbError(error, 'Gagal memperbarui akun trading.');
  }
  return data ? mapAccountRow(data) : null;
}

export async function sbDeleteUserAccount(
  supabase: SupabaseClient,
  uid: string,
  accountId: number
) {
  const allAccounts = await sbGetUserAccounts(supabase, uid);
  if (allAccounts.length <= 1) {
    throw new Error('Minimal satu akun trading harus dipertahankan.');
  }

  const { data, error } = await supabase
    .from('trading_accounts')
    .delete()
    .eq('id', accountId)
    .eq('user_id', uid)
    .select()
    .maybeSingle();

  if (error) {
    handleSupabaseDbError(error, 'Gagal menghapus akun trading.');
  }
  return data ? mapAccountRow(data) : null;
}

export async function sbGetUserTrades(
  supabase: SupabaseClient,
  uid: string,
  accountId?: number
) {
  let query = supabase
    .from('trades')
    .select('*')
    .eq('user_id', uid)
    .order('trade_date', { ascending: false })
    .order('trade_time', { ascending: false })
    .order('id', { ascending: false });

  if (accountId) {
    query = query.eq('account_id', accountId);
  }

  const { data: tradeRows, error } = await query;
  if (error) {
    handleSupabaseDbError(error, 'Gagal memuat riwayat transaksi.');
  }

  if (!tradeRows || tradeRows.length === 0) {
    return [];
  }

  const tradeIds = tradeRows.map((t: any) => t.id);
  const { data: screenshotMeta, error: ssErr } = await supabase
    .from('trade_screenshots')
    .select('id, trade_id')
    .eq('user_id', uid)
    .in('trade_id', tradeIds);

  if (ssErr) {
    handleSupabaseDbError(ssErr, 'Gagal memuat metadata screenshot transaksi.');
  }

  const countMap = new Map<number, number>();
  for (const s of screenshotMeta || []) {
    const tid = Number(s.trade_id);
    countMap.set(tid, (countMap.get(tid) || 0) + 1);
  }

  return tradeRows.map((row: any) =>
    mapTradeRow(row, countMap.get(Number(row.id)) || 0)
  );
}

export async function sbCreateUserTrade(
  supabase: SupabaseClient,
  uid: string,
  payload: TradePayload
) {
  const { data: ownedAccount, error: accErr } = await supabase
    .from('trading_accounts')
    .select('id')
    .eq('id', payload.accountId)
    .eq('user_id', uid)
    .limit(1)
    .maybeSingle();

  if (accErr) {
    handleSupabaseDbError(accErr, 'Gagal memverifikasi akun trading.');
  }
  if (!ownedAccount) {
    throw new Error('Akun trading tidak ditemukan atau tidak memiliki akses.');
  }

  const { data, error } = await supabase
    .from('trades')
    .insert({
      user_id: uid,
      account_id: payload.accountId,
      trade_date: payload.tradeDate,
      trade_time: payload.tradeTime,
      pair: payload.pair.toUpperCase().trim(),
      direction: payload.direction,
      entry_price: payload.entryPrice,
      exit_price: payload.exitPrice,
      stop_loss: payload.stopLoss,
      take_profit: payload.takeProfit,
      lot_size: payload.lotSize,
      status: payload.status,
      gross_pl: payload.grossPl,
      commission: payload.commission,
      swap: payload.swap,
      net_pl: payload.netPl,
      strategy: payload.strategy,
      session: payload.session,
      emotion: payload.emotion,
      entry_reason: payload.entryReason,
      notes: payload.notes,
    })
    .select()
    .single();

  if (error) {
    handleSupabaseDbError(error, 'Gagal menyimpan transaksi baru.');
  }

  return mapTradeRow(data, 0);
}

export async function sbUpdateUserTrade(
  supabase: SupabaseClient,
  uid: string,
  tradeId: number,
  payload: TradePayload
) {
  const { data: ownedAccount, error: accErr } = await supabase
    .from('trading_accounts')
    .select('id')
    .eq('id', payload.accountId)
    .eq('user_id', uid)
    .limit(1)
    .maybeSingle();

  if (accErr) {
    handleSupabaseDbError(accErr, 'Gagal memverifikasi akun trading.');
  }
  if (!ownedAccount) {
    throw new Error('Akun trading tidak valid.');
  }

  const { data, error } = await supabase
    .from('trades')
    .update({
      account_id: payload.accountId,
      trade_date: payload.tradeDate,
      trade_time: payload.tradeTime,
      pair: payload.pair.toUpperCase().trim(),
      direction: payload.direction,
      entry_price: payload.entryPrice,
      exit_price: payload.exitPrice,
      stop_loss: payload.stopLoss,
      take_profit: payload.takeProfit,
      lot_size: payload.lotSize,
      status: payload.status,
      gross_pl: payload.grossPl,
      commission: payload.commission,
      swap: payload.swap,
      net_pl: payload.netPl,
      strategy: payload.strategy,
      session: payload.session,
      emotion: payload.emotion,
      entry_reason: payload.entryReason,
      notes: payload.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tradeId)
    .eq('user_id', uid)
    .select()
    .maybeSingle();

  if (error) {
    handleSupabaseDbError(error, 'Gagal memperbarui transaksi.');
  }
  return data ? mapTradeRow(data) : null;
}

export async function sbDeleteUserTrade(
  supabase: SupabaseClient,
  uid: string,
  tradeId: number
) {
  const { data, error } = await supabase
    .from('trades')
    .delete()
    .eq('id', tradeId)
    .eq('user_id', uid)
    .select()
    .maybeSingle();

  if (error) {
    handleSupabaseDbError(error, 'Gagal menghapus transaksi.');
  }
  return data ? mapTradeRow(data) : null;
}

export async function sbGetTradeScreenshots(
  supabase: SupabaseClient,
  uid: string,
  tradeId: number
) {
  const { data, error } = await supabase
    .from('trade_screenshots')
    .select('*')
    .eq('trade_id', tradeId)
    .eq('user_id', uid)
    .order('created_at', { ascending: true });

  if (error) {
    handleSupabaseDbError(error, 'Gagal memuat screenshot transaksi.');
  }
  return (data || []).map(mapScreenshotRow);
}

export async function sbCreateTradeScreenshot(
  supabase: SupabaseClient,
  uid: string,
  payload: ScreenshotPayload
) {
  const { data: ownedTrade, error: tradeErr } = await supabase
    .from('trades')
    .select('id')
    .eq('id', payload.tradeId)
    .eq('user_id', uid)
    .limit(1)
    .maybeSingle();

  if (tradeErr) {
    handleSupabaseDbError(tradeErr, 'Gagal memverifikasi transaksi.');
  }
  if (!ownedTrade) {
    throw new Error('Transaksi tidak ditemukan atau tidak memiliki akses.');
  }

  const { data, error } = await supabase
    .from('trade_screenshots')
    .insert({
      user_id: uid,
      trade_id: payload.tradeId,
      stage: payload.stage,
      file_name: payload.fileName,
      mime_type: payload.mimeType,
      image_data: payload.imageData,
      caption: payload.caption,
    })
    .select()
    .single();

  if (error) {
    handleSupabaseDbError(error, 'Gagal mengunggah screenshot.');
  }
  return mapScreenshotRow(data);
}

export async function sbDeleteTradeScreenshot(
  supabase: SupabaseClient,
  uid: string,
  screenshotId: number
) {
  const { data, error } = await supabase
    .from('trade_screenshots')
    .delete()
    .eq('id', screenshotId)
    .eq('user_id', uid)
    .select()
    .maybeSingle();

  if (error) {
    handleSupabaseDbError(error, 'Gagal menghapus screenshot.');
  }
  return data ? mapScreenshotRow(data) : null;
}

export async function sbGetUserReviews(
  supabase: SupabaseClient,
  uid: string,
  accountId?: number
) {
  let query = supabase
    .from('daily_reviews')
    .select('*')
    .eq('user_id', uid)
    .order('review_date', { ascending: false })
    .order('id', { ascending: false });

  if (accountId) {
    query = query.eq('account_id', accountId);
  }

  const { data, error } = await query;
  if (error) {
    handleSupabaseDbError(error, 'Gagal memuat evaluasi harian.');
  }
  return (data || []).map(mapReviewRow);
}

export async function sbCreateUserReview(
  supabase: SupabaseClient,
  uid: string,
  payload: ReviewPayload
) {
  const { data: ownedAccount, error: accErr } = await supabase
    .from('trading_accounts')
    .select('id')
    .eq('id', payload.accountId)
    .eq('user_id', uid)
    .limit(1)
    .maybeSingle();

  if (accErr) {
    handleSupabaseDbError(accErr, 'Gagal memverifikasi akun trading.');
  }
  if (!ownedAccount) {
    throw new Error('Akun trading tidak ditemukan.');
  }

  const { data, error } = await supabase
    .from('daily_reviews')
    .insert({
      user_id: uid,
      account_id: payload.accountId,
      review_date: payload.reviewDate,
      emotional_state: payload.emotionalState,
      discipline_score: payload.disciplineScore,
      mistakes: payload.mistakes,
      daily_reflection: payload.dailyReflection,
      progress_notes: payload.progressNotes,
    })
    .select()
    .single();

  if (error) {
    handleSupabaseDbError(error, 'Gagal menyimpan evaluasi harian.');
  }
  return mapReviewRow(data);
}

export async function sbUpdateUserReview(
  supabase: SupabaseClient,
  uid: string,
  reviewId: number,
  payload: ReviewPayload
) {
  const { data, error } = await supabase
    .from('daily_reviews')
    .update({
      review_date: payload.reviewDate,
      emotional_state: payload.emotionalState,
      discipline_score: payload.disciplineScore,
      mistakes: payload.mistakes,
      daily_reflection: payload.dailyReflection,
      progress_notes: payload.progressNotes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reviewId)
    .eq('user_id', uid)
    .select()
    .maybeSingle();

  if (error) {
    handleSupabaseDbError(error, 'Gagal memperbarui evaluasi harian.');
  }
  return data ? mapReviewRow(data) : null;
}

export async function sbDeleteUserReview(
  supabase: SupabaseClient,
  uid: string,
  reviewId: number
) {
  const { data, error } = await supabase
    .from('daily_reviews')
    .delete()
    .eq('id', reviewId)
    .eq('user_id', uid)
    .select()
    .maybeSingle();

  if (error) {
    handleSupabaseDbError(error, 'Gagal menghapus evaluasi harian.');
  }
  return data ? mapReviewRow(data) : null;
}

function isMissingTableError(error: any): boolean {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    message.includes('Could not find the table') ||
    message.toLowerCase().includes('does not exist')
  );
}

function mapAiConversationRow(row: any) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title ?? 'Konsultasi Trading'),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapAiMessageRow(row: any) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    conversationId: String(row.conversation_id),
    role: row.role === 'assistant' ? ('assistant' as const) : ('user' as const),
    content: String(row.content ?? ''),
    createdAt: String(row.created_at),
  };
}

export async function sbGetAiConversations(supabase: SupabaseClient, uid: string) {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('id, user_id, title, created_at, updated_at')
    .eq('user_id', uid)
    .order('updated_at', { ascending: false })
    .limit(40);

  if (error) {
    if (isMissingTableError(error)) {
      return { conversations: [], storageAvailable: false };
    }
    handleSupabaseDbError(error, 'Gagal memuat riwayat percakapan MANSUR AI.');
  }
  return {
    conversations: (data || []).map(mapAiConversationRow),
    storageAvailable: true,
  };
}

export async function sbGetAiMessages(
  supabase: SupabaseClient,
  uid: string,
  conversationId: string
) {
  const { data: conv, error: convErr } = await supabase
    .from('ai_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', uid)
    .limit(1)
    .maybeSingle();

  if (convErr) {
    if (isMissingTableError(convErr)) {
      return { messages: [], storageAvailable: false, found: false };
    }
    handleSupabaseDbError(convErr, 'Gagal memverifikasi percakapan.');
  }

  if (!conv) {
    return { messages: [], storageAvailable: true, found: false };
  }

  const { data, error } = await supabase
    .from('ai_messages')
    .select('id, user_id, conversation_id, role, content, created_at')
    .eq('user_id', uid)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingTableError(error)) {
      return { messages: [], storageAvailable: false, found: true };
    }
    handleSupabaseDbError(error, 'Gagal memuat pesan percakapan.');
  }

  return {
    messages: (data || []).map(mapAiMessageRow),
    storageAvailable: true,
    found: true,
  };
}

export async function sbCreateAiConversation(
  supabase: SupabaseClient,
  uid: string,
  title: string
) {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({
      user_id: uid,
      title,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('id, user_id, title, created_at, updated_at')
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      return { conversation: null, storageAvailable: false };
    }
    handleSupabaseDbError(error, 'Gagal membuat percakapan baru.');
  }
  return {
    conversation: mapAiConversationRow(data),
    storageAvailable: true,
  };
}

export async function sbAppendAiMessages(
  supabase: SupabaseClient,
  uid: string,
  conversationId: string,
  userContent: string,
  assistantContent: string
) {
  const nowMs = Date.now();
  const userIso = new Date(nowMs).toISOString();
  const assistantIso = new Date(nowMs + 1).toISOString();

  const { data: inserted, error: insertErr } = await supabase
    .from('ai_messages')
    .insert([
      {
        user_id: uid,
        conversation_id: conversationId,
        role: 'user',
        content: userContent,
        created_at: userIso,
      },
      {
        user_id: uid,
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantContent,
        created_at: assistantIso,
      },
    ])
    .select('id, user_id, conversation_id, role, content, created_at');

  if (insertErr) {
    if (isMissingTableError(insertErr)) {
      return { messages: [], storageAvailable: false };
    }
    handleSupabaseDbError(insertErr, 'Gagal menyimpan pesan percakapan.');
  }

  await supabase
    .from('ai_conversations')
    .update({ updated_at: assistantIso })
    .eq('id', conversationId)
    .eq('user_id', uid);

  const sorted = (inserted || []).map(mapAiMessageRow).sort((a, b) => {
    const timeDiff =
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.role === 'user' && b.role === 'assistant' ? -1 : 1;
  });

  return {
    messages: sorted,
    storageAvailable: true,
  };
}

export async function sbDeleteAiConversation(
  supabase: SupabaseClient,
  uid: string,
  conversationId: string
) {
  const { error: msgErr } = await supabase
    .from('ai_messages')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', uid);

  if (msgErr && !isMissingTableError(msgErr)) {
    handleSupabaseDbError(msgErr, 'Gagal menghapus pesan percakapan.');
  }

  const { data, error } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', uid)
    .select('id, user_id, title, created_at, updated_at')
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return { deleted: null, storageAvailable: false };
    }
    handleSupabaseDbError(error, 'Gagal menghapus percakapan.');
  }
  return {
    deleted: data ? mapAiConversationRow(data) : null,
    storageAvailable: true,
  };
}

