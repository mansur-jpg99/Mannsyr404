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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#172033]/40 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl overflow-hidden max-h-[90vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <div>
            <h3 className="text-base font-semibold text-[#172033]">
              Pengaturan Akun Trading &amp; Profil
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Atur mata uang (IDR, USD, USC), modal awal, dan preferensi trader.
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

        <div className="px-6 pt-4 flex gap-4 border-b border-[#E2E8F0]">
          <button
            type="button"
            onClick={() => setTab('accounts')}
            className={`pb-3 px-1 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              tab === 'accounts'
                ? 'border-[#0D9488] text-[#0D9488]'
                : 'border-transparent text-[#64748B] hover:text-[#172033]'
            }`}
          >
            Daftar Akun Trading ({accounts.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('profile')}
            className={`pb-3 px-1 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              tab === 'profile'
                ? 'border-[#0D9488] text-[#0D9488]'
                : 'border-transparent text-[#64748B] hover:text-[#172033]'
            }`}
          >
            Profil &amp; Preferensi
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#DC2626] font-medium">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-xs text-[#16A34A] font-medium flex items-center gap-2">
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
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#172033]">
                        <span>{acc.name}</span>
                        <span className="text-xs font-mono text-[#0D9488]">
                          {acc.currency}
                        </span>
                      </div>
                      <div className="text-xs text-[#64748B] mt-0.5">
                        {acc.broker || 'Broker belum diisi'} · Modal Awal:{' '}
                        <span className="font-mono font-medium tabular-nums text-[#172033]">
                          {formatCurrency(acc.initialBalance, acc.currency)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(acc)}
                        className="px-3 py-1.5 rounded-lg bg-[#FFFFFF] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-medium text-[#172033] cursor-pointer"
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
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 text-[#DC2626] text-xs font-semibold hover:bg-red-100 cursor-pointer"
                            >
                              Konfirmasi Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1.5 rounded-lg text-xs text-[#64748B] hover:text-[#172033] cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(acc.id)}
                            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#DC2626] hover:bg-red-50 cursor-pointer"
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
                className="p-4 sm:p-5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[#172033]">
                    {editingId ? 'Ubah Akun Trading' : 'Tambah Akun Trading Baru'}
                  </h4>
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="text-xs text-[#64748B] hover:text-[#172033] cursor-pointer"
                    >
                      Batal Ubah
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#172033] mb-1.5">
                      Nama Akun
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Contoh: Akun Live Utama"
                      className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#172033] focus:outline-none focus:border-[#0D9488]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#172033] mb-1.5">
                      Nama Broker
                    </label>
                    <input
                      type="text"
                      value={broker}
                      onChange={(e) => setBroker(e.target.value)}
                      placeholder="Contoh: Exness / ICMarkets"
                      className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#172033] focus:outline-none focus:border-[#0D9488]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#172033] mb-1.5">
                      Mata Uang Akun
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                      className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#172033] focus:outline-none focus:border-[#0D9488]"
                    >
                      <option value="USD">USD — Dolar AS ($)</option>
                      <option value="IDR">IDR — Rupiah (Rp)</option>
                      <option value="USC">USC — US Cent (USC)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#172033] mb-1.5">
                      Saldo Awal ({currency})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={initialBalance}
                      onChange={(e) => setInitialBalance(e.target.value)}
                      className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-[#172033] focus:outline-none focus:border-[#0D9488]"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 py-2.5 px-4 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-50 text-white font-semibold text-xs cursor-pointer"
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
                <label className="block text-xs font-medium text-[#172033] mb-1.5">
                  Nama Trader
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nama tampilan Anda"
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3.5 py-2.5 text-sm text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#172033] mb-1.5">
                  Gaya Trading Utama
                </label>
                <input
                  type="text"
                  value={traderStyle}
                  onChange={(e) => setTraderStyle(e.target.value)}
                  placeholder="Contoh: ICT Silver Bullet / Intraday SMC"
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3.5 py-2.5 text-sm text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="py-2.5 px-5 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-50 text-white font-semibold text-xs cursor-pointer"
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
