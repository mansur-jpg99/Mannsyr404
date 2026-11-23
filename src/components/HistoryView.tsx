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
      {/* iOS Segmented Sub-navigation */}
      <div className="glass-card rounded-[24px] p-2 overflow-x-auto">
        <div className="flex sm:grid sm:grid-cols-3 gap-1 min-w-max sm:min-w-0 p-1 glass-segmented rounded-2xl">
          {SUB_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeTab(tab.id)}
                className={`relative flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] rounded-xl text-xs font-semibold transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'text-[#0D7A72]'
                    : 'text-[#52625D] hover:text-[#1A2421]'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="history-subtab-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-white shadow-2xs"
                  />
                )}
                <Icon className="relative z-10 w-3.5 h-3.5 shrink-0" />
                <span className="relative z-10">{tab.label}</span>
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
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {activeTab === 'trades' && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className="glass-card rounded-[26px] p-4 sm:p-5 space-y-3.5">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-6 relative">
                    <Search className="w-4 h-4 text-[#52625D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari pair, strategi, tanggal, atau sesi..."
                      className="w-full min-h-[44px] glass-input rounded-2xl pl-10 pr-3.5 py-2 text-sm placeholder:text-[#6B7C76]"
                    />
                  </div>
                  <div className="md:col-span-6 flex flex-wrap items-center justify-between md:justify-end gap-1.5">
                    {(['ALL', 'WIN', 'LOSS', 'BE', 'OPEN'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusFilter(st)}
                        className={`px-3.5 py-2 min-h-[40px] rounded-2xl text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
                          statusFilter === st
                            ? 'bg-[#0D7A72] text-white shadow-2xs'
                            : 'bg-white/65 text-[#52625D] border border-white/80 hover:text-[#1A2421] hover:bg-white'
                        }`}
                      >
                        {st === 'ALL' ? 'Semua' : st}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#1A2421]/8 text-xs text-[#52625D]">
                  <span>
                    Total ditampilkan:{' '}
                    <strong className="font-mono text-[#1A2421] tabular-nums">
                      {filteredHistory.length}
                    </strong>{' '}
                    riwayat transaksi
                  </span>
                  <span
                    className={`font-mono font-bold tabular-nums ${
                      totalFilteredPl >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                    }`}
                  >
                    {formatCurrency(totalFilteredPl, currency, { signed: true })}
                  </span>
                </div>
              </div>

              {/* Empty State */}
              {filteredHistory.length === 0 ? (
                <div className="glass-card rounded-[26px] p-10 text-center">
                  <p className="text-sm font-semibold text-[#1A2421]">
                    Tidak ada riwayat transaksi ditemukan
                  </p>
                  <p className="text-xs text-[#52625D] mt-1">
                    Coba ubah filter status atau tambahkan transaksi baru dari menu Journal.
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile iOS List Cards */}
                  <div className="md:hidden glass-card rounded-[26px] overflow-hidden divide-y divide-[#1A2421]/8">
                    {filteredHistory.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onInspectTrade(t)}
                        className="w-full text-left p-4 space-y-2 hover:bg-white/40 active:bg-white/60 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
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
                                  className={`text-xs font-semibold ${
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
                              <div className="text-xs text-[#52625D] font-mono tabular-nums mt-0.5">
                                {formatShortDateId(t.tradeDate)} · {t.tradeTime}
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
                            <div className="text-[11px] font-mono text-[#52625D]">
                              {t.lotSize.toFixed(2)} lot · {t.status}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-[#52625D] pl-12">
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
                  <div className="hidden md:block glass-card rounded-[26px] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#1A2421]/8 text-[11px] font-semibold text-[#52625D] bg-white/35">
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
                        <tbody className="divide-y divide-[#1A2421]/8 text-xs">
                          {filteredHistory.map((t) => (
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
                                    t.direction === 'BUY'
                                      ? 'text-[#15803D]'
                                      : 'text-[#B91C1C]'
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
