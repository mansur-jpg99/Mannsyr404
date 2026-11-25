/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Plus } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  clearLocalAuthSession,
  getValidSession,
  initSupabaseClient,
} from './lib/supabase.ts';
import {
  apiRequest,
  SessionExpiredError,
  setOnAuthInvalidated,
} from './lib/api.ts';
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
import { formatCurrency, resolveUserDisplayName } from './utils/formatters.ts';
import { AuthScreen } from './components/AuthScreen.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { JournalView } from './components/JournalView.tsx';
import { CalendarView } from './components/CalendarView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { AnalyticsView } from './components/AnalyticsView.tsx';
import { MansurAiView } from './components/MansurAiView.tsx';
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
  'mansur-ai',
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
  'mansur-ai': {
    title: 'MANSUR AI',
    subtitle: 'Konsultasi & tanya jawab edukasi trading, psikologi, dan manajemen risiko',
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
  const [authNotice, setAuthNotice] = useState('');

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

  const activeUserIdRef = useRef<string | null>(null);
  const currentUserId = user?.id ?? null;

  const resetWorkspaceState = useCallback((resetPage: boolean) => {
    setProfile(null);
    setAccounts([]);
    setActiveAccountId(null);
    setTrades([]);
    setReviews([]);
    setInspectingTrade(null);
    setDataError('');
    if (resetPage) {
      setActivePage('dashboard');
    }
  }, []);

  useEffect(() => {
    activeUserIdRef.current = currentUserId;
    resetWorkspaceState(!currentUserId);
  }, [currentUserId, resetWorkspaceState]);

  useEffect(() => {
    setOnAuthInvalidated((reason) => {
      activeUserIdRef.current = null;
      resetWorkspaceState(true);
      setAuthNotice(reason);
      setUser(null);
      setAuthReady(true);
    });
    return () => {
      setOnAuthInvalidated(null);
    };
  }, [resetWorkspaceState]);

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

      const { data: listenerData } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (!active) return;
          if (event === 'INITIAL_SESSION') {
            return;
          }
          if (event === 'SIGNED_OUT') {
            activeUserIdRef.current = null;
            resetWorkspaceState(true);
            setUser(null);
            setAuthReady(true);
            return;
          }

          const nextUser = session?.user ?? null;
          const nextUid = nextUser?.id ?? null;

          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            setAuthNotice('');
          }

          if (activeUserIdRef.current !== nextUid) {
            activeUserIdRef.current = nextUid;
            resetWorkspaceState(!nextUser);
          }

          setUser(nextUser);
          setAuthReady(true);

          if (event === 'PASSWORD_RECOVERY' && nextUser) {
            setActivePage('settings');
            setSettingsSection('security');
          }
        }
      );
      subscription = listenerData.subscription;

      // Pulihkan dan validasi/refresh session saat halaman direfresh sebelum memanggil API terproteksi
      const sessionResult = await getValidSession(false);
      if (!active) return;

      if (sessionResult.session?.user) {
        const restoredUser = sessionResult.session.user;
        activeUserIdRef.current = restoredUser.id;
        setAuthNotice('');
        setUser(restoredUser);
      } else if (sessionResult.invalidSession) {
        activeUserIdRef.current = null;
        resetWorkspaceState(true);
        setAuthNotice(
          'Sesi login Anda telah berakhir atau tidak valid. Silakan masuk kembali.'
        );
        setUser(null);
      } else if (sessionResult.networkError) {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        const cachedUser = data.session?.user ?? null;
        activeUserIdRef.current = cachedUser?.id ?? null;
        setUser(cachedUser);
        if (cachedUser) {
          setDataError(
            'Koneksi ke server autentikasi terganggu saat memulihkan sesi. Klik Coba Lagi.'
          );
        }
      } else {
        activeUserIdRef.current = null;
        setUser(null);
      }

      setAuthReady(true);
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [resetWorkspaceState]);

  const loadWorkspaceProfile = useCallback(async () => {
    const supabase = await initSupabaseClient();
    if (!supabase) return;
    const valid = await getValidSession(false);
    const sessionUser = valid.session?.user;
    if (!sessionUser) {
      if (valid.invalidSession) {
        activeUserIdRef.current = null;
        resetWorkspaceState(true);
        setAuthNotice(
          'Sesi login Anda telah berakhir atau tidak valid. Silakan masuk kembali.'
        );
        setUser(null);
      } else if (valid.networkError) {
        setDataError(
          'Gagal memverifikasi sesi karena gangguan koneksi. Klik Coba Lagi.'
        );
      }
      return;
    }
    const targetUid = sessionUser.id;

    setLoadingData(true);
    setDataError('');
    try {
      const data = await apiRequest<{
        profile: Profile | null;
        accounts: TradingAccount[];
      }>('/api/profile');
      if (activeUserIdRef.current !== targetUid) return;

      let nextProfile =
        data.profile && data.profile.uid === targetUid ? data.profile : null;

      if (!nextProfile || !nextProfile.fullName.trim()) {
        const { data: sbProfile } = await supabase
          .from('profiles')
          .select('id, uid, email, full_name, trader_style')
          .eq('uid', targetUid)
          .limit(1)
          .maybeSingle();

        if (activeUserIdRef.current !== targetUid) return;
        if (sbProfile) {
          nextProfile = {
            id: Number(sbProfile.id),
            uid: String(sbProfile.uid),
            email: String(sbProfile.email ?? sessionUser.email ?? ''),
            fullName: String(sbProfile.full_name ?? ''),
            traderStyle: String(sbProfile.trader_style ?? 'Inner Circle Trader'),
          };
        }
      }

      setProfile(nextProfile);
      setAccounts(data.accounts.filter((a) => a.userId === targetUid));

      setActiveAccountId((prevId) => {
        const userAccounts = data.accounts.filter((a) => a.userId === targetUid);
        if (prevId && userAccounts.some((a) => a.id === prevId)) {
          return prevId;
        }
        return userAccounts[0]?.id ?? null;
      });
    } catch (err: any) {
      if (activeUserIdRef.current !== targetUid) return;
      if (err instanceof SessionExpiredError) {
        return;
      }
      try {
        const { data: sbProfile } = await supabase
          .from('profiles')
          .select('id, uid, email, full_name, trader_style')
          .eq('uid', targetUid)
          .limit(1)
          .maybeSingle();

        if (activeUserIdRef.current === targetUid && sbProfile) {
          setProfile({
            id: Number(sbProfile.id),
            uid: String(sbProfile.uid),
            email: String(sbProfile.email ?? sessionUser.email ?? ''),
            fullName: String(sbProfile.full_name ?? ''),
            traderStyle: String(sbProfile.trader_style ?? 'Inner Circle Trader'),
          });
        }
      } catch {
        // fallback ke user_metadata di resolveUserDisplayName
      }
      setDataError(err.message || 'Gagal memuat ruang kerja akun.');
    } finally {
      if (activeUserIdRef.current === targetUid) {
        setLoadingData(false);
      }
    }
  }, [resetWorkspaceState]);

  const loadAccountData = useCallback(async (accountId: number) => {
    const supabase = await initSupabaseClient();
    if (!supabase) return;
    const valid = await getValidSession(false);
    const sessionUser = valid.session?.user;
    if (!sessionUser) return;
    const targetUid = sessionUser.id;
    setLoadingData(true);
    setDataError('');
    try {
      const [tradeRows, reviewRows] = await Promise.all([
        apiRequest<Trade[]>(`/api/trades?accountId=${accountId}`),
        apiRequest<DailyReview[]>(`/api/reviews?accountId=${accountId}`),
      ]);
      if (activeUserIdRef.current !== targetUid) return;
      setTrades(tradeRows);
      setReviews(reviewRows);
      setInspectingTrade((curr) =>
        curr ? tradeRows.find((t) => t.id === curr.id) || null : null
      );
    } catch (err: any) {
      if (activeUserIdRef.current !== targetUid) return;
      if (err instanceof SessionExpiredError) {
        return;
      }
      setDataError(err.message || 'Gagal memuat data transaksi.');
    } finally {
      if (activeUserIdRef.current === targetUid) {
        setLoadingData(false);
      }
    }
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadWorkspaceProfile();
    }
  }, [currentUserId, loadWorkspaceProfile]);

  useEffect(() => {
    if (currentUserId && activeAccountId) {
      loadAccountData(activeAccountId);
    }
  }, [currentUserId, activeAccountId, loadAccountData]);

  const scopedProfile = useMemo(
    () => (profile && user && profile.uid === user.id ? profile : null),
    [profile, user]
  );

  const scopedAccounts = useMemo(
    () => (user ? accounts.filter((a) => a.userId === user.id) : []),
    [accounts, user]
  );

  const activeAccount = useMemo(
    () =>
      scopedAccounts.find((a) => a.id === activeAccountId) ||
      scopedAccounts[0] ||
      null,
    [scopedAccounts, activeAccountId]
  );

  const resolvedDisplayName = useMemo(
    () => resolveUserDisplayName(scopedProfile, user),
    [scopedProfile, user]
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
    const forceSessionCheck = Boolean(dataError);
    setLoadingData(true);
    setDataError('');
    const sessionCheck = await getValidSession(forceSessionCheck);
    if (!sessionCheck.session?.user) {
      setLoadingData(false);
      if (sessionCheck.networkError) {
        setDataError(
          'Tidak dapat terhubung ke server autentikasi Supabase. Periksa koneksi Anda lalu klik Coba Lagi.'
        );
        return;
      }
      await clearLocalAuthSession();
      activeUserIdRef.current = null;
      resetWorkspaceState(true);
      setAuthNotice(
        'Sesi login Anda telah berakhir atau tidak valid. Silakan masuk kembali.'
      );
      setUser(null);
      return;
    }

    setUser(sessionCheck.session.user);
    await loadWorkspaceProfile();
    if (activeAccountId) {
      await loadAccountData(activeAccountId);
    }
  };

  const handleSignOut = async () => {
    setAuthNotice('');
    const supabase = await initSupabaseClient();
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
    return (
      <MotionConfig reducedMotion="user">
        <AuthScreen initialNotice={authNotice} />
      </MotionConfig>
    );
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
          accounts={scopedAccounts}
          activeAccount={activeAccount}
          onSelectAccount={setActiveAccountId}
          onOpenAccountModal={() => setAccountModalOpen(true)}
          profile={scopedProfile}
          displayName={resolvedDisplayName}
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
                      traderName={resolvedDisplayName}
                      userEmail={user.email || ''}
                      accountName={activeAccount?.name}
                      accountBroker={activeAccount?.broker}
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

                  {activePage === 'mansur-ai' && (
                    <MansurAiView displayName={resolvedDisplayName} />
                  )}

                  {activePage === 'more' && (
                    <MoreView
                      profile={scopedProfile}
                      displayName={resolvedDisplayName}
                      userEmail={user.email || ''}
                      accounts={scopedAccounts}
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
                      profile={scopedProfile}
                      displayName={resolvedDisplayName}
                      userEmail={user.email || ''}
                      userUid={user.id}
                      accounts={scopedAccounts}
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
          accounts={scopedAccounts}
          profile={scopedProfile}
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
