import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';

interface Feedback { id: string; name: string | null; email: string; comment: string; created_at: string; asset_id?: string | null; asset_title?: string | null }

export function PlatformFeedbackList() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setFailed(false);
    apiClient.get<Feedback[]>('/platform-feedback').then(({ data }) => {
      if (!cancelled) setItems(data);
    }).catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retry]);
  const shown = items.filter(item => `${item.name || ''} ${item.email} ${item.comment} ${item.asset_title || 'AImplify Platform'}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold text-gray-900">Platform Feedback</h2>
        <p className="text-sm text-gray-500">Latest 200 suggestions and issues for AImplify Platform and individual assets.</p></div>
      <button type="button" disabled={loading} onClick={() => setRetry(value => value + 1)} className="cursor-pointer rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Refresh</button>
    </div>
    <input aria-label="Search platform feedback" placeholder="Search feedback, asset, name, or email…" value={search} onChange={event => setSearch(event.target.value)}
      className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200" />
    {loading ? <div role="status" className="flex items-center gap-2 py-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Loading feedback…</div>
      : failed ? <button type="button" onClick={() => setRetry(value => value + 1)} className="cursor-pointer rounded-lg border px-4 py-2 text-sm">Retry</button>
      : !shown.length ? <p className="py-6 text-sm text-gray-500">{search ? 'No matching feedback.' : 'No platform feedback submitted yet.'}</p>
      : <div className="space-y-3">{shown.map(item => <article key={item.id} className="rounded-xl border border-gray-200 p-4">
        <div className="mb-3 flex flex-wrap justify-between gap-2"><div><p className="font-semibold text-gray-900">{item.name || item.email}</p>
          <p className="text-xs text-gray-500">{item.email}</p></div>
          <time dateTime={item.created_at} className="text-xs text-gray-500">{new Date(item.created_at).toLocaleString()}</time></div>
        <p className="mb-2 text-xs font-semibold text-sky-700">Feedback for: {item.asset_title || 'AImplify Platform'}</p>
        <p className="whitespace-pre-wrap break-words text-sm text-gray-700">{item.comment}</p>
      </article>)}</div>}
  </section>;
}
