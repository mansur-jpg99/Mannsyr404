import { useEffect, useState, type ChangeEvent } from 'react';
import { X, Upload, Trash2, Edit3, Maximize2 } from 'lucide-react';
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

  if (!trade) return null;

  const plannedRR = computePlannedRR(
    trade.direction,
    trade.entryPrice,
    trade.stopLoss,
    trade.takeProfit
  );

  const handleUpload = async (
    stage: ScreenshotStage,
    e: ChangeEvent<HTMLInputElement>
  ) => {
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

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end bg-[#172033]/40 backdrop-blur-xs">
        <div className="w-full max-w-2xl bg-[#FFFFFF] border-l border-[#E2E8F0] h-full flex flex-col shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] shrink-0">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-[#172033]">{trade.pair}</h3>
                <span
                  className={`text-xs font-semibold ${
                    trade.direction === 'BUY' ? 'text-[#16A34A]' : 'text-[#DC2626]'
                  }`}
                >
                  {trade.direction}
                </span>
                <span className="text-[#CBD5E1]">·</span>
                <span className="text-xs font-mono font-medium text-[#64748B]">
                  {trade.status}
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5 font-mono tabular-nums">
                {formatShortDateId(trade.tradeDate)} · {trade.tradeTime} · {trade.session}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onEdit(trade)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-medium text-[#172033] cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Ubah</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-[#64748B] hover:text-[#172033] hover:bg-[#F1F5F9] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
            {/* Key Figures */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[11px] text-[#64748B]">Net P/L</div>
                <div
                  className={`mt-1 text-sm font-mono font-semibold tabular-nums ${
                    trade.netPl > 0
                      ? 'text-[#16A34A]'
                      : trade.netPl < 0
                      ? 'text-[#DC2626]'
                      : 'text-[#172033]'
                  }`}
                >
                  {trade.status === 'OPEN'
                    ? 'Posisi Berjalan'
                    : formatCurrency(trade.netPl, currency, { signed: true })}
                </div>
              </div>
              <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[11px] text-[#64748B]">Lot Size</div>
                <div className="mt-1 text-sm font-mono font-semibold tabular-nums text-[#172033]">
                  {trade.lotSize.toFixed(2)}
                </div>
              </div>
              <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[11px] text-[#64748B]">Rencana R:R</div>
                <div className="mt-1 text-sm font-mono font-semibold tabular-nums text-[#0D9488]">
                  {plannedRR ? `1 : ${plannedRR.toFixed(2)}` : '—'}
                </div>
              </div>
              <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[11px] text-[#64748B]">Emosi</div>
                <div className="mt-1 text-sm font-medium text-[#172033] truncate">
                  {trade.emotion || '—'}
                </div>
              </div>
            </div>

            {/* Price & Cost Grid */}
            <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-[#64748B] block">Entry Price</span>
                <span className="font-mono font-medium tabular-nums text-[#172033] mt-0.5 block">
                  {formatPrice(trade.entryPrice, trade.pair)}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">Exit Price</span>
                <span className="font-mono font-medium tabular-nums text-[#172033] mt-0.5 block">
                  {formatPrice(trade.exitPrice, trade.pair)}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">Stop Loss</span>
                <span className="font-mono font-medium tabular-nums text-[#DC2626] mt-0.5 block">
                  {formatPrice(trade.stopLoss, trade.pair)}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">Take Profit</span>
                <span className="font-mono font-medium tabular-nums text-[#16A34A] mt-0.5 block">
                  {formatPrice(trade.takeProfit, trade.pair)}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">Gross P/L</span>
                <span className="font-mono tabular-nums text-[#172033] mt-0.5 block">
                  {formatCurrency(trade.grossPl, currency, { signed: true })}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">Commission</span>
                <span className="font-mono tabular-nums text-[#172033] mt-0.5 block">
                  {formatCurrency(trade.commission, currency)}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">Swap</span>
                <span className="font-mono tabular-nums text-[#172033] mt-0.5 block">
                  {formatCurrency(trade.swap, currency, { signed: true })}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">Strategi</span>
                <span className="text-[#172033] font-medium mt-0.5 block">
                  {trade.strategy || '—'}
                </span>
              </div>
            </div>

            {/* Entry Reason & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-xs font-semibold text-[#172033] mb-1.5">
                  Alasan Entry
                </div>
                <p className="text-xs text-[#64748B] leading-relaxed whitespace-pre-wrap">
                  {trade.entryReason || 'Belum ada alasan entry yang dicatat.'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-xs font-semibold text-[#172033] mb-1.5">
                  Catatan Transaksi
                </div>
                <p className="text-xs text-[#64748B] leading-relaxed whitespace-pre-wrap">
                  {trade.notes || 'Belum ada catatan tambahan.'}
                </p>
              </div>
            </div>

            {/* Private Screenshot Gallery */}
            <div className="pt-4 border-t border-[#E2E8F0] space-y-5">
              <div>
                <h4 className="text-sm font-semibold text-[#172033]">
                  Galeri Screenshot Transaksi
                </h4>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Dokumentasi visual privat yang hanya dapat dilihat oleh akun Anda.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#DC2626] font-medium">
                  {errorMsg}
                </div>
              )}

              {loadingShots ? (
                <div className="py-8 text-center text-xs text-[#64748B]">
                  Memuat screenshot transaksi...
                </div>
              ) : (
                <div className="space-y-4">
                  {STAGES.map((stage) => {
                    const stageShots = screenshots.filter((s) => s.stage === stage.id);
                    return (
                      <div
                        key={stage.id}
                        className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-semibold text-[#172033]">
                              {stage.title}
                            </div>
                            <div className="text-[11px] text-[#64748B]">
                              {stage.desc}
                            </div>
                          </div>
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFFFFF] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-medium text-[#0D9488] cursor-pointer shrink-0 self-start sm:self-auto">
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
                          <div className="py-4 text-center text-[11px] text-[#64748B] border border-dashed border-[#CBD5E1] rounded-lg bg-[#FFFFFF]">
                            Belum ada screenshot untuk tahap {stage.title.toLowerCase()}.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {stageShots.map((shot) => (
                              <div
                                key={shot.id}
                                className="group relative rounded-lg overflow-hidden border border-[#E2E8F0] bg-[#FFFFFF]"
                              >
                                <img
                                  src={shot.imageData}
                                  alt={shot.fileName}
                                  onClick={() => setLightboxImage(shot)}
                                  className="w-full h-40 object-cover cursor-pointer hover:opacity-95 transition-opacity"
                                />
                                <div className="px-3 py-2 flex items-center justify-between text-[11px] border-t border-[#E2E8F0]">
                                  <span className="text-[#64748B] truncate max-w-[150px]">
                                    {shot.fileName}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setLightboxImage(shot)}
                                      className="text-[#64748B] hover:text-[#0D9488] cursor-pointer"
                                      title="Perbesar"
                                    >
                                      <Maximize2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteShot(shot.id)}
                                      className="text-[#64748B] hover:text-[#DC2626] cursor-pointer"
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
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[60] bg-[#172033]/85 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="max-w-5xl max-h-[90vh] flex flex-col items-end gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="p-2 rounded-lg bg-white/15 hover:bg-white/25 text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxImage.imageData}
              alt={lightboxImage.fileName}
              className="max-w-full max-h-[82vh] object-contain rounded-lg border border-white/20 bg-white"
            />
          </div>
        </div>
      )}
    </>
  );
}
