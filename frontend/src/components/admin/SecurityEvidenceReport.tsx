import { useEffect, useRef, useState } from 'react';
import { Download, ShieldCheck, RefreshCw, ChevronDown } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { ReportFrame, ReportMetric, ReportBadge, ReportSearch, ReportAssetHeader, ReportFinding } from './ReportUI';

interface Finding { control: string; status: string; evidence: { field: string; excerpt: string }[]; action: string }
interface AssetEvidence {
  id: string; title: string; slug: string; family: string; status: string; owner_name: string; owner_email: string;
  mentions: number; total_controls: number; not_documented: number; findings: Finding[];
  existing_ai_security_status: string; existing_ai_security_note: string;
}
interface Report { generated_at: string; limitation: string; assets: AssetEvidence[] }

export function SecurityEvidenceReport() {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
      if (event.key !== 'Tab') return;
      const elements = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, a[href], summary');
      const visible = Array.from(elements || []).filter(el => el.offsetParent !== null);
      if (!visible.length) return;
      const first = visible[0], last = visible[visible.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [open]);
  async function load() {
    setOpen(true); setLoading(true); setError('');
    try {
      const { data } = await apiClient.get<Report>('/admin/security-report', { timeout: 90_000 });
      setReport(data);
      setSelected(current => data.assets.some(a => a.id === current) ? current : data.assets[0]?.id || '');
    } catch { setError('Could not generate the security evidence report. Please try again.'); }
    finally { setLoading(false); }
  }
  async function download() {
    setDownloading(true); setError('');
    try {
      const { data } = await apiClient.get<Blob>('/admin/security-report', { params: { format: 'csv' }, responseType: 'blob', timeout: 90_000 });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a'); link.href = url; link.download = 'AIMPLIFY_Security_Evidence_Report.csv';
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('Could not download the report. Please try again.'); }
    finally { setDownloading(false); }
  }
  const shown = report?.assets.filter(a => `${a.title} ${a.owner_name} ${a.owner_email} ${a.family}`.toLowerCase().includes(search.toLowerCase())) || [];
  const asset = shown.find(a => a.id === selected) || shown[0];
  return <>
    <button onClick={() => void load()} disabled={loading} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 disabled:opacity-50">
      <ShieldCheck className="h-3.5 w-3.5" /> Security evidence report
    </button>
    {open && <ReportFrame dialogRef={dialog} title="Security evidence report" subtitle="Documentation coverage and recommended owner actions" icon={<ShieldCheck />} onClose={() => setOpen(false)} actions={<>
      <button className="report-secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Refresh</button>
      <button className="report-primary" onClick={() => void download()} disabled={loading || downloading || !report}><Download size={14} /> {downloading ? 'Exporting…' : 'Export CSV'}</button>
    </>}>
      <div className="report-meta-bar"><span><strong>{report?.assets.length ?? '—'} assets</strong> · All lifecycle statuses</span><span>{report ? `Generated ${new Date(report.generated_at).toLocaleString()}` : 'Preparing report'}</span></div>
      {error && <p role="alert" className="report-error">{error}</p>}
      {loading ? <div role="status" className="report-loading">Preparing security evidence…</div> : report && <div className="report-body">
        <aside className="report-sidebar" aria-label="Security report assets">
          <div className="report-sidebar-top"><ReportSearch value={search} onChange={setSearch} /><span className="report-list-count">{shown.length} assets found</span></div>
          <div className="report-asset-list">{shown.map(a => <button key={a.id} aria-pressed={asset?.id === a.id} className="report-asset-button" onClick={() => setSelected(a.id)}><strong>{a.title}</strong><p>{a.owner_name || a.owner_email || 'Owner not recorded'}</p><ReportBadge tone={a.not_documented ? 'amber' : 'blue'}>{a.not_documented} documentation gaps</ReportBadge></button>)}{!shown.length && <p className="report-empty">No matching assets.</p>}</div>
        </aside>
        <main className="report-main">
          <details className="report-note"><summary>About this assessment <ChevronDown size={14} /></summary><p>{report.limitation}</p><p>Owners should update verified details through the asset page. This report does not change descriptions, scores or approvals.</p></details>
          {!asset ? <p className="report-empty">Select an asset to inspect its security evidence.</p> : <>
            <ReportAssetHeader title={asset.title} owner={asset.owner_name} email={asset.owner_email} status={asset.status} slug={asset.slug} onNavigate={() => setOpen(false)} />
            <div className="report-metrics"><ReportMetric label="Documentation gaps" value={asset.not_documented} note="No evidence in reviewed fields" /><ReportMetric label="Mentions to review" value={asset.mentions} note="Require owner verification" /><ReportMetric label="Controls assessed" value={asset.total_controls} note="Documentation review only" /></div>
            <div className="report-section-heading"><h4>Security controls</h4><span>Expand a control for evidence and actions</span></div>
            <div className="report-findings" key={asset.id}>{asset.findings.map((f, i) => <ReportFinding key={f.control} title={f.control} status={f.status} action={f.action} open={i === 0} evidence={f.evidence.length ? <>{f.evidence.map(e => <blockquote key={e.field}><span className="report-eyebrow">{e.field.replaceAll('_', ' ')}</span><p>{e.excerpt}</p></blockquote>)}</> : undefined} />)}</div>
            <details className="report-note" style={{ marginTop: 18 }}><summary>Previous AI assessment <ReportBadge>{asset.existing_ai_security_status}</ReportBadge></summary><p>{asset.existing_ai_security_note || 'No previous AI security assessment is recorded.'}</p></details>
          </>}
        </main>
      </div>}
      <footer className="report-footer"><span>Evidence inventory · No controls independently verified</span><span>CSV export includes every asset</span></footer>
    </ReportFrame>}
  </>;
}
