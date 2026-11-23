import { useMemo, useState, type FormEvent } from 'react';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import type { CurrencyCode, DailyReview, Trade } from '../types.ts';
import { apiRequest } from '../lib/api.ts';
import {
  formatCurrency,
  formatShortDateId,
  getTodayIsoDate,
} from '../utils/formatters.ts';

interface ReviewsViewProps {
  accountId: number;
  currency: CurrencyCode;
  reviews: DailyReview[];
  trades: Trade[];
  onRefresh: () => Promise<void>;
}

const EMOTIONAL_STATES = [
  'Tenang & Objektif',
  'Percaya Diri & Disiplin',
  'Cemas / Ragu',
  'FOMO (Takut Ketinggalan)',
  'Frustrasi / Revenge Trading',
  'Lelah / Kurang Fokus',
];

export function ReviewsView({
  accountId,
  currency,
  reviews,
  trades,
  onRefresh,
}: ReviewsViewProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [reviewDate, setReviewDate] = useState(getTodayIsoDate());
  const [emotionalState, setEmotionalState] = useState(EMOTIONAL_STATES[0]);
  const [disciplineScore, setDisciplineScore] = useState(8);
  const [mistakes, setMistakes] = useState('');
  const [dailyReflection, setDailyReflection] = useState('');
  const [progressNotes, setProgressNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const dayStatsMap = useMemo(() => {
    const map = new Map<string, { count: number; netPl: number }>();
    for (const t of trades) {
      const curr = map.get(t.tradeDate) || { count: 0, netPl: 0 };
      curr.count += 1;
      if (t.status !== 'OPEN') curr.netPl += t.netPl;
      map.set(t.tradeDate, curr);
    }
    return map;
  }, [trades]);

  const resetForm = () => {
    setEditingId(null);
    setReviewDate(getTodayIsoDate());
    setEmotionalState(EMOTIONAL_STATES[0]);
    setDisciplineScore(8);
    setMistakes('');
    setDailyReflection('');
    setProgressNotes('');
  };

  const handleEdit = (r: DailyReview) => {
    setEditingId(r.id);
    setReviewDate(r.reviewDate);
    setEmotionalState(r.emotionalState);
    setDisciplineScore(r.disciplineScore);
    setMistakes(r.mistakes);
    setDailyReflection(r.dailyReflection);
    setProgressNotes(r.progressNotes);
    setErrorMsg('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSaving(true);
    try {
      const payload = {
        accountId,
        reviewDate,
        emotionalState,
        disciplineScore,
        mistakes: mistakes.trim(),
        dailyReflection: dailyReflection.trim(),
        progressNotes: progressNotes.trim(),
      };
      if (editingId) {
        await apiRequest(`/api/reviews/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/reviews', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      resetForm();
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan evaluasi harian.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setErrorMsg('');
    try {
      await apiRequest(`/api/reviews/${id}`, { method: 'DELETE' });
      setConfirmDeleteId(null);
      if (editingId === id) resetForm();
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus evaluasi.');
    }
  };

  const avgDiscipline =
    reviews.length > 0
      ? reviews.reduce((acc, r) => acc + r.disciplineScore, 0) / reviews.length
      : 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {/* Left: Form */}
      <form
        onSubmit={handleSubmit}
        className="xl:col-span-5 bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5 sm:p-6 space-y-4 self-start"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#172033]">
              {editingId ? 'Ubah Evaluasi Harian' : 'Catat Evaluasi Harian'}
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Bangun konsistensi psikologi dan kedisiplinan aturan trading.
            </p>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-[#64748B] hover:text-[#172033] cursor-pointer"
            >
              Batal
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#DC2626] font-medium">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#172033] mb-1.5">
              Tanggal Evaluasi
            </label>
            <input
              type="date"
              required
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm font-mono text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#172033] mb-1.5">
              Kondisi Emosi
            </label>
            <select
              value={emotionalState}
              onChange={(e) => setEmotionalState(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
            >
              {EMOTIONAL_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-[#172033]">
              Nilai Kedisiplinan (1 – 10)
            </label>
            <span className="text-xs font-mono font-semibold text-[#0D9488]">
              {disciplineScore} / 10
            </span>
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setDisciplineScore(num)}
                className={`py-2 rounded-md text-xs font-mono font-semibold transition-colors cursor-pointer ${
                  disciplineScore === num
                    ? 'bg-[#0D9488] text-white'
                    : num <= disciplineScore
                    ? 'bg-[#0D9488]/12 text-[#0D9488] border border-[#0D9488]/30'
                    : 'bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0] hover:text-[#172033]'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#172033] mb-1.5">
            Kesalahan Trading Hari Ini
          </label>
          <textarea
            rows={2}
            value={mistakes}
            onChange={(e) => setMistakes(e.target.value)}
            placeholder="Contoh: Masuk terlalu cepat sebelum candle konfirmasi M15 ditutup."
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#172033] placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#0D9488]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#172033] mb-1.5">
            Refleksi Harian
          </label>
          <textarea
            rows={3}
            value={dailyReflection}
            onChange={(e) => setDailyReflection(e.target.value)}
            placeholder="Apa hal terbaik dan terburuk dari eksekusi Anda hari ini?"
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#172033] placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#0D9488]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#172033] mb-1.5">
            Catatan Perkembangan Trading
          </label>
          <textarea
            rows={2}
            value={progressNotes}
            onChange={(e) => setProgressNotes(e.target.value)}
            placeholder="Rencana perbaikan untuk sesi trading berikutnya."
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#172033] placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#0D9488]"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-50 text-white font-semibold text-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>
            {saving
              ? 'Menyimpan...'
              : editingId
              ? 'Perbarui Evaluasi'
              : 'Simpan Evaluasi Harian'}
          </span>
        </button>
      </form>

      {/* Right: Review History */}
      <div className="xl:col-span-7 space-y-4">
        <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#172033]">
              Riwayat Evaluasi Harian
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              {reviews.length} catatan evaluasi tersimpan
            </p>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-[#64748B]">Rata-rata Kedisiplinan</div>
            <div className="text-base font-mono font-semibold text-[#0D9488] tabular-nums">
              {avgDiscipline.toFixed(1)} / 10
            </div>
          </div>
        </div>

        {reviews.length === 0 ? (
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-12 text-center">
            <p className="text-sm font-medium text-[#172033]">
              Belum ada evaluasi harian
            </p>
            <p className="text-xs text-[#64748B] mt-1">
              Lengkapi form evaluasi di samping setelah sesi trading selesai.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((rev) => {
              const dayStat = dayStatsMap.get(rev.reviewDate);
              return (
                <div
                  key={rev.id}
                  className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-[#E2E8F0]">
                    <div>
                      <div className="flex items-center gap-2.5 text-sm font-semibold text-[#172033]">
                        <span>{formatShortDateId(rev.reviewDate)}</span>
                        <span className="text-[#CBD5E1]">·</span>
                        <span className="text-xs font-mono text-[#0D9488]">
                          Disiplin {rev.disciplineScore}/10
                        </span>
                      </div>
                      <div className="text-xs text-[#64748B] mt-0.5">
                        Emosi: {rev.emotionalState}
                        {dayStat && (
                          <>
                            {' · '}
                            {dayStat.count} transaksi (
                            <span
                              className={`font-mono font-medium ${
                                dayStat.netPl >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                              }`}
                            >
                              {formatCurrency(dayStat.netPl, currency, { signed: true })}
                            </span>
                            )
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {confirmDeleteId === rev.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleDelete(rev.id)}
                            className="px-2.5 py-1 rounded bg-red-50 border border-red-200 text-[#DC2626] text-xs font-semibold cursor-pointer"
                          >
                            Hapus
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 text-xs text-[#64748B] hover:text-[#172033] cursor-pointer"
                          >
                            Batal
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEdit(rev)}
                            className="p-1.5 rounded text-[#64748B] hover:text-[#172033] hover:bg-[#F1F5F9] cursor-pointer"
                            title="Ubah evaluasi"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(rev.id)}
                            className="p-1.5 rounded text-[#64748B] hover:text-[#DC2626] hover:bg-red-50 cursor-pointer"
                            title="Hapus evaluasi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <div className="font-semibold text-[#172033] mb-1">
                        Kesalahan Trading
                      </div>
                      <p className="text-[#64748B] leading-relaxed whitespace-pre-wrap">
                        {rev.mistakes || 'Tidak ada kesalahan fatal tercatat.'}
                      </p>
                    </div>
                    <div>
                      <div className="font-semibold text-[#172033] mb-1">
                        Refleksi Harian
                      </div>
                      <p className="text-[#64748B] leading-relaxed whitespace-pre-wrap">
                        {rev.dailyReflection || '—'}
                      </p>
                    </div>
                    <div>
                      <div className="font-semibold text-[#172033] mb-1">
                        Catatan Perkembangan
                      </div>
                      <p className="text-[#64748B] leading-relaxed whitespace-pre-wrap">
                        {rev.progressNotes || '—'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
