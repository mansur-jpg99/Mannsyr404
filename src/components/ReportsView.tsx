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
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
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
              className={`px-3 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-[#FFFFFF] text-[#172033] border border-[#E2E8F0] shadow-2xs'
                  : 'text-[#64748B] hover:text-[#172033]'
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
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-40 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV Tampilan Ini</span>
          </button>
          {activeTab !== 'all' && (
            <button
              type="button"
              onClick={exportAllTradesCsv}
              disabled={trades.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] disabled:opacity-40 border border-[#E2E8F0] text-xs font-semibold text-[#172033] cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-[#0D9488]" />
              <span>Ekspor Semua Transaksi</span>
            </button>
          )}
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl overflow-hidden">
        {activeTab !== 'all' ? (
          activePeriodRows.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#64748B]">
              Belum ada transaksi tertutup untuk menyusun laporan periode ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[11px] font-semibold text-[#64748B] bg-[#F8FAFC]">
                    <th className="py-3 px-5">Periode</th>
                    <th className="py-3 px-4 text-right">Transaksi</th>
                    <th className="py-3 px-4 text-right">W / L / BE</th>
                    <th className="py-3 px-4 text-right">Win Rate</th>
                    <th className="py-3 px-4 text-right">Gross P/L</th>
                    <th className="py-3 px-4 text-right">Komisi &amp; Swap</th>
                    <th className="py-3 px-5 text-right">Net P/L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-xs">
                  {activePeriodRows.map((r) => (
                    <tr key={r.key} className="hover:bg-[#F8FAFC]">
                      <td className="py-3 px-5 font-semibold text-[#172033] whitespace-nowrap">
                        {r.label}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#172033]">
                        {r.totalTrades}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#64748B] whitespace-nowrap">
                        <span className="text-[#16A34A] font-medium">{r.wins}</span> /{' '}
                        <span className="text-[#DC2626] font-medium">{r.losses}</span> / {r.be}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#172033]">
                        {r.winRate.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#172033] whitespace-nowrap">
                        {formatCurrency(r.grossPl, currency, { signed: true })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#64748B] whitespace-nowrap">
                        {formatCurrency(r.swap - Math.abs(r.commission), currency, {
                          signed: true,
                        })}
                      </td>
                      <td
                        className={`py-3 px-5 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
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
          )
        ) : trades.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#64748B]">
            Belum ada data transaksi untuk diekspor.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[11px] font-semibold text-[#64748B] bg-[#F8FAFC]">
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
              <tbody className="divide-y divide-[#E2E8F0] text-xs">
                {trades.map((t) => (
                  <tr key={t.id} className="hover:bg-[#F8FAFC]">
                    <td className="py-3 px-4 font-mono tabular-nums text-[#172033] whitespace-nowrap">
                      {formatShortDateId(t.tradeDate)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#172033]">{t.pair}</td>
                    <td
                      className={`py-3 px-3 font-semibold ${
                        t.direction === 'BUY' ? 'text-[#16A34A]' : 'text-[#DC2626]'
                      }`}
                    >
                      {t.direction}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-[#172033]">
                      {t.lotSize.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-[#172033]">
                      {formatPrice(t.entryPrice, t.pair)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-[#64748B]">
                      {formatPrice(t.exitPrice, t.pair)}
                    </td>
                    <td className="py-3 px-3 text-[#64748B]">{t.strategy || '—'}</td>
                    <td className="py-3 px-3 font-mono font-medium text-[#172033]">
                      {t.status}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                        t.netPl >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
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
