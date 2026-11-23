-- MANSYR404 Trading Journal — Supabase PostgreSQL Schema
-- Jalankan skrip ini pada Supabase Dashboard -> SQL Editor jika tabel belum dibuat.
-- Skrip ini aman dijalankan berulang kali (tidak menghapus tabel atau data yang sudah ada).

CREATE TABLE IF NOT EXISTS public.profiles (
  id BIGSERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  trader_style TEXT NOT NULL DEFAULT 'Inner Circle Trader',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.trading_accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  broker TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'USD',
  initial_balance DOUBLE PRECISION NOT NULL DEFAULT 10000,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.trades (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id BIGINT NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  trade_date TEXT NOT NULL,
  trade_time TEXT NOT NULL DEFAULT '09:00',
  pair TEXT NOT NULL,
  direction TEXT NOT NULL,
  entry_price DOUBLE PRECISION NOT NULL,
  exit_price DOUBLE PRECISION,
  stop_loss DOUBLE PRECISION NOT NULL,
  take_profit DOUBLE PRECISION NOT NULL,
  lot_size DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL,
  gross_pl DOUBLE PRECISION NOT NULL DEFAULT 0,
  commission DOUBLE PRECISION NOT NULL DEFAULT 0,
  swap DOUBLE PRECISION NOT NULL DEFAULT 0,
  net_pl DOUBLE PRECISION NOT NULL DEFAULT 0,
  strategy TEXT NOT NULL DEFAULT '',
  session TEXT NOT NULL DEFAULT 'London',
  emotion TEXT NOT NULL DEFAULT 'Tenang',
  entry_reason TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.trade_screenshots (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  trade_id BIGINT NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  image_data TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.daily_reviews (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id BIGINT NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  review_date TEXT NOT NULL,
  emotional_state TEXT NOT NULL,
  discipline_score INTEGER NOT NULL DEFAULT 8,
  mistakes TEXT NOT NULL DEFAULT '',
  daily_reflection TEXT NOT NULL DEFAULT '',
  progress_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indeks untuk mempercepat query per pengguna & akun
CREATE INDEX IF NOT EXISTS idx_trading_accounts_user_id ON public.trading_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_account ON public.trades(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_trade_screenshots_trade ON public.trade_screenshots(user_id, trade_id);
CREATE INDEX IF NOT EXISTS idx_daily_reviews_user_account ON public.daily_reviews(user_id, account_id);

-- Aktifkan Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reviews ENABLE ROW LEVEL SECURITY;

-- Kebijakan akses per pengguna (idempoten)
DROP POLICY IF EXISTS "Users manage own profile" ON public.profiles;
CREATE POLICY "Users manage own profile"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = uid)
  WITH CHECK (auth.uid()::text = uid);

DROP POLICY IF EXISTS "Users manage own trading accounts" ON public.trading_accounts;
CREATE POLICY "Users manage own trading accounts"
  ON public.trading_accounts
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users manage own trades" ON public.trades;
CREATE POLICY "Users manage own trades"
  ON public.trades
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users manage own trade screenshots" ON public.trade_screenshots;
CREATE POLICY "Users manage own trade screenshots"
  ON public.trade_screenshots
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users manage own daily reviews" ON public.daily_reviews;
CREATE POLICY "Users manage own daily reviews"
  ON public.daily_reviews
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);
