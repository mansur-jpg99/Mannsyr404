import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CurrencyCode } from '../types.ts';
import type { GroupPerformance, TradingAnalytics } from '../utils/analytics.ts';
import { formatCurrency, formatShortDateId } from '../utils/formatters.ts';

interface AnalyticsViewProps {
  analytics: TradingAnalytics;
  currency: CurrencyCode;
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
    <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E2E8F0]">
        <h3 className="text-sm font-semibold text-[#172033]">{title}</h3>
        <p className="text-xs text-[#64748B] mt-0.5">{subtitle}</p>
      </div>
      {rows.length === 0 ? (
        <div className="p-8 text-center text-xs text-[#64748B]">
          Belum ada transaksi tertutup untuk dianalisis.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[11px] font-semibold text-[#64748B] bg-[#F8FAFC]">
                <th className="py-2.5 px-5">Kategori</th>
                <th className="py-2.5 px-3 text-right">Transaksi</th>
                <th className="py-2.5 px-3 text-right">Win / Loss</th>
                <th className="py-2.5 px-3 text-right">Win Rate</th>
                <th className="py-2.5 px-3 text-right">Profit Factor</th>
                <th className="py-2.5 px-3 text-right">Expectancy</th>
                <th className="py-2.5 px-5 text-right">Net P/L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-xs">
              {rows.map((r) => (
                <tr key={r.name} className="hover:bg-[#F8FAFC]">
                  <td className="py-3 px-5 font-semibold text-[#172033]">{r.name}</td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-[#172033]">
                    {r.total}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-[#64748B]">
                    <span className="text-[#16A34A] font-medium">{r.wins}W</span>
                    <span className="mx-1">/</span>
                    <span className="text-[#DC2626] font-medium">{r.losses}L</span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-[#172033]">
                    {r.winRate.toFixed(1)}%
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-[#64748B]">
                    {r.profitFactor.toFixed(2)}
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-mono tabular-nums ${
                      r.expectancy >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                    }`}
                  >
                    {formatCurrency(r.expectancy, currency, { signed: true })}
                  </td>
                  <td
                    className={`py-3 px-5 text-right font-mono font-semibold tabular-nums ${
                      r.netPl >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                    }`}
                  >
                    {formatCurrency(r.netPl, currency, { signed: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AnalyticsView({ analytics, currency }: AnalyticsViewProps) {
  const coreMetrics = [
    { label: 'Win Rate', value: `${analytics.winRate.toFixed(2)}%`, tone: 'neutral' },
    { label: 'Loss Rate', value: `${analytics.lossRate.toFixed(2)}%`, tone: 'neutral' },
    { label: 'Profit Factor', value: analytics.profitFactor.toFixed(2), tone: 'neutral' },
    {
      label: 'Average Win',
      value: formatCurrency(analytics.avgWin, currency, { signed: true }),
      tone: 'positive',
    },
    {
      label: 'Average Loss',
      value: formatCurrency(-analytics.avgLoss, currency, { signed: true }),
      tone: 'negative',
    },
    {
      label: 'Expectancy / Trade',
      value: formatCurrency(analytics.expectancy, currency, { signed: true }),
      tone: analytics.expectancy >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Maximum Drawdown',
      value: `-${formatCurrency(analytics.maxDrawdownAmount, currency)} (${analytics.maxDrawdownPercent.toFixed(2)}%)`,
      tone: 'negative',
    },
    {
      label: 'Best Trading Day',
      value: analytics.bestDay
        ? formatCurrency(analytics.bestDay.netPl, currency, { signed: true })
        : '—',
      sub: analytics.bestDay ? formatShortDateId(analytics.bestDay.date) : 'Belum ada data',
      tone: 'positive',
    },
    {
      label: 'Worst Trading Day',
      value: analytics.worstDay
        ? formatCurrency(analytics.worstDay.netPl, currency, { signed: true })
        : '—',
      sub: analytics.worstDay ? formatShortDateId(analytics.worstDay.date) : 'Belum ada data',
      tone: 'negative',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Statistical Summary Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {coreMetrics.map((m) => (
          <div
            key={m.label}
            className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4 sm:p-5"
          >
            <div className="text-xs font-medium text-[#64748B]">{m.label}</div>
            <div
              className={`mt-2 text-lg sm:text-xl font-mono font-semibold tabular-nums ${
                m.tone === 'positive'
                  ? 'text-[#16A34A]'
                  : m.tone === 'negative'
                  ? 'text-[#DC2626]'
                  : 'text-[#172033]'
              }`}
            >
              {m.value}
            </div>
            {m.sub && <div className="mt-1 text-xs text-[#64748B]">{m.sub}</div>}
          </div>
        ))}
      </section>

      {/* BUY vs SELL + Pair Net P/L Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#172033]">Performa BUY vs SELL</h3>
          <p className="text-xs text-[#64748B] mt-0.5 mb-4">
            Perbandingan profitabilitas posisi Long (BUY) dan Short (SELL)
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {analytics.byDirection.map((dir) => (
              <div
                key={dir.name}
                className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold ${
                      dir.name === 'BUY' ? 'text-[#16A34A]' : 'text-[#DC2626]'
                    }`}
                  >
                    {dir.name}
                  </span>
                  <span className="text-[11px] font-mono text-[#64748B]">
                    {dir.total} trade · {dir.winRate.toFixed(1)}% WR
                  </span>
                </div>
                <div
                  className={`mt-2 text-base font-mono font-semibold tabular-nums ${
                    dir.netPl >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                  }`}
                >
                  {formatCurrency(dir.netPl, currency, { signed: true })}
                </div>
              </div>
            ))}
          </div>

          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.byDirection}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                  tickFormatter={(v) => formatCurrency(Number(v), currency, { compact: true })}
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
                  formatter={(v: any) => [
                    formatCurrency(Number(v), currency, { signed: true }),
                    'Net P/L',
                  ]}
                />
                <Bar dataKey="netPl" radius={[5, 5, 0, 0]} maxBarSize={64}>
                  {analytics.byDirection.map((entry) => (
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

        <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#172033]">Net P/L per Pair</h3>
          <p className="text-xs text-[#64748B] mt-0.5 mb-4">
            Kontribusi profit atau loss berdasarkan instrumen Forex
          </p>

          {analytics.byPair.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-[#64748B] border border-dashed border-[#E2E8F0] rounded-lg bg-[#F8FAFC]">
              Belum ada data pair untuk ditampilkan.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.byPair.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={70}
                    tickFormatter={(v) => formatCurrency(Number(v), currency, { compact: true })}
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
                    formatter={(v: any) => [
                      formatCurrency(Number(v), currency, { signed: true }),
                      'Net P/L',
                    ]}
                  />
                  <Bar dataKey="netPl" radius={[5, 5, 0, 0]} maxBarSize={44}>
                    {analytics.byPair.slice(0, 8).map((entry) => (
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

      {/* Detailed Tables */}
      <PerformanceTable
        title="Performa Setiap Pair"
        subtitle="Statistik terperinci per pasangan mata uang atau komoditas"
        rows={analytics.byPair}
        currency={currency}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <PerformanceTable
          title="Performa Strategi"
          subtitle="Efektivitas masing-masing model setup atau strategi"
          rows={analytics.byStrategy}
          currency={currency}
        />
        <PerformanceTable
          title="Performa Sesi Trading"
          subtitle="Evaluasi hasil pada sesi Asia, London, New York, dan Overlap"
          rows={analytics.bySession}
          currency={currency}
        />
      </div>
    </div>
  );
}
