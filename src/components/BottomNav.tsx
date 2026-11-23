import {
  BarChart3,
  BookOpen,
  CalendarDays,
  History,
  LayoutDashboard,
  Settings,
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
  { id: 'journal', label: 'Jurnal Trading', icon: BookOpen },
  { id: 'calendar', label: 'Kalender', icon: CalendarDays },
  { id: 'history', label: 'Riwayat', icon: History },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
];

export function BottomNav({ activePage, onSelectPage }: BottomNavProps) {
  return (
    <nav
      aria-label="Navigasi utama"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FFFFFF]/95 backdrop-blur-md border-t border-[#E2E8F0] rounded-t-2xl shadow-[0_-4px_20px_rgba(15,23,42,0.06)] pb-safe pt-1.5 px-1"
    >
      <div className="grid grid-cols-6 items-center max-w-2xl mx-auto">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <motion.button
              key={item.id}
              type="button"
              whileTap={{ scale: 0.92 }}
              transition={{ duration: 0.14, ease: 'easeInOut' }}
              onClick={() => onSelectPage(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex flex-col items-center justify-center min-h-[48px] px-0.5 py-1 rounded-xl cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]/40"
            >
              {isActive && (
                <motion.span
                  layoutId="ios-bottom-nav-indicator"
                  transition={{ duration: 0.24, ease: [0.25, 0.1, 0.25, 1] }}
                  className="absolute top-0 w-6 h-[2.5px] rounded-full bg-[#0D9488]"
                />
              )}

              <motion.span
                animate={{
                  scale: isActive ? 1.06 : 1,
                  y: isActive ? -1 : 0,
                }}
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                className={`flex items-center justify-center w-5 h-5 transition-colors duration-200 ${
                  isActive ? 'text-[#0D9488]' : 'text-[#64748B]'
                }`}
              >
                <Icon className="w-[19px] h-[19px]" strokeWidth={isActive ? 2.2 : 1.8} />
              </motion.span>

              <span
                className={`mt-0.5 text-[9px] sm:text-[10px] leading-tight tracking-tight whitespace-nowrap truncate max-w-full transition-colors duration-200 ${
                  isActive
                    ? 'font-semibold text-[#0D9488]'
                    : 'font-medium text-[#64748B]'
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
