import { useState, type FormEvent } from 'react';
import { X, Plus, Trash2, Check } from 'lucide-react';
import type { CurrencyCode, Profile, TradingAccount } from '../types.ts';
import { apiRequest } from '../lib/api.ts';
import { formatCurrency } from '../utils/formatters.ts';

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
  accounts: TradingAccount[];
  profile: Profile | null;
  onRefresh: () => Promise<void>;
  onSelectAccount: (accountId: number) => void;
}

export function AccountModal({
  open,
  onClose,
  accounts,
  profile,
  onRefresh,
  onSelectAccount,
}: AccountModalProps) {
  const [tab, setTab] = useState<'accounts' | 'profile'>('accounts');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [broker, setBroker] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [initialBalance, setInitialBalance] = useState('10000');

  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [traderStyle, setTraderStyle] = useState(
    profile?.traderStyle || 'Inner Circle Trader'
  );

  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!open) return null;

  const startEdit = (acc: TradingAccount) => {
    setEditingId(acc.id);
    setName(acc.name);
    setBroker(acc.broker);
    setCurrency(acc.currency);
    setInitialBalance(String(acc.initialBalance));
    setErrorMsg('');
    setSuccessMsg('');
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setBroker('');
    setCurrency('USD');
    setInitialBalance('10000');
  };

  const handleSaveAccount = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const numBalance = Number(initialBalance);
    if (!name.trim() || Number.isNaN(numBalance) || numBalance < 0) {
      setErrorMsg('Nama akun dan saldo awal wajib valid.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await apiRequest(`/api/accounts/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: name.trim(),
            broker: broker.trim(),
            currency,
            initialBalance: numBalance,
          }),
        });
        setSuccessMsg('Akun trading berhasil diperbarui.');
      } else {
        const created = await apiRequest<TradingAccount>('/api/accounts', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            broker: broker.trim(),
            currency,
            initialBalance: numBalance,
          }),
        });
        onSelectAccount(created.id);
        setSuccessMsg('Akun trading baru berhasil ditambahkan.');
      }
      resetForm();
      await onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan akun.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async (id: number) => {
    setErrorMsg('');
    setSaving(true);
    try {
      await apiRequest(`/api/accounts/${id}`, { method: 'DELETE' });
      setConfirmDeleteId(null);
      if (editingId === id) resetForm();
      await onRefresh();
      setSuccessMsg('Akun trading berhasil dihapus.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus akun.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSaving(true);
    try {
      await apiRequest('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName: fullName.trim(),
          traderStyle: traderStyle.trim(),
        }),
      });
      await onRefresh();
      setSuccessMsg('Profil trader berhasil disimpan.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan profil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#1A2421]/35 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl glass-dock rounded-t-[28px] sm:rounded-[28px] overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="sm:hidden pt-2.5 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-[#1A2421]/18" />
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1A2421]/8">
          <div>
            <h3 className="text-base font-bold text-[#1A2421]">
              Pengaturan Akun Trading &amp; Profil
            </h3>
            <p className="text-xs text-[#52625D] mt-0.5">
              Atur mata uang (IDR, USD, USC), modal awal, dan preferensi trader.
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

        <div className="px-6 pt-3 pb-1 flex gap-2">
          <button
            type="button"
            onClick={() => setTab('accounts')}
            className={`min-h-[38px] px-4 py-1.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
              tab === 'accounts'
                ? 'bg-[#D8EFE7] text-[#0D7A72]'
                : 'text-[#52625D] hover:text-[#1A2421]'
            }`}
          >
            Daftar Akun ({accounts.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('profile')}
            className={`min-h-[38px] px-4 py-1.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
              tab === 'profile'
                ? 'bg-[#D8EFE7] text-[#0D7A72]'
                : 'text-[#52625D] hover:text-[#1A2421]'
            }`}
          >
            Profil &amp; Preferensi
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 pb-safe">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-[#DC2626]/10 border border-[#DC2626]/20 text-xs text-[#B91C1C] font-medium">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-2xl bg-[#16A34A]/12 border border-[#16A34A]/25 text-xs text-[#15803D] font-medium flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {tab === 'accounts' ? (
            <>
              <div className="space-y-2.5">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/60 border border-white/80"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-sm font-bold text-[#1A2421]">
                        <span>{acc.name}</span>
                        <span className="text-xs font-mono text-[#0D7A72]">
                          {acc.currency}
                        </span>
                      </div>
                      <div className="text-xs text-[#52625D] mt-0.5">
                        {acc.broker || 'Broker belum diisi'} · Modal Awal:{' '}
                        <span className="font-mono font-medium tabular-nums text-[#1A2421]">
                          {formatCurrency(acc.initialBalance, acc.currency)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(acc)}
                        className="min-h-[36px] px-3.5 py-1.5 rounded-2xl bg-white/85 hover:bg-white border border-white/90 text-xs font-medium text-[#1A2421] cursor-pointer"
                      >
                        Ubah
                      </button>
                      {accounts.length > 1 &&
                        (confirmDeleteId === acc.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDeleteAccount(acc.id)}
                              disabled={saving}
                              className="min-h-[36px] px-3 py-1.5 rounded-2xl bg-[#DC2626] text-white text-xs font-semibold cursor-pointer"
                            >
                              Konfirmasi Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="min-h-[36px] px-2.5 py-1.5 rounded-2xl text-xs text-[#52625D] hover:text-[#1A2421] cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(acc.id)}
                            className="p-2 rounded-2xl text-[#52625D] hover:text-[#B91C1C] hover:bg-[#DC2626]/10 cursor-pointer"
                            title="Hapus akun"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleSaveAccount}
                className="p-4 sm:p-5 rounded-2xl bg-white/55 border border-white/80 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-[#1A2421]">
                    {editingId ? 'Ubah Akun Trading' : 'Tambah Akun Trading Baru'}
                  </h4>
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="text-xs text-[#52625D] hover:text-[#1A2421] cursor-pointer"
                    >
                      Batal Ubah
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
                      Nama Akun
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Contoh: Akun Live Utama"
                      className="w-full min-h-[42px] glass-input rounded-2xl px-3.5 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
                      Nama Broker
                    </label>
                    <input
                      type="text"
                      value={broker}
                      onChange={(e) => setBroker(e.target.value)}
                      placeholder="Contoh: Exness / ICMarkets"
                      className="w-full min-h-[42px] glass-input rounded-2xl px-3.5 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
                      Mata Uang Akun
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                      className="w-full min-h-[42px] glass-input rounded-2xl px-3.5 py-2 text-sm"
                    >
                      <option value="USD">USD — Dolar AS ($)</option>
                      <option value="IDR">IDR — Rupiah (Rp)</option>
                      <option value="USC">USC — US Cent (USC)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
                      Saldo Awal ({currency})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={initialBalance}
                      onChange={(e) => setInitialBalance(e.target.value)}
                      className="w-full min-h-[42px] glass-input rounded-2xl px-3.5 py-2 text-sm font-mono tabular-nums"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="min-h-[42px] flex items-center gap-2 py-2.5 px-5 rounded-2xl bg-[#0D7A72] hover:bg-[#095E58] disabled:opacity-50 text-white font-semibold text-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      {saving
                        ? 'Menyimpan...'
                        : editingId
                        ? 'Simpan Perubahan'
                        : 'Buat Akun Trading'}
                    </span>
                  </button>
                </div>
              </form>
            </>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
                  Nama Trader
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nama tampilan Anda"
                  className="w-full min-h-[44px] glass-input rounded-2xl px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
                  Gaya Trading Utama
                </label>
                <input
                  type="text"
                  value={traderStyle}
                  onChange={(e) => setTraderStyle(e.target.value)}
                  placeholder="Contoh: ICT Silver Bullet / Intraday SMC"
                  className="w-full min-h-[44px] glass-input rounded-2xl px-3.5 py-2.5 text-sm"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] py-2.5 px-5 rounded-2xl bg-[#0D7A72] hover:bg-[#095E58] disabled:opacity-50 text-white font-semibold text-xs cursor-pointer"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Profil'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
