import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { X, Upload, Trash2 } from 'lucide-react';
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

  if (!open) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#172033]/40 backdrop-blur-xs">
      <div className="w-full max-w-3xl bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl overflow-hidden max-h-[92vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#E2E8F0] shrink-0">
          <div>
            <h3 className="text-base font-semibold text-[#172033]">
              {editingTrade ? 'Ubah Transaksi Trading' : 'Catat Transaksi Trading Baru'}
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Akun mata uang {currency} · Lengkapi parameter eksekusi dan psikologi trading
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#64748B] hover:text-[#172033] hover:bg-[#F1F5F9] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#DC2626] font-medium">
              {errorMsg}
            </div>
          )}

          {/* Section 1: Identity & Direction */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#172033] mb-1.5">
                Tanggal Transaksi
              </label>
              <input
                type="date"
                required
                value={tradeDate}
                onChange={(e) => setTradeDate(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm font-mono text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172033] mb-1.5">
                Waktu Entry
              </label>
              <input
                type="time"
                value={tradeTime}
                onChange={(e) => setTradeTime(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm font-mono text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172033] mb-1.5">
                Pair Forex
              </label>
              <input
                type="text"
                list="forex-pairs-list"
                required
                value={pair}
                onChange={(e) => setPair(e.target.value.toUpperCase())}
                placeholder="XAUUSD"
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm font-mono uppercase text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
              />
              <datalist id="forex-pairs-list">
                {COMMON_PAIRS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#172033] mb-1.5">
                Arah Posisi
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                <button
                  type="button"
                  onClick={() => setDirection('BUY')}
                  className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    direction === 'BUY'
                      ? 'bg-[#16A34A] text-white'
                      : 'text-[#64748B] hover:text-[#172033]'
                  }`}
                >
                  BUY
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('SELL')}
                  className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    direction === 'SELL'
                      ? 'bg-[#DC2626] text-white'
                      : 'text-[#64748B] hover:text-[#172033]'
                  }`}
                >
                  SELL
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Prices & Volume */}
          <div className="pt-4 border-t border-[#E2E8F0]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
              <span className="text-xs font-semibold text-[#172033]">
                Parameter Harga &amp; Volume
              </span>
              <span className="text-xs font-mono font-medium tabular-nums text-[#0D9488]">
                Rencana Risk/Reward: {plannedRR ? `1 : ${plannedRR.toFixed(2)}` : '—'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs text-[#64748B] mb-1">Entry Price</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  placeholder="2650.50"
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-2 text-xs font-mono tabular-nums text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#64748B] mb-1">Exit Price</label>
                <input
                  type="number"
                  step="any"
                  value={exitPrice}
                  onChange={(e) => setExitPrice(e.target.value)}
                  placeholder="Opsional"
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-2 text-xs font-mono tabular-nums text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#64748B] mb-1">Stop Loss</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  placeholder="2645.00"
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-2 text-xs font-mono tabular-nums text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#64748B] mb-1">Take Profit</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  placeholder="2665.00"
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-2 text-xs font-mono tabular-nums text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#64748B] mb-1">Lot Size</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={lotSize}
                  onChange={(e) => setLotSize(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-2 text-xs font-mono tabular-nums text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#64748B] mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TradeStatus)}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-2 text-xs font-semibold text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
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
          <div className="pt-4 border-t border-[#E2E8F0]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
              <span className="text-xs font-semibold text-[#172033]">
                Hasil Keuangan ({currency})
              </span>
              <span className="text-[11px] text-[#64748B]">
                Rumus otomatis: Net P/L = Gross P/L - |Komisi| + Swap
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-[#64748B] mb-1">Gross P/L</label>
                <input
                  type="number"
                  step="any"
                  value={grossPl}
                  onChange={(e) => {
                    setGrossPl(e.target.value);
                    setManualNetPl(false);
                  }}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#64748B] mb-1">Commission</label>
                <input
                  type="number"
                  step="any"
                  value={commission}
                  onChange={(e) => {
                    setCommission(e.target.value);
                    setManualNetPl(false);
                  }}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#64748B] mb-1">Swap</label>
                <input
                  type="number"
                  step="any"
                  value={swap}
                  onChange={(e) => {
                    setSwap(e.target.value);
                    setManualNetPl(false);
                  }}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#0D9488] mb-1">
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
                  className="w-full bg-[#F8FAFC] border border-[#0D9488]/40 rounded-lg px-3 py-2 text-xs font-mono font-semibold tabular-nums text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Context & Psychology */}
          <div className="pt-4 border-t border-[#E2E8F0] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#172033] mb-1.5">
                  Strategi
                </label>
                <input
                  type="text"
                  list="strategy-presets-list"
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  placeholder="Pilih atau ketik strategi"
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
                />
                <datalist id="strategy-presets-list">
                  {STRATEGY_PRESETS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#172033] mb-1.5">
                  Sesi Trading
                </label>
                <select
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
                >
                  <option value="Asia">Asia (Tokyo)</option>
                  <option value="London">London</option>
                  <option value="New York">New York</option>
                  <option value="Overlap">London - NY Overlap</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#172033] mb-1.5">
                  Kondisi Emosi
                </label>
                <select
                  value={emotion}
                  onChange={(e) => setEmotion(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
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
                <label className="block text-xs font-medium text-[#172033] mb-1.5">
                  Alasan Entry (Confluence / Setup)
                </label>
                <textarea
                  rows={3}
                  value={entryReason}
                  onChange={(e) => setEntryReason(e.target.value)}
                  placeholder="Contoh: Sweep Asia High lalu MSS M5 dengan FVG + OTE 70.5%."
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#172033] placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#0D9488]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#172033] mb-1.5">
                  Catatan Transaksi &amp; Manajemen Risiko
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan eksekusi, partial profit, atau pelajaran dari transaksi ini."
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#172033] placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#0D9488]"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Optional Screenshot Upload Queue */}
          <div className="pt-4 border-t border-[#E2E8F0]">
            <div className="mb-3">
              <span className="text-xs font-semibold text-[#172033]">
                Lampirkan Screenshot Chart (Privat)
              </span>
              <p className="text-[11px] text-[#64748B]">
                Anda juga dapat mengunggah atau mengelola screenshot kapan saja dari detail transaksi.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['BEFORE', 'DURING', 'AFTER'] as const).map((stage) => (
                <label
                  key={stage}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border border-dashed border-[#CBD5E1] hover:border-[#0D9488] bg-[#F8FAFC] text-xs font-medium text-[#172033] hover:text-[#0D9488] cursor-pointer transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 shrink-0" />
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
                    className="relative rounded-lg overflow-hidden border border-[#E2E8F0] bg-[#F8FAFC]"
                  >
                    <img
                      src={shot.imageData}
                      alt={shot.caption}
                      className="w-full h-24 object-cover"
                    />
                    <div className="px-2.5 py-1.5 flex items-center justify-between text-[11px]">
                      <span className="text-[#0D9488] font-medium truncate">
                        {STAGE_LABELS[shot.stage]}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingShots((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-[#64748B] hover:text-[#DC2626] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-lg border border-[#E2E8F0] text-xs font-medium text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="py-2.5 px-5 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-50 text-white font-semibold text-xs cursor-pointer"
            >
              {saving
                ? 'Menyimpan...'
                : editingTrade
                ? 'Perbarui Transaksi'
                : 'Simpan Transaksi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
