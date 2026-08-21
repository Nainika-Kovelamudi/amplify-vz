import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users, FileCheck, GitBranch, ClipboardList, ChevronRight,
  Activity, Rocket, LayoutDashboard, ArrowUpRight, Shield,
  BookOpen, ScrollText, RefreshCw, BarChart3,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAdminStats, getRecentActivity, type AdminStats, type ActivityEvent } from '../lib/adminService';

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-100 ${className ?? ''}`} />;
}

const ACTION_META: Record<string, { label: string; dot: string }> = {
  submission_created:     { label: 'New Submission',    dot: 'bg-sky-500' },
  submission_approved:    { label: 'Approved',           dot: 'bg-emerald-500' },
  submission_rejected:    { label: 'Rejected',           dot: 'bg-red-500' },
  submission_revised:     { label: 'Revised',            dot: 'bg-amber-500' },
  submission_deleted:     { label: 'Deleted',            dot: 'bg-gray-400' },
  role_changed:           { label: 'Role Changed',       dot: 'bg-violet-500' },
  clone_requested:        { label: 'Clone Requested',    dot: 'bg-indigo-500' },
  clone_approved:         { label: 'Clone Approved',     dot: 'bg-teal-500' },
  clone_denied:           { label: 'Clone Denied',       dot: 'bg-orange-500' },
  catalog_asset_updated:  { label: 'Asset Updated',      dot: 'bg-blue-500' },
  catalog_asset_archived: { label: 'Asset Archived',     dot: 'bg-slate-400' },
  user_login:             { label: 'User Login',         dot: 'bg-gray-300' },
  asset_published:        { label: 'Published',          dot: 'bg-emerald-600' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function InitialsAvatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm"
      style={{ background: `hsl(${hue},55%,52%)` }}
    >
      {initials}
    </div>
  );
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const isOwner = user?.role === 'Aimplify.Owner';
  const isAdmin = user?.role === 'Aimplify.Admin' || isOwner;

  const load = () => {
    setLoading(true);
    Promise.all([getAdminStats(), getRecentActivity()])
      .then(([s, a]) => { setStats(s); setActivity(a); setLoading(false); setLastRefresh(new Date()); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (!authLoading) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, location.key]);

  const statCards = [
    {
      label: 'Pending Approvals',
      value: stats?.pending_approvals ?? 0,
      icon: ClipboardList,
      color: 'text-amber-600',
      bg: 'from-amber-50 to-orange-50',
      ring: 'ring-amber-100',
      iconBg: 'bg-amber-100',
      action: () => navigate('/pipeline?tab=queue'),
      urgent: (stats?.pending_approvals ?? 0) > 0,
    },
    {
      label: 'Awaiting Publish',
      value: stats?.awaiting_publish ?? 0,
      icon: Rocket,
      color: 'text-emerald-700',
      bg: 'from-emerald-50 to-teal-50',
      ring: 'ring-emerald-100',
      iconBg: 'bg-emerald-100',
      action: isOwner ? () => navigate('/pipeline?tab=publish') : undefined,
      urgent: false,
    },
    {
      label: 'Published Assets',
      value: stats?.published_assets ?? 0,
      icon: FileCheck,
      color: 'text-teal-700',
      bg: 'from-teal-50 to-cyan-50',
      ring: 'ring-teal-100',
      iconBg: 'bg-teal-100',
      action: () => navigate('/catalog'),
      urgent: false,
    },
    {
      label: 'Pending Clones',
      value: stats?.pending_clones ?? 0,
      icon: GitBranch,
      color: 'text-indigo-600',
      bg: 'from-indigo-50 to-violet-50',
      ring: 'ring-indigo-100',
      iconBg: 'bg-indigo-100',
      action: () => navigate('/pipeline?tab=clones'),
      urgent: false,
    },
  ];

  const quickActions = [
    {
      label: 'Review Approvals',
      desc: `${stats?.pending_approvals ?? '–'} pending`,
      icon: ClipboardList,
      path: '/pipeline?tab=queue',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      show: isAdmin,
    },
    ...(isOwner && (stats?.awaiting_publish ?? 0) > 0 ? [{
      label: 'Publish Assets',
      desc: `${stats?.awaiting_publish ?? '–'} ready to go live`,
      icon: Rocket,
      path: '/pipeline?tab=publish',
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      show: true,
    }] : []),
    {
      label: 'Browse Catalog',
      desc: `${stats?.published_assets ?? '–'} published assets`,
      icon: BookOpen,
      path: '/catalog',
      color: 'text-teal-600',
      bg: 'bg-teal-50',
      show: true,
    },
    {
      label: 'Manage Users',
      desc: `${stats?.total_users ?? '–'} registered`,
      icon: Users,
      path: '/admin/users',
      color: 'text-sky-600',
      bg: 'bg-sky-50',
      show: isOwner,
    },
    {
      label: 'Executive Reports',
      desc: 'Governance, quality, and adoption KPIs',
      icon: BarChart3,
      path: '/admin/reports',
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      show: isOwner,
    },
    {
      label: 'Audit Log',
      desc: 'Full platform activity trail',
      icon: ScrollText,
      path: '/admin/audit',
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      show: isOwner,
    },
  ].filter(a => a.show);

  return (
    <div className="animate-in fade-in duration-300 min-h-screen bg-gray-50/50">
      <div className="px-4 py-8 md:px-10 max-w-screen-xl mx-auto">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <LayoutDashboard className="h-5 w-5 text-gray-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Admin Dashboard</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Overview</h1>
            <p className="mt-1 text-sm text-gray-500">
              {isOwner ? 'Platform-wide overview · All departments' : 'Showing data for your department'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isOwner && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
                <Shield className="h-3 w-3" /> Owner
              </span>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 shadow-sm hover:border-gray-300 hover:text-gray-700 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Stat Cards ──────────────────────────────────────────────────── */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                onClick={card.action}
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.bg} ring-1 ${card.ring} p-5 ${card.action ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200' : ''}`}
              >
                {card.urgent && (
                  <span className="absolute right-3 top-3 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                  </span>
                )}
                <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${card.iconBg}`}>
                  <Icon className={`h-4.5 w-4.5 ${card.color}`} style={{ width: '18px', height: '18px' }} />
                </div>
                <div className="mt-3">
                  {loading ? (
                    <Skeleton className="h-8 w-14 mb-1" />
                  ) : (
                    <p className={`text-3xl font-extrabold tracking-tight ${card.color}`}>{card.value.toLocaleString()}</p>
                  )}
                  <p className="mt-0.5 text-[11px] font-semibold text-gray-500 leading-tight">{card.label}</p>
                </div>
                {card.action && (
                  <ArrowUpRight className={`absolute bottom-3 right-3 h-3.5 w-3.5 ${card.color} opacity-0 group-hover:opacity-60 transition-opacity`} />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* ── Main Content ─────────────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* Activity Feed */}
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-gray-400" />
                  <h2 className="text-sm font-semibold text-gray-800">Recent Activity</h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-400">
                    Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isOwner && (
                    <button
                      onClick={() => navigate('/admin/audit')}
                      className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 transition-colors"
                    >
                      View all →
                    </button>
                  )}
                </div>
              </div>

              <div className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-6 py-3.5">
                      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-2/3" />
                        <Skeleton className="h-2.5 w-1/3" />
                      </div>
                      <Skeleton className="h-2.5 w-10 shrink-0" />
                    </div>
                  ))
                ) : activity.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-400">
                    <Activity className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No recent activity</p>
                  </div>
                ) : (
                  activity.map((ev, i) => {
                    const meta = ACTION_META[ev.action] ?? { label: ev.action.replace(/_/g, ' '), dot: 'bg-gray-400' };
                    const actor = ev.actor_name ?? ev.actor_email ?? 'System';
                    return (
                      <motion.div
                        key={ev.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50/60 transition-colors"
                      >
                        <InitialsAvatar name={actor} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
                            <span className="text-xs font-semibold text-gray-700">{meta.label}</span>
                            <span className="truncate text-xs text-gray-400">{actor}</span>
                          </div>
                          {ev.entity_id && (
                            <p className="mt-0.5 truncate font-mono text-[10px] text-gray-300">#{ev.entity_id.slice(0, 8)}</p>
                          )}
                        </div>
                        <span className="shrink-0 text-[10px] text-gray-400 tabular-nums">{timeAgo(ev.created_at)}</span>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-4">
                <h2 className="text-sm font-semibold text-gray-800">Quick Actions</h2>
                <p className="mt-0.5 text-[11px] text-gray-400">Navigate to key sections</p>
              </div>
              <div className="divide-y divide-gray-50">
                {quickActions.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className="flex w-full items-center gap-3 px-6 py-3.5 text-left hover:bg-gray-50 transition-colors group"
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.bg}`}>
                        <Icon className={`h-4 w-4 ${item.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-semibold ${item.color}`}>{item.label}</p>
                        <p className="text-[11px] text-gray-400 truncate">{item.desc}</p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-400 transition-colors shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Role info card */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Your Access</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Role</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    isOwner ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {isOwner ? 'Owner' : 'Admin'}
                  </span>
                </div>
                {user?.department && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Department</span>
                    <span className="text-xs font-medium text-gray-700">{user.department}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Scope</span>
                  <span className="text-xs font-medium text-gray-700">{isOwner ? 'All departments' : 'Department only'}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
