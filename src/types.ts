export type CurrencyCode = 'IDR' | 'USD' | 'USC';
export type TradeDirection = 'BUY' | 'SELL';
export type TradeStatus = 'WIN' | 'LOSS' | 'BE' | 'OPEN';
export type ScreenshotStage = 'BEFORE' | 'DURING' | 'AFTER';

export type AppPage =
  | 'dashboard'
  | 'journal'
  | 'calendar'
  | 'analytics'
  | 'more'
  | 'history'
  | 'settings';

export type HistoryTab = 'trades' | 'reviews' | 'reports';

export type SettingsSection =
  | 'profile'
  | 'accounts'
  | 'currency'
  | 'preferences'
  | 'security';

export interface AppPreferences {
  defaultSession: string;
  defaultLotSize: string;
  enableAnimations: boolean;
  compactCards: boolean;
}

export interface Profile {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  traderStyle: string;
}

export interface TradingAccount {
  id: number;
  userId: string;
  name: string;
  broker: string;
  currency: CurrencyCode;
  initialBalance: number;
  isActive: boolean;
  createdAt: string;
}

export interface Trade {
  id: number;
  userId: string;
  accountId: number;
  tradeDate: string;
  tradeTime: string;
  pair: string;
  direction: TradeDirection;
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number;
  takeProfit: number;
  lotSize: number;
  status: TradeStatus;
  grossPl: number;
  commission: number;
  swap: number;
  netPl: number;
  strategy: string;
  session: string;
  emotion: string;
  entryReason: string;
  notes: string;
  screenshotCount?: number;
  createdAt?: string;
}

export interface TradeScreenshot {
  id: number;
  userId: string;
  tradeId: number;
  stage: ScreenshotStage;
  fileName: string;
  mimeType: string;
  imageData: string;
  caption: string;
  createdAt: string;
}

export interface DailyReview {
  id: number;
  userId: string;
  accountId: number;
  reviewDate: string;
  emotionalState: string;
  disciplineScore: number;
  mistakes: string;
  dailyReflection: string;
  progressNotes: string;
  createdAt: string;
}
