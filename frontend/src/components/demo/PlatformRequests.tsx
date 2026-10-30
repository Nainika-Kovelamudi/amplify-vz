import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, Loader2, MessageSquare, Presentation, X } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import type { CatalogAsset } from '../../lib/catalogService';
import { useAuth } from '../../context/AuthContext';

interface Feedback { id: string; created_at: string; name: string; email: string; comment: string; asset_id?: string | null; asset_title?: string | null }

export function PlatformRequests({ assets, loading, onSubmitted, variant = 'default' }: {
  assets: CatalogAsset[]; loading: boolean; onSubmitted: () => void; variant?: 'default' | 'banner';
}) {
  const navigate=useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [modal, setModal] = useState<'demo' | 'feedback' | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [platformDemo, setPlatformDemo] = useState(false);
  const [customer, setCustomer] = useState('');
  const [project, setProject] = useState('');
  const [vertical, setVertical] = useState('');
  const [comment, setComment] = useState('');
  const [feedbackAsset, setFeedbackAsset] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [feedbackError, setFeedbackError] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const canReview = user?.role === 'Aimplify.Admin' || user?.role === 'Aimplify.Owner';
  const available = assets.filter(asset => asset.status === 'Published');
  const shown = available.filter(asset => `${asset.title} ${asset.family}`.toLowerCase().includes(search.toLowerCase()));
  const fieldClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200';

  useEffect(() => {
    if (params.get('feedback') === '1' && user) {
      setModal('feedback');
      const next = new URLSearchParams(params); next.delete('feedback'); setParams(next, { replace: true });
    }
  }, [params, setParams, user]);

  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setModal(null);
      if (event.key === 'Tab') {
        const elements = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, [tabindex="0"]');
        if (!elements?.length) return;
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, [modal, busy]);

  useEffect(() => {
    if (modal !== 'feedback' || !canReview) return;
    let cancelled = false;
    setFeedbackError(false);
    apiClient.get<Feedback[]>('/platform-feedback').then(({ data }) => {
      if (!cancelled) setFeedback(data);
    }).catch(() => { if (!cancelled) setFeedbackError(true); });
    return () => { cancelled = true; };
  }, [modal, canReview]);

  function open(kind: 'demo' | 'feedback') {
    setError(''); setSuccess(''); setModal(kind); setExpanded(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (modal === 'demo' && (!customer.trim() || !project.trim() || (!selected.length && !platformDemo))) {
      setError('Enter the customer and project names, and select an asset or AImplify Platform Demo.'); return;
    }
    if (modal === 'feedback' && !comment.trim()) { setError('Please enter your feedback.'); return; }
    setBusy(true); setError('');
    try {
      if (modal === 'demo') {
        await apiClient.post('/demo-requests/multiple', {
          asset_ids: selected, platform_demo: platformDemo, customer_name: customer.trim(), project_name: project.trim(), vertical: vertical || null,
        });
        setSuccess(platformDemo ? 'Demo request submitted. The platform demo has been sent to platform owners. Selected assets follow their owner review flow.' : 'Demo request submitted. Each selected asset has been sent to its owner for review.');
        setSelected([]); setPlatformDemo(false); setCustomer(''); setProject(''); setVertical(''); setSearch(''); onSubmitted();
      } else {
        await apiClient.post('/platform-feedback', { comment: comment.trim(), asset_id: feedbackAsset || null });
        setSuccess(feedbackAsset ? 'Thank you. Your asset feedback has been submitted.' : 'Thank you. Your platform feedback has been submitted.'); setComment(''); setFeedbackAsset('');
      }
      setModal(null);
    } catch (err) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
      setError(typeof detail === 'string' ? detail : 'Could not submit. Please try again.');
    } finally { setBusy(false); }
  }

  return <>
    <div className={`flex min-w-0 max-w-full flex-wrap items-center gap-2 ${variant === 'banner' ? 'w-full justify-center' : 'ml-auto justify-end'}`}>
      <button type="button" onClick={() => navigate('/meeting-requests/new')} disabled={!user}
        className="flex max-w-full cursor-pointer items-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-left text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
        <Presentation className="h-3.5 w-3.5 shrink-0" /> Raise a multi-asset customer demo request
      </button>
      <button type="button" onClick={() => open('feedback')} disabled={!user}
        className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${variant === 'banner' ? 'border-white/40 bg-white/10 text-white hover:bg-white/20' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
        <MessageSquare className="h-3.5 w-3.5 shrink-0" /> Platform feedback
      </button>
    </div>
    {success && createPortal(
      <div role="status" className="fixed bottom-6 right-4 z-[100] flex w-[26rem] max-w-[calc(100%-2rem)] items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-lg">
        <p className="min-w-0 flex-1 break-words">{success}</p>
        <button type="button" aria-label="Dismiss confirmation" onClick={() => setSuccess('')} className="shrink-0 cursor-pointer rounded p-1 text-emerald-700 hover:bg-emerald-100"><X className="h-4 w-4" /></button>
      </div>, document.body
    )}
    {modal && createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="platform-request-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 text-gray-900 shadow-xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="platform-request-title" className="text-lg font-bold text-gray-900">{modal === 'demo' ? 'Customer demo request' : 'Platform feedback'}</h2>
          <button type="button" disabled={busy} aria-label="Close" onClick={() => setModal(null)} className="cursor-pointer rounded p-1 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-semibold text-gray-700">Requestor
            <input readOnly className={`${fieldClass} mt-1 bg-gray-50`} value={user?.display_name || user?.email || ''} />
          </label>
          {modal === 'demo' ? <>
            <label className="block text-sm font-semibold text-gray-700">Vertical / Industry
              <select className={`${fieldClass} mt-1`} value={vertical} onChange={e => setVertical(e.target.value)} disabled={busy}>
                <option value="">Select a vertical…</option>
                {['TMT', 'RCL', 'BFSI', 'AMI', 'HLM', 'PLATINUM'].map(v => <option key={v}>{v}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-gray-700">Customer Name *
              <input required maxLength={200} disabled={busy} className={`${fieldClass} mt-1`} value={customer} onChange={e => setCustomer(e.target.value)} />
            </label>
            <label className="block text-sm font-semibold text-gray-700">Project / Opportunity Name *
              <input required maxLength={200} disabled={busy} className={`${fieldClass} mt-1`} value={project} onChange={e => setProject(e.target.value)} />
            </label>
            <div>
              <p id="asset-selector-label" className="mb-1 text-sm font-semibold text-gray-700">Assets *</p>
              <button type="button" disabled={busy} aria-labelledby="asset-selector-label" aria-expanded={expanded} aria-controls="demo-asset-options"
                onClick={() => setExpanded(!expanded)} className={`${fieldClass} flex cursor-pointer items-center justify-between text-left`}>
                {selected.length || platformDemo ? `${selected.length + Number(platformDemo)} option(s) selected` : 'Select assets or platform demo'}<ChevronDown className="h-4 w-4" />
              </button>
              {expanded && <div id="demo-asset-options" className="mt-2 rounded-lg border border-gray-200 p-2">
                <label className="mb-2 flex cursor-pointer items-center gap-2 rounded bg-sky-50 p-2 text-sm font-semibold">
                  <input type="checkbox" checked={platformDemo} disabled={busy} onChange={e => setPlatformDemo(e.target.checked)} />
                  AImplify Platform Demo
                </label>
                <input aria-label="Search assets" placeholder="Search assets…" className={`${fieldClass} mb-2`} value={search} onChange={e => setSearch(e.target.value)} />
                <div className="max-h-48 overflow-y-auto">
                  {shown.map(asset => <label key={asset.id} className="flex cursor-pointer items-center gap-2 rounded p-2 text-sm hover:bg-sky-50">
                    <input type="checkbox" disabled={busy || (!selected.includes(asset.id) && selected.length >= 100)} checked={selected.includes(asset.id)}
                      onChange={e => setSelected(p => e.target.checked ? [...p, asset.id] : p.filter(id => id !== asset.id))} />
                    <span>{asset.title}<span className="ml-2 text-xs text-gray-500">{asset.family}</span></span>
                  </label>)}
                  {loading ? <p className="p-2 text-sm text-gray-500">Loading assets…</p> : !shown.length && <p className="p-2 text-sm text-gray-500">No available assets found.</p>}
                </div>
              </div>}
              {selected.length > 0 && <p className="mt-2 text-xs text-gray-500">{available.filter(a => selected.includes(a.id)).map(a => a.title).join(', ')}</p>}
              {platformDemo && <p className="mt-2 text-xs text-sky-700">AImplify Platform Demo — sent to platform owners</p>}
            </div>
          </> : <>
          <label className="block text-sm font-semibold text-gray-700">Feedback for *
            <select className={`${fieldClass} mt-1`} value={feedbackAsset} onChange={e => setFeedbackAsset(e.target.value)} disabled={busy}>
              <option value="">AImplify Platform</option>
              <optgroup label="Assets">
                {available.map(asset => <option key={asset.id} value={asset.id}>{asset.title} ({asset.family})</option>)}
              </optgroup>
            </select>
          </label>
          {loading && <p className="text-xs text-gray-500">Loading asset choices…</p>}
          <label className="block text-sm font-semibold text-gray-700">Your feedback *
            <textarea required maxLength={5000} disabled={busy} rows={5} className={`${fieldClass} mt-1`} placeholder={feedbackAsset ? 'Share suggestions or issues about the selected asset…' : 'Share suggestions or issues about the platform…'} value={comment} onChange={e => setComment(e.target.value)} />
          </label></>}
          {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" disabled={busy} onClick={() => setModal(null)} className="cursor-pointer rounded-lg border px-4 py-2 text-sm">Cancel</button>
            <button disabled={busy || (modal === 'demo' && !selected.length && !platformDemo)} className="flex cursor-pointer items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? 'Submitting…' : modal === 'demo' ? 'Submit request' : 'Submit feedback'}
            </button>
          </div>
        </form>
        {modal === 'feedback' && canReview && <div className="mt-6 border-t pt-4">
          <h3 className="mb-3 text-sm font-bold">Recent feedback</h3>
          {feedbackError ? <p className="text-sm text-gray-500">Feedback history is unavailable. Reopen to retry.</p> : feedback.length ? feedback.map(item => <article key={item.id} className="mb-3 rounded-lg bg-gray-50 p-3 text-sm">
            <p className="mb-1 text-xs font-semibold text-sky-700">{item.asset_title || 'AImplify Platform'}</p><p className="font-semibold">{item.name || item.email}</p><p className="whitespace-pre-wrap break-words">{item.comment}</p>
            <time className="text-xs text-gray-500">{new Date(item.created_at).toLocaleString()}</time>
          </article>) : <p className="text-sm text-gray-500">No platform feedback yet.</p>}
        </div>}
      </div>
    </div>, document.body)}
  </>;
}
