import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  Camera,
  Layers,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react';
import type { CurrencyCode, Trade } from '../types.ts';
import type { TradingAnalytics } from '../utils/analytics.ts';
import {
  formatCurrency,
  formatPrice,
  formatShortDateId,
  getTodayIsoDate,
} from '../utils/formatters.ts';

interface DashboardViewProps {
  analytics: TradingAnalytics;
  currency: CurrencyCode;
  trades: Trade[];
  compactCards?: boolean;
  traderName?: string;
  userEmail?: string;
  accountName?: string;
  onAddTrade: () => void;
  onInspectTrade: (trade: Trade) => void;
  onNavigateToJournal: () => void;
  onNavigateToProfile?: () => void;
}

export function DashboardView({
  analytics,
  currency,
  trades,
  compactCards = false,
  traderName,
  userEmail = '',
  accountName,
  onAddTrade,
  onInspectTrade,
  onNavigateToJournal,
  onNavigateToProfile,
}: DashboardViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const todayIso = getTodayIsoDate();

  const todayStats = useMemo(() => {
    const todayTrades = trades.filter((t) => t.tradeDate === todayIso);
    const todayVolume = todayTrades.reduce((sum, t) => sum + (t.lotSize || 0), 0);
    const totalVolume = trades.reduce((sum, t) => sum + (t.lotSize || 0), 0);
    return {
      todayCount: todayTrades.length,
      todayVolume,
      totalVolume,
    };
  }, [trades, todayIso]);

  const dailyChartData = useMemo(() => {
    const dayTotals = new Map<string, number>();
    for (const t of trades) {
      if (t.status === 'OPEN') continue;
      dayTotals.set(t.tradeDate, (dayTotals.get(t.tradeDate) || 0) + t.netPl);
    }
    return Array.from(dayTotals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-10)
      .map(([date, netPl]) => ({
        date,
        label: formatShortDateId(date).split(' ').slice(0, 2).join(' '),
        netPl,
      }));
  }, [trades]);

  const recentTrades = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q
      ? trades.filter((t) => {
          const hay = `${t.pair} ${t.direction} ${t.strategy} ${t.session} ${t.status} ${t.notes}`.toLowerCase();
          return hay.includes(q);
        })
      : trades;
    return list.slice(0, 7);
  }, [trades, searchQuery]);

  const displayName = traderName?.trim() || userEmail.split('@')[0] || 'Trader';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  const todayFormatted = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date());
    } catch {
      return formatShortDateId(todayIso);
    }
  }, [todayIso]);

  const cardPadding = compactCards ? 'p-4' : 'p-4 sm:p-5';
  const decidedCount = analytics.winCount + analytics.lossCount;
  const winBarPercent =
    decidedCount > 0 ? Math.round((analytics.winCount / decidedCount) * 100) : 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Top Greeting & Portfolio Balance Glass Card */}
      <section className="glass-card rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Greeting + Avatar + Date */}
          <div className="flex items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <button
                type="button"
                onClick={onNavigateToProfile}
                className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0D7A72] to-[#14B8A6] text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-[0_8px_20px_rgba(13,122,114,0.24)] cursor-pointer active:scale-95 transition-transform"
                title="Buka profil & pengaturan"
              >
                {initials || 'TR'}
              </button>
              <div className="min-w-0">
                <div className="text-xs font-medium text-[#52625D]">
                  {todayFormatted}
                  {accountName ? ` · ${accountName}` : ''}
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-[#1A2421] tracking-tight truncate">
                  Welcome back, {displayName}!
                </h2>
                <p className="text-xs sm:text-sm text-[#52625D] mt-0.5">
                  Let&apos;s review your trading performance today.
                </p>
              </div>
            </div>
          </div>

          {/* Primary Balance & Net P/L Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-[#1A2421]/10 lg:pl-6 shrink-0">
            <div>
              <div className="text-[11px] font-medium text-[#52625D]">
                Saldo Berjalan
              </div>
              <div className="mt-1 text-lg sm:text-xl font-mono font-bold tabular-nums text-[#1A2421]">
                {formatCurrency(analytics.currentBalance, currency)}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-[#52625D]">
                Awal: {formatCurrency(analytics.initialBalance, currency, { compact: true })}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-medium text-[#52625D]">
                Total Profit / Loss
              </div>
              <div
                className={`mt-1 text-lg sm:text-xl font-mono font-bold tabular-nums ${
                  analytics.totalProfit >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                }`}
              >
                {formatCurrency(analytics.totalProfit, currency, { signed: true })}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-[#52625D]">
                {analytics.growthPercent >= 0 ? '+' : ''}
                {analytics.growthPercent.toFixed(2)}% growth
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <div className="text-[11px] font-medium text-[#52625D]">
                Profit Bulan Ini
              </div>
              <div
                className={`mt-1 text-lg sm:text-xl font-mono font-bold tabular-nums ${
                  analytics.monthProfit >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                }`}
              >
                {formatCurrency(analytics.monthProfit, currency, { signed: true })}
              </div>
              <div className="text-[11px] text-[#52625D]">
                {analytics.closedTradesCount} trade selesai
              </div>
            </div>
          </div>
        </div>

        {/* Rounded Glass Search Bar */}
        <div className="mt-5 relative">
          <Search className="w-4 h-4 text-[#52625D] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari transaksi terbaru berdasarkan pair, strategi, atau sesi..."
            className="w-full min-h-[46px] glass-input rounded-2xl pl-11 pr-10 py-2.5 text-sm placeholder:text-[#6B7C76]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Hapus pencarian"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-[#52625D] hover:bg-[#1A2421]/8 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </section>

      {/* Section 1: Today's Performance */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-[#1A2421]">
            Today&apos;s Performance
          </h3>
          <span className="text-xs text-[#52625D]">
            {formatShortDateId(todayIso)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {/* Daily P/L */}
          <div className={`glass-card rounded-[24px] ${cardPadding}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#52625D]">
                Daily Profit / Loss
              </span>
              <span
                className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                  analytics.todayProfit >= 0
                    ? 'bg-[#16A34A]/12 text-[#15803D]'
                    : 'bg-[#DC2626]/12 text-[#B91C1C]'
                }`}
              >
                {analytics.todayProfit >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
              </span>
            </div>
            <div
              className={`mt-2.5 text-2xl font-mono font-bold tabular-nums truncate ${
                analytics.todayProfit >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
              }`}
            >
              {formatCurrency(analytics.todayProfit, currency, { signed: true })}
            </div>
            <div className="mt-1 text-xs text-[#52625D]">
              {todayStats.todayCount} transaksi hari ini
            </div>
          </div>

          {/* Total Trades */}
          <div className={`glass-card rounded-[24px] ${cardPadding}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#52625D]">Total Trades</span>
              <span className="w-9 h-9 rounded-2xl bg-[#D8EFE7] text-[#0D7A72] flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2.5 text-2xl font-mono font-bold tabular-nums text-[#1A2421]">
              {analytics.totalTrades}
            </div>
            <div className="mt-1 text-xs text-[#52625D]">
              {analytics.closedTradesCount} ditutup · {analytics.openTradesCount} berjalan
            </div>
          </div>

          {/* Win Rate */}
          <div className={`glass-card rounded-[24px] ${cardPadding}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#52625D]">Win Rate</span>
              <span className="w-9 h-9 rounded-2xl bg-[#D8EFE7] text-[#0D7A72] flex items-center justify-center shrink-0">
                <Trophy className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2.5 text-2xl font-mono font-bold tabular-nums text-[#1A2421]">
              {analytics.winRate.toFixed(1)}%
            </div>
            <div className="mt-1 text-xs text-[#52625D]">
              {analytics.winCount} WIN · {analytics.lossCount} LOSS · {analytics.beCount} BE
            </div>
          </div>

          {/* Trading Volume */}
          <div className={`glass-card rounded-[24px] ${cardPadding}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#52625D]">
                Trading Volume
              </span>
              <span className="w-9 h-9 rounded-2xl bg-[#D8EFE7] text-[#0D7A72] flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2.5 text-2xl font-mono font-bold tabular-nums text-[#1A2421]">
              {todayStats.totalVolume.toFixed(2)} lot
            </div>
            <div className="mt-1 text-xs text-[#52625D]">
              Hari ini: {todayStats.todayVolume.toFixed(2)} lot
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Trading Performance Charts & Summary */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-[#1A2421]">
            Trading Performance
          </h3>
          <span className="text-xs font-mono tabular-nums text-[#0D7A72] font-medium">
            Profit Factor {analytics.profitFactor.toFixed(2)}
          </span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* Equity Curve */}
          <div className="xl:col-span-7 glass-card rounded-[26px] p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h4 className="text-sm font-semibold text-[#1A2421]">
                  Kurva Equity
                </h4>
                <p className="text-xs text-[#52625D] mt-0.5">
                  Pertumbuhan saldo berdasarkan transaksi tertutup
                </p>
              </div>
              <div className="text-xs font-mono font-semibold tabular-nums text-[#0D7A72]">
                Max DD: -{formatCurrency(analytics.maxDrawdownAmount, currency)} (
                {analytics.maxDrawdownPercent.toFixed(2)}%)
              </div>
            </div>

            <div className="h-60 sm:h-68 w-full">
              {analytics.equityCurve.length <= 1 ? (
                <div className="h-full flex flex-col items-center justify-center text-center border border-dashed border-[#1A2421]/15 rounded-2xl p-6 bg-white/35">
                  <p className="text-sm text-[#1A2421] font-semibold">
                    Belum ada data kurva equity
                  </p>
                  <p className="text-xs text-[#52625D] mt-1 max-w-xs">
                    Catat transaksi pertama yang sudah ditutup untuk melihat kurva pertumbuhan akun Anda.
                  </p>
                  <button
                    type="button"
                    onClick={onAddTrade}
                    className="mt-4 min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#0D7A72] hover:bg-[#095E58] text-white text-xs font-semibold cursor-pointer active:scale-95 transition-transform"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Catat Transaksi</span>
                  </button>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={analytics.equityCurve}
                    margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="equitySageTeal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0D7A72" stopOpacity={0.26} />
                        <stop offset="95%" stopColor="#0D7A72" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(26, 36, 33, 0.08)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      stroke="#52625D"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#52625D"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={74}
                      domain={['auto', 'auto']}
                      tickFormatter={(val) =>
                        formatCurrency(Number(val), currency, { compact: true })
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.94)',
                        borderColor: 'rgba(255, 255, 255, 0.9)',
                        borderRadius: '16px',
                        fontSize: '12px',
                        color: '#1A2421',
                        boxShadow: '0 8px 24px rgba(16, 40, 34, 0.12)',
                      }}
                      formatter={(value: any) => [
                        formatCurrency(Number(value), currency),
                        'Saldo Equity',
                      ]}
                      labelFormatter={(_, payload) => {
                        const pt = payload?.[0]?.payload;
                        if (!pt) return '';
                        return `${pt.label} · ${formatShortDateId(pt.date)} (${pt.pair})`;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke="#0D7A72"
                      strokeWidth={2.5}
                      fill="url(#equitySageTeal)"
                      activeDot={{ r: 5, fill: '#0D7A72', stroke: '#FFFFFF', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Daily Profit / Loss + Win/Loss Summary */}
          <div className="xl:col-span-5 glass-card rounded-[26px] p-5 flex flex-col justify-between gap-5">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-[#1A2421]">
                    Profit / Loss Harian
                  </h4>
                  <p className="text-xs text-[#52625D] mt-0.5">
                    10 hari trading terakhir
                  </p>
                </div>
                <BarChart2 className="w-4 h-4 text-[#0D7A72]" />
              </div>

              <div className="h-44 w-full">
                {dailyChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center border border-dashed border-[#1A2421]/15 rounded-2xl p-4 bg-white/35 text-xs text-[#52625D]">
                    Grafik harian akan muncul setelah ada transaksi ditutup.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dailyChartData}
                      margin={{ top: 6, right: 6, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(26, 36, 33, 0.08)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        stroke="#52625D"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#52625D"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        width={62}
                        tickFormatter={(val) =>
                          formatCurrency(Number(val), currency, { compact: true })
                        }
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.94)',
                          borderColor: 'rgba(255, 255, 255, 0.9)',
                          borderRadius: '14px',
                          fontSize: '12px',
                          color: '#1A2421',
                          boxShadow: '0 8px 24px rgba(16, 40, 34, 0.12)',
                        }}
                        formatter={(value: any) => [
                          formatCurrency(Number(value), currency, { signed: true }),
                          'Net P/L',
                        ]}
                      />
                      <Bar dataKey="netPl" radius={[8, 8, 8, 8]} maxBarSize={32}>
                        {dailyChartData.map((entry) => (
                          <Cell
                            key={entry.date}
                            fill={entry.netPl >= 0 ? '#16A34A' : '#DC2626'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Win / Loss Indicator & Key Ratios */}
            <div className="pt-4 border-t border-[#1A2421]/10 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#1A2421]">Win / Loss Ratio</span>
                <span className="font-mono tabular-nums text-[#52625D]">
                  <strong className="text-[#15803D]">{analytics.winCount}W</strong> ·{' '}
                  <strong className="text-[#B91C1C]">{analytics.lossCount}L</strong>
                </span>
              </div>

              <div className="h-2.5 w-full rounded-full bg-[#DC2626]/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#16A34A] transition-all duration-300"
                  style={{ width: `${decidedCount > 0 ? winBarPercent : 50}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div>
                  <div className="text-[11px] text-[#52625D]">Avg R:R</div>
                  <div className="text-xs sm:text-sm font-mono font-semibold tabular-nums text-[#1A2421]">
                    1 : {analytics.avgRiskReward.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#52625D]">Expectancy</div>
                  <div
                    className={`text-xs sm:text-sm font-mono font-semibold tabular-nums ${
                      analytics.expectancy >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                    }`}
                  >
                    {formatCurrency(analytics.expectancy, currency, {
                      signed: true,
                      compact: true,
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#52625D]">Loss Rate</div>
                  <div className="text-xs sm:text-sm font-mono font-semibold tabular-nums text-[#1A2421]">
                    {analytics.lossRate.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Recent Trades */}
      <section className="glass-card rounded-[26px] overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-4 border-b border-[#1A2421]/8">
          <div>
            <h3 className="text-sm font-bold text-[#1A2421]">Recent Trades</h3>
            <p className="text-xs text-[#52625D] mt-0.5">
              {searchQuery
                ? `Hasil pencarian untuk "${searchQuery}"`
                : 'Ketuk posisi untuk melihat analisa entry dan screenshot chart'}
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateToJournal}
            className="min-h-[38px] inline-flex items-center text-xs font-semibold text-[#0D7A72] hover:text-[#095E58] cursor-pointer whitespace-nowrap self-start sm:self-auto active:scale-95 transition-transform"
          >
            Lihat Semua Jurnal
          </button>
        </div>

        {recentTrades.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-[#1A2421]">
              {searchQuery
                ? 'Tidak ada transaksi yang cocok'
                : 'Belum ada transaksi pada akun ini'}
            </p>
            <p className="text-xs text-[#52625D] mt-1">
              {searchQuery
                ? 'Coba kata kunci lain atau hapus pencarian di atas.'
                : 'Mulai catat setup pertama Anda untuk membangun riwayat performa yang akurat.'}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={onAddTrade}
                className="mt-4 min-h-[44px] inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-[#0D7A72] hover:bg-[#095E58] text-white text-xs font-semibold cursor-pointer active:scale-95 transition-transform"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Transaksi Pertama</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Clean List Rows */}
            <div className="md:hidden divide-y divide-[#1A2421]/8">
              {recentTrades.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onInspectTrade(t)}
                  className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-white/45 active:bg-white/65 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                        t.direction === 'BUY'
                          ? 'bg-[#16A34A]/12 text-[#15803D]'
                          : 'bg-[#DC2626]/12 text-[#B91C1C]'
                      }`}
                    >
                      {t.direction === 'BUY' ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#1A2421]">
                          {t.pair}
                        </span>
                        <span
                          className={`text-[11px] font-semibold ${
                            t.direction === 'BUY'
                              ? 'text-[#15803D]'
                              : 'text-[#B91C1C]'
                          }`}
                        >
                          {t.direction}
                        </span>
                        {(t.screenshotCount || 0) > 0 && (
                          <Camera className="w-3.5 h-3.5 text-[#0D7A72]" />
                        )}
                      </div>
                      <div className="text-xs text-[#52625D] font-mono tabular-nums truncate mt-0.5">
                        {formatShortDateId(t.tradeDate)} · {t.tradeTime} ·{' '}
                        {t.lotSize.toFixed(2)} lot
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`text-sm font-mono font-bold tabular-nums ${
                        t.netPl > 0
                          ? 'text-[#15803D]'
                          : t.netPl < 0
                          ? 'text-[#B91C1C]'
                          : 'text-[#52625D]'
                      }`}
                    >
                      {t.status === 'OPEN'
                        ? 'OPEN'
                        : formatCurrency(t.netPl, currency, { signed: true })}
                    </div>
                    <div className="text-[11px] font-mono font-medium text-[#52625D]">
                      {t.status}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Desktop Sleek Glass Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1A2421]/8 text-[11px] font-semibold text-[#52625D] bg-white/35">
                    <th className="py-3 px-5">Waktu &amp; Tanggal</th>
                    <th className="py-3 px-4">Pair</th>
                    <th className="py-3 px-4">Posisi</th>
                    <th className="py-3 px-4 text-right">Lot</th>
                    <th className="py-3 px-4 text-right">Entry</th>
                    <th className="py-3 px-4 text-right">Exit</th>
                    <th className="py-3 px-4">Strategi · Sesi</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-5 text-right">Net P/L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2421]/8 text-xs">
                  {recentTrades.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => onInspectTrade(t)}
                      className="hover:bg-white/45 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-5 font-mono tabular-nums text-[#1A2421] whitespace-nowrap">
                        {formatShortDateId(t.tradeDate)}
                        <span className="text-[#52625D] ml-1.5">{t.tradeTime}</span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#1A2421] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{t.pair}</span>
                          {(t.screenshotCount || 0) > 0 && (
                            <Camera className="w-3.5 h-3.5 text-[#0D7A72]" />
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            t.direction === 'BUY' ? 'text-[#15803D]' : 'text-[#B91C1C]'
                          }`}
                        >
                          {t.direction === 'BUY' ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          )}
                          {t.direction}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#1A2421]">
                        {t.lotSize.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#1A2421]">
                        {formatPrice(t.entryPrice, t.pair)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#52625D]">
                        {formatPrice(t.exitPrice, t.pair)}
                      </td>
                      <td className="py-3.5 px-4 text-[#52625D] whitespace-nowrap">
                        <span className="text-[#1A2421]">{t.strategy || '—'}</span>
                        <span className="mx-1.5">·</span>
                        <span>{t.session}</span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`font-mono font-semibold ${
                            t.status === 'WIN'
                              ? 'text-[#15803D]'
                              : t.status === 'LOSS'
                              ? 'text-[#B91C1C]'
                              : t.status === 'BE'
                              ? 'text-[#52625D]'
                              : 'text-amber-700'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td
                        className={`py-3.5 px-5 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                          t.netPl > 0
                            ? 'text-[#15803D]'
                            : t.netPl < 0
                            ? 'text-[#B91C1C]'
                            : 'text-[#52625D]'
                        }`}
                      >
                        {t.status === 'OPEN'
                          ? 'Berjalan'
                          : formatCurrency(t.netPl, currency, { signed: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
