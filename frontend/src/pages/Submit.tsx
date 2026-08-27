import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2, ChevronRight, Info, PackagePlus, Upload,
  FileDown, FileText, Sheet, X, Paperclip, User, FileType,
  Loader2, Brain, Sparkles, ArrowRight, AlertTriangle,
} from 'lucide-react';
import { useFamilies } from '../context/FamiliesContext';
import { DemoVideoDropzone } from '../components/media/DemoVideoDropzone';
import { Button } from '../components/ui/Button';
import { getSubmission, createSubmission, updateSubmission, getApprovedIdeations } from '../lib/submissionService';
import type { ApprovedIdeation } from '../lib/submissionService';
import { getCatalogAsset } from '../lib/catalogService';
import { uploadMedia } from '../lib/mediaService';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = [
  // AI & Data
  'AI & Machine Learning',
  'AI SDLC & Prompt Engineering',
  'RAG & Context Engineering',
  'MLOps & Model Management',
  'DataOps & Master Data',
  'Data & Analytics',
  // Engineering
  'Software Engineering',
  'Application Development',
  'Cloud Native',
  'DevOps & Infrastructure',
  'Infrastructure & Managed AI Ops',
  // Quality & Security
  'Quality Engineering & Test Automation',
  'Security & Compliance',
  // Automation
  'Process Automation & RPA',
  // Observability
  'Observability',
  // Others
  'Others',
] as const;

const maturityOptions = ['Experimental', 'Battle-Tested', 'Production'];

const emptyFormData = {
  // Section 1 — Submitter
  owner_name: '',
  owner_email: '',
  manager_name: '',
  manager_email: '',
  department: '',
  designation: '',
  // Section 2 — Asset
  aiv_ideation_id: '',
  title: '',
  category: '',
  family: '',
  cloud_providers: [] as string[],
  maturity: 'Experimental',
  demo_ready: false,
  tech_stack: [] as string[],
  repo_url: '',
  demo_url: '',
  video_url: '',
  video_urls: [] as string[],
  // Section 3 — Description
  description: '',
  // Section 4 — Architecture
  architecture_file_url: '',
  // Section 5 — Collaboration & Setup
  collaborators: [] as string[],
  dependencies: '',
  commands: [] as string[],
};

// ── AI Processing steps shown while polling ───────────────────────────────────
const PROCESSING_STEPS = [
  { icon: Brain,     label: 'Relevance check',       detail: 'Assessing business value and alignment' },
  { icon: Sparkles,  label: 'Tech quality review',   detail: 'Evaluating architecture and tech stack' },
  { icon: Brain,     label: 'Description quality',   detail: 'Checking clarity and completeness' },
  { icon: Sparkles,  label: 'Demo readiness',        detail: 'Verifying demo and video assets' },
  { icon: Brain,     label: 'Duplicate check',       detail: 'Scanning existing catalog for overlap' },
];

const TERMINAL_STATUSES = ['Manual_Approval', 'Needs_Changes', 'Approved', 'Published', 'Archived'];
const DESCRIPTION_WORD_LIMIT = 400;

const countWords = (value: string) => value.trim() ? value.trim().split(/\s+/).length : 0;

const limitWords = (value: string, limit: number) => {
  const matches = [...value.matchAll(/\S+/g)];
  if (matches.length <= limit) return value;
  const finalWord = matches[limit - 1];
  return value.slice(0, (finalWord.index ?? 0) + finalWord[0].length);
};

function SubmissionProcessing({ id, isRevision }: { id: string; isRevision: boolean }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>('Submitted');
  const [score, setScore] = useState<number | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [pollError, setPollError] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(Date.now());

  // Animate through steps while processing
  useEffect(() => {
    stepRef.current = setInterval(() => {
      setStepIdx((i) => (i + 1) % PROCESSING_STEPS.length);
    }, 1800);
    return () => { if (stepRef.current) clearInterval(stepRef.current); };
  }, []);

  // Poll submission status every 3s; give up after 120s
  useEffect(() => {
    const stopAll = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (stepRef.current) clearInterval(stepRef.current);
    };
    const check = async () => {
      // Timeout guard — 120 seconds max
      if (Date.now() - startRef.current > 120_000) {
        setTimedOut(true);
        stopAll();
        return;
      }
      try {
        const sub = await getSubmission(id);
        setPollError(0);
        setStatus(sub.status);
        if (sub.ai_score !== null) setScore(sub.ai_score);
        if (TERMINAL_STATUSES.includes(sub.status)) stopAll();
      } catch {
        setPollError((n) => {
          const next = n + 1;
          if (next >= 5) { setTimedOut(true); stopAll(); }
          return next;
        });
      }
    };
    void check();
    pollRef.current = setInterval(check, 3000);
    return () => stopAll();
  }, [id]);

  const isDone = TERMINAL_STATUSES.includes(status);
  const step = PROCESSING_STEPS[stepIdx];
  const StepIcon = step.icon;

  // Timed out / repeated network errors
  if (timedOut) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 animate-in fade-in duration-500">
        <div className="w-full max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 ring-8 ring-amber-50">
              <AlertTriangle className="h-10 w-10 text-amber-500" />
            </div>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">Evaluation is taking longer than expected</h2>
          <p className="mb-6 text-sm text-gray-500">
            Your submission was saved. AI evaluation runs in the background — check your pipeline to see the result once it completes.
          </p>
          <button
            onClick={() => navigate('/pipeline')}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-sky-600"
          >
            Go to Pipeline
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 animate-in fade-in duration-500">
      <div className="w-full max-w-md">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          {isDone ? (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 ring-8 ring-emerald-50">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
          ) : (
            <div className="relative flex h-20 w-20 items-center justify-center">
              {/* Spinning ring */}
              <svg className="absolute inset-0 h-full w-full animate-spin" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="36" fill="none" stroke="#EDE9FE" strokeWidth="4" />
                <circle cx="40" cy="40" r="36" fill="none" stroke="#8B5CF6" strokeWidth="4"
                  strokeDasharray="56 170" strokeLinecap="round" />
              </svg>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-100">
                <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
              </div>
            </div>
          )}
        </div>

        {/* Title */}
        <h2 className="mb-1 text-center text-2xl font-bold text-gray-900">
          {isDone
            ? (status === 'Needs_Changes' ? 'Needs Improvements' : status === 'Manual_Approval' ? 'In Review Queue' : 'Processing Complete')
            : 'AI Agents Evaluating…'}
        </h2>
        <p className="mb-8 text-center text-sm text-gray-500">
          {isDone
            ? (status === 'Needs_Changes'
                ? 'Your submission scored below 60. Check the pipeline for AI feedback and resubmit.'
                : 'Your submission has been scored and forwarded to admin for review.')
            : isRevision
              ? 'Re-running AI evaluation on your revised submission.'
              : 'Running 5 AI agents in parallel. This usually takes 15–30 seconds.'}
        </p>

        {/* Processing steps animation */}
        {!isDone && (
          <div className="mb-8 overflow-hidden rounded-2xl border border-violet-100 bg-violet-50 p-5">
            <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-500">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" />
              Running evaluation
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                <StepIcon className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-800">{step.label}</div>
                <div className="mt-0.5 text-xs text-gray-500">{step.detail}</div>
              </div>
            </div>
            {/* Progress dots */}
            <div className="mt-4 flex gap-1.5">
              {PROCESSING_STEPS.map((_, i) => (
                <div key={i}
                  className="h-1 flex-1 rounded-full transition-all duration-500"
                  style={{ backgroundColor: i <= stepIdx ? '#8B5CF6' : '#DDD6FE' }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Score result */}
        {isDone && score !== null && (
          <div className="mb-6 flex items-center justify-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="text-center">
              <div className={`text-4xl font-bold ${score >= 60 ? 'text-emerald-500' : 'text-rose-500'}`}>{score}</div>
              <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">AI Score</div>
            </div>
            <div className="h-10 w-px bg-gray-100" />
            <div className="text-sm text-gray-600">
              {score >= 60
                ? 'Forwarded to admin for final approval.'
                : 'Score is below 60 — review the AI feedback and resubmit with more detail.'}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => navigate('/pipeline')}
            size="lg"
            className="w-full gap-2"
            disabled={!isDone}
          >
            {isDone ? (
              <>View in Pipeline <ArrowRight className="h-4 w-4" /></>
            ) : (
              <><Loader2 className="h-4 w-4 animate-spin" /> Waiting for AI evaluation…</>
            )}
          </Button>
          {!isDone && (
            <button onClick={() => navigate('/pipeline')}
              className="text-center text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600">
              Go to pipeline now (evaluation continues in background)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Submit() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { families, loading: familiesLoading } = useFamilies();
  const [searchParams] = useSearchParams();
  const revisionId  = searchParams.get('revision');
  const catalogEditId = searchParams.get('catalogEdit');
  const isExistingAssetEdit = !!revisionId || !!catalogEditId;
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [formData, setFormData] = useState(emptyFormData);
  const [approvedIdeations, setApprovedIdeations] = useState<ApprovedIdeation[]>([]);
  const [ideationsLoading, setIdeationsLoading] = useState(true);
  const [ideationsError, setIdeationsError] = useState('');
  const [techDraft, setTechDraft] = useState('');
  const [contributorDraft, setContributorDraft] = useState('');
  const [commandDraft, setCommandDraft] = useState('');

  const loadIdeations = useCallback(async () => {
    setIdeationsLoading(true);
    setIdeationsError('');
    try {
      setApprovedIdeations(await getApprovedIdeations());
    } catch (err) {
      setIdeationsError(err instanceof Error ? err.message : 'Could not load AIV ideations.');
    } finally {
      setIdeationsLoading(false);
    }
  }, []);

  useEffect(() => { void loadIdeations(); }, [loadIdeations]);

  // Document slots for Section 4
  const DOC_SLOTS = [
    { key: 'overall_architecture',   label: 'Architecture File',        hint: 'System/solution architecture diagram or document', required: true  },
    { key: 'sales_pitch',            label: 'Sales Pitch Deck',         hint: 'Client-facing pitch or presentation',              required: true  },
    { key: 'marketing_collateral',   label: 'Marketing Collateral',     hint: 'Brochure, one-pager, or marketing material',       required: false },
    { key: 'technical_delivery',     label: 'Technical Delivery Doc',   hint: 'Implementation guide, runbook, or delivery document', required: false },
  ] as const;
  type DocSlotKey = typeof DOC_SLOTS[number]['key'];

  const [docFiles, setDocFiles] = useState<Record<DocSlotKey, { url: string; name: string }>>({
    overall_architecture: { url: '', name: '' },
    sales_pitch:          { url: '', name: '' },
    marketing_collateral: { url: '', name: '' },
    technical_delivery:   { url: '', name: '' },
  });
  const [docUploading, setDocUploading] = useState<Partial<Record<DocSlotKey, boolean>>>({});

  // ── Draft persistence ────────────────────────────────────────────────────────
  const draftKey = user?.id ? `amplify_draft_${user.id}` : null;
  const [draftBanner, setDraftBanner] = useState<'found' | 'saved' | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Prevents auto-save from firing until user has actually changed something
  const userTouchedRef = useRef(false);
  // Prevents pre-fill effect from overwriting after a restore
  const restoringRef = useRef(false);

  const saveDraft = useCallback(() => {
    if (!draftKey || revisionId || catalogEditId) return;
    const draft = { formData, docFiles, savedAt: new Date().toISOString() };
    localStorage.setItem(draftKey, JSON.stringify(draft));
    setDraftSavedAt(new Date().toLocaleTimeString());
    setDraftBanner('saved');
    setTimeout(() => setDraftBanner(b => b === 'saved' ? null : b), 3000);
  }, [draftKey, formData, docFiles, revisionId, catalogEditId]);

  const clearDraft = useCallback(() => {
    if (draftKey) localStorage.removeItem(draftKey);
    setDraftBanner(null);
    setDraftSavedAt(null);
    userTouchedRef.current = false;
  }, [draftKey]);

  // Auto-save 2s after user actually changes something (not on pre-fill)
  useEffect(() => {
    if (!draftKey || revisionId || catalogEditId) return;
    if (!userTouchedRef.current) return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      const draft = { formData, docFiles, savedAt: new Date().toISOString() };
      localStorage.setItem(draftKey, JSON.stringify(draft));
      setDraftSavedAt(new Date().toLocaleTimeString());
    }, 2000);
    return () => { if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current); };
  }, [formData, docFiles, draftKey, revisionId, catalogEditId]);

  // On mount (once draftKey is known): check for an existing draft
  const draftCheckedRef = useRef(false);
  useEffect(() => {
    if (!draftKey || revisionId || catalogEditId || draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      // Show banner if the draft has ANY meaningful field filled in
      const fd = saved?.formData;
      if (fd && Object.values(fd).some((v) => typeof v === 'string' ? v.trim() : Array.isArray(v) ? v.length > 0 : false)) {
        setDraftBanner('found');
      }
    } catch {}
  }, [draftKey, revisionId, catalogEditId]);

  const restoreDraft = useCallback(() => {
    if (!draftKey) return;
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      restoringRef.current = true;
      if (saved?.formData) setFormData({ ...emptyFormData, ...saved.formData });
      if (saved?.docFiles) setDocFiles(saved.docFiles);
      if (saved?.savedAt) setDraftSavedAt(new Date(saved.savedAt).toLocaleString());
      setDraftBanner(null);
      // Allow auto-save from user changes after restore
      setTimeout(() => { restoringRef.current = false; userTouchedRef.current = true; }, 500);
    } catch {}
  }, [draftKey]);

  // Template file upload state
  const templateFileRef = useRef<HTMLInputElement>(null);
  const [templateUploading, setTemplateUploading] = useState(false);
  const [templateFileName, setTemplateFileName] = useState('');
  const [templateParsed, setTemplateParsed] = useState(false);

  // Pre-fill Section 1 from logged-in user (skip if draft restore is in progress)
  useEffect(() => {
    if (user && !revisionId && !catalogEditId && !restoringRef.current) {
      setFormData((c) => ({
        ...c,
        owner_name: user.display_name ?? '',
        owner_email: user.email ?? '',
        department: user.department ?? '',
      }));
    }
  }, [user, revisionId, catalogEditId]);

  // Load catalog asset for editing (owner/admin editing a published asset)
  useEffect(() => {
    if (!catalogEditId) return;
    let cancelled = false;
    getCatalogAsset(catalogEditId).then((asset) => {
      if (cancelled) return;
      setFormData((c) => ({
        ...emptyFormData,
        owner_name:    asset.owner_name ?? c.owner_name,
        owner_email:   asset.owner_email ?? c.owner_email,
        manager_name:  asset.manager_name ?? c.manager_name,
        manager_email: asset.manager_email ?? c.manager_email,
        department:    asset.department ?? '',
        designation:   asset.designation ?? '',
        title:           asset.title ?? '',
        aiv_ideation_id: asset.aiv_ideation_id ?? '',
        category:        asset.category ?? '',
        family:          asset.family ?? '',
        cloud_providers: (asset.cloud_provider ?? '').split(', ').filter(Boolean),
        maturity:        asset.maturity ?? 'Experimental',
        demo_ready:      asset.demo_ready ?? false,
        tech_stack:      asset.tech_stack ?? [],
        repo_url:        asset.repo_url ?? '',
        demo_url:        asset.demo_url ?? '',
        video_url:       asset.video_url ?? asset.video_urls?.[0] ?? '',
        video_urls:      [...new Set(asset.video_urls?.length ? asset.video_urls : (asset.video_url ? [asset.video_url] : []))],
        description:     asset.description ?? '',
        architecture_file_url: '',
        collaborators: asset.collaborators ?? [],
        dependencies:  asset.dependencies ?? '',
        commands:      asset.commands ?? [],
      }));
      // Parse architecture_file_url (JSON with 4 slots, or legacy single URL)
      try {
        const raw = asset.architecture_file_url ?? '';
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          // New multi-slot format — populate all 4 slots regardless of which ones have URLs
          setDocFiles({
            overall_architecture: { url: parsed.overall_architecture ?? '', name: parsed.overall_architecture ? 'uploaded' : '' },
            sales_pitch:          { url: parsed.sales_pitch ?? '',          name: parsed.sales_pitch ? 'uploaded' : '' },
            marketing_collateral: { url: parsed.marketing_collateral ?? '', name: parsed.marketing_collateral ? 'uploaded' : '' },
            technical_delivery:   { url: parsed.technical_delivery ?? '',   name: parsed.technical_delivery ? 'uploaded' : '' },
          });
        } else if (raw) {
          // Legacy single URL — treat as overall_architecture
          setDocFiles(prev => ({ ...prev, overall_architecture: { url: raw, name: 'uploaded' } }));
        }
      } catch {
        const raw = asset.architecture_file_url ?? '';
        if (raw) setDocFiles(prev => ({ ...prev, overall_architecture: { url: raw, name: 'uploaded' } }));
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [catalogEditId]);

  useEffect(() => {
    if (!revisionId) {
      setFormData((c) => ({
        ...emptyFormData,
        owner_name: c.owner_name,
        owner_email: c.owner_email,
        department: c.department,
      }));
      return;
    }
    let cancelled = false;
    getSubmission(revisionId).then((sub) => {
      if (cancelled || !sub) return;
      setFormData({
        owner_name: (sub as any).owner_name ?? '',
        owner_email: (sub as any).owner_email ?? '',
        manager_name: (sub as any).manager_name ?? '',
        manager_email: (sub as any).manager_email ?? '',
        department: sub.department,
        designation: (sub as any).designation ?? '',
        title: sub.title,
        aiv_ideation_id: sub.aiv_ideation_id ?? '',
        category: (sub as any).category ?? '',
        family: sub.family,
        cloud_providers: ((sub.cloud_provider ?? '').split(', ').filter(Boolean)),
        maturity: sub.maturity ?? 'Experimental',
        demo_ready: sub.demo_ready,
        tech_stack: sub.tech_stack ?? [],
        repo_url: sub.repo_url ?? '',
        demo_url: sub.demo_url ?? '',
        video_url: sub.video_url ?? sub.video_urls?.[0] ?? '',
        video_urls: [...new Set(sub.video_urls?.length ? sub.video_urls : (sub.video_url ? [sub.video_url] : []))],
        description: sub.description,
        architecture_file_url: '',
        collaborators: sub.collaborators ?? [],
        dependencies: sub.dependencies ?? '',
        commands: sub.commands ?? [],
      });
      // Parse architecture_file_url JSON (new format) or legacy single URL
      try {
        const raw = (sub as any).architecture_file_url ?? '';
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          setDocFiles({
            overall_architecture: { url: parsed.overall_architecture ?? '', name: parsed.overall_architecture ? 'uploaded' : '' },
            sales_pitch:          { url: parsed.sales_pitch ?? '',          name: parsed.sales_pitch ? 'uploaded' : '' },
            marketing_collateral: { url: parsed.marketing_collateral ?? '', name: parsed.marketing_collateral ? 'uploaded' : '' },
            technical_delivery:   { url: parsed.technical_delivery ?? '',   name: parsed.technical_delivery ? 'uploaded' : '' },
          });
        } else if (raw) {
          setDocFiles(prev => ({ ...prev, overall_architecture: { url: raw, name: 'uploaded' } }));
        }
      } catch {
        const raw = (sub as any).architecture_file_url ?? '';
        if (raw) setDocFiles(prev => ({ ...prev, overall_architecture: { url: raw, name: 'uploaded' } }));
      }
      setAdminNotes(sub.admin_notes ?? '');
    });
    return () => { cancelled = true; };
  }, [revisionId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        aiv_ideation_id: formData.aiv_ideation_id,
        title: formData.title.trim(),
        description: formData.description.trim(),
        family: formData.family,
        department: formData.department,
        tech_stack: formData.tech_stack,
        cloud_provider: formData.cloud_providers.join(', '),
        maturity: formData.maturity,
        demo_ready: formData.demo_ready,
        video_url: formData.video_urls[0] || formData.video_url || undefined,
        video_urls: formData.video_urls,
        demo_url: formData.demo_url || undefined,
        repo_url: formData.repo_url.trim() || undefined,
        owner_name: formData.owner_name || undefined,
        owner_email: formData.owner_email || undefined,
        manager_name: formData.manager_name || undefined,
        manager_email: formData.manager_email || undefined,
        designation: formData.designation || undefined,
        category: formData.category || undefined,
        architecture_file_url: JSON.stringify({
          overall_architecture:  docFiles.overall_architecture.url,
          sales_pitch:           docFiles.sales_pitch.url,
          marketing_collateral:  docFiles.marketing_collateral.url,
          technical_delivery:    docFiles.technical_delivery.url,
        }),
        collaborators: formData.collaborators.length ? formData.collaborators : undefined,
        dependencies: formData.dependencies.trim() || undefined,
        commands: formData.commands.length ? formData.commands : undefined,
      };
      if (catalogEditId) {
        // Re-submit as a new submission linked to the existing asset — triggers AI + approval workflow
        const created = await createSubmission({ ...payload, catalog_asset_id: catalogEditId } as any);
        clearDraft();
        setSubmittedId(created.id);
      } else if (revisionId) {
        const updated = await updateSubmission(revisionId, payload);
        clearDraft();
        setSubmittedId(updated.id);
      } else {
        const created = await createSubmission(payload);
        clearDraft();
        setSubmittedId(created.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const setField = <K extends keyof typeof formData>(key: K, value: typeof formData[K]) => {
    userTouchedRef.current = true;
    setFormData((c) => ({ ...c, [key]: value }));
  };

  const addTechTags = () => {
    const tags = techDraft.split(',').map((t) => t.trim()).filter(Boolean);
    if (!tags.length) return;
    setFormData((c) => ({ ...c, tech_stack: [...c.tech_stack, ...tags.filter((t) => !c.tech_stack.includes(t))] }));
    setTechDraft('');
  };

  const removeTech = (tag: string) => setFormData((c) => ({ ...c, tech_stack: c.tech_stack.filter((t) => t !== tag) }));

  const addContributor = () => {
    const email = contributorDraft.trim();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !formData.collaborators.includes(email)) {
      setFormData((c) => ({ ...c, collaborators: [...c.collaborators, email] }));
    }
    setContributorDraft('');
  };
  const removeContributor = (email: string) => setFormData((c) => ({ ...c, collaborators: c.collaborators.filter((e) => e !== email) }));

  const addCommand = () => {
    const cmd = commandDraft.trim();
    if (cmd && !formData.commands.includes(cmd)) {
      setFormData((c) => ({ ...c, commands: [...c.commands, cmd] }));
    }
    setCommandDraft('');
  };
  const removeCommand = (cmd: string) => setFormData((c) => ({ ...c, commands: c.commands.filter((c2) => c2 !== cmd) }));

  // Document slot upload handler
  const handleDocUpload = async (key: DocSlotKey, file: File) => {
    userTouchedRef.current = true;
    setDocUploading((prev) => ({ ...prev, [key]: true }));
    try {
      const entityId = catalogEditId || revisionId || undefined;
      const result = await uploadMedia(file, 'document', undefined, entityId, formData.family || undefined);
      setDocFiles((prev) => ({ ...prev, [key]: { url: result.url, name: file.name } }));
    } catch {
      setError(`Upload failed for "${DOC_SLOTS.find(s => s.key === key)?.label}". Check file type.`);
    } finally {
      setDocUploading((prev) => ({ ...prev, [key]: false }));
    }
  };

  // Shared: apply parsed key→value map to form state
  const applyTemplateMap = (map: Record<string, string>) => {
    const getString = (...keys: string[]) => {
      for (const k of keys) {
        const v = map[k.toLowerCase()];
        if (v) return v;
      }
      return '';
    };
    setFormData((c) => ({
      ...c,
      owner_name: getString('owner name') || c.owner_name,
      owner_email: getString('owner email') || c.owner_email,
      manager_name: getString('manager name') || c.manager_name,
      manager_email: getString('manager email') || c.manager_email,
      department: getString('business unit / department') || c.department,
      designation: getString('designation / role') || c.designation,
      title: getString('asset title') || c.title,
      family: matchFamily(getString('platform family')) || c.family,
      category: matchCategory(getString('category')) || c.category,
      cloud_providers: (() => { const v = getString('cloud provider'); return v ? v.split(', ').filter(Boolean) : c.cloud_providers; })(),
      maturity: getString('maturity') || c.maturity,
      demo_ready: ['true', 'yes'].includes(getString('demo ready', 'demo ready (client-presentable)').toLowerCase()),
      tech_stack: (() => { const v = getString('tech stack', 'tech stack (comma-separated)'); return v ? v.split(',').map((t) => t.trim()).filter(Boolean) : c.tech_stack; })(),
      repo_url: getString('repository url') || c.repo_url,
      demo_url: getString('live demo url') || getString('demo url') || c.demo_url,
      video_url: getString('demo video url') || c.video_url,
      description: getString('full description') || c.description,
    }));
  };

  // Parse XLSX template
  const parseXlsx = async (file: File): Promise<Record<string, string>> => {
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];
    const map: Record<string, string> = {};
    for (const row of rows) {
      const key1 = String(row[0] || '').replace(/\s*\*$/, '').trim();
      const val1 = String(row[1] || '').trim();
      if (key1 && val1 && !key1.startsWith('SECTION') && !key1.startsWith('InfoVision')) map[key1.toLowerCase()] = val1;
      const key2 = String(row[2] || '').replace(/\s*\*$/, '').trim();
      const val2 = String(row[3] || '').trim();
      if (key2 && val2 && !key2.startsWith('SECTION') && !key2.startsWith('InfoVision')) map[key2.toLowerCase()] = val2;
    }
    return map;
  };

  // Parse DOCX template — reads Word XML tables (label | value pairs)
  const parseDocx = async (file: File): Promise<Record<string, string>> => {
    const JSZip = (await import('jszip')).default;
    const buf = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    const xmlStr = await zip.file('word/document.xml')?.async('string');
    if (!xmlStr) throw new Error('Cannot read document.xml');

    const xmlDoc = new DOMParser().parseFromString(xmlStr, 'application/xml');
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    // Get individual w:t runs from a cell (preserves run boundaries)
    const cellRuns = (tc: Element): string[] =>
      Array.from(tc.getElementsByTagNameNS(W, 't')).map((t) => t.textContent ?? '').filter(Boolean);

    const PLACEHOLDER = /^(e\.g\.|▼|what does it do|paste a sharepoint|select[….]?$|name@|manager@|https:\/\/\.\.\.)/i;
    const SKIP = /^(section|infovision|instructions|complete all|asset submission)/i;

    const map: Record<string, string> = {};

    const storePair = (labelCell: Element, valueCell: Element | null) => {
      const runs0 = cellRuns(labelCell);
      if (!runs0.length) return;
      // First run = label; subsequent runs in same cell = user typed inside label cell
      const label = runs0[0].replace(/\s*\*$/, '').trim();
      if (!label || SKIP.test(label)) return;
      const key = label.toLowerCase();

      // Strategy 1: dedicated value cell has real content
      if (valueCell) {
        const vRuns = cellRuns(valueCell).filter((r) => !PLACEHOLDER.test(r.trim()));
        if (vRuns.length) { map[key] = vRuns.join(''); return; }
      }
      // Strategy 2: user typed extra runs after the label inside the label cell
      const extra = runs0.slice(1).filter((r) => !PLACEHOLDER.test(r.trim()));
      if (extra.length) map[key] = extra.join('');
    };

    const tables = Array.from(xmlDoc.getElementsByTagNameNS(W, 'tbl'));
    for (const tbl of tables) {
      const rows = Array.from(tbl.getElementsByTagNameNS(W, 'tr'));
      for (let ri = 0; ri < rows.length; ri++) {
        const cells = Array.from(rows[ri].getElementsByTagNameNS(W, 'tc'));
        if (cells.length >= 4) {
          storePair(cells[0], cells[1]);
          storePair(cells[2], cells[3]);
        } else if (cells.length === 2) {
          storePair(cells[0], cells[1]);
        } else if (cells.length === 1) {
          // 1-col label row → next row holds the value
          const runs = cellRuns(cells[0]);
          const label = (runs[0] ?? '').replace(/\s*\*$/, '').trim();
          if (label && !SKIP.test(label) && ri + 1 < rows.length) {
            const nextCells = Array.from(rows[ri + 1].getElementsByTagNameNS(W, 'tc'));
            if (nextCells.length === 1) {
              const vRuns = cellRuns(nextCells[0]).filter((r) => !PLACEHOLDER.test(r.trim()));
              if (vRuns.length) { map[label.toLowerCase()] = vRuns.join(''); ri++; }
            }
          }
        }
      }
    }
    return map;
  };

  // Template upload — parse XLSX or DOCX and prefill fields
  const handleTemplateUpload = async (file: File) => {
    setTemplateUploading(true);
    setError('');
    try {
      const isDocx = file.name.toLowerCase().endsWith('.docx');
      const map = isDocx ? await parseDocx(file) : await parseXlsx(file);
      applyTemplateMap(map);
      setTemplateFileName(file.name);
      setTemplateParsed(true);
    } catch {
      setError('Could not parse template. Make sure you uploaded the official Amplify XLSX or DOCX template.');
    } finally {
      setTemplateUploading(false);
    }
  };

  function matchCategory(val: string): string {
    if (!val) return '';
    const lower = val.toLowerCase();
    // Exact case-insensitive match
    const exact = CATEGORIES.find((c) => c.toLowerCase() === lower);
    if (exact) return exact;
    // Partial match — value contains or is contained in a category
    const partial = CATEGORIES.find((c) => c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase()));
    if (partial) return partial;
    // No match — return the raw value so the select can render it as a dynamic option
    return val;
  }

  function matchFamily(val: string): string {
    if (!val) return '';
    const lower = val.toLowerCase();
    // strip tagline suffix (e.g. "Atlas — DataOps & Master Data" → "atlas")
    const nameOnly = lower.split('—')[0].trim();
    for (const k of Object.keys(families)) {
      if (k.toLowerCase() === nameOnly || families[k].name.toLowerCase() === nameOnly || k.toLowerCase() === lower || families[k].name.toLowerCase() === lower) return k;
    }
    return '';
  }

  const handleTemplateDownload = async (fmt: 'xlsx' | 'docx') => {
    setError('');
    try {
      const { authStore } = await import('../store/authStore');
      const token = authStore.getState().accessToken;
      const base = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000';
      const resp = await fetch(`${base}/media/templates/${fmt}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `amplify_submission_template.${fmt}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('Template download failed. Please try again.');
    }
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const sectionAError = (() => {
    const oe = formData.owner_email.trim();
    const me = formData.manager_email.trim();
    if (oe && !EMAIL_RE.test(oe)) return 'Owner email is not a valid email address.';
    if (me && !EMAIL_RE.test(me)) return 'Manager email is not a valid email address.';
    if (me && !me.toLowerCase().endsWith('@infovision.com')) return 'Manager email must be an @infovision.com address.';
    if (oe && me && oe.toLowerCase() === me.toLowerCase()) return 'Manager email must be different from owner email.';
    if (formData.owner_name.trim() && formData.manager_name.trim() &&
        formData.owner_name.trim().toLowerCase() === formData.manager_name.trim().toLowerCase())
      return 'Manager name must be different from owner name.';
    return null;
  })();

  const isFormValid = (
    formData.owner_name.trim().length > 0 &&
    formData.owner_email.trim().length > 0 &&
    formData.manager_name.trim().length > 0 &&
    formData.manager_email.trim().length > 0 &&
    formData.department.trim().length > 0 &&
    formData.designation.trim().length > 0 &&
    (isExistingAssetEdit || formData.aiv_ideation_id.trim().length > 0) &&
    formData.family.trim().length > 0 &&
    formData.title.trim().length > 0 &&
    formData.category.trim().length > 0 &&
    formData.maturity.trim().length > 0 &&
    formData.description.trim().length > 0 &&
    countWords(formData.description) <= DESCRIPTION_WORD_LIMIT &&
    formData.tech_stack.length > 0 &&
    formData.repo_url.trim().length > 0 &&
    formData.video_url.trim().length > 0 &&
    !sectionAError
  );

  if (submittedId) {
    return <SubmissionProcessing id={submittedId} isRevision={!!revisionId} />;
  }

  return (
    <div className="animate-in fade-in duration-500 pb-12">
      {/* Fixed draft restore popup — appears bottom-right on page load if a draft exists */}
      {draftBanner === 'found' && (
        <div className="fixed bottom-6 right-6 z-50 w-80 rounded-2xl border border-amber-200 bg-white p-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
          <div className="mb-1 flex items-center gap-2 text-sm font-bold text-amber-800">
            <span className="text-base">📝</span> Draft found
          </div>
          <p className="mb-3 text-xs text-gray-500">You have unsaved progress. Would you like to continue where you left off?</p>
          <div className="flex gap-2">
            <button onClick={restoreDraft}
              className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600 transition-colors">
              Restore Draft
            </button>
            <button onClick={() => { clearDraft(); }}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
              Discard
            </button>
          </div>
        </div>
      )}
      {/* Fixed "Draft saved" toast — always visible regardless of scroll position */}
      {draftBanner === 'saved' && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-xl animate-in slide-in-from-bottom-4 duration-300">
          <span>✓</span> Draft saved{draftSavedAt ? ` at ${draftSavedAt}` : ''}
        </div>
      )}
      <div className="flex items-center gap-2 px-4 py-4 text-sm md:px-10">
        <button
          onClick={() => navigate(catalogEditId ? '/catalog' : '/pipeline')}
          className="font-medium text-sky-500 transition-colors hover:text-sky-600">
          {catalogEditId ? 'Catalog' : 'Pipeline'}
        </button>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-900">
          {catalogEditId ? 'Edit Asset' : revisionId ? 'Revise Asset' : 'Submit Asset'}
        </span>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-12 md:px-10">

        {/* Toast is rendered at fixed position so it's visible regardless of scroll */}

        {/* ── Submission workflow overview ─────────────────────────────── */}
        {user?.role === 'guest' && !revisionId && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="mb-4 text-xs font-bold uppercase tracking-wide text-gray-500">How your submission is reviewed</p>
            <div className="flex items-start">
              {([
                { icon: '📝', label: 'Submit', desc: 'Fill in your asset details and submit for review.', textColor: 'text-sky-700', borderColor: 'border-sky-200', bgLight: 'bg-sky-50' },
                { icon: '🤖', label: 'AI Review', desc: 'Agentic AI evaluates quality, completeness, and relevance — Gate 1.', textColor: 'text-purple-700', borderColor: 'border-purple-200', bgLight: 'bg-purple-50' },
                { icon: '🧑‍⚖️', label: 'CIC Panel', desc: 'CIC Panel manually reviews and approves the asset — Gate 2.', textColor: 'text-amber-700', borderColor: 'border-amber-200', bgLight: 'bg-amber-50' },
                { icon: '🏁', label: 'Owner Publish', desc: 'Platform owner does the final review and publishes to the catalog — Gate 3.', textColor: 'text-emerald-700', borderColor: 'border-emerald-200', bgLight: 'bg-emerald-50' },
              ] as const).map((step, i, arr) => (
                <div key={i} className="flex flex-1 items-start">
                  <div className="flex flex-1 flex-col items-center text-center px-1">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${step.bgLight} ${step.borderColor} text-lg`}>
                      {step.icon}
                    </div>
                    <div className={`mt-2 text-xs font-bold ${step.textColor}`}>{step.label}</div>
                    <div className="mt-1 text-[11px] leading-snug text-gray-500">{step.desc}</div>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="mt-5 shrink-0">
                      <div className="h-0.5 w-5 bg-gray-200" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Header card ─────────────────────────────────────────────── */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 px-6 py-7 text-white md:px-8">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-sky-200">
              <PackagePlus className="h-4 w-4" /> Contribution Intake
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              {catalogEditId ? 'Edit Published Asset' : revisionId ? 'Revise Asset Submission' : 'Submit a New Asset'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              {catalogEditId
                ? 'Update asset details. Changes save directly to the catalog.'
                : revisionId
                ? 'Update the requested fields and resubmit for AI Review.'
                : 'Capture the metadata required for AI review, manual approval, and catalog publishing.'}
            </p>
          </div>

          {/* Template download / upload strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-slate-50 px-6 py-3 md:px-8">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <FileDown className="h-3.5 w-3.5" /> Fill Offline
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleTemplateDownload('xlsx')}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                <Sheet className="h-3.5 w-3.5" /> Download Excel Template
              </button>
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100">
                <Upload className="h-3.5 w-3.5" />
                {templateUploading ? 'Parsing…' : templateParsed ? `✓ ${templateFileName}` : 'Upload Filled Template'}
                <input
                  ref={templateFileRef}
                  type="file"
                  accept=".xlsx,.csv,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleTemplateUpload(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-8 p-6 md:p-8">
            {revisionId && adminNotes && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="text-sm font-bold text-amber-700">Reviewer notes</div>
                <p className="mt-1 text-sm leading-relaxed text-gray-700">{adminNotes}</p>
              </div>
            )}

            {/* ── SECTION 1 — Submitter Information ──────────────────── */}
            <Section icon={<User className="h-4 w-4" />} label="Section 1 — Submitter Information">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Owner Name" required>
                  <input
                    value={formData.owner_name}
                    readOnly
                    tabIndex={-1}
                    placeholder="e.g. Balram Aggarwal"
                    className="field-input cursor-not-allowed bg-gray-50 text-gray-500 select-none"
                  />
                  <p className="mt-1 text-[11px] text-gray-400">Auto-filled from your account</p>
                </Field>
                <Field label="Owner Email" required>
                  <input
                    type="email"
                    value={formData.owner_email}
                    readOnly
                    tabIndex={-1}
                    placeholder="name@infovision.com"
                    className="field-input cursor-not-allowed bg-gray-50 text-gray-500 select-none"
                  />
                  <p className="mt-1 text-[11px] text-gray-400">Auto-filled from your account</p>
                </Field>
                <Field label="Manager Name" required>
                  <input
                    value={formData.manager_name}
                    onChange={(e) => setField('manager_name', e.target.value)}
                    placeholder="e.g. Rohini Sharma"
                    className="field-input"
                    required
                  />
                </Field>
                <Field label="Manager Email" required>
                  <input
                    type="email"
                    value={formData.manager_email}
                    onChange={(e) => {
                      const v = e.target.value;
                      setField('manager_email', v);
                    }}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && !v.includes('@')) setField('manager_email', `${v}@infovision.com`);
                    }}
                    placeholder="manager@infovision.com"
                    className={`field-input ${
                      formData.manager_email &&
                      !formData.manager_email.toLowerCase().endsWith('@infovision.com')
                        ? 'border-rose-400 focus:ring-rose-200'
                        : ''
                    }`}
                    required
                  />
                  {formData.manager_email && !formData.manager_email.toLowerCase().endsWith('@infovision.com') ? (
                    <p className="mt-1 text-[11px] font-medium text-rose-500">Only @infovision.com email addresses are allowed</p>
                  ) : sectionAError ? (
                    <p className="mt-1 text-[11px] font-medium text-rose-500">{sectionAError}</p>
                  ) : (
                    <p className="mt-1 text-[11px] text-gray-400">Must be an @infovision.com address</p>
                  )}
                </Field>
                <Field label="Business Unit / Department" required>
                  <input
                    value={formData.department}
                    onChange={(e) => setField('department', e.target.value)}
                    placeholder="e.g. Digital Technology"
                    className="field-input"
                    required
                  />
                </Field>
                <Field label="Designation / Role" required>
                  <input
                    value={formData.designation}
                    onChange={(e) => setField('designation', e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                    className="field-input"
                    required
                  />
                </Field>
              </div>
            </Section>

            {/* ── SECTION 2 — Asset Details ──────────────────────────── */}
            <Section icon={<PackagePlus className="h-4 w-4" />} label="Section 2 — Asset Details">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="AIV Ideation" required={!isExistingAssetEdit} wide>
                  <div className="flex gap-2">
                    <select
                      value={formData.aiv_ideation_id}
                      onChange={(e) => setField('aiv_ideation_id', e.target.value)}
                      className="field-input"
                      required={!isExistingAssetEdit}
                      disabled={ideationsLoading}
                    >
                      <option value="">{ideationsLoading ? 'Loading AIV ideations…' : 'Select an AIV ideation…'}</option>
                      {approvedIdeations.map((idea) => (
                        <option key={idea.id} value={idea.id}>{idea.id} — {idea.title}</option>
                      ))}
                      {formData.aiv_ideation_id && !approvedIdeations.some((idea) => idea.id === formData.aiv_ideation_id) && (
                        <option value={formData.aiv_ideation_id}>{formData.aiv_ideation_id}</option>
                      )}
                    </select>
                    {ideationsError && <Button type="button" variant="outline" onClick={() => void loadIdeations()}>Retry</Button>}
                  </div>
                  {ideationsError && <p className="mt-1 text-xs text-red-600">{ideationsError}</p>}
                </Field>

                <Field label="Asset Title" required>
                  <input
                    value={formData.title}
                    onChange={(e) => setField('title', e.target.value)}
                    placeholder="e.g. Invoice Extraction Pipeline"
                    className="field-input"
                    required
                  />
                </Field>

                <Field label="Category" required>
                  <select
                    value={formData.category}
                    onChange={(e) => setField('category', e.target.value)}
                    className="field-input"
                    required
                  >
                    <option value="">Select a category…</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    {formData.category && !(CATEGORIES as readonly string[]).includes(formData.category) && (
                      <option value={formData.category}>{formData.category}</option>
                    )}
                  </select>
                </Field>

                <Field label="Platform Family" required>
                  <select
                    value={formData.family}
                    onChange={(e) => setField('family', e.target.value)}
                    className="field-input"
                    disabled={familiesLoading}
                  >
                    <option value="">Select a platform family…</option>
                    {familiesLoading
                      ? <option disabled>Loading families…</option>
                      : Object.entries(families).map(([k, f]) => (
                          <option key={k} value={k}>{f.name} — {f.tagline}</option>
                        ))
                    }
                  </select>
                </Field>

                <Field label="Cloud Provider" wide>
                  <div className="flex flex-wrap gap-3 pt-1">
                    {['AWS', 'Azure', 'GCP', 'Multi-cloud', 'On-prem'].map((cp) => {
                      const checked = formData.cloud_providers.includes(cp);
                      return (
                        <label key={cp} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${checked ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-gray-200 bg-white text-gray-600 hover:border-sky-200 hover:bg-sky-50/40'}`}>
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-gray-300 text-sky-500"
                            checked={checked}
                            onChange={(e) => {
                              setFormData((c) => ({
                                ...c,
                                cloud_providers: e.target.checked
                                  ? [...c.cloud_providers, cp]
                                  : c.cloud_providers.filter((x) => x !== cp),
                              }));
                            }}
                          />
                          {cp}
                        </label>
                      );
                    })}
                  </div>
                </Field>

                <Field label="Maturity">
                  <select
                    value={formData.maturity}
                    onChange={(e) => setField('maturity', e.target.value)}
                    className="field-input"
                  >
                    {maturityOptions.map((m) => (
                      <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Demo Ready">
                  <label className="flex cursor-pointer items-center gap-3 pt-2">
                    <input
                      type="checkbox"
                      checked={formData.demo_ready}
                      onChange={(e) => setField('demo_ready', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-sky-500"
                    />
                    <span className="text-sm font-medium text-gray-700">This asset is ready to demo to clients</span>
                  </label>
                </Field>

                <Field label="Tech Stack" required wide>
                  <div className="min-h-20 rounded-lg border border-gray-200 bg-white p-2 shadow-sm focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100">
                    <div className="flex flex-wrap gap-2">
                      {formData.tech_stack.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700">
                          {tag}
                          <button type="button" className="text-sky-400 hover:text-sky-700" onClick={() => removeTech(tag)}>×</button>
                        </span>
                      ))}
                      <input
                        value={techDraft}
                        onChange={(e) => setTechDraft(e.target.value)}
                        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTechTags(); } }}
                        onBlur={addTechTags}
                        placeholder={formData.tech_stack.length ? 'Add more…' : 'e.g. Python, FastAPI, LangChain'}
                        className="min-w-52 flex-1 border-0 bg-transparent px-2 py-1.5 text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                </Field>

                <Field label="Repository URL" required hint="GitHub, GitLab, Bitbucket, or Azure DevOps — must be a real code repository">
                  <input
                    value={formData.repo_url}
                    onChange={(e) => setField('repo_url', e.target.value)}
                    placeholder="https://github.com/org/repo"
                    className="field-input"
                    required
                  />
                </Field>

                <Field label="Live Demo URL" hint="URL of the running live demo (e.g. hosted app, Streamlit, etc.)">
                  <input
                    value={formData.demo_url}
                    onChange={(e) => setField('demo_url', e.target.value)}
                    placeholder="https://demo.example.com/..."
                    className="field-input"
                  />
                </Field>

                <Field label="Collaborators" hint="Email addresses of team members who contributed to this asset" wide>
                  <div className="min-h-12 rounded-lg border border-gray-200 bg-white p-2 shadow-sm focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100">
                    <div className="flex flex-wrap gap-2">
                      {formData.collaborators.map((email) => (
                        <span key={email} className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700">
                          {email}
                          <button type="button" className="text-sky-400 hover:text-sky-700" onClick={() => removeContributor(email)}>×</button>
                        </span>
                      ))}
                      <input
                        value={contributorDraft}
                        onChange={(e) => setContributorDraft(e.target.value)}
                        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addContributor(); } }}
                        onBlur={addContributor}
                        placeholder={formData.collaborators.length ? 'Add more…' : 'e.g. contributor@infovision.com'}
                        className="min-w-52 flex-1 border-0 bg-transparent px-2 py-1.5 text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                </Field>

                <Field label="Dependencies / Prerequisites" hint="Tools, libraries, or services required to run this asset" wide>
                  <textarea
                    value={formData.dependencies}
                    onChange={(e) => setField('dependencies', e.target.value)}
                    placeholder="e.g. Python 3.11+, Node 18+, Azure subscription, OpenAI API key…"
                    rows={3}
                    className="field-input resize-y"
                  />
                </Field>

                <Field label="Setup / Run Commands" hint="Commands to install and run the asset" wide>
                  <div className="min-h-12 rounded-lg border border-gray-200 bg-white p-2 shadow-sm focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100">
                    <div className="flex flex-wrap gap-2">
                      {formData.commands.map((cmd) => (
                        <span key={cmd} className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-xs font-mono font-bold text-violet-700">
                          {cmd}
                          <button type="button" className="text-violet-400 hover:text-violet-700" onClick={() => removeCommand(cmd)}>×</button>
                        </span>
                      ))}
                      <input
                        value={commandDraft}
                        onChange={(e) => setCommandDraft(e.target.value)}
                        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); addCommand(); } }}
                        onBlur={addCommand}
                        placeholder={formData.commands.length ? 'Add more…' : 'e.g. pip install -r requirements.txt'}
                        className="min-w-52 flex-1 border-0 bg-transparent px-2 py-1.5 text-sm font-mono text-gray-900 outline-none placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                </Field>

                <Field label="Demo Videos / Images" required wide hint="Upload one or more demo videos or images. The first item is used as the primary demo.">
                  <div className="space-y-4">
                    {formData.video_urls.map((url, index) => <div key={`${url}-${index}`} className="rounded-xl border border-gray-200 p-3">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">{index === 0 ? 'Primary demo' : `Demo ${index + 1}`}</p>
                      <DemoVideoDropzone videoUrl={url} onVideoUrlChange={(nextUrl) => {
                        const next = formData.video_urls.filter((_, itemIndex) => itemIndex !== index);
                        if (nextUrl) next.splice(index, 0, nextUrl);
                        setField('video_urls', next); setField('video_url', next[0] ?? '');
                      }} disabled={isSaving} entityId={catalogEditId || revisionId || undefined} family={formData.family || undefined} />
                    </div>)}
                    <DemoVideoDropzone videoUrl="" onVideoUrlChange={(url) => {
                      if (!url) return; const next = [...formData.video_urls, url];
                      setField('video_urls', next); setField('video_url', next[0]);
                    }} disabled={isSaving} entityId={catalogEditId || revisionId || undefined} family={formData.family || undefined} />
                  </div>
                </Field>
              </div>
            </Section>

            {/* ── SECTION 3 — Description ────────────────────────────── */}
            <Section icon={<FileText className="h-4 w-4" />} label="Section 3 — Description">
              <Field label="Full Description" hint="Maximum 400 words" required wide>
                <textarea
                  value={formData.description}
                  onChange={(e) => setField('description', limitWords(e.target.value, DESCRIPTION_WORD_LIMIT))}
                  placeholder="What does it do? Which problems does it solve? What can delivery teams reuse?"
                  rows={6}
                  className="field-input resize-y"
                  required
                />
                <div className="mt-1.5 flex justify-end">
                  <span className={`text-xs font-medium ${countWords(formData.description) >= DESCRIPTION_WORD_LIMIT ? 'text-amber-600' : 'text-gray-400'}`}>
                    {countWords(formData.description)} / {DESCRIPTION_WORD_LIMIT} words
                  </span>
                </div>
              </Field>
            </Section>

            {/* ── SECTION 4 — Architecture & Documents ──────────────── */}
            <Section icon={<Paperclip className="h-4 w-4" />} label="Section 4 — Architecture & Documents">
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Upload available documents. All fields are optional — you can add missing docs later by editing the asset.
                </p>
                {DOC_SLOTS.map((slot) => {
                  const slotData = docFiles[slot.key];
                  const isUploading = docUploading[slot.key];
                  const isDone = !!slotData.url;
                  return (
                    <div key={slot.key} className={`rounded-xl border p-4 transition-colors ${isDone ? 'border-emerald-200 bg-emerald-50/40' : 'border-gray-200 bg-white'}`}>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                            {isDone
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                              : <span className="h-4 w-4 rounded-full border-2 border-gray-300 shrink-0 inline-block" />}
                            {slot.label}
                            {slot.required && <span className="text-rose-500 ml-0.5">*</span>}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5 ml-5.5">{slot.hint}</p>
                        </div>
                        {isDone && (
                          <button
                            type="button"
                            onClick={() => setDocFiles(prev => ({ ...prev, [slot.key]: { url: '', name: '' } }))}
                            className="text-gray-400 hover:text-rose-500 shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {isDone ? (
                        <div className="ml-5.5 flex items-center gap-2">
                          <Paperclip className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span className="text-xs font-medium text-emerald-700 truncate">{slotData.name}</span>
                        </div>
                      ) : (
                        <label className={`ml-0 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm transition-colors ${isUploading ? 'border-sky-200 bg-sky-50' : 'border-gray-200 hover:border-sky-300 hover:bg-sky-50/40'}`}>
                          {isUploading
                            ? <><Loader2 className="h-4 w-4 animate-spin text-sky-500" /><span className="text-sky-600 font-medium">Uploading…</span></>
                            : <><Upload className="h-4 w-4 text-gray-400" /><span className="text-gray-500 font-medium">Upload from portal</span></>}
                          <input
                            type="file"
                            accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.png,.jpg,.jpeg,.svg"
                            className="hidden"
                            disabled={isUploading}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void handleDocUpload(slot.key, f);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>

            {error && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">{error}</p>
            )}

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Button type="submit" size="lg" disabled={!isFormValid || isSaving} className="px-10">
                {isSaving
                  ? (catalogEditId ? 'Saving…' : revisionId ? 'Resubmitting…' : 'Submitting…')
                  : (catalogEditId ? 'Save Changes' : revisionId ? 'Resubmit for AI Review' : 'Submit for Review')}
              </Button>
              {!revisionId && !catalogEditId && (
                <button type="button" onClick={() => { userTouchedRef.current = true; saveDraft(); }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  Save Draft
                </button>
              )}
              {!revisionId && !catalogEditId && draftKey && localStorage.getItem(draftKey) && (
                <button type="button" onClick={() => { clearDraft(); }}
                  className="text-xs text-gray-400 hover:text-rose-500 transition-colors underline underline-offset-2">
                  Clear Draft
                </button>
              )}
            </div>
            {!isFormValid && (
              <p className="mt-2 text-xs text-gray-400">
                Required: Owner Name, Owner Email, Manager Name, Manager Email, Department, Designation, {!isExistingAssetEdit && 'AIV Ideation, '}Asset Title, Category, Description, Tech Stack, Repo URL, and Demo Video
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Section wrapper ──────────────────────────────────────────────────── */
function Section({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">{icon}</span>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">{label}</h2>
      </div>
      {children}
    </div>
  );
}

/* ── Field wrapper ────────────────────────────────────────────────────── */
function Field({ label, required, wide, hint, children }: { label: string; required?: boolean; wide?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label className={`space-y-2 ${wide ? 'md:col-span-2' : ''}`}>
      <span className="text-sm font-bold text-gray-900">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {children}
    </label>
  );
}
