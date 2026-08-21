import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Check, ExternalLink, FileCode2, GitBranch,
  Layers, Pencil, Play, Trash2, X, Brain, ClipboardList, Info,
  CheckCircle2, XCircle, Clock, Rocket, Building2, Cloud,
  Calendar, Hash, Cpu, BookOpen, BarChart2, ChevronRight,
  Shield, Zap, Star, Download, MessageSquare, Send, Package, Terminal, RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { defaultFamilyBadge, useFamilies } from '../context/FamiliesContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { DemoVideoModal } from '../components/media/DemoVideoModal';
import { getSubmission, deleteSubmission, publishSubmission, retrySubmissionAIScore, type Submission } from '../lib/submissionService';
import { approveSubmission, rejectSubmission, finalRejectSubmission, holdSubmission } from '../lib/adminService';
import { getComments, addComment, type SubmissionComment } from '../lib/commentService';

// ── types ──────────────────────────────────────────────────────────────────────
type CheckStatus = 'pass' | 'warn' | 'fail';
interface CheckItem { label: string; status: CheckStatus; note: string }
type TabId = 'overview' | 'artifacts' | 'ai' | 'comments';

// ── helpers ───────────────────────────────────────────────────────────────────
function buildChecklist(sub: Submission): CheckItem[] {
  const descLen  = (sub.description ?? '').trim().length;
  const hasTech  = (sub.tech_stack ?? []).length > 0;
  const hasCloud = !!sub.cloud_provider;
  const hasDemo  = sub.demo_ready || !!sub.video_url;
  const goodMat  = ['Production', 'Battle-Tested'].includes(sub.maturity ?? '');
  return [
    { label: 'Security',      status: hasTech  ? 'warn' : 'fail', note: hasTech  ? 'Confirm input sanitization & secret handling.' : 'No tech stack declared — security posture unknown.' },
    { label: 'Documentation', status: descLen >= 120 ? 'pass' : descLen >= 50 ? 'warn' : 'fail', note: descLen >= 120 ? 'Description is comprehensive.' : 'Description is too brief — add setup, use-cases, or architecture notes.' },
    { label: 'Testing',       status: hasDemo  ? 'pass' : 'warn', note: hasDemo  ? 'Demo evidence attached.' : 'Attach eval results or smoke-test evidence.' },
    { label: 'Cloud',         status: hasCloud ? 'pass' : 'warn', note: hasCloud ? `Declared: ${sub.cloud_provider}.` : 'No cloud provider declared.' },
    { label: 'Compliance',    status: goodMat  ? 'warn' : 'warn', note: 'Audit logging & ownership need manual confirmation.' },
  ];
}

const AGENT_CONFIG: Record<string, { label: string; weight: number; icon: string; desc: string }> = {
  relevance:       { label: 'Relevance',       weight: 25, icon: '🎯', desc: 'Business value, market alignment, reusability across InfoVision service lines' },
  tech_quality:    { label: 'Tech Quality',    weight: 30, icon: '⚙️', desc: 'Architecture soundness, security, cloud-native patterns, scalability' },
  description:     { label: 'Description',     weight: 15, icon: '📝', desc: 'Clarity, completeness, discoverability for engineers' },
  demo_readiness:  { label: 'Demo Readiness',  weight: 20, icon: '🎬', desc: 'Client-presentable, demo video present, maturity level, setup complexity' },
  duplicate_check: { label: 'Duplicate Check', weight: 10, icon: '🔍', desc: 'Novelty vs existing catalog — penalises near-duplicates' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  Submitted:       { label: 'Submitted',           color: '#0EA5E9', bg: '#E0F2FE' },
  AI_Review:       { label: 'AI Review',            color: '#8B5CF6', bg: '#EDE9FE' },
  Manual_Approval: { label: 'Pending Review',       color: '#F59E0B', bg: '#FEF3C7' },
  Needs_Changes:   { label: 'Needs Changes',        color: '#EF4444', bg: '#FEE2E2' },
  Approved:        { label: 'Approved',             color: '#10B981', bg: '#D1FAE5' },
  Rejected:        { label: 'Rejected',             color: '#DC2626', bg: '#FEE2E2' },
  On_Hold:         { label: 'On Hold',              color: '#F59E0B', bg: '#FEF3C7' },
  Published:       { label: 'Published',            color: '#059669', bg: '#ECFDF5' },
  Archived:        { label: 'Removed from Catalog', color: '#6B7280', bg: '#F3F4F6' },
};

const MATURITY_STYLE: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  Experimental:    { label: 'Experimental',  color: '#F59E0B', bg: '#FEF3C7', icon: Zap },
  'Battle-Tested': { label: 'Battle-Tested', color: '#0EA5E9', bg: '#E0F2FE', icon: Shield },
  Production:      { label: 'Production',    color: '#10B981', bg: '#D1FAE5', icon: CheckCircle2 },
  experimental:    { label: 'Experimental',  color: '#F59E0B', bg: '#FEF3C7', icon: Zap },
  'battle-tested': { label: 'Battle-Tested', color: '#0EA5E9', bg: '#E0F2FE', icon: Shield },
  validated:       { label: 'Production',    color: '#10B981', bg: '#D1FAE5', icon: CheckCircle2 },
  Beta:            { label: 'Battle-Tested', color: '#0EA5E9', bg: '#E0F2FE', icon: Shield },
  Prototype:       { label: 'Experimental',  color: '#F59E0B', bg: '#FEF3C7', icon: Zap },
};

// ── Workflow progress tracker ─────────────────────────────────────────────────
const WORKFLOW_STEPS = [
  { key: 'Submitted',       label: 'Submitted'   },
  { key: 'AI_Review',       label: 'AI Review'   },
  { key: 'Manual_Approval', label: 'Admin Review' },
  { key: 'Approved',        label: 'Approved'    },
  { key: 'Published',       label: 'Published'   },
] as const;

function WorkflowTracker({ status }: { status: string }) {
  const isNeedsChanges = status === 'Needs_Changes';
  const isRejected     = status === 'Rejected';
  const isOnHold       = status === 'On_Hold';
  const isTerminal     = isRejected;
  const effectiveKey   = (isNeedsChanges || isOnHold) ? 'Manual_Approval'
                       : isRejected                   ? 'Manual_Approval'
                       : status;
  const keys         = WORKFLOW_STEPS.map((s) => s.key);
  const currentIndex = keys.indexOf(effectiveKey as typeof keys[number]);

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-8 py-4 border-t border-gray-100 bg-white">
      <div className="flex items-start">
        {WORKFLOW_STEPS.map((step, i) => {
          const isFirst   = i === 0;
          const isLast    = i === WORKFLOW_STEPS.length - 1;
          const isDone    = !isTerminal && i < currentIndex;
          const isCurrent = i === currentIndex;

          const dotClass = isRejected && isCurrent     ? 'border-red-500 bg-red-100 ring-2 ring-red-200'
                         : isOnHold && isCurrent        ? 'border-amber-400 bg-amber-100 ring-2 ring-amber-200'
                         : isNeedsChanges && isCurrent  ? 'border-rose-400 bg-rose-100 ring-2 ring-rose-200'
                         : isDone                       ? 'border-emerald-400 bg-emerald-400'
                         : isCurrent                    ? 'border-sky-500 bg-sky-500 ring-2 ring-sky-200'
                         :                               'border-gray-200 bg-white';

          const labelClass = isRejected && isCurrent     ? 'text-red-600 font-semibold'
                           : isOnHold && isCurrent       ? 'text-amber-600 font-semibold'
                           : isNeedsChanges && isCurrent ? 'text-rose-500 font-semibold'
                           : isDone                      ? 'text-emerald-600 font-medium'
                           : isCurrent                   ? 'text-sky-700 font-semibold'
                           :                               'text-gray-300';

          const leftLine  = !isFirst && (isDone || i <= currentIndex) && !isTerminal ? 'bg-emerald-300' : 'bg-gray-200';
          const rightLine = !isLast  && i < currentIndex && !isTerminal              ? 'bg-emerald-300' : 'bg-gray-200';

          return (
            <div key={step.key} className="flex flex-1 flex-col items-center">
              {/* connector + dot row */}
              <div className="flex w-full items-center">
                <div className={`h-0.5 flex-1 ${isFirst ? 'invisible' : leftLine}`} />
                <div className={`h-4 w-4 shrink-0 rounded-full border-2 ${dotClass}${step.key === 'AI_Review' && status === 'AI_Review' ? ' animate-pulse' : ''}`} />
                <div className={`h-0.5 flex-1 ${isLast ? 'invisible' : rightLine}`} />
              </div>
              {/* label */}
              <span className={`mt-1.5 px-1 text-[10px] leading-tight text-center ${labelClass}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Status badge */}
      <div className="mt-2 flex gap-2">
        {isNeedsChanges && (
          <div className="flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1">
            <AlertTriangle className="h-3 w-3 text-rose-400" />
            <span className="text-[10px] font-bold text-rose-500">Needs Changes</span>
          </div>
        )}
        {isRejected && (
          <div className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1">
            <XCircle className="h-3 w-3 text-red-500" />
            <span className="text-[10px] font-bold text-red-600">Rejected</span>
          </div>
        )}
        {isOnHold && (
          <div className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1">
            <Clock className="h-3 w-3 text-amber-500" />
            <span className="text-[10px] font-bold text-amber-600">On Hold</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── small components ──────────────────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, backgroundColor: color }} />
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700">
      {children}
    </span>
  );
}

function MetaItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-gray-50 py-2.5 last:border-0">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-50">
        <Icon className="h-3 w-3 text-gray-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
        <p className="mt-0.5 text-xs font-medium text-gray-800 break-words">{value}</p>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── main component ────────────────────────────────────────────────────────────
export function PipelineDetail() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { user }     = useAuth();
  const { families } = useFamilies();

  const [submission,        setSubmission]        = useState<Submission | null>(null);
  const [isLoading,         setIsLoading]         = useState(true);
  const [activeTab,         setActiveTab]         = useState<TabId>('overview');
  const [demoVideoOpen,     setDemoVideoOpen]     = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting,        setIsDeleting]        = useState(false);
  const [deleteError,       setDeleteError]       = useState('');
  const [rejectionNotes,    setRejectionNotes]    = useState('');
  const [holdNotes,         setHoldNotes]         = useState('');
  const [actionLoading,     setActionLoading]     = useState<'approve' | 'reject' | 'final-reject' | 'hold' | 'publish' | 'rescore' | null>(null);
  const [actionError,       setActionError]       = useState('');
  const [decisionBanner,    setDecisionBanner]    = useState<{ type: 'approved' | 'rejected' | 'final-rejected' | 'on-hold' | 'published'; title: string } | null>(null);
  const [comments,          setComments]          = useState<SubmissionComment[]>([]);
  const [commentDraft,      setCommentDraft]      = useState('');
  const [commentSending,    setCommentSending]    = useState(false);

  const role    = user?.role ?? 'guest';
  const isOwner = role === 'Aimplify.Owner';
  const isAdmin = role === 'Aimplify.Admin' || role === 'Aimplify.Owner';
  const pollingStatus = submission?.status;
  const pollingScore = submission?.ai_score;

  useEffect(() => { window.scrollTo(0, 0); }, [id]);

  useEffect(() => {
    if (!id) { setIsLoading(false); return; }
    let cancelled = false;
    getSubmission(id)
      .then(item => { if (!cancelled) { setSubmission(item); setIsLoading(false); } })
      .catch(()  => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!id || pollingScore !== null) return;
    if (!pollingStatus || !['Submitted', 'Approved', 'Published'].includes(pollingStatus)) return;
    const poll = window.setInterval(() => {
      getSubmission(id)
        .then(item => {
          setSubmission(item);
          if (item.ai_score !== null || item.status !== 'Submitted') window.clearInterval(poll);
        })
        .catch(() => {});
    }, 4000);
    return () => window.clearInterval(poll);
  }, [id, pollingStatus, pollingScore]);

  // Load comments when the comments tab is activated
  useEffect(() => {
    if (activeTab !== 'comments' || !id) return;
    getComments(id).then(setComments).catch(() => {});
  }, [activeTab, id]);

  const handleSendComment = async () => {
    if (!commentDraft.trim() || !id) return;
    setCommentSending(true);
    try {
      const c = await addComment(id, commentDraft.trim());
      setComments(prev => [...prev, c]);
      setCommentDraft('');
    } catch { /* ignore */ }
    finally { setCommentSending(false); }
  };

  if (isLoading) return <div className="py-24 text-center text-sm font-medium text-gray-400">Loading submission…</div>;
  if (!submission) return (
    <div className="flex flex-col items-center justify-center py-24">
      <h2 className="text-xl font-bold text-gray-900">Submission not found</h2>
      <Button className="mt-4" onClick={() => navigate('/pipeline')}>Back to Pipeline</Button>
    </div>
  );

  const status         = STATUS_CONFIG[submission.status] ?? STATUS_CONFIG['Submitted'];
  const family         = families[submission.family]      ?? defaultFamilyBadge();
  const isMySubmission = user?.id === submission.submitter_id;
  const canDelete      = submission.status === 'Submitted' || submission.status === 'Needs_Changes';
  const canAdminAct    = isAdmin && (submission.status === 'Manual_Approval' || submission.status === 'On_Hold');
  const canOwnerPublish = isOwner && (submission.status === 'Approved' || submission.status === 'On_Hold');

  const aiFeedback    = submission.ai_feedback as Record<string, unknown> | null;
  const agentScores   = aiFeedback?.agent_scores   as Record<string, number>                            | undefined;
  const agentFeedback = aiFeedback?.agent_feedback as Record<string, Record<string, unknown>>           | undefined;
  const llmChecklist  = aiFeedback?.checklist      as Record<string, { status: string; note: string }>  | undefined;
  const aiSummary     = aiFeedback?.summary        as string | undefined;
  const hasAI         = submission.ai_score !== null && submission.ai_score !== undefined;
  const aiScore       = hasAI ? Math.round(submission.ai_score as number) : null;

  const checklist: CheckItem[] = llmChecklist
    ? Object.entries(llmChecklist).map(([k, v]) => ({
        label:  k.charAt(0).toUpperCase() + k.slice(1),
        status: (['pass','warn','fail'].includes(v.status) ? v.status : 'warn') as CheckStatus,
        note:   v.note,
      }))
    : buildChecklist(submission);

  const weightedContributions = agentScores
    ? Object.fromEntries(Object.entries(agentScores).map(([k, v]) => [k, ((AGENT_CONFIG[k]?.weight ?? 0) * v) / 100]))
    : {};

  const videoUrls    = [...new Set(submission.video_urls ?? [])];
  const hasVideo     = videoUrls.length > 0;
  const hasRepo      = !!submission.repo_url;
  const hasTechStack = (submission.tech_stack ?? []).length > 0;
  const maturity     = MATURITY_STYLE[submission.maturity ?? ''];
  const MaturityIcon = maturity?.icon ?? Shield;

  const TABS: { id: TabId; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview',  label: 'Overview',         icon: <BookOpen  className="h-3.5 w-3.5" /> },
    { id: 'artifacts', label: 'Artifacts & Media', icon: <FileCode2 className="h-3.5 w-3.5" /> },
    { id: 'ai',        label: 'AI Evaluation',     icon: <BarChart2 className="h-3.5 w-3.5" /> },
    { id: 'comments',  label: 'Comments',          icon: <MessageSquare className="h-3.5 w-3.5" />, badge: comments.length || undefined },
  ];

  const handleApprove = async () => {
    if (!id || !submission) return;
    setActionLoading('approve'); setActionError('');
    try {
      const updated = await approveSubmission(id);
      setSubmission(s => s ? { ...s, status: updated.status } : s);
      setDecisionBanner({ type: 'approved', title: submission.title });
      // Post approval as a comment so all admins/owners can see it
      try { const c = await addComment(id, `✅ Approved (L1) — moved to Owner publish queue.`); setComments(prev => [...prev, c]); } catch {}
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Approve failed.');
    } finally { setActionLoading(null); }
  };

  const handleReject = async () => {
    if (!id || !submission) return;
    if (!rejectionNotes.trim()) { setActionError('Rejection notes are required.'); return; }
    setActionLoading('reject'); setActionError('');
    try {
      const updated = await rejectSubmission(id, rejectionNotes);
      setSubmission(s => s ? { ...s, status: updated.status, admin_notes: rejectionNotes } : s);
      setDecisionBanner({ type: 'rejected', title: submission.title });
      // Post decision note as a comment so all admins/owners can see it
      try { const c = await addComment(id, `↩ Returned for changes:\n${rejectionNotes}`); setComments(prev => [...prev, c]); } catch {}
      setRejectionNotes('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Reject failed.');
    } finally { setActionLoading(null); }
  };

  const handleFinalReject = async () => {
    if (!id || !submission) return;
    if (!rejectionNotes.trim()) { setActionError('Reason is required for final rejection.'); return; }
    setActionLoading('final-reject'); setActionError('');
    try {
      const updated = await finalRejectSubmission(id, rejectionNotes);
      setSubmission(s => s ? { ...s, status: updated.status, admin_notes: rejectionNotes } : s);
      setDecisionBanner({ type: 'final-rejected', title: submission.title });
      // Post decision note as a comment so all admins/owners can see it
      try { const c = await addComment(id, `❌ Final rejection:\n${rejectionNotes}`); setComments(prev => [...prev, c]); } catch {}
      setRejectionNotes('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Final reject failed.');
    } finally { setActionLoading(null); }
  };

  const handleHold = async () => {
    if (!id || !submission) return;
    setActionLoading('hold'); setActionError('');
    try {
      const updated = await holdSubmission(id, holdNotes.trim() || undefined);
      setSubmission(s => s ? { ...s, status: updated.status } : s);
      setDecisionBanner({ type: 'on-hold', title: submission.title });
      // Post hold note as a comment so all admins/owners can see it
      if (holdNotes.trim()) {
        try { const c = await addComment(id, `⏸ Placed on hold:\n${holdNotes.trim()}`); setComments(prev => [...prev, c]); } catch {}
      }
      setHoldNotes('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Hold failed.');
    } finally { setActionLoading(null); }
  };

  const handlePublish = async () => {
    if (!id || !submission) return;
    setActionLoading('publish'); setActionError('');
    try {
      const updated = await publishSubmission(id);
      setSubmission(s => s ? { ...s, status: updated.status } : s);
      setDecisionBanner({ type: 'published', title: submission.title });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Publish failed.');
    } finally { setActionLoading(null); }
  };

  const handleAIScoreRetry = async () => {
    if (!id || !submission || submission.ai_score !== 0 || !isAdmin) return;
    setActionLoading('rescore'); setActionError('');
    try {
      const updated = await retrySubmissionAIScore(id);
      setSubmission(updated);
      setActiveTab('ai');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'AI score retry failed.');
    } finally { setActionLoading(null); }
  };

  const performDelete = async () => {
    if (!id) return;
    setDeleteError(''); setIsDeleting(true);
    try { await deleteSubmission(id); navigate('/pipeline'); }
    catch (err) { setDeleteError(err instanceof Error ? err.message : 'Delete failed.'); setDeleteConfirmOpen(false); }
    finally { setIsDeleting(false); }
  };

  return (
    <>
      <div className="animate-in fade-in duration-500 min-h-screen bg-gray-50/50 pb-16">

        {/* ── Sticky header ─────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur-sm shadow-sm">
          <div className="relative mx-auto max-w-7xl px-4 md:px-8">

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 py-2.5 text-xs">
              <button onClick={() => navigate('/pipeline')}
                className="font-medium text-sky-500 hover:text-sky-600 transition-colors">
                Assets Pipeline
              </button>
              <ChevronRight className="h-3 w-3 text-gray-300" />
              <span className="truncate max-w-xs font-medium text-gray-600">{submission.title}</span>
            </div>

            {/* Badge row */}
            <div className="flex flex-wrap items-center gap-2 pb-2">
              <span className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                style={{ backgroundColor: `${family.color}18`, color: family.color }}>
                <Layers className="h-3 w-3" />{family.name}
              </span>
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                style={{ backgroundColor: status.bg, color: status.color }}>
                {status.label}
              </span>
              {maturity && (
                <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                  style={{ backgroundColor: maturity.bg, color: maturity.color }}>
                  <MaturityIcon className="h-3 w-3" />{maturity.label}
                </span>
              )}
              {submission.catalog_code && (
                <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-[10px] font-medium text-gray-500">
                  {submission.catalog_code}
                </span>
              )}
              {aiScore !== null && (
                <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${aiScore >= 70 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  <Star className="h-3 w-3" />AI Score: {aiScore}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="pb-3 text-xl font-bold tracking-tight text-gray-900 md:text-2xl leading-tight">
              {submission.title}
            </h1>

            {/* Action buttons */}
            {canDelete && (
              <div className="flex flex-wrap items-center gap-2 pb-3">
                <button onClick={() => navigate(`/submit?revision=${submission.id}`)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                  <Pencil className="h-3.5 w-3.5" />Edit Submission
                </button>
                <button onClick={() => setDeleteConfirmOpen(true)} disabled={isDeleting}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />Delete
                </button>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-0">
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                    activeTab === tab.id
                      ? 'border-violet-500 text-violet-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}>
                  {tab.icon}{tab.label}
                  {tab.badge != null && (
                    <span className="ml-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-600">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Workflow tracker */}
          {isMySubmission && submission.status !== 'Archived' && (
            <WorkflowTracker status={submission.status} />
          )}

          {/* Archived notice */}
          {submission.status === 'Archived' && (
            <div className="mx-auto max-w-7xl px-4 md:px-8 py-3">
              <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
                <div>
                  <p className="text-sm font-bold text-gray-700">This asset has been removed from the catalog</p>
                  <p className="mt-0.5 text-xs text-gray-400">The owner removed this asset. Your submission record is retained for reference.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Two-column layout ─────────────────────────────────────────── */}
        <div className="mx-auto max-w-7xl px-4 pt-6 md:px-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">

            {/* ── Main content ─────────────────────────────────────────── */}
            <div className="min-w-0 space-y-5">

              {/* ── OVERVIEW TAB ── */}
              {activeTab === 'overview' && (
                <>
                  {/* Description */}
                  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                      <BookOpen className="h-3.5 w-3.5" />About this asset
                    </h2>
                    <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">
                      {submission.description || <span className="italic text-gray-400">No description provided.</span>}
                    </p>
                  </div>

                  {/* Tech Stack */}
                  {hasTechStack && (
                    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                      <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                        <Cpu className="h-3.5 w-3.5" />Tech Stack
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {submission.tech_stack.map(t => <Tag key={t}>{t}</Tag>)}
                      </div>
                    </div>
                  )}

                  {/* Reviewer notes */}
                  {submission.admin_notes && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-800">
                        <ClipboardList className="h-4 w-4" />Reviewer Notes
                      </h3>
                      <p className="text-sm leading-relaxed text-amber-900">{submission.admin_notes}</p>
                    </div>
                  )}
                </>
              )}

              {/* ── ARTIFACTS & MEDIA TAB ── */}
              {activeTab === 'artifacts' && (() => {
                const archRaw = submission.architecture_file_url ?? '';

                // Parse architecture_file_url — may be a JSON object with 4 slots or a legacy single URL
                const DOC_SLOTS: { key: string; label: string }[] = [
                  { key: 'overall_architecture', label: 'Overall Architecture' },
                  { key: 'sales_pitch',           label: 'Sales Pitch Doc' },
                  { key: 'marketing_collateral',  label: 'Marketing Collateral' },
                  { key: 'technical_delivery',    label: 'Technical Delivery Doc' },
                ];
                const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']);
                const docIcon: Record<string, string> = { pdf: '📄', doc: '📝', docx: '📝', xlsx: '📊', xls: '📊', pptx: '📊', ppt: '📊' };

                function friendlyName(url: string): string {
                  const raw = decodeURIComponent(url.split('?')[0].split('/').pop() ?? 'Document');
                  // Strip Azure blob naming prefix: users_{uuid}_document_{hash}_ or bare {32hex}_
                  return raw
                    .replace(/^users_[0-9a-f-]+_\w+_[0-9a-f]{32}_/i, '')
                    .replace(/^[0-9a-f]{32}_/i, '');
                }

                function renderDocSlot(url: string, label: string) {
                  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
                  const isImg = IMAGE_EXTS.has(ext);
                  const icon = isImg ? '🖼️' : (docIcon[ext] ?? '📎');
                  const name = friendlyName(url);
                  return (
                    <div key={label} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-sm border border-gray-100">
                        {icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-0.5">{label}</p>
                        <p className="truncate text-sm font-semibold text-gray-800">{name}</p>
                        {ext && <p className="mt-0.5 text-xs font-medium text-gray-400 uppercase">{ext}</p>}
                      </div>
                      <a href={url} target="_blank" rel="noreferrer" download={isImg ? undefined : name}
                        className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition-colors shadow-sm">
                        <Download className="h-4 w-4" />Download
                      </a>
                    </div>
                  );
                }

                // Try JSON parse first; fall back to legacy single URL
                let docSlots: { label: string; url: string }[] = [];
                try {
                  const parsed = archRaw ? JSON.parse(archRaw) : null;
                  if (parsed && typeof parsed === 'object') {
                    DOC_SLOTS.forEach(({ key, label }) => {
                      if (parsed[key]) docSlots.push({ label, url: parsed[key] });
                    });
                  }
                } catch {
                  // legacy single URL
                  if (archRaw && !archRaw.startsWith('{')) docSlots = [{ label: 'Architecture Document', url: archRaw }];
                }

                return (
                  <>
                    {/* 1 ── Architecture & Documents */}
                    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                      <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                        <FileCode2 className="h-3.5 w-3.5" />Architecture &amp; Documents
                      </h2>
                      {docSlots.length > 0 ? (
                        <div className="space-y-3">
                          {docSlots.map(({ label, url }) => renderDocSlot(url, label))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-10 text-center">
                          <FileCode2 className="mx-auto h-8 w-8 text-gray-300" />
                          <p className="mt-2 text-sm font-medium text-gray-400">No documents uploaded</p>
                        </div>
                      )}
                    </div>

                    {/* 2 ── Demo Video */}
                    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                      <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                        <Play className="h-3.5 w-3.5" />Demo Videos ({videoUrls.length})
                      </h2>
                      {hasVideo ? (
                        <div className="grid gap-5 lg:grid-cols-2">
                          {videoUrls.map((videoUrl, index) => {
                            const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
                            const isVimeo = videoUrl.includes('vimeo.com');
                            return <div key={`${videoUrl}-${index}`} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                              <p className="mb-2 text-xs font-bold text-gray-500">{index === 0 ? 'Primary demo' : `Demo ${index + 1}`}</p>
                              <div className="overflow-hidden rounded-xl border border-gray-100">
                              {isYouTube ? (
                              <iframe
                                className="w-full aspect-video"
                                src={videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/')}
                                title={`Demo video ${index + 1}`}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            ) : isVimeo ? (
                              <iframe
                                className="w-full aspect-video"
                                src={videoUrl.replace('vimeo.com/', 'player.vimeo.com/video/')}
                                title="Demo video"
                                allow="autoplay; fullscreen; picture-in-picture"
                                allowFullScreen
                              />
                            ) : (
                              <video controls preload="metadata" playsInline
                                className="w-full aspect-video rounded-xl bg-black"
                                src={videoUrl}
                                onError={(e) => {
                                  const el = e.currentTarget;
                                  el.style.display = 'none';
                                  el.nextElementSibling?.classList.remove('hidden');
                                }} />
                            )}
                              </div>
                              {!isYouTube && !isVimeo && (
                            <div className="hidden mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                              Video could not be played inline.{' '}
                              <a href={videoUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
                                Open in new tab
                              </a>
                            </div>
                              )}
                              <a href={videoUrl} target="_blank" rel="noreferrer"
                            className="mt-3 flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700">
                            <ExternalLink className="h-3.5 w-3.5" />Open video in new tab
                              </a>
                            </div>;
                          })}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-10 text-center">
                          <Play className="mx-auto h-8 w-8 text-gray-300" />
                          <p className="mt-2 text-sm font-medium text-gray-400">No demo video submitted</p>
                        </div>
                      )}
                    </div>

                    {/* 3 ── Repository */}
                    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                      <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                        <GitBranch className="h-3.5 w-3.5" />Repository
                      </h2>
                      {hasRepo ? (
                        <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                          <GitBranch className="h-5 w-5 shrink-0 text-gray-400" />
                          <a href={submission.repo_url!} target="_blank" rel="noreferrer"
                            className="flex-1 break-all text-sm font-medium text-sky-600 hover:text-sky-700">
                            {submission.repo_url}
                          </a>
                          <ExternalLink className="h-4 w-4 shrink-0 text-sky-400" />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-10 text-center">
                          <GitBranch className="mx-auto h-8 w-8 text-gray-300" />
                          <p className="mt-2 text-sm font-medium text-gray-400">No repository URL submitted</p>
                        </div>
                      )}
                    </div>

                    {/* 4 ── Tech Stack */}
                    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                      <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                        <Cpu className="h-3.5 w-3.5" />Tech Stack
                      </h2>
                      {hasTechStack ? (
                        <div className="flex flex-wrap gap-2">
                          {submission.tech_stack.map(t => <Tag key={t}>{t}</Tag>)}
                        </div>
                      ) : (
                        <p className="text-sm italic text-gray-400">No tech stack declared.</p>
                      )}
                    </div>

                    {/* 5 ── Dependencies */}
                    {submission.dependencies && (
                      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                          <Package className="h-3.5 w-3.5" />Dependencies / Prerequisites
                        </h2>
                        <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">{submission.dependencies}</p>
                      </div>
                    )}

                    {/* 6 ── Setup Commands */}
                    {Array.isArray(submission.commands) && submission.commands.length > 0 && (
                      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                          <Terminal className="h-3.5 w-3.5" />Setup &amp; Run Commands
                        </h2>
                        <div className="space-y-2">
                          {submission.commands.map((cmd, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-gray-950 px-4 py-3">
                              <span className="font-mono text-sm text-emerald-400">
                                <span className="mr-2 text-gray-500">$</span>{cmd}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* ── AI EVALUATION TAB ── */}
              {activeTab === 'ai' && (
                <>
                  {!hasAI ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-12 text-center">
                      <Brain className={`mx-auto mb-3 h-10 w-10 text-gray-300 ${submission.status === 'Submitted' ? 'animate-pulse' : ''}`} />
                      <p className="text-sm font-medium text-gray-400">
                        {submission.status === 'Submitted' ? 'AI evaluation is running…' : 'AI evaluation has not run yet.'}
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Score hero */}
                      <div className={`rounded-xl border-2 p-6 shadow-sm ${(aiScore ?? 0) >= 70 ? 'border-emerald-200 bg-emerald-50' : (aiScore ?? 0) >= 50 ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50'}`}>
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <div className={`text-5xl font-bold tabular-nums ${(aiScore ?? 0) >= 70 ? 'text-emerald-600' : (aiScore ?? 0) >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                              {aiScore}
                            </div>
                            <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-gray-400">/ 100</div>
                          </div>
                          <div className="flex-1">
                            <p className={`mb-2 text-sm font-bold ${(aiScore ?? 0) >= 70 ? 'text-emerald-800' : (aiScore ?? 0) >= 50 ? 'text-amber-800' : 'text-rose-800'}`}>
                              {(aiScore ?? 0) >= 70 ? 'Strong Quality Score' : (aiScore ?? 0) >= 50 ? 'Moderate Quality Score' : 'Needs Improvement'}
                            </p>
                            <ScoreBar score={aiScore ?? 0} />
                            {aiSummary && (
                              <p className="mt-2 text-xs leading-relaxed text-gray-600">{aiSummary}</p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-4">
                              {[
                                { label: 'Forwarded to admin', range: '≥ 60', dot: 'bg-emerald-400', text: 'text-emerald-700' },
                                { label: 'Needs improvements', range: '< 60', dot: 'bg-rose-400',    text: 'text-rose-700'   },
                              ].map(t => (
                                <div key={t.label} className="flex items-center gap-1.5 text-xs">
                                  <span className={`h-2.5 w-2.5 rounded-full ${t.dot}`} />
                                  <span className="font-bold text-gray-600">{t.range}</span>
                                  <span className={`font-medium ${t.text}`}>{t.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        {isAdmin && aiScore === 0 && (
                          <div className="mt-5 border-t border-rose-200 pt-4">
                            <p className="mb-3 text-xs font-medium text-rose-700">
                              The AI evaluation failed. Admins and owners can retry the scoring flow.
                            </p>
                            {actionError && (
                              <p className="mb-3 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-700">{actionError}</p>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 border-rose-300 bg-white text-rose-700 hover:bg-rose-100"
                              disabled={actionLoading !== null}
                              onClick={() => void handleAIScoreRetry()}
                            >
                              <RotateCcw className={`h-3.5 w-3.5 ${actionLoading === 'rescore' ? 'animate-spin' : ''}`} />
                              {actionLoading === 'rescore' ? 'Retrying AI score…' : 'Retry AI score'}
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Per-agent breakdown */}
                      {agentScores && (
                        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                          <div className="border-b border-gray-100 px-6 py-4">
                            <h3 className="text-sm font-bold text-gray-800">Agent Breakdown</h3>
                            <p className="mt-0.5 text-xs text-gray-400">Each agent score contributes its weighted % to the composite</p>
                          </div>
                          <div className="divide-y divide-gray-50">
                            {Object.entries(AGENT_CONFIG).map(([key, cfg]) => {
                              const score        = agentScores[key] ?? 0;
                              const contrib      = weightedContributions[key] ?? 0;
                              const fb           = agentFeedback?.[key];
                              const feedbackText = fb?.feedback as string | undefined;
                              const details      = fb?.details as Record<string, unknown> | undefined;
                              const scoreColor   = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444';
                              return (
                                <div key={key} className="px-6 py-5">
                                  <div className="flex items-start gap-4">
                                    <span className="mt-0.5 text-xl shrink-0">{cfg.icon}</span>
                                    <div className="flex-1 min-w-0">
                                      <div className="mb-1 flex items-center justify-between gap-2">
                                        <div>
                                          <span className="text-sm font-bold text-gray-900">{cfg.label}</span>
                                          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">weight {cfg.weight}%</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <span className="text-[11px] text-gray-400 tabular-nums">+{contrib.toFixed(1)} pts</span>
                                          <span className="text-lg font-bold tabular-nums" style={{ color: scoreColor }}>{score}</span>
                                          <span className="text-xs text-gray-400">/100</span>
                                        </div>
                                      </div>
                                      <ScoreBar score={score} />
                                      <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400">{cfg.desc}</p>
                                      {feedbackText && (
                                        <p className="mt-2 text-sm leading-relaxed text-gray-700 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                                          {feedbackText}
                                        </p>
                                      )}
                                      {details && Object.keys(details).length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                          {Object.entries(details).map(([dk, dv]) => {
                                            if (Array.isArray(dv) && dv.length > 0)
                                              return dv.map(item => (
                                                <span key={String(item)} className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-600">{String(item)}</span>
                                              ));
                                            if (typeof dv === 'boolean' || (typeof dv === 'number' && dk !== 'novelty_score'))
                                              return <span key={dk} className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-500">{dk.replace(/_/g,' ')}: {String(dv)}</span>;
                                            return null;
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Pre-approval checklist */}
                      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                          <div>
                            <h3 className="text-sm font-bold text-gray-800">Pre-Approval Checklist</h3>
                            <p className="mt-0.5 text-xs text-gray-400">
                              {llmChecklist ? '🤖 LLM-evaluated' : '⚙️ Auto-derived'} — verify ⚠️ items before approving
                            </p>
                          </div>
                          {(() => {
                            const passes = checklist.filter(c => c.status === 'pass').length;
                            return (
                              <span className={`rounded-full px-3 py-1 text-xs font-bold ${passes === checklist.length ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                {passes}/{checklist.length} passed
                              </span>
                            );
                          })()}
                        </div>
                        <div className="divide-y divide-gray-50 px-6">
                          {checklist.map(item => (
                            <div key={item.label} className="flex items-start gap-3 py-4">
                              <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                                item.status === 'pass' ? 'bg-emerald-100 text-emerald-600' :
                                item.status === 'warn' ? 'bg-amber-100 text-amber-600' :
                                'bg-rose-100 text-rose-600'
                              }`}>
                                {item.status === 'pass' ? <Check className="h-3.5 w-3.5" /> :
                                 item.status === 'warn' ? <AlertTriangle className="h-3.5 w-3.5" /> :
                                                          <X className="h-3.5 w-3.5" />}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                                <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{item.note}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ── Comments tab ── */}
              {activeTab === 'comments' && (
                <div className="flex flex-col gap-4">
                  <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-2.5 text-xs text-amber-700 font-medium flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 shrink-0" />
                    Visible to all Admins, Owners, and the submitter. Approval decisions are auto-posted here.
                  </div>

                  {/* Thread */}
                  <div className="flex flex-col gap-3">
                    {comments.length === 0 && (
                      <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center">
                        <MessageSquare className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                        <p className="text-sm text-gray-400">No comments yet. Start the conversation below.</p>
                      </div>
                    )}
                    {comments.map(c => {
                      const isMe = c.author_id === user?.id;
                      return (
                        <div key={c.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${isMe ? 'bg-violet-500' : 'bg-sky-500'}`}>
                            {(c.author_name || c.author_email).slice(0, 2).toUpperCase()}
                          </div>
                          <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                            <div className={`flex items-center gap-2 text-[10px] text-gray-400 ${isMe ? 'flex-row-reverse' : ''}`}>
                              <span className="font-semibold text-gray-600">{c.author_name || c.author_email}</span>
                              <span>{new Date(c.created_at).toLocaleString()}</span>
                            </div>
                            <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isMe ? 'rounded-tr-sm bg-violet-500 text-white' : 'rounded-tl-sm bg-gray-100 text-gray-800'}`}>
                              {c.body}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Compose */}
                  <div className="flex gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100 transition-all">
                    <textarea
                      value={commentDraft}
                      onChange={e => setCommentDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void handleSendComment(); } }}
                      rows={2}
                      placeholder="Write a comment… (Ctrl+Enter to send)"
                      className="flex-1 resize-none border-0 bg-transparent px-2 py-1 text-sm text-gray-800 outline-none placeholder:text-gray-400"
                    />
                    <button
                      onClick={() => void handleSendComment()}
                      disabled={!commentDraft.trim() || commentSending}
                      className="self-end rounded-lg bg-violet-500 p-2 text-white hover:bg-violet-600 disabled:opacity-40 transition-colors"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Decision banner ── */}
              <AnimatePresence>
                {decisionBanner && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className={`mt-2 flex items-start gap-4 rounded-xl border-2 p-5 shadow-sm ${
                      decisionBanner.type === 'published'      ? 'border-violet-300 bg-violet-50'
                      : decisionBanner.type === 'approved'    ? 'border-emerald-300 bg-emerald-50'
                      : decisionBanner.type === 'on-hold'     ? 'border-amber-300 bg-amber-50'
                      : decisionBanner.type === 'final-rejected' ? 'border-red-300 bg-red-50'
                      : 'border-sky-300 bg-sky-50'
                    }`}>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      decisionBanner.type === 'published'      ? 'bg-violet-100'
                      : decisionBanner.type === 'approved'    ? 'bg-emerald-100'
                      : decisionBanner.type === 'on-hold'     ? 'bg-amber-100'
                      : decisionBanner.type === 'final-rejected' ? 'bg-red-100'
                      : 'bg-sky-100'
                    }`}>
                      {decisionBanner.type === 'published'       ? <Rocket      className="h-5 w-5 text-violet-600" />
                       : decisionBanner.type === 'approved'      ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                       : decisionBanner.type === 'on-hold'       ? <Clock        className="h-5 w-5 text-amber-600" />
                       : decisionBanner.type === 'final-rejected'? <XCircle      className="h-5 w-5 text-red-600" />
                       : <AlertTriangle className="h-5 w-5 text-sky-600" />}
                    </div>
                    <div className="flex-1">
                      <p className={`text-base font-bold ${
                        decisionBanner.type === 'published'       ? 'text-violet-800'
                        : decisionBanner.type === 'approved'     ? 'text-emerald-800'
                        : decisionBanner.type === 'on-hold'      ? 'text-amber-800'
                        : decisionBanner.type === 'final-rejected'? 'text-red-800'
                        : 'text-sky-800'
                      }`}>
                        {decisionBanner.type === 'published'        ? '🚀 Asset Published!'
                         : decisionBanner.type === 'approved'      ? '✅ Submission Approved'
                         : decisionBanner.type === 'on-hold'       ? '⏸ Placed On Hold'
                         : decisionBanner.type === 'final-rejected' ? '❌ Submission Rejected'
                         : '↩ Submission Returned'}
                      </p>
                      <p className={`mt-1 text-sm leading-relaxed ${
                        decisionBanner.type === 'published'        ? 'text-violet-700'
                        : decisionBanner.type === 'approved'      ? 'text-emerald-700'
                        : decisionBanner.type === 'on-hold'       ? 'text-amber-700'
                        : decisionBanner.type === 'final-rejected' ? 'text-red-700'
                        : 'text-sky-700'
                      }`}>
                        {decisionBanner.type === 'published'
                          ? `"${decisionBanner.title}" is now live in the Amplify catalog.`
                          : decisionBanner.type === 'approved'
                          ? `"${decisionBanner.title}" has been approved and moved to the Owner's Publish Queue.`
                          : decisionBanner.type === 'on-hold'
                          ? `"${decisionBanner.title}" has been placed on hold. The submitter will be notified.`
                          : decisionBanner.type === 'final-rejected'
                          ? `"${decisionBanner.title}" has been permanently rejected.`
                          : `"${decisionBanner.title}" has been returned to the submitter with your notes.`}
                      </p>
                      <button
                        onClick={() => navigate(decisionBanner.type === 'published' ? '/catalog' : '/pipeline?tab=queue')}
                        className={`mt-3 text-xs font-semibold underline underline-offset-2 ${
                          decisionBanner.type === 'published'        ? 'text-violet-700 hover:text-violet-900'
                          : decisionBanner.type === 'approved'      ? 'text-emerald-700 hover:text-emerald-900'
                          : decisionBanner.type === 'on-hold'       ? 'text-amber-700 hover:text-amber-900'
                          : decisionBanner.type === 'final-rejected' ? 'text-red-700 hover:text-red-900'
                          : 'text-sky-700 hover:text-sky-900'
                        }`}>
                        {decisionBanner.type === 'published' ? '→ View in Catalog' : '← Back to Queue'}
                      </button>
                    </div>
                    <button onClick={() => setDecisionBanner(null)} className="shrink-0 opacity-40 hover:opacity-80">
                      <X className="h-4 w-4 text-gray-600" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Admin Decision Panel ── */}
              {canAdminAct && (
                <div className="rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-sm">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-700">
                      <ClipboardList className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-amber-900">Admin Decision Required</h3>
                      <p className="mt-0.5 text-xs text-amber-700">
                        Review the <button className="underline" onClick={() => setActiveTab('overview')}>submission</button>,{' '}
                        <button className="underline" onClick={() => setActiveTab('artifacts')}>artifacts</button>, and{' '}
                        <button className="underline" onClick={() => setActiveTab('ai')}>AI evaluation</button> before deciding.
                      </p>
                    </div>
                  </div>
                  {actionError && (
                    <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{actionError}</p>
                  )}
                  <textarea value={rejectionNotes} onChange={e => setRejectionNotes(e.target.value)}
                    placeholder="Notes — required for Reject / Request Changes / Final Reject…"
                    rows={3}
                    className="mb-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                  <textarea value={holdNotes} onChange={e => setHoldNotes(e.target.value)}
                    placeholder="On-hold reason (optional)…"
                    rows={2}
                    className="mb-4 w-full rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50"
                      disabled={!rejectionNotes.trim() || actionLoading !== null}
                      onClick={() => void handleReject()}>
                      <AlertTriangle className="h-4 w-4" />{actionLoading === 'reject' ? 'Sending back…' : 'Request Changes'}
                    </Button>
                    <Button variant="outline" className="gap-2 border-amber-400 text-amber-700 hover:bg-amber-50"
                      disabled={actionLoading !== null}
                      onClick={() => void handleHold()}>
                      <Clock className="h-4 w-4" />{actionLoading === 'hold' ? 'Placing on hold…' : 'Put On Hold'}
                    </Button>
                    <Button variant="outline" className="gap-2 border-red-400 text-red-700 hover:bg-red-50"
                      disabled={!rejectionNotes.trim() || actionLoading !== null}
                      onClick={() => void handleFinalReject()}>
                      <XCircle className="h-4 w-4" />{actionLoading === 'final-reject' ? 'Rejecting…' : 'Reject (Final)'}
                    </Button>
                    <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                      disabled={actionLoading !== null}
                      onClick={() => void handleApprove()}>
                      <Check className="h-4 w-4" />{actionLoading === 'approve' ? 'Approving…' : 'Approve Submission'}
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Owner Publish Panel ── */}
              {canOwnerPublish && (
                <div className="rounded-xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 shadow-sm">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-200 text-emerald-700">
                      <Rocket className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-emerald-900">Owner Publishing Decision</h3>
                      <p className="mt-0.5 text-xs text-emerald-700">
                        Approved by admin. Review{' '}
                        <button className="underline font-semibold" onClick={() => setActiveTab('overview')}>details</button>,{' '}
                        <button className="underline font-semibold" onClick={() => setActiveTab('artifacts')}>artifacts</button>, and{' '}
                        <button className="underline font-semibold" onClick={() => setActiveTab('ai')}>AI evaluation</button> then decide.
                      </p>
                    </div>
                  </div>
                  {actionError && (
                    <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{actionError}</p>
                  )}
                  <textarea value={rejectionNotes} onChange={e => setRejectionNotes(e.target.value)}
                    placeholder="Notes — required for Return for Revision or Reject…"
                    rows={3}
                    className="mb-2 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                  <textarea value={holdNotes} onChange={e => setHoldNotes(e.target.value)}
                    placeholder="On-hold reason (optional)…"
                    rows={2}
                    className="mb-4 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50"
                      disabled={!rejectionNotes.trim() || actionLoading !== null}
                      onClick={() => void handleReject()}>
                      <AlertTriangle className="h-4 w-4" />{actionLoading === 'reject' ? 'Returning…' : 'Return for Revision'}
                    </Button>
                    <Button variant="outline" className="gap-2 border-amber-400 text-amber-700 hover:bg-amber-50"
                      disabled={actionLoading !== null}
                      onClick={() => void handleHold()}>
                      <Clock className="h-4 w-4" />{actionLoading === 'hold' ? 'Placing on hold…' : 'Put On Hold'}
                    </Button>
                    <Button variant="outline" className="gap-2 border-red-400 text-red-700 hover:bg-red-50"
                      disabled={!rejectionNotes.trim() || actionLoading !== null}
                      onClick={() => void handleFinalReject()}>
                      <XCircle className="h-4 w-4" />{actionLoading === 'final-reject' ? 'Rejecting…' : 'Reject (Final)'}
                    </Button>
                    <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={actionLoading !== null}
                      onClick={() => void handlePublish()}>
                      <Rocket className="h-4 w-4" />{actionLoading === 'publish' ? 'Publishing…' : 'Publish to Catalog'}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Right sidebar ─────────────────────────────────────────── */}
            <div className="space-y-4">

              {/* Status + AI Score */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Review Status</h3>
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded-full px-3 py-1.5 text-xs font-bold"
                    style={{ backgroundColor: status.bg, color: status.color }}>
                    {status.label}
                  </span>
                </div>
                {aiScore !== null && (
                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500">AI Score</span>
                      <span className={`text-sm font-bold tabular-nums ${aiScore >= 70 ? 'text-emerald-600' : aiScore >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                        {aiScore}/100
                      </span>
                    </div>
                    <ScoreBar score={aiScore} />
                  </div>
                )}
                {submission.demo_ready && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />Demo Ready
                  </div>
                )}
              </div>

              {/* Submission Details */}
              <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Submission Details</h3>
                <MetaItem icon={Calendar}  label="Submitted"  value={formatDate(submission.created_at)} />
                <MetaItem icon={Building2} label="Department" value={submission.department || '—'} />
                <MetaItem icon={Layers}    label="Family"     value={family.name} />
                {submission.cloud_provider && (
                  <MetaItem icon={Cloud} label="Cloud" value={submission.cloud_provider} />
                )}
                {submission.maturity && (
                  <MetaItem icon={maturity?.icon ?? Shield} label="Maturity" value={maturity?.label ?? submission.maturity} />
                )}
                {submission.catalog_code && (
                  <MetaItem icon={Hash} label="Catalog ID" value={submission.catalog_code} />
                )}
              </div>

              {/* Artifacts quick-links */}
              <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Artifacts</h3>
                <div className="space-y-2">
                  <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${hasRepo ? 'bg-sky-50 text-sky-700' : 'bg-gray-50 text-gray-400'}`}>
                    <GitBranch className="h-3.5 w-3.5 shrink-0" />
                    {hasRepo ? 'Repository attached' : 'No repository'}
                  </div>
                  <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${hasVideo ? 'bg-sky-50 text-sky-700' : 'bg-gray-50 text-gray-400'}`}>
                    <Play className="h-3.5 w-3.5 shrink-0" />
                    {hasVideo ? 'Demo video attached' : 'No demo video'}
                  </div>
                  {hasTechStack && (
                    <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700">
                      <Cpu className="h-3.5 w-3.5 shrink-0" />
                      {submission.tech_stack.length} tech stack items
                    </div>
                  )}
                </div>
              </div>

              {/* AI quick summary */}
              {hasAI && aiSummary && (
                <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 shadow-sm">
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-500">
                    <Brain className="h-3.5 w-3.5" />AI Summary
                  </h3>
                  <p className="text-xs leading-relaxed text-violet-800 line-clamp-4">{aiSummary}</p>
                  <button onClick={() => setActiveTab('ai')}
                    className="mt-2 text-xs font-semibold text-violet-600 hover:text-violet-800 underline underline-offset-2">
                    View full evaluation →
                  </button>
                </div>
              )}

              {/* Reviewer notes quick-view */}
              {submission.admin_notes && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600">
                    <ClipboardList className="h-3.5 w-3.5" />Reviewer Notes
                  </h3>
                  <p className="text-xs leading-relaxed text-amber-800 line-clamp-3">{submission.admin_notes}</p>
                </div>
              )}

              {/* Info panel */}
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs text-gray-500">
                <p className="flex items-start gap-1.5">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                  Submissions are evaluated by AI and reviewed by an admin before being published to the catalog.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DemoVideoModal open={demoVideoOpen} url={videoUrls[0] ?? ''} title={submission.title} onClose={() => setDemoVideoOpen(false)} />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete this submission?"
        description={`"${submission.title}" will be permanently removed from the pipeline.`}
        confirmLabel="Delete permanently"
        cancelLabel="Keep"
        variant="danger"
        isPending={isDeleting}
        onClose={() => { if (!isDeleting) setDeleteConfirmOpen(false); }}
        onConfirm={() => void performDelete()}
      />

      {deleteError && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 shadow-lg">
          {deleteError}
        </div>
      )}
    </>
  );
}
