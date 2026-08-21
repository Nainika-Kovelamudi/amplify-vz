import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, GitBranch, Play, CheckCircle2, Clock, X, Loader2,
  Cpu, Cloud, Calendar, Building2, Hash, Layers, Info, FileCode2,
  BarChart2, User, ExternalLink, Shield, Zap, BookOpen, Heart,
  Terminal, Package, Users, Copy, Check, ChevronRight, Star,
  GitMerge, Download, Rocket, MonitorPlay, XCircle, Mail, MessageSquare, Send, Trash2, AlertTriangle,
} from 'lucide-react';
import { defaultFamilyBadge, useFamilies } from '../context/FamiliesContext';
import { Button } from '../components/ui/Button';
import { getCatalogAsset, getCatalog, toggleAssetLike, trackArtifactDownload, trackDemoView, trackAssetView, getAssetFeedback, submitAssetFeedback, deleteCatalogAsset, type CatalogAsset, type AssetFeedback } from '../lib/catalogService';
import { useAuth } from '../context/AuthContext';
import { requestClone, resendCloneLink, getMyCloneRequests, getAllCloneRequests, type CloneRequest } from '../lib/cloneService';
import { createDemoRequest, getAllDemoRequests, getMyDemoRequests, type DemoRequest } from '../lib/demoRequestService';

// ── Toast ─────────────────────────────────────────────────────────────────────
interface Toast { id: number; type: 'success' | 'error' | 'info'; title: string; message: string }

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 w-80">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id}
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${
              t.type === 'success' ? 'border-emerald-200 bg-emerald-50'
              : t.type === 'error' ? 'border-rose-200 bg-rose-50'
              : 'border-sky-200 bg-sky-50'
            }`}>
            <div className="mt-0.5 shrink-0">
              {t.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                : t.type === 'error' ? <X className="h-5 w-5 text-rose-500" />
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

// ── helpers ───────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'architecture' | 'quickstart' | 'ai';

const MATURITY_STYLE: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  Experimental:    { label: 'Experimental',  color: '#F59E0B', bg: '#FEF3C7', icon: Zap },
  'Battle-Tested': { label: 'Battle-Tested', color: '#0EA5E9', bg: '#E0F2FE', icon: Shield },
  Production:      { label: 'Production',    color: '#10B981', bg: '#D1FAE5', icon: CheckCircle2 },
  // legacy aliases
  experimental:    { label: 'Experimental',  color: '#F59E0B', bg: '#FEF3C7', icon: Zap },
  validated:       { label: 'Production',    color: '#10B981', bg: '#D1FAE5', icon: CheckCircle2 },
  'battle-tested': { label: 'Battle-Tested', color: '#0EA5E9', bg: '#E0F2FE', icon: Shield },
  Beta:            { label: 'Battle-Tested', color: '#0EA5E9', bg: '#E0F2FE', icon: Shield },
  Prototype:       { label: 'Experimental',  color: '#F59E0B', bg: '#FEF3C7', icon: Zap },
};

const AGENT_META: Record<string, { label: string; icon: string; weight: number; desc: string }> = {
  relevance:       { label: 'Relevance',       icon: '🎯', weight: 25, desc: 'Business value and alignment with InfoVision service lines' },
  tech_quality:    { label: 'Tech Quality',    icon: '⚙️', weight: 30, desc: 'Architecture, security, scalability, cloud-native patterns' },
  description:     { label: 'Description',     icon: '📝', weight: 15, desc: 'Clarity, completeness and discoverability' },
  demo_readiness:  { label: 'Demo Readiness',  icon: '🎬', weight: 20, desc: 'Client-presentable, demo video, maturity, setup complexity' },
  duplicate_check: { label: 'Duplicate Check', icon: '🔍', weight: 10, desc: 'Novelty vs existing catalog assets' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, backgroundColor: color }} />
    </div>
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

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-3">
      <Icon className="h-4 w-4" style={{ color }} />
      <span className="text-lg font-bold tabular-nums" style={{ color }}>{value}</span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{label}</span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} className="rounded p-1 text-gray-500 hover:text-white transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function InitialsAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
  const sz = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-10 w-10 text-sm';
  return (
    <div className={`${sz} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 font-bold text-white`}>
      {initials || '?'}
    </div>
  );
}

const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000';

// Local fallback uploads (/media/local/...) need the backend base URL prepended
function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('/media/local/')) return `${API_BASE}${url}`;
  return url;
}

// ── main component ────────────────────────────────────────────────────────────

export function AssetDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { families } = useFamilies();
  const { user } = useAuth();

  const [asset, setAsset]                     = useState<CatalogAsset | null>(null);
  const [related, setRelated]                 = useState<CatalogAsset[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [activeTab, setActiveTab]             = useState<TabId>('overview');
  const [existingRequest, setExistingRequest] = useState<CloneRequest | null>(null);
  const [likeCount, setLikeCount]             = useState(0);
  const [likedByMe, setLikedByMe]             = useState(false);
  const [liking, setLiking]                   = useState(false);
  const [showVideoModal, setShowVideoModal]   = useState(false);
  const [downloadCount, setDownloadCount]     = useState(0);
  const [demoViewCount, setDemoViewCount]     = useState(0);

  const [showModal, setShowModal]             = useState(false);
  const [resending, setResending]             = useState(false);
  const [requestReason, setRequestReason]     = useState('');
  const [requestPurpose, setRequestPurpose]   = useState('');
  const [requestCustomerName, setRequestCustomerName] = useState('');
  const [requestProjectName, setRequestProjectName]   = useState('');
  const [requestVertical, setRequestVertical]         = useState('');

  const [toasts, setToasts]   = useState<Toast[]>([]);
  const toastIdRef            = useRef(0);
  const addToast              = useCallback((type: Toast['type'], title: string, message: string) => {
    const id = ++toastIdRef.current;
    setToasts(p => [...p, { id, type, title, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  }, []);
  const [requestEnv, setRequestEnv]           = useState('Development');
  const [submitting, setSubmitting]           = useState(false);
  const [requestError, setRequestError]       = useState('');

  // Feedback
  const [feedbacks, setFeedbacks]             = useState<AssetFeedback[]>([]);
  const [fbName, setFbName]                   = useState('');
  const [fbEmail, setFbEmail]                 = useState('');
  const [fbComment, setFbComment]             = useState('');
  const [fbSubmitting, setFbSubmitting]       = useState(false);
  const [fbError, setFbError]                 = useState('');

  const isAdmin        = user?.role === 'Aimplify.Admin' || user?.role === 'Aimplify.Owner';
  const isPlatformOwner = user?.role === 'Aimplify.Owner';
  const isAssetOwner = !!user && asset?.owner_id === user.id;

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading]         = useState(false);

  // Demo request modal
  const [showDemoReqModal, setShowDemoReqModal]       = useState(false);
  const [demoReqCustomer, setDemoReqCustomer]         = useState('');
  const [demoReqProject, setDemoReqProject]           = useState('');
  const [demoReqVertical, setDemoReqVertical]         = useState('');
  const [demoReqDetails, setDemoReqDetails]           = useState('');
  const [demoReqSubmitting, setDemoReqSubmitting]     = useState(false);
  const [demoReqError, setDemoReqError]               = useState('');
  const [demoRequestCount, setDemoRequestCount]       = useState(0);
  const [allCloneReqs, setAllCloneReqs]               = useState<CloneRequest[]>([]);
  const [allDemoReqs, setAllDemoReqs]                 = useState<DemoRequest[]>([]);
  const [reqsModal, setReqsModal]                     = useState<'clone' | 'demo' | null>(null);

  const handleDeleteAsset = async () => {
    if (!asset) return;
    setDeleteLoading(true);
    try {
      await deleteCatalogAsset(asset.id);
      navigate('/catalog');
    } catch {
      addToast('error', 'Delete failed', 'Could not delete this asset. Please try again.');
      setShowDeleteConfirm(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDemoRequest = async () => {
    if (!demoReqCustomer.trim()) { setDemoReqError('Please enter the customer name.'); return; }
    if (!demoReqProject.trim()) { setDemoReqError('Please enter the project / opportunity name.'); return; }
    setDemoReqSubmitting(true); setDemoReqError('');
    try {
      await createDemoRequest({
        asset_id: asset!.id,
        customer_name: demoReqCustomer.trim(),
        project_name: demoReqProject.trim(),
        vertical: demoReqVertical.trim() || undefined,
        additional_details: demoReqDetails.trim() || undefined,
      });
      setDemoRequestCount(c => c + 1);
      setShowDemoReqModal(false);
      setDemoReqCustomer(''); setDemoReqProject(''); setDemoReqVertical(''); setDemoReqDetails('');
      addToast('success', 'Demo Request Submitted!', 'The asset owner has been notified of your customer demo request.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setDemoReqError(msg ?? 'Submission failed. Please try again.');
    } finally {
      setDemoReqSubmitting(false);
    }
  };

  // Pre-fill feedback form from logged-in user
  useEffect(() => {
    if (user && !fbName && !fbEmail) {
      setFbName(user.display_name ?? '');
      setFbEmail(user.email ?? '');
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || !asset) return;
    getMyCloneRequests().then((reqs) => {
      const match = reqs.find((r) => r.asset_id === asset.id);
      if (match) setExistingRequest(match);
    }).catch(() => {});
  }, [user, asset]);

  useEffect(() => {
    if (!user || !asset) return;
    let cancelled = false;
    if (isAdmin) {
      getAllCloneRequests()
        .then((reqs) => { if (!cancelled) setAllCloneReqs(reqs.filter((r) => r.asset_id === asset.id)); })
        .catch(() => {});
      getAllDemoRequests()
        .then((reqs) => { if (!cancelled) setAllDemoReqs(reqs.filter((r) => r.asset_id === asset.id)); })
        .catch(() => {});
    } else {
      getMyCloneRequests()
        .then((reqs) => { if (!cancelled) setAllCloneReqs(reqs.filter((r) => r.asset_id === asset.id)); })
        .catch(() => {});
      getMyDemoRequests()
        .then((reqs) => { if (!cancelled) setAllDemoReqs(reqs.filter((r) => r.asset_id === asset.id)); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [isAdmin, user, asset]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const [current, { items }] = await Promise.all([getCatalogAsset(slug), getCatalog({ limit: 100 })]);
        if (!cancelled) {
          setAsset(current);
          setLikeCount(current.like_count ?? 0);
          setLikedByMe(current.liked_by_me ?? false);
          setDownloadCount(current.artifact_download_count ?? 0);
          setDemoViewCount(current.demo_view_count ?? 0);
          setDemoRequestCount(current.demo_request_count ?? 0);
          setRelated(items.filter((a) => a.id !== current.id && a.family === current.family).slice(0, 4));
          getAssetFeedback(current.id).then(setFeedbacks).catch(() => {});
          trackAssetView(current.id);
        }
      } catch { if (!cancelled) setAsset(null); }
      finally  { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const handleRequestAccess = async () => {
    if (!requestPurpose) { setRequestError('Please select a purpose for cloning.'); return; }
    if (requestReason.length < 20) { setRequestError('Please provide at least 20 characters in the reason.'); return; }
    const isCustomer = requestPurpose === 'Customer';
    if (isCustomer && !requestCustomerName.trim()) { setRequestError('Please enter the customer name.'); return; }
    if (!requestProjectName.trim()) { setRequestError('Please enter the project details.'); return; }
    setSubmitting(true); setRequestError('');
    try {
      const req = await requestClone(
        asset!.id, requestReason, requestEnv,
        requestPurpose,
        isCustomer ? requestCustomerName.trim() : undefined,
        requestProjectName.trim(),
      );
      setExistingRequest(req);
      setShowModal(false);
      setRequestReason(''); setRequestPurpose(''); setRequestCustomerName('');
      setRequestProjectName(''); setRequestVertical('');
      addToast('success', 'Request Submitted!', 'Your clone access request has been sent to the asset owner. You\'ll be notified by email once it\'s reviewed.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setRequestError(msg ?? 'Request failed. Please try again.');
      addToast('error', 'Submission Failed', msg ?? 'Request failed. Please try again.');
    } finally { setSubmitting(false); }
  };

  const handleResendLink = async () => {
    if (!existingRequest || resending) return;
    setResending(true);
    try {
      await resendCloneLink(existingRequest.id);
      addToast('success', 'Link Resent!', 'The repository access link has been resent to your email address.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      addToast('error', 'Resend Failed', msg ?? 'Could not resend the link. Please try again.');
    } finally { setResending(false); }
  };

  const handleFeedbackSubmit = async () => {
    if (!fbComment.trim()) {
      setFbError('Please enter a comment.');
      return;
    }
    if (fbComment.trim().length < 5) {
      setFbError('Comment must be at least 5 characters.');
      return;
    }
    const authorName  = user?.display_name ?? fbName.trim();
    const authorEmail = user?.email ?? fbEmail.trim();
    if (!authorName || !authorEmail) {
      setFbError('Unable to identify your profile. Please log in again.');
      return;
    }
    setFbSubmitting(true);
    setFbError('');
    try {
      const created = await submitAssetFeedback(asset!.id, {
        name: authorName,
        email: authorEmail,
        comment: fbComment.trim(),
      });
      setFeedbacks(prev => [created, ...prev]);
      setFbComment('');
      addToast('success', 'Feedback submitted!', 'Thank you for your feedback.');
    } catch {
      setFbError('Failed to submit. Please try again.');
    } finally {
      setFbSubmitting(false);
    }
  };

  const handleLike = async () => {
    if (liking || !asset) return;
    setLiking(true);
    try {
      const res = await toggleAssetLike(asset.id);
      setLikeCount(res.like_count);
      setLikedByMe(res.liked_by_me);
    } catch {} finally { setLiking(false); }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <h2 className="text-xl font-bold text-gray-900">Asset not found</h2>
        <p className="text-sm text-gray-500">This asset may have been removed or is not yet published.</p>
        <Button onClick={() => navigate('/catalog')}>Back to Catalog</Button>
      </div>
    );
  }

  const demoVideos = [...new Set(asset.video_urls ?? [])];
  const primaryVideoUrl = demoVideos[0] ?? '';

  const fm             = families[asset.family] ?? defaultFamilyBadge();
  const techStack      = Array.isArray(asset.tech_stack) ? asset.tech_stack : [];
  const collaborators  = Array.isArray(asset.collaborators) ? asset.collaborators : [];
  const commands       = Array.isArray(asset.commands) ? asset.commands : [];
  const aiScore        = typeof asset.ai_score === 'number' ? Math.round(asset.ai_score) : null;
  const aiFb           = asset.ai_feedback as Record<string, unknown> | null;
  const agentScores    = aiFb?.agent_scores    as Record<string, number>                               | undefined;
  const agentFeedback  = aiFb?.agent_feedback as Record<string, { score: number; feedback: string }> | undefined;
  const aiSummary      = aiFb?.summary         as string | undefined;
  const cloneCount       = (asset as CatalogAsset & { clone_request_count?: number }).clone_request_count ?? 0;
  const deploymentCount  = (asset as CatalogAsset & { deployment_count?: number }).deployment_count ?? 0;

  const maturity     = MATURITY_STYLE[asset.maturity ?? ''];
  const MaturityIcon = maturity?.icon ?? Shield;

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',      label: 'Overview',      icon: <BookOpen   className="h-3.5 w-3.5" /> },
    { id: 'architecture',  label: 'Artifacts & Media',  icon: <FileCode2  className="h-3.5 w-3.5" /> },
    { id: 'quickstart',    label: 'Quick Start',   icon: <Terminal   className="h-3.5 w-3.5" /> },
    ...(isAdmin || isAssetOwner
      ? [{ id: 'ai' as TabId, label: 'AI Evaluation', icon: <BarChart2 className="h-3.5 w-3.5" /> }]
      : []),
  ];

  const repoStatusBadge = existingRequest ? (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
      existingRequest.status === 'Approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : existingRequest.status === 'Denied' ? 'border-rose-200 bg-rose-50 text-rose-600'
      : 'border-amber-200 bg-amber-50 text-amber-700'
    }`}>
      {existingRequest.status === 'Approved' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
      {existingRequest.status === 'Approved' ? 'Access Approved' : existingRequest.status === 'Denied' ? 'Request Denied' : 'Pending Review'}
    </span>
  ) : null;

  // Build changelog from asset dates
  const changelog = [
    { version: 'v1.0.0', label: 'Published', date: asset.created_at, note: 'Initial submission and AI evaluation.' },
    ...(asset.updated_at && asset.updated_at !== asset.created_at
      ? [{ version: 'v1.1', label: 'Updated', date: asset.updated_at, note: 'Content, metadata or evaluation updated.' }]
      : []),
  ].reverse();

  return (
    <div className="animate-in fade-in duration-300 min-h-screen bg-gray-50/50 pb-16">

      {/* ── Header (scrolls away) ─────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200">
        {/* Coloured top stripe using family colour */}
        <div className="h-1 w-full" style={{ backgroundColor: fm.color }} />

        <div className="mx-auto max-w-7xl px-4 md:px-8 py-4 space-y-3">

          {/* Row 1 — breadcrumb */}
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <button onClick={() => navigate('/catalog')}
              className="text-violet-500 font-semibold hover:text-violet-700 transition-colors">Catalog</button>
            <ChevronRight className="h-3 w-3" />
            <button onClick={() => navigate(`/family/${asset.family}`)}
              className="font-semibold hover:underline" style={{ color: fm.color }}>{fm.name}</button>
            <ChevronRight className="h-3 w-3" />
            <span className="truncate max-w-sm">{asset.title}</span>
          </div>

          {/* Row 2 — title + right-side utility buttons */}
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 leading-snug md:text-2xl" style={{ wordBreak: 'break-word' }}>
              {asset.title}
            </h1>
            <div className="flex shrink-0 items-center gap-2">
              <button onClick={handleLike} disabled={liking}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                  likedByMe ? 'bg-rose-500 border-rose-500 text-white hover:bg-rose-600' : 'bg-white border-gray-200 text-gray-500 hover:border-rose-300 hover:text-rose-500'
                }`}>
                <Heart className={`h-3.5 w-3.5 ${likedByMe ? 'fill-white' : ''}`} />
                {likeCount > 0 && <span>{likeCount}</span>}
              </button>
              {(isAdmin || isAssetOwner) && (
                <>
                  <button onClick={() => navigate(`/submit?catalogEdit=${asset.id}`)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                    Edit Asset
                  </button>
                  {isPlatformOwner && (
                    <button onClick={() => setShowDeleteConfirm(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />Delete
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Row 3 — badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold"
              style={{ backgroundColor: `${fm.color}18`, color: fm.color }}>
              <Layers className="h-3 w-3" />{fm.name}
            </span>
            <span className="rounded-md bg-gray-100 px-2 py-1 font-mono text-[10px] font-medium text-gray-500 border border-gray-200">
              {asset.catalog_code}
            </span>
            {maturity && (
              <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold"
                style={{ backgroundColor: maturity.bg, color: maturity.color }}>
                <MaturityIcon className="h-3 w-3" />{maturity.label}
              </span>
            )}
            {asset.demo_ready && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />Demo Ready
              </span>
            )}
            <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold ${aiScore === null ? 'bg-gray-100 text-gray-400' : aiScore >= 70 ? 'bg-emerald-100 text-emerald-700' : aiScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
              <Star className="h-3 w-3" />AI Score: {aiScore !== null ? aiScore : '—'}
            </span>
            {repoStatusBadge}
          </div>

          {/* Row 4 — primary action buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => { trackDemoView(asset.id).then(() => setDemoViewCount(c => c + 1)); window.open(asset.demo_url!, '_blank', 'noreferrer'); }}
              disabled={!asset.demo_url}
              title={asset.demo_url ? 'Open live demo' : 'No live demo URL available'}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-colors shadow-sm disabled:cursor-not-allowed disabled:opacity-40 bg-violet-600 text-white hover:bg-violet-700 disabled:bg-violet-600">
              <Rocket className="h-3.5 w-3.5" />Launch Demo
            </button>
            <button
              onClick={() => { setShowVideoModal(true); trackDemoView(asset.id).then(() => setDemoViewCount(c => c + 1)); }}
              disabled={!primaryVideoUrl}
              title={primaryVideoUrl ? 'Watch demo video' : 'No demo video available'}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-colors shadow-sm disabled:cursor-not-allowed disabled:opacity-40 bg-sky-500 text-white hover:bg-sky-600 disabled:bg-sky-500">
              <MonitorPlay className="h-3.5 w-3.5" />Watch Demo
            </button>
            {!isAssetOwner && !existingRequest && (
              <button onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 transition-colors">
                <GitBranch className="h-3.5 w-3.5" />Request Repo Clone
              </button>
            )}
            <button onClick={() => { setDemoReqCustomer(''); setDemoReqProject(''); setDemoReqError(''); setShowDemoReqModal(true); }}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 transition-colors">
              <Users className="h-3.5 w-3.5" />Request Customer Demo
            </button>
          </div>

        </div>
      </div>

      {/* ── Sticky tab bar only ────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="flex">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-violet-600 text-violet-700'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                }`}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Two-column layout ──────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 pt-6 md:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">

          {/* ── Main content ───────────────────────────────────────────── */}
          <div className="min-w-0 space-y-5">

            {/* ── OVERVIEW ── */}
            {activeTab === 'overview' && (
              <>
                {/* Description */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    <BookOpen className="h-3.5 w-3.5" />About this asset
                  </h2>
                  <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">
                    {asset.description || <span className="italic text-gray-400">No description provided.</span>}
                  </p>
                </div>

                {/* Collaborators */}
                {collaborators.length > 0 && (
                  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                      <Users className="h-3.5 w-3.5" />Collaborators
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {collaborators.map((email) => (
                        <span key={email} className="inline-flex items-center gap-1.5 rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700">
                          <InitialsAvatar name={email.split('@')[0]} size="sm" />
                          <span>{email}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Family card */}
                <div className="rounded-xl border p-5 shadow-sm"
                  style={{ borderColor: `${fm.color}30`, backgroundColor: `${fm.color}08` }}>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: fm.color }}>{fm.name} Family</p>
                  <p className="mb-3 text-sm font-semibold text-gray-800">{fm.tagline}</p>
                  <button onClick={() => navigate(`/family/${asset.family}`)}
                    className="flex items-center gap-1.5 text-xs font-medium hover:underline" style={{ color: fm.color }}>
                    Explore {fm.name} <ExternalLink className="h-3 w-3" />
                  </button>
                </div>

                {/* Related assets */}
                {related.length > 0 && (
                  <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                    <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-400">More in {fm.name}</h2>
                    <div className="space-y-2">
                      {related.map((r) => (
                        <button key={r.id} onClick={() => navigate(`/catalog/${r.slug}`)}
                          className="flex w-full items-center gap-3 rounded-lg border border-gray-100 p-3 text-left hover:bg-gray-50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium text-gray-800">{r.title}</p>
                            <p className="mt-0.5 text-[10px] font-mono text-gray-400">{r.catalog_code}</p>
                          </div>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Feedback & Comments ───────────────────────────────── */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Feedback &amp; Comments
                    {feedbacks.length > 0 && (
                      <span className="ml-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-600">
                        {feedbacks.length}
                      </span>
                    )}
                  </h2>

                  {/* Submit form */}
                  <div className="mb-6 rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-500">Leave your feedback</p>
                      {user && (
                        <span className="text-[11px] text-gray-400">
                          Posting as <span className="font-semibold text-gray-600">{user.display_name ?? user.email}</span>
                        </span>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        Comment <span className="text-rose-400">*</span>
                      </label>
                      <textarea
                        value={fbComment}
                        onChange={e => setFbComment(e.target.value)}
                        rows={3}
                        placeholder="Share your experience, suggestions, or questions about this asset..."
                        className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-300"
                      />
                    </div>
                    {fbError && (
                      <p className="text-xs font-medium text-rose-500">{fbError}</p>
                    )}
                    <div className="flex justify-end">
                      <button
                        onClick={handleFeedbackSubmit}
                        disabled={fbSubmitting}
                        className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors">
                        {fbSubmitting
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Send className="h-3.5 w-3.5" />}
                        Submit Feedback
                      </button>
                    </div>
                  </div>

                  {/* Existing feedback list */}
                  {feedbacks.length === 0 ? (
                    <div className="py-8 text-center">
                      <MessageSquare className="mx-auto h-8 w-8 text-gray-200" />
                      <p className="mt-2 text-sm text-gray-400">No feedback yet. Be the first to share your thoughts!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {feedbacks.map(fb => (
                        <div key={fb.id} className="flex gap-3">
                          <InitialsAvatar name={fb.name} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-gray-800">{fb.name}</span>
                              <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                                <Mail className="h-3 w-3" />{fb.email}
                              </span>
                              <span className="ml-auto text-[11px] text-gray-300">
                                {new Date(fb.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                            <p className="mt-1 text-sm leading-relaxed text-gray-600">{fb.comment}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── ARCHITECTURE ── */}
            {activeTab === 'architecture' && (() => {
              const archRaw = asset.architecture_file_url ?? '';

              // Parse JSON multi-doc format; fall back to legacy single URL
              const DOC_SLOT_LABELS: Record<string, string> = {
                overall_architecture: 'Overall Architecture',
                sales_pitch:          'Sales Pitch Doc',
                marketing_collateral: 'Marketing Collateral',
                technical_delivery:   'Technical Delivery Doc',
              };
              let docSlots: { key: string; label: string; url: string }[] = [];
              let legacyUrl = '';
              try {
                const parsed = JSON.parse(archRaw);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                  docSlots = Object.entries(DOC_SLOT_LABELS).map(([key, label]) => ({
                    key, label, url: (parsed[key] as string) ?? '',
                  }));
                } else {
                  legacyUrl = archRaw;
                }
              } catch {
                legacyUrl = archRaw;
              }

              const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
              const DOC_EXTS   = ['pdf', 'doc', 'docx', 'pptx', 'ppt', 'xlsx', 'xls'];
              const docIcon: Record<string, string> = { pdf: '📄', doc: '📝', docx: '📝', pptx: '📊', ppt: '📊', xlsx: '📊', xls: '📊' };

              const friendlyName = (url: string) => {
                const raw = url.split('?')[0].split('/').pop() ?? 'Document';
                return raw.replace(/.*[0-9a-f]{32}_/i, '') || raw;
              };

              const DocRow = ({ label, url }: { label: string; url: string }) => {
                const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
                const isImg = IMAGE_EXTS.includes(ext);
                return (
                  <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-xl shadow-sm border border-gray-100">
                      {isImg ? '🖼️' : (docIcon[ext] ?? '📎')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
                      <p className="truncate text-sm font-medium text-gray-700">{friendlyName(url)}</p>
                    </div>
                    <a href={url} target="_blank" rel="noreferrer" download={isImg ? undefined : friendlyName(url)}
                      onClick={() => trackArtifactDownload(asset.id).then(() => setDownloadCount(c => c + 1))}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600 transition-colors">
                      <Download className="h-3.5 w-3.5" />{isImg ? 'View' : 'Download'}
                    </a>
                  </div>
                );
              };

              return (
              <>
                {/* 1 ── Architecture & Documents */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    <FileCode2 className="h-3.5 w-3.5" />Architecture &amp; Documents
                  </h2>
                  {docSlots.length > 0 ? (
                    <div className="space-y-3">
                      {docSlots.map(({ key, label, url }) =>
                        url
                          ? <DocRow key={key} label={label} url={url} />
                          : (
                            <div key={key} className="flex items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-4 text-sm text-gray-400">
                              <span className="text-base">📎</span>
                              <span><span className="font-semibold text-gray-500">{label}</span> — will be updated soon</span>
                            </div>
                          )
                      )}
                    </div>
                  ) : legacyUrl ? (
                    (() => {
                      const ext = legacyUrl.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
                      return IMAGE_EXTS.includes(ext) ? (
                        <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                          <img src={legacyUrl} alt="Architecture diagram" className="mx-auto max-h-[600px] w-full object-contain" />
                          <div className="flex items-center justify-end border-t border-gray-100 px-4 py-2">
                            <a href={legacyUrl} target="_blank" rel="noreferrer" download
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700">
                              <Download className="h-3.5 w-3.5" />Download image
                            </a>
                          </div>
                        </div>
                      ) : (
                        <DocRow label="Architecture Document" url={legacyUrl} />
                      );
                    })()
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-10 text-center">
                      <FileCode2 className="mx-auto h-8 w-8 text-gray-300" />
                      <p className="mt-2 text-sm font-medium text-gray-400">No architecture file uploaded</p>
                    </div>
                  )}
                </div>

                {/* 2 ── Demo Video */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    <Play className="h-3.5 w-3.5" />Demo Video
                  </h2>
                  {demoVideos.length ? (
                    <div className="grid gap-5 lg:grid-cols-2">
                      {demoVideos.map((videoUrl, index) => <div key={`${videoUrl}-${index}`}>
                        <p className="mb-2 text-xs font-semibold text-gray-500">{index === 0 ? 'Primary demo' : `Demo ${index + 1}`}</p>
                        <div className="overflow-hidden rounded-xl border border-gray-100">
                        {(videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) ? (
                          <iframe
                            className="w-full aspect-video"
                            src={videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/')}
                            title={`Demo video ${index + 1}`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          <video
                            className="w-full aspect-video rounded-xl bg-black"
                            src={resolveMediaUrl(videoUrl)}
                            controls
                            preload="metadata"
                          />
                        )}
                        </div>
                      <a href={videoUrl} target="_blank" rel="noreferrer"
                        className="mt-3 flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700">
                        <ExternalLink className="h-3.5 w-3.5" />Open video link
                      </a>
                      </div>)}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-10 text-center">
                      <Play className="mx-auto h-8 w-8 text-gray-300" />
                      <p className="mt-2 text-sm font-medium text-gray-400">No demo video attached</p>
                    </div>
                  )}
                </div>

                {/* 3 ── Repository Access */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    <GitBranch className="h-3.5 w-3.5" />Repository Access
                  </h2>
                  {/* Admin/Owner: always show repo URL directly */}
                  {isAdmin && asset.repo_url && (
                    <div className="mb-4 flex items-center gap-3 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3">
                      <GitBranch className="h-4 w-4 shrink-0 text-sky-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-sky-700 mb-0.5">Repository URL</p>
                        <a href={asset.repo_url} target="_blank" rel="noreferrer"
                          className="truncate text-sm font-medium text-sky-600 hover:text-sky-800 hover:underline break-all">
                          {asset.repo_url}
                        </a>
                      </div>
                      <a href={asset.repo_url} target="_blank" rel="noreferrer"
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600 transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" />Open
                      </a>
                    </div>
                  )}
                  {isAssetOwner ? (
                    <>
                      {asset.repo_url && (
                        <div className="mb-4 flex items-center gap-3 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3">
                          <GitBranch className="h-4 w-4 shrink-0 text-sky-500" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-sky-700 mb-0.5">Repository URL</p>
                            <a href={asset.repo_url} target="_blank" rel="noreferrer"
                              className="truncate text-sm font-medium text-sky-600 hover:text-sky-800 hover:underline break-all">
                              {asset.repo_url}
                            </a>
                          </div>
                          <a href={asset.repo_url} target="_blank" rel="noreferrer"
                            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600 transition-colors">
                            <ExternalLink className="h-3.5 w-3.5" />Open
                          </a>
                        </div>
                      )}
                      <p className="text-sm text-gray-500">You are the owner of this asset.</p>
                    </>
                  ) : existingRequest ? (
                    <div className={`rounded-lg border p-4 ${
                      existingRequest.status === 'Approved' ? 'border-emerald-200 bg-emerald-50'
                      : existingRequest.status === 'Denied' ? 'border-rose-200 bg-rose-50'
                      : 'border-amber-200 bg-amber-50'
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          {existingRequest.status === 'Approved'
                            ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                            : existingRequest.status === 'Denied'
                            ? <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
                            : <Clock className="h-4 w-4 shrink-0 text-amber-500" />}
                          <p className={`text-sm font-semibold ${
                            existingRequest.status === 'Approved' ? 'text-emerald-800'
                            : existingRequest.status === 'Denied' ? 'text-rose-800'
                            : 'text-amber-800'
                          }`}>
                            {existingRequest.status === 'Approved'
                              ? (asset.repo_url ? 'Repository access approved.' : 'Repository access approved — check your email for the link.')
                              : existingRequest.status === 'Denied'
                              ? 'Access request was denied.'
                              : 'Access request is pending review.'}
                          </p>
                        </div>
                        {existingRequest.status === 'Approved' && (
                          <div className="flex items-center gap-2 shrink-0">
                            {asset.repo_url && (
                              <a href={asset.repo_url} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors">
                                <ExternalLink className="h-3.5 w-3.5" />Open Repo
                              </a>
                            )}
                            <button onClick={handleResendLink} disabled={resending}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 transition-colors">
                              {resending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                              {resending ? 'Sending…' : 'Resend Link'}
                            </button>
                          </div>
                        )}
                        {existingRequest.status === 'Denied' && (
                          <button onClick={() => { setExistingRequest(null); setShowModal(true); }}
                            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors">
                            <GitBranch className="h-3.5 w-3.5" />Request Again
                          </button>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs text-gray-500">Requested on {formatDate(existingRequest.created_at)}</p>
                    </div>
                  ) : (
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <p className="mb-4 text-sm text-gray-600">
                          This asset's repository requires access approval. Request access and the asset owner will review and share the repo link.
                        </p>
                        <button onClick={() => setShowModal(true)}
                          className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-600 transition-colors shadow-sm">
                          <GitBranch className="h-4 w-4" />Request Repository Access
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tech Stack */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    <Cpu className="h-3.5 w-3.5" />Tech Stack
                  </h2>
                  {techStack.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {techStack.map((t) => (
                        <span key={t} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700">{t}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No tech stack declared.</p>
                  )}
                </div>

                {/* Metadata grid */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    <Info className="h-3.5 w-3.5" />Metadata
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[
                      { label: 'Department', value: asset.department || '—' },
                      { label: 'Cloud',      value: asset.cloud_provider || '—' },
                      { label: 'Maturity',   value: maturity?.label ?? asset.maturity ?? '—' },
                      { label: 'Demo Ready', value: asset.demo_ready ? 'Yes' : 'No' },
                      { label: 'Published',  value: formatDate(asset.created_at) },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-lg bg-gray-50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                        <p className="mt-1 text-xs font-medium text-gray-800">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
              );
            })()}

            {/* ── QUICK START ── */}
            {activeTab === 'quickstart' && (
              <>
                {/* Dependencies */}
                {asset.dependencies ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                      <Package className="h-3.5 w-3.5" />Dependencies / Prerequisites
                    </h2>
                    <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">{asset.dependencies}</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center">
                    <Package className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-2 text-sm font-medium text-gray-400">No dependencies listed</p>
                  </div>
                )}

                {/* Commands */}
                {commands.length > 0 ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                      <Terminal className="h-3.5 w-3.5" />Setup & Run Commands
                    </h2>
                    <div className="space-y-2">
                      {commands.map((cmd, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-gray-950 px-4 py-3">
                          <span className="font-mono text-sm text-emerald-400">
                            <span className="mr-2 text-gray-500">$</span>{cmd}
                          </span>
                          <CopyButton text={cmd} />
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-gray-400">Click the copy icon on any command to copy it to your clipboard.</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center">
                    <Terminal className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-2 text-sm font-medium text-gray-400">No setup commands provided</p>
                  </div>
                )}

              </>
            )}

            {/* ── AI EVALUATION — admin, owner role, or asset submitter only ── */}
            {activeTab === 'ai' && (isAdmin || isAssetOwner) && (
              <>
                {aiScore !== null && aiScore > 0 ? (
                  <>
                    {/* Score hero */}
                    <div className={`rounded-xl border-2 p-6 shadow-sm ${aiScore >= 70 ? 'border-emerald-200 bg-emerald-50' : aiScore >= 50 ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50'}`}>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <div className={`text-5xl font-bold tabular-nums ${aiScore >= 70 ? 'text-emerald-600' : aiScore >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {aiScore}
                          </div>
                          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-gray-400">/ 100</div>
                        </div>
                        <div className="flex-1">
                          <p className={`mb-2 text-sm font-bold ${aiScore >= 70 ? 'text-emerald-800' : aiScore >= 50 ? 'text-amber-800' : 'text-rose-800'}`}>
                            {aiScore >= 70 ? 'Strong Quality Score' : aiScore >= 50 ? 'Moderate Quality Score' : 'Needs Improvement'}
                          </p>
                          <ScoreBar score={aiScore} />
                          {aiSummary && (
                            <p className="mt-2 text-xs leading-relaxed text-gray-600">{aiSummary}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Agent breakdown */}
                    {agentScores && (
                      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                        <div className="border-b border-gray-100 px-6 py-4">
                          <h3 className="text-sm font-bold text-gray-800">Agent Breakdown</h3>
                          <p className="mt-0.5 text-xs text-gray-400">Each agent score contributes its weighted % to the composite</p>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {Object.entries(AGENT_META).map(([key, cfg]) => {
                            const score = agentScores[key] ?? 0;
                            const contrib = (cfg.weight * score) / 100;
                            const fb = agentFeedback?.[key];
                            const feedbackText = (fb as { feedback?: string })?.feedback;
                            const scoreColor = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444';

                            return (
                              <div key={key} className="px-6 py-5">
                                <div className="flex items-start gap-4">
                                  <span className="mt-0.5 shrink-0 text-xl">{cfg.icon}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="mb-1.5 flex items-center justify-between gap-2">
                                      <div>
                                        <span className="text-sm font-bold text-gray-900">{cfg.label}</span>
                                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">weight {cfg.weight}%</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[11px] text-gray-400 tabular-nums">+{contrib.toFixed(1)} pts</span>
                                        <span className="text-lg font-bold tabular-nums" style={{ color: scoreColor }}>{score}</span>
                                        <span className="text-xs text-gray-400">/100</span>
                                      </div>
                                    </div>
                                    <ScoreBar score={score} />
                                    <p className="mt-1.5 text-[11px] text-gray-400">{cfg.desc}</p>
                                    {feedbackText && (
                                      <p className="mt-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm leading-relaxed text-gray-700">
                                        {feedbackText}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-12 text-center">
                    <BarChart2 className="mx-auto h-10 w-10 text-gray-300" />
                    <p className="mt-3 text-sm font-semibold text-gray-500">AI Evaluation Not Yet Run</p>
                    <p className="mt-1.5 text-sm text-gray-400 max-w-sm mx-auto">
                      This asset was added before the AI evaluation pipeline was introduced.
                      It will be scored automatically when resubmitted through the pipeline.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Right sidebar ──────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Usage stats */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Usage Stats</h3>
              <div className="grid grid-cols-2 gap-2">
                <StatCard icon={Download}    label="Downloads"      value={downloadCount}                    color="#0EA5E9" />
                <StatCard icon={MonitorPlay} label="Demo Views"     value={demoViewCount}                    color="#8B5CF6" />
                <button
                  onClick={() => setReqsModal('clone')}
                  className="flex flex-col items-center gap-1 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-3 w-full hover:bg-emerald-50 transition-colors">
                  <GitBranch className="h-4 w-4" style={{ color: '#10B981' }} />
                  <span className="text-lg font-bold tabular-nums" style={{ color: '#10B981' }}>{allCloneReqs.length || cloneCount}</span>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Clone Requests</span>
                </button>
                <StatCard icon={Rocket} label="Deployments" value={deploymentCount} color="#F59E0B" />
                <button
                  onClick={() => setReqsModal('demo')}
                  className="flex flex-col items-center gap-1 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-3 w-full hover:bg-rose-50 transition-colors">
                  <Users className="h-4 w-4" style={{ color: '#F43F5E' }} />
                  <span className="text-lg font-bold tabular-nums" style={{ color: '#F43F5E' }}>{allDemoReqs.length || demoRequestCount}</span>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Demo Requests</span>
                </button>
                <StatCard icon={Heart}       label="Likes"          value={likeCount}                        color="#F43F5E" />
              </div>

            </div>

            {/* Details */}
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Details</h3>
              <MetaItem icon={Building2} label="Department"  value={asset.department || '—'} />
              {asset.cloud_provider && <MetaItem icon={Cloud}    label="Cloud"        value={asset.cloud_provider} />}
              <MetaItem icon={Hash}      label="Catalog Code" value={asset.catalog_code} />
              <MetaItem icon={Calendar}  label="Published"    value={formatDate(asset.created_at)} />
              {asset.updated_at && asset.updated_at !== asset.created_at && (
                <MetaItem icon={Calendar} label="Updated" value={formatDate(asset.updated_at)} />
              )}
            </div>

            {/* Owner + Contributors card */}
            {asset.owner_name && (
              <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Asset Owner</h3>
                <div className="flex items-center gap-3 mb-3">
                  <InitialsAvatar name={asset.owner_name} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{asset.owner_name}</p>
                    {asset.owner_email && (
                      <p className="text-[11px] text-gray-400 truncate">{asset.owner_email}</p>
                    )}
                    {asset.designation && (
                      <p className="text-[11px] font-medium text-sky-500 truncate">{asset.designation}</p>
                    )}
                  </div>
                </div>
                {asset.manager_name && (
                  <div className="border-t border-gray-50 pt-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Reports to</p>
                    <div className="flex items-center gap-2">
                      <InitialsAvatar name={asset.manager_name} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{asset.manager_name}</p>
                        {asset.manager_email && (
                          <p className="text-[10px] text-gray-400 truncate">{asset.manager_email}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {collaborators.length > 0 && (
                  <div className="border-t border-gray-50 pt-3 mt-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Contributors</p>
                    <div className="space-y-2">
                      {collaborators.map((email) => {
                        const name = email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                        return (
                          <div key={email} className="flex items-center gap-2.5">
                            <InitialsAvatar name={name} size="sm" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-700 truncate">{name}</p>
                              <p className="text-[10px] text-gray-400 truncate">{email}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Changelog */}
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                <GitMerge className="h-3.5 w-3.5" />Changelog
              </h3>
              <ol className="relative border-l border-gray-100 pl-4 space-y-3">
                {changelog.map((entry, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[17px] flex h-3 w-3 items-center justify-center">
                      <span className={`h-2 w-2 rounded-full ${i === 0 ? 'bg-sky-400' : 'bg-gray-300'}`} />
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[10px] font-bold text-sky-600">{entry.version}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                        entry.label === 'Published' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      }`}>{entry.label}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-gray-500">{entry.note}</p>
                    <p className="mt-0.5 text-[10px] text-gray-300">{formatDate(entry.date)}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* ── Customer Demo Request Modal ───────────────────────────────── */}
      <AnimatePresence>
        {showDemoReqModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowDemoReqModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setShowDemoReqModal(false)} className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                  <Users className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Request Customer Demo</h2>
                  <p className="text-xs text-gray-500">{asset.title}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">Requestor</label>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 select-none">
                    {user?.display_name || user?.email || '—'}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">Vertical / Industry</label>
                  <select
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 bg-white"
                    value={demoReqVertical}
                    onChange={e => setDemoReqVertical(e.target.value)}
                  >
                    <option value="">Select a vertical…</option>
                    {['TMT', 'RCL', 'BFSI', 'AMI', 'HLM', 'PLATINUM'].map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">Customer Name <span className="text-rose-500">*</span></label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    placeholder="e.g. Acme Corp"
                    value={demoReqCustomer}
                    onChange={e => setDemoReqCustomer(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">Project / Opportunity Name <span className="text-rose-500">*</span></label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    placeholder="e.g. Q3 DataOps POC"
                    value={demoReqProject}
                    onChange={e => setDemoReqProject(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">Additional Details</label>
                  <textarea
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-none"
                    placeholder="Any specific requirements, timeline, or context for the demo…"
                    rows={3}
                    value={demoReqDetails}
                    onChange={e => setDemoReqDetails(e.target.value)}
                  />
                </div>
                {demoReqError && (
                  <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{demoReqError}</p>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                <button onClick={() => setShowDemoReqModal(false)}
                  className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleDemoRequest} disabled={demoReqSubmitting}
                  className="flex-1 rounded-lg bg-amber-500 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {demoReqSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {demoReqSubmitting ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Video Modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showVideoModal && primaryVideoUrl && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setShowVideoModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-4xl"
            >
              <button onClick={() => setShowVideoModal(false)}
                className="absolute -top-10 right-0 flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white transition-colors">
                <X className="h-4 w-4" />Close
              </button>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
                {(primaryVideoUrl.includes('youtube.com') || primaryVideoUrl.includes('youtu.be')) ? (
                  <iframe
                    className="w-full aspect-video"
                    src={primaryVideoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/') + '?autoplay=1'}
                    title="Demo video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : primaryVideoUrl.includes('vimeo.com') ? (
                  <iframe
                    className="w-full aspect-video"
                    src={primaryVideoUrl.replace('vimeo.com/', 'player.vimeo.com/video/') + '?autoplay=1'}
                    title="Demo video"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    className="w-full aspect-video bg-black"
                    src={resolveMediaUrl(primaryVideoUrl)}
                    controls
                    autoPlay
                  />
                )}
              </div>
              <div className="mt-3 flex items-center justify-center">
                <a href={primaryVideoUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white/80 transition-colors">
                  <ExternalLink className="h-3.5 w-3.5" />Open in new tab
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Request Repo Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-sky-500" />
                  <h2 className="text-base font-bold text-gray-900">Request Repository Access</h2>
                </div>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="mb-4 text-sm text-gray-500">
                Your request will be reviewed by the asset owner. You'll receive an email with the repo link once approved.
              </p>

              {/* Purpose of cloning */}
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                  Purpose of cloning <span className="text-rose-400">*</span>
                </label>
                <select
                  value={requestPurpose}
                  onChange={(e) => { setRequestPurpose(e.target.value); setRequestError(''); }}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                >
                  <option value="">— Select a purpose —</option>
                  <option value="Internal POC">Internal POC</option>
                  <option value="Customer">Customer</option>
                </select>
              </div>

              {/* Vertical + Customer name — only for Customer purpose */}
              {requestPurpose === 'Customer' && (
                <>
                  <div className="mb-4">
                    <label className="mb-1.5 block text-xs font-semibold text-gray-700">Vertical / Industry</label>
                    <select
                      value={requestVertical}
                      onChange={(e) => setRequestVertical(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                    >
                      <option value="">Select a vertical…</option>
                      {['TMT', 'RCL', 'BFSI', 'AMI', 'HLM', 'PLATINUM'].map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                      Customer name <span className="text-rose-400">*</span>
                      <span className="ml-1 font-normal text-gray-400">(client / organisation)</span>
                    </label>
                    <input
                      type="text"
                      value={requestCustomerName}
                      onChange={(e) => { setRequestCustomerName(e.target.value); setRequestError(''); }}
                      placeholder="e.g. Acme Corp"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* Project details — shown for all purposes once one is selected */}
              {requestPurpose && (
                <div className="mb-4">
                  <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                    Project details <span className="text-rose-400">*</span>
                    <span className="ml-1 font-normal text-gray-400">(engagement / initiative)</span>
                  </label>
                  <textarea
                    value={requestProjectName}
                    onChange={(e) => { setRequestProjectName(e.target.value); setRequestError(''); }}
                    placeholder="e.g. Q3 AI Transformation Pilot — building a RAG-based invoice processing system"
                    rows={3}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none resize-none"
                  />
                </div>
              )}

              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-semibold text-gray-700">Environment</label>
                <select value={requestEnv} onChange={(e) => setRequestEnv(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sky-400 focus:outline-none">
                  <option>Development</option>
                  <option>Staging</option>
                  <option>Experimental</option>
                  <option>Beta</option>
                  <option>Production</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                  Additional details <span className="font-normal text-gray-400">(min 20 chars)</span>
                </label>
                <textarea
                  value={requestReason}
                  onChange={(e) => { setRequestReason(e.target.value); setRequestError(''); }}
                  rows={3}
                  placeholder="Describe your use case and any specific requirements…"
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                />
                <p className="mt-1 text-right text-xs text-gray-400">{requestReason.length} chars</p>
              </div>

              {requestError && (
                <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-500">{requestError}</p>
              )}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
                <button onClick={handleRequestAccess} disabled={submitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-60 transition-colors">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />}
                  {submitting ? 'Sending…' : 'Send Request'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts(p => p.filter(t => t.id !== id))} />

      {/* ── Clone Requests modal ── */}
      {reqsModal === 'clone' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setReqsModal(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-emerald-500" />
                <h2 className="text-base font-bold text-gray-900">Repo Clone Requests</h2>
                <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">{allCloneReqs.length}</span>
              </div>
              <button onClick={() => setReqsModal(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-auto flex-1">
              {allCloneReqs.length === 0 ? (
                <p className="p-6 text-sm text-gray-400 text-center">No clone requests for this asset.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left">
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Requester</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Email</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Environment</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Purpose</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Date</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {allCloneReqs.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-800">{r.requester_name ?? '—'}</td>
                        <td className="px-5 py-3 text-gray-500">{r.requester_email ?? '—'}</td>
                        <td className="px-5 py-3 text-gray-500">{r.environment}</td>
                        <td className="px-5 py-3 text-gray-500">{r.purpose ?? '—'}</td>
                        <td className="px-5 py-3 text-gray-400 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide
                            ${r.status === 'Approved' ? 'bg-green-100 text-green-700'
                            : r.status === 'Denied'   ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Demo Requests modal ── */}
      {reqsModal === 'demo' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setReqsModal(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-rose-500" />
                <h2 className="text-base font-bold text-gray-900">Customer Demo Requests</h2>
                <span className="ml-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">{allDemoReqs.length}</span>
              </div>
              <button onClick={() => setReqsModal(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-auto flex-1">
              {allDemoReqs.length === 0 ? (
                <p className="p-6 text-sm text-gray-400 text-center">No demo requests for this asset.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left">
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Requester</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Email</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Customer</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Project</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Vertical</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Details</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {allDemoReqs.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-800">{r.requester_name ?? '—'}</td>
                        <td className="px-5 py-3 text-gray-500">{r.requester_email ?? '—'}</td>
                        <td className="px-5 py-3 text-gray-700">{r.customer_name}</td>
                        <td className="px-5 py-3 text-gray-500">{r.project_name}</td>
                        <td className="px-5 py-3 text-gray-500">{r.vertical ?? '—'}</td>
                        <td className="px-5 py-3 text-gray-400 max-w-[180px] truncate" title={r.additional_details ?? ''}>{r.additional_details ?? '—'}</td>
                        <td className="px-5 py-3 text-gray-400 whitespace-nowrap">{new Date(r.requested_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Delete Asset</h3>
                <p className="text-xs text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-6">
              Are you sure you want to delete <span className="font-semibold">"{asset.title}"</span>?
              It will be removed from the catalog and all users will lose access.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteLoading}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleDeleteAsset}
                disabled={deleteLoading}
                className="flex-1 rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deleteLoading ? 'Deleting…' : 'Delete Asset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
