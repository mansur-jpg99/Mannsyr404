import {
  BarChart3,
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  LayoutGrid,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { AppPage } from '../types.ts';

interface BottomNavProps {
  activePage: AppPage;
  onSelectPage: (page: AppPage) => void;
}

const BOTTOM_NAV_ITEMS: Array<{
  id: AppPage;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'journal', label: 'Journal', icon: BookOpen },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'more', label: 'More', icon: LayoutGrid },
];

export function BottomNav({ activePage, onSelectPage }: BottomNavProps) {
  return (
    <nav
      aria-label="Navigasi utama"
      className="lg:hidden fixed bottom-2.5 left-3 right-3 z-40 max-w-md mx-auto glass-dock rounded-[26px] px-2 pt-1.5 pb-safe"
    >
      <div className="grid grid-cols-5 items-center gap-1">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isMoreBranch =
            item.id === 'more' &&
            (activePage === 'more' ||
              activePage === 'history' ||
              activePage === 'settings');
          const isActive = activePage === item.id || isMoreBranch;

          return (
            <motion.button
              key={item.id}
              type="button"
              whileTap={{ scale: 0.92 }}
              transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => onSelectPage(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex flex-col items-center justify-center min-h-[48px] px-1 py-1.5 rounded-[20px] cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A72]/40"
            >
              {isActive && (
                <motion.span
                  layoutId="ios-bottom-dock-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0.5 rounded-[18px] bg-[#D8EFE7]/90 border border-[#0D7A72]/15"
                />
              )}

              <span
                className={`relative z-10 flex items-center justify-center w-5 h-5 transition-colors duration-150 ${
                  isActive ? 'text-[#0D7A72]' : 'text-[#52625D]'
                }`}
              >
                <Icon className="w-[19px] h-[19px]" strokeWidth={isActive ? 2.25 : 1.8} />
              </span>

              <span
                className={`relative z-10 mt-0.5 text-[10px] leading-tight tracking-tight whitespace-nowrap truncate max-w-full transition-colors duration-150 ${
                  isActive
                    ? 'font-semibold text-[#0D7A72]'
                    : 'font-medium text-[#52625D]'
                }`}
              >
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
