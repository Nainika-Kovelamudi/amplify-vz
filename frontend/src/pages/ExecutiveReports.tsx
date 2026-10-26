import { type ElementType, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, BarChart3, CheckCircle2, Clock3, Download,
  Eye, FileCheck2, GitBranch, LogIn, Mail, RefreshCw, Rocket, RotateCcw, Send, Sparkles, Trophy, Users,
} from 'lucide-react';
import { downloadExecutiveReport, getExecutiveReport, sendExecutiveReportTestEmail, type ExecutiveReport, type ExecutiveReportFormat, type ReportBreakdown } from '../lib/adminService';
import { usePortalSettings } from '../context/PortalSettingsContext';

const STATUS_LABELS: Record<string, string> = {
  Submitted: 'AI Processing', Manual_Approval: 'Admin Review', Approved: 'Awaiting Publish',
  Published: 'Published', Needs_Changes: 'Needs Changes', Rejected: 'Rejected',
  On_Hold: 'On Hold', Archived: 'Archived',
};

const EVENT_ICONS: Record<string, ElementType> = {
  asset_viewed: Eye, user_login: LogIn, assets_revised: RotateCcw,
  new_submission: Send, published_asset: Rocket,
};
const FAMILY_TONES = ['bg-indigo-500', 'bg-violet-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];

function MetricCard({ label, value, suffix = '', hint, icon: Icon, tone }: {
  label: string; value: number; suffix?: string; hint: string;
  icon: ElementType; tone: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{value.toLocaleString()}{suffix}</p>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${tone}`}><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  );
}

function BreakdownTable({ title, rows }: { title: string; rows: ReportBreakdown[] }) {
  const max = Math.max(1, ...rows.map(row => row.submitted));
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
            <tr><th className="px-5 py-3">Name</th><th className="px-3 py-3">Submitted</th><th className="px-3 py-3">Approved</th><th className="px-3 py-3">Published</th><th className="px-5 py-3">Avg AI</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? <tr><td className="px-5 py-8 text-center text-slate-400" colSpan={5}>No activity in this period.</td></tr> : rows.slice(0, 10).map(row => (
              <tr key={row.name} className="hover:bg-slate-50/70">
                <td className="min-w-48 px-5 py-3.5">
                  <p className="font-semibold text-slate-700">{row.name}</p>
                  <div className="mt-1.5 h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${row.submitted * 100 / max}%` }} /></div>
                </td>
                <td className="px-3 py-3.5 font-bold text-slate-700">{row.submitted}</td>
                <td className="px-3 py-3.5 text-emerald-700">{row.approved}</td>
                <td className="px-3 py-3.5 text-teal-700">{row.published}</td>
                <td className="px-5 py-3.5"><span className="rounded-md bg-violet-50 px-2 py-1 font-bold text-violet-700">{row.average_ai_score}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ExecutiveReports() {
  const { banners } = usePortalSettings();
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<ExecutiveReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [mailStatus, setMailStatus] = useState('');
  const [reportFormat, setReportFormat] = useState<ExecutiveReportFormat>('pdf');

  const requestSequence = useRef(0);
  const load = useCallback((refresh = false) => {
    const sequence = ++requestSequence.current;
    setLoading(true); setError('');
    getExecutiveReport(days, refresh)
      .then(data => { if (sequence === requestSequence.current) setReport(data); })
      .catch(() => { if (sequence === requestSequence.current) setError('Executive report could not be loaded.'); })
      .finally(() => { if (sequence === requestSequence.current) setLoading(false); });
  }, [days]);

  useEffect(() => { load(); return () => { requestSequence.current += 1; }; }, [load]);

  const downloadReport = async () => {
    setDownloading(true); setError('');
    try { await downloadExecutiveReport(days, reportFormat); }
    catch { setError(`The ${reportFormat.toUpperCase()} report could not be downloaded.`); }
    finally { setDownloading(false); }
  };

  const sendTestMail = async () => {
    setSendingTest(true); setError(''); setMailStatus('');
    try {
      const result = await sendExecutiveReportTestEmail(days, reportFormat);
      setMailStatus(`Dashboard email with ${result.format.toUpperCase()} attachment sent to ${result.recipient}`);
    } catch { setError('The test report email could not be sent. Check the backend email configuration.'); }
    finally { setSendingTest(false); }
  };

  const trend = useMemo(() => {
    const points = report?.daily_trend ?? [];
    const max = Math.max(1, ...points.flatMap(p => [p.submitted, p.published]));
    const width = 700; const height = 180; const pad = 20;
    const path = (key: 'submitted' | 'published') => points.map((p, i) => {
      const x = pad + (points.length <= 1 ? 0 : i * (width - pad * 2) / (points.length - 1));
      const y = height - pad - p[key] * (height - pad * 2) / max;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
    return { points, width, height, submittedPath: path('submitted'), publishedPath: path('published') };
  }, [report]);

  if (loading && !report) return <div className="p-16 text-center text-sm text-slate-400">Building executive report…</div>;

  const s = report?.summary;
  const maxEvent = Math.max(1, ...(report?.top_events.map(event => event.count) ?? [1]));
  return (
    <div className="min-h-screen bg-slate-50/70 px-4 py-8 md:px-10">
      <div className="mx-auto max-w-screen-2xl">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-500"><BarChart3 className="h-4 w-4" />Executive reporting</div>
            <h1 className="text-2xl font-extrabold text-slate-900">{banners.executive.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{banners.executive.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={days} onChange={e => setDays(Number(e.target.value))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
              <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last 12 months</option>
            </select>
            <select value={reportFormat} onChange={e => setReportFormat(e.target.value as ExecutiveReportFormat)} aria-label="Executive report format" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
              <option value="docx">Word</option><option value="xlsx">Excel</option><option value="pdf">PDF</option>
            </select>
            <button onClick={() => void downloadReport()} disabled={downloading} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm disabled:opacity-50"><Download className="h-3.5 w-3.5" />{downloading ? 'Preparing…' : 'Download'}</button>
            <button onClick={() => void sendTestMail()} disabled={sendingTest} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 shadow-sm disabled:opacity-50"><Mail className="h-3.5 w-3.5" />{sendingTest ? 'Sending…' : 'Send Mail'}</button>
            <button onClick={() => load(true)} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
          </div>
        </div>

        {error && <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        {mailStatus && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{mailStatus}</div>}

        {s && <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-slate-800">Assets Catalog</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <MetricCard label="Total assets" value={s.total_assets} hint="Published + in-progress submissions" icon={BarChart3} tone="bg-slate-100 text-slate-600" />
            <MetricCard label="Published assets" value={s.published_assets} hint="Live in catalog" icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" />
            <MetricCard label="Awaiting review" value={s.awaiting_review} hint="Total L1 and L2 queue" icon={Clock3} tone="bg-amber-50 text-amber-600" />
            <MetricCard label="L1 waiting approval" value={s.l1_waiting_approval} hint="Manual approval queue" icon={FileCheck2} tone="bg-sky-50 text-sky-600" />
            <MetricCard label="L2 waiting approval" value={s.l2_waiting_approval} hint="Awaiting final publish" icon={Rocket} tone="bg-violet-50 text-violet-600" />
          </div>
        </section>}

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800">Asset families</h2><p className="mb-4 mt-0.5 text-xs text-slate-400">Published assets grouped by the home dashboard families</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(report?.family_assets ?? []).map((family, index) => <div key={family.name} className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className={`mb-3 h-1.5 rounded-full ${FAMILY_TONES[index % FAMILY_TONES.length]}`} /><p className="truncate text-xs font-bold text-slate-700">{family.name}</p>
              <div className="mt-2 flex items-end justify-between"><span className="text-2xl font-extrabold text-slate-900">{family.asset_count}</span><span className="text-[10px] font-bold text-slate-400">{Math.round(family.percentage)}%</span></div>
            </div>)}
            {!report?.family_assets.length && <p className="col-span-full py-6 text-center text-xs text-slate-400">No published family data.</p>}
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800">Platform Adoption</h2><p className="mb-4 mt-0.5 text-xs text-slate-400">Observability for the selected {days}-day period</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              ['Active users', report?.engagement.active_users ?? 0, Users], ['Asset views', report?.engagement.catalog_views ?? 0, Eye],
              ['Demo views', report?.engagement.demo_views ?? 0, Activity], ['Downloads', report?.engagement.artifact_downloads ?? 0, Download],
              ['Clone requests', report?.engagement.clone_requests ?? 0, GitBranch],
              ['Demo requests', report?.engagement.demo_requests ?? 0, Activity],
            ].map(([label, value, Icon]) => { const UsageIcon = Icon as ElementType; return <div key={label as string} className="flex items-center gap-3 rounded-xl bg-slate-50 p-4"><div className="rounded-lg bg-indigo-50 p-2.5 text-indigo-600"><UsageIcon className="h-4 w-4" /></div><div><p className="text-xl font-extrabold text-slate-800">{Number(value).toLocaleString()}</p><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label as string}</p></div></div>; })}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-sm font-bold text-slate-800">Top events</h2><div className="space-y-4">{report?.top_events.map(event => { const EventIcon = EVENT_ICONS[event.key] ?? Activity; return <div key={event.key}><div className="mb-1.5 flex items-center justify-between text-xs"><span className="flex items-center gap-2 font-semibold text-slate-600"><EventIcon className="h-3.5 w-3.5 text-indigo-500" />{event.label}</span><span className="font-extrabold text-slate-800">{event.count.toLocaleString()}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${event.count * 100 / maxEvent}%` }} /></div></div>; })}</div></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-bold text-slate-800">Most trending assets</h2><p className="mb-4 text-xs text-slate-400">Top five by platform engagement</p><div className="space-y-2.5">{report?.trending_assets.map((asset, index) => <div key={asset.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">{index === 0 ? <Trophy className="h-4 w-4" /> : <span className="text-xs font-extrabold">{index + 1}</span>}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-700">{asset.title}</p><p className="truncate text-[10px] text-slate-400">{asset.family} · {asset.views} views · {asset.downloads} downloads</p></div><span className="text-xs font-extrabold text-indigo-600">{asset.engagement_score}</span></div>)}</div></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-bold text-slate-800">Most active users</h2><p className="mb-4 text-xs text-slate-400">Ranked by audited platform activity</p><div className="space-y-2.5">{report?.active_users.map((activeUser, index) => <div key={activeUser.user_id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-extrabold text-indigo-600">{index + 1}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-700">{activeUser.name}</p><p className="truncate text-[10px] text-slate-400">{activeUser.email}</p></div><div className="text-right"><p className="text-sm font-extrabold text-slate-800">{activeUser.events}</p><p className="text-[9px] uppercase text-slate-400">events</p></div></div>)}</div></div>
        </div>

        <div className="hidden">{s && <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="New submissions" value={s.new_submissions} hint={`${days}-day intake`} icon={Sparkles} tone="bg-sky-50 text-sky-600" />
            <MetricCard label="AI pass rate" value={s.ai_pass_rate} suffix="%" hint={`${s.ai_passed} passed · ${s.ai_failures} failures`} icon={CheckCircle2} tone="bg-violet-50 text-violet-600" />
            <MetricCard label="Approval rate" value={s.approval_rate} suffix="%" hint={`${s.approved} admin approvals`} icon={FileCheck2} tone="bg-emerald-50 text-emerald-600" />
            <MetricCard label="Published" value={s.published} hint={`${s.publication_rate}% of intake`} icon={Rocket} tone="bg-teal-50 text-teal-600" />
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Average AI score" value={s.average_ai_score} hint="Excludes technical failures" icon={Activity} tone="bg-indigo-50 text-indigo-600" />
            <MetricCard label="Pending approval" value={s.pending_approvals} hint={`Oldest: ${s.oldest_pending_hours}h`} icon={Clock3} tone="bg-amber-50 text-amber-600" />
            <MetricCard label="Awaiting publish" value={s.awaiting_publish} hint={`${s.on_hold} currently on hold`} icon={Rocket} tone="bg-orange-50 text-orange-600" />
            <MetricCard label="Review cycle" value={s.average_review_hours} suffix="h" hint="Average submit-to-review" icon={Clock3} tone="bg-slate-100 text-slate-600" />
          </div>
        </>}

        <div className="mb-6 grid gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-bold text-slate-800">Daily submission and publishing trend</h2><div className="flex gap-4 text-[10px] font-semibold"><span className="text-indigo-600">● Submitted</span><span className="text-emerald-600">● Published</span></div></div>
            {trend.points.length ? <svg viewBox={`0 0 ${trend.width} ${trend.height}`} className="h-56 w-full" role="img" aria-label="Daily reporting trend">
              {[0.25, 0.5, 0.75].map(v => <line key={v} x1="20" x2="680" y1={trend.height * v} y2={trend.height * v} stroke="#e2e8f0" strokeWidth="1" />)}
              <path d={trend.submittedPath} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d={trend.publishedPath} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg> : <p className="py-20 text-center text-xs text-slate-400">No trend data.</p>}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold text-slate-800">Current governance funnel</h2>
            <div className="space-y-3">
              {Object.entries(report?.status_funnel ?? {}).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
                const total = Math.max(1, Object.values(report?.status_funnel ?? {}).reduce((a, b) => a + b, 0));
                return <div key={status}><div className="mb-1 flex justify-between text-xs"><span className="text-slate-500">{STATUS_LABELS[status] ?? status}</span><span className="font-bold text-slate-700">{count}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${count * 100 / total}%` }} /></div></div>;
              })}
            </div>
          </div>
        </div></div>

        <div className="mb-6 grid gap-6 xl:grid-cols-2"><BreakdownTable title="Performance by department" rows={report?.departments ?? []} /><BreakdownTable title="Performance by platform family" rows={report?.families ?? []} /></div>

      </div>
    </div>
  );
}
