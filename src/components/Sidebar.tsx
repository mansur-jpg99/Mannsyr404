import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { AppPage, HistoryTab, Profile, TradingAccount } from '../types.ts';
import { BrandLogo } from './Logo.tsx';
import { formatCurrency } from '../utils/formatters.ts';

interface SidebarProps {
  activePage: AppPage;
  historyTab: HistoryTab;
  onSelectPage: (page: AppPage, historySubTab?: HistoryTab) => void;
  accounts: TradingAccount[];
  activeAccount: TradingAccount | null;
  onSelectAccount: (accountId: number) => void;
  onOpenAccountModal: () => void;
  profile: Profile | null;
  userEmail: string;
  onSignOut: () => void;
}

const NAV_ITEMS: Array<{ id: AppPage; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'journal', label: 'Jurnal Trading', icon: BookOpen },
  { id: 'calendar', label: 'Kalender', icon: CalendarDays },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'history', label: 'Riwayat', icon: History },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
];

const HISTORY_SUB_ITEMS: Array<{
  id: HistoryTab;
  label: string;
  icon: typeof History;
}> = [
  { id: 'trades', label: 'Daftar Transaksi', icon: History },
  { id: 'reviews', label: 'Evaluasi Harian', icon: ClipboardCheck },
  { id: 'reports', label: 'Laporan & CSV', icon: FileSpreadsheet },
];

export function Sidebar({
  activePage,
  historyTab,
  onSelectPage,
  accounts,
  activeAccount,
  onSelectAccount,
  onOpenAccountModal,
  profile,
  userEmail,
  onSignOut,
}: SidebarProps) {
  const displayName = profile?.fullName || userEmail.split('@')[0] || 'Trader';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <aside className="hidden lg:block shrink-0 h-screen sticky top-0 p-3 pr-0">
      <div className="flex flex-col h-full w-64 glass-card rounded-[26px] overflow-hidden">
        {/* Brand Header */}
        <div className="flex items-center px-5 h-16 border-b border-[#1A2421]/8 shrink-0">
          <BrandLogo size={34} subtitle="Jurnal Trading Forex" />
        </div>

        {/* Account Selector */}
        <div className="px-4 py-4 border-b border-[#1A2421]/8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-[#52625D]">
              Akun Trading Aktif
            </span>
            <button
              type="button"
              onClick={onOpenAccountModal}
              className="text-[11px] font-semibold text-[#0D7A72] hover:text-[#095E58] flex items-center gap-1 cursor-pointer"
            >
              <Settings className="w-3 h-3" />
              <span>Kelola</span>
            </button>
          </div>

          <div className="relative">
            <select
              value={activeAccount?.id || ''}
              onChange={(e) => onSelectAccount(Number(e.target.value))}
              className="w-full appearance-none glass-input rounded-2xl pl-3.5 pr-8 py-2.5 text-xs font-semibold cursor-pointer"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.currency})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#52625D] pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
          </div>

          {activeAccount && (
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#52625D]">
              <span>Modal Awal</span>
              <span className="font-mono font-semibold tabular-nums text-[#1A2421]">
                {formatCurrency(activeAccount.initialBalance, activeAccount.currency)}
              </span>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <div key={item.id}>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.14 }}
                  onClick={() => onSelectPage(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-medium transition-all duration-150 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#D8EFE7] text-[#0D7A72] font-semibold shadow-2xs'
                      : 'text-[#52625D] hover:text-[#1A2421] hover:bg-white/55'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#0D7A72]' : 'text-[#52625D]'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </motion.button>

                {item.id === 'history' && activePage === 'history' && (
                  <div className="mt-1.5 ml-4 pl-3 border-l border-[#1A2421]/10 space-y-1">
                    {HISTORY_SUB_ITEMS.map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = historyTab === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => onSelectPage('history', sub.id)}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                            isSubActive
                              ? 'text-[#0D7A72] bg-[#D8EFE7]/75 font-semibold'
                              : 'text-[#52625D] hover:text-[#1A2421] hover:bg-white/45'
                          }`}
                        >
                          <SubIcon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Trader Profile & Sign Out */}
        <div className="p-4 border-t border-[#1A2421]/8 space-y-3 bg-white/30">
          <button
            type="button"
            onClick={() => onSelectPage('settings')}
            className="w-full flex items-center gap-2.5 text-left rounded-xl hover:bg-white/40 p-1 -m-1 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0D7A72] to-[#14B8A6] text-white text-xs font-bold flex items-center justify-center shrink-0">
              {initials || 'TR'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[#1A2421] truncate">
                {displayName}
              </div>
              <div className="text-[11px] text-[#52625D] truncate">{userEmail}</div>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenAccountModal}
              className="flex-1 py-2 px-3 rounded-xl bg-white/75 hover:bg-white border border-white/80 text-xs font-medium text-[#1A2421] flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-[0.98] transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-[#0D7A72]" />
              <span>Akun Baru</span>
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="py-2 px-3 rounded-xl bg-white/75 hover:bg-[#DC2626]/10 border border-white/80 hover:border-[#DC2626]/20 text-xs font-medium text-[#52625D] hover:text-[#B91C1C] flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors active:scale-[0.98]"
              title="Keluar dari akun"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
