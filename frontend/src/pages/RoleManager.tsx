import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Shield, User, Search, ChevronDown, Save, AlertTriangle, Lock, Unlock } from 'lucide-react';
import { getUsers, updateUserRole, type AppUser } from '../lib/adminService';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const ROLE_OPTIONS = [
  {
    value: 'Aimplify.User' as const,
    label: 'Standard User',
    description: 'Can submit assets and view catalog',
    icon: User,
    color: '#0EA5E9',
    bg: '#E0F2FE',
  },
  {
    value: 'Aimplify.Admin' as const,
    label: 'Admin',
    description: 'Can approve / reject submissions in their department',
    icon: Shield,
    color: '#F59E0B',
    bg: '#FEF3C7',
  },
  {
    value: 'Aimplify.Owner' as const,
    label: 'Owner',
    description: 'Full access — publish, delete, manage all roles',
    icon: Crown,
    color: '#8B5CF6',
    bg: '#EDE9FE',
  },
] as const;

type RoleValue = (typeof ROLE_OPTIONS)[number]['value'];

const DEPARTMENTS = [
  'Engineering', 'Data & Analytics', 'Cloud & Infrastructure',
  'Security', 'Product', 'Operations', 'Finance', 'HR', 'Other',
];

function RoleBadge({ role }: { role: string }) {
  const opt = ROLE_OPTIONS.find((r) => r.value === role) ?? ROLE_OPTIONS[0];
  const Icon = opt.icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold"
      style={{ backgroundColor: opt.bg, color: opt.color }}>
      <Icon className="h-3 w-3" />
      {opt.label}
    </span>
  );
}

export function RoleManager() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = user?.role === 'Aimplify.Owner';

  const [users, setUsers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [drafts, setDrafts] = useState<Record<string, { role: RoleValue; department: string }>>({});

  useEffect(() => {
    if (!isOwner) { navigate('/'); return; }
    setLoading(true);
    getUsers({ limit: 200 })
      .then(({ items }) => { setUsers(items); setLoading(false); })
      .catch(() => { setError('Failed to load users.'); setLoading(false); });
  }, [isOwner, navigate]);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.email.toLowerCase().includes(q) || (u.display_name ?? '').toLowerCase().includes(q);
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const getDraft = (u: AppUser) => drafts[u.id] ?? { role: u.role as RoleValue, department: u.department ?? '' };

  const setDraft = (id: string, field: 'role' | 'department', value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...getDraft(users.find((u) => u.id === id)!), [field]: value },
    }));
  };

  const isDirty = (u: AppUser) => {
    const d = drafts[u.id];
    if (!d) return false;
    return d.role !== (u.role as RoleValue) || d.department !== (u.department ?? '');
  };

  const notify = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const handleSave = async (u: AppUser) => {
    const d = getDraft(u);
    setSaving(u.id); setError('');
    try {
      // role_locked defaults to true — lock the role so AAD won't overwrite it
      const updated = await updateUserRole(u.id, d.role, d.department || undefined, true);
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, role: updated.role, department: updated.department, role_locked: updated.role_locked } : x));
      setDrafts((prev) => { const n = { ...prev }; delete n[u.id]; return n; });
      notify(`Role locked for ${u.display_name ?? u.email}. Azure AD sync disabled.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(null);
    }
  };

  const handleUnlock = async (u: AppUser) => {
    setUnlocking(u.id); setError('');
    try {
      // Send current role + role_locked=false → re-enable AAD sync on next login
      const updated = await updateUserRole(u.id, u.role as RoleValue, u.department ?? undefined, false);
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, role_locked: updated.role_locked } : x));
      notify(`${u.display_name ?? u.email} will sync from Azure AD on next login.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unlock failed.');
    } finally {
      setUnlocking(null);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="px-4 py-8 md:px-10">
        <div className="flex items-center gap-2">
          <Crown className="h-6 w-6 text-violet-600" />
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Role Management</h1>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Assign roles directly from the app. Locked roles are pinned — Azure AD won't overwrite them on login.
        </p>
      </div>

      {/* Role legend */}
      <div className="mx-4 mb-6 grid grid-cols-1 gap-3 md:mx-10 md:grid-cols-3">
        {ROLE_OPTIONS.map(({ value, label, description, icon: Icon, color, bg }) => (
          <div key={value} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="rounded-lg p-2" style={{ backgroundColor: bg }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-800">{label}</div>
              <div className="mt-0.5 text-xs text-gray-500">{description}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 px-4 pb-4 md:px-10">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
        </div>
        <div className="relative">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm outline-none focus:border-sky-400"
          >
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
        <span className="text-xs text-gray-400">{filtered.length} users</span>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 md:mx-10">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="mx-4 mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 md:mx-10">
          {success}
        </div>
      )}

      {/* User table */}
      <div className="px-4 md:px-10">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-4 border-b border-gray-100 bg-gray-50 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            <div className="col-span-3">User</div>
            <div className="col-span-2">Current Role</div>
            <div className="col-span-2">Lock Status</div>
            <div className="col-span-2">Assign Role</div>
            <div className="col-span-2">Department</div>
            <div className="col-span-1"></div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400">Loading users…</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">No users found.</div>
          ) : (
            filtered.map((u, i) => {
              const draft = getDraft(u);
              const dirty = isDirty(u);
              const isSaving = saving === u.id;
              const isUnlocking = unlocking === u.id;
              const isSelf = u.id === user?.id;

              return (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className={`grid grid-cols-12 items-center gap-4 border-b border-gray-50 px-5 py-3.5 last:border-0 ${dirty ? 'bg-amber-50/40' : ''}`}
                >
                  {/* User info */}
                  <div className="col-span-3 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-violet-500 text-xs font-bold text-white">
                        {(u.display_name ?? u.email)[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-gray-800">
                          {u.display_name ?? '—'}
                          {isSelf && <span className="ml-1.5 text-[9px] font-bold text-violet-500 bg-violet-50 rounded-full px-1.5 py-0.5">You</span>}
                        </div>
                        <div className="truncate text-xs text-gray-400">{u.email}</div>
                      </div>
                    </div>
                  </div>

                  {/* Current role */}
                  <div className="col-span-2">
                    <RoleBadge role={u.role} />
                  </div>

                  {/* Lock status */}
                  <div className="col-span-2">
                    {u.role_locked ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700">
                          <Lock className="h-3 w-3" /> Pinned
                        </span>
                        {!isSelf && (
                          <button
                            title="Unlock — allow Azure AD to sync role on next login"
                            disabled={isUnlocking}
                            onClick={() => void handleUnlock(u)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
                          >
                            <Unlock className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-600">
                        <Unlock className="h-3 w-3" /> Azure AD
                      </span>
                    )}
                  </div>

                  {/* Role selector */}
                  <div className="col-span-2">
                    <div className="relative">
                      <select
                        value={draft.role}
                        disabled={isSelf}
                        onChange={(e) => setDraft(u.id, 'role', e.target.value)}
                        className="w-full appearance-none rounded-lg border border-gray-200 bg-white py-1.5 pl-3 pr-7 text-xs font-medium outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    </div>
                  </div>

                  {/* Department */}
                  <div className="col-span-2">
                    <div className="relative">
                      <select
                        value={draft.department}
                        disabled={isSelf}
                        onChange={(e) => setDraft(u.id, 'department', e.target.value)}
                        className="w-full appearance-none rounded-lg border border-gray-200 bg-white py-1.5 pl-3 pr-7 text-xs outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        <option value="">— Any —</option>
                        {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    </div>
                  </div>

                  {/* Save */}
                  <div className="col-span-1 flex justify-end">
                    {dirty && !isSelf && (
                      <button
                        disabled={isSaving}
                        onClick={() => void handleSave(u)}
                        className="flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-[10px] font-bold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
                      >
                        <Save className="h-3 w-3" />
                        {isSaving ? '…' : 'Save'}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Info note */}
      <div className="mx-4 mt-6 rounded-xl border border-sky-200 bg-sky-50 p-4 md:mx-10">
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
          <div className="text-xs text-sky-800">
            <span className="font-bold">Pinned</span> roles are set here and won't be overwritten when the user logs in via Azure AD.{' '}
            Click <Unlock className="inline h-3 w-3" /> to unlock a user and let their Azure AD App Role take effect on next login.{' '}
            <span className="font-bold">Azure AD</span> means the role syncs automatically from Entra ID on every login.
          </div>
        </div>
      </div>
    </div>
  );
}
