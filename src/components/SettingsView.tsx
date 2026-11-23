import { useEffect, useState, type FormEvent } from 'react';
import {
  Check,
  Coins,
  Eye,
  EyeOff,
  LogOut,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  User,
  Wallet,
} from 'lucide-react';
import type {
  AppPreferences,
  CurrencyCode,
  Profile,
  TradingAccount,
} from '../types.ts';
import { apiRequest } from '../lib/api.ts';
import { getSupabaseClient } from '../lib/supabase.ts';
import { formatCurrency } from '../utils/formatters.ts';

interface SettingsViewProps {
  profile: Profile | null;
  userEmail: string;
  userUid: string;
  accounts: TradingAccount[];
  activeAccount: TradingAccount | null;
  onSelectAccount: (accountId: number) => void;
  onRefresh: () => Promise<void>;
  preferences: AppPreferences;
  onUpdatePreferences: (next: AppPreferences) => void;
  onSignOut: () => Promise<void>;
}

const CURRENCY_OPTIONS: Array<{
  code: CurrencyCode;
  label: string;
  desc: string;
}> = [
  { code: 'IDR', label: 'IDR (Rp)', desc: 'Rupiah Indonesia' },
  { code: 'USD', label: 'USD ($)', desc: 'Dolar Amerika Serikat' },
  { code: 'USC', label: 'USC (¢)', desc: 'Akun Cent (US Cent)' },
];

export function SettingsView({
  profile,
  userEmail,
  userUid,
  accounts,
  activeAccount,
  onSelectAccount,
  onRefresh,
  preferences,
  onUpdatePreferences,
  onSignOut,
}: SettingsViewProps) {
  // Profile state
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [traderStyle, setTraderStyle] = useState(
    profile?.traderStyle || 'Inner Circle Trader'
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState('');
  const [profileError, setProfileError] = useState('');

  // Account form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [accName, setAccName] = useState('');
  const [accBroker, setAccBroker] = useState('');
  const [accCurrency, setAccCurrency] = useState<CurrencyCode>('USD');
  const [accBalance, setAccBalance] = useState('10000');
  const [savingAccount, setSavingAccount] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [accountFeedback, setAccountFeedback] = useState('');
  const [accountError, setAccountError] = useState('');
  const [updatingQuickCurrency, setUpdatingQuickCurrency] = useState(false);

  // Security / Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [securityFeedback, setSecurityFeedback] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setFullName(profile?.fullName || '');
    setTraderStyle(profile?.traderStyle || 'Inner Circle Trader');
  }, [profile]);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileFeedback('');
    setSavingProfile(true);
    try {
      await apiRequest('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName: fullName.trim(),
          traderStyle: traderStyle.trim(),
        }),
      });
      await onRefresh();
      setProfileFeedback('Profil trader berhasil diperbarui.');
    } catch (err: any) {
      setProfileError(err.message || 'Gagal menyimpan profil.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleQuickCurrencyChange = async (nextCurrency: CurrencyCode) => {
    if (!activeAccount || activeAccount.currency === nextCurrency) return;
    setAccountError('');
    setAccountFeedback('');
    setUpdatingQuickCurrency(true);
    try {
      await apiRequest(`/api/accounts/${activeAccount.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: activeAccount.name,
          broker: activeAccount.broker,
          currency: nextCurrency,
          initialBalance: activeAccount.initialBalance,
        }),
      });
      await onRefresh();
      setAccountFeedback(
        `Mata uang akun "${activeAccount.name}" diubah ke ${nextCurrency}.`
      );
    } catch (err: any) {
      setAccountError(err.message || 'Gagal memperbarui mata uang akun.');
    } finally {
      setUpdatingQuickCurrency(false);
    }
  };

  const startEditAccount = (acc: TradingAccount) => {
    setEditingId(acc.id);
    setAccName(acc.name);
    setAccBroker(acc.broker);
    setAccCurrency(acc.currency);
    setAccBalance(String(acc.initialBalance));
    setAccountError('');
    setAccountFeedback('');
  };

  const resetAccountForm = () => {
    setEditingId(null);
    setAccName('');
    setAccBroker('');
    setAccCurrency('USD');
    setAccBalance('10000');
  };

  const handleSaveAccount = async (e: FormEvent) => {
    e.preventDefault();
    setAccountError('');
    setAccountFeedback('');
    const numBalance = Number(accBalance);
    if (!accName.trim() || Number.isNaN(numBalance) || numBalance < 0) {
      setAccountError('Nama akun dan modal awal wajib diisi dengan angka valid.');
      return;
    }

    setSavingAccount(true);
    try {
      if (editingId) {
        await apiRequest(`/api/accounts/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: accName.trim(),
            broker: accBroker.trim(),
            currency: accCurrency,
            initialBalance: numBalance,
          }),
        });
        setAccountFeedback('Pengaturan akun trading berhasil diperbarui.');
      } else {
        const created = await apiRequest<TradingAccount>('/api/accounts', {
          method: 'POST',
          body: JSON.stringify({
            name: accName.trim(),
            broker: accBroker.trim(),
            currency: accCurrency,
            initialBalance: numBalance,
          }),
        });
        onSelectAccount(created.id);
        setAccountFeedback('Akun trading baru berhasil ditambahkan.');
      }
      resetAccountForm();
      await onRefresh();
    } catch (err: any) {
      setAccountError(err.message || 'Gagal menyimpan akun trading.');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleDeleteAccount = async (id: number) => {
    setAccountError('');
    setAccountFeedback('');
    setSavingAccount(true);
    try {
      await apiRequest(`/api/accounts/${id}`, { method: 'DELETE' });
      setConfirmDeleteId(null);
      if (editingId === id) resetAccountForm();
      await onRefresh();
      setAccountFeedback('Akun trading berhasil dihapus.');
    } catch (err: any) {
      setAccountError(err.message || 'Gagal menghapus akun trading.');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    setSecurityError('');
    setSecurityFeedback('');

    if (newPassword.length < 6) {
      setSecurityError('Password baru minimal harus terdiri dari 6 karakter.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setSecurityError('Konfirmasi password baru tidak cocok.');
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setSecurityError('Koneksi autentikasi Supabase belum siap.');
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setSecurityError(error.message || 'Gagal memperbarui password.');
        return;
      }
      setNewPassword('');
      setConfirmNewPassword('');
      setSecurityFeedback('Password akun Anda berhasil diperbarui.');
    } catch (err: any) {
      setSecurityError(err?.message || 'Gagal memperbarui password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleConfirmLogout = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* 1. Profil Pengguna */}
      <section className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3 pb-4 border-b border-[#E2E8F0]">
          <div className="w-10 h-10 rounded-xl bg-[#0D9488]/10 text-[#0D9488] flex items-center justify-center shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-semibold text-[#172033]">
              Profil Pengguna
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5 truncate">
              {userEmail}
            </p>
          </div>
        </div>

        {profileError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#DC2626] font-medium">
            {profileError}
          </div>
        )}
        {profileFeedback && (
          <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-xs text-[#16A34A] font-medium flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{profileFeedback}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#172033] mb-1.5">
                Nama Lengkap
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nama tampilan Anda"
                className="w-full min-h-[44px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
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
                placeholder="Contoh: Intraday SMC / Price Action"
                className="w-full min-h-[44px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer active:scale-[0.98] transition-all"
            >
              {savingProfile ? 'Menyimpan...' : 'Simpan Profil'}
            </button>
          </div>
        </form>
      </section>

      {/* 2. Mata Uang IDR / USD / USC */}
      <section className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3 pb-4 border-b border-[#E2E8F0]">
          <div className="w-10 h-10 rounded-xl bg-[#0D9488]/10 text-[#0D9488] flex items-center justify-center shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-[#172033]">
              Mata Uang Akun (IDR / USD / USC)
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Mengubah format saldo dan profit untuk akun aktif:{' '}
              <span className="font-semibold text-[#172033]">
                {activeAccount?.name || '—'}
              </span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {CURRENCY_OPTIONS.map((item) => {
            const isSelected = activeAccount?.currency === item.code;
            return (
              <button
                key={item.code}
                type="button"
                disabled={!activeAccount || updatingQuickCurrency}
                onClick={() => handleQuickCurrencyChange(item.code)}
                className={`min-h-[56px] p-3.5 rounded-xl border text-left transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 ${
                  isSelected
                    ? 'bg-[#0D9488]/10 border-[#0D9488] text-[#172033]'
                    : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1] hover:text-[#172033]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm font-mono font-bold ${
                      isSelected ? 'text-[#0D9488]' : 'text-[#172033]'
                    }`}
                  >
                    {item.label}
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-[#0D9488]" />}
                </div>
                <div className="text-[11px] text-[#64748B] mt-0.5">{item.desc}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Pengaturan Akun Trading */}
      <section className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-start gap-3 pb-4 border-b border-[#E2E8F0]">
          <div className="w-10 h-10 rounded-xl bg-[#0D9488]/10 text-[#0D9488] flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-[#172033]">
              Pengaturan Akun Trading
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Pilih akun aktif, ubah modal awal, atau kelola multi-akun broker Anda.
            </p>
          </div>
        </div>

        {accountError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#DC2626] font-medium">
            {accountError}
          </div>
        )}
        {accountFeedback && (
          <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-xs text-[#16A34A] font-medium flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{accountFeedback}</span>
          </div>
        )}

        <div className="space-y-2.5">
          {accounts.map((acc) => {
            const isActive = activeAccount?.id === acc.id;
            return (
              <div
                key={acc.id}
                className={`p-4 rounded-xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isActive
                    ? 'bg-[#0D9488]/5 border-[#0D9488]/40'
                    : 'bg-[#F8FAFC] border-[#E2E8F0]'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-[#172033]">
                      {acc.name}
                    </span>
                    <span className="text-xs font-mono font-semibold text-[#0D9488]">
                      {acc.currency}
                    </span>
                    {isActive && (
                      <span className="text-[11px] font-semibold text-[#0D9488]">
                        · Aktif
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#64748B] mt-1">
                    {acc.broker || 'Broker belum diisi'} · Modal Awal:{' '}
                    <span className="font-mono font-semibold tabular-nums text-[#172033]">
                      {formatCurrency(acc.initialBalance, acc.currency)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => onSelectAccount(acc.id)}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold cursor-pointer active:scale-95 transition-transform"
                    >
                      Gunakan
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => startEditAccount(acc)}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#FFFFFF] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-medium text-[#172033] cursor-pointer active:scale-95 transition-transform"
                  >
                    Ubah
                  </button>
                  {accounts.length > 1 &&
                    (confirmDeleteId === acc.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDeleteAccount(acc.id)}
                          disabled={savingAccount}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-[#DC2626] text-xs font-semibold hover:bg-red-100 cursor-pointer"
                        >
                          Hapus
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs text-[#64748B] hover:text-[#172033] cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(acc.id)}
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[#64748B] hover:text-[#DC2626] hover:bg-red-50 cursor-pointer"
                        title="Hapus akun"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add / Edit Account Form */}
        <form
          onSubmit={handleSaveAccount}
          className="p-4 sm:p-5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#172033]">
              {editingId ? 'Ubah Akun Trading' : 'Tambah Akun Trading Baru'}
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={resetAccountForm}
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
                value={accName}
                onChange={(e) => setAccName(e.target.value)}
                placeholder="Contoh: Akun Live Utama"
                className="w-full min-h-[44px] bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#172033] focus:outline-none focus:border-[#0D9488]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172033] mb-1.5">
                Nama Broker
              </label>
              <input
                type="text"
                value={accBroker}
                onChange={(e) => setAccBroker(e.target.value)}
                placeholder="Contoh: Exness / ICMarkets"
                className="w-full min-h-[44px] bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#172033] focus:outline-none focus:border-[#0D9488]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172033] mb-1.5">
                Mata Uang Akun
              </label>
              <select
                value={accCurrency}
                onChange={(e) => setAccCurrency(e.target.value as CurrencyCode)}
                className="w-full min-h-[44px] bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#172033] focus:outline-none focus:border-[#0D9488]"
              >
                <option value="USD">USD — Dolar AS ($)</option>
                <option value="IDR">IDR — Rupiah (Rp)</option>
                <option value="USC">USC — US Cent (USC)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#172033] mb-1.5">
                Saldo Awal ({accCurrency})
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={accBalance}
                onChange={(e) => setAccBalance(e.target.value)}
                className="w-full min-h-[44px] bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm font-mono tabular-nums text-[#172033] focus:outline-none focus:border-[#0D9488]"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingAccount}
              className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-50 text-white font-semibold text-xs cursor-pointer active:scale-[0.98] transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>
                {savingAccount
                  ? 'Menyimpan...'
                  : editingId
                  ? 'Simpan Perubahan Akun'
                  : 'Buat Akun Trading'}
              </span>
            </button>
          </div>
        </form>
      </section>

      {/* 4. Preferensi Aplikasi */}
      <section className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3 pb-4 border-b border-[#E2E8F0]">
          <div className="w-10 h-10 rounded-xl bg-[#0D9488]/10 text-[#0D9488] flex items-center justify-center shrink-0">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-[#172033]">
              Preferensi Aplikasi
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Sesuaikan nilai awal pencatatan jurnal serta perilaku transisi antarmuka.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#172033] mb-1.5">
              Default Sesi Trading
            </label>
            <select
              value={preferences.defaultSession}
              onChange={(e) =>
                onUpdatePreferences({
                  ...preferences,
                  defaultSession: e.target.value,
                })
              }
              className="w-full min-h-[44px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
            >
              <option value="Asia">Asia (Tokyo)</option>
              <option value="London">London</option>
              <option value="New York">New York</option>
              <option value="Overlap">London - NY Overlap</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#172033] mb-1.5">
              Default Lot Size Transaksi Baru
            </label>
            <select
              value={preferences.defaultLotSize}
              onChange={(e) =>
                onUpdatePreferences({
                  ...preferences,
                  defaultLotSize: e.target.value,
                })
              }
              className="w-full min-h-[44px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm font-mono tabular-nums text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
            >
              <option value="0.01">0.01 lot</option>
              <option value="0.05">0.05 lot</option>
              <option value="0.10">0.10 lot</option>
              <option value="0.25">0.25 lot</option>
              <option value="0.50">0.50 lot</option>
              <option value="1.00">1.00 lot</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-xl bg-[#F8FAFC]">
          <div className="flex items-center justify-between gap-4 p-4">
            <div>
              <div className="text-xs sm:text-sm font-medium text-[#172033]">
                Animasi Transisi Halaman Halus
              </div>
              <div className="text-[11px] text-[#64748B] mt-0.5">
                Efek slide horizontal lembut bergaya iOS saat berpindah menu
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.enableAnimations}
              onClick={() =>
                onUpdatePreferences({
                  ...preferences,
                  enableAnimations: !preferences.enableAnimations,
                })
              }
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer ${
                preferences.enableAnimations ? 'bg-[#0D9488]' : 'bg-[#CBD5E1]'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform duration-200 ${
                  preferences.enableAnimations ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 p-4">
            <div>
              <div className="text-xs sm:text-sm font-medium text-[#172033]">
                Kartu Ringkasan Padat
              </div>
              <div className="text-[11px] text-[#64748B] mt-0.5">
                Menampilkan padding metrik Dashboard yang lebih ringkas di layar
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.compactCards}
              onClick={() =>
                onUpdatePreferences({
                  ...preferences,
                  compactCards: !preferences.compactCards,
                })
              }
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer ${
                preferences.compactCards ? 'bg-[#0D9488]' : 'bg-[#CBD5E1]'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform duration-200 ${
                  preferences.compactCards ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* 5. Keamanan & Logout */}
      <section className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-start gap-3 pb-4 border-b border-[#E2E8F0]">
          <div className="w-10 h-10 rounded-xl bg-[#0D9488]/10 text-[#0D9488] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-semibold text-[#172033]">
              Keamanan &amp; Logout
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5 truncate">
              Sesi Supabase Authentication aktif · UID: {userUid.slice(0, 8)}...
            </p>
          </div>
        </div>

        {securityError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#DC2626] font-medium">
            {securityError}
          </div>
        )}
        {securityFeedback && (
          <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-xs text-[#16A34A] font-medium flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{securityFeedback}</span>
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div className="text-xs font-semibold text-[#172033]">
            Perbarui Password Akun
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1.5">
                Password Baru
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full min-h-[44px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl pl-3.5 pr-10 py-2 text-sm text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#64748B] hover:text-[#172033] cursor-pointer"
                  aria-label="Tampilkan password baru"
                >
                  {showNewPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1.5">
                Konfirmasi Password Baru
              </label>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Ulangi password baru"
                className="w-full min-h-[44px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#172033] focus:outline-none focus:bg-white focus:border-[#0D9488]"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingPassword || (!newPassword && !confirmNewPassword)}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] disabled:opacity-50 text-xs font-semibold text-[#172033] cursor-pointer active:scale-[0.98] transition-all"
            >
              {savingPassword ? 'Memperbarui...' : 'Ubah Password'}
            </button>
          </div>
        </form>

        <div className="pt-4 border-t border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[#172033]">
              Keluar dari MANSYR404
            </div>
            <div className="text-xs text-[#64748B] mt-0.5">
              Mengakhiri sesi Supabase Anda pada perangkat ini secara aman.
            </div>
          </div>

          {confirmSignOut ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={signingOut}
                onClick={handleConfirmLogout}
                className="flex-1 sm:flex-none min-h-[44px] px-4 py-2.5 rounded-xl bg-[#DC2626] hover:bg-red-700 text-white text-xs font-semibold cursor-pointer active:scale-95 transition-transform"
              >
                {signingOut ? 'Keluar...' : 'Ya, Keluar Sekarang'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmSignOut(false)}
                className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-xs font-medium text-[#64748B] hover:text-[#172033] cursor-pointer"
              >
                Batal
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmSignOut(true)}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-[#DC2626] text-xs font-semibold cursor-pointer active:scale-[0.98] transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
