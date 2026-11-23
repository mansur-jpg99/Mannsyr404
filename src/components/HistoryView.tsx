import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Camera,
  ClipboardCheck,
  FileSpreadsheet,
  History as HistoryIcon,
  Search,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  CurrencyCode,
  DailyReview,
  HistoryTab,
  Trade,
} from '../types.ts';
import {
  formatCurrency,
  formatPrice,
  formatShortDateId,
} from '../utils/formatters.ts';
import { ReviewsView } from './ReviewsView.tsx';
import { ReportsView } from './ReportsView.tsx';

interface HistoryViewProps {
  activeTab: HistoryTab;
  onChangeTab: (tab: HistoryTab) => void;
  accountId: number;
  accountName: string;
  currency: CurrencyCode;
  trades: Trade[];
  reviews: DailyReview[];
  onInspectTrade: (trade: Trade) => void;
  onRefresh: () => Promise<void>;
}

const SUB_TABS: Array<{
  id: HistoryTab;
  label: string;
  icon: typeof HistoryIcon;
}> = [
  { id: 'trades', label: 'Riwayat Transaksi', icon: HistoryIcon },
  { id: 'reviews', label: 'Evaluasi Harian', icon: ClipboardCheck },
  { id: 'reports', label: 'Laporan CSV', icon: FileSpreadsheet },
];

export function HistoryView({
  activeTab,
  onChangeTab,
  accountId,
  accountName,
  currency,
  trades,
  reviews,
  onInspectTrade,
  onRefresh,
}: HistoryViewProps) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'WIN' | 'LOSS' | 'BE' | 'OPEN'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return trades.filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (q) {
        const hay = `${t.pair} ${t.strategy} ${t.session} ${t.tradeDate}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [trades, statusFilter, searchQuery]);

  const totalFilteredPl = useMemo(
    () =>
      filteredHistory
        .filter((t) => t.status !== 'OPEN')
        .reduce((acc, t) => acc + t.netPl, 0),
    [filteredHistory]
  );

  return (
    <div className="space-y-5">
      {/* Segmented Sub-navigation */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-1.5 overflow-x-auto">
        <div className="flex sm:grid sm:grid-cols-3 gap-1 min-w-max sm:min-w-0">
          {SUB_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeTab(tab.id)}
                className={`relative flex items-center justify-center gap-2 px-3.5 py-2.5 min-h-[40px] rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer whitespace-nowrap active:scale-[0.97] ${
                  isActive
                    ? 'text-[#0D9488] bg-[#0D9488]/10'
                    : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-view Animated Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {activeTab === 'trades' && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-6 relative">
                    <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari pair, strategi, tanggal, atau sesi..."
                      className="w-full min-h-[44px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl pl-10 pr-3.5 py-2 text-sm text-[#172033] placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#0D9488]"
                    />
                  </div>
                  <div className="md:col-span-6 flex flex-wrap items-center justify-between md:justify-end gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(['ALL', 'WIN', 'LOSS', 'BE', 'OPEN'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setStatusFilter(st)}
                          className={`px-3 py-2 min-h-[38px] rounded-lg text-xs font-semibold transition-colors cursor-pointer active:scale-95 ${
                            statusFilter === st
                              ? 'bg-[#0D9488] text-white'
                              : 'bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0] hover:text-[#172033]'
                          }`}
                        >
                          {st === 'ALL' ? 'Semua' : st}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E2E8F0] text-xs text-[#64748B]">
                  <span>
                    Total ditampilkan:{' '}
                    <strong className="font-mono text-[#172033] tabular-nums">
                      {filteredHistory.length}
                    </strong>{' '}
                    riwayat transaksi
                  </span>
                  <span
                    className={`font-mono font-semibold tabular-nums ${
                      totalFilteredPl >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                    }`}
                  >
                    {formatCurrency(totalFilteredPl, currency, { signed: true })}
                  </span>
                </div>
              </div>

              {/* Empty State */}
              {filteredHistory.length === 0 ? (
                <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-10 text-center">
                  <p className="text-sm font-medium text-[#172033]">
                    Tidak ada riwayat transaksi ditemukan
                  </p>
                  <p className="text-xs text-[#64748B] mt-1">
                    Coba ubah filter status atau tambahkan transaksi baru dari menu Jurnal Trading.
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile 1-Column List */}
                  <div className="md:hidden space-y-2.5">
                    {filteredHistory.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onInspectTrade(t)}
                        className="w-full text-left bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-4 space-y-2 active:scale-[0.985] transition-transform cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-bold text-[#172033]">
                              {t.pair}
                            </span>
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
                          <span
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
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-[#64748B] font-mono tabular-nums">
                          <span>
                            {formatShortDateId(t.tradeDate)} · {t.tradeTime}
                          </span>
                          <span>
                            {t.lotSize.toFixed(2)} lot · {t.status}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-[#64748B] pt-1 border-t border-[#E2E8F0]">
                          <span className="truncate">
                            {t.strategy || 'Tanpa strategi'} · {t.session}
                          </span>
                          <span className="font-mono tabular-nums shrink-0 ml-2">
                            {formatPrice(t.entryPrice, t.pair)} → {formatPrice(t.exitPrice, t.pair)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden md:block bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#E2E8F0] text-[11px] font-semibold text-[#64748B] bg-[#F8FAFC]">
                            <th className="py-3 px-5">Tanggal</th>
                            <th className="py-3 px-4">Pair</th>
                            <th className="py-3 px-4">Arah</th>
                            <th className="py-3 px-4 text-right">Lot</th>
                            <th className="py-3 px-4 text-right">Entry</th>
                            <th className="py-3 px-4 text-right">Exit</th>
                            <th className="py-3 px-4">Strategi · Sesi</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-5 text-right">Net P/L</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0] text-xs">
                          {filteredHistory.map((t) => (
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
                                    t.direction === 'BUY'
                                      ? 'text-[#16A34A]'
                                      : 'text-[#DC2626]'
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
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <ReviewsView
              accountId={accountId}
              currency={currency}
              reviews={reviews}
              trades={trades}
              onRefresh={onRefresh}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              trades={trades}
              accountName={accountName}
              currency={currency}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
