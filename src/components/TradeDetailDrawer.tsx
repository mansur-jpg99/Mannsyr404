import { useEffect, useState, type ChangeEvent } from 'react';
import { X, Upload, Trash2, Edit3, Maximize2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  CurrencyCode,
  ScreenshotStage,
  Trade,
  TradeScreenshot,
} from '../types.ts';
import { apiRequest } from '../lib/api.ts';
import {
  compressImageFile,
  computePlannedRR,
  formatCurrency,
  formatPrice,
  formatShortDateId,
} from '../utils/formatters.ts';

interface TradeDetailDrawerProps {
  trade: Trade | null;
  currency: CurrencyCode;
  onClose: () => void;
  onEdit: (trade: Trade) => void;
  onScreenshotsChanged: () => Promise<void>;
}

const STAGES: Array<{ id: ScreenshotStage; title: string; desc: string }> = [
  {
    id: 'BEFORE',
    title: 'Sebelum Entry',
    desc: 'Analisa HTF, zona likuiditas, atau rencana entry sebelum posisi dibuka.',
  },
  {
    id: 'DURING',
    title: 'Ketika Posisi Berjalan',
    desc: 'Reaksi harga, pergeseran SL ke BE, atau kondisi saat posisi sedang aktif.',
  },
  {
    id: 'AFTER',
    title: 'Setelah Posisi Ditutup',
    desc: 'Hasil akhir eksekusi (TP/SL/BE) sebagai bahan tinjauan ulang.',
  },
];

export function TradeDetailDrawer({
  trade,
  currency,
  onClose,
  onEdit,
  onScreenshotsChanged,
}: TradeDetailDrawerProps) {
  const [screenshots, setScreenshots] = useState<TradeScreenshot[]>([]);
  const [loadingShots, setLoadingShots] = useState(false);
  const [uploadingStage, setUploadingStage] = useState<ScreenshotStage | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [lightboxImage, setLightboxImage] = useState<TradeScreenshot | null>(null);

  useEffect(() => {
    if (!trade) return;
    let active = true;
    setLoadingShots(true);
    setErrorMsg('');
    apiRequest<TradeScreenshot[]>(`/api/trades/${trade.id}/screenshots`)
      .then((data) => {
        if (active) setScreenshots(data);
      })
      .catch((err) => {
        if (active) setErrorMsg(err.message || 'Gagal memuat screenshot.');
      })
      .finally(() => {
        if (active) setLoadingShots(false);
      });
    return () => {
      active = false;
    };
  }, [trade]);

  const handleUpload = async (
    stage: ScreenshotStage,
    e: ChangeEvent<HTMLInputElement>
  ) => {
    if (!trade) return;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingStage(stage);
    setErrorMsg('');
    try {
      const imageData = await compressImageFile(file);
      const created = await apiRequest<TradeScreenshot>(
        `/api/trades/${trade.id}/screenshots`,
        {
          method: 'POST',
          body: JSON.stringify({
            stage,
            fileName: file.name,
            mimeType: 'image/jpeg',
            imageData,
            caption: file.name,
          }),
        }
      );
      setScreenshots((prev) => [...prev, created]);
      await onScreenshotsChanged();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengunggah screenshot.');
    } finally {
      setUploadingStage(null);
    }
  };

  const handleDeleteShot = async (id: number) => {
    setErrorMsg('');
    try {
      await apiRequest(`/api/screenshots/${id}`, { method: 'DELETE' });
      setScreenshots((prev) => prev.filter((s) => s.id !== id));
      await onScreenshotsChanged();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus screenshot.');
    }
  };

  const plannedRR = trade
    ? computePlannedRR(
        trade.direction,
        trade.entryPrice,
        trade.stopLoss,
        trade.takeProfit
      )
    : null;

  return (
    <>
      <AnimatePresence>
        {trade && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-50 flex justify-end items-end sm:items-stretch bg-[#1A2421]/35 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl glass-dock rounded-t-[28px] sm:rounded-t-none sm:rounded-l-[28px] h-[92vh] sm:h-full flex flex-col"
            >
              <div className="sm:hidden pt-2.5 flex justify-center shrink-0">
                <div className="w-10 h-1 rounded-full bg-[#1A2421]/18" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#1A2421]/8 shrink-0">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-base font-bold text-[#1A2421]">{trade.pair}</h3>
                    <span
                      className={`text-xs font-semibold ${
                        trade.direction === 'BUY' ? 'text-[#15803D]' : 'text-[#B91C1C]'
                      }`}
                    >
                      {trade.direction}
                    </span>
                    <span className="text-[#52625D]/40">·</span>
                    <span className="text-xs font-mono font-semibold text-[#52625D]">
                      {trade.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#52625D] mt-0.5 font-mono tabular-nums">
                    {formatShortDateId(trade.tradeDate)} · {trade.tradeTime} ·{' '}
                    {trade.session}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(trade)}
                    className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-white/75 hover:bg-white border border-white/85 text-xs font-semibold text-[#1A2421] cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#0D7A72]" />
                    <span>Ubah</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-2xl text-[#52625D] hover:text-[#1A2421] hover:bg-white/75 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-6 pb-safe">
                {/* Key Figures */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-white/55 border border-white/80">
                    <div className="text-[11px] text-[#52625D]">Net P/L</div>
                    <div
                      className={`mt-1 text-sm font-mono font-bold tabular-nums ${
                        trade.netPl > 0
                          ? 'text-[#15803D]'
                          : trade.netPl < 0
                          ? 'text-[#B91C1C]'
                          : 'text-[#1A2421]'
                      }`}
                    >
                      {trade.status === 'OPEN'
                        ? 'Posisi Berjalan'
                        : formatCurrency(trade.netPl, currency, { signed: true })}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/55 border border-white/80">
                    <div className="text-[11px] text-[#52625D]">Lot Size</div>
                    <div className="mt-1 text-sm font-mono font-bold tabular-nums text-[#1A2421]">
                      {trade.lotSize.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/55 border border-white/80">
                    <div className="text-[11px] text-[#52625D]">Rencana R:R</div>
                    <div className="mt-1 text-sm font-mono font-bold tabular-nums text-[#0D7A72]">
                      {plannedRR ? `1 : ${plannedRR.toFixed(2)}` : '—'}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/55 border border-white/80">
                    <div className="text-[11px] text-[#52625D]">Emosi</div>
                    <div className="mt-1 text-sm font-semibold text-[#1A2421] truncate">
                      {trade.emotion || '—'}
                    </div>
                  </div>
                </div>

                {/* Price & Cost Grid */}
                <div className="p-4 rounded-2xl bg-white/55 border border-white/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-[#52625D] block">Entry Price</span>
                    <span className="font-mono font-semibold tabular-nums text-[#1A2421] mt-0.5 block">
                      {formatPrice(trade.entryPrice, trade.pair)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#52625D] block">Exit Price</span>
                    <span className="font-mono font-semibold tabular-nums text-[#1A2421] mt-0.5 block">
                      {formatPrice(trade.exitPrice, trade.pair)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#52625D] block">Stop Loss</span>
                    <span className="font-mono font-semibold tabular-nums text-[#B91C1C] mt-0.5 block">
                      {formatPrice(trade.stopLoss, trade.pair)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#52625D] block">Take Profit</span>
                    <span className="font-mono font-semibold tabular-nums text-[#15803D] mt-0.5 block">
                      {formatPrice(trade.takeProfit, trade.pair)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#52625D] block">Gross P/L</span>
                    <span className="font-mono tabular-nums text-[#1A2421] mt-0.5 block">
                      {formatCurrency(trade.grossPl, currency, { signed: true })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#52625D] block">Commission</span>
                    <span className="font-mono tabular-nums text-[#1A2421] mt-0.5 block">
                      {formatCurrency(trade.commission, currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#52625D] block">Swap</span>
                    <span className="font-mono tabular-nums text-[#1A2421] mt-0.5 block">
                      {formatCurrency(trade.swap, currency, { signed: true })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#52625D] block">Strategi</span>
                    <span className="text-[#1A2421] font-semibold mt-0.5 block">
                      {trade.strategy || '—'}
                    </span>
                  </div>
                </div>

                {/* Entry Reason & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-white/55 border border-white/80">
                    <div className="text-xs font-bold text-[#1A2421] mb-1.5">
                      Alasan Entry
                    </div>
                    <p className="text-xs text-[#52625D] leading-relaxed whitespace-pre-wrap">
                      {trade.entryReason || 'Belum ada alasan entry yang dicatat.'}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/55 border border-white/80">
                    <div className="text-xs font-bold text-[#1A2421] mb-1.5">
                      Catatan Transaksi
                    </div>
                    <p className="text-xs text-[#52625D] leading-relaxed whitespace-pre-wrap">
                      {trade.notes || 'Belum ada catatan tambahan.'}
                    </p>
                  </div>
                </div>

                {/* Private Screenshot Gallery */}
                <div className="pt-4 border-t border-[#1A2421]/8 space-y-5">
                  <div>
                    <h4 className="text-sm font-bold text-[#1A2421]">
                      Galeri Screenshot Transaksi
                    </h4>
                    <p className="text-xs text-[#52625D] mt-0.5">
                      Dokumentasi visual privat yang hanya dapat dilihat oleh akun Anda.
                    </p>
                  </div>

                  {errorMsg && (
                    <div className="p-3 rounded-2xl bg-[#DC2626]/10 border border-[#DC2626]/20 text-xs text-[#B91C1C] font-medium">
                      {errorMsg}
                    </div>
                  )}

                  {loadingShots ? (
                    <div className="py-8 text-center text-xs text-[#52625D]">
                      Memuat screenshot transaksi...
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {STAGES.map((stage) => {
                        const stageShots = screenshots.filter(
                          (s) => s.stage === stage.id
                        );
                        return (
                          <div
                            key={stage.id}
                            className="p-4 rounded-2xl bg-white/55 border border-white/80 space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <div className="text-xs font-bold text-[#1A2421]">
                                  {stage.title}
                                </div>
                                <div className="text-[11px] text-[#52625D]">
                                  {stage.desc}
                                </div>
                              </div>
                              <label className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-white/85 hover:bg-white border border-white/90 text-xs font-semibold text-[#0D7A72] cursor-pointer shrink-0 self-start sm:self-auto">
                                <Upload className="w-3.5 h-3.5" />
                                <span>
                                  {uploadingStage === stage.id
                                    ? 'Mengunggah...'
                                    : 'Unggah Gambar'}
                                </span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => handleUpload(stage.id, e)}
                                />
                              </label>
                            </div>

                            {stageShots.length === 0 ? (
                              <div className="py-4 text-center text-[11px] text-[#52625D] border border-dashed border-[#1A2421]/15 rounded-2xl bg-white/40">
                                Belum ada screenshot untuk tahap {stage.title.toLowerCase()}.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {stageShots.map((shot) => (
                                  <div
                                    key={shot.id}
                                    className="group relative rounded-2xl overflow-hidden border border-white/85 bg-white/75"
                                  >
                                    <img
                                      src={shot.imageData}
                                      alt={shot.fileName}
                                      onClick={() => setLightboxImage(shot)}
                                      className="w-full h-40 object-cover cursor-pointer hover:opacity-95 transition-opacity"
                                    />
                                    <div className="px-3 py-2 flex items-center justify-between text-[11px] border-t border-[#1A2421]/8">
                                      <span className="text-[#52625D] truncate max-w-[150px]">
                                        {shot.fileName}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setLightboxImage(shot)}
                                          className="text-[#52625D] hover:text-[#0D7A72] cursor-pointer"
                                          title="Perbesar"
                                        >
                                          <Maximize2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteShot(shot.id)}
                                          className="text-[#52625D] hover:text-[#B91C1C] cursor-pointer"
                                          title="Hapus screenshot"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[60] bg-[#1A2421]/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="max-w-5xl max-h-[90vh] flex flex-col items-end gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="p-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxImage.imageData}
              alt={lightboxImage.fileName}
              className="max-w-full max-h-[82vh] object-contain rounded-2xl border border-white/20 bg-white"
            />
          </div>
        </div>
      )}
    </>
  );
}
