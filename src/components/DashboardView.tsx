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
import { ArrowDownRight, ArrowUpRight, Plus, Camera } from 'lucide-react';
import type { CurrencyCode, Trade } from '../types.ts';
import type { TradingAnalytics } from '../utils/analytics.ts';
import { formatCurrency, formatPrice, formatShortDateId } from '../utils/formatters.ts';

interface DashboardViewProps {
  analytics: TradingAnalytics;
  currency: CurrencyCode;
  trades: Trade[];
  compactCards?: boolean;
  onAddTrade: () => void;
  onInspectTrade: (trade: Trade) => void;
  onNavigateToJournal: () => void;
}

export function DashboardView({
  analytics,
  currency,
  trades,
  compactCards = false,
  onAddTrade,
  onInspectTrade,
  onNavigateToJournal,
}: DashboardViewProps) {
  const recentTrades = trades.slice(0, 7);

  const primaryMetrics = [
    {
      label: 'Saldo Awal',
      value: formatCurrency(analytics.initialBalance, currency),
      sub: `Mata uang ${currency}`,
      tone: 'neutral' as const,
    },
    {
      label: 'Saldo Berjalan',
      value: formatCurrency(analytics.currentBalance, currency),
      sub: `${analytics.growthPercent >= 0 ? '+' : ''}${analytics.growthPercent.toFixed(2)}% dari modal`,
      tone: analytics.currentBalance >= analytics.initialBalance ? 'positive' : 'negative',
    },
    {
      label: 'Total Profit / Loss',
      value: formatCurrency(analytics.totalProfit, currency, { signed: true }),
      sub: `${analytics.closedTradesCount} transaksi selesai`,
      tone: analytics.totalProfit >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Profit Hari Ini',
      value: formatCurrency(analytics.todayProfit, currency, { signed: true }),
      sub: 'Realisasi P/L hari ini',
      tone: analytics.todayProfit >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Profit Bulan Ini',
      value: formatCurrency(analytics.monthProfit, currency, { signed: true }),
      sub: 'Akumulasi bulan berjalan',
      tone: analytics.monthProfit >= 0 ? 'positive' : 'negative',
    },
  ];

  const performanceMetrics = [
    {
      label: 'Total Transaksi',
      value: `${analytics.totalTrades}`,
      sub: `${analytics.openTradesCount} posisi berjalan`,
    },
    {
      label: 'Win Rate',
      value: `${analytics.winRate.toFixed(1)}%`,
      sub: `${analytics.winCount} WIN dari ${analytics.winCount + analytics.lossCount}`,
    },
    {
      label: 'Loss Rate',
      value: `${analytics.lossRate.toFixed(1)}%`,
      sub: `${analytics.lossCount} LOSS · ${analytics.beCount} BE`,
    },
    {
      label: 'Profit Factor',
      value: analytics.profitFactor.toFixed(2),
      sub: analytics.profitFactor >= 1.5 ? 'Rasio sehat' : 'Perlu optimasi',
    },
    {
      label: 'Average Risk / Reward',
      value: `1 : ${analytics.avgRiskReward.toFixed(2)}`,
      sub: 'Rata-rata rencana R:R',
    },
  ];

  const cardPadding = compactCards ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5';

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Row 1: Balance & Profit Metrics (1-column on mobile) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {primaryMetrics.map((m) => (
          <div
            key={m.label}
            className={`bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl ${cardPadding}`}
          >
            <div className="text-xs font-medium text-[#64748B]">{m.label}</div>
            <div
              className={`mt-1.5 text-xl sm:text-2xl font-mono font-semibold tabular-nums truncate ${
                m.tone === 'positive'
                  ? 'text-[#16A34A]'
                  : m.tone === 'negative'
                  ? 'text-[#DC2626]'
                  : 'text-[#172033]'
              }`}
            >
              {m.value}
            </div>
            <div className="mt-1 text-xs text-[#64748B]">{m.sub}</div>
          </div>
        ))}
      </section>

      {/* Row 2: Execution Quality Metrics (1-column on mobile) */}
      <section className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {performanceMetrics.map((m) => (
          <div
            key={m.label}
            className={`bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl ${
              compactCards ? 'p-3.5' : 'p-4'
            }`}
          >
            <div className="text-xs font-medium text-[#64748B]">{m.label}</div>
            <div className="mt-1.5 text-lg sm:text-xl font-mono font-semibold tabular-nums text-[#172033]">
              {m.value}
            </div>
            <div className="mt-1 text-[11px] text-[#64748B]">{m.sub}</div>
          </div>
        ))}
      </section>

      {/* Row 3: Equity Curve + Monthly Performance Charts */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Equity Curve */}
        <div className="xl:col-span-7 bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
            <div>
              <h2 className="text-sm font-semibold text-[#172033]">Grafik Equity</h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Pertumbuhan saldo akun berdasarkan urutan transaksi tertutup
              </p>
            </div>
            <div className="text-xs font-mono font-medium tabular-nums text-[#0D9488]">
              Max DD: -{formatCurrency(analytics.maxDrawdownAmount, currency)} (
              {analytics.maxDrawdownPercent.toFixed(2)}%)
            </div>
          </div>

          <div className="h-60 sm:h-72 w-full">
            {analytics.equityCurve.length <= 1 ? (
              <div className="h-full flex flex-col items-center justify-center text-center border border-dashed border-[#E2E8F0] rounded-xl p-6 bg-[#F8FAFC]">
                <p className="text-sm text-[#172033] font-medium">
                  Belum ada data kurva equity
                </p>
                <p className="text-xs text-[#64748B] mt-1 max-w-xs">
                  Catat transaksi pertama yang sudah ditutup untuk melihat perkembangan kurva equity Anda.
                </p>
                <button
                  type="button"
                  onClick={onAddTrade}
                  className="mt-4 min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold cursor-pointer active:scale-95 transition-transform"
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
                    <linearGradient id="equityTealLight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0D9488" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="label"
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={76}
                    domain={['auto', 'auto']}
                    tickFormatter={(val) =>
                      formatCurrency(Number(val), currency, { compact: true })
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '10px',
                      fontSize: '12px',
                      color: '#172033',
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
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
                    stroke="#0D9488"
                    strokeWidth={2.2}
                    fill="url(#equityTealLight)"
                    activeDot={{ r: 5, fill: '#0D9488', stroke: '#FFFFFF', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Monthly Performance */}
        <div className="xl:col-span-5 bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-4 sm:p-5">
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-[#172033]">
              Grafik Performa Bulanan
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Perbandingan Net Profit / Loss per bulan kalender
            </p>
          </div>

          <div className="h-60 sm:h-72 w-full">
            {analytics.monthlyPerformance.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center border border-dashed border-[#E2E8F0] rounded-xl p-6 bg-[#F8FAFC]">
                <p className="text-sm text-[#172033] font-medium">
                  Belum ada ringkasan bulanan
                </p>
                <p className="text-xs text-[#64748B] mt-1">
                  Grafik performa bulanan akan muncul otomatis dari transaksi Anda.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.monthlyPerformance}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="label"
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={72}
                    tickFormatter={(val) =>
                      formatCurrency(Number(val), currency, { compact: true })
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '10px',
                      fontSize: '12px',
                      color: '#172033',
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
                    }}
                    formatter={(value: any) => [
                      formatCurrency(Number(value), currency, { signed: true }),
                      'Net P/L',
                    ]}
                  />
                  <Bar dataKey="netPl" radius={[5, 5, 0, 0]} maxBarSize={42}>
                    {analytics.monthlyPerformance.map((entry) => (
                      <Cell
                        key={entry.monthKey}
                        fill={entry.netPl >= 0 ? '#16A34A' : '#DC2626'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* Row 4: Recent Trades History */}
      <section className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 sm:px-5 py-4 border-b border-[#E2E8F0]">
          <div>
            <h2 className="text-sm font-semibold text-[#172033]">
              Aktivitas &amp; Riwayat Transaksi Terbaru
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Ketuk transaksi untuk melihat detail alasan entry dan screenshot chart
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateToJournal}
            className="min-h-[36px] inline-flex items-center text-xs font-semibold text-[#0D9488] hover:text-[#0F766E] cursor-pointer whitespace-nowrap self-start sm:self-auto active:scale-95 transition-transform"
          >
            Lihat Semua Jurnal
          </button>
        </div>

        {recentTrades.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-[#172033]">
              Belum ada transaksi pada akun ini
            </p>
            <p className="text-xs text-[#64748B] mt-1">
              Mulai catat setup pertama Anda untuk membangun riwayat performa yang akurat.
            </p>
            <button
              type="button"
              onClick={onAddTrade}
              className="mt-4 min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold cursor-pointer active:scale-95 transition-transform"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Transaksi Pertama</span>
            </button>
          </div>
        ) : (
          <>
            {/* Mobile 1-Column Card List */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {recentTrades.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onInspectTrade(t)}
                  className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-[#F8FAFC] active:bg-[#F1F5F9] transition-colors cursor-pointer"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#172033]">{t.pair}</span>
                      <span
                        className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                          t.direction === 'BUY' ? 'text-[#16A34A]' : 'text-[#DC2626]'
                        }`}
                      >
                        {t.direction === 'BUY' ? (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5" />
                        )}
                        {t.direction}
                      </span>
                      {(t.screenshotCount || 0) > 0 && (
                        <Camera className="w-3.5 h-3.5 text-[#0D9488]" />
                      )}
                    </div>
                    <div className="text-xs text-[#64748B] font-mono tabular-nums truncate">
                      {formatShortDateId(t.tradeDate)} · {t.lotSize.toFixed(2)} lot ·{' '}
                      {t.strategy || t.session}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-sm font-mono font-semibold tabular-nums ${
                        t.netPl > 0
                          ? 'text-[#16A34A]'
                          : t.netPl < 0
                          ? 'text-[#DC2626]'
                          : 'text-[#64748B]'
                      }`}
                    >
                      {t.status === 'OPEN'
                        ? 'OPEN'
                        : formatCurrency(t.netPl, currency, { signed: true })}
                    </div>
                    <div className="text-[11px] font-mono text-[#64748B]">
                      {t.status}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[11px] font-semibold text-[#64748B] bg-[#F8FAFC]">
                    <th className="py-3 px-5">Tanggal</th>
                    <th className="py-3 px-4">Pair</th>
                    <th className="py-3 px-4">Posisi</th>
                    <th className="py-3 px-4 text-right">Lot</th>
                    <th className="py-3 px-4 text-right">Entry</th>
                    <th className="py-3 px-4 text-right">Exit</th>
                    <th className="py-3 px-4">Strategi / Sesi</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-5 text-right">Net P/L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-xs">
                  {recentTrades.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => onInspectTrade(t)}
                      className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-5 font-mono tabular-nums text-[#172033] whitespace-nowrap">
                        {formatShortDateId(t.tradeDate)}
                        <span className="text-[#64748B] ml-1.5">{t.tradeTime}</span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#172033] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{t.pair}</span>
                          {(t.screenshotCount || 0) > 0 && (
                            <Camera className="w-3.5 h-3.5 text-[#0D9488]" />
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            t.direction === 'BUY' ? 'text-[#16A34A]' : 'text-[#DC2626]'
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
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#172033]">
                        {t.lotSize.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#172033]">
                        {formatPrice(t.entryPrice, t.pair)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#64748B]">
                        {formatPrice(t.exitPrice, t.pair)}
                      </td>
                      <td className="py-3 px-4 text-[#64748B] whitespace-nowrap">
                        <span className="text-[#172033]">{t.strategy || '—'}</span>
                        <span className="mx-1.5">·</span>
                        <span>{t.session}</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`font-mono font-semibold ${
                            t.status === 'WIN'
                              ? 'text-[#16A34A]'
                              : t.status === 'LOSS'
                              ? 'text-[#DC2626]'
                              : t.status === 'BE'
                              ? 'text-[#64748B]'
                              : 'text-amber-600'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-5 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                          t.netPl > 0
                            ? 'text-[#16A34A]'
                            : t.netPl < 0
                            ? 'text-[#DC2626]'
                            : 'text-[#64748B]'
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
