import type { Trade } from '../types.ts';
import {
  computePlannedRR,
  formatMonthKeyId,
  getCurrentMonthPrefix,
  getTodayIsoDate,
} from './formatters.ts';

export interface EquityPoint {
  label: string;
  date: string;
  pair: string;
  tradePl: number;
  balance: number;
}

export interface MonthlyPoint {
  monthKey: string;
  label: string;
  netPl: number;
  tradeCount: number;
  wins: number;
}

export interface GroupPerformance {
  name: string;
  total: number;
  wins: number;
  losses: number;
  be: number;
  winRate: number;
  profitFactor: number;
  netPl: number;
  expectancy: number;
}

export interface TradingAnalytics {
  initialBalance: number;
  currentBalance: number;
  totalProfit: number;
  growthPercent: number;
  todayProfit: number;
  monthProfit: number;
  totalTrades: number;
  closedTradesCount: number;
  openTradesCount: number;
  winCount: number;
  lossCount: number;
  beCount: number;
  winRate: number;
  lossRate: number;
  profitFactor: number;
  avgRiskReward: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  maxDrawdownAmount: number;
  maxDrawdownPercent: number;
  bestDay: { date: string; netPl: number } | null;
  worstDay: { date: string; netPl: number } | null;
  equityCurve: EquityPoint[];
  monthlyPerformance: MonthlyPoint[];
  byDirection: GroupPerformance[];
  byPair: GroupPerformance[];
  byStrategy: GroupPerformance[];
  bySession: GroupPerformance[];
}

function summarizeGroup(name: string, items: Trade[]): GroupPerformance {
  const closed = items.filter((t) => t.status !== 'OPEN');
  const wins = closed.filter((t) => t.status === 'WIN');
  const losses = closed.filter((t) => t.status === 'LOSS');
  const be = closed.filter((t) => t.status === 'BE');

  const decided = wins.length + losses.length;
  const winRate = decided > 0 ? (wins.length / decided) * 100 : 0;

  const grossWins = closed
    .filter((t) => t.netPl > 0)
    .reduce((acc, t) => acc + t.netPl, 0);
  const grossLosses = Math.abs(
    closed.filter((t) => t.netPl < 0).reduce((acc, t) => acc + t.netPl, 0)
  );

  const profitFactor =
    grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? grossWins : 0;
  const netPl = closed.reduce((acc, t) => acc + t.netPl, 0);
  const expectancy = closed.length > 0 ? netPl / closed.length : 0;

  return {
    name,
    total: closed.length,
    wins: wins.length,
    losses: losses.length,
    be: be.length,
    winRate,
    profitFactor,
    netPl,
    expectancy,
  };
}

export function calculateAnalytics(
  trades: Trade[],
  initialBalance: number
): TradingAnalytics {
  const todayStr = getTodayIsoDate();
  const monthPrefix = getCurrentMonthPrefix();

  const sortedAsc = [...trades].sort((a, b) => {
    const cmpDate = a.tradeDate.localeCompare(b.tradeDate);
    if (cmpDate !== 0) return cmpDate;
    const cmpTime = (a.tradeTime || '').localeCompare(b.tradeTime || '');
    if (cmpTime !== 0) return cmpTime;
    return a.id - b.id;
  });

  const closedTrades = sortedAsc.filter((t) => t.status !== 'OPEN');
  const openTrades = sortedAsc.filter((t) => t.status === 'OPEN');

  const winTrades = closedTrades.filter((t) => t.status === 'WIN');
  const lossTrades = closedTrades.filter((t) => t.status === 'LOSS');
  const beTrades = closedTrades.filter((t) => t.status === 'BE');

  const totalProfit = closedTrades.reduce((acc, t) => acc + t.netPl, 0);
  const currentBalance = initialBalance + totalProfit;
  const growthPercent =
    initialBalance > 0 ? (totalProfit / initialBalance) * 100 : 0;

  const todayProfit = closedTrades
    .filter((t) => t.tradeDate === todayStr)
    .reduce((acc, t) => acc + t.netPl, 0);

  const monthProfit = closedTrades
    .filter((t) => t.tradeDate.startsWith(monthPrefix))
    .reduce((acc, t) => acc + t.netPl, 0);

  const decidedCount = winTrades.length + lossTrades.length;
  const winRate = decidedCount > 0 ? (winTrades.length / decidedCount) * 100 : 0;
  const lossRate = decidedCount > 0 ? (lossTrades.length / decidedCount) * 100 : 0;

  const totalGrossProfit = closedTrades
    .filter((t) => t.netPl > 0)
    .reduce((acc, t) => acc + t.netPl, 0);
  const totalGrossLoss = Math.abs(
    closedTrades.filter((t) => t.netPl < 0).reduce((acc, t) => acc + t.netPl, 0)
  );

  const profitFactor =
    totalGrossLoss > 0
      ? totalGrossProfit / totalGrossLoss
      : totalGrossProfit > 0
      ? totalGrossProfit
      : 0;

  const avgWin =
    winTrades.length > 0
      ? winTrades.reduce((acc, t) => acc + t.netPl, 0) / winTrades.length
      : 0;
  const avgLoss =
    lossTrades.length > 0
      ? Math.abs(lossTrades.reduce((acc, t) => acc + t.netPl, 0)) / lossTrades.length
      : 0;

  const winProb = decidedCount > 0 ? winTrades.length / decidedCount : 0;
  const lossProb = decidedCount > 0 ? lossTrades.length / decidedCount : 0;
  const expectancy =
    decidedCount > 0 ? winProb * avgWin - lossProb * avgLoss : 0;

  // Average planned R:R across all trades with valid SL/TP
  const rrValues: number[] = [];
  for (const t of trades) {
    const rr = computePlannedRR(t.direction, t.entryPrice, t.stopLoss, t.takeProfit);
    if (rr !== null && Number.isFinite(rr)) {
      rrValues.push(rr);
    }
  }
  const avgRiskReward =
    rrValues.length > 0
      ? rrValues.reduce((acc, v) => acc + v, 0) / rrValues.length
      : 0;

  // Equity curve and maximum drawdown
  const equityCurve: EquityPoint[] = [
    {
      label: 'Awal',
      date: sortedAsc[0]?.tradeDate || todayStr,
      pair: 'Modal Awal',
      tradePl: 0,
      balance: initialBalance,
    },
  ];

  let runningBalance = initialBalance;
  let peakBalance = initialBalance;
  let maxDrawdownAmount = 0;
  let maxDrawdownPercent = 0;

  closedTrades.forEach((t, idx) => {
    runningBalance += t.netPl;
    if (runningBalance > peakBalance) {
      peakBalance = runningBalance;
    }
    const ddAmount = peakBalance - runningBalance;
    const ddPct = peakBalance > 0 ? (ddAmount / peakBalance) * 100 : 0;
    if (ddAmount > maxDrawdownAmount) {
      maxDrawdownAmount = ddAmount;
    }
    if (ddPct > maxDrawdownPercent) {
      maxDrawdownPercent = ddPct;
    }
    equityCurve.push({
      label: `#${idx + 1}`,
      date: t.tradeDate,
      pair: t.pair,
      tradePl: t.netPl,
      balance: runningBalance,
    });
  });

  // Daily aggregation for Best & Worst Trading Day
  const dayTotals = new Map<string, number>();
  for (const t of closedTrades) {
    dayTotals.set(t.tradeDate, (dayTotals.get(t.tradeDate) || 0) + t.netPl);
  }
  let bestDay: { date: string; netPl: number } | null = null;
  let worstDay: { date: string; netPl: number } | null = null;
  for (const [date, netPl] of dayTotals.entries()) {
    if (!bestDay || netPl > bestDay.netPl) {
      bestDay = { date, netPl };
    }
    if (!worstDay || netPl < worstDay.netPl) {
      worstDay = { date, netPl };
    }
  }

  // Monthly aggregation
  const monthMap = new Map<string, { netPl: number; count: number; wins: number }>();
  for (const t of closedTrades) {
    const key = t.tradeDate.slice(0, 7);
    const curr = monthMap.get(key) || { netPl: 0, count: 0, wins: 0 };
    curr.netPl += t.netPl;
    curr.count += 1;
    if (t.status === 'WIN') curr.wins += 1;
    monthMap.set(key, curr);
  }
  const monthlyPerformance: MonthlyPoint[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, val]) => ({
      monthKey,
      label: formatMonthKeyId(monthKey),
      netPl: val.netPl,
      tradeCount: val.count,
      wins: val.wins,
    }));

  // Groupings
  const byDirection: GroupPerformance[] = (['BUY', 'SELL'] as const).map((dir) =>
    summarizeGroup(dir, closedTrades.filter((t) => t.direction === dir))
  );

  const pairNames = Array.from(new Set(closedTrades.map((t) => t.pair))).sort();
  const byPair = pairNames
    .map((p) => summarizeGroup(p, closedTrades.filter((t) => t.pair === p)))
    .sort((a, b) => b.netPl - a.netPl);

  const strategyNames = Array.from(
    new Set(closedTrades.map((t) => t.strategy.trim() || 'Tanpa Strategi'))
  );
  const byStrategy = strategyNames
    .map((s) =>
      summarizeGroup(
        s,
        closedTrades.filter(
          (t) => (t.strategy.trim() || 'Tanpa Strategi') === s
        )
      )
    )
    .sort((a, b) => b.netPl - a.netPl);

  const sessionNames = Array.from(
    new Set(closedTrades.map((t) => t.session.trim() || 'Lainnya'))
  );
  const bySession = sessionNames
    .map((ses) =>
      summarizeGroup(
        ses,
        closedTrades.filter((t) => (t.session.trim() || 'Lainnya') === ses)
      )
    )
    .sort((a, b) => b.netPl - a.netPl);

  return {
    initialBalance,
    currentBalance,
    totalProfit,
    growthPercent,
    todayProfit,
    monthProfit,
    totalTrades: trades.length,
    closedTradesCount: closedTrades.length,
    openTradesCount: openTrades.length,
    winCount: winTrades.length,
    lossCount: lossTrades.length,
    beCount: beTrades.length,
    winRate,
    lossRate,
    profitFactor,
    avgRiskReward,
    avgWin,
    avgLoss,
    expectancy,
    maxDrawdownAmount,
    maxDrawdownPercent,
    bestDay,
    worstDay,
    equityCurve,
    monthlyPerformance,
    byDirection,
    byPair,
    byStrategy,
    bySession,
  };
}
