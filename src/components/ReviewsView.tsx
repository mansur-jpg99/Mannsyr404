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
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
      {/* Left: Form */}
      <form
        onSubmit={handleSubmit}
        className="xl:col-span-5 glass-card rounded-[26px] p-5 sm:p-6 space-y-4 self-start"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#1A2421]">
              {editingId ? 'Ubah Evaluasi Harian' : 'Catat Evaluasi Harian'}
            </h2>
            <p className="text-xs text-[#52625D] mt-0.5">
              Bangun konsistensi psikologi dan kedisiplinan aturan trading.
            </p>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-medium text-[#52625D] hover:text-[#1A2421] cursor-pointer"
            >
              Batal
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-[#DC2626]/10 border border-[#DC2626]/20 text-xs text-[#B91C1C] font-medium">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
              Tanggal Evaluasi
            </label>
            <input
              type="date"
              required
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
              className="w-full min-h-[44px] glass-input rounded-2xl px-3.5 py-2.5 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
              Kondisi Emosi
            </label>
            <select
              value={emotionalState}
              onChange={(e) => setEmotionalState(e.target.value)}
              className="w-full min-h-[44px] glass-input rounded-2xl px-3.5 py-2.5 text-sm"
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
            <label className="text-xs font-medium text-[#1A2421]">
              Nilai Kedisiplinan (1 – 10)
            </label>
            <span className="text-xs font-mono font-bold text-[#0D7A72]">
              {disciplineScore} / 10
            </span>
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setDisciplineScore(num)}
                className={`min-h-[38px] py-2 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer ${
                  disciplineScore === num
                    ? 'bg-[#0D7A72] text-white shadow-2xs'
                    : num <= disciplineScore
                    ? 'bg-[#D8EFE7] text-[#0D7A72]'
                    : 'bg-white/60 text-[#52625D] border border-white/80 hover:text-[#1A2421]'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
            Kesalahan Trading Hari Ini
          </label>
          <textarea
            rows={2}
            value={mistakes}
            onChange={(e) => setMistakes(e.target.value)}
            placeholder="Contoh: Masuk terlalu cepat sebelum candle konfirmasi M15 ditutup."
            className="w-full glass-input rounded-2xl px-3.5 py-2.5 text-sm placeholder:text-[#6B7C76]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
            Refleksi Harian
          </label>
          <textarea
            rows={3}
            value={dailyReflection}
            onChange={(e) => setDailyReflection(e.target.value)}
            placeholder="Apa hal terbaik dan terburuk dari eksekusi Anda hari ini?"
            className="w-full glass-input rounded-2xl px-3.5 py-2.5 text-sm placeholder:text-[#6B7C76]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
            Catatan Perkembangan Trading
          </label>
          <textarea
            rows={2}
            value={progressNotes}
            onChange={(e) => setProgressNotes(e.target.value)}
            placeholder="Rencana perbaikan untuk sesi trading berikutnya."
            className="w-full glass-input rounded-2xl px-3.5 py-2.5 text-sm placeholder:text-[#6B7C76]"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-[#0D7A72] hover:bg-[#095E58] disabled:opacity-50 text-white font-semibold text-xs cursor-pointer active:scale-[0.99] transition-all"
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
        <div className="glass-card rounded-[26px] px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#1A2421]">
              Riwayat Evaluasi Harian
            </h3>
            <p className="text-xs text-[#52625D] mt-0.5">
              {reviews.length} catatan evaluasi tersimpan
            </p>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-[#52625D]">Rata-rata Kedisiplinan</div>
            <div className="text-base font-mono font-bold text-[#0D7A72] tabular-nums">
              {avgDiscipline.toFixed(1)} / 10
            </div>
          </div>
        </div>

        {reviews.length === 0 ? (
          <div className="glass-card rounded-[26px] p-12 text-center">
            <p className="text-sm font-semibold text-[#1A2421]">
              Belum ada evaluasi harian
            </p>
            <p className="text-xs text-[#52625D] mt-1">
              Lengkapi form evaluasi di samping setelah sesi trading selesai.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {reviews.map((rev) => {
              const dayStat = dayStatsMap.get(rev.reviewDate);
              return (
                <div
                  key={rev.id}
                  className="glass-card rounded-[26px] p-5 space-y-3.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-[#1A2421]/8">
                    <div>
                      <div className="flex items-center gap-2.5 text-sm font-bold text-[#1A2421]">
                        <span>{formatShortDateId(rev.reviewDate)}</span>
                        <span className="text-[#52625D]/40">·</span>
                        <span className="text-xs font-mono text-[#0D7A72]">
                          Disiplin {rev.disciplineScore}/10
                        </span>
                      </div>
                      <div className="text-xs text-[#52625D] mt-0.5">
                        Emosi: {rev.emotionalState}
                        {dayStat && (
                          <>
                            {' · '}
                            {dayStat.count} transaksi (
                            <span
                              className={`font-mono font-semibold ${
                                dayStat.netPl >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
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
                            className="px-3 py-1.5 rounded-xl bg-[#DC2626] text-white text-xs font-semibold cursor-pointer"
                          >
                            Hapus
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-1.5 text-xs text-[#52625D] hover:text-[#1A2421] cursor-pointer"
                          >
                            Batal
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEdit(rev)}
                            className="p-2 rounded-xl text-[#52625D] hover:text-[#0D7A72] hover:bg-white/75 cursor-pointer"
                            title="Ubah evaluasi"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(rev.id)}
                            className="p-2 rounded-xl text-[#52625D] hover:text-[#B91C1C] hover:bg-[#DC2626]/10 cursor-pointer"
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
                      <div className="font-semibold text-[#1A2421] mb-1">
                        Kesalahan Trading
                      </div>
                      <p className="text-[#52625D] leading-relaxed whitespace-pre-wrap">
                        {rev.mistakes || 'Tidak ada kesalahan fatal tercatat.'}
                      </p>
                    </div>
                    <div>
                      <div className="font-semibold text-[#1A2421] mb-1">
                        Refleksi Harian
                      </div>
                      <p className="text-[#52625D] leading-relaxed whitespace-pre-wrap">
                        {rev.dailyReflection || '—'}
                      </p>
                    </div>
                    <div>
                      <div className="font-semibold text-[#1A2421] mb-1">
                        Catatan Perkembangan
                      </div>
                      <p className="text-[#52625D] leading-relaxed whitespace-pre-wrap">
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
