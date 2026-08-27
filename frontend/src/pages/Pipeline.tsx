import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, AlertCircle, Clock, Loader2, Rocket, AlertTriangle,
  Trash2, Crown, GitBranch, X,
  FileText, BrainCircuit, ShieldCheck, BadgeCheck, Filter,
  User, ClipboardList, LayoutGrid, Download, MessageSquare,
} from 'lucide-react';

// ── Toast notification ────────────────────────────────────────────────────────
interface Toast { id: number; type: 'success' | 'error' | 'info'; title: string; message: string }

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 w-80">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${
              t.type === 'success' ? 'border-emerald-200 bg-emerald-50'
              : t.type === 'error'  ? 'border-rose-200 bg-rose-50'
              : 'border-sky-200 bg-sky-50'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {t.type === 'success'
                ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                : t.type === 'error'
                ? <XCircle className="h-5 w-5 text-rose-500" />
                : <Clock className="h-5 w-5 text-sky-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${t.type === 'success' ? 'text-emerald-800' : t.type === 'error' ? 'text-rose-800' : 'text-sky-800'}`}>{t.title}</p>
              <p className={`text-xs leading-snug mt-0.5 ${t.type === 'success' ? 'text-emerald-700' : t.type === 'error' ? 'text-rose-700' : 'text-sky-700'}`}>{t.message}</p>
            </div>
            <button onClick={() => onDismiss(t.id)} className="mt-0.5 shrink-0 opacity-50 hover:opacity-100">
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
import { defaultFamilyBadge, useFamilies } from '../context/FamiliesContext';
import { Button } from '../components/ui/Button';
import {
  getMySubmissions, getAllSubmissions, publishSubmission, deleteSubmission,
  type Submission,
} from '../lib/submissionService';
import { getPendingApprovals, getPublishQueue, getMyReviewQueue, assignSubmissionReview, approveSubmission, rejectSubmission, finalRejectSubmission, holdSubmission } from '../lib/adminService';
import { getIncomingCloneRequests, getMyCloneRequests, getAllCloneRequests, approveClone, denyClone, cancelClone, type CloneRequest } from '../lib/cloneService';
import { getMyDemoRequests, getAllDemoRequests, approveDemoRequest, rejectDemoRequest, type DemoRequest } from '../lib/demoRequestService';
import { useAuth } from '../context/AuthContext';

// ── Workflow progress tracker ─────────────────────────────────────────────────

const WORKFLOW_STEPS = [
  { key: 'Submitted',       label: 'Submitted' },
  { key: 'AI_Review',       label: 'AI Review' },
  { key: 'Manual_Approval', label: 'Admin Review' },
  { key: 'Approved',        label: 'Approved' },
  { key: 'Published',       label: 'Published' },
] as const;

function WorkflowTracker({ status }: { status: string }) {
  const isRejected = status === 'Needs_Changes';

  // Determine how far along we are on the happy path
  const stepKeys = WORKFLOW_STEPS.map((s) => s.key);
  // Needs_Changes counts as stuck at Manual_Approval
  const effectiveStatus = isRejected ? 'Manual_Approval' : status;
  const currentIndex = stepKeys.indexOf(effectiveStatus as typeof stepKeys[number]);

  return (
    <div className="mt-3">
      {/* Dot + connector row */}
      <div className="flex items-center">
        {WORKFLOW_STEPS.map((step, i) => {
          const isDone    = i < currentIndex;
          const isCurrent = i === currentIndex;

          let dotClass = '';
          if (isRejected && isCurrent) {
            dotClass = 'border-rose-400 bg-rose-50';
          } else if (isDone) {
            dotClass = 'border-emerald-400 bg-emerald-400';
          } else if (isCurrent) {
            dotClass = 'border-sky-500 bg-sky-500 ring-2 ring-sky-200';
          } else {
            dotClass = 'border-gray-200 bg-white';
          }

          return (
            <div key={step.key} className="flex flex-1 items-center last:flex-none">
              {/* connector before (skip first) */}
              {i > 0 && <div className={`h-0.5 flex-1 ${isDone ? 'bg-emerald-300' : 'bg-gray-100'}`} />}
              {/* dot */}
              <div className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 ${dotClass} ${step.key === 'AI_Review' && status === 'AI_Review' ? 'animate-pulse' : ''}`} />
              {/* connector after (skip last) */}
              {i < WORKFLOW_STEPS.length - 1 && <div className={`h-0.5 flex-1 ${isDone ? 'bg-emerald-300' : 'bg-gray-100'}`} />}
            </div>
          );
        })}
      </div>
      {/* Label row — separate row so labels never overlap connectors */}
      <div className="mt-1 flex">
        {WORKFLOW_STEPS.map((step, i) => {
          const isDone    = i < currentIndex;
          const isCurrent = i === currentIndex;

          let labelClass = '';
          if (isRejected && isCurrent) labelClass = 'text-rose-500 font-semibold';
          else if (isDone)             labelClass = 'text-emerald-600 font-medium';
          else if (isCurrent)          labelClass = 'text-sky-700 font-semibold';
          else                         labelClass = 'text-gray-300';

          return (
            <span
              key={step.key}
              className={`flex-1 text-center text-[9px] leading-tight last:flex-none ${labelClass}`}
              style={{ minWidth: 0 }}
            >
              {step.label}
            </span>
          );
        })}
      </div>
      {/* Needs Changes badge */}
      {isRejected && (
        <div className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5">
          <AlertTriangle className="h-2.5 w-2.5 text-rose-400" />
          <span className="text-[9px] font-bold text-rose-500">Needs Changes</span>
        </div>
      )}
    </div>
  );
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  Submitted:       { label: 'Submitted',         color: '#0EA5E9', bg: '#E0F2FE', icon: Clock },
  AI_Review:       { label: 'AI Review',          color: '#8B5CF6', bg: '#EDE9FE', icon: Loader2 },
  Manual_Approval: { label: 'Pending Review',     color: '#F59E0B', bg: '#FEF3C7', icon: Clock },
  Needs_Changes:   { label: 'Needs Changes',      color: '#EF4444', bg: '#FEE2E2', icon: AlertTriangle },
  Approved:        { label: 'Approved',           color: '#10B981', bg: '#D1FAE5', icon: CheckCircle2 },
  Rejected:        { label: 'Rejected',           color: '#DC2626', bg: '#FEE2E2', icon: XCircle },
  On_Hold:         { label: 'On Hold',            color: '#F59E0B', bg: '#FEF3C7', icon: Clock },
  Published:       { label: 'Published',          color: '#059669', bg: '#ECFDF5', icon: Rocket },
  Archived:        { label: 'Removed from Catalog', color: '#6B7280', bg: '#F3F4F6', icon: XCircle },
};

// ── Role helpers ──────────────────────────────────────────────────────────────
// super_admin = "Owner" in display — has all rights
// admin       = can only approve/reject submissions in their dept
// guest       = standard user, sees own submissions only

const ROLE_DISPLAY: Record<string, string> = {
  super_admin: 'Owner',
  admin: 'Admin',
  guest: 'User',
};

// ── AI Feedback Panel ─────────────────────────────────────────────────────────

const AGENT_META: Record<string, { label: string; icon: string }> = {
  relevance:      { label: 'Relevance',      icon: '🎯' },
  tech_quality:   { label: 'Tech Quality',   icon: '⚙️' },
  description:    { label: 'Description',    icon: '📝' },
  demo_readiness: { label: 'Demo Readiness', icon: '🎬' },
  duplicate_check:{ label: 'Duplicate Check',icon: '🔍' },
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-400' : 'bg-rose-500';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${score}%` }} />
    </div>
  );
}

function AIFeedbackPanel({ submission }: { submission: Submission }) {
  const fb = submission.ai_feedback as Record<string, unknown> | null;
  if (!fb) return null;

  const agentScores   = fb.agent_scores   as Record<string, number>                              | undefined;
  const agentFeedback = fb.agent_feedback as Record<string, { score: number; feedback: string }> | undefined;
  const checklist     = fb.checklist      as Record<string, { status: string; note: string }> | undefined;
  const isDuplicate   = fb.is_duplicate   as boolean | undefined;
  const similarTo     = fb.similar_to     as string | undefined;
  const summary       = fb.summary        as string | undefined;
  const composite     = fb.composite_score as number | undefined;

  const scoreColor = composite === undefined ? '' : composite >= 70 ? 'text-emerald-600' : composite >= 50 ? 'text-amber-600' : 'text-rose-600';
  const scoreBg    = composite === undefined ? '' : composite >= 70 ? 'bg-emerald-50 border-emerald-200' : composite >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200';

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-violet-100 bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <span className="text-sm font-bold text-white">AI Evaluation Report</span>
        </div>
        {composite !== undefined && (
          <div className="flex items-center gap-2">
            <div className="h-1 w-16 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white/80" style={{ width: `${composite}%` }} />
            </div>
            <span className="text-sm font-bold text-white">{composite}<span className="text-xs font-normal text-white/70">/100</span></span>
          </div>
        )}
      </div>

      <div className="p-4">
        {/* Summary banner */}
        {summary && (
          <div className={`mb-4 flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${scoreBg}`}>
            <span className="mt-0.5 text-sm">{composite !== undefined && composite >= 60 ? '✅' : '⚠️'}</span>
            <p className={`text-xs font-medium leading-relaxed ${scoreColor}`}>{summary}</p>
          </div>
        )}

        {/* Vertical agent list */}
        {agentScores && (
          <div className="space-y-0 divide-y divide-gray-100 rounded-lg border border-gray-100">
            {Object.entries(agentScores).map(([name, score], idx) => {
              const meta = AGENT_META[name] ?? { label: name.replace(/_/g, ' '), icon: '📊' };
              const feedback = agentFeedback?.[name]?.feedback;
              const scoreText = score >= 70 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-rose-600';
              return (
                <div key={name} className={`px-3 py-3 ${idx === 0 ? 'rounded-t-lg' : ''} ${idx === Object.keys(agentScores).length - 1 ? 'rounded-b-lg' : ''} bg-white hover:bg-gray-50/60 transition-colors`}>
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <span className="text-base shrink-0">{meta.icon}</span>
                    {/* Label + bar */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700">{meta.label}</span>
                        <span className={`text-sm font-bold tabular-nums ${scoreText}`}>{score}</span>
                      </div>
                      <ScoreBar score={score} />
                    </div>
                  </div>
                  {feedback && (
                    <p className="mt-2 pl-8 text-xs leading-relaxed text-gray-500">{feedback}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Duplicate warning */}
        {isDuplicate && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            <p className="text-xs font-medium text-rose-700">
              Duplicate detected{similarTo ? ` — similar to "${similarTo}"` : ''}. Title must be unique.
            </p>
          </div>
        )}

        {/* Pre-Approval Checklist */}
        {checklist && Object.keys(checklist).length > 0 && (
          <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Pre-Approval Checklist</p>
            <ul className="space-y-1.5">
              {Object.entries(checklist).map(([key, val]) => {
                const status = val?.status ?? 'warn';
                const isPassed = status === 'pass';
                const isFail   = status === 'fail';
                return (
                  <li key={key} className="flex items-start gap-2">
                    {isPassed
                      ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      : isFail
                        ? <XCircle    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                        : <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />}
                    <div className="min-w-0">
                      <span className={`text-xs font-semibold capitalize leading-snug ${isPassed ? 'text-gray-700' : isFail ? 'text-rose-600' : 'text-amber-700'}`}>
                        {key.replace(/_/g, ' ')}
                      </span>
                      {val?.note && <p className="mt-0.5 text-[10px] leading-snug text-gray-500">{val.note}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Submission Card ───────────────────────────────────────────────────────────

interface CardProps {
  sub: Submission;
  role: string;
  userId: string | undefined;
  onApprove: (e: MouseEvent, id: string, notes: string, title?: string) => Promise<void>;
  onReject: (e: MouseEvent, id: string, notes: string, title?: string) => Promise<void>;
  onFinalReject: (e: MouseEvent, id: string, notes: string, title?: string) => Promise<void>;
  onHold: (e: MouseEvent, id: string, notes: string, title?: string) => Promise<void>;
  onPublish: (e: MouseEvent, id: string) => Promise<void>;
  onDelete: (e: MouseEvent, id: string) => Promise<void>;
  actionLoading: string | null;
  index: number;
  showSubmitter?: boolean;
  onAssign?: (id: string, title: string) => void;
}

function SubmissionCard({
  sub, role, userId,
  onApprove, onReject, onFinalReject, onHold, onPublish, onDelete,
  actionLoading, index, showSubmitter, onAssign,
}: CardProps) {
  const navigate = useNavigate();
  const { families } = useFamilies();
  const cfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG['Submitted'];
  const family = families[sub.family] ?? defaultFamilyBadge();
  const isActing = actionLoading === sub.id;
  const isAIProcessing = sub.status === 'Submitted' || sub.status === 'AI_Review';

  const isOwner = role === 'Aimplify.Owner';
  const isAdmin = role === 'Aimplify.Admin' || role === 'Aimplify.Owner';
  const isMySubmission = userId === sub.submitter_id;

  const isAssignedReviewer = !!userId && sub.assigned_reviewer_id === userId;
  const canAdminAction = (isAdmin || isAssignedReviewer) && (sub.status === 'Manual_Approval' || (isOwner && sub.status === 'Needs_Changes'));
  // Only Owner (super_admin) can publish — no one else
  const canPublish = (sub.status === 'Approved' || sub.status === 'On_Hold') && isOwner;
  // Owner can delete any; submitter can delete their own non-published
  const canDelete = isOwner || (isMySubmission && sub.status !== 'Published');

  const [showFeedback, setShowFeedback] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const hasFeedback = !!sub.ai_feedback;
  const StatusIcon = cfg.icon;

  return (
    <motion.div
      key={sub.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
      whileHover={{ y: -1, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all"
      style={
        canAdminAction ? { borderLeft: '4px solid #F59E0B' }
        : canPublish ? { borderLeft: '4px solid #10B981' }
        : {}
      }
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          {/* Title */}
          <div
            className="cursor-pointer truncate text-sm font-bold text-gray-900 hover:text-sky-600 transition-colors"
            onClick={() => navigate(`/pipeline/${sub.id}`)}
          >
            {sub.title}
          </div>

          {/* Meta row */}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className="font-semibold" style={{ color: family.color }}>{family.name}</span>
            <span>·</span><span>{sub.department}</span>
            <span>·</span><span>{new Date(sub.created_at).toLocaleDateString()}</span>
            {showSubmitter && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[9px] text-gray-500">
                uid:{sub.submitter_id?.slice(0, 8)}…
              </span>
            )}
          </div>

          {/* Removed from catalog notice */}
          {sub.status === 'Archived' && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <p className="text-xs font-bold text-gray-600">Removed from Catalog</p>
                <p className="text-[10px] text-gray-400">The owner has removed this asset from the catalog. Your submission record is kept for reference.</p>
              </div>
            </div>
          )}

          {/* Workflow progress — shown to the submitter so they can track their asset */}
          {isMySubmission && sub.status !== 'Archived' && (
            <WorkflowTracker status={sub.status} />
          )}

          {/* AI processing */}
          {isAIProcessing && (
            <div className="mt-3 flex items-center gap-2 text-xs text-violet-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>AI agents are evaluating this submission…</span>
            </div>
          )}

          {/* Needs Changes */}
          {sub.status === 'Needs_Changes' && (
            <div className="mt-3 space-y-2">
              {sub.admin_notes && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="text-xs font-bold text-amber-600">Admin Feedback</div>
                  <p className="mt-1 text-xs leading-relaxed text-gray-600">{sub.admin_notes}</p>
                </div>
              )}
              {hasFeedback && (
                <button onClick={() => setShowFeedback((v) => !v)}
                  className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700">
                  {showFeedback ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {showFeedback ? 'Hide' : 'Show'} AI Evaluation
                </button>
              )}
              {showFeedback && <AIFeedbackPanel submission={sub} />}
              {isMySubmission && (
                <button onClick={() => navigate(`/submit?revision=${sub.id}`)}
                  className="mt-1 text-xs font-semibold text-sky-600 underline underline-offset-2 hover:text-sky-700">
                  Edit and resubmit →
                </button>
              )}
            </div>
          )}

          {/* AI feedback toggle — hidden on queue items (approver must use the detail page) */}
          {sub.status !== 'Needs_Changes' && hasFeedback && !canAdminAction && (
            <div className="mt-2">
              <button onClick={() => setShowFeedback((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700">
                {showFeedback ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {showFeedback ? 'Hide' : 'View'} AI Evaluation
              </button>
              {showFeedback && <AIFeedbackPanel submission={sub} />}
            </div>
          )}

          {/* Owner publish queue — review CTA + quick actions */}
          {canPublish && (
            <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => navigate(`/pipeline/${sub.id}`)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-left transition-colors hover:bg-emerald-100"
              >
                <div>
                  <p className="text-xs font-bold text-emerald-800">Review before publishing</p>
                  <p className="text-[10px] text-emerald-600">View full details, artifacts & AI evaluation — then publish or return</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-emerald-500" />
              </button>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Notes — required for Return / Reject (Final)…"
                rows={2}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-emerald-300 focus:ring-1 focus:ring-emerald-100"
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline"
                  disabled={!adminNote.trim() || isActing}
                  className="gap-1 border-sky-300 text-sky-700 hover:bg-sky-50"
                  onClick={(e) => void onReject(e as MouseEvent, sub.id, adminNote, sub.title)}>
                  <AlertTriangle className="h-3 w-3" />{isActing ? '…' : 'Return'}
                </Button>
                <Button size="sm" variant="outline"
                  disabled={isActing}
                  className="gap-1 border-amber-400 text-amber-700 hover:bg-amber-50"
                  onClick={(e) => void onHold(e as MouseEvent, sub.id, adminNote, sub.title)}>
                  <Clock className="h-3 w-3" />{isActing ? '…' : 'Hold'}
                </Button>
                <Button size="sm" variant="outline"
                  disabled={!adminNote.trim() || isActing}
                  className="gap-1 border-red-400 text-red-700 hover:bg-red-50"
                  onClick={(e) => void onFinalReject(e as MouseEvent, sub.id, adminNote, sub.title)}>
                  <XCircle className="h-3 w-3" />{isActing ? '…' : 'Reject'}
                </Button>
              </div>
            </div>
          )}

          {/* Admin approve / reject actions */}
          {canAdminAction && (
            <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
              {/* Review CTA — prominent, links to full tabbed detail page */}
              <button
                onClick={() => navigate(`/pipeline/${sub.id}`)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-left transition-colors hover:bg-amber-100"
              >
                <div>
                  <p className="text-xs font-bold text-amber-800">Review before deciding</p>
                  <p className="text-[10px] text-amber-600">View submission details, artifacts, video & AI evaluation</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-amber-500" />
              </button>
              {/* Quick decision — for when already reviewed */}
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Optional note for approve / required for reject…"
                rows={2}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-amber-300 focus:ring-1 focus:ring-amber-100"
              />
              <div className="flex gap-2">
                {onAssign && isAdmin && (
                  <Button size="sm" variant="outline" className="gap-1 border-violet-300 text-violet-700 hover:bg-violet-50"
                    disabled={isActing} onClick={() => onAssign(sub.id, sub.title)}>
                    <User className="h-3 w-3" />Assign
                  </Button>
                )}
                <Button size="sm" variant="outline"
                  className="gap-1 border-sky-300 text-sky-700 hover:bg-sky-50"
                  onClick={() => navigate(`/pipeline/${sub.id}#comments`, { state: { tab: 'comments' } })}>
                  <MessageSquare className="h-3 w-3" />Message
                </Button>
                <Button size="sm" variant="outline"
                  disabled={!adminNote.trim() || isActing}
                  onClick={(e) => void onReject(e as MouseEvent, sub.id, adminNote, sub.title)}>
                  {isActing ? '…' : 'Reject'}
                </Button>
                <Button size="sm" disabled={isActing}
                  onClick={(e) => void onApprove(e as MouseEvent, sub.id, adminNote, sub.title)}>
                  {isActing ? '…' : 'Approve'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* AI Score */}
        {sub.ai_score !== null && (
          <div className="hidden min-w-[56px] flex-col items-center md:flex">
            <div className={`text-lg font-bold ${(sub.ai_score ?? 0) >= 60 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {sub.ai_score}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-gray-400">AI Score</div>
          </div>
        )}

        <div className="flex flex-col items-end gap-2">
          {/* Status badge */}
          <span className="flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold whitespace-nowrap"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}>
            <StatusIcon className={`h-3 w-3 ${sub.status === 'AI_Review' ? 'animate-spin' : ''}`} />
            {cfg.label}
          </span>

          {/* Publish button */}
          {canPublish && (
            <div onClick={(e) => e.stopPropagation()}>
              <Button size="sm" disabled={isActing}
                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={(e) => void onPublish(e as MouseEvent, sub.id)}>
                <Rocket className="h-3.5 w-3.5" />
                {isActing ? 'Publishing…' : 'Publish'}
              </Button>
            </div>
          )}
          {/* Owner publish queue review banner (inline with card right side) */}

          {/* Delete button */}
          {canDelete && (
            <div onClick={(e) => e.stopPropagation()}>
              <button
                disabled={isActing}
                onClick={(e) => void onDelete(e as MouseEvent, sub.id)}
                className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] font-medium text-rose-500 transition-colors hover:bg-rose-100 disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
                {isActing ? '…' : 'Delete'}
              </button>
            </div>
          )}

          <ArrowRight
            className="mt-1 h-4 w-4 shrink-0 text-gray-300 cursor-pointer hover:text-gray-500 transition-colors"
            onClick={() => navigate(`/pipeline/${sub.id}`)}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ── Pipeline Page ─────────────────────────────────────────────────────────────

type GroupTab = 'my-work' | 'review' | 'all-activity';

function latestLogicalSubmissions(submissions: Submission[]): Submission[] {
  const latestByAsset = new Map<string, Submission>();
  for (const submission of submissions) {
    const logicalKey = submission.catalog_asset_id || submission.id;
    const existing = latestByAsset.get(logicalKey);
    const submissionTime = new Date(submission.updated_at || submission.created_at).getTime();
    const existingTime = existing ? new Date(existing.updated_at || existing.created_at).getTime() : -1;
    if (!existing || submissionTime > existingTime) latestByAsset.set(logicalKey, submission);
  }
  return [...latestByAsset.values()].sort((a, b) =>
    new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
}

export function Pipeline() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  const role = (user?.role ?? 'guest') as string;
  const isOwner = role === 'Aimplify.Owner';
  const isAdmin = role === 'Aimplify.Admin' || role === 'Aimplify.Owner';

  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [pendingQueue, setPendingQueue] = useState<Submission[]>([]);
  const [publishQueue, setPublishQueue] = useState<Submission[]>([]);
  const [assignedReviewQueue, setAssignedReviewQueue] = useState<Submission[]>([]);
  const [cloneRequests, setCloneRequests] = useState<CloneRequest[]>([]);
  const [myCloneRequests, setMyCloneRequests] = useState<CloneRequest[]>([]);
  const [allCloneRequests, setAllCloneRequests] = useState<CloneRequest[]>([]);
  const [myDemoRequests, setMyDemoRequests] = useState<DemoRequest[]>([]);
  const [allDemoRequests, setAllDemoRequests] = useState<DemoRequest[]>([]);
  const [activeTab, setActiveTab] = useState<GroupTab>(() => {
    const t = searchParams.get('tab');
    if (t === 'review' || t === 'all-activity') return t as GroupTab;
    return 'my-work';
  });
  const [mySubFilter, setMySubFilter] = useState<string>('All');
  const [allSubFilter, setAllSubFilter] = useState<string>('All');
  const [myWorkSubTab, setMyWorkSubTab] = useState<'submissions' | 'clones' | 'incoming-clones' | 'demo-requests'>('submissions');
  const [reviewSubTab, setReviewSubTab] = useState<'submissions' | 'my-reviews' | 'clones' | 'demo-requests'>('submissions');
  const [allSubTab, setAllSubTab] = useState<'submissions' | 'clones' | 'demo-requests'>(isOwner ? 'submissions' : 'clones');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activityDownloading, setActivityDownloading] = useState(false);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addToast = useCallback((type: Toast['type'], title: string, message: string) => {
    const id = ++toastIdRef.current;
    setToasts(p => [...p, { id, type, title, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts(p => p.filter(t => t.id !== id)), []);

  const loadMine = useCallback(async () => {
    try { const { items } = await getMySubmissions({ limit: 100 }); setMySubmissions(items); } catch { /* ignore */ }
  }, []);

  const loadAll = useCallback(async () => {
    if (!isOwner) return;
    try { const { items } = await getAllSubmissions({ limit: 200 }); setAllSubmissions(items); } catch { /* ignore */ }
  }, [isOwner]);

  const loadQueue = useCallback(async () => {
    if (!isAdmin && !isOwner) return;
    try { const { items } = await getPendingApprovals({ limit: 100 }); setPendingQueue(items); } catch { /* ignore */ }
  }, [isAdmin, isOwner]);

  const loadPublishQueue = useCallback(async () => {
    if (!isOwner) return;
    try { const { items } = await getPublishQueue({ limit: 100 }); setPublishQueue(items); } catch { /* ignore */ }
  }, [isOwner]);

  const loadAssignedReviewQueue = useCallback(async () => {
    try { const { items } = await getMyReviewQueue({ limit: 100 }); setAssignedReviewQueue(items); } catch { /* ignore */ }
  }, []);

  const loadCloneRequests = useCallback(async () => {
    try {
      // Admin/Owner: use all-requests list so Review Queue shows platform-wide pending
      // Everyone else: fetch only requests for their own assets
      const requests = (isAdmin || isOwner)
        ? await getAllCloneRequests()
        : await getIncomingCloneRequests();
      setCloneRequests(requests);
    } catch { /* ignore */ }
  }, [isAdmin, isOwner]);

  const loadMyCloneRequests = useCallback(async () => {
    try { setMyCloneRequests(await getMyCloneRequests()); } catch { /* ignore */ }
  }, []);

  const loadMyDemoRequests = useCallback(async () => {
    try { setMyDemoRequests(await getMyDemoRequests()); } catch { /* ignore */ }
  }, []);

  const loadAllDemoRequests = useCallback(async () => {
    try { setAllDemoRequests(await getAllDemoRequests()); } catch { /* ignore */ }
  }, []);

  const loadAllCloneRequests = useCallback(async () => {
    try { setAllCloneRequests(await getAllCloneRequests()); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    void loadMine();
    void loadAll();
    void loadQueue();
    void loadPublishQueue();
    void loadAssignedReviewQueue();
    void loadCloneRequests();
    void loadMyCloneRequests();
    void loadMyDemoRequests();
    if (isAdmin || isOwner) void loadAllCloneRequests();
    void loadAllDemoRequests();
  }, [authLoading, loadMine, loadAll, loadQueue, loadPublishQueue, loadAssignedReviewQueue, loadCloneRequests, loadMyCloneRequests, loadAllCloneRequests, loadMyDemoRequests, loadAllDemoRequests, isAdmin, isOwner]);

  // Poll while any of my submissions are still being processed by AI
  useEffect(() => {
    const hasPending = mySubmissions.some((s) => s.status === 'Submitted' || s.status === 'AI_Review');
    if (hasPending) {
      pollRef.current = setInterval(() => { void loadMine(); if (isOwner) void loadAll(); }, 4000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [mySubmissions, loadMine, loadAll, isOwner]);

  const filteredMySubmissions = useMemo(() =>
    mySubFilter === 'All' ? mySubmissions : mySubmissions.filter(s => s.status === mySubFilter),
    [mySubFilter, mySubmissions]);

  const logicalAllSubmissions = useMemo(() => latestLogicalSubmissions(allSubmissions), [allSubmissions]);

  const filteredAllSubmissions = useMemo(() =>
    allSubFilter === 'All' ? logicalAllSubmissions : logicalAllSubmissions.filter(s => s.status === allSubFilter),
    [allSubFilter, logicalAllSubmissions]);

  const exportCsv = (filename: string, columns: { key: string; label: string }[], rows: Record<string, unknown>[]) => {
    const cell = (value: unknown) => {
      const normalized = Array.isArray(value)
        ? value.join('; ')
        : value && typeof value === 'object'
          ? JSON.stringify(value)
          : String(value ?? '');
      return `"${normalized.replace(/"/g, '""')}"`;
    };
    const content = [
      columns.map(column => cell(column.label)).join(','),
      ...rows.map(row => columns.map(column => cell(row[column.key])).join(',')),
    ].join('\r\n');
    const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const downloadAllActivity = async () => {
    setActivityDownloading(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      if (allSubTab === 'submissions') {
        const first = await getAllSubmissions({ limit: 200 });
        const rows = [...first.items];
        for (let skip = rows.length; skip < first.total; skip += 200) {
          const page = await getAllSubmissions({ skip, limit: 200 });
          rows.push(...page.items);
        }
        exportCsv(`aimplify-assets-${date}.csv`, [
          { key: 'id', label: 'Asset ID' }, { key: 'aiv_ideation_id', label: 'AIV Ideation ID' },
          { key: 'aiv_ideation_title', label: 'AIV Ideation Title' }, { key: 'title', label: 'Title' },
          { key: 'description', label: 'Description' }, { key: 'family', label: 'Family' },
          { key: 'department', label: 'Department' }, { key: 'category', label: 'Category' },
          { key: 'maturity', label: 'Maturity' }, { key: 'cloud_provider', label: 'Cloud Provider' },
          { key: 'demo_ready', label: 'Demo Ready' }, { key: 'tech_stack', label: 'Tech Stack' },
          { key: 'repo_url', label: 'Repository URL' }, { key: 'demo_url', label: 'Live Demo URL' },
          { key: 'video_url', label: 'Primary Video URL' }, { key: 'video_urls', label: 'All Video URLs' },
          { key: 'architecture_file_url', label: 'Document References' }, { key: 'owner_name', label: 'Owner Name' },
          { key: 'owner_email', label: 'Owner Email' }, { key: 'manager_name', label: 'Manager Name' },
          { key: 'manager_email', label: 'Manager Email' }, { key: 'designation', label: 'Designation' },
          { key: 'collaborators', label: 'Collaborators' }, { key: 'dependencies', label: 'Dependencies' },
          { key: 'commands', label: 'Commands' }, { key: 'status', label: 'Status' },
          { key: 'ai_score', label: 'AI Score' }, { key: 'ai_feedback', label: 'AI Feedback' },
          { key: 'admin_notes', label: 'Admin Notes' }, { key: 'submitter_id', label: 'Submitter ID' },
          { key: 'created_at', label: 'Created At' }, { key: 'updated_at', label: 'Updated At' },
        ], latestLogicalSubmissions(rows) as unknown as Record<string, unknown>[]);
      } else if (allSubTab === 'clones') {
        const rows = await getAllCloneRequests();
        exportCsv(`aimplify-clone-requests-${date}.csv`, [
          { key: 'id', label: 'Request ID' }, { key: 'asset_id', label: 'Asset ID' },
          { key: 'asset_title', label: 'Asset Title' }, { key: 'requester_name', label: 'Requester Name' },
          { key: 'requester_email', label: 'Requester Email' }, { key: 'reason', label: 'Reason' },
          { key: 'environment', label: 'Environment' }, { key: 'purpose', label: 'Purpose' },
          { key: 'customer_name', label: 'Customer Name' }, { key: 'project_name', label: 'Project Name' },
          { key: 'is_internal', label: 'Internal Request' }, { key: 'status', label: 'Status' },
          { key: 'created_at', label: 'Created At' }, { key: 'decided_at', label: 'Decided At' },
        ], rows as unknown as Record<string, unknown>[]);
      } else {
        const rows = await getAllDemoRequests();
        exportCsv(`aimplify-demo-requests-${date}.csv`, [
          { key: 'id', label: 'Request ID' }, { key: 'asset_id', label: 'Asset ID' },
          { key: 'asset_title', label: 'Asset Title' }, { key: 'asset_slug', label: 'Asset Slug' },
          { key: 'requester_name', label: 'Requester Name' }, { key: 'requester_email', label: 'Requester Email' },
          { key: 'customer_name', label: 'Customer Name' }, { key: 'project_name', label: 'Project Name' },
          { key: 'vertical', label: 'Vertical' }, { key: 'additional_details', label: 'Additional Details' },
          { key: 'requested_at', label: 'Requested At' },
        ], rows as unknown as Record<string, unknown>[]);
      }
      addToast('success', 'Download Ready', 'The complete All Activity dataset was exported successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The activity export could not be generated.';
      addToast('error', 'Download Failed', message);
    } finally {
      setActivityDownloading(false);
    }
  };

  const assetExportColumns = [
    { key: 'id', label: 'Asset ID' }, { key: 'aiv_ideation_id', label: 'AIV Ideation ID' },
    { key: 'aiv_ideation_title', label: 'AIV Ideation Title' }, { key: 'title', label: 'Title' },
    { key: 'description', label: 'Description' }, { key: 'family', label: 'Family' },
    { key: 'department', label: 'Department' }, { key: 'category', label: 'Category' },
    { key: 'maturity', label: 'Maturity' }, { key: 'cloud_provider', label: 'Cloud Provider' },
    { key: 'demo_ready', label: 'Demo Ready' }, { key: 'tech_stack', label: 'Tech Stack' },
    { key: 'repo_url', label: 'Repository URL' }, { key: 'demo_url', label: 'Live Demo URL' },
    { key: 'video_url', label: 'Primary Video URL' }, { key: 'video_urls', label: 'All Video URLs' },
    { key: 'architecture_file_url', label: 'Document References' }, { key: 'owner_name', label: 'Owner Name' },
    { key: 'owner_email', label: 'Owner Email' }, { key: 'manager_name', label: 'Manager Name' },
    { key: 'manager_email', label: 'Manager Email' }, { key: 'designation', label: 'Designation' },
    { key: 'status', label: 'Approval Status' }, { key: 'ai_score', label: 'AI Score' },
    { key: 'ai_feedback', label: 'AI Evaluation Feedback' }, { key: 'admin_notes', label: 'Admin Notes' },
    { key: 'submitter_id', label: 'Submitter ID' }, { key: 'created_at', label: 'Submitted At' },
    { key: 'updated_at', label: 'Updated At' },
  ];

  const cloneExportColumns = [
    { key: 'id', label: 'Request ID' }, { key: 'asset_id', label: 'Asset ID' },
    { key: 'asset_title', label: 'Asset Title' }, { key: 'requester_name', label: 'Requester Name' },
    { key: 'requester_email', label: 'Requester Email' }, { key: 'reason', label: 'Reason' },
    { key: 'environment', label: 'Environment' }, { key: 'purpose', label: 'Purpose' },
    { key: 'customer_name', label: 'Customer Name' }, { key: 'project_name', label: 'Project Name' },
    { key: 'is_internal', label: 'Internal Request' }, { key: 'status', label: 'Status' },
    { key: 'created_at', label: 'Created At' }, { key: 'decided_at', label: 'Decided At' },
  ];

  const demoExportColumns = [
    { key: 'id', label: 'Request ID' }, { key: 'asset_id', label: 'Asset ID' },
    { key: 'asset_title', label: 'Asset Title' }, { key: 'asset_slug', label: 'Asset Slug' },
    { key: 'requester_name', label: 'Requester Name' }, { key: 'requester_email', label: 'Requester Email' },
    { key: 'customer_name', label: 'Customer Name' }, { key: 'project_name', label: 'Project Name' },
    { key: 'vertical', label: 'Vertical' }, { key: 'additional_details', label: 'Additional Details' },
    { key: 'status', label: 'Status' }, { key: 'decision_notes', label: 'Decision Notes' },
    { key: 'reviewed_by', label: 'Reviewed By' }, { key: 'reviewed_at', label: 'Reviewed At' },
    { key: 'requested_at', label: 'Requested At' },
  ];

  const downloadMyWork = () => {
    const date = new Date().toISOString().slice(0, 10);
    if (myWorkSubTab === 'submissions') {
      exportCsv(`aimplify-my-assets-${date}.csv`, assetExportColumns, mySubmissions as unknown as Record<string, unknown>[]);
    } else if (myWorkSubTab === 'clones') {
      exportCsv(`aimplify-my-repo-access-requests-${date}.csv`, cloneExportColumns, myCloneRequests as unknown as Record<string, unknown>[]);
    } else if (myWorkSubTab === 'demo-requests') {
      exportCsv(`aimplify-my-demo-requests-${date}.csv`, demoExportColumns, myDemoRequests as unknown as Record<string, unknown>[]);
    } else {
      exportCsv(`aimplify-incoming-repo-access-requests-${date}.csv`, cloneExportColumns, incomingForMyWork as unknown as Record<string, unknown>[]);
    }
    addToast('success', 'Download Ready', 'The selected My Work section was exported successfully.');
  };

  const downloadReviewQueue = (queue: 'approval' | 'assigned' | 'publish' | 'clones' | 'demos') => {
    const date = new Date().toISOString().slice(0, 10);
    if (queue === 'approval') {
      exportCsv(`aimplify-approval-queue-${date}.csv`, assetExportColumns, pendingQueue as unknown as Record<string, unknown>[]);
    } else if (queue === 'assigned') {
      exportCsv(`aimplify-my-review-queue-${date}.csv`, assetExportColumns, assignedReviewQueue as unknown as Record<string, unknown>[]);
    } else if (queue === 'publish') {
      exportCsv(`aimplify-publish-queue-${date}.csv`, assetExportColumns, publishQueue as unknown as Record<string, unknown>[]);
    } else if (queue === 'clones') {
      exportCsv(`aimplify-review-repo-access-requests-${date}.csv`, cloneExportColumns, cloneRequests as unknown as Record<string, unknown>[]);
    } else {
      exportCsv(`aimplify-review-demo-requests-${date}.csv`, demoExportColumns, allDemoRequests as unknown as Record<string, unknown>[]);
    }
    addToast('success', 'Download Ready', 'The selected Review Queue section was exported successfully.');
  };

  const handleApprove = async (e: MouseEvent, id: string, notes: string, title?: string) => {
    e.stopPropagation();
    setActionLoading(id); setError('');
    try {
      const updated = await approveSubmission(id, notes || undefined);
      setMySubmissions((p) => p.map((s) => s.id === id ? { ...s, status: updated.status } : s));
      setAllSubmissions((p) => p.map((s) => s.id === id ? { ...s, status: updated.status } : s));
      setPendingQueue((p) => p.filter((s) => s.id !== id));
      setAssignedReviewQueue((p) => p.filter((s) => s.id !== id));
      addToast('success', 'Submission Approved', `"${title ?? 'Submission'}" has been approved and is now awaiting publishing by the Owner.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Approve failed.';
      setError(msg);
      addToast('error', 'Approval Failed', msg);
    }
    finally { setActionLoading(null); }
  };

  const handleReject = async (e: MouseEvent, id: string, notes: string, title?: string) => {
    e.stopPropagation();
    if (!notes.trim()) { setError('Add rejection notes before rejecting.'); return; }
    setActionLoading(id); setError('');
    try {
      const updated = await rejectSubmission(id, notes);
      setMySubmissions((p) => p.map((s) => s.id === id ? { ...s, status: updated.status, admin_notes: notes } : s));
      setAllSubmissions((p) => p.map((s) => s.id === id ? { ...s, status: updated.status, admin_notes: notes } : s));
      setPendingQueue((p) => p.filter((s) => s.id !== id));
      setAssignedReviewQueue((p) => p.filter((s) => s.id !== id));
      addToast('info', 'Submission Returned', `"${title ?? 'Submission'}" has been sent back to the submitter with your notes.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Reject failed.';
      setError(msg);
      addToast('error', 'Rejection Failed', msg);
    }
    finally { setActionLoading(null); }
  };

  const handleFinalReject = async (e: MouseEvent, id: string, notes: string, title?: string) => {
    e.stopPropagation();
    if (!notes.trim()) { setError('Add a reason before final rejection.'); return; }
    setActionLoading(id); setError('');
    try {
      const updated = await finalRejectSubmission(id, notes);
      setMySubmissions((p) => p.map((s) => s.id === id ? { ...s, status: updated.status } : s));
      setAllSubmissions((p) => p.map((s) => s.id === id ? { ...s, status: updated.status } : s));
      setPublishQueue((p) => p.filter((s) => s.id !== id));
      addToast('info', 'Submission Rejected', `"${title ?? 'Submission'}" has been permanently rejected.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Final reject failed.';
      setError(msg);
      addToast('error', 'Rejection Failed', msg);
    } finally { setActionLoading(null); }
  };

  const handleHold = async (e: MouseEvent, id: string, notes: string, title?: string) => {
    e.stopPropagation();
    setActionLoading(id); setError('');
    try {
      const updated = await holdSubmission(id, notes.trim() || undefined);
      setMySubmissions((p) => p.map((s) => s.id === id ? { ...s, status: updated.status } : s));
      setAllSubmissions((p) => p.map((s) => s.id === id ? { ...s, status: updated.status } : s));
      setPublishQueue((p) => p.map((s) => s.id === id ? { ...s, status: updated.status } : s));
      addToast('info', 'Placed On Hold', `"${title ?? 'Submission'}" has been placed on hold.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Hold failed.';
      setError(msg);
      addToast('error', 'Hold Failed', msg);
    } finally { setActionLoading(null); }
  };

  const handlePublish = async (e: MouseEvent, id: string) => {
    e.stopPropagation();
    setActionLoading(id); setError('');
    try {
      const updated = await publishSubmission(id);
      const title = publishQueue.find(s => s.id === id)?.title ?? mySubmissions.find(s => s.id === id)?.title;
      setMySubmissions((p) => p.map((s) => s.id === id ? { ...s, status: updated.status } : s));
      setAllSubmissions((p) => p.map((s) => s.id === id ? { ...s, status: updated.status } : s));
      setPublishQueue((p) => p.filter((s) => s.id !== id));
      addToast('success', 'Asset Published!', `"${title ?? 'Asset'}" is now live in the catalog.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Publish failed.';
      setError(msg);
      addToast('error', 'Publish Failed', msg);
    }
    finally { setActionLoading(null); }
  };

  const handleDelete = async (e: MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this submission? This cannot be undone.')) return;
    setActionLoading(id); setError('');
    try {
      await deleteSubmission(id);
      setMySubmissions((p) => p.filter((s) => s.id !== id));
      setAllSubmissions((p) => p.filter((s) => s.id !== id));
      setPendingQueue((p) => p.filter((s) => s.id !== id));
    } catch (err) { setError(err instanceof Error ? err.message : 'Delete failed.'); }
    finally { setActionLoading(null); }
  };

  const handleCloneApprove = async (id: string) => {
    setActionLoading(id); setError('');
    try {
      const updated = await approveClone(id);
      setCloneRequests((p) => p.map((r) => r.id === id ? { ...r, status: updated.status } : r));
      addToast('success', 'Access Approved', 'Clone access has been approved. The requester will be notified by email.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Approve failed.';
      setError(msg);
      addToast('error', 'Approval Failed', msg);
    }
    finally { setActionLoading(null); }
  };

  const handleCloneDeny = async (id: string) => {
    if (!confirm('Deny this access request?')) return;
    setActionLoading(id); setError('');
    try {
      const updated = await denyClone(id);
      setCloneRequests((p) => p.map((r) => r.id === id ? { ...r, status: updated.status } : r));
      addToast('info', 'Access Denied', 'The clone request has been denied and the requester notified.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Deny failed.';
      setError(msg);
      addToast('error', 'Deny Failed', msg);
    }
    finally { setActionLoading(null); }
  };

  const handleCancelClone = async (id: string) => {
    if (!confirm('Cancel this clone request? This cannot be undone.')) return;
    setActionLoading(id); setError('');
    try {
      const updated = await cancelClone(id);
      setMyCloneRequests((p) => p.map((r) => r.id === id ? { ...r, status: updated.status } : r));
      addToast('info', 'Request Cancelled', 'Your clone request has been cancelled.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cancel failed.';
      setError(msg);
      addToast('error', 'Cancel Failed', msg);
    }
    finally { setActionLoading(null); }
  };

  const pendingCloneCount = cloneRequests.filter((r) => r.status === 'Pending').length;
  const pendingDemoCount = allDemoRequests.filter((request) => request.status === 'Pending').length;
  const reviewCount = pendingQueue.length + publishQueue.length + pendingCloneCount + pendingDemoCount + assignedReviewQueue.length;
  // For non-admin/owner users, surface incoming clone requests in My Work
  const incomingForMyWork = (!isAdmin && !isOwner) ? cloneRequests : [];
  const myWorkCount = mySubmissions.length + myCloneRequests.length + incomingForMyWork.length + myDemoRequests.length;
  const allActivityCount = logicalAllSubmissions.length + allCloneRequests.length;

  const GROUP_TABS: { id: GroupTab; label: string; icon: React.ElementType; count: number; show: boolean }[] = [
    { id: 'my-work',      label: 'My Work',       icon: User,          count: myWorkCount,      show: true },
    { id: 'review',       label: 'Review Queue',  icon: ClipboardList, count: reviewCount,      show: isAdmin || isOwner || allDemoRequests.length > 0 || assignedReviewQueue.length > 0 },
    { id: 'all-activity', label: 'All Activity',  icon: LayoutGrid,    count: allActivityCount, show: isAdmin || isOwner },
  ].filter(t => t.show);

  const statusOptions = ['All', ...Object.keys(STATUS_CONFIG)];

  const openWorkflowStage = (status: string) => {
    if ((status === 'Manual_Approval' || status === 'Approved') && (isAdmin || isOwner)) {
      setActiveTab('review');
      setReviewSubTab('submissions');
      return;
    }
    if (isOwner) {
      setActiveTab('all-activity');
      setAllSubTab('submissions');
      setAllSubFilter(status);
      return;
    }
    setActiveTab('my-work');
    setMyWorkSubTab('submissions');
    setMySubFilter(status);
  };

  const handleDemoApprove = async (id: string) => {
    setActionLoading(id); setError('');
    try {
      const updated = await approveDemoRequest(id);
      setAllDemoRequests(p => p.map(request => request.id === id ? updated : request));
      setMyDemoRequests(p => p.map(request => request.id === id ? updated : request));
      addToast('success', 'Demo Request Approved', 'The requester has been notified by email and in the notification bell.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Demo request approval failed.';
      setError(msg); addToast('error', 'Approval Failed', msg);
    } finally { setActionLoading(null); }
  };

  const handleDemoReject = async (id: string) => {
    if (!confirm('Reject this demo request?')) return;
    setActionLoading(id); setError('');
    try {
      const updated = await rejectDemoRequest(id);
      setAllDemoRequests(p => p.map(request => request.id === id ? updated : request));
      setMyDemoRequests(p => p.map(request => request.id === id ? updated : request));
      addToast('info', 'Demo Request Rejected', 'The requester has been notified by email and in the notification bell.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Demo request rejection failed.';
      setError(msg); addToast('error', 'Rejection Failed', msg);
    } finally { setActionLoading(null); }
  };

  const handleAssignReview = async (id: string, title: string) => {
    const email = prompt(`Assign "${title}" for approval.\n\nEnter the reviewer's platform email address:`)?.trim();
    if (!email) return;
    setActionLoading(id); setError('');
    try {
      const updated = await assignSubmissionReview(id, email);
      setPendingQueue(p => p.map(sub => sub.id === id ? updated : sub));
      addToast('success', 'Review Assigned', `The asset approval was assigned to ${updated.assigned_reviewer_email ?? email}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not assign this review.';
      setError(msg); addToast('error', 'Assignment Failed', msg);
    } finally { setActionLoading(null); }
  };

  return (
    <div className="animate-in fade-in duration-500 pb-12">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="flex items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Assets Pipeline</h1>
            {isOwner && (
              <span className="flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                <Crown className="h-3 w-3" /> Owner
              </span>
            )}
          </div>
        </div>

        {/* Workflow steps — constrained to the same width as the section panels below */}
        <div className="mt-5 grid w-full grid-cols-5 gap-0">
          {([
            { Icon: FileText,     label: 'Submit',        status: 'Submitted',       bg: 'bg-sky-500',     ring: 'ring-sky-100'     },
            { Icon: BrainCircuit, label: 'AI Evaluation', status: 'AI_Review',       bg: 'bg-violet-500',  ring: 'ring-violet-100'  },
            { Icon: ShieldCheck,  label: 'Admin Review',  status: 'Manual_Approval', bg: 'bg-amber-500',   ring: 'ring-amber-100'   },
            { Icon: BadgeCheck,   label: 'Approved',      status: 'Approved',        bg: 'bg-emerald-500', ring: 'ring-emerald-100' },
            { Icon: Rocket,       label: 'Published',     status: 'Published',       bg: 'bg-indigo-500',  ring: 'ring-indigo-100'  },
          ] as const).map((step, i, arr) => (
            <div key={step.label} className="relative flex justify-center">
              {i < arr.length - 1 && (
                <div className="absolute left-1/2 top-[14px] h-px w-full bg-gray-200 sm:top-[16px] md:top-[18px]" />
              )}
              <button
                type="button"
                onClick={() => openWorkflowStage(step.status)}
                title={`View ${step.label} assets`}
                className="group relative z-10 flex min-w-0 flex-col items-center gap-1 bg-transparent px-1 outline-none sm:gap-1.5 sm:px-2"
              >
                <div className={`flex h-7 w-7 items-center justify-center rounded-full ${step.bg} ring-2 ${step.ring} shadow-sm sm:h-8 sm:w-8 sm:ring-[3px] md:h-9 md:w-9 md:ring-4`}>
                  <step.Icon className="h-3 w-3 text-white sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                </div>
                <span className="max-w-full text-center text-[8px] font-bold leading-tight text-gray-500 transition-colors group-hover:text-sky-700 group-focus-visible:text-sky-700 sm:text-[9px] md:whitespace-nowrap md:text-[10px]">{step.label}</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Group Tabs ──────────────────────────────────────────────────── */}
      {GROUP_TABS.length > 1 && (
        <div className="mx-auto w-full max-w-5xl px-4">
          <div className="flex w-full gap-1 border-b border-gray-200">
            {GROUP_TABS.map(({ id, label, icon: Icon, count }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => { setActiveTab(id); setMySubFilter('All'); setAllSubFilter('All'); setMyWorkSubTab('submissions'); setReviewSubTab(!isAdmin && !isOwner && id === 'review' ? (assignedReviewQueue.length > 0 ? 'my-reviews' : 'demo-requests') : 'submissions'); setAllSubTab('submissions'); }}
                  className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    active ? 'text-sky-700' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    active ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-500'
                  }`}>{count}</span>
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-sky-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-auto mt-4 w-[calc(100%-2rem)] max-w-5xl rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tab Content ─────────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-5xl px-4 pt-6">

        {/* ── MY WORK ────────────────────────────────────────────────── */}
        {activeTab === 'my-work' && (
          <div>
            <SubTabs
              tabs={[
                { id: 'submissions', label: 'My Submissions',         count: mySubmissions.length },
                { id: 'clones',      label: 'My Repo Access Requests', count: myCloneRequests.length },
                { id: 'demo-requests', label: 'My Demo Requests', count: myDemoRequests.length },
                ...(incomingForMyWork.length > 0
                  ? [{ id: 'incoming-clones', label: 'Incoming Clone Requests', count: incomingForMyWork.length, urgent: incomingForMyWork.some(r => r.status === 'Pending') }]
                  : []),
              ]}
              active={myWorkSubTab}
              onChange={(t) => { setMyWorkSubTab(t as typeof myWorkSubTab); setMySubFilter('All'); }}
            />
            <div className="mt-6">
              {myWorkSubTab === 'submissions' && (
                <Section
                  title="My Submissions"
                  count={filteredMySubmissions.length}
                  total={mySubmissions.length}
                  statusFilter={mySubFilter}
                  onStatusChange={setMySubFilter}
                  statusOptions={statusOptions}
                  action={<Button variant="outline" onClick={downloadMyWork}><Download className="mr-2 h-4 w-4" />Download</Button>}
                >
                  {filteredMySubmissions.length === 0 ? (
                    <EmptyState message={mySubmissions.length === 0 ? 'No submissions yet.' : 'No submissions match this filter.'} />
                  ) : filteredMySubmissions.map((sub, i) => (
                    <SubmissionCard key={sub.id} sub={sub} index={i} role={role} userId={user?.id}
                      showSubmitter={false}
                      onApprove={handleApprove} onReject={handleReject} onFinalReject={handleFinalReject}
                      onHold={handleHold} onPublish={handlePublish} onDelete={handleDelete}
                      actionLoading={actionLoading} />
                  ))}
                </Section>
              )}
              {myWorkSubTab === 'clones' && (
                <Section title="My Repo Access Requests" count={myCloneRequests.length}
                  action={<Button variant="outline" onClick={downloadMyWork}><Download className="mr-2 h-4 w-4" />Download</Button>}>
                  {myCloneRequests.length === 0 ? (
                    <EmptyState message="You haven't requested access to any repositories yet." />
                  ) : (
                    <CloneRequestList requests={myCloneRequests} mode="mine"
                      actionLoading={actionLoading} onCancel={handleCancelClone} />
                  )}
                </Section>
              )}
              {myWorkSubTab === 'demo-requests' && (
                <Section title="My Demo Requests" count={myDemoRequests.length}
                  action={<Button variant="outline" onClick={downloadMyWork}><Download className="mr-2 h-4 w-4" />Download</Button>}>
                  {myDemoRequests.length === 0 ? (
                    <EmptyState message="You haven't submitted any customer demo requests yet." />
                  ) : (
                    <div className="space-y-3">
                      {myDemoRequests.map(dr => (
                        <DemoRequestCard key={dr.id} request={dr} />
                      ))}
                    </div>
                  )}
                </Section>
              )}
              {myWorkSubTab === 'incoming-clones' && (
                <Section title="Incoming Clone Requests" count={incomingForMyWork.length}
                  badge={incomingForMyWork.filter(r => r.status === 'Pending').length > 0
                    ? { label: `${incomingForMyWork.filter(r => r.status === 'Pending').length} pending`, color: 'violet' }
                    : undefined}
                  action={<Button variant="outline" onClick={downloadMyWork}><Download className="mr-2 h-4 w-4" />Download</Button>}>
                  {incomingForMyWork.length === 0 ? (
                    <EmptyState message="No repo access requests for your assets." />
                  ) : (
                    <CloneRequestList requests={incomingForMyWork} mode="incoming"
                      actionLoading={actionLoading}
                      onApprove={handleCloneApprove} onDeny={handleCloneDeny} />
                  )}
                </Section>
              )}
            </div>
          </div>
        )}

        {/* ── REVIEW QUEUE ───────────────────────────────────────────── */}
        {activeTab === 'review' && (
          <div>
            <SubTabs
              tabs={[
                ...((isAdmin || isOwner) ? [{ id: 'submissions', label: 'Asset Approvals', count: pendingQueue.length + publishQueue.length, urgent: pendingQueue.length + publishQueue.length > 0 }] : []),
                { id: 'my-reviews', label: 'My Review Queue', count: assignedReviewQueue.length, urgent: assignedReviewQueue.length > 0 },
                ...((isAdmin || isOwner) ? [{ id: 'clones', label: 'Repo Clone Requests', count: cloneRequests.length, urgent: pendingCloneCount > 0 }] : []),
                { id: 'demo-requests', label: 'Demo Requests', count: pendingDemoCount, urgent: pendingDemoCount > 0 },
              ]}
              active={reviewSubTab}
              onChange={(t) => setReviewSubTab(t as typeof reviewSubTab)}
            />
            <div className="mt-6 space-y-8">
              {reviewSubTab === 'submissions' && (
                <>
                  {(isAdmin || isOwner) && (
                    <Section title="Approval Queue" count={pendingQueue.length}
                      badge={pendingQueue.length > 0 ? { label: `${pendingQueue.length} pending`, color: 'amber' } : undefined}
                      action={<Button variant="outline" onClick={() => downloadReviewQueue('approval')}><Download className="mr-2 h-4 w-4" />Download</Button>}>
                      {pendingQueue.length === 0 ? (
                        <EmptyState message="No submissions awaiting approval." />
                      ) : pendingQueue.map((sub, i) => (
                        <SubmissionCard key={sub.id} sub={sub} index={i} role={role} userId={user?.id}
                          showSubmitter
                          onApprove={handleApprove} onReject={handleReject} onFinalReject={handleFinalReject}
                          onHold={handleHold} onPublish={handlePublish} onDelete={handleDelete}
                          onAssign={handleAssignReview}
                          actionLoading={actionLoading} />
                      ))}
                    </Section>
                  )}
                  {isOwner && (
                    <Section title="Publish Queue" count={publishQueue.length}
                      badge={publishQueue.length > 0 ? { label: `${publishQueue.length} ready to publish`, color: 'emerald' } : undefined}
                      action={<Button variant="outline" onClick={() => downloadReviewQueue('publish')}><Download className="mr-2 h-4 w-4" />Download</Button>}>
                      {publishQueue.length === 0 ? (
                        <EmptyState message="No approved submissions waiting to publish." />
                      ) : publishQueue.map((sub, i) => (
                        <SubmissionCard key={sub.id} sub={sub} index={i} role={role} userId={user?.id}
                          showSubmitter
                          onApprove={handleApprove} onReject={handleReject} onFinalReject={handleFinalReject}
                          onHold={handleHold} onPublish={handlePublish} onDelete={handleDelete}
                          actionLoading={actionLoading} />
                      ))}
                    </Section>
                  )}
                </>
              )}
              {reviewSubTab === 'clones' && (
                <Section title="Repo Access Requests" count={cloneRequests.length}
                  badge={pendingCloneCount > 0 ? { label: `${pendingCloneCount} pending`, color: 'violet' } : undefined}
                  action={<Button variant="outline" onClick={() => downloadReviewQueue('clones')}><Download className="mr-2 h-4 w-4" />Download</Button>}>
                  {cloneRequests.length === 0 ? (
                    <EmptyState message="No repo access requests for your assets." />
                  ) : (
                    <CloneRequestList requests={cloneRequests} mode="incoming"
                      actionLoading={actionLoading}
                      onApprove={handleCloneApprove} onDeny={handleCloneDeny} />
                  )}
                </Section>
              )}
              {reviewSubTab === 'my-reviews' && (
                <Section title="My Review Queue" count={assignedReviewQueue.length}
                  badge={assignedReviewQueue.length > 0 ? { label: `${assignedReviewQueue.length} assigned`, color: 'violet' } : undefined}
                  action={<Button variant="outline" onClick={() => downloadReviewQueue('assigned')}><Download className="mr-2 h-4 w-4" />Download</Button>}>
                  {assignedReviewQueue.length === 0 ? (
                    <EmptyState message="No asset approvals are assigned to you." />
                  ) : assignedReviewQueue.map((sub, i) => (
                    <SubmissionCard key={sub.id} sub={sub} index={i} role={role} userId={user?.id}
                      showSubmitter onApprove={handleApprove} onReject={handleReject}
                      onFinalReject={handleFinalReject} onHold={handleHold}
                      onPublish={handlePublish} onDelete={handleDelete} actionLoading={actionLoading} />
                  ))}
                </Section>
              )}
              {reviewSubTab === 'demo-requests' && (
                <Section title="Demo Requests" count={allDemoRequests.length}
                  badge={pendingDemoCount > 0
                    ? { label: `${pendingDemoCount} pending`, color: 'amber' }
                    : undefined}
                  action={<Button variant="outline" onClick={() => downloadReviewQueue('demos')}><Download className="mr-2 h-4 w-4" />Download</Button>}>
                  {allDemoRequests.length === 0 ? (
                    <EmptyState message="No demo requests have been submitted." />
                  ) : (
                    <div className="space-y-3">
                      {allDemoRequests.map(request => (
                        <DemoRequestCard key={request.id} request={request} showRequester
                          actionLoading={actionLoading}
                          onApprove={handleDemoApprove} onReject={handleDemoReject} />
                      ))}
                    </div>
                  )}
                </Section>
              )}
            </div>
          </div>
        )}

        {/* ── ALL ACTIVITY ───────────────────────────────────────────── */}
        {activeTab === 'all-activity' && (
          <div>
            <SubTabs
              tabs={[
                ...(isOwner ? [{ id: 'submissions', label: 'All Submissions', count: logicalAllSubmissions.length }] : []),
                { id: 'clones', label: 'All Clone Requests', count: allCloneRequests.length },
                { id: 'demo-requests', label: 'All Demo Requests', count: allDemoRequests.length },
              ]}
              active={allSubTab}
              onChange={(t) => setAllSubTab(t as typeof allSubTab)}
            />
            <div className="mt-6">
              {allSubTab === 'submissions' && isOwner && (
                <Section
                  title="All Submissions"
                  count={filteredAllSubmissions.length}
                  total={logicalAllSubmissions.length}
                  statusFilter={allSubFilter}
                  onStatusChange={setAllSubFilter}
                  statusOptions={statusOptions}
                  action={<Button variant="outline" onClick={() => void downloadAllActivity()} disabled={activityDownloading}><Download className="mr-2 h-4 w-4" />{activityDownloading ? 'Generating...' : 'Download'}</Button>}
                >
                  {filteredAllSubmissions.length === 0 ? (
                    <EmptyState message={logicalAllSubmissions.length === 0 ? 'No submissions found.' : 'No submissions match this filter.'} />
                  ) : filteredAllSubmissions.map((sub, i) => (
                    <SubmissionCard key={sub.id} sub={sub} index={i} role={role} userId={user?.id}
                      showSubmitter
                      onApprove={handleApprove} onReject={handleReject} onFinalReject={handleFinalReject}
                      onHold={handleHold} onPublish={handlePublish} onDelete={handleDelete}
                      actionLoading={actionLoading} />
                  ))}
                </Section>
              )}
              {allSubTab === 'clones' && (isAdmin || isOwner) && (
                <Section title="All Clone Requests" count={allCloneRequests.length}
                  action={<Button variant="outline" onClick={() => void downloadAllActivity()} disabled={activityDownloading}><Download className="mr-2 h-4 w-4" />{activityDownloading ? 'Generating...' : 'Download'}</Button>}>
                  {allCloneRequests.length === 0 ? (
                    <EmptyState message="No clone requests on the platform yet." />
                  ) : (
                    <CloneRequestList requests={allCloneRequests} mode="all" actionLoading={actionLoading} />
                  )}
                </Section>
              )}
              {allSubTab === 'demo-requests' && (isAdmin || isOwner) && (
                <Section title="All Customer Demo Requests" count={allDemoRequests.length}
                  action={<Button variant="outline" onClick={() => void downloadAllActivity()} disabled={activityDownloading}><Download className="mr-2 h-4 w-4" />{activityDownloading ? 'Generating...' : 'Download'}</Button>}>
                  {allDemoRequests.length === 0 ? (
                    <EmptyState message="No customer demo requests on the platform yet." />
                  ) : (
                    <div className="space-y-3">
                      {allDemoRequests.map(dr => (
                        <DemoRequestCard key={dr.id} request={dr} showRequester />
                      ))}
                    </div>
                  )}
                </Section>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Pipeline sub-components ───────────────────────────────────────────────────

interface SubTabDef { id: string; label: string; count: number; urgent?: boolean }

function SubTabs({ tabs, active, onChange }: { tabs: SubTabDef[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
      {tabs.map(({ id, label, count, urgent }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              isActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
              isActive
                ? urgent ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                : urgent ? 'bg-amber-100 text-amber-600' : 'bg-gray-200 text-gray-500'
            }`}>{count}</span>
            {urgent && !isActive && (
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-amber-400" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center">
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}

interface SectionProps {
  title: string;
  count: number;
  total?: number;
  statusFilter?: string;
  onStatusChange?: (v: string) => void;
  statusOptions?: string[];
  badge?: { label: string; color: 'amber' | 'emerald' | 'violet' | 'rose' };
  action?: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, count, total, statusFilter, onStatusChange, statusOptions, badge, action, children }: SectionProps) {
  const badgeColors = {
    amber:   'bg-amber-100 text-amber-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    violet:  'bg-violet-100 text-violet-700',
    rose:    'bg-rose-100 text-rose-700',
  };
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-800">{title}</h2>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500 tabular-nums">
            {total !== undefined && statusFilter !== 'All' ? `${count} of ${total}` : count}
          </span>
          {badge && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeColors[badge.color]}`}>
              {badge.label}
            </span>
          )}
        </div>
        {(action || (onStatusChange && statusOptions)) && (
          <div className="flex items-center gap-2">
            {onStatusChange && statusOptions && (
              <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 shadow-sm">
                <Filter className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <select
                  value={statusFilter}
                  onChange={e => onStatusChange(e.target.value)}
                  className="bg-transparent text-xs font-medium text-gray-600 outline-none cursor-pointer"
                >
                  {statusOptions.map(s => (
                    <option key={s} value={s}>
                      {s === 'All' ? 'All statuses' : (STATUS_CONFIG[s]?.label ?? s)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {action}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

interface CloneRequestListProps {
  requests: CloneRequest[];
  mode: 'mine' | 'incoming' | 'all';
  actionLoading: string | null;
  onApprove?: (id: string) => void;
  onDeny?: (id: string) => void;
  onCancel?: (id: string) => void;
}

function CloneRequestList({ requests, mode, actionLoading, onApprove, onDeny, onCancel }: CloneRequestListProps) {
  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      Approved:  'bg-emerald-100 text-emerald-700',
      Denied:    'bg-rose-100 text-rose-600',
      Cancelled: 'bg-gray-100 text-gray-500',
      Pending:   'bg-amber-100 text-amber-600',
    };
    return map[status] ?? 'bg-gray-100 text-gray-500';
  };
  return (
    <div className="flex flex-col gap-3">
      {requests.map((req) => {
        const isActing = actionLoading === req.id;
        const isPending = req.status === 'Pending';
        return (
          <motion.div key={req.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <GitBranch className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span className="font-semibold text-sm text-gray-900 truncate">{req.asset_title ?? req.asset_id}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadge(req.status)}`}>
                    {req.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                  {mode !== 'mine' && (req.requester_name || req.requester_email) && (
                    <span>By: <span className="font-medium text-gray-700">{req.requester_name ?? req.requester_email}</span></span>
                  )}
                  <span>Env: <span className="font-medium text-gray-700">{req.environment}</span></span>
                  {req.purpose && <span>{req.purpose}</span>}
                  {req.customer_name && <span>{req.customer_name}{req.project_name ? ` / ${req.project_name}` : ''}</span>}
                  <span>{new Date(req.created_at).toLocaleDateString()}</span>
                </div>
                {req.reason && (
                  <p className="mt-2 text-xs text-gray-500 rounded-lg bg-gray-50 px-3 py-2 italic">"{req.reason}"</p>
                )}
                {req.status === 'Approved' && !req.clone_token_uuid && mode === 'mine' && (
                  <p className="mt-1.5 text-xs text-emerald-600 font-medium">✓ Access approved — repo link sent by email.</p>
                )}
                {req.status === 'Denied' && mode === 'mine' && (
                  <p className="mt-1.5 text-xs text-rose-500">Not approved. Contact the asset owner for details.</p>
                )}
                {req.status === 'Cancelled' && mode === 'mine' && (
                  <p className="mt-1.5 text-xs text-gray-400">You cancelled this request.</p>
                )}
                {req.status === 'Approved' && mode === 'incoming' && (
                  <p className="mt-1.5 text-xs text-emerald-600 font-medium">✓ Approved — remember to add them as a collaborator if the repo is private.</p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {mode === 'mine' && req.status === 'Approved' && req.clone_token_uuid && (
                  <a href={`/clone/token/${req.clone_token_uuid}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600 transition-colors">
                    <GitBranch className="h-3.5 w-3.5" /> Clone Repo
                  </a>
                )}
                {mode === 'mine' && isPending && onCancel && (
                  <button onClick={() => onCancel(req.id)} disabled={isActing}
                    className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-50 disabled:opacity-50 transition-colors">
                    {isActing ? '…' : 'Cancel'}
                  </button>
                )}
                {mode === 'incoming' && isPending && onApprove && onDeny && (
                  <div className="flex gap-2">
                    <button onClick={() => onApprove(req.id)} disabled={isActing}
                      className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-100 disabled:opacity-50 transition-colors">
                      {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Approve
                    </button>
                    <button onClick={() => onDeny(req.id)} disabled={isActing}
                      className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-100 disabled:opacity-50 transition-colors">
                      <XCircle className="h-3 w-3" /> Deny
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function DemoRequestCard({ request, showRequester, actionLoading, onApprove, onReject }: {
  request: DemoRequest;
  showRequester?: boolean;
  actionLoading?: string | null;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  const isPending = request.status === 'Pending';
  const isActing = actionLoading === request.id;
  const statusClass = request.status === 'Approved'
    ? 'bg-emerald-100 text-emerald-700'
    : request.status === 'Rejected'
      ? 'bg-rose-100 text-rose-700'
      : 'bg-amber-100 text-amber-700';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{request.asset_title ?? request.asset_id}</p>
          <div className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600">
            <span><span className="font-medium text-gray-400">Customer</span> {request.customer_name}</span>
            <span><span className="font-medium text-gray-400">Project</span> {request.project_name}</span>
            {request.vertical && (
              <span><span className="font-medium text-gray-400">Vertical</span> {request.vertical}</span>
            )}
            {showRequester && request.requester_name && (
              <span><span className="font-medium text-gray-400">Requestor</span> {request.requester_name}</span>
            )}
            <span><span className="font-medium text-gray-400">Date</span> {new Date(request.requested_at).toLocaleDateString()}</span>
          </div>
          {request.additional_details && (
            <p className="mt-2 text-xs text-gray-500 leading-relaxed border-t border-amber-100 pt-2">
              <span className="font-medium text-gray-400">Details </span>{request.additional_details}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusClass}`}>
            {request.status}
          </span>
          {isPending && onApprove && onReject && (
            <div className="flex gap-2">
              <button onClick={() => onApprove(request.id)} disabled={isActing}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Approve
              </button>
              <button onClick={() => onReject(request.id)} disabled={isActing}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50">
                <XCircle className="h-3 w-3" /> Reject
              </button>
            </div>
          )}
        </div>
      </div>
      {request.decision_notes && (
        <p className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-500">
          <span className="font-semibold">Decision notes:</span> {request.decision_notes}
        </p>
      )}
    </motion.div>
  );
}
