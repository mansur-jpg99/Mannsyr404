/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Plus } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { getSupabaseClient, initSupabaseClient } from './lib/supabase.ts';
import { apiRequest } from './lib/api.ts';
import type {
  AppPage,
  AppPreferences,
  DailyReview,
  HistoryTab,
  Profile,
  Trade,
  TradingAccount,
} from './types.ts';
import { calculateAnalytics } from './utils/analytics.ts';
import { formatCurrency } from './utils/formatters.ts';
import { AuthScreen } from './components/AuthScreen.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { JournalView } from './components/JournalView.tsx';
import { CalendarView } from './components/CalendarView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { AnalyticsView } from './components/AnalyticsView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { TradeFormModal } from './components/TradeFormModal.tsx';
import { TradeDetailDrawer } from './components/TradeDetailDrawer.tsx';
import { LogoMark, LogoSymbol } from './components/Logo.tsx';

const PAGE_ORDER: AppPage[] = [
  'dashboard',
  'journal',
  'calendar',
  'history',
  'analytics',
  'settings',
];

const PAGE_TITLES: Record<AppPage, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Ringkasan saldo, metrik eksekusi, kurva equity, dan transaksi terbaru',
  },
  journal: {
    title: 'Jurnal Trading',
    subtitle: 'Kelola catatan posisi, filter setup, alasan entry, dan screenshot chart',
  },
  calendar: {
    title: 'Kalender Trading',
    subtitle: 'Pantau profitabilitas harian dan tinjau seluruh transaksi per tanggal',
  },
  history: {
    title: 'Riwayat & Laporan',
    subtitle: 'Riwayat transaksi, evaluasi harian, serta laporan performa & ekspor CSV',
  },
  analytics: {
    title: 'Analytics',
    subtitle: 'Evaluasi statistik, drawdown, pair terbaik, strategi, dan sesi trading',
  },
  settings: {
    title: 'Pengaturan',
    subtitle: 'Profil pengguna, akun trading, mata uang IDR/USD/USC, preferensi & keamanan',
  },
};

const PREFS_STORAGE_KEY = 'mansyr404_preferences_v1';

const DEFAULT_PREFERENCES: AppPreferences = {
  defaultSession: 'London',
  defaultLotSize: '0.10',
  enableAnimations: true,
  compactCards: false,
};

function loadSavedPreferences(): AppPreferences {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

const pageVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? 18 : -18,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? -14 : 14,
  }),
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<number | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [reviews, setReviews] = useState<DailyReview[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState('');

  const [activePage, setActivePage] = useState<AppPage>('dashboard');
  const [historyTab, setHistoryTab] = useState<HistoryTab>('trades');
  const [navDirection, setNavDirection] = useState<number>(1);
  const [preferences, setPreferences] = useState<AppPreferences>(loadSavedPreferences);

  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [defaultTradeDate, setDefaultTradeDate] = useState<string | undefined>(undefined);
  const [inspectingTrade, setInspectingTrade] = useState<Trade | null>(null);

  useEffect(() => {
    let active = true;
    let subscription: { unsubscribe: () => void } | null = null;

    initSupabaseClient().then(async (supabase) => {
      if (!active) return;
      if (!supabase) {
        setUser(null);
        setAuthReady(true);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setUser(data.session?.user ?? null);
      setAuthReady(true);

      const { data: listenerData } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          const nextUser = session?.user ?? null;
          setUser(nextUser);
          setAuthReady(true);
          if (!nextUser) {
            setProfile(null);
            setAccounts([]);
            setActiveAccountId(null);
            setTrades([]);
            setReviews([]);
            setActivePage('dashboard');
          }
        }
      );
      subscription = listenerData.subscription;
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  const loadWorkspaceProfile = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;

    setLoadingData(true);
    setDataError('');
    try {
      const data = await apiRequest<{
        profile: Profile | null;
        accounts: TradingAccount[];
      }>('/api/profile');
      setProfile(data.profile);
      setAccounts(data.accounts);

      setActiveAccountId((prevId) => {
        if (prevId && data.accounts.some((a) => a.id === prevId)) {
          return prevId;
        }
        return data.accounts[0]?.id ?? null;
      });
    } catch (err: any) {
      setDataError(err.message || 'Gagal memuat ruang kerja akun.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  const loadAccountData = useCallback(async (accountId: number) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    setLoadingData(true);
    setDataError('');
    try {
      const [tradeRows, reviewRows] = await Promise.all([
        apiRequest<Trade[]>(`/api/trades?accountId=${accountId}`),
        apiRequest<DailyReview[]>(`/api/reviews?accountId=${accountId}`),
      ]);
      setTrades(tradeRows);
      setReviews(reviewRows);
      setInspectingTrade((curr) =>
        curr ? tradeRows.find((t) => t.id === curr.id) || null : null
      );
    } catch (err: any) {
      setDataError(err.message || 'Gagal memuat data transaksi.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadWorkspaceProfile();
    }
  }, [user, loadWorkspaceProfile]);

  useEffect(() => {
    if (user && activeAccountId) {
      loadAccountData(activeAccountId);
    }
  }, [user, activeAccountId, loadAccountData]);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) || accounts[0] || null,
    [accounts, activeAccountId]
  );

  const analytics = useMemo(
    () => calculateAnalytics(trades, activeAccount?.initialBalance ?? 0),
    [trades, activeAccount]
  );

  const handleSelectPage = (nextPage: AppPage, nextHistoryTab?: HistoryTab) => {
    if (nextHistoryTab) {
      setHistoryTab(nextHistoryTab);
    }
    if (nextPage === activePage) return;

    const currentIdx = PAGE_ORDER.indexOf(activePage);
    const nextIdx = PAGE_ORDER.indexOf(nextPage);
    setNavDirection(nextIdx >= currentIdx ? 1 : -1);
    setActivePage(nextPage);
  };

  const handleUpdatePreferences = (next: AppPreferences) => {
    setPreferences(next);
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  const handleOpenNewTrade = (dateStr?: string) => {
    setEditingTrade(null);
    setDefaultTradeDate(dateStr);
    setTradeModalOpen(true);
  };

  const handleEditTrade = (trade: Trade) => {
    setInspectingTrade(null);
    setEditingTrade(trade);
    setDefaultTradeDate(undefined);
    setTradeModalOpen(true);
  };

  const handleRefreshAll = async () => {
    await loadWorkspaceProfile();
    if (activeAccountId) {
      await loadAccountData(activeAccountId);
    }
  };

  const handleSignOut = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center gap-4">
        <LogoMark size={44} />
        <p className="text-xs font-medium text-[#64748B]">Memuat MANSYR404...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const pageHeader = PAGE_TITLES[activePage];
  const currency = activeAccount?.currency || 'USD';

  return (
    <MotionConfig reducedMotion={preferences.enableAnimations ? 'user' : 'always'}>
      <div className="min-h-screen bg-[#F8FAFC] text-[#172033] flex">
        {/* Desktop Sidebar (hidden on HP / tablet < lg) */}
        <Sidebar
          activePage={activePage}
          historyTab={historyTab}
          onSelectPage={handleSelectPage}
          accounts={accounts}
          activeAccount={activeAccount}
          onSelectAccount={setActiveAccountId}
          profile={profile}
          userEmail={user.email || ''}
          onSignOut={handleSignOut}
        />

        <div className="flex-1 min-w-0 flex flex-col">
          {/* Simple Mobile & Clean Desktop Top Bar */}
          <header className="sticky top-0 z-30 h-14 lg:h-16 bg-[#FFFFFF]/95 backdrop-blur-md border-b border-[#E2E8F0] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="lg:hidden shrink-0">
                <LogoSymbol size={30} />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-semibold text-[#172033] truncate">
                  {pageHeader.title}
                </h1>
                <p className="hidden lg:block text-xs text-[#64748B] truncate">
                  {pageHeader.subtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {activeAccount && (
                <div className="hidden sm:flex items-center gap-2 text-xs text-[#64748B]">
                  <span className="hidden md:inline">{activeAccount.name}</span>
                  <span className="hidden md:inline text-[#CBD5E1]">·</span>
                  <span className="font-mono tabular-nums text-[#172033] font-semibold">
                    {formatCurrency(analytics.currentBalance, currency)}
                  </span>
                </div>
              )}

              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                transition={{ duration: 0.14 }}
                disabled={!activeAccount}
                onClick={() => handleOpenNewTrade()}
                className="inline-flex items-center justify-center gap-1.5 min-h-[40px] py-2 px-3.5 sm:px-4 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-50 text-white font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span className="sm:hidden">Tambah</span>
                <span className="hidden sm:inline">Tambah Transaksi</span>
              </motion.button>
            </div>
          </header>

          {/* Main Viewport with bottom-safe padding on mobile */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 main-safe-bottom max-w-[1440px] w-full mx-auto overflow-x-hidden">
            {dataError && (
              <div className="mb-5 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-between gap-4">
                <span className="text-xs text-[#DC2626] font-medium">{dataError}</span>
                <button
                  type="button"
                  onClick={handleRefreshAll}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white border border-red-200 text-[#DC2626] text-xs font-semibold hover:bg-red-100 cursor-pointer"
                >
                  Coba Lagi
                </button>
              </div>
            )}

            {loadingData && trades.length === 0 && !activeAccount ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-28 rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <AnimatePresence mode="wait" custom={navDirection}>
                <motion.div
                  key={activePage}
                  custom={navDirection}
                  variants={pageVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    duration: 0.24,
                    ease: [0.25, 0.1, 0.25, 1],
                  }}
                >
                  {activePage === 'dashboard' && (
                    <DashboardView
                      analytics={analytics}
                      currency={currency}
                      trades={trades}
                      compactCards={preferences.compactCards}
                      onAddTrade={() => handleOpenNewTrade()}
                      onInspectTrade={setInspectingTrade}
                      onNavigateToJournal={() => handleSelectPage('journal')}
                    />
                  )}

                  {activePage === 'journal' && (
                    <JournalView
                      trades={trades}
                      currency={currency}
                      onAddTrade={() => handleOpenNewTrade()}
                      onEditTrade={handleEditTrade}
                      onInspectTrade={setInspectingTrade}
                      onRefresh={() =>
                        activeAccountId ? loadAccountData(activeAccountId) : Promise.resolve()
                      }
                    />
                  )}

                  {activePage === 'calendar' && (
                    <CalendarView
                      trades={trades}
                      currency={currency}
                      onInspectTrade={setInspectingTrade}
                      onAddTradeOnDate={(dateStr) => handleOpenNewTrade(dateStr)}
                    />
                  )}

                  {activePage === 'history' && activeAccount && (
                    <HistoryView
                      activeTab={historyTab}
                      onChangeTab={setHistoryTab}
                      accountId={activeAccount.id}
                      accountName={activeAccount.name}
                      currency={currency}
                      trades={trades}
                      reviews={reviews}
                      onInspectTrade={setInspectingTrade}
                      onRefresh={() => loadAccountData(activeAccount.id)}
                    />
                  )}

                  {activePage === 'analytics' && (
                    <AnalyticsView analytics={analytics} currency={currency} />
                  )}

                  {activePage === 'settings' && (
                    <SettingsView
                      profile={profile}
                      userEmail={user.email || ''}
                      userUid={user.id}
                      accounts={accounts}
                      activeAccount={activeAccount}
                      onSelectAccount={setActiveAccountId}
                      onRefresh={handleRefreshAll}
                      preferences={preferences}
                      onUpdatePreferences={handleUpdatePreferences}
                      onSignOut={handleSignOut}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </main>
        </div>

        {/* Mobile Bottom Navigation Bar */}
        <BottomNav activePage={activePage} onSelectPage={handleSelectPage} />

        {/* Trade Modals & Drawers */}
        {activeAccount && (
          <TradeFormModal
            open={tradeModalOpen}
            onClose={() => setTradeModalOpen(false)}
            accountId={activeAccount.id}
            currency={currency}
            editingTrade={editingTrade}
            defaultDate={defaultTradeDate}
            defaultSession={preferences.defaultSession}
            defaultLotSize={preferences.defaultLotSize}
            onSaved={() => loadAccountData(activeAccount.id)}
          />
        )}

        <TradeDetailDrawer
          trade={inspectingTrade}
          currency={currency}
          onClose={() => setInspectingTrade(null)}
          onEdit={handleEditTrade}
          onScreenshotsChanged={() =>
            activeAccountId ? loadAccountData(activeAccountId) : Promise.resolve()
          }
        />
      </div>
    </MotionConfig>
  );
}
