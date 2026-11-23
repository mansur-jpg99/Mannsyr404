import { useEffect, useState, type FormEvent } from 'react';
import {
  Check,
  ChevronRight,
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
import { AnimatePresence, motion } from 'motion/react';
import type {
  AppPreferences,
  CurrencyCode,
  Profile,
  SettingsSection,
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
  activeSection?: SettingsSection;
  onChangeSection?: (section: SettingsSection) => void;
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
  activeSection: controlledSection,
  onChangeSection,
}: SettingsViewProps) {
  const [internalSection, setInternalSection] = useState<SettingsSection>('profile');
  const activeSection = controlledSection ?? internalSection;
  const setActiveSection = (section: SettingsSection) => {
    setInternalSection(section);
    onChangeSection?.(section);
  };

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

  const displayName = profile?.fullName || userEmail.split('@')[0] || 'Trader';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  const MENU_ITEMS: Array<{
    id: SettingsSection;
    label: string;
    summary: string;
    icon: typeof User;
  }> = [
    {
      id: 'profile',
      label: 'Personal Information',
      summary: displayName,
      icon: User,
    },
    {
      id: 'accounts',
      label: 'Account',
      summary: `${accounts.length} Akun`,
      icon: Wallet,
    },
    {
      id: 'currency',
      label: 'Currency',
      summary: activeAccount?.currency || 'USD',
      icon: Coins,
    },
    {
      id: 'preferences',
      label: 'Preferences',
      summary: `${preferences.defaultSession} · ${preferences.defaultLotSize} lot`,
      icon: SlidersHorizontal,
    },
    {
      id: 'security',
      label: 'Security',
      summary: 'Password & Sesi',
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* iOS Profile Glass Hero */}
      <section className="glass-card rounded-[28px] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-15 h-15 rounded-[22px] bg-gradient-to-br from-[#0D7A72] to-[#14B8A6] text-white text-lg font-bold flex items-center justify-center shrink-0 shadow-[0_8px_22px_rgba(13,122,114,0.24)]">
            {initials || 'TR'}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#1A2421] truncate">
              {displayName}
            </h2>
            <p className="text-xs sm:text-sm text-[#52625D] truncate">
              {userEmail}
            </p>
            <p className="text-xs text-[#0D7A72] font-medium mt-0.5 truncate">
              {profile?.traderStyle || 'Inner Circle Trader'}
              {activeAccount ? ` · ${activeAccount.name}` : ''}
            </p>
          </div>
        </div>

        {activeAccount && (
          <div className="sm:text-right pt-3 sm:pt-0 border-t sm:border-t-0 border-[#1A2421]/8 shrink-0">
            <div className="text-[11px] font-medium text-[#52625D]">
              Modal Awal Akun Aktif
            </div>
            <div className="text-base font-mono font-bold tabular-nums text-[#1A2421] mt-0.5">
              {formatCurrency(activeAccount.initialBalance, activeAccount.currency)}
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: iOS Grouped Settings Navigation + Logout */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-card rounded-[26px] overflow-hidden divide-y divide-[#1A2421]/8">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const isSelected = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full px-4 py-3.5 min-h-[56px] flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#D8EFE7]/75'
                      : 'hover:bg-white/45'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-[#0D7A72] text-white'
                          : 'bg-white/75 text-[#0D7A72]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-semibold text-[#1A2421] truncate">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-[#52625D] truncate">
                        {item.summary}
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isSelected ? 'text-[#0D7A72]' : 'text-[#52625D]'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Logout Glass Card */}
          <div className="glass-card rounded-[26px] p-4">
            {confirmSignOut ? (
              <div className="space-y-3">
                <div className="text-xs font-medium text-[#1A2421]">
                  Keluar dari sesi MANSYR404 pada perangkat ini?
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={signingOut}
                    onClick={handleConfirmLogout}
                    className="flex-1 min-h-[42px] px-4 py-2 rounded-2xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-semibold cursor-pointer"
                  >
                    {signingOut ? 'Keluar...' : 'Ya, Logout'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmSignOut(false)}
                    className="min-h-[42px] px-3.5 py-2 rounded-2xl bg-white/75 text-xs font-medium text-[#52625D] cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmSignOut(true)}
                className="w-full min-h-[46px] flex items-center justify-center gap-2 rounded-2xl bg-[#DC2626]/10 hover:bg-[#DC2626]/15 text-[#B91C1C] text-xs font-semibold cursor-pointer active:scale-[0.98] transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: Active Settings Panel */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* 1. Personal Information */}
              {activeSection === 'profile' && (
                <section className="glass-card rounded-[28px] p-5 sm:p-6 space-y-5">
                  <div className="flex items-start gap-3 pb-4 border-b border-[#1A2421]/8">
                    <div className="w-10 h-10 rounded-2xl bg-[#D8EFE7] text-[#0D7A72] flex items-center justify-center shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-[#1A2421]">
                        Personal Information
                      </h3>
                      <p className="text-xs text-[#52625D] mt-0.5 truncate">
                        {userEmail}
                      </p>
                    </div>
                  </div>

                  {profileError && (
                    <div className="p-3 rounded-2xl bg-[#DC2626]/10 border border-[#DC2626]/20 text-xs text-[#B91C1C] font-medium">
                      {profileError}
                    </div>
                  )}
                  {profileFeedback && (
                    <div className="p-3 rounded-2xl bg-[#16A34A]/12 border border-[#16A34A]/25 text-xs text-[#15803D] font-medium flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>{profileFeedback}</span>
                    </div>
                  )}

                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
                          Nama Lengkap
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
                          placeholder="Contoh: Intraday SMC / Price Action"
                          className="w-full min-h-[44px] glass-input rounded-2xl px-3.5 py-2.5 text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={savingProfile}
                        className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#0D7A72] hover:bg-[#095E58] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer active:scale-[0.98] transition-all"
                      >
                        {savingProfile ? 'Menyimpan...' : 'Simpan Profil'}
                      </button>
                    </div>
                  </form>
                </section>
              )}

              {/* 2. Currency IDR / USD / USC */}
              {activeSection === 'currency' && (
                <section className="glass-card rounded-[28px] p-5 sm:p-6 space-y-5">
                  <div className="flex items-start gap-3 pb-4 border-b border-[#1A2421]/8">
                    <div className="w-10 h-10 rounded-2xl bg-[#D8EFE7] text-[#0D7A72] flex items-center justify-center shrink-0">
                      <Coins className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#1A2421]">
                        Mata Uang Akun (IDR / USD / USC)
                      </h3>
                      <p className="text-xs text-[#52625D] mt-0.5">
                        Mengubah format saldo dan profit untuk akun aktif:{' '}
                        <strong className="text-[#1A2421]">
                          {activeAccount?.name || '—'}
                        </strong>
                      </p>
                    </div>
                  </div>

                  {accountError && (
                    <div className="p-3 rounded-2xl bg-[#DC2626]/10 border border-[#DC2626]/20 text-xs text-[#B91C1C] font-medium">
                      {accountError}
                    </div>
                  )}
                  {accountFeedback && (
                    <div className="p-3 rounded-2xl bg-[#16A34A]/12 border border-[#16A34A]/25 text-xs text-[#15803D] font-medium flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>{accountFeedback}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {CURRENCY_OPTIONS.map((item) => {
                      const isSelected = activeAccount?.currency === item.code;
                      return (
                        <button
                          key={item.code}
                          type="button"
                          disabled={!activeAccount || updatingQuickCurrency}
                          onClick={() => handleQuickCurrencyChange(item.code)}
                          className={`min-h-[68px] p-4 rounded-2xl border text-left transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 ${
                            isSelected
                              ? 'bg-[#D8EFE7]/85 border-[#0D7A72] text-[#1A2421] shadow-2xs'
                              : 'bg-white/55 border-white/80 text-[#52625D] hover:bg-white/80 hover:text-[#1A2421]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-sm font-mono font-bold ${
                                isSelected ? 'text-[#0D7A72]' : 'text-[#1A2421]'
                              }`}
                            >
                              {item.label}
                            </span>
                            {isSelected && <Check className="w-4 h-4 text-[#0D7A72]" />}
                          </div>
                          <div className="text-[11px] text-[#52625D] mt-1">
                            {item.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 3. Trading Accounts */}
              {activeSection === 'accounts' && (
                <section className="glass-card rounded-[28px] p-5 sm:p-6 space-y-5">
                  <div className="flex items-start gap-3 pb-4 border-b border-[#1A2421]/8">
                    <div className="w-10 h-10 rounded-2xl bg-[#D8EFE7] text-[#0D7A72] flex items-center justify-center shrink-0">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#1A2421]">
                        Pengaturan Akun Trading
                      </h3>
                      <p className="text-xs text-[#52625D] mt-0.5">
                        Pilih akun aktif, ubah modal awal, atau kelola multi-akun broker Anda.
                      </p>
                    </div>
                  </div>

                  {accountError && (
                    <div className="p-3 rounded-2xl bg-[#DC2626]/10 border border-[#DC2626]/20 text-xs text-[#B91C1C] font-medium">
                      {accountError}
                    </div>
                  )}
                  {accountFeedback && (
                    <div className="p-3 rounded-2xl bg-[#16A34A]/12 border border-[#16A34A]/25 text-xs text-[#15803D] font-medium flex items-center gap-2">
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
                          className={`p-4 rounded-2xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isActive
                              ? 'bg-[#D8EFE7]/65 border-[#0D7A72]/30'
                              : 'bg-white/50 border-white/80'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-[#1A2421]">
                                {acc.name}
                              </span>
                              <span className="text-xs font-mono font-semibold text-[#0D7A72]">
                                {acc.currency}
                              </span>
                              {isActive && (
                                <span className="text-[11px] font-semibold text-[#0D7A72]">
                                  · Aktif
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#52625D] mt-1">
                              {acc.broker || 'Broker belum diisi'} · Modal Awal:{' '}
                              <span className="font-mono font-semibold tabular-nums text-[#1A2421]">
                                {formatCurrency(acc.initialBalance, acc.currency)}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {!isActive && (
                              <button
                                type="button"
                                onClick={() => onSelectAccount(acc.id)}
                                className="min-h-[38px] px-3.5 py-1.5 rounded-2xl bg-[#0D7A72] hover:bg-[#095E58] text-white text-xs font-semibold cursor-pointer active:scale-95 transition-transform"
                              >
                                Gunakan
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => startEditAccount(acc)}
                              className="min-h-[38px] px-3.5 py-1.5 rounded-2xl bg-white/80 hover:bg-white border border-white/90 text-xs font-medium text-[#1A2421] cursor-pointer active:scale-95 transition-transform"
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
                                    className="min-h-[38px] px-3 py-1.5 rounded-2xl bg-[#DC2626] text-white text-xs font-semibold cursor-pointer"
                                  >
                                    Hapus
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="min-h-[38px] px-2.5 py-1.5 rounded-2xl text-xs text-[#52625D] hover:text-[#1A2421] cursor-pointer"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(acc.id)}
                                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-2xl text-[#52625D] hover:text-[#B91C1C] hover:bg-[#DC2626]/10 cursor-pointer"
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
                    className="p-4 sm:p-5 rounded-2xl bg-white/50 border border-white/80 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-[#1A2421]">
                        {editingId ? 'Ubah Akun Trading' : 'Tambah Akun Trading Baru'}
                      </h4>
                      {editingId && (
                        <button
                          type="button"
                          onClick={resetAccountForm}
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
                          value={accName}
                          onChange={(e) => setAccName(e.target.value)}
                          placeholder="Contoh: Akun Live Utama"
                          className="w-full min-h-[44px] glass-input rounded-2xl px-3.5 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
                          Nama Broker
                        </label>
                        <input
                          type="text"
                          value={accBroker}
                          onChange={(e) => setAccBroker(e.target.value)}
                          placeholder="Contoh: Exness / ICMarkets"
                          className="w-full min-h-[44px] glass-input rounded-2xl px-3.5 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
                          Mata Uang Akun
                        </label>
                        <select
                          value={accCurrency}
                          onChange={(e) =>
                            setAccCurrency(e.target.value as CurrencyCode)
                          }
                          className="w-full min-h-[44px] glass-input rounded-2xl px-3.5 py-2 text-sm"
                        >
                          <option value="USD">USD — Dolar AS ($)</option>
                          <option value="IDR">IDR — Rupiah (Rp)</option>
                          <option value="USC">USC — US Cent (USC)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
                          Saldo Awal ({accCurrency})
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          required
                          value={accBalance}
                          onChange={(e) => setAccBalance(e.target.value)}
                          className="w-full min-h-[44px] glass-input rounded-2xl px-3.5 py-2 text-sm font-mono tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={savingAccount}
                        className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-5 rounded-2xl bg-[#0D7A72] hover:bg-[#095E58] disabled:opacity-50 text-white font-semibold text-xs cursor-pointer active:scale-[0.98] transition-all"
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
              )}

              {/* 4. App Preferences */}
              {activeSection === 'preferences' && (
                <section className="glass-card rounded-[28px] p-5 sm:p-6 space-y-5">
                  <div className="flex items-start gap-3 pb-4 border-b border-[#1A2421]/8">
                    <div className="w-10 h-10 rounded-2xl bg-[#D8EFE7] text-[#0D7A72] flex items-center justify-center shrink-0">
                      <SlidersHorizontal className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#1A2421]">
                        Preferensi Aplikasi
                      </h3>
                      <p className="text-xs text-[#52625D] mt-0.5">
                        Sesuaikan nilai awal pencatatan jurnal serta perilaku transisi antarmuka.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
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
                        className="w-full min-h-[44px] glass-input rounded-2xl px-3.5 py-2 text-sm"
                      >
                        <option value="Asia">Asia (Tokyo)</option>
                        <option value="London">London</option>
                        <option value="New York">New York</option>
                        <option value="Overlap">London - NY Overlap</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#1A2421] mb-1.5">
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
                        className="w-full min-h-[44px] glass-input rounded-2xl px-3.5 py-2 text-sm font-mono tabular-nums"
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

                  <div className="divide-y divide-[#1A2421]/8 rounded-2xl bg-white/45 border border-white/75">
                    <div className="flex items-center justify-between gap-4 p-4">
                      <div>
                        <div className="text-xs sm:text-sm font-semibold text-[#1A2421]">
                          Animasi Transisi Halaman Halus
                        </div>
                        <div className="text-[11px] text-[#52625D] mt-0.5">
                          Efek transisi bergaya iOS saat berpindah menu
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
                          preferences.enableAnimations
                            ? 'bg-[#0D7A72]'
                            : 'bg-[#1A2421]/20'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform duration-200 ${
                            preferences.enableAnimations
                              ? 'translate-x-6'
                              : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-4 p-4">
                      <div>
                        <div className="text-xs sm:text-sm font-semibold text-[#1A2421]">
                          Kartu Ringkasan Padat
                        </div>
                        <div className="text-[11px] text-[#52625D] mt-0.5">
                          Menampilkan padding metrik Dashboard yang lebih ringkas
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
                          preferences.compactCards ? 'bg-[#0D7A72]' : 'bg-[#1A2421]/20'
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
              )}

              {/* 5. Security */}
              {activeSection === 'security' && (
                <section className="glass-card rounded-[28px] p-5 sm:p-6 space-y-5">
                  <div className="flex items-start gap-3 pb-4 border-b border-[#1A2421]/8">
                    <div className="w-10 h-10 rounded-2xl bg-[#D8EFE7] text-[#0D7A72] flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-[#1A2421]">
                        Keamanan Akun
                      </h3>
                      <p className="text-xs text-[#52625D] mt-0.5 truncate">
                        Sesi Supabase Authentication aktif · UID: {userUid.slice(0, 8)}...
                      </p>
                    </div>
                  </div>

                  {securityError && (
                    <div className="p-3 rounded-2xl bg-[#DC2626]/10 border border-[#DC2626]/20 text-xs text-[#B91C1C] font-medium">
                      {securityError}
                    </div>
                  )}
                  {securityFeedback && (
                    <div className="p-3 rounded-2xl bg-[#16A34A]/12 border border-[#16A34A]/25 text-xs text-[#15803D] font-medium flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>{securityFeedback}</span>
                    </div>
                  )}

                  <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div className="text-xs font-bold text-[#1A2421]">
                      Perbarui Password Akun
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[#52625D] mb-1.5">
                          Password Baru
                        </label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Minimal 6 karakter"
                            className="w-full min-h-[44px] glass-input rounded-2xl pl-3.5 pr-10 py-2 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword((prev) => !prev)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#52625D] hover:text-[#1A2421] cursor-pointer"
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
                        <label className="block text-xs font-medium text-[#52625D] mb-1.5">
                          Konfirmasi Password Baru
                        </label>
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          placeholder="Ulangi password baru"
                          className="w-full min-h-[44px] glass-input rounded-2xl px-3.5 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={
                          savingPassword || (!newPassword && !confirmNewPassword)
                        }
                        className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#0D7A72] hover:bg-[#095E58] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer active:scale-[0.98] transition-all"
                      >
                        {savingPassword ? 'Memperbarui...' : 'Ubah Password'}
                      </button>
                    </div>
                  </form>
                </section>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
