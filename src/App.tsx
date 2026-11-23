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
  SettingsSection,
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
import { MoreView } from './components/MoreView.tsx';
import { AccountModal } from './components/AccountModal.tsx';
import { TradeFormModal } from './components/TradeFormModal.tsx';
import { TradeDetailDrawer } from './components/TradeDetailDrawer.tsx';
import { LogoMark, LogoSymbol } from './components/Logo.tsx';

const PAGE_ORDER: AppPage[] = [
  'dashboard',
  'journal',
  'calendar',
  'analytics',
  'more',
  'history',
  'settings',
];

const PAGE_TITLES: Record<AppPage, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Ringkasan saldo, metrik harian, kurva equity, dan aktivitas trading terbaru',
  },
  journal: {
    title: 'Journal',
    subtitle: 'Kelola catatan posisi, filter setup, alasan entry, dan screenshot chart',
  },
  calendar: {
    title: 'Calendar',
    subtitle: 'Pantau profitabilitas harian dan tinjau seluruh transaksi per tanggal',
  },
  analytics: {
    title: 'Analytics',
    subtitle: 'Statistik performa harian, mingguan, bulanan, drawdown, pair & sesi',
  },
  more: {
    title: 'More',
    subtitle: 'Riwayat transaksi, evaluasi harian, laporan CSV, profil & pengaturan akun',
  },
  history: {
    title: 'History & Reports',
    subtitle: 'Riwayat transaksi, evaluasi harian, serta laporan performa & ekspor CSV',
  },
  settings: {
    title: 'Settings',
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
    x: direction >= 0 ? 16 : -16,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? -12 : 12,
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
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('profile');
  const [navDirection, setNavDirection] = useState<number>(1);
  const [preferences, setPreferences] = useState<AppPreferences>(loadSavedPreferences);

  const [accountModalOpen, setAccountModalOpen] = useState(false);
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

  const handleSelectPage = (
    nextPage: AppPage,
    options?: HistoryTab | { historyTab?: HistoryTab; settingsSection?: SettingsSection }
  ) => {
    if (typeof options === 'string') {
      setHistoryTab(options);
    } else if (options) {
      if (options.historyTab) setHistoryTab(options.historyTab);
      if (options.settingsSection) setSettingsSection(options.settingsSection);
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
      <div className="min-h-screen sage-canvas flex flex-col items-center justify-center gap-4">
        <LogoMark size={44} />
        <p className="text-xs font-medium text-[#52625D]">Memuat MANSYR404...</p>
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
      <div className="min-h-screen sage-canvas text-[#1A2421] flex">
        {/* Desktop Glass Sidebar (hidden on HP / tablet < lg) */}
        <Sidebar
          activePage={activePage}
          historyTab={historyTab}
          onSelectPage={handleSelectPage}
          accounts={accounts}
          activeAccount={activeAccount}
          onSelectAccount={setActiveAccountId}
          onOpenAccountModal={() => setAccountModalOpen(true)}
          profile={profile}
          userEmail={user.email || ''}
          onSignOut={handleSignOut}
        />

        <div className="flex-1 min-w-0 flex flex-col">
          {/* Compact Glass Top Bar */}
          <header className="sticky top-0 z-30 px-3 sm:px-6 lg:px-8 pt-2.5 lg:pt-3">
            <div className="glass-card rounded-[22px] h-13 lg:h-15 px-4 sm:px-5 flex items-center justify-between gap-3 max-w-[1440px] mx-auto">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="lg:hidden shrink-0">
                  <LogoSymbol size={28} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-sm sm:text-base font-bold text-[#1A2421] truncate">
                    {pageHeader.title}
                  </h1>
                  <p className="hidden lg:block text-xs text-[#52625D] truncate">
                    {pageHeader.subtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {activeAccount && (
                  <div className="hidden sm:flex items-center gap-2 text-xs text-[#52625D]">
                    <span className="hidden md:inline font-medium">{activeAccount.name}</span>
                    <span className="hidden md:inline text-[#1A2421]/25">·</span>
                    <span className="font-mono tabular-nums text-[#1A2421] font-bold">
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
                  className="inline-flex items-center justify-center gap-1.5 min-h-[38px] py-2 px-3.5 sm:px-4 rounded-2xl bg-[#0D7A72] hover:bg-[#095E58] disabled:opacity-50 text-white font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-[0_6px_16px_rgba(13,122,114,0.22)]"
                >
                  <Plus className="w-4 h-4" />
                  <span className="sm:hidden">Tambah</span>
                  <span className="hidden sm:inline">Tambah Transaksi</span>
                </motion.button>
              </div>
            </div>
          </header>

          {/* Main Viewport with bottom-safe padding for floating iOS dock */}
          <main className="flex-1 p-3 sm:p-6 lg:p-8 pt-4 sm:pt-5 main-safe-bottom max-w-[1440px] w-full mx-auto overflow-x-hidden">
            {dataError && (
              <div className="mb-5 p-4 rounded-[22px] bg-[#DC2626]/10 border border-[#DC2626]/20 flex items-center justify-between gap-4">
                <span className="text-xs text-[#B91C1C] font-medium">{dataError}</span>
                <button
                  type="button"
                  onClick={handleRefreshAll}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-2xl bg-white/85 text-[#B91C1C] text-xs font-semibold hover:bg-white cursor-pointer"
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
                    className="h-28 rounded-[24px] glass-card animate-pulse"
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
                    duration: 0.22,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  {activePage === 'dashboard' && (
                    <DashboardView
                      analytics={analytics}
                      currency={currency}
                      trades={trades}
                      compactCards={preferences.compactCards}
                      traderName={profile?.fullName}
                      userEmail={user.email || ''}
                      accountName={activeAccount?.name}
                      onAddTrade={() => handleOpenNewTrade()}
                      onInspectTrade={setInspectingTrade}
                      onNavigateToJournal={() => handleSelectPage('journal')}
                      onNavigateToProfile={() =>
                        handleSelectPage('settings', { settingsSection: 'profile' })
                      }
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

                  {activePage === 'analytics' && (
                    <AnalyticsView
                      analytics={analytics}
                      trades={trades}
                      initialBalance={activeAccount?.initialBalance ?? 0}
                      currency={currency}
                    />
                  )}

                  {activePage === 'more' && (
                    <MoreView
                      profile={profile}
                      userEmail={user.email || ''}
                      accounts={accounts}
                      activeAccount={activeAccount}
                      currentBalance={analytics.currentBalance}
                      currency={currency}
                      onSelectAccount={setActiveAccountId}
                      onSelectPage={handleSelectPage}
                      onOpenAccountModal={() => setAccountModalOpen(true)}
                      onSignOut={handleSignOut}
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
                      activeSection={settingsSection}
                      onChangeSection={setSettingsSection}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </main>
        </div>

        {/* Floating iOS Bottom Navigation Dock */}
        <BottomNav activePage={activePage} onSelectPage={handleSelectPage} />

        {/* Account & Trade Modals & Drawers */}
        <AccountModal
          open={accountModalOpen}
          onClose={() => setAccountModalOpen(false)}
          accounts={accounts}
          profile={profile}
          onRefresh={handleRefreshAll}
          onSelectAccount={setActiveAccountId}
        />

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
