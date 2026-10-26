import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../lib/apiClient';
import { ReportFrame, ReportMetric, ReportBadge, ReportSearch, ReportAssetHeader, ReportFinding } from './ReportUI';
import { ClipboardList, Download, RefreshCw, ChevronDown } from 'lucide-react';

const SECURITY_CONTROLS = new Set(['Authentication', 'Authorization', 'Secrets management', 'Input and AI safety', 'Data protection', 'Data handling and privacy', 'Audit logging', 'Dependency and vulnerability management', 'Deployment hardening', 'Security verification']);
interface Finding { section?: string; area: string; criterion: string; credit: number; status: string; evidence: string; action: string }
interface Reference { category: string; name: string; url: string; link_status: string; content_status: string; relevance_status: string; checked_at: string | null }
interface Asset {
  id: string; title: string; slug: string; family: string; status: string; owner_name: string; owner_email: string;
  indices: { metadata: number; compliance: number; collateral: number }; missing_items: number; unverified_links: number;
  findings: Finding[]; collateral: Reference[]; updated_at: string | null;
  security_scope?: { stored_fields: string[]; documents_provided: number; documents_reviewed: number; documents_not_reviewed: number; document_checks: { file: string; status: string; link_status: string }[] };
  existing_ai_security_status?: string; existing_ai_security_note?: string;
}
interface Report { generated_at: string; methodology: Record<string, string>; assets: Asset[]; verification_requested: boolean }

export function AssetQualityReport() {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [downloading, setDownloading] = useState(false);
  const [report, setReport] = useState<Report | null>(null), [error, setError] = useState('');
  const [verify, setVerify] = useState(false), [search, setSearch] = useState(''), [selected, setSelected] = useState('');
  const dialog = useRef<HTMLElement>(null);
  const [area, setArea] = useState('Security');
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null; dialog.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key !== 'Tab') return;
      const nodes = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, a[href], summary');
      const visible = Array.from(nodes || []).filter(el => el.offsetParent !== null);
      if (!visible.length) return;
      const first = visible[0], last = visible[visible.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); previous?.focus(); };
  }, [open]);
  async function generate(checkLinks = verify) {
    setOpen(true); setBusy(true); setError('');
    try {
      const { data } = await apiClient.get<Report>('/admin/asset-quality-report', { params: { verify: checkLinks }, timeout: 150_000 });
      setReport(data);
    } catch { setError('Could not generate the asset quality report. Please retry after checking the backend deployment.'); }
    finally { setBusy(false); }
  }
  async function download() {
    setDownloading(true); setError('');
    try {
      const { data } = await apiClient.get<Blob>('/admin/asset-quality-report', {
        params: { format: 'xlsx', verify: report?.verification_requested || false }, responseType: 'blob', timeout: 150_000,
      });
      const url = URL.createObjectURL(data), a = document.createElement('a');
      a.href = url; a.download = 'AIMPLIFY_Asset_Quality_Report.xlsx'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('Could not download the asset quality workbook. Please try again.'); }
    finally { setDownloading(false); }
  }
  const assets = report?.assets.filter(a => `${a.title} ${a.family} ${a.owner_name} ${a.owner_email}`.toLowerCase().includes(search.toLowerCase())) || [];
  const asset = assets.find(a => a.id === selected) || assets[0];
  return <>
    <button onClick={() => void generate(false)} disabled={busy} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 disabled:opacity-50"><ClipboardList className="h-3.5 w-3.5" /> Asset quality report</button>
    {open && <ReportFrame dialogRef={dialog} title="Asset quality report" subtitle="Security evidence, compliance, collateral and metadata" icon={<ClipboardList />} onClose={() => setOpen(false)} actions={<>
      <button className="report-secondary" onClick={() => void generate()} disabled={busy || downloading}><RefreshCw size={14} /> Refresh</button>
      <button className="report-primary" onClick={() => void download()} disabled={busy || downloading || !report}><Download size={14} /> {downloading ? 'Exporting…' : 'Export Excel'}</button>
    </>}>
      <div className="report-meta-bar"><span><strong>{report?.assets.length ?? '—'} assets</strong> · All lifecycle statuses</span><span>{report ? `${report.verification_requested ? 'Verification requested' : 'Snapshot assessment'} · ${new Date(report.generated_at).toLocaleString()}` : 'Preparing report'}</span></div>
      {error && <p role="alert" className="report-error">{error}</p>}
      {busy && <div role="status" className="report-loading">Assessing asset quality…</div>}
      {report && !busy && <div className="report-body">
        <aside className="report-sidebar" aria-label="Quality report assets">
          <div className="report-sidebar-top"><ReportSearch value={search} onChange={setSearch} /><span className="report-list-count">{assets.length} assets found</span></div>
          <div className="report-asset-list">{assets.map(a => <button key={a.id} aria-pressed={a.id === asset?.id} className="report-asset-button" onClick={() => setSelected(a.id)}><strong>{a.title}</strong><p>{a.owner_name || a.owner_email || 'Owner not recorded'}</p><small>{a.family} · {a.missing_items} missing items</small></button>)}{!assets.length && <p className="report-empty">No matching assets.</p>}</div>
        </aside>
        <main className="report-main">
          <details className="report-note"><summary>How these indices are assessed <ChevronDown size={14} /></summary><p>Indices measure evidence and completed checks, not certified compliance or functional readiness. Unknown checks receive no verification credit. No asset content or approval decisions are changed.</p>{Object.entries(report.methodology).map(([name, value]) => <p key={name}><strong>{name.charAt(0).toUpperCase() + name.slice(1)}:</strong> {value}</p>)}</details>
          <div className="report-controls"><label><input type="checkbox" checked={verify} onChange={e => setVerify(e.target.checked)} disabled={busy} /> Include document evidence and approved link checks</label><span>Up to 45 seconds</span><button className="report-secondary" disabled={busy || downloading} onClick={() => void generate()}>Apply &amp; assess</button></div>
          {!asset ? <p className="report-empty">Select an asset to inspect its quality findings.</p> : <>
            <ReportAssetHeader title={asset.title} owner={asset.owner_name} email={asset.owner_email} status={asset.status} slug={asset.slug} onNavigate={() => setOpen(false)}><small>Updated {asset.updated_at ? new Date(asset.updated_at).toLocaleDateString() : 'date not recorded'} · {asset.missing_items} missing items</small></ReportAssetHeader>
            <div className="report-metrics"><ReportMetric label="Metadata index" value={<>{asset.indices.metadata}<span style={{ fontSize: 12, color: '#94a3b8' }}> / 100</span></>} note="Completeness of stored information" /><ReportMetric label="Compliance readiness" value={<>{asset.indices.compliance}<span style={{ fontSize: 12, color: '#94a3b8' }}> / 100</span></>} note="Evidence coverage, not certification" /><ReportMetric label="Collateral index" value={<>{asset.indices.collateral}<span style={{ fontSize: 12, color: '#94a3b8' }}> / 100</span></>} note="References and completed checks" /></div>
            <nav className="report-tabs" aria-label="Finding categories">{['Security', 'Compliance readiness', 'Metadata', 'Collateral', 'Link checks'].map(name => <button key={name} aria-pressed={area === name} onClick={() => setArea(name)}>{name}</button>)}</nav>
            {area === 'Security' && <>
              <div className="report-note">
                <strong>Sources used for this assessment</strong>
                <p>Description, dependencies and setup commands{report.verification_requested ? ', plus supported documents successfully read during this assessment.' : ' only. Select “Include document evidence” above and apply to inspect uploaded documents.'}</p>
                {asset.security_scope && <p><strong>{asset.security_scope.documents_reviewed} / {asset.security_scope.documents_provided} documents read</strong> · {asset.security_scope.documents_not_reviewed} not assessed. Unread documents do not prove that security controls are missing.</p>}
                {asset.security_scope && asset.security_scope.document_checks.length > 0 && <details style={{ marginTop: 10 }}><summary style={{ cursor: 'pointer' }}>Document assessment coverage</summary>{asset.security_scope.document_checks.map((doc, i) => <p key={i}><strong>{doc.file}</strong> · {doc.status} · {doc.link_status}</p>)}</details>}
              </div>
              <p className="report-assessment">Security findings contribute to the compliance readiness index. Excerpts are documentation evidence, not verification that controls work.</p>
            </>}
            {area !== 'Link checks' ? <div className="report-findings" key={`${asset.id}-${area}`}>{asset.findings.filter(f => { const security = f.section === 'security' || (f.area === 'Compliance readiness' && SECURITY_CONTROLS.has(f.criterion)); return area === 'Security' ? security : f.area === area && !security; }).map((f, i) => <ReportFinding key={f.criterion} title={f.criterion} status={f.status} action={f.action} open={i === 0} evidence={f.evidence ? <p>{f.evidence}</p> : undefined} detail={<p className="report-assessment" style={{ marginTop: 12, marginBottom: 0 }}>Assessment credit: {f.credit} / 1 · See methodology for scoring</p>} />)}</div>
            : <><p style={{ fontSize: 11, color: '#64748b', marginBottom: 14 }}>{asset.unverified_links} links not verified reachable. Authentication requirements and uncompleted checks are not confirmed defects.</p>{asset.collateral.map((r, i) => <article key={i} className="report-link-card"><div className="report-section-heading" style={{ marginTop: 0 }}><h4>{r.name}</h4><ReportBadge>{r.category}</ReportBadge></div><p>{r.url}</p><div className="report-link-grid"><div><span>LINK AVAILABILITY</span>{r.link_status}</div><div><span>CONTENT / READABILITY</span>{r.content_status}</div><div><span>RELEVANCE</span>{r.relevance_status}</div></div><p style={{ marginBottom: 0 }}>Checked {r.checked_at ? new Date(r.checked_at).toLocaleString() : 'not yet'}</p></article>)}{!asset.collateral.length && <p className="report-empty">No collateral references recorded.</p>}</>}
          </>}
          <details className="report-note" style={{ marginTop: 22 }}><summary>Compare assets ({assets.length}) <ChevronDown size={14} /></summary><div className="report-table-wrap" style={{ marginTop: 12 }}><table className="report-table"><thead><tr>{['Asset', 'Metadata', 'Compliance', 'Collateral', 'Missing'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{assets.map(a => <tr key={a.id}><td><button onClick={() => setSelected(a.id)}>{a.title}</button></td><td>{a.indices.metadata}</td><td>{a.indices.compliance}</td><td>{a.indices.collateral}</td><td>{a.missing_items}</td></tr>)}</tbody></table></div></details>
        </main>
      </div>}
      <footer className="report-footer"><span>Evidence-based indices · Unverified items require review</span><span>Excel includes all assets, findings and methodology</span></footer>
    </ReportFrame>}
  </>;
}
