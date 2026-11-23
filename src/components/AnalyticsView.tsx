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
import { motion } from 'motion/react';
import type { CurrencyCode, Trade } from '../types.ts';
import {
  calculateAnalytics,
  type GroupPerformance,
  type TradingAnalytics,
} from '../utils/analytics.ts';
import {
  formatCurrency,
  formatShortDateId,
  getCurrentMonthPrefix,
  getTodayIsoDate,
} from '../utils/formatters.ts';

interface AnalyticsViewProps {
  analytics: TradingAnalytics;
  trades: Trade[];
  initialBalance: number;
  currency: CurrencyCode;
}

type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly' | 'all';

const PERIOD_TABS: Array<{ id: AnalyticsPeriod; label: string }> = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'all', label: 'All Time' },
];

function getCutoffDateIso(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function PerformanceTable({
  title,
  subtitle,
  rows,
  currency,
}: {
  title: string;
  subtitle: string;
  rows: GroupPerformance[];
  currency: CurrencyCode;
}) {
  return (
    <div className="glass-card rounded-[26px] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1A2421]/8">
        <h3 className="text-sm font-bold text-[#1A2421]">{title}</h3>
        <p className="text-xs text-[#52625D] mt-0.5">{subtitle}</p>
      </div>
      {rows.length === 0 ? (
        <div className="p-8 text-center text-xs text-[#52625D]">
          Belum ada transaksi tertutup pada periode ini untuk dianalisis.
        </div>
      ) : (
        <>
          {/* Mobile List */}
          <div className="md:hidden divide-y divide-[#1A2421]/8">
            {rows.map((r) => (
              <div key={r.name} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#1A2421] truncate">
                    {r.name}
                  </div>
                  <div className="text-xs text-[#52625D] font-mono tabular-nums mt-0.5">
                    {r.total} trade · {r.wins}W/{r.losses}L · {r.winRate.toFixed(1)}% WR · PF{' '}
                    {r.profitFactor.toFixed(2)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={`text-sm font-mono font-bold tabular-nums ${
                      r.netPl >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                    }`}
                  >
                    {formatCurrency(r.netPl, currency, { signed: true })}
                  </div>
                  <div className="text-[11px] font-mono text-[#52625D] tabular-nums">
                    Exp: {formatCurrency(r.expectancy, currency, { signed: true, compact: true })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1A2421]/8 text-[11px] font-semibold text-[#52625D] bg-white/35">
                  <th className="py-2.5 px-5">Kategori</th>
                  <th className="py-2.5 px-3 text-right">Transaksi</th>
                  <th className="py-2.5 px-3 text-right">Win / Loss</th>
                  <th className="py-2.5 px-3 text-right">Win Rate</th>
                  <th className="py-2.5 px-3 text-right">Profit Factor</th>
                  <th className="py-2.5 px-3 text-right">Expectancy</th>
                  <th className="py-2.5 px-5 text-right">Net P/L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2421]/8 text-xs">
                {rows.map((r) => (
                  <tr key={r.name} className="hover:bg-white/40">
                    <td className="py-3 px-5 font-semibold text-[#1A2421]">{r.name}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-[#1A2421]">
                      {r.total}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-[#52625D]">
                      <span className="text-[#15803D] font-medium">{r.wins}W</span>
                      <span className="mx-1">/</span>
                      <span className="text-[#B91C1C] font-medium">{r.losses}L</span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-[#1A2421]">
                      {r.winRate.toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-[#52625D]">
                      {r.profitFactor.toFixed(2)}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-mono tabular-nums ${
                        r.expectancy >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                      }`}
                    >
                      {formatCurrency(r.expectancy, currency, { signed: true })}
                    </td>
                    <td
                      className={`py-3 px-5 text-right font-mono font-semibold tabular-nums ${
                        r.netPl >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                      }`}
                    >
                      {formatCurrency(r.netPl, currency, { signed: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export function AnalyticsView({
  analytics: fullAnalytics,
  trades,
  initialBalance,
  currency,
}: AnalyticsViewProps) {
  const [period, setPeriod] = useState<AnalyticsPeriod>('all');

  const filteredTrades = useMemo(() => {
    if (period === 'all') return trades;
    const todayIso = getTodayIsoDate();
    if (period === 'daily') {
      return trades.filter((t) => t.tradeDate === todayIso);
    }
    if (period === 'weekly') {
      const weekStart = getCutoffDateIso(6);
      return trades.filter((t) => t.tradeDate >= weekStart);
    }
    const monthPrefix = getCurrentMonthPrefix();
    return trades.filter((t) => t.tradeDate.startsWith(monthPrefix));
  }, [trades, period]);

  const activeAnalytics = useMemo(() => {
    if (period === 'all') return fullAnalytics;
    return calculateAnalytics(filteredTrades, initialBalance);
  }, [period, fullAnalytics, filteredTrades, initialBalance]);

  const coreMetrics = [
    {
      label: 'Win Rate',
      value: `${activeAnalytics.winRate.toFixed(2)}%`,
      sub: `${activeAnalytics.winCount} WIN · ${activeAnalytics.lossCount} LOSS`,
      tone: 'neutral',
    },
    {
      label: 'Profit Factor',
      value: activeAnalytics.profitFactor.toFixed(2),
      sub: activeAnalytics.profitFactor >= 1.5 ? 'Rasio sehat' : 'Perlu evaluasi',
      tone: 'neutral',
    },
    {
      label: 'Total Profit / Loss',
      value: formatCurrency(activeAnalytics.totalProfit, currency, { signed: true }),
      sub: `${activeAnalytics.closedTradesCount} transaksi selesai`,
      tone: activeAnalytics.totalProfit >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Average Win',
      value: formatCurrency(activeAnalytics.avgWin, currency, { signed: true }),
      sub: 'Rata-rata profit per posisi menang',
      tone: 'positive',
    },
    {
      label: 'Average Loss',
      value: formatCurrency(-activeAnalytics.avgLoss, currency, { signed: true }),
      sub: 'Rata-rata kerugian per posisi kalah',
      tone: 'negative',
    },
    {
      label: 'Expectancy / Trade',
      value: formatCurrency(activeAnalytics.expectancy, currency, { signed: true }),
      sub: 'Nilai ekspektasi per eksekusi',
      tone: activeAnalytics.expectancy >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Maximum Drawdown',
      value: `-${formatCurrency(activeAnalytics.maxDrawdownAmount, currency)}`,
      sub: `${activeAnalytics.maxDrawdownPercent.toFixed(2)}% dari puncak`,
      tone: 'negative',
    },
    {
      label: 'Best Trading Day',
      value: activeAnalytics.bestDay
        ? formatCurrency(activeAnalytics.bestDay.netPl, currency, { signed: true })
        : '—',
      sub: activeAnalytics.bestDay
        ? formatShortDateId(activeAnalytics.bestDay.date)
        : 'Belum ada data',
      tone: 'positive',
    },
    {
      label: 'Worst Trading Day',
      value: activeAnalytics.worstDay
        ? formatCurrency(activeAnalytics.worstDay.netPl, currency, { signed: true })
        : '—',
      sub: activeAnalytics.worstDay
        ? formatShortDateId(activeAnalytics.worstDay.date)
        : 'Belum ada data',
      tone: 'negative',
    },
  ];

  return (
    <div className="space-y-6">
      {/* iOS Segmented Period Filter */}
      <div className="glass-card rounded-[24px] p-2 sm:p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="grid grid-cols-4 gap-1 p-1 glass-segmented rounded-2xl w-full sm:w-auto sm:min-w-[360px]">
          {PERIOD_TABS.map((tab) => {
            const isActive = period === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPeriod(tab.id)}
                className={`relative min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'text-[#0D7A72]'
                    : 'text-[#52625D] hover:text-[#1A2421]'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="analytics-period-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-white shadow-2xs"
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="px-2 text-xs text-[#52625D] flex items-center justify-between sm:justify-end gap-3">
          <span>
            Periode:{' '}
            <strong className="text-[#1A2421]">
              {PERIOD_TABS.find((p) => p.id === period)?.label}
            </strong>
          </span>
          <span>·</span>
          <span className="font-mono tabular-nums text-[#1A2421] font-semibold">
            {filteredTrades.length} trade
          </span>
        </div>
      </div>

      {/* Statistical Summary Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {coreMetrics.map((m) => (
          <div key={m.label} className="glass-card rounded-[24px] p-4 sm:p-5">
            <div className="text-xs font-medium text-[#52625D]">{m.label}</div>
            <div
              className={`mt-2 text-xl sm:text-2xl font-mono font-bold tabular-nums ${
                m.tone === 'positive'
                  ? 'text-[#15803D]'
                  : m.tone === 'negative'
                  ? 'text-[#B91C1C]'
                  : 'text-[#1A2421]'
              }`}
            >
              {m.value}
            </div>
            {m.sub && <div className="mt-1 text-xs text-[#52625D]">{m.sub}</div>}
          </div>
        ))}
      </section>

      {/* Equity Curve + BUY vs SELL + Pair Net P/L Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-[26px] p-5">
          <h3 className="text-sm font-bold text-[#1A2421]">Equity Curve Periode</h3>
          <p className="text-xs text-[#52625D] mt-0.5 mb-4">
            Pergerakan saldo berdasarkan transaksi tertutup pada filter aktif
          </p>
          <div className="h-60">
            {activeAnalytics.equityCurve.length <= 1 ? (
              <div className="h-full flex items-center justify-center text-xs text-[#52625D] border border-dashed border-[#1A2421]/15 rounded-2xl bg-white/35">
                Belum ada cukup transaksi tertutup pada periode ini.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activeAnalytics.equityCurve}>
                  <defs>
                    <linearGradient id="analyticsEquity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0D7A72" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0D7A72" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(26,36,33,0.08)"
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
                    width={72}
                    domain={['auto', 'auto']}
                    tickFormatter={(v) =>
                      formatCurrency(Number(v), currency, { compact: true })
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255,255,255,0.94)',
                      borderColor: 'rgba(255,255,255,0.9)',
                      borderRadius: '14px',
                      fontSize: '12px',
                      color: '#1A2421',
                    }}
                    formatter={(v: any) => [
                      formatCurrency(Number(v), currency),
                      'Equity',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="#0D7A72"
                    strokeWidth={2.4}
                    fill="url(#analyticsEquity)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="glass-card rounded-[26px] p-5">
          <h3 className="text-sm font-bold text-[#1A2421]">Net P/L per Pair</h3>
          <p className="text-xs text-[#52625D] mt-0.5 mb-4">
            Kontribusi profit atau loss berdasarkan instrumen Forex
          </p>

          {activeAnalytics.byPair.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-xs text-[#52625D] border border-dashed border-[#1A2421]/15 rounded-2xl bg-white/35">
              Belum ada data pair pada periode ini.
            </div>
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activeAnalytics.byPair.slice(0, 8)}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(26,36,33,0.08)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
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
                    width={70}
                    tickFormatter={(v) =>
                      formatCurrency(Number(v), currency, { compact: true })
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255,255,255,0.94)',
                      borderColor: 'rgba(255,255,255,0.9)',
                      borderRadius: '14px',
                      fontSize: '12px',
                      color: '#1A2421',
                    }}
                    formatter={(v: any) => [
                      formatCurrency(Number(v), currency, { signed: true }),
                      'Net P/L',
                    ]}
                  />
                  <Bar dataKey="netPl" radius={[8, 8, 8, 8]} maxBarSize={42}>
                    {activeAnalytics.byPair.slice(0, 8).map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={entry.netPl >= 0 ? '#16A34A' : '#DC2626'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* BUY vs SELL Comparison */}
      <section className="glass-card rounded-[26px] p-5">
        <h3 className="text-sm font-bold text-[#1A2421]">Performa BUY vs SELL</h3>
        <p className="text-xs text-[#52625D] mt-0.5 mb-4">
          Perbandingan efektivitas posisi Long (BUY) dan Short (SELL)
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            {activeAnalytics.byDirection.map((dir) => (
              <div
                key={dir.name}
                className="p-4 rounded-2xl bg-white/55 border border-white/80"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold ${
                      dir.name === 'BUY' ? 'text-[#15803D]' : 'text-[#B91C1C]'
                    }`}
                  >
                    {dir.name}
                  </span>
                  <span className="text-[11px] font-mono text-[#52625D]">
                    {dir.total} trade · {dir.winRate.toFixed(1)}% WR
                  </span>
                </div>
                <div
                  className={`mt-2 text-lg font-mono font-bold tabular-nums ${
                    dir.netPl >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                  }`}
                >
                  {formatCurrency(dir.netPl, currency, { signed: true })}
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-7 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activeAnalytics.byDirection}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(26,36,33,0.08)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="#52625D"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#52625D"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                  tickFormatter={(v) =>
                    formatCurrency(Number(v), currency, { compact: true })
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255,255,255,0.94)',
                    borderColor: 'rgba(255,255,255,0.9)',
                    borderRadius: '14px',
                    fontSize: '12px',
                    color: '#1A2421',
                  }}
                  formatter={(v: any) => [
                    formatCurrency(Number(v), currency, { signed: true }),
                    'Net P/L',
                  ]}
                />
                <Bar dataKey="netPl" radius={[10, 10, 10, 10]} maxBarSize={68}>
                  {activeAnalytics.byDirection.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.netPl >= 0 ? '#16A34A' : '#DC2626'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Detailed Breakdowns */}
      <PerformanceTable
        title="Performa Setiap Pair"
        subtitle="Statistik terperinci per pasangan mata uang atau komoditas"
        rows={activeAnalytics.byPair}
        currency={currency}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <PerformanceTable
          title="Performa Strategi"
          subtitle="Efektivitas masing-masing model setup atau strategi"
          rows={activeAnalytics.byStrategy}
          currency={currency}
        />
        <PerformanceTable
          title="Performa Sesi Trading"
          subtitle="Evaluasi hasil pada sesi Asia, London, New York, dan Overlap"
          rows={activeAnalytics.bySession}
          currency={currency}
        />
      </div>
    </div>
  );
}
