import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { CurrencyCode, Trade } from '../types.ts';
import {
  formatCurrency,
  formatMonthYearId,
  formatPrice,
  formatShortDateId,
  getTodayIsoDate,
} from '../utils/formatters.ts';

interface CalendarViewProps {
  trades: Trade[];
  currency: CurrencyCode;
  onInspectTrade: (trade: Trade) => void;
  onAddTradeOnDate: (date: string) => void;
}

const WEEKDAYS_ID = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export function CalendarView({
  trades,
  currency,
  onInspectTrade,
  onAddTradeOnDate,
}: CalendarViewProps) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(getTodayIsoDate());

  const dayMap = useMemo(() => {
    const map = new Map<string, { trades: Trade[]; netPl: number }>();
    for (const t of trades) {
      const existing = map.get(t.tradeDate) || { trades: [], netPl: 0 };
      existing.trades.push(t);
      if (t.status !== 'OPEN') {
        existing.netPl += t.netPl;
      }
      map.set(t.tradeDate, existing);
    }
    return map;
  }, [trades]);

  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;

  const monthSummary = useMemo(() => {
    let totalPl = 0;
    let totalTrades = 0;
    let profitDays = 0;
    let lossDays = 0;

    for (const [date, info] of dayMap.entries()) {
      if (!date.startsWith(monthPrefix)) continue;
      totalPl += info.netPl;
      totalTrades += info.trades.length;
      if (info.netPl > 0) profitDays += 1;
      else if (info.netPl < 0) lossDays += 1;
    }

    return { totalPl, totalTrades, profitDays, lossDays };
  }, [dayMap, monthPrefix]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7;

    const cells: Array<{ dateStr: string | null; dayNum: number | null }> = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push({ dateStr: null, dayNum: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(
        d
      ).padStart(2, '0')}`;
      cells.push({ dateStr, dayNum: d });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ dateStr: null, dayNum: null });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    const today = new Date();
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDate(getTodayIsoDate());
  };

  const selectedDayInfo = dayMap.get(selectedDate);
  const selectedDayTrades = selectedDayInfo?.trades || [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
      {/* Left: Calendar Grid */}
      <div className="xl:col-span-8 bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-base font-semibold text-[#172033]">
              {formatMonthYearId(viewYear, viewMonth)}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#64748B] mt-1">
              <span>
                Net Bulan Ini:{' '}
                <strong
                  className={`font-mono tabular-nums ${
                    monthSummary.totalPl >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                  }`}
                >
                  {formatCurrency(monthSummary.totalPl, currency, { signed: true })}
                </strong>
              </span>
              <span>·</span>
              <span>{monthSummary.profitDays} Hari Profit</span>
              <span>·</span>
              <span>{monthSummary.lossDays} Hari Loss</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prevMonth}
              className="p-2 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#172033] cursor-pointer"
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="px-3 py-2 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-medium text-[#172033] cursor-pointer"
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-2 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#172033] cursor-pointer"
              aria-label="Bulan berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-5 text-[11px] text-[#64748B] mb-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-green-100 border border-[#16A34A]/50" />
            Hijau: Hari Profit
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-red-100 border border-[#DC2626]/50" />
            Merah: Hari Loss
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#F8FAFC] border border-[#E2E8F0]" />
            Netral: Tidak Ada Transaksi / BE
          </span>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
          {WEEKDAYS_ID.map((w) => (
            <div
              key={w}
              className="text-center text-[11px] font-semibold text-[#64748B] py-1"
            >
              {w}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {calendarCells.map((cell, idx) => {
            if (!cell.dateStr || !cell.dayNum) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="h-16 sm:h-24 rounded-lg bg-[#F8FAFC]/60 border border-[#E2E8F0]/50"
                />
              );
            }

            const info = dayMap.get(cell.dateStr);
            const hasTrades = Boolean(info && info.trades.length > 0);
            const isSelected = selectedDate === cell.dateStr;

            let toneClass =
              'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]';
            if (hasTrades && info) {
              if (info.netPl > 0) {
                toneClass =
                  'bg-green-50 border-green-200 text-[#16A34A] hover:border-[#16A34A]';
              } else if (info.netPl < 0) {
                toneClass =
                  'bg-red-50 border-red-200 text-[#DC2626] hover:border-[#DC2626]';
              } else {
                toneClass =
                  'bg-slate-100 border-slate-300 text-[#172033] hover:border-slate-400';
              }
            }

            return (
              <button
                key={cell.dateStr}
                type="button"
                onClick={() => setSelectedDate(cell.dateStr!)}
                className={`h-16 sm:h-24 rounded-lg border p-1.5 sm:p-2 flex flex-col justify-between text-left transition-colors cursor-pointer ${toneClass} ${
                  isSelected ? 'ring-2 ring-[#0D9488]' : ''
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] sm:text-xs font-mono font-semibold text-[#172033]">
                    {cell.dayNum}
                  </span>
                  {hasTrades && info && (
                    <span className="text-[10px] font-mono text-[#64748B]">
                      {info.trades.length}x
                    </span>
                  )}
                </div>

                {hasTrades && info ? (
                  <div className="text-[10px] sm:text-[11px] font-mono font-semibold tabular-nums truncate w-full">
                    {formatCurrency(info.netPl, currency, {
                      signed: true,
                      compact: true,
                    })}
                  </div>
                ) : (
                  <div className="text-[10px] text-[#94A3B8]">—</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Selected Date Trades */}
      <div className="xl:col-span-4 bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5 flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
          <div>
            <h3 className="text-sm font-semibold text-[#172033]">
              {formatShortDateId(selectedDate)}
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              {selectedDayTrades.length} transaksi tercatat
              {selectedDayInfo && selectedDayTrades.length > 0 && (
                <>
                  {' · '}
                  <span
                    className={`font-mono font-semibold ${
                      selectedDayInfo.netPl >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                    }`}
                  >
                    {formatCurrency(selectedDayInfo.netPl, currency, { signed: true })}
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onAddTradeOnDate(selectedDate)}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah</span>
          </button>
        </div>

        <div className="mt-4 flex-1 space-y-3 overflow-y-auto max-h-[520px]">
          {selectedDayTrades.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-[#E2E8F0] rounded-lg px-4 bg-[#F8FAFC]">
              <p className="text-xs font-medium text-[#172033]">
                Tidak ada transaksi pada tanggal ini
              </p>
              <p className="text-[11px] text-[#64748B] mt-1">
                Klik tombol Tambah di atas jika Anda ingin mencatat posisi pada tanggal{' '}
                {formatShortDateId(selectedDate)}.
              </p>
            </div>
          ) : (
            selectedDayTrades.map((t) => (
              <div
                key={t.id}
                onClick={() => onInspectTrade(t)}
                className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#0D9488] transition-colors cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#172033]">
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
                  </div>
                  <span
                    className={`text-xs font-mono font-semibold tabular-nums ${
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
                <div className="flex items-center justify-between text-[11px] text-[#64748B] font-mono tabular-nums">
                  <span>
                    {t.tradeTime} · {t.lotSize.toFixed(2)} lot
                  </span>
                  <span>
                    {formatPrice(t.entryPrice, t.pair)} → {formatPrice(t.exitPrice, t.pair)}
                  </span>
                </div>
                {t.strategy && (
                  <div className="text-[11px] text-[#64748B]">
                    {t.strategy} · {t.session} · {t.status}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
