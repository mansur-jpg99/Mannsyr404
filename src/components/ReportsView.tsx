import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import type { CurrencyCode, Trade } from '../types.ts';
import {
  downloadCsv,
  formatCurrency,
  formatMonthKeyId,
  formatPrice,
  formatShortDateId,
} from '../utils/formatters.ts';

interface ReportsViewProps {
  trades: Trade[];
  accountName: string;
  currency: CurrencyCode;
}

type ReportTab = 'daily' | 'weekly' | 'monthly' | 'all';

interface PeriodRow {
  key: string;
  label: string;
  totalTrades: number;
  wins: number;
  losses: number;
  be: number;
  winRate: number;
  grossPl: number;
  commission: number;
  swap: number;
  netPl: number;
}

function getWeekKey(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function aggregateByPeriod(
  trades: Trade[],
  getKey: (t: Trade) => string,
  getLabel: (key: string) => string
): PeriodRow[] {
  const closed = trades.filter((t) => t.status !== 'OPEN');
  const map = new Map<string, Trade[]>();
  for (const t of closed) {
    const key = getKey(t);
    const list = map.get(key) || [];
    list.push(t);
    map.set(key, list);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => {
      const wins = items.filter((t) => t.status === 'WIN').length;
      const losses = items.filter((t) => t.status === 'LOSS').length;
      const be = items.filter((t) => t.status === 'BE').length;
      const decided = wins + losses;
      return {
        key,
        label: getLabel(key),
        totalTrades: items.length,
        wins,
        losses,
        be,
        winRate: decided > 0 ? (wins / decided) * 100 : 0,
        grossPl: items.reduce((acc, t) => acc + t.grossPl, 0),
        commission: items.reduce((acc, t) => acc + t.commission, 0),
        swap: items.reduce((acc, t) => acc + t.swap, 0),
        netPl: items.reduce((acc, t) => acc + t.netPl, 0),
      };
    });
}

export function ReportsView({ trades, accountName, currency }: ReportsViewProps) {
  const [activeTab, setActiveTab] = useState<ReportTab>('daily');

  const dailyRows = useMemo(
    () =>
      aggregateByPeriod(
        trades,
        (t) => t.tradeDate,
        (k) => formatShortDateId(k)
      ),
    [trades]
  );

  const weeklyRows = useMemo(
    () =>
      aggregateByPeriod(
        trades,
        (t) => getWeekKey(t.tradeDate),
        (k) => `Minggu ${k.replace('-W', ' #')}`
      ),
    [trades]
  );

  const monthlyRows = useMemo(
    () =>
      aggregateByPeriod(
        trades,
        (t) => t.tradeDate.slice(0, 7),
        (k) => formatMonthKeyId(k)
      ),
    [trades]
  );

  const exportAllTradesCsv = () => {
    const headers = [
      'Tanggal',
      'Waktu',
      'Pair',
      'Arah',
      'Lot',
      'Entry Price',
      'Exit Price',
      'Stop Loss',
      'Take Profit',
      'Status',
      `Gross P/L (${currency})`,
      `Commission (${currency})`,
      `Swap (${currency})`,
      `Net P/L (${currency})`,
      'Strategi',
      'Sesi',
      'Emosi',
      'Alasan Entry',
      'Catatan',
    ];
    const rows = trades.map((t) => [
      t.tradeDate,
      t.tradeTime,
      t.pair,
      t.direction,
      t.lotSize,
      t.entryPrice,
      t.exitPrice ?? '',
      t.stopLoss,
      t.takeProfit,
      t.status,
      t.grossPl,
      t.commission,
      t.swap,
      t.netPl,
      t.strategy,
      t.session,
      t.emotion,
      t.entryReason,
      t.notes,
    ]);
    downloadCsv(
      `mansyr404-transaksi-${accountName.toLowerCase().replace(/\s+/g, '-')}.csv`,
      headers,
      rows
    );
  };

  const exportPeriodCsv = (rowsData: PeriodRow[], periodName: string) => {
    const headers = [
      'Periode',
      'Total Transaksi',
      'Win',
      'Loss',
      'Break Even',
      'Win Rate (%)',
      `Gross P/L (${currency})`,
      `Commission (${currency})`,
      `Swap (${currency})`,
      `Net P/L (${currency})`,
    ];
    const rows = rowsData.map((r) => [
      r.label,
      r.totalTrades,
      r.wins,
      r.losses,
      r.be,
      r.winRate.toFixed(2),
      r.grossPl.toFixed(2),
      r.commission.toFixed(2),
      r.swap.toFixed(2),
      r.netPl.toFixed(2),
    ]);
    downloadCsv(
      `mansyr404-laporan-${periodName}-${accountName
        .toLowerCase()
        .replace(/\s+/g, '-')}.csv`,
      headers,
      rows
    );
  };

  const handleExportCurrent = () => {
    if (activeTab === 'daily') exportPeriodCsv(dailyRows, 'harian');
    else if (activeTab === 'weekly') exportPeriodCsv(weeklyRows, 'mingguan');
    else if (activeTab === 'monthly') exportPeriodCsv(monthlyRows, 'bulanan');
    else exportAllTradesCsv();
  };

  const activePeriodRows =
    activeTab === 'daily'
      ? dailyRows
      : activeTab === 'weekly'
      ? weeklyRows
      : monthlyRows;

  return (
    <div className="space-y-5">
      {/* Header Toolbar */}
      <div className="glass-card rounded-[26px] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 glass-segmented rounded-2xl">
          {(
            [
              { id: 'daily', label: 'Laporan Harian' },
              { id: 'weekly', label: 'Laporan Mingguan' },
              { id: 'monthly', label: 'Laporan Bulanan' },
              { id: 'all', label: 'Seluruh Transaksi' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-white text-[#0D7A72] shadow-2xs'
                  : 'text-[#52625D] hover:text-[#1A2421]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCurrent}
            disabled={
              activeTab === 'all' ? trades.length === 0 : activePeriodRows.length === 0
            }
            className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#0D7A72] hover:bg-[#095E58] disabled:opacity-40 text-white text-xs font-semibold cursor-pointer whitespace-nowrap active:scale-95 transition-transform"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV Tampilan Ini</span>
          </button>
          {activeTab !== 'all' && (
            <button
              type="button"
              onClick={exportAllTradesCsv}
              disabled={trades.length === 0}
              className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/75 hover:bg-white disabled:opacity-40 border border-white/80 text-xs font-semibold text-[#1A2421] cursor-pointer whitespace-nowrap active:scale-95 transition-transform"
            >
              <Download className="w-3.5 h-3.5 text-[#0D7A72]" />
              <span>Ekspor Semua Transaksi</span>
            </button>
          )}
        </div>
      </div>

      {/* Report Table / Mobile List */}
      <div className="glass-card rounded-[26px] overflow-hidden">
        {activeTab !== 'all' ? (
          activePeriodRows.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#52625D]">
              Belum ada transaksi tertutup untuk menyusun laporan periode ini.
            </div>
          ) : (
            <>
              <div className="md:hidden divide-y divide-[#1A2421]/8">
                {activePeriodRows.map((r) => (
                  <div key={r.key} className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-[#1A2421]">{r.label}</div>
                      <div className="text-xs text-[#52625D] font-mono tabular-nums mt-0.5">
                        {r.totalTrades} trade · {r.wins}W/{r.losses}L/{r.be}BE ·{' '}
                        {r.winRate.toFixed(1)}% WR
                      </div>
                    </div>
                    <div
                      className={`text-sm font-mono font-bold tabular-nums ${
                        r.netPl >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                      }`}
                    >
                      {formatCurrency(r.netPl, currency, { signed: true })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#1A2421]/8 text-[11px] font-semibold text-[#52625D] bg-white/35">
                      <th className="py-3 px-5">Periode</th>
                      <th className="py-3 px-4 text-right">Transaksi</th>
                      <th className="py-3 px-4 text-right">W / L / BE</th>
                      <th className="py-3 px-4 text-right">Win Rate</th>
                      <th className="py-3 px-4 text-right">Gross P/L</th>
                      <th className="py-3 px-4 text-right">Komisi &amp; Swap</th>
                      <th className="py-3 px-5 text-right">Net P/L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A2421]/8 text-xs">
                    {activePeriodRows.map((r) => (
                      <tr key={r.key} className="hover:bg-white/40">
                        <td className="py-3.5 px-5 font-semibold text-[#1A2421] whitespace-nowrap">
                          {r.label}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#1A2421]">
                          {r.totalTrades}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#52625D] whitespace-nowrap">
                          <span className="text-[#15803D] font-medium">{r.wins}</span> /{' '}
                          <span className="text-[#B91C1C] font-medium">{r.losses}</span> / {r.be}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#1A2421]">
                          {r.winRate.toFixed(1)}%
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#1A2421] whitespace-nowrap">
                          {formatCurrency(r.grossPl, currency, { signed: true })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#52625D] whitespace-nowrap">
                          {formatCurrency(r.swap - Math.abs(r.commission), currency, {
                            signed: true,
                          })}
                        </td>
                        <td
                          className={`py-3.5 px-5 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
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
          )
        ) : trades.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#52625D]">
            Belum ada data transaksi untuk diekspor.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1A2421]/8 text-[11px] font-semibold text-[#52625D] bg-white/35">
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Pair</th>
                  <th className="py-3 px-3">Arah</th>
                  <th className="py-3 px-3 text-right">Lot</th>
                  <th className="py-3 px-3 text-right">Entry</th>
                  <th className="py-3 px-3 text-right">Exit</th>
                  <th className="py-3 px-3">Strategi</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Net P/L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2421]/8 text-xs">
                {trades.map((t) => (
                  <tr key={t.id} className="hover:bg-white/40">
                    <td className="py-3.5 px-4 font-mono tabular-nums text-[#1A2421] whitespace-nowrap">
                      {formatShortDateId(t.tradeDate)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#1A2421]">{t.pair}</td>
                    <td
                      className={`py-3.5 px-3 font-semibold ${
                        t.direction === 'BUY' ? 'text-[#15803D]' : 'text-[#B91C1C]'
                      }`}
                    >
                      {t.direction}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-[#1A2421]">
                      {t.lotSize.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-[#1A2421]">
                      {formatPrice(t.entryPrice, t.pair)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-[#52625D]">
                      {formatPrice(t.exitPrice, t.pair)}
                    </td>
                    <td className="py-3.5 px-3 text-[#52625D]">{t.strategy || '—'}</td>
                    <td className="py-3.5 px-3 font-mono font-medium text-[#1A2421]">
                      {t.status}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                        t.netPl >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                      }`}
                    >
                      {formatCurrency(t.netPl, currency, { signed: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
