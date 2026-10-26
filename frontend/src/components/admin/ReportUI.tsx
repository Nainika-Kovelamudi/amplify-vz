import { useState, type ReactNode, type RefObject } from 'react';
import { ArrowUpRight, ChevronDown, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import './reports.css';

export function ReportFrame({ dialogRef, title, subtitle, icon, actions, onClose, children }: {
  dialogRef: RefObject<HTMLElement | null>; title: string; subtitle: string; icon: ReactNode;
  actions: ReactNode; onClose: () => void; children: ReactNode;
}) {
  return <div className="report-overlay"><section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="report-modal">
    <header className="report-header"><div className="report-heading"><span className="report-header-icon">{icon}</span><div><span className="report-eyebrow">AIMPLIFY · GOVERNANCE</span><h2>{title}</h2><p>{subtitle}</p></div></div><div className="report-actions">{actions}<button className="report-icon-button" onClick={onClose} aria-label={`Close ${title}`}><X size={18} /></button></div></header>
    {children}
  </section></div>;
}

export function ReportMetric({ label, value, note }: { label: string; value: ReactNode; note: string }) {
  return <div className="report-metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

export function ReportBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'amber' | 'blue' }) {
  return <span className={`report-badge report-badge-${tone}`}>{children}</span>;
}

export function ReportSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="report-search"><Search size={15} /><input aria-label="Search report assets" placeholder="Search assets or owners…" value={value} onChange={e => onChange(e.target.value)} /></label>;
}

export function ReportAssetHeader({ title, owner, email, status, slug, onNavigate, children }: {
  title: string; owner: string; email: string; status: string; slug: string; onNavigate: () => void; children?: ReactNode;
}) {
  return <div className="report-asset-header"><div><div className="report-asset-label"><span className="report-eyebrow">SELECTED ASSET</span><ReportBadge>{status}</ReportBadge></div><h3>{title}</h3><p>{owner || 'Owner not recorded'}{email && <> · <span>{email}</span></>}</p>{children}</div><Link className="report-secondary" to={`/catalog/${slug}`} onClick={onNavigate}>Review asset <ArrowUpRight size={14} /></Link></div>;
}

export function ReportFinding({ title, status, action, evidence, detail, open = false }: {
  title: string; status: string; action: string; evidence?: ReactNode; detail?: ReactNode; open?: boolean;
}) {
  const missing = /missing|not documented|limited|invalid|no matched/i.test(status);
  const review = /verify|review|recorded -/i.test(status);
  const [expanded, setExpanded] = useState(open);
  return <details className="report-finding" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary><span className={`report-status-dot ${missing ? 'report-dot-amber' : 'report-dot-blue'}`} /><strong>{title}</strong><ReportBadge tone={missing ? 'amber' : review ? 'blue' : 'neutral'}>{missing ? 'Documentation gap' : review ? 'Needs verification' : status}</ReportBadge><ChevronDown size={16} className="report-chevron" /></summary>
    <div className="report-finding-body"><p className="report-assessment">{status}</p>{evidence && <div className="report-evidence"><span className="report-eyebrow">SUPPORTING EVIDENCE</span>{evidence}</div>}<div className="report-owner-action"><span className="report-eyebrow">RECOMMENDED OWNER ACTION</span><p>{action}</p></div>{detail}</div>
  </details>;
}
