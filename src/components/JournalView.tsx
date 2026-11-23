import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Camera,
  Edit3,
  Plus,
  Search,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import type { CurrencyCode, Trade } from '../types.ts';
import { apiRequest } from '../lib/api.ts';
import {
  formatCurrency,
  formatPrice,
  formatShortDateId,
} from '../utils/formatters.ts';

interface JournalViewProps {
  trades: Trade[];
  currency: CurrencyCode;
  onAddTrade: () => void;
  onEditTrade: (trade: Trade) => void;
  onInspectTrade: (trade: Trade) => void;
  onRefresh: () => Promise<void>;
}

export function JournalView({
  trades,
  currency,
  onAddTrade,
  onEditTrade,
  onInspectTrade,
  onRefresh,
}: JournalViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPair, setFilterPair] = useState('ALL');
  const [filterDirection, setFilterDirection] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterSession, setFilterSession] = useState('ALL');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const uniquePairs = useMemo(
    () => Array.from(new Set(trades.map((t) => t.pair))).sort(),
    [trades]
  );

  const filteredTrades = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return trades.filter((t) => {
      if (filterPair !== 'ALL' && t.pair !== filterPair) return false;
      if (filterDirection !== 'ALL' && t.direction !== filterDirection) return false;
      if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
      if (filterSession !== 'ALL' && t.session !== filterSession) return false;
      if (filterStartDate && t.tradeDate < filterStartDate) return false;
      if (filterEndDate && t.tradeDate > filterEndDate) return false;
      if (q) {
        const hay = `${t.pair} ${t.strategy} ${t.entryReason} ${t.notes} ${t.emotion}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    trades,
    searchQuery,
    filterPair,
    filterDirection,
    filterStatus,
    filterSession,
    filterStartDate,
    filterEndDate,
  ]);

  const filteredNetPl = useMemo(
    () =>
      filteredTrades
        .filter((t) => t.status !== 'OPEN')
        .reduce((acc, t) => acc + t.netPl, 0),
    [filteredTrades]
  );

  const resetFilters = () => {
    setSearchQuery('');
    setFilterPair('ALL');
    setFilterDirection('ALL');
    setFilterStatus('ALL');
    setFilterSession('ALL');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await apiRequest(`/api/trades/${id}`, { method: 'DELETE' });
      setConfirmDeleteId(null);
      await onRefresh();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Search & Filter Toolbar */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari pair, strategi, alasan entry, atau catatan..."
              className="w-full min-h-[44px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-[#172033] placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#0D9488]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 text-xs">
            <div className="text-[#64748B]">
              Menampilkan{' '}
              <span className="font-mono text-[#172033] font-semibold">
                {filteredTrades.length}
              </span>{' '}
              transaksi · Total:{' '}
              <span
                className={`font-mono font-semibold tabular-nums ${
                  filteredNetPl >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                }`}
              >
                {formatCurrency(filteredNetPl, currency, { signed: true })}
              </span>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#172033] font-medium cursor-pointer whitespace-nowrap active:scale-95 transition-transform"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#64748B]" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <select
            value={filterPair}
            onChange={(e) => setFilterPair(e.target.value)}
            className="min-h-[42px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
          >
            <option value="ALL">Semua Pair</option>
            {uniquePairs.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={filterDirection}
            onChange={(e) => setFilterDirection(e.target.value)}
            className="min-h-[42px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
          >
            <option value="ALL">BUY &amp; SELL</option>
            <option value="BUY">BUY Saja</option>
            <option value="SELL">SELL Saja</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="min-h-[42px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
          >
            <option value="ALL">Semua Status</option>
            <option value="WIN">WIN</option>
            <option value="LOSS">LOSS</option>
            <option value="BE">BE</option>
            <option value="OPEN">OPEN</option>
          </select>

          <select
            value={filterSession}
            onChange={(e) => setFilterSession(e.target.value)}
            className="min-h-[42px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
          >
            <option value="ALL">Semua Sesi</option>
            <option value="Asia">Asia</option>
            <option value="London">London</option>
            <option value="New York">New York</option>
            <option value="Overlap">Overlap</option>
          </select>

          <input
            type="date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            title="Dari Tanggal"
            className="min-h-[42px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs font-mono text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
          />

          <input
            type="date"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            title="Sampai Tanggal"
            className="min-h-[42px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs font-mono text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
          />
        </div>
      </div>

      {/* Trades Ledger */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl overflow-hidden">
        {filteredTrades.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-[#172033]">
              {trades.length === 0
                ? 'Jurnal transaksi masih kosong'
                : 'Tidak ada transaksi yang cocok dengan filter'}
            </p>
            <p className="text-xs text-[#64748B] mt-1">
              {trades.length === 0
                ? 'Catat transaksi manual pertama Anda lengkap dengan alasan entry dan screenshot chart.'
                : 'Ubah kata kunci pencarian atau reset filter untuk melihat seluruh transaksi.'}
            </p>
            {trades.length === 0 && (
              <button
                type="button"
                onClick={onAddTrade}
                className="mt-4 min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold cursor-pointer active:scale-95 transition-transform"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Transaksi</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile 1-Column Card List */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {filteredTrades.map((t) => (
                <div
                  key={t.id}
                  onClick={() => onInspectTrade(t)}
                  className="p-4 space-y-2.5 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
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
                          <span className="inline-flex items-center gap-0.5 text-[11px] text-[#0D9488] font-mono">
                            <Camera className="w-3 h-3" />
                            {t.screenshotCount}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#64748B] font-mono tabular-nums mt-0.5">
                        {formatShortDateId(t.tradeDate)} · {t.tradeTime} · {t.lotSize.toFixed(2)} lot
                      </div>
                    </div>

                    <div className="text-right">
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
                          ? 'Berjalan'
                          : formatCurrency(t.netPl, currency, { signed: true })}
                      </div>
                      <div className="text-[11px] font-mono font-semibold text-[#64748B]">
                        {t.status}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-[#64748B] flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {t.strategy || '—'} · {t.session} · {t.emotion}
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatPrice(t.entryPrice, t.pair)} → {formatPrice(t.exitPrice, t.pair)}
                    </span>
                  </div>

                  <div
                    className="pt-2 border-t border-[#E2E8F0] flex items-center justify-end gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {confirmDeleteId === t.id ? (
                      <>
                        <button
                          type="button"
                          disabled={deletingId === t.id}
                          onClick={() => handleDelete(t.id)}
                          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-red-50 border border-red-200 text-[#DC2626] text-xs font-semibold cursor-pointer"
                        >
                          {deletingId === t.id ? '...' : 'Konfirmasi Hapus'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-[40px] px-3 py-2 rounded-xl text-xs text-[#64748B] hover:text-[#172033] cursor-pointer"
                        >
                          Batal
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onEditTrade(t)}
                          className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-medium text-[#172033] cursor-pointer active:scale-95 transition-transform"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Ubah</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(t.id)}
                          className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-[#DC2626] cursor-pointer active:scale-95 transition-transform"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Full Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[11px] font-semibold text-[#64748B] bg-[#F8FAFC]">
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Pair</th>
                    <th className="py-3 px-3">Arah</th>
                    <th className="py-3 px-3 text-right">Lot</th>
                    <th className="py-3 px-3 text-right">Entry</th>
                    <th className="py-3 px-3 text-right">SL / TP</th>
                    <th className="py-3 px-3 text-right">Exit</th>
                    <th className="py-3 px-3">Strategi · Sesi</th>
                    <th className="py-3 px-3">Emosi</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Net P/L</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-xs">
                  {filteredTrades.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => onInspectTrade(t)}
                      className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono tabular-nums text-[#172033] whitespace-nowrap">
                        {formatShortDateId(t.tradeDate)}
                        <span className="text-[#64748B] ml-1.5">{t.tradeTime}</span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#172033] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{t.pair}</span>
                          {(t.screenshotCount || 0) > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] text-[#0D9488] font-mono">
                              <Camera className="w-3 h-3" />
                              {t.screenshotCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
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
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-[#172033]">
                        {t.lotSize.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-[#172033]">
                        {formatPrice(t.entryPrice, t.pair)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-[#64748B] whitespace-nowrap">
                        <span className="text-[#DC2626]">
                          {formatPrice(t.stopLoss, t.pair)}
                        </span>
                        <span className="mx-1">/</span>
                        <span className="text-[#16A34A]">
                          {formatPrice(t.takeProfit, t.pair)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-[#172033]">
                        {formatPrice(t.exitPrice, t.pair)}
                      </td>
                      <td className="py-3 px-3 text-[#172033] whitespace-nowrap">
                        <span>{t.strategy || '—'}</span>
                        <span className="text-[#64748B] mx-1.5">·</span>
                        <span className="text-[#64748B]">{t.session}</span>
                      </td>
                      <td className="py-3 px-3 text-[#64748B] whitespace-nowrap">
                        {t.emotion}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
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
                        className={`py-3 px-4 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
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
                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {confirmDeleteId === t.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={deletingId === t.id}
                              onClick={() => handleDelete(t.id)}
                              className="px-2.5 py-1 rounded bg-red-50 border border-red-200 text-[#DC2626] hover:bg-red-100 text-[11px] font-semibold cursor-pointer"
                            >
                              {deletingId === t.id ? '...' : 'Hapus'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded text-[#64748B] hover:text-[#172033] text-[11px] cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditTrade(t)}
                              className="p-1.5 rounded text-[#64748B] hover:text-[#172033] hover:bg-[#F1F5F9] cursor-pointer"
                              title="Ubah transaksi"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(t.id)}
                              className="p-1.5 rounded text-[#64748B] hover:text-[#DC2626] hover:bg-red-50 cursor-pointer"
                              title="Hapus transaksi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
