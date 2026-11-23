import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { X, Upload, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  CurrencyCode,
  ScreenshotStage,
  Trade,
  TradeDirection,
  TradeStatus,
} from '../types.ts';
import { apiRequest } from '../lib/api.ts';
import {
  compressImageFile,
  computePlannedRR,
  formatCurrency,
  getTodayIsoDate,
} from '../utils/formatters.ts';

interface TradeFormModalProps {
  open: boolean;
  onClose: () => void;
  accountId: number;
  currency: CurrencyCode;
  editingTrade: Trade | null;
  defaultDate?: string;
  defaultSession?: string;
  defaultLotSize?: string;
  onSaved: () => Promise<void>;
}

interface PendingScreenshot {
  stage: ScreenshotStage;
  fileName: string;
  mimeType: string;
  imageData: string;
  caption: string;
}

const COMMON_PAIRS = [
  'XAUUSD',
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'GBPJPY',
  'AUDUSD',
  'USDCAD',
  'EURJPY',
  'NZDUSD',
  'USDCHF',
  'NAS100',
  'US30',
  'BTCUSD',
];

const STRATEGY_PRESETS = [
  'ICT Silver Bullet',
  'FVG + Liquidity Sweep',
  'Order Block Mitigation',
  'Market Structure Shift (MSS)',
  'London Killzone',
  'NY Killzone',
  'Breakout Retest',
  'Supply & Demand',
];

const EMOTION_OPTIONS = [
  'Tenang',
  'Disiplin',
  'Percaya Diri',
  'Ragu-ragu',
  'FOMO',
  'Serakah',
  'Takut',
  'Frustrasi / Revenge',
];

const STAGE_LABELS: Record<ScreenshotStage, string> = {
  BEFORE: 'Sebelum Entry',
  DURING: 'Posisi Berjalan',
  AFTER: 'Setelah Ditutup',
};

export function TradeFormModal({
  open,
  onClose,
  accountId,
  currency,
  editingTrade,
  defaultDate,
  defaultSession = 'London',
  defaultLotSize = '0.10',
  onSaved,
}: TradeFormModalProps) {
  const [tradeDate, setTradeDate] = useState(getTodayIsoDate());
  const [tradeTime, setTradeTime] = useState('09:00');
  const [pair, setPair] = useState('XAUUSD');
  const [direction, setDirection] = useState<TradeDirection>('BUY');
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [lotSize, setLotSize] = useState(defaultLotSize);
  const [status, setStatus] = useState<TradeStatus>('WIN');
  const [grossPl, setGrossPl] = useState('0');
  const [commission, setCommission] = useState('0');
  const [swap, setSwap] = useState('0');
  const [netPl, setNetPl] = useState('0');
  const [manualNetPl, setManualNetPl] = useState(false);
  const [strategy, setStrategy] = useState('FVG + Liquidity Sweep');
  const [session, setSession] = useState(defaultSession);
  const [emotion, setEmotion] = useState('Tenang');
  const [entryReason, setEntryReason] = useState('');
  const [notes, setNotes] = useState('');

  const [pendingShots, setPendingShots] = useState<PendingScreenshot[]>([]);
  const [uploadingStage, setUploadingStage] = useState<ScreenshotStage | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    setErrorMsg('');
    setPendingShots([]);
    if (editingTrade) {
      setTradeDate(editingTrade.tradeDate);
      setTradeTime(editingTrade.tradeTime || '09:00');
      setPair(editingTrade.pair);
      setDirection(editingTrade.direction);
      setEntryPrice(String(editingTrade.entryPrice));
      setExitPrice(
        editingTrade.exitPrice !== null && editingTrade.exitPrice !== undefined
          ? String(editingTrade.exitPrice)
          : ''
      );
      setStopLoss(String(editingTrade.stopLoss));
      setTakeProfit(String(editingTrade.takeProfit));
      setLotSize(String(editingTrade.lotSize));
      setStatus(editingTrade.status);
      setGrossPl(String(editingTrade.grossPl));
      setCommission(String(editingTrade.commission));
      setSwap(String(editingTrade.swap));
      setNetPl(String(editingTrade.netPl));
      setManualNetPl(true);
      setStrategy(editingTrade.strategy);
      setSession(editingTrade.session);
      setEmotion(editingTrade.emotion);
      setEntryReason(editingTrade.entryReason);
      setNotes(editingTrade.notes);
    } else {
      setTradeDate(defaultDate || getTodayIsoDate());
      setTradeTime('09:00');
      setPair('XAUUSD');
      setDirection('BUY');
      setEntryPrice('');
      setExitPrice('');
      setStopLoss('');
      setTakeProfit('');
      setLotSize(defaultLotSize);
      setStatus('WIN');
      setGrossPl('0');
      setCommission('0');
      setSwap('0');
      setNetPl('0');
      setManualNetPl(false);
      setStrategy('FVG + Liquidity Sweep');
      setSession(defaultSession);
      setEmotion('Tenang');
      setEntryReason('');
      setNotes('');
    }
  }, [open, editingTrade, defaultDate, defaultSession, defaultLotSize]);

  useEffect(() => {
    if (manualNetPl) return;
    const g = Number(grossPl) || 0;
    const c = Math.abs(Number(commission) || 0);
    const s = Number(swap) || 0;
    const calculated = g - c + s;
    setNetPl(Number.isFinite(calculated) ? String(Number(calculated.toFixed(2))) : '0');
  }, [grossPl, commission, swap, manualNetPl]);

  const plannedRR = computePlannedRR(
    direction,
    Number(entryPrice),
    Number(stopLoss),
    Number(takeProfit)
  );

  const handleStageFileChange = async (
    stage: ScreenshotStage,
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingStage(stage);
    setErrorMsg('');
    try {
      const compressed = await compressImageFile(file);
      setPendingShots((prev) => [
        ...prev,
        {
          stage,
          fileName: file.name,
          mimeType: 'image/jpeg',
          imageData: compressed,
          caption: STAGE_LABELS[stage],
        },
      ]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memproses screenshot.');
    } finally {
      setUploadingStage(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const entry = Number(entryPrice);
    const sl = Number(stopLoss);
    const tp = Number(takeProfit);
    const lot = Number(lotSize);
    const exit = exitPrice.trim() === '' ? null : Number(exitPrice);

    if (
      !tradeDate ||
      !pair.trim() ||
      Number.isNaN(entry) ||
      Number.isNaN(sl) ||
      Number.isNaN(tp) ||
      Number.isNaN(lot) ||
      lot <= 0
    ) {
      setErrorMsg('Pastikan Tanggal, Pair, Entry, Stop Loss, Take Profit, dan Lot terisi valid.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        accountId,
        tradeDate,
        tradeTime,
        pair: pair.toUpperCase().trim(),
        direction,
        entryPrice: entry,
        exitPrice: exit !== null && !Number.isNaN(exit) ? exit : null,
        stopLoss: sl,
        takeProfit: tp,
        lotSize: lot,
        status,
        grossPl: Number(grossPl) || 0,
        commission: Number(commission) || 0,
        swap: Number(swap) || 0,
        netPl: status === 'OPEN' ? 0 : Number(netPl) || 0,
        strategy: strategy.trim(),
        session,
        emotion,
        entryReason: entryReason.trim(),
        notes: notes.trim(),
      };

      let savedTradeId: number;
      if (editingTrade) {
        const updated = await apiRequest<Trade>(`/api/trades/${editingTrade.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        savedTradeId = updated.id;
      } else {
        const created = await apiRequest<Trade>('/api/trades', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        savedTradeId = created.id;
      }

      for (const shot of pendingShots) {
        await apiRequest(`/api/trades/${savedTradeId}/screenshots`, {
          method: 'POST',
          body: JSON.stringify(shot),
        });
      }

      await onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan transaksi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-[#1A2421]/35 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl glass-dock rounded-t-[28px] sm:rounded-[28px] overflow-hidden max-h-[92vh] flex flex-col"
          >
            <div className="sm:hidden pt-2.5 flex justify-center shrink-0">
              <div className="w-10 h-1 rounded-full bg-[#1A2421]/18" />
            </div>

            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#1A2421]/8 shrink-0">
              <div>
                <h3 className="text-base font-bold text-[#1A2421]">
                  {editingTrade ? 'Ubah Transaksi Trading' : 'Catat Transaksi Trading Baru'}
                </h3>
                <p className="text-xs text-[#52625D] mt-0.5">
                  Akun mata uang {currency} · Lengkapi parameter eksekusi dan psikologi trading
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-2xl text-[#52625D] hover:text-[#1A2421] hover:bg-white/75 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-5 sm:p-6 overflow-y-auto space-y-6 pb-safe"
            >
              {errorMsg && (
                <div className="p-3 rounded-2xl bg-[#DC2626]/10 border border-[#DC2626]/20 text-xs text-[#B91C1C] font-medium">
                  {errorMsg}
                </div>
              )}

              {/* Section 1: Identity & Direction */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
                    Tanggal Transaksi
                  </label>
                  <input
                    type="date"
                    required
                    value={tradeDate}
                    onChange={(e) => setTradeDate(e.target.value)}
                    className="w-full min-h-[42px] glass-input rounded-2xl px-3.5 py-2 text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
                    Waktu Entry
                  </label>
                  <input
                    type="time"
                    value={tradeTime}
                    onChange={(e) => setTradeTime(e.target.value)}
                    className="w-full min-h-[42px] glass-input rounded-2xl px-3.5 py-2 text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
                    Pair Forex
                  </label>
                  <input
                    type="text"
                    list="forex-pairs-list"
                    required
                    value={pair}
                    onChange={(e) => setPair(e.target.value.toUpperCase())}
                    placeholder="XAUUSD"
                    className="w-full min-h-[42px] glass-input rounded-2xl px-3.5 py-2 text-sm font-mono uppercase"
                  />
                  <datalist id="forex-pairs-list">
                    {COMMON_PAIRS.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
                    Arah Posisi
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-1 glass-segmented rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setDirection('BUY')}
                      className={`min-h-[36px] py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                        direction === 'BUY'
                          ? 'bg-[#16A34A] text-white shadow-2xs'
                          : 'text-[#52625D] hover:text-[#1A2421]'
                      }`}
                    >
                      BUY
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection('SELL')}
                      className={`min-h-[36px] py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                        direction === 'SELL'
                          ? 'bg-[#DC2626] text-white shadow-2xs'
                          : 'text-[#52625D] hover:text-[#1A2421]'
                      }`}
                    >
                      SELL
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 2: Prices & Volume */}
              <div className="pt-4 border-t border-[#1A2421]/8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
                  <span className="text-xs font-bold text-[#1A2421]">
                    Parameter Harga &amp; Volume
                  </span>
                  <span className="text-xs font-mono font-semibold tabular-nums text-[#0D7A72]">
                    Rencana Risk/Reward: {plannedRR ? `1 : ${plannedRR.toFixed(2)}` : '—'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div>
                    <label className="block text-xs text-[#52625D] mb-1">Entry Price</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={entryPrice}
                      onChange={(e) => setEntryPrice(e.target.value)}
                      placeholder="2650.50"
                      className="w-full min-h-[40px] glass-input rounded-2xl px-3 py-2 text-xs font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#52625D] mb-1">Exit Price</label>
                    <input
                      type="number"
                      step="any"
                      value={exitPrice}
                      onChange={(e) => setExitPrice(e.target.value)}
                      placeholder="Opsional"
                      className="w-full min-h-[40px] glass-input rounded-2xl px-3 py-2 text-xs font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#52625D] mb-1">Stop Loss</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      placeholder="2645.00"
                      className="w-full min-h-[40px] glass-input rounded-2xl px-3 py-2 text-xs font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#52625D] mb-1">Take Profit</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(e.target.value)}
                      placeholder="2665.00"
                      className="w-full min-h-[40px] glass-input rounded-2xl px-3 py-2 text-xs font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#52625D] mb-1">Lot Size</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={lotSize}
                      onChange={(e) => setLotSize(e.target.value)}
                      className="w-full min-h-[40px] glass-input rounded-2xl px-3 py-2 text-xs font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#52625D] mb-1">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as TradeStatus)}
                      className="w-full min-h-[40px] glass-input rounded-2xl px-3 py-2 text-xs font-semibold"
                    >
                      <option value="WIN">WIN</option>
                      <option value="LOSS">LOSS</option>
                      <option value="BE">BE (Break Even)</option>
                      <option value="OPEN">OPEN (Berjalan)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: Financial Result */}
              <div className="pt-4 border-t border-[#1A2421]/8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
                  <span className="text-xs font-bold text-[#1A2421]">
                    Hasil Keuangan ({currency})
                  </span>
                  <span className="text-[11px] text-[#52625D]">
                    Rumus otomatis: Net P/L = Gross P/L - |Komisi| + Swap
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-[#52625D] mb-1">Gross P/L</label>
                    <input
                      type="number"
                      step="any"
                      value={grossPl}
                      onChange={(e) => {
                        setGrossPl(e.target.value);
                        setManualNetPl(false);
                      }}
                      className="w-full min-h-[40px] glass-input rounded-2xl px-3 py-2 text-xs font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#52625D] mb-1">Commission</label>
                    <input
                      type="number"
                      step="any"
                      value={commission}
                      onChange={(e) => {
                        setCommission(e.target.value);
                        setManualNetPl(false);
                      }}
                      className="w-full min-h-[40px] glass-input rounded-2xl px-3 py-2 text-xs font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#52625D] mb-1">Swap</label>
                    <input
                      type="number"
                      step="any"
                      value={swap}
                      onChange={(e) => {
                        setSwap(e.target.value);
                        setManualNetPl(false);
                      }}
                      className="w-full min-h-[40px] glass-input rounded-2xl px-3 py-2 text-xs font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0D7A72] mb-1">
                      Net P/L ({formatCurrency(Number(netPl) || 0, currency, { signed: true })})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={netPl}
                      onChange={(e) => {
                        setNetPl(e.target.value);
                        setManualNetPl(true);
                      }}
                      className="w-full min-h-[40px] glass-input rounded-2xl px-3 py-2 text-xs font-mono font-bold tabular-nums border-[#0D7A72]/40"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Context & Psychology */}
              <div className="pt-4 border-t border-[#1A2421]/8 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
                      Strategi
                    </label>
                    <input
                      type="text"
                      list="strategy-presets-list"
                      value={strategy}
                      onChange={(e) => setStrategy(e.target.value)}
                      placeholder="Pilih atau ketik strategi"
                      className="w-full min-h-[42px] glass-input rounded-2xl px-3.5 py-2 text-sm"
                    />
                    <datalist id="strategy-presets-list">
                      {STRATEGY_PRESETS.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
                      Sesi Trading
                    </label>
                    <select
                      value={session}
                      onChange={(e) => setSession(e.target.value)}
                      className="w-full min-h-[42px] glass-input rounded-2xl px-3.5 py-2 text-sm"
                    >
                      <option value="Asia">Asia (Tokyo)</option>
                      <option value="London">London</option>
                      <option value="New York">New York</option>
                      <option value="Overlap">London - NY Overlap</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
                      Kondisi Emosi
                    </label>
                    <select
                      value={emotion}
                      onChange={(e) => setEmotion(e.target.value)}
                      className="w-full min-h-[42px] glass-input rounded-2xl px-3.5 py-2 text-sm"
                    >
                      {EMOTION_OPTIONS.map((em) => (
                        <option key={em} value={em}>
                          {em}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
                      Alasan Entry (Confluence / Setup)
                    </label>
                    <textarea
                      rows={3}
                      value={entryReason}
                      onChange={(e) => setEntryReason(e.target.value)}
                      placeholder="Contoh: Sweep Asia High lalu MSS M5 dengan FVG + OTE 70.5%."
                      className="w-full glass-input rounded-2xl px-3.5 py-2.5 text-sm placeholder:text-[#6B7C76]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
                      Catatan Transaksi &amp; Manajemen Risiko
                    </label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Catatan eksekusi, partial profit, atau pelajaran dari transaksi ini."
                      className="w-full glass-input rounded-2xl px-3.5 py-2.5 text-sm placeholder:text-[#6B7C76]"
                    />
                  </div>
                </div>
              </div>

              {/* Section 5: Optional Screenshot Upload Queue */}
              <div className="pt-4 border-t border-[#1A2421]/8">
                <div className="mb-3">
                  <span className="text-xs font-bold text-[#1A2421]">
                    Lampirkan Screenshot Chart (Privat)
                  </span>
                  <p className="text-[11px] text-[#52625D]">
                    Anda juga dapat mengunggah atau mengelola screenshot kapan saja dari detail transaksi.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(['BEFORE', 'DURING', 'AFTER'] as const).map((stage) => (
                    <label
                      key={stage}
                      className="min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border border-dashed border-[#0D7A72]/35 hover:border-[#0D7A72] bg-white/55 text-xs font-semibold text-[#1A2421] hover:text-[#0D7A72] cursor-pointer transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 shrink-0 text-[#0D7A72]" />
                      <span>
                        {uploadingStage === stage ? 'Memproses...' : STAGE_LABELS[stage]}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleStageFileChange(stage, e)}
                      />
                    </label>
                  ))}
                </div>

                {pendingShots.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {pendingShots.map((shot, idx) => (
                      <div
                        key={`${shot.fileName}-${idx}`}
                        className="relative rounded-2xl overflow-hidden border border-white/80 bg-white/60"
                      >
                        <img
                          src={shot.imageData}
                          alt={shot.caption}
                          className="w-full h-24 object-cover"
                        />
                        <div className="px-3 py-1.5 flex items-center justify-between text-[11px]">
                          <span className="text-[#0D7A72] font-semibold truncate">
                            {STAGE_LABELS[shot.stage]}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingShots((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="text-[#52625D] hover:text-[#B91C1C] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1A2421]/8">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] py-2.5 px-5 rounded-2xl bg-white/75 hover:bg-white border border-white/85 text-xs font-semibold text-[#52625D] hover:text-[#1A2421] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] py-2.5 px-6 rounded-2xl bg-[#0D7A72] hover:bg-[#095E58] disabled:opacity-50 text-white font-semibold text-xs cursor-pointer active:scale-[0.98] transition-all"
                >
                  {saving
                    ? 'Menyimpan...'
                    : editingTrade
                    ? 'Perbarui Transaksi'
                    : 'Simpan Transaksi'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
