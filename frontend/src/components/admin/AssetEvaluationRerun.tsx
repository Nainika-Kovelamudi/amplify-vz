import { useState } from 'react';
import { apiClient } from '../../lib/apiClient';
import { apiErrorMessage } from '../../lib/apiError';

export function AssetEvaluationRerun({ assetId, onRefresh }: { assetId: string; onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const rerun = async () => {
    if (!window.confirm('Re-run AI evaluation for this asset? Its score and findings will be updated after processing. Approval and publication status will be preserved.')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { data } = await apiClient.post<{job:{state:string}}>(`/admin/platform-operations/assets/${assetId}/rerun-evaluation`);
      setNotice(`AI evaluation ${data.job.state.toLowerCase()}. Refresh to load the latest available score and findings.`);
    } catch (e) { setError(apiErrorMessage(e, 'AI evaluation could not be queued.')); }
    finally { setBusy(false); }
  };
  const refresh = async () => {
    setRefreshing(true); setError('');
    try { await onRefresh(); }
    catch (e) { setError(apiErrorMessage(e, 'The latest AI evaluation could not be loaded.')); }
    finally { setRefreshing(false); }
  };
  return <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-sm font-semibold text-slate-900">Re-run AI evaluation</h3><p className="mt-1 text-xs text-slate-500">Reassess this asset using its latest saved details. Approval and publication status are preserved.</p></div>
      <button type="button" disabled={busy} onClick={()=>void rerun()} className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">{busy?'Queuing…':'Re-run AI evaluation'}</button>
    </div>
    {notice&&<div className="mt-3 flex flex-wrap items-center gap-3">
      <p role="status" className="text-xs text-indigo-700">{notice}</p>
      <button type="button" disabled={busy||refreshing} onClick={()=>void refresh()} className="cursor-pointer rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50">{refreshing?'Refreshing…':'Refresh'}</button>
    </div>}
    {error&&<p role="alert" className="mt-3 text-xs text-rose-700">{error}</p>}
  </div>;
}
