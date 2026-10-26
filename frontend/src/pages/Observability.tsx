import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Eye, MousePointerClick, TrendingUp, Activity,
  RefreshCw, Download, Search, ChevronRight, BarChart3,
  Clock, Layers, Star, GitBranch, Package, X, PlayCircle,
  ClipboardList, FileCheck, Rocket, ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { downloadObservabilityReport, getAdminStats, getAuditLogs, getUsers, exportAuditLogsUrl, type AdminStats, type AuditLog, type AppUser, type ExecutiveReportFormat } from '../lib/adminService';
import { getCatalog, type CatalogAsset } from '../lib/catalogService';
import { usePortalSettings } from '../context/PortalSettingsContext';
import { AssetQualityReport } from '../components/admin/AssetQualityReport';

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-100 ${className ?? ''}`} />;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function InitialsAvatar({ name, size = 8 }: { name: string; size?: number }) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div className={`flex h-${size} w-${size} shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white`}
      style={{ background: `hsl(${hue},55%,52%)` }}>
      {initials}
    </div>
  );
}

const ACTION_COLOR: Record<string, string> = {
  submission_created: 'bg-sky-500', submission_approved: 'bg-emerald-500',
  submission_rejected: 'bg-red-500', submission_revised: 'bg-amber-500',
  role_changed: 'bg-violet-500', clone_requested: 'bg-indigo-500',
  clone_approved: 'bg-teal-500', clone_denied: 'bg-orange-500',
  catalog_asset_updated: 'bg-blue-500', user_login: 'bg-gray-300',
  asset_published: 'bg-emerald-600', asset_viewed: 'bg-cyan-500',
  demo_requested: 'bg-pink-500',
};
const ACTION_LABEL: Record<string, string> = {
  submission_created: 'New Submission', submission_approved: 'Approved',
  submission_rejected: 'Rejected', submission_revised: 'Revised',
  role_changed: 'Role Changed', clone_requested: 'Clone Requested',
  clone_approved: 'Clone Approved', clone_denied: 'Clone Denied',
  catalog_asset_updated: 'Asset Updated', user_login: 'User Login',
  asset_published: 'Published', asset_viewed: 'Asset Viewed',
  demo_requested: 'Demo Requested',
};

interface UserActivity {
  email: string; name: string; login_count: number;
  last_login: string | null; actions: number;
  viewed_assets: string[];
}

interface KpiModal {
  title: string;
  rows: { label: string; value: string | number; sub?: string }[];
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h3 className="text-sm font-bold text-gray-900">{title}</h3>
            <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 transition-colors">
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-gray-100">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="w-8 text-right text-[11px] font-semibold text-gray-600">{value}</span>
    </div>
  );
}

export function Observability() {
  const { banners } = usePortalSettings();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [metricLogs, setMetricLogs] = useState<AuditLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [totalEventCount, setTotalEventCount] = useState(0);
  const [assets, setAssets] = useState<CatalogAsset[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState<KpiModal | null>(null);
  const [assetModal, setAssetModal] = useState<CatalogAsset | null>(null);
  const [reportFormat, setReportFormat] = useState<ExecutiveReportFormat>('xlsx');
  const [reportDownloading, setReportDownloading] = useState(false);
  const PAGE_SIZE = 20;

  const actionFreq: Record<string, number> = {};
  metricLogs.forEach(l => { actionFreq[l.action] = (actionFreq[l.action] || 0) + 1; });
  const topActions = Object.entries(actionFreq).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxActionCount = topActions[0]?.[1] ?? 1;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, metricLogsRes, usersRes, catalogRes, statsRes] = await Promise.all([
        getAuditLogs({ limit: 5000, actor_email: search || undefined, action: filterAction || undefined }),
        getAuditLogs({ limit: 5000 }),
        getUsers({ limit: 100 }),
        getCatalog({ limit: 500 }),
        getAdminStats(),
      ]);

      setLogs(logsRes.items);
      setTotalLogs(logsRes.total);
      setMetricLogs(metricLogsRes.items);
      setTotalEventCount(metricLogsRes.total);
      setUsers(usersRes.items);
      setAdminStats(statsRes);
      setAssets(catalogRes.items.sort((a, b) =>
        (b.view_count + b.clone_request_count + b.demo_request_count) -
        (a.view_count + a.clone_request_count + a.demo_request_count)
      ));

      // Build per-user activity
      const userMap: Record<string, UserActivity> = {};
      metricLogsRes.items.forEach(log => {
        const key = log.actor_email ?? 'unknown';
        if (!userMap[key]) userMap[key] = {
          email: key, name: log.actor_display_name ?? key,
          login_count: 0, last_login: null, actions: 0, viewed_assets: [],
        };
        userMap[key].actions++;
        if (log.action === 'user_login') userMap[key].login_count++;
        if (log.action === 'asset_viewed' && log.metadata?.asset_title) {
          const title = log.metadata.asset_title as string;
          if (!userMap[key].viewed_assets.includes(title)) userMap[key].viewed_assets.push(title);
        }
        if (!userMap[key].last_login || log.created_at > userMap[key].last_login!) {
          userMap[key].last_login = log.created_at;
        }
      });
      usersRes.items.forEach(u => {
        if (!userMap[u.email]) userMap[u.email] = {
          email: u.email, name: u.display_name ?? u.email,
          login_count: 0, last_login: u.last_login, actions: 0, viewed_assets: [],
        };
        else if (u.last_login && (!userMap[u.email].last_login || u.last_login > userMap[u.email].last_login!)) {
          userMap[u.email].last_login = u.last_login;
        }
      });
      setUserActivity(Object.values(userMap).sort((a, b) => b.actions - a.actions));
    } catch {
      // Keep previously loaded data visible if a dashboard request times out.
    } finally {
      setLoading(false);
    }
  }, [search, filterAction]);

  useEffect(() => { void load(); }, [load]);

  const filteredLogs = logs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(logs.length / PAGE_SIZE);
  const activeUserActivity = userActivity.filter(userItem => userItem.actions > 0);

  // Viewers per asset from logs
  const assetViewers: Record<string, { name: string; email: string; count: number }[]> = {};
  metricLogs.filter(l => l.action === 'asset_viewed').forEach(l => {
    const assetTitle = (l.metadata?.asset_title as string) ?? l.entity_id ?? 'Unknown';
    if (!assetViewers[assetTitle]) assetViewers[assetTitle] = [];
    const existing = assetViewers[assetTitle].find(v => v.email === l.actor_email);
    if (existing) existing.count++;
    else assetViewers[assetTitle].push({ name: l.actor_display_name ?? l.actor_email ?? '?', email: l.actor_email ?? '', count: 1 });
  });

  const totalViews = assets.reduce((s, a) => s + (a.view_count ?? 0), 0);
  const totalClones = assets.reduce((sum, asset) => sum + (asset.clone_request_count ?? 0), 0);
  const totalDemos = assets.reduce((sum, asset) => sum + (asset.demo_request_count ?? 0), 0);
  const totalSubmissions = metricLogs.filter(l => l.action === 'submission_created').length;

  const kpis = [
    {
      label: 'Total Events', value: totalEventCount, icon: <Activity className="h-5 w-5" />, color: '#6366f1',
      onClick: () => setModal({
        title: 'Event Breakdown',
        rows: Object.entries(actionFreq).sort((a,b)=>b[1]-a[1]).map(([k,v]) => ({ label: ACTION_LABEL[k] ?? k, value: v })),
      }),
    },
    {
      label: 'Active Users', value: activeUserActivity.length, icon: <Users className="h-5 w-5" />, color: '#0ea5e9',
      onClick: () => setModal({
        title: 'Active Users',
        rows: activeUserActivity.map(u => ({ label: u.name, value: u.actions, sub: u.email })),
      }),
    },
    {
      label: 'Asset Views', value: totalViews, icon: <Eye className="h-5 w-5" />, color: '#10b981',
      onClick: () => setModal({
        title: 'Asset View Counts',
        rows: assets.filter(a => a.view_count > 0).map(a => ({ label: a.title, value: a.view_count, sub: `${a.clone_request_count} clones` })),
      }),
    },
    {
      label: 'Clone Requests', value: totalClones, icon: <GitBranch className="h-5 w-5" />, color: '#f59e0b',
      onClick: () => setModal({
        title: 'Clone Requests by Asset',
        rows: assets.filter(a => a.clone_request_count > 0).map(a => ({ label: a.title, value: a.clone_request_count })),
      }),
    },
    {
      label: 'Demo Requests', value: totalDemos, icon: <MousePointerClick className="h-5 w-5" />, color: '#ec4899',
      onClick: () => setModal({
        title: 'Demo Requests by Asset',
        rows: assets.filter(a => a.demo_request_count > 0).map(a => ({ label: a.title, value: a.demo_request_count })),
      }),
    },
    {
      label: 'Submissions', value: totalSubmissions, icon: <Package className="h-5 w-5" />, color: '#8b5cf6',
      onClick: () => setModal({
        title: 'Submissions by User',
        rows: activeUserActivity.map(u => ({
          label: u.name, value: metricLogs.filter(l => l.actor_email === u.email && l.action === 'submission_created').length, sub: u.email,
        })).filter(r => r.value > 0),
      }),
    },
  ];

  const governanceKpis = [
    {
      label: 'Published Assets', value: adminStats?.published_assets ?? 0, icon: FileCheck,
      color: 'text-teal-700', bg: 'from-teal-50 to-cyan-50', ring: 'ring-teal-100', iconBg: 'bg-teal-100',
      action: () => navigate('/catalog'),
    },
    {
      label: 'Awaiting Publish', value: adminStats?.awaiting_publish ?? 0, icon: Rocket,
      color: 'text-emerald-700', bg: 'from-emerald-50 to-teal-50', ring: 'ring-emerald-100', iconBg: 'bg-emerald-100',
      action: () => navigate('/pipeline?tab=publish'),
    },
    {
      label: 'Pending Approvals', value: adminStats?.pending_approvals ?? 0, icon: ClipboardList,
      color: 'text-amber-600', bg: 'from-amber-50 to-orange-50', ring: 'ring-amber-100', iconBg: 'bg-amber-100',
      action: () => navigate('/pipeline?tab=queue'),
    },
    {
      label: 'Pending Clones', value: adminStats?.pending_clones ?? 0, icon: GitBranch,
      color: 'text-indigo-600', bg: 'from-indigo-50 to-violet-50', ring: 'ring-indigo-100', iconBg: 'bg-indigo-100',
      action: () => navigate('/pipeline?tab=clones'),
    },
    {
      label: 'Pending Demos', value: adminStats?.pending_demos ?? 0, icon: PlayCircle,
      color: 'text-pink-600', bg: 'from-pink-50 to-rose-50', ring: 'ring-pink-100', iconBg: 'bg-pink-100',
      action: () => navigate('/pipeline?tab=demo-requests'),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 md:px-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-500" /> {banners.observability.title}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">{banners.observability.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <AssetQualityReport />
            <select
              value={reportFormat}
              onChange={(event) => setReportFormat(event.target.value as ExecutiveReportFormat)}
              aria-label="Report format"
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 outline-none focus:border-indigo-400"
            >
              <option value="xlsx">Excel</option>
              <option value="docx">Word</option>
              <option value="pdf">PDF</option>
            </select>
            <button
              disabled={reportDownloading}
              onClick={async () => {
                setReportDownloading(true);
                try {
                  await downloadObservabilityReport(reportFormat);
                } catch (error) {
                  console.error('[Observability] Report download failed:', error);
                  window.alert(`Unable to generate the ${reportFormat.toUpperCase()} report. Please verify the latest backend package is deployed and try again.`);
                } finally {
                  setReportDownloading(false);
                }
              }}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-3.5 w-3.5" /> {reportDownloading ? 'Generating...' : 'Download'}
            </button>
            <button onClick={() => void load()} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6 md:px-10 space-y-6">

        {/* Governance workflow — consolidated from the Admin Dashboard */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slate-800">Asset Governance</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {governanceKpis.map((card, index) => {
              const Icon = card.icon;
              return (
                <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }} onClick={card.action}
                  className="group relative min-h-[116px] cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{card.label}</p>
                    <div className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}>
                      <Icon className={`h-4 w-4 ${card.color}`} />
                    </div>
                  </div>
                  <div className="mt-2">
                    {loading ? <Skeleton className="mb-1 h-7 w-12" /> : <p className={`text-2xl font-extrabold tracking-tight ${card.color}`}>{card.value.toLocaleString()}</p>}
                  </div>
                  <ArrowUpRight className={`absolute bottom-3 right-3 h-3.5 w-3.5 ${card.color} opacity-0 transition-opacity group-hover:opacity-60`} />
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* KPI Row — all clickable */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slate-800">Platform Activity</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {kpis.map((k, i) => (
              <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                onClick={k.onClick}
                className="group min-h-[116px] cursor-pointer rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{k.label}</p>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${k.color}18`, color: k.color }}>
                    {k.icon}
                  </div>
                </div>
                <div className="mt-2">
                  {loading ? <Skeleton className="mb-1 h-7 w-12" /> : <div className="text-2xl font-extrabold tracking-tight text-slate-900">{k.value}</div>}
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Top Event Types */}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-500" /> Top Event Types
            </h2>
            {loading ? <div className="space-y-3">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-5 w-full"/>)}</div>
            : topActions.length === 0 ? <p className="text-xs text-gray-400">No events yet.</p>
            : <div className="space-y-3">
                {topActions.map(([action, count]) => (
                  <div key={action}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`inline-block h-2 w-2 rounded-full ${ACTION_COLOR[action] ?? 'bg-gray-400'}`} />
                      <span className="text-xs text-gray-700">{ACTION_LABEL[action] ?? action}</span>
                    </div>
                    <MiniBar value={count} max={maxActionCount} color="#6366f1" />
                  </div>
                ))}
              </div>}
          </div>

          {/* Most Engaged Assets */}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" /> Most Engaged Assets
            </h2>
            {loading ? <div className="space-y-3">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
            : assets.filter(a => a.view_count > 0 || a.clone_request_count > 0 || a.demo_request_count > 0).length === 0
              ? <p className="text-xs text-gray-400">No engagement data yet. Views will appear after users visit asset pages.</p>
            : <div className="space-y-1">
                {assets.filter(a => a.view_count > 0 || a.clone_request_count > 0 || a.demo_request_count > 0).slice(0, 7).map((a, i) => (
                  <div key={a.id} onClick={() => setAssetModal(a)}
                    className="flex items-center gap-2 rounded-lg p-2 hover:bg-gray-50 cursor-pointer transition-colors">
                    <span className="text-[10px] font-bold text-gray-300 w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{a.title}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Eye className="h-3 w-3" /> {a.view_count}</span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><GitBranch className="h-3 w-3" /> {a.clone_request_count}</span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><MousePointerClick className="h-3 w-3" /> {a.demo_request_count}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                  </div>
                ))}
              </div>}
          </div>

          {/* Most Active Users */}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-sky-500" /> Most Active Users
            </h2>
            {loading ? <div className="space-y-3">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
            : activeUserActivity.length === 0 ? <p className="text-xs text-gray-400">No activity found.</p>
            : <div className="space-y-1">
                {activeUserActivity.slice(0, 7).map(u => (
                  <div key={u.email} className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setModal({
                      title: `Activity — ${u.name}`,
                      rows: [
                        { label: 'Total Events', value: u.actions },
                        { label: 'Logins', value: u.login_count },
                        { label: 'Last Active', value: u.last_login ? timeAgo(u.last_login) : '—' },
                        { label: 'Assets Viewed', value: u.viewed_assets.length, sub: u.viewed_assets.slice(0,5).join(', ') || 'None' },
                      ],
                    })}>
                    <InitialsAvatar name={u.name} size={7} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{u.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-indigo-600">{u.actions}</p>
                      <p className="text-[10px] text-gray-400">events</p>
                    </div>
                  </div>
                ))}
              </div>}
          </div>
        </div>

        {/* Event Stream */}
        <div className="rounded-xl bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-500" /> Live Event Stream
              <span className="ml-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">{totalLogs} total</span>
            </h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
                  placeholder="Filter by user…"
                  className="rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 w-44" />
              </div>
              <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0); }}
                className="rounded-lg border border-gray-200 bg-gray-50 py-1.5 px-2 text-xs outline-none focus:border-indigo-300 w-40">
                <option value="">All events</option>
                {Object.entries(ACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          {loading ? <div className="p-5 space-y-3">{Array.from({length:8}).map((_,i)=><Skeleton key={i} className="h-10 w-full"/>)}</div>
          : filteredLogs.length === 0 ? <p className="px-5 py-8 text-center text-sm text-gray-400">No events match your filters.</p>
          : <>
              <div className="divide-y divide-gray-50">
                {filteredLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50/60 transition-colors">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ACTION_COLOR[log.action] ?? 'bg-gray-300'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-gray-800">{log.actor_display_name ?? log.actor_email ?? 'System'}</span>
                        <span className="text-[10px] text-gray-400">{log.actor_email}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                          {ACTION_LABEL[log.action] ?? log.action}
                        </span>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <span className="text-[10px] text-gray-400 truncate max-w-xs">
                            {Object.entries(log.metadata).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" /> {timeAgo(log.created_at)}
                    </span>
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
                  <span className="text-xs text-gray-400">Page {page + 1} of {totalPages}</span>
                  <div className="flex gap-1">
                    <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                      className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 disabled:opacity-40 hover:bg-gray-50">Prev</button>
                    <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                      className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 disabled:opacity-40 hover:bg-gray-50">Next</button>
                  </div>
                </div>
              )}
            </>}
        </div>

        {/* User Traceability Table */}
        <div className="rounded-xl bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Layers className="h-4 w-4 text-sky-500" /> User Traceability Table
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-5 py-3 text-left font-semibold text-gray-500">User</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500">Email</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-500">Total Events</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-500">Logins</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-500">Assets Viewed</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? Array.from({length:5}).map((_,i)=>(
                  <tr key={i}><td colSpan={6} className="px-5 py-3"><Skeleton className="h-5 w-full"/></td></tr>
                )) : userActivity.map(u => (
                  <tr key={u.email} className="hover:bg-gray-50/60 cursor-pointer transition-colors"
                    onClick={() => setModal({
                      title: `Activity — ${u.name}`,
                      rows: [
                        { label: 'Total Events', value: u.actions },
                        { label: 'Logins', value: u.login_count },
                        { label: 'Last Active', value: u.last_login ? timeAgo(u.last_login) : '—' },
                        { label: 'Assets Viewed', value: u.viewed_assets.length, sub: u.viewed_assets.join(', ') || 'None' },
                      ],
                    })}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <InitialsAvatar name={u.name} size={7} />
                        <span className="font-medium text-gray-800">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-bold text-indigo-600">{u.actions}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{u.login_count}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{u.viewed_assets.length}</td>
                    <td className="px-4 py-3 text-gray-400">{u.last_login ? timeAgo(u.last_login) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* KPI Detail Modal */}
      {modal && (
        <Modal title={modal.title} onClose={() => setModal(null)}>
          {modal.rows.length === 0
            ? <p className="text-sm text-gray-400 text-center py-4">No data available.</p>
            : <div className="space-y-2">
                {modal.rows.map((r, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 rounded-lg bg-gray-50 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{r.label}</p>
                      {r.sub && <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{r.sub}</p>}
                    </div>
                    <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-600">{r.value}</span>
                  </div>
                ))}
              </div>}
        </Modal>
      )}

      {/* Asset Detail Modal */}
      {assetModal && (
        <Modal title={assetModal.title} onClose={() => setAssetModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Views', value: assetModal.view_count, color: '#10b981', icon: <Eye className="h-4 w-4"/> },
                { label: 'Clones', value: assetModal.clone_request_count, color: '#f59e0b', icon: <GitBranch className="h-4 w-4"/> },
                { label: 'Demo Req.', value: assetModal.demo_request_count, color: '#ec4899', icon: <MousePointerClick className="h-4 w-4"/> },
              ].map(s => (
                <div key={s.label} className="flex flex-col items-center rounded-xl p-3" style={{ backgroundColor: `${s.color}12` }}>
                  <div style={{ color: s.color }}>{s.icon}</div>
                  <span className="text-xl font-bold mt-1" style={{ color: s.color }}>{s.value}</span>
                  <span className="text-[10px] text-gray-500 mt-0.5">{s.label}</span>
                </div>
              ))}
            </div>

            <div>
              <h4 className="text-xs font-bold text-gray-700 mb-2">Who Viewed This Asset</h4>
              {(assetViewers[assetModal.title] ?? []).length === 0
                ? <p className="text-xs text-gray-400">No view logs yet — views are tracked when users open the asset page.</p>
                : <div className="space-y-1.5">
                    {assetViewers[assetModal.title].sort((a,b)=>b.count-a.count).map(v => (
                      <div key={v.email} className="flex items-center gap-2.5 rounded-lg bg-gray-50 px-3 py-2">
                        <InitialsAvatar name={v.name} size={7} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{v.name}</p>
                          <p className="text-[10px] text-gray-400">{v.email}</p>
                        </div>
                        <span className="text-xs font-bold text-cyan-600">{v.count}×</span>
                      </div>
                    ))}
                  </div>}
            </div>

            <button onClick={() => { setAssetModal(null); navigate(`/catalog/${assetModal.slug}`); }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">
              View Asset <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
