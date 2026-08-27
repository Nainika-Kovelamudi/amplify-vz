import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, UserCog, Check, X, Lock, Unlock, Trash2, Download, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUsers, updateUserRole, deleteUser, type AppUser } from '../lib/adminService';

const DEPARTMENTS = [
  'Engineering', 'Data & Analytics', 'Cloud & Infrastructure',
  'Security', 'Product', 'Operations', 'Finance', 'HR', 'Other',
];

const ROLES: { value: AppUser['role']; label: string }[] = [
  { value: 'Aimplify.User',  label: 'Standard User' },
  { value: 'Aimplify.Admin', label: 'Admin' },
  { value: 'Aimplify.Owner',  label: 'Owner' },
];

const ROLE_COLORS: Record<string, string> = {
  'Aimplify.User':  'bg-sky-100 text-sky-700',
  'Aimplify.Admin': 'bg-amber-100 text-amber-700',
  'Aimplify.Owner':  'bg-violet-100 text-violet-700',
};

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

interface EditState {
  userId: string;
  role: AppUser['role'];
  department: string | null;
}

export function AdminUsers() {
  const { user: me, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AppUser | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [downloading, setDownloading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUsers({ search: search || undefined, role: roleFilter || undefined, department: deptFilter || undefined, limit: 50 });
      setUsers(res.items);
      setTotal(res.total);
    } catch {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, deptFilter]);

  useEffect(() => {
    if (!authLoading) void fetchUsers();
  }, [authLoading, fetchUsers]);

  const notify = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const handleDownload = async () => {
    setDownloading(true); setError('');
    try {
      const filters = {
        search: search || undefined,
        role: roleFilter || undefined,
        department: deptFilter || undefined,
      };
      const first = await getUsers({ ...filters, limit: 200 });
      const rows = [...first.items];
      for (let skip = rows.length; skip < first.total; skip += 200) {
        const page = await getUsers({ ...filters, skip, limit: 200 });
        rows.push(...page.items);
      }

      const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const roleLabel = (role: string) => ROLES.find(item => item.value === role)?.label ?? role;
      const csvRows = rows.map(u => [
        u.id,
        u.display_name,
        u.email,
        roleLabel(u.role),
        u.department,
        u.role_locked ? 'Pinned' : 'Azure AD',
        u.last_login,
        u.created_at,
      ]);
      const csv = [
        ['User ID', 'Name', 'Email', 'Role', 'Department', 'Role Source', 'Last Login', 'Created At'],
        ...csvRows,
      ].map(row => row.map(cell).join(',')).join('\r\n');
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `aimplify-users-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      notify(`${rows.length} users exported successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download users.');
    } finally {
      setDownloading(false);
    }
  };

  const handleSave = async () => {
    if (!editState) return;
    setSaving(true); setError('');
    try {
      const updated = await updateUserRole(editState.userId, editState.role, editState.department ?? undefined, true);
      setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u));
      setEditState(null);
      notify(`Role pinned — Azure AD sync disabled for this user.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(confirmDelete.id); setDeleteError('');
    try {
      await deleteUser(confirmDelete.id);
      setUsers((prev) => prev.filter((u) => u.id !== confirmDelete.id));
      setTotal((t) => t - 1);
      setConfirmDelete(null);
      setDeleteError('');
      notify(`User ${confirmDelete.display_name ?? confirmDelete.email} has been deleted.`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? (err instanceof Error ? err.message : 'Failed to delete user.');
      setDeleteError(msg);
    } finally {
      setDeleting(null);
    }
  };

  const handleUnlock = async (u: AppUser) => {
    setUnlocking(u.id); setError('');
    try {
      const updated = await updateUserRole(u.id, u.role as AppUser['role'], u.department ?? undefined, false);
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, role_locked: updated.role_locked } : x));
      notify(`${u.display_name ?? u.email} will sync from Azure AD on next login.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unlock failed.');
    } finally {
      setUnlocking(null);
    }
  };

  return (
    <div className="animate-in fade-in duration-300 px-4 py-8 md:px-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-500">{total} users · owner access only</p>
        </div>
        <button
          onClick={() => void handleDownload()}
          disabled={downloading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {downloading ? 'Generating...' : 'Download'}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="h-9 w-64 rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-sky-300"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-sky-300"
        >
          <option value="">All departments</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
      )}

      {/* Fixed success toast */}
      {success && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-semibold text-white shadow-xl animate-in slide-in-from-bottom-4 duration-300">
          <Check className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {['User', 'Role', 'Lock', 'Department', 'Last Login', 'Actions'].map((h) => (
                <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-6 py-4">
                      <div className="h-4 animate-pulse rounded bg-gray-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-400">No users found</td>
              </tr>
            ) : (
              users.map((u) => {
                const isEditing = editState?.userId === u.id;
                const isMe = u.id === me?.id;
                const isUnlocking = unlocking === u.id;
                const roleLabel = ROLES.find(r => r.value === u.role)?.label ?? u.role;
                return (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={isEditing ? 'bg-sky-50' : 'hover:bg-gray-50 transition-colors'}
                  >
                    {/* User */}
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
                          {(u.display_name ?? u.email).slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{u.display_name ?? '—'}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                        {isMe && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">you</span>}
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-6 py-3.5">
                      {isEditing ? (
                        <select
                          value={editState.role}
                          onChange={(e) => setEditState((s) => s ? { ...s, role: e.target.value as AppUser['role'] } : s)}
                          className="h-8 rounded-lg border border-sky-300 bg-white px-2 text-sm outline-none"
                        >
                          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      ) : (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                          {roleLabel}
                        </span>
                      )}
                    </td>

                    {/* Lock status */}
                    <td className="px-6 py-3.5">
                      {u.role_locked ? (
                        <div className="flex items-center gap-1">
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                            <Lock className="h-3 w-3" /> Pinned
                          </span>
                          {!isMe && (
                            <button
                              title="Unlock — re-enable Azure AD sync"
                              disabled={isUnlocking}
                              onClick={() => void handleUnlock(u)}
                              className="ml-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
                            >
                              <Unlock className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-600">
                          <Unlock className="h-3 w-3" /> Azure AD
                        </span>
                      )}
                    </td>

                    {/* Department */}
                    <td className="px-6 py-3.5">
                      {isEditing ? (
                        <select
                          value={editState.department ?? ''}
                          onChange={(e) => setEditState((s) => s ? { ...s, department: e.target.value || null } : s)}
                          className="h-8 rounded-lg border border-sky-300 bg-white px-2 text-sm outline-none"
                        >
                          <option value="">None</option>
                          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      ) : (
                        <span className="text-sm text-gray-600">{u.department ?? '—'}</span>
                      )}
                    </td>

                    {/* Last login */}
                    <td className="px-6 py-3.5 text-sm text-gray-500">{timeAgo(u.last_login)}</td>

                    {/* Actions */}
                    <td className="px-6 py-3.5">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEditState(null)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            disabled={isMe}
                            onClick={() => !isMe && setEditState({ userId: u.id, role: u.role, department: u.department })}
                            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-sky-600 hover:bg-sky-50 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <UserCog className="h-3.5 w-3.5" />
                            Edit Role
                          </button>
                          <button
                            disabled={isMe}
                            onClick={() => !isMe && setConfirmDelete(u)}
                            title="Delete user"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
              <Trash2 className="h-5 w-5 text-rose-600" />
            </div>
            <h2 className="mb-1 text-base font-bold text-gray-900">Delete user?</h2>
            <p className="mb-1 text-sm text-gray-600">
              <span className="font-semibold">{confirmDelete.display_name ?? confirmDelete.email}</span>
            </p>
            <p className="mb-6 text-xs text-gray-400">{confirmDelete.email}</p>
            <p className="mb-4 text-sm text-gray-500">
              This will permanently remove the user and their access. This action cannot be undone.
            </p>
            {deleteError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {deleteError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmDelete(null); setDeleteError(''); }}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDelete()}
                disabled={!!deleting}
                className="flex-1 rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
