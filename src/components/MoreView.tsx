import { useState } from 'react';
import {
  ChevronRight,
  ClipboardCheck,
  Coins,
  FileSpreadsheet,
  History,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  User,
  Wallet,
  Check,
} from 'lucide-react';
import { motion } from 'motion/react';
import type {
  AppPage,
  CurrencyCode,
  HistoryTab,
  Profile,
  SettingsSection,
  TradingAccount,
} from '../types.ts';
import {
  formatCurrency,
  getUserInitials,
  resolveUserDisplayName,
} from '../utils/formatters.ts';

interface MoreViewProps {
  profile: Profile | null;
  displayName?: string;
  userEmail: string;
  accounts: TradingAccount[];
  activeAccount: TradingAccount | null;
  currentBalance: number;
  currency: CurrencyCode;
  onSelectAccount: (accountId: number) => void;
  onSelectPage: (
    page: AppPage,
    options?: { historyTab?: HistoryTab; settingsSection?: SettingsSection }
  ) => void;
  onOpenAccountModal: () => void;
  onSignOut: () => Promise<void>;
}

export function MoreView({
  profile,
  displayName: resolvedNameProp,
  userEmail,
  accounts,
  activeAccount,
  currentBalance,
  currency,
  onSelectAccount,
  onSelectPage,
  onOpenAccountModal,
  onSignOut,
}: MoreViewProps) {
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const displayName =
    resolvedNameProp?.trim() ||
    resolveUserDisplayName(profile, { email: userEmail });
  const initials = getUserInitials(displayName, userEmail);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Trader Identity Glass Header */}
      <section className="glass-card rounded-[26px] p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#0D7A72] to-[#14B8A6] text-white font-bold text-base flex items-center justify-center shrink-0 shadow-[0_6px_16px_rgba(13,122,114,0.25)]">
            {initials}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#1A2421] truncate">
              {displayName}
            </h2>
            <p className="text-xs text-[#52625D] truncate">{userEmail}</p>
            <p className="text-[11px] font-medium text-[#0D7A72] mt-0.5 truncate">
              {profile?.traderStyle || 'Trader Disiplin'} ·{' '}
              <span className="font-mono tabular-nums">
                {formatCurrency(currentBalance, currency)}
              </span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelectPage('settings', { settingsSection: 'profile' })}
          className="min-h-[42px] px-3.5 py-2 rounded-2xl bg-white/75 hover:bg-white border border-white/80 text-xs font-semibold text-[#0D7A72] shrink-0 cursor-pointer active:scale-95 transition-transform"
        >
          Profil
        </button>
      </section>

      {/* Active Account Quick Switcher */}
      <section className="glass-card rounded-[26px] p-5 space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#1A2421]">Akun Trading</h3>
            <p className="text-xs text-[#52625D]">
              Ketuk untuk berpindah portofolio akun
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAccountModal}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#D8EFE7] hover:bg-[#C6E7DB] text-[#0D7A72] text-xs font-semibold cursor-pointer whitespace-nowrap active:scale-95 transition-transform"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Kelola</span>
          </button>
        </div>

        <div className="space-y-2">
          {accounts.map((acc) => {
            const isSelected = activeAccount?.id === acc.id;
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => onSelectAccount(acc.id)}
                className={`w-full min-h-[54px] px-4 py-3 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all cursor-pointer active:scale-[0.99] ${
                  isSelected
                    ? 'bg-[#D8EFE7]/75 border-[#0D7A72]/35 text-[#1A2421]'
                    : 'bg-white/45 hover:bg-white/70 border-white/70 text-[#1A2421]'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-semibold truncate">
                    {acc.name}
                  </div>
                  <div className="text-[11px] text-[#52625D] truncate">
                    {acc.broker || 'Broker pribadi'} · {acc.currency} ·{' '}
                    <span className="font-mono tabular-nums">
                      {formatCurrency(acc.initialBalance, acc.currency)}
                    </span>
                  </div>
                </div>
                {isSelected && (
                  <span className="w-6 h-6 rounded-full bg-[#0D7A72] text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Group 1: History, Daily Review & CSV Reports */}
      <section className="glass-card rounded-[26px] overflow-hidden divide-y divide-[#1A2421]/8">
        <div className="px-5 py-3 text-[11px] font-semibold text-[#52625D]">
          Riwayat &amp; Evaluasi
        </div>
        {[
          {
            title: 'Riwayat Transaksi',
            subtitle: 'Telusuri seluruh eksekusi lengkap beserta filter status',
            icon: History,
            action: () => onSelectPage('history', { historyTab: 'trades' }),
          },
          {
            title: 'Evaluasi Harian',
            subtitle: 'Catatan emosi, skor kedisiplinan, dan refleksi sesi',
            icon: ClipboardCheck,
            action: () => onSelectPage('history', { historyTab: 'reviews' }),
          },
          {
            title: 'Laporan & Ekspor CSV',
            subtitle: 'Rekap harian, mingguan, bulanan, dan unduh file CSV',
            icon: FileSpreadsheet,
            action: () => onSelectPage('history', { historyTab: 'reports' }),
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.title}
              type="button"
              whileTap={{ scale: 0.99 }}
              onClick={item.action}
              className="w-full px-5 py-3.5 min-h-[58px] flex items-center justify-between gap-3 text-left hover:bg-white/45 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-[#D8EFE7]/90 text-[#0D7A72] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#1A2421] truncate">
                    {item.title}
                  </div>
                  <div className="text-xs text-[#52625D] truncate">
                    {item.subtitle}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#52625D] shrink-0" />
            </motion.button>
          );
        })}
      </section>

      {/* Group 2: Settings & Profile */}
      <section className="glass-card rounded-[26px] overflow-hidden divide-y divide-[#1A2421]/8">
        <div className="px-5 py-3 text-[11px] font-semibold text-[#52625D]">
          Profil &amp; Pengaturan
        </div>
        {[
          {
            title: 'Informasi Pribadi',
            subtitle: 'Nama tampilan dan gaya trading utama',
            icon: User,
            action: () => onSelectPage('settings', { settingsSection: 'profile' }),
          },
          {
            title: 'Akun & Portofolio',
            subtitle: 'Tambah, ubah modal awal, atau pilih akun aktif',
            icon: Wallet,
            action: () => onSelectPage('settings', { settingsSection: 'accounts' }),
          },
          {
            title: 'Mata Uang (IDR / USD / USC)',
            subtitle: `Saat ini menggunakan format ${currency}`,
            icon: Coins,
            action: () => onSelectPage('settings', { settingsSection: 'currency' }),
          },
          {
            title: 'Preferensi & Keamanan',
            subtitle: 'Default lot, animasi iOS, serta ubah password',
            icon: Settings,
            action: () => onSelectPage('settings', { settingsSection: 'preferences' }),
          },
          {
            title: 'Keamanan Akun',
            subtitle: 'Perbarui kata sandi sesi Supabase Authentication',
            icon: ShieldCheck,
            action: () => onSelectPage('settings', { settingsSection: 'security' }),
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.title}
              type="button"
              whileTap={{ scale: 0.99 }}
              onClick={item.action}
              className="w-full px-5 py-3.5 min-h-[58px] flex items-center justify-between gap-3 text-left hover:bg-white/45 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-white/80 text-[#1A2421] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-[#0D7A72]" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#1A2421] truncate">
                    {item.title}
                  </div>
                  <div className="text-xs text-[#52625D] truncate">
                    {item.subtitle}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#52625D] shrink-0" />
            </motion.button>
          );
        })}
      </section>

      {/* Logout Card */}
      <section className="glass-card rounded-[26px] p-4">
        {confirmLogout ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs font-medium text-[#1A2421]">
              Akhiri sesi MANSYR404 pada perangkat ini?
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={signingOut}
                onClick={handleLogout}
                className="flex-1 sm:flex-none min-h-[42px] px-4 py-2 rounded-2xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-semibold cursor-pointer"
              >
                {signingOut ? 'Keluar...' : 'Ya, Keluar'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmLogout(false)}
                className="min-h-[42px] px-3.5 py-2 rounded-2xl bg-white/75 text-xs font-medium text-[#52625D] cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            className="w-full min-h-[46px] flex items-center justify-center gap-2 rounded-2xl bg-[#DC2626]/10 hover:bg-[#DC2626]/15 text-[#B91C1C] text-sm font-semibold transition-colors cursor-pointer active:scale-[0.99]"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        )}
      </section>
    </div>
  );
}
