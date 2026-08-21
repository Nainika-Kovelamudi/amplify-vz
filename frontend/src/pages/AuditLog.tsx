import { useEffect, useState, useCallback } from 'react';
import { Download, Filter, Search } from 'lucide-react';
import { getAuditLogs, exportAuditLogsUrl, type AuditLog } from '../lib/adminService';
import { useAuth } from '../context/AuthContext';

const ENTITY_TYPES = ['submission', 'catalog_asset', 'clone_request', 'user'];

const ACTION_COLORS: Record<string, string> = {
  submission_created:    'bg-sky-100 text-sky-700',
  submission_approved:   'bg-emerald-100 text-emerald-700',
  submission_rejected:   'bg-red-100 text-red-700',
  submission_revised:    'bg-amber-100 text-amber-700',
  submission_deleted:    'bg-gray-100 text-gray-500',
  role_changed:          'bg-purple-100 text-purple-700',
  clone_requested:       'bg-indigo-100 text-indigo-700',
  clone_approved:        'bg-teal-100 text-teal-700',
  clone_denied:          'bg-orange-100 text-orange-700',
  catalog_asset_updated: 'bg-blue-100 text-blue-700',
  catalog_asset_archived:'bg-slate-100 text-slate-600',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function AuditLog() {
  const { isLoading: authLoading } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAuditLogs({
        actor_email: search || undefined,
        action: actionFilter || undefined,
        entity_type: entityFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        skip: (page - 1) * pageSize,
        limit: pageSize,
      });
      setLogs(res.items);
      setTotal(res.total);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [search, actionFilter, entityFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    if (!authLoading) void fetchLogs();
  }, [authLoading, fetchLogs]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="animate-in fade-in duration-300 px-4 py-8 md:px-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Audit Log</h1>
          <p className="mt-1 text-sm text-gray-500">{total.toLocaleString()} events · immutable · super-admin only</p>
        </div>
        <a
          href={exportAuditLogsUrl({
            ...(search && { actor_email: search }),
            ...(actionFilter && { action: actionFilter }),
            ...(entityFilter && { entity_type: entityFilter }),
            ...(dateFrom && { date_from: dateFrom }),
            ...(dateTo && { date_to: dateTo }),
          })}
          download
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </a>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <Filter className="h-4 w-4 shrink-0 text-gray-400" />
        <div className="relative flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Filter by actor email…"
            className="h-8 w-52 rounded-lg border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          />
        </div>
        <input
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          placeholder="Action keyword…"
          className="h-8 w-40 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-sky-300"
        />
        <select
          value={entityFilter}
          onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
          className="h-8 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-sky-300"
        >
          <option value="">All entities</option>
          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="h-8 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-sky-300"
        />
        <span className="text-xs text-gray-400">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          className="h-8 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-sky-300"
        />
        {(search || actionFilter || entityFilter || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearch(''); setActionFilter(''); setEntityFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }}
            className="text-xs text-sky-600 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Timestamp', 'Action', 'Actor', 'Entity', 'Details'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-6 py-3.5">
                        <div className="h-4 animate-pulse rounded bg-gray-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">No audit events found</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="whitespace-nowrap px-6 py-3.5 text-xs text-gray-500 font-mono">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                        {log.action.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <p className="text-sm text-gray-700">{log.actor_display_name ?? log.actor_email ?? 'System'}</p>
                      {log.actor_email && log.actor_display_name && (
                        <p className="text-xs text-gray-400">{log.actor_email}</p>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-gray-500">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">{log.entity_type}</span>
                      {log.entity_id && (
                        <span className="ml-1 text-gray-400">#{log.entity_id.slice(0, 8)}</span>
                      )}
                    </td>
                    <td className="max-w-xs truncate px-6 py-3.5 text-xs text-gray-400">
                      {log.metadata ? JSON.stringify(log.metadata) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-gray-500">{page} / {totalPages}</span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
