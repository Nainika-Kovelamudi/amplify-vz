import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, ListChecks, PlusCircle, Search, X, LogOut, ChevronDown, Settings, ShieldCheck, HelpCircle, Mail, MessageCircle, BookOpen, ExternalLink, ArrowRight, Sparkles, Loader2, Bell, BarChart3, Lightbulb, Menu } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';
import { loadSubmissions } from '../../lib/pipeline';
import { getAdminStats } from '../../lib/adminService';
import { getCatalog, type CatalogAsset } from '../../lib/catalogService';
import { useFamilies } from '../../context/FamiliesContext';
import { CopyrightFooter } from './CopyrightFooter';
import { getNotifications, markNotificationsRead, type Notification } from '../../lib/notificationService';

export function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: loading, isAuthenticated, logout: signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const profileRef   = useRef<HTMLDivElement>(null);
  const searchRef    = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Notifications ──────────────────────────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  // ── Spotlight search state ──────────────────────────────────────────────
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [searchResults, setSearchResults] = useState<CatalogAsset[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeIdx,     setActiveIdx]     = useState(-1);
  const { families } = useFamilies();

  const isAdmin = user?.role === 'Aimplify.Admin' || user?.role === 'Aimplify.Owner';
  const isSuperAdmin = user?.role === 'Aimplify.Owner';

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [loading, isAuthenticated, navigate]);

  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;

    async function hydratePendingCount() {
      const submissions = await loadSubmissions();
      if (!cancelled) {
        setPendingCount(submissions.filter((submission) => submission.status !== 'Published').length);
      }
    }

    void hydratePendingCount();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    getAdminStats()
      .then((s) => { if (!cancelled) setPendingApprovals(s.pending_approvals); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAdmin, location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Fetch notifications on mount + poll every 60s ─────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    const load = () =>
      getNotifications({ limit: 30 })
        .then((r) => { setNotifications(r.items); setUnreadCount(r.unread_count); })
        .catch(() => {});
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // WebSocket disabled — App Service plan does not support WebSockets.
  // Notifications are delivered via the 60s poll above.

  // ── Close notif panel on outside click ────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNotifOpen = async () => {
    setNotifOpen((v) => !v);
  };

  const handleMarkAllRead = async () => {
    await markNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    setSearchLoading(true);
    setSearchOpen(true);
    setActiveIdx(-1);
    const timer = setTimeout(async () => {
      try {
        const { items } = await getCatalog({ search: searchQuery.trim(), limit: 8 });
        setSearchResults(items);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);


  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!searchOpen || searchResults.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, searchResults.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    if (e.key === 'Enter' && activeIdx >= 0) {
      const hit = searchResults[activeIdx];
      navigate(`/catalog/${hit.slug}`);
      setSearchQuery(''); setSearchOpen(false);
    }
    if (e.key === 'Escape') { setSearchOpen(false); searchInputRef.current?.blur(); }
  }, [searchOpen, searchResults, activeIdx, navigate]);

  const commitSearch = (asset: CatalogAsset) => {
    navigate(`/catalog/${asset.slug}`);
    setSearchQuery(''); setSearchOpen(false);
  };

  const navItems = [
    { id: '/', label: 'Home', icon: Home },
    { id: '/catalog', label: 'Catalog', icon: LayoutGrid },
    { id: '/pipeline', label: 'Pipeline', icon: ListChecks },
    { id: '/submit', label: 'Submit', icon: PlusCircle },
    { id: '/why', label: 'Why AImplify', icon: Lightbulb },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFBFC]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FAFBFC] font-sans text-slate-900">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-md">
        <div className="flex h-16 shrink-0 items-center justify-between px-4 md:px-8 lg:px-10">
        <div className="flex items-center gap-6">
          {/* Co-brand: InfoVision + AIMPLIFY as a single lockup */}
          <div className="flex items-center gap-2 md:gap-3">
            <img
              src="/infovision_logo.png"
              alt="InfoVision"
              className="h-12 md:h-20 w-auto max-w-[140px] md:max-w-[220px] object-contain -mt-2 md:-mt-3"
            />
            <div className="h-6 w-px bg-gray-200" />
            <img
              src="/aimplify-header-logo.png"
              alt="AIMPLIFY"
              className="h-12 md:h-20 w-auto object-contain"
            />
          </div>

          <div className="hidden h-6 w-px bg-gray-200 md:block" />

          <div className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const isActive = location.pathname === item.id || (item.id !== '/' && location.pathname.startsWith(item.id));
              const Icon = item.icon;
              
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-all duration-200',
                    isActive 
                      ? 'bg-sky-50 text-sky-600 shadow-sm' 
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {item.id === '/pipeline' && pendingCount > 0 && (
                    <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[9px] font-bold text-white">
                      {pendingCount}
                    </span>
                  )}
                  {item.id === '/admin' && pendingApprovals > 0 && (
                    <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                      {pendingApprovals > 9 ? '9+' : pendingApprovals}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {/* Help button */}
          <button
            onClick={() => setShowHelp(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-sky-50 hover:text-sky-600 transition-colors"
            title="Help & Contact"
          >
            <HelpCircle className="h-5 w-5" />
          </button>

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-sky-50 hover:text-sky-600 transition-colors md:hidden"
            title="Menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>


          {/* ── Spotlight Search ─────────────────────────────────── */}
          <div className="relative hidden md:flex" ref={searchRef}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (searchQuery.trim()) setSearchOpen(true); }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search assets…"
              className="h-9 w-52 rounded-full border border-gray-200 bg-gray-50 py-1.5 pl-9 pr-16 text-sm outline-none transition-all focus:w-72 focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100"
            />
            {searchQuery && (
              <X className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 cursor-pointer text-gray-400 hover:text-gray-600"
                onClick={() => { setSearchQuery(''); setSearchOpen(false); }} />
            )}

            {/* Dropdown */}
            <AnimatePresence>
              {searchOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-11 z-50 w-[420px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
                >
                  {searchLoading ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin" />Searching…
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="py-10 text-center">
                      <Sparkles className="mx-auto mb-2 h-7 w-7 text-gray-200" />
                      <p className="text-sm font-medium text-gray-400">No assets matched</p>
                      <p className="mt-0.5 text-xs text-gray-300">Try a different keyword</p>
                    </div>
                  ) : (
                    <>
                      <div className="border-b border-gray-100 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                        Assets — {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                      </div>
                      <ul className="max-h-80 overflow-y-auto py-1">
                        {searchResults.map((asset, i) => {
                          const fm = families[asset.family];
                          return (
                            <li key={asset.id}>
                              <button
                                onMouseEnter={() => setActiveIdx(i)}
                                onClick={() => commitSearch(asset)}
                                className={cn(
                                  'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                                  activeIdx === i ? 'bg-sky-50' : 'hover:bg-gray-50'
                                )}
                              >
                                {/* Family colour dot */}
                                <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                                  style={{ backgroundColor: fm?.color ?? '#94a3b8' }} />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-gray-800">{asset.title}</p>
                                  <p className="mt-0.5 truncate text-xs text-gray-400">
                                    <span style={{ color: fm?.color }}>{fm?.name ?? asset.family}</span>
                                    <span className="mx-1.5 text-gray-200">·</span>
                                    {asset.catalog_code}
                                    {asset.maturity && (
                                      <><span className="mx-1.5 text-gray-200">·</span>{asset.maturity}</>
                                    )}
                                  </p>
                                </div>
                                <ArrowRight className={cn('h-3.5 w-3.5 shrink-0 text-gray-300 transition-colors', activeIdx === i && 'text-sky-400')} />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5">
                        <p className="text-[11px] text-gray-400">↑↓ navigate · Enter select · Esc close</p>
                        <button
                          onClick={() => { navigate(`/catalog?q=${encodeURIComponent(searchQuery)}`); setSearchOpen(false); }}
                          className="flex items-center gap-1 text-[11px] font-semibold text-sky-500 hover:text-sky-600"
                        >
                          View all in Catalog <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* ── Notification Bell ──────────────────────────────────── */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={handleNotifOpen}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-sky-50 hover:text-sky-600 transition-colors"
              title="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-1 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl border border-gray-100 bg-white shadow-2xl ring-1 ring-black/5 z-50 flex flex-col max-h-[420px]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-800">Notifications</span>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-xs text-sky-500 hover:text-sky-600 font-medium">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto flex-1">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center">
                      <Bell className="mx-auto mb-2 h-7 w-7 text-gray-200" />
                      <p className="text-sm text-gray-400">No notifications yet</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-50">
                      {notifications.map((n) => (
                        <li key={n.id} className={cn('px-4 py-3 transition-colors', !n.read && 'bg-sky-50/60')}>
                          <div className="flex items-start gap-2">
                            {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" />}
                            {n.read && <span className="mt-1.5 h-2 w-2 shrink-0" />}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-gray-800 leading-snug">{n.title}</p>
                              <p className="mt-0.5 text-xs text-gray-500 leading-snug">{n.body}</p>
                              <p className="mt-1 text-[10px] text-gray-400">
                                {new Date(n.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 rounded-md hover:bg-gray-100 p-1.5 transition-colors"
            >
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/80 text-xs font-bold text-white shadow-sm ring-2 ring-white">
                {(user.display_name ?? user.email).slice(0, 2).toUpperCase()}
                {isAdmin && (
                  <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 ring-1 ring-white">
                    <ShieldCheck className="h-2 w-2 text-white" />
                  </span>
                )}
              </div>
              <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", isProfileOpen && "rotate-180")} />
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-gray-100 bg-white p-2 shadow-lg ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 z-50">
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold text-slate-900">{user.display_name ?? user.email}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
                <div className="my-1 h-px bg-gray-100" />
                {isAdmin && (
                  <>
                    <div className="my-1 h-px bg-gray-100" />
                    <button
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 transition-colors"
                      onClick={() => { setIsProfileOpen(false); navigate('/admin'); }}
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Admin Dashboard
                      {pendingApprovals > 0 && (
                        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                          {pendingApprovals > 9 ? '9+' : pendingApprovals}
                        </span>
                      )}
                    </button>
                    {isSuperAdmin && (
                      <>
                        <button
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          onClick={() => { setIsProfileOpen(false); navigate('/admin/users'); }}
                        >
                          <Settings className="h-4 w-4" />
                          Manage Users
                        </button>
                        <button
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          onClick={() => { setIsProfileOpen(false); navigate('/admin/audit'); }}
                        >
                          <ListChecks className="h-4 w-4" />
                          Audit Log
                        </button>
                        <button
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          onClick={() => { setIsProfileOpen(false); navigate('/admin/reports'); }}
                        >
                          <BarChart3 className="h-4 w-4" />
                          Executive Reports
                        </button>
                        <button
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          onClick={() => { setIsProfileOpen(false); navigate('/admin/observability'); }}
                        >
                          <BarChart3 className="h-4 w-4" />
                          Observability
                        </button>
                      </>
                    )}
                  </>
                )}
                <div className="my-1 h-px bg-gray-100" />
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    void signOut().then(() => navigate('/login'));
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
        </div>

        {/* ── Mobile drawer ──────────────────────────────────────────── */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-gray-100 bg-white md:hidden"
            >
              {/* Search */}
              <div className="px-4 pt-3 pb-1">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => { if (searchQuery.trim()) setSearchOpen(true); }}
                    placeholder="Search assets…"
                    className="h-9 w-full rounded-full border border-gray-200 bg-gray-50 py-1.5 pl-9 pr-4 text-sm outline-none focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100"
                  />
                  {searchQuery && (
                    <X className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 cursor-pointer text-gray-400"
                      onClick={() => { setSearchQuery(''); setSearchOpen(false); }} />
                  )}
                </div>
              </div>

              {/* Nav items */}
              <ul className="px-3 pb-3 pt-1 flex flex-col gap-0.5">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.id || (item.id !== '/' && location.pathname.startsWith(item.id));
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => navigate(item.id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                          isActive ? 'bg-sky-50 text-sky-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.label}
                        {item.id === '/pipeline' && pendingCount > 0 && (
                          <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[9px] font-bold text-white">
                            {pendingCount}
                          </span>
                        )}
                        {item.id === '/admin' && pendingApprovals > 0 && (
                          <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                            {pendingApprovals > 9 ? '9+' : pendingApprovals}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
                {isAdmin && (
                  <li>
                    <button
                      onClick={() => navigate('/admin')}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        location.pathname.startsWith('/admin') ? 'bg-amber-50 text-amber-700' : 'text-amber-700 hover:bg-amber-50'
                      )}
                    >
                      <ShieldCheck className="h-4 w-4 shrink-0" />
                      Admin Dashboard
                      {pendingApprovals > 0 && (
                        <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                          {pendingApprovals > 9 ? '9+' : pendingApprovals}
                        </span>
                      )}
                    </button>
                  </li>
                )}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main Content */}
      <main
        className={
          location.pathname.endsWith('/demo')
            ? 'w-full flex-1'
            : 'mx-auto w-full max-w-7xl flex-1'
        }
      >
        <Outlet />
      </main>

      <CopyrightFooter />

      {/* Help & Contact Us Modal */}
      <AnimatePresence>
        {showHelp && (
          <>
            <motion.div
              key="help-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowHelp(false)}
            />
            <motion.div
              key="help-modal"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50">
                      <HelpCircle className="h-5 w-5 text-sky-600" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">Help & Support</h2>
                      <p className="text-xs text-slate-500">AImplify Outcome.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowHelp(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                  {/* Quick Links */}
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Quick Navigation</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Asset Catalog', icon: BookOpen, path: '/catalog', desc: 'Browse published assets' },
                        { label: 'Submit Asset', icon: ExternalLink, path: '/submit', desc: 'Contribute a new asset' },
                        { label: 'My Pipeline', icon: MessageCircle, path: '/pipeline', desc: 'Track your submissions' },
                        { label: 'Home Dashboard', icon: ExternalLink, path: '/', desc: 'Platform overview' },
                      ].map(({ label, icon: Icon, path, desc }) => (
                        <button
                          key={path}
                          onClick={() => { setShowHelp(false); navigate(path); }}
                          className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-left hover:bg-sky-50 hover:border-sky-100 transition-colors"
                        >
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
                          <div>
                            <p className="text-sm font-medium text-slate-800">{label}</p>
                            <p className="text-xs text-slate-500">{desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Contact Us */}
                  <div className="rounded-xl border border-sky-100 bg-sky-50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Mail className="h-4 w-4 text-sky-600" />
                      <p className="text-sm font-semibold text-slate-800">Contact Us</p>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">
                      Have questions, feedback, or need assistance? Reach out to the AImplify Outcome. team at InfoVision.
                    </p>
                    <a
                      href="mailto:IV.AIMPLIFY@infovision.com"
                      className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 transition-colors"
                    >
                      <Mail className="h-4 w-4" />
                      IV.AIMPLIFY@infovision.com
                    </a>
                  </div>

                  {/* About */}
                  <p className="text-xs text-slate-400 text-center">
                    AImplify Outcome. — Accelerate AI. Amplify Impact. &nbsp;·&nbsp; Built by InfoVision CIC Team
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
