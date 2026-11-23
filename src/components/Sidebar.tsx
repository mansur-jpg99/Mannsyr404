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
  profile: Profile | null;
  userEmail: string;
  onSignOut: () => void;
}

const NAV_ITEMS: Array<{ id: AppPage; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'journal', label: 'Jurnal Trading', icon: BookOpen },
  { id: 'calendar', label: 'Kalender', icon: CalendarDays },
  { id: 'history', label: 'Riwayat', icon: History },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
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
  profile,
  userEmail,
  onSignOut,
}: SidebarProps) {
  return (
    <aside className="hidden lg:block shrink-0 h-screen sticky top-0">
      <div className="flex flex-col h-full w-64 bg-[#FFFFFF] border-r border-[#E2E8F0]">
        {/* Brand Header */}
        <div className="flex items-center px-5 h-16 border-b border-[#E2E8F0] shrink-0">
          <BrandLogo size={34} subtitle="Jurnal Trading Forex" />
        </div>

        {/* Account Selector */}
        <div className="px-4 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-[#64748B]">
              Akun Trading Aktif
            </span>
            <button
              type="button"
              onClick={() => onSelectPage('settings')}
              className="text-[11px] font-medium text-[#0D9488] hover:text-[#0F766E] flex items-center gap-1 cursor-pointer"
            >
              <Settings className="w-3 h-3" />
              <span>Kelola</span>
            </button>
          </div>

          <div className="relative">
            <select
              value={activeAccount?.id || ''}
              onChange={(e) => onSelectAccount(Number(e.target.value))}
              className="w-full appearance-none bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg pl-3 pr-8 py-2 text-xs font-medium text-[#172033] focus:outline-none focus:border-[#0D9488] cursor-pointer"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.currency})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#64748B] pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>

          {activeAccount && (
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#64748B]">
              <span>Modal Awal</span>
              <span className="font-mono font-medium tabular-nums text-[#172033]">
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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#0D9488]/10 text-[#0D9488] border border-[#0D9488]/20'
                      : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC] border border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors duration-200 ${
                      isActive ? 'text-[#0D9488]' : 'text-[#64748B]'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </motion.button>

                {item.id === 'history' && activePage === 'history' && (
                  <div className="mt-1 ml-4 pl-3 border-l border-[#E2E8F0] space-y-0.5">
                    {HISTORY_SUB_ITEMS.map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = historyTab === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => onSelectPage('history', sub.id)}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                            isSubActive
                              ? 'text-[#0D9488] bg-[#0D9488]/8'
                              : 'text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]'
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
        <div className="p-4 border-t border-[#E2E8F0] space-y-3 bg-[#F8FAFC]/60">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-[#172033] truncate">
              {profile?.fullName || userEmail.split('@')[0] || 'Trader'}
            </div>
            <div className="text-[11px] text-[#64748B] truncate">{userEmail}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectPage('settings')}
              className="flex-1 py-2 px-3 rounded-lg bg-[#FFFFFF] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-medium text-[#172033] flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-[0.98] transition-transform"
            >
              <Plus className="w-3.5 h-3.5 text-[#0D9488]" />
              <span>Akun Baru</span>
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="py-2 px-3 rounded-lg bg-[#FFFFFF] hover:bg-red-50 border border-[#E2E8F0] hover:border-red-200 text-xs font-medium text-[#64748B] hover:text-[#DC2626] flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors active:scale-[0.98]"
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
