import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const profiles = pgTable('profiles', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name').notNull().default(''),
  traderStyle: text('trader_style').notNull().default('Inner Circle Trader'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tradingAccounts = pgTable('trading_accounts', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  broker: text('broker').notNull().default(''),
  currency: text('currency').notNull().default('USD'), // 'IDR' | 'USD' | 'USC'
  initialBalance: doublePrecision('initial_balance').notNull().default(10000),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const trades = pgTable('trades', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  accountId: integer('account_id')
    .references(() => tradingAccounts.id, { onDelete: 'cascade' })
    .notNull(),
  tradeDate: text('trade_date').notNull(), // YYYY-MM-DD
  tradeTime: text('trade_time').notNull().default('09:00'), // HH:mm
  pair: text('pair').notNull(),
  direction: text('direction').notNull(), // 'BUY' | 'SELL'
  entryPrice: doublePrecision('entry_price').notNull(),
  exitPrice: doublePrecision('exit_price'),
  stopLoss: doublePrecision('stop_loss').notNull(),
  takeProfit: doublePrecision('take_profit').notNull(),
  lotSize: doublePrecision('lot_size').notNull(),
  status: text('status').notNull(), // 'WIN' | 'LOSS' | 'BE' | 'OPEN'
  grossPl: doublePrecision('gross_pl').notNull().default(0),
  commission: doublePrecision('commission').notNull().default(0),
  swap: doublePrecision('swap').notNull().default(0),
  netPl: doublePrecision('net_pl').notNull().default(0),
  strategy: text('strategy').notNull().default(''),
  session: text('session').notNull().default('London'), // 'Asia' | 'London' | 'New York' | 'Overlap'
  emotion: text('emotion').notNull().default('Tenang'),
  entryReason: text('entry_reason').notNull().default(''),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tradeScreenshots = pgTable('trade_screenshots', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  tradeId: integer('trade_id')
    .references(() => trades.id, { onDelete: 'cascade' })
    .notNull(),
  stage: text('stage').notNull(), // 'BEFORE' | 'DURING' | 'AFTER'
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  imageData: text('image_data').notNull(),
  caption: text('caption').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const dailyReviews = pgTable('daily_reviews', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  accountId: integer('account_id')
    .references(() => tradingAccounts.id, { onDelete: 'cascade' })
    .notNull(),
  reviewDate: text('review_date').notNull(), // YYYY-MM-DD
  emotionalState: text('emotional_state').notNull(),
  disciplineScore: integer('discipline_score').notNull().default(8),
  mistakes: text('mistakes').notNull().default(''),
  dailyReflection: text('daily_reflection').notNull().default(''),
  progressNotes: text('progress_notes').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tradingAccountsRelations = relations(tradingAccounts, ({ many }) => ({
  trades: many(trades),
  dailyReviews: many(dailyReviews),
}));

export const tradesRelations = relations(trades, ({ one, many }) => ({
  account: one(tradingAccounts, {
    fields: [trades.accountId],
    references: [tradingAccounts.id],
  }),
  screenshots: many(tradeScreenshots),
}));

export const tradeScreenshotsRelations = relations(tradeScreenshots, ({ one }) => ({
  trade: one(trades, {
    fields: [tradeScreenshots.tradeId],
    references: [trades.id],
  }),
}));

export const dailyReviewsRelations = relations(dailyReviews, ({ one }) => ({
  account: one(tradingAccounts, {
    fields: [dailyReviews.accountId],
    references: [tradingAccounts.id],
  }),
}));
