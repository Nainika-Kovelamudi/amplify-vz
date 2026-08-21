import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Activity, LayoutGrid, GitBranch, CheckCircle2,
  Clock, Zap, TrendingUp, FileText, Package, BookOpen,
  ChevronRight, Star, Layers, Sparkles, ShieldCheck, ExternalLink,
  Database, Wand2, ShieldAlert, GitMerge, Server, PlayCircle, Rocket, FlaskConical,
  Eye, Download, Flame,
} from 'lucide-react';
import { defaultFamilyBadge, useFamilies } from '../context/FamiliesContext';
import { useAuth } from '../context/AuthContext';
import { getCatalog, type CatalogAsset } from '../lib/catalogService';
import { getMySubmissions, type Submission } from '../lib/submissionService';
import { getRecentActivity, type ActivityEvent } from '../lib/adminService';
import { getAllCloneRequests, type CloneRequest } from '../lib/cloneService';
import { getAllDemoRequests, type DemoRequest } from '../lib/demoRequestService';

function NeuralCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const W = canvas.width;
    const H = canvas.height;

    const NODE_COUNT = 42;
    const CONNECT_DIST = W * 0.2;
    type MeshNode = { x: number; y: number; vx: number; vy: number; r: number; pulse: number; pulseSpeed: number };
    type Signal   = { from: number; to: number; t: number; speed: number };

    const nodes: MeshNode[] = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
      r: Math.random() * 2 + 1.2,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 0.018 + 0.008,
    }));
    const signals: Signal[] = [];

    const TAGS = ['LLM', 'RAG', 'Agent', 'Prompt Eng', 'ML Model', 'Fine-tune',
                  'Embeddings', 'Vector DB', 'GenAI', 'NLP', 'Vision AI', 'Pipeline',
                  'Accelerator', 'Copilot', 'AutoML'];
    type Tag = { label: string; x: number; y: number; vy: number; alpha: number };
    const tags: Tag[] = TAGS.map((label) => ({
      label,
      x: Math.random() * W * 0.9 + W * 0.05,
      y: Math.random() * H,
      vy: -(Math.random() * 0.18 + 0.06),
      alpha: Math.random() * 0.18 + 0.18,
    }));

    let frame = 0;
    const spawnSignal = () => {
      const from = Math.floor(Math.random() * NODE_COUNT);
      const candidates = nodes
        .map((n, i) => ({ i, d: Math.hypot(n.x - nodes[from].x, n.y - nodes[from].y) }))
        .filter(({ i, d }) => i !== from && d < CONNECT_DIST);
      if (!candidates.length) return;
      const to = candidates[Math.floor(Math.random() * candidates.length)].i;
      signals.push({ from, to, t: 0, speed: Math.random() * 0.007 + 0.003 });
    };

    let animId: number;
    const tick = () => {
      ctx.clearRect(0, 0, W, H);

      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy; n.pulse += n.pulseSpeed;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
      });

      // Edges — white, subtle
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          if (d < CONNECT_DIST) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(255,255,255,${(1 - d / CONNECT_DIST) * 0.12})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // Signals — white pulse along edges
      for (let s = signals.length - 1; s >= 0; s--) {
        const sig = signals[s];
        sig.t += sig.speed;
        if (sig.t >= 1) { signals.splice(s, 1); continue; }
        const nx = nodes[sig.from].x + (nodes[sig.to].x - nodes[sig.from].x) * sig.t;
        const ny = nodes[sig.from].y + (nodes[sig.to].y - nodes[sig.from].y) * sig.t;
        const grd = ctx.createRadialGradient(nx, ny, 0, nx, ny, 5);
        grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.arc(nx, ny, 5, 0, Math.PI * 2);
        ctx.fillStyle = grd; ctx.globalAlpha = 0.7; ctx.fill(); ctx.globalAlpha = 1;
      }

      // Nodes — white glowing dots
      nodes.forEach(n => {
        const glow = Math.sin(n.pulse) * 0.5 + 0.5;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + glow, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.35 + glow * 0.3})`; ctx.fill();
      });

      // Floating AI tags — white, very subtle
      ctx.font = `600 12px 'Segoe UI', sans-serif`;
      tags.forEach(tag => {
        tag.y += tag.vy;
        if (tag.y < -20) { tag.y = H + 10; tag.x = Math.random() * W * 0.55 + W * 0.02; }
        ctx.globalAlpha = tag.alpha;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(tag.label, tag.x, tag.y);
        ctx.globalAlpha = 1;
      });

      frame++;
      if (frame % 16 === 0) spawnSignal();
      animId = requestAnimationFrame(tick);
    };

    tick();
    return () => cancelAnimationFrame(animId);
  }, []);

  useEffect(() => {
    const cleanup = draw();
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => { cleanup?.(); window.removeEventListener('resize', onResize); };
  }, [draw]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-70" />;
}

function HeroPlatformPanel({
  families,
  totalAssets,
  demoCount,
}: {
  families: Record<string, { name: string; color: string; asset_count: number }>;
  totalAssets: number;
  demoCount: number;
}) {
  const familyList = Object.values(families).slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.35 }}
      className="w-[340px] shrink-0 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
    >
      {/* Top KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        {[
          { label: 'Total Assets', value: totalAssets, color: '#38bdf8' },
          { label: 'Demo Ready',   value: demoCount,   color: '#34d399' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-1 text-2xl font-bold tabular-nums" style={{ color }}>
              {value}
            </motion.p>
          </div>
        ))}
      </div>

      {/* Divider */}
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Platform Families
      </p>

      {/* Family rows */}
      <div className="space-y-2">
        {familyList.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-white/5" />
            ))
          : familyList.map((f, i) => {
              const pct = totalAssets > 0 ? Math.round((f.asset_count / totalAssets) * 100) : 0;
              return (
                <motion.div
                  key={f.name}
                  initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 + i * 0.07 }}
                  className="flex items-center gap-3"
                >
                  {/* Color dot */}
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.color }} />

                  {/* Name */}
                  <span className="w-28 shrink-0 truncate text-xs font-semibold text-white/70">{f.name}</span>

                  {/* Bar */}
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${Math.max(pct, 4)}%` }}
                      transition={{ duration: 0.8, delay: 0.6 + i * 0.07, ease: 'easeOut' }}
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ background: f.color, opacity: 0.75 }}
                    />
                  </div>

                  {/* Count */}
                  <span className="w-6 shrink-0 text-right text-[11px] font-bold tabular-nums text-white/50">
                    {f.asset_count}
                  </span>
                </motion.div>
              );
            })}
      </div>
    </motion.div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-100 ${className ?? ''}`} />;
}

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  Submitted:       { color: '#6366F1', bg: '#EEF2FF', label: 'Submitted' },
  AI_Review:       { color: '#F59E0B', bg: '#FEF3C7', label: 'AI Review' },
  Manual_Approval: { color: '#0EA5E9', bg: '#E0F2FE', label: 'In Review' },
  Approved:        { color: '#10B981', bg: '#D1FAE5', label: 'Approved' },
  Needs_Changes:   { color: '#EF4444', bg: '#FEE2E2', label: 'Needs Changes' },
  Published:       { color: '#10B981', bg: '#D1FAE5', label: 'Published' },
};

const ACTION_LABELS: Record<string, string> = {
  user_login:            'logged in',
  submission_created:    'submitted a new asset',
  submission_revised:    'revised a submission',
  submission_approved:   'approved a submission',
  submission_rejected:   'rejected a submission',
  submission_published:  'published an asset to catalog',
  catalog_asset_updated: 'updated a catalog asset',
  catalog_asset_archived:'archived a catalog asset',
};

const FAMILY_ICONS: Record<string, React.ReactNode> = {
  atlas:    <Database className="h-5 w-5" />,
  forge:    <Wand2 className="h-5 w-5" />,
  sentinel: <ShieldAlert className="h-5 w-5" />,
  relay:    <GitMerge className="h-5 w-5" />,
  nexus:    <Server className="h-5 w-5" />,
};

const MATURITY_COLOR: Record<string, string> = {
  Production: '#10B981', production: '#10B981', validated: '#10B981',
  'Battle-Tested': '#0EA5E9', Beta: '#0EA5E9', beta: '#0EA5E9', 'battle-tested': '#0EA5E9',
  Experimental: '#F59E0B', experimental: '#F59E0B', Prototype: '#F59E0B', prototype: '#F59E0B',
};

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function SectionHeader({ icon, title, subtitle, action, onAction }: {
  icon: React.ReactNode; title: string; subtitle?: string;
  action?: string; onAction?: () => void;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-500">
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
      {action && (
        <button onClick={onAction}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-600 hover:bg-sky-100 transition-colors">
          {action} <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export function Home() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { families, loading: familiesLoading } = useFamilies();

  const [assets, setAssets]           = useState<CatalogAsset[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [activity, setActivity]       = useState<ActivityEvent[]>([]);
  const [cloneRequests, setCloneRequests] = useState<CloneRequest[]>([]);
  const [demoRequests, setDemoRequests]   = useState<DemoRequest[]>([]);
  const [assetTab, setAssetTab]               = useState<'latest' | 'trending'>('trending');
  const [assetsLoading, setAssetsLoading]     = useState(true);
  const [subsLoading, setSubsLoading]         = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [cloneLoading, setCloneLoading]       = useState(true);
  const [demoLoading, setDemoLoading]         = useState(true);

  const isAdmin  = user?.role === 'Aimplify.Admin' || user?.role === 'Aimplify.Owner';
  const firstName = user?.display_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? '';
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    if (authLoading) return;
    let c = false;
    getCatalog({ limit: 500 })
      .then(({ items }) => { if (!c) { setAssets(items); setAssetsLoading(false); } })
      .catch((err) => { console.error('[Home] Failed to load catalog:', err); if (!c) setAssetsLoading(false); });
    return () => { c = true; };
  }, [authLoading]);

  useEffect(() => {
    if (authLoading) return;
    let c = false;
    getMySubmissions()
      .then(({ items }) => { if (!c) { setSubmissions(items); setSubsLoading(false); } })
      .catch((err) => { console.error('[Home] Failed to load submissions:', err); if (!c) setSubsLoading(false); });
    return () => { c = true; };
  }, [authLoading]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) { setActivityLoading(false); return; }
    let c = false;
    getRecentActivity()
      .then((acts) => { if (!c) { setActivity(acts); setActivityLoading(false); } })
      .catch((err) => { console.error('[Home] Failed to load activity:', err); if (!c) setActivityLoading(false); });
    return () => { c = true; };
  }, [authLoading, isAdmin]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) { setCloneLoading(false); setDemoLoading(false); return; }
    let c = false;
    getAllCloneRequests()
      .then((r) => { if (!c) { setCloneRequests(r); setCloneLoading(false); } })
      .catch(() => { if (!c) setCloneLoading(false); });
    getAllDemoRequests()
      .then((r) => { if (!c) { setDemoRequests(r); setDemoLoading(false); } })
      .catch(() => { if (!c) setDemoLoading(false); });
    return () => { c = true; };
  }, [authLoading, isAdmin]);

  const pendingSubs   = submissions.filter((s) =>
    ['Submitted', 'AI_Review', 'Manual_Approval'].includes(s.status)
  );
  const totalAssets   = assets.length;
  const demoCount     = assets.filter((a) => a.demo_ready).length;
  const latestAssets    = useMemo(() => [...assets].slice(0, 6), [assets]);
  const trendingAssets  = useMemo(() =>
    [...assets]
      .sort((a, b) => (b.view_count + b.artifact_download_count) - (a.view_count + a.artifact_download_count))
      .filter(a => a.view_count + a.artifact_download_count > 0)
      .slice(0, 5),
  [assets]);

  const maturityBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    assets.forEach((a) => { if (a.maturity) map[a.maturity] = (map[a.maturity] ?? 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [assets]);

  const productionCount    = useMemo(() => assets.filter((a) => a.maturity === 'Production').length, [assets]);
  const battleTestedCount  = useMemo(() => assets.filter((a) => a.maturity === 'Battle-Tested').length, [assets]);
  const experimentalCount  = useMemo(() => assets.filter((a) => a.maturity === 'Experimental').length, [assets]);

  const STATS = [
    { value: assetsLoading ? null : totalAssets,       label: 'Total Assets',  desc: 'Published in catalog',      icon: <Package     className="h-5 w-5" />, color: 'text-sky-600',    iconBg: 'bg-sky-50 text-sky-500',       accent: '#0EA5E9', path: '/catalog' },
    { value: assetsLoading ? null : demoCount,         label: 'Demo-Ready',    desc: 'Live demos available',      icon: <PlayCircle    className="h-5 w-5" />, color: 'text-emerald-600',iconBg: 'bg-emerald-50 text-emerald-500',accent: '#10B981', path: '/catalog?demo=true' },
    { value: assetsLoading ? null : productionCount,   label: 'Production',    desc: 'Production-ready assets',   icon: <Rocket        className="h-5 w-5" />, color: 'text-green-600',  iconBg: 'bg-green-50 text-green-500',   accent: '#16A34A', path: '/catalog?maturity=Production' },
    { value: assetsLoading ? null : battleTestedCount, label: 'Battle-Tested', desc: 'Proven in real projects',   icon: <Activity      className="h-5 w-5" />, color: 'text-violet-600', iconBg: 'bg-violet-50 text-violet-500', accent: '#7C3AED', path: '/catalog?maturity=Battle-Tested' },
    { value: assetsLoading ? null : experimentalCount, label: 'Experimental',  desc: 'Experimental-stage assets', icon: <FlaskConical  className="h-5 w-5" />, color: 'text-amber-600',  iconBg: 'bg-amber-50 text-amber-500',   accent: '#F59E0B', path: '/catalog?maturity=Experimental' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 animate-in fade-in duration-300 pb-16">

      {/* ── Hero Banner ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(120deg, #1a237e 0%, #3949ab 30%, #6a1b9a 65%, #c2185b 100%)', minHeight: 200 }}>


        {/* Subtle radial glows */}
        <div className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 20% 60%, rgba(255,255,255,0.07) 0%, transparent 55%), radial-gradient(ellipse at 80% 30%, rgba(255,100,150,0.12) 0%, transparent 50%)' }} />

        {/* Neural canvas */}
        <NeuralCanvas />

        <div className="relative mx-auto max-w-7xl px-6 py-10 pb-14 md:px-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

            {/* Left */}
            <div className="max-w-xl">
              {/* Label */}
              <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/60">
                Enterprise AI Platform
              </motion.p>

              {/* Headline */}
              <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
                className="mb-3 text-3xl font-bold text-white md:text-4xl leading-tight">
                <span className="font-extrabold">AI</span>mplify <span className="font-extrabold">Outcome.</span>
              </motion.h1>

              {/* Subtitle */}
              <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
                className="mb-5 text-sm text-white/70 md:text-[15px] leading-relaxed">
                One platform for discovering, reusing, and deploying proven AI accelerators.
              </motion.p>

              {/* Pill badge */}
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.45 }}>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[12px] font-medium text-white/80 backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
                  One platform. Multiple personas. Endless possibilities.
                </span>
              </motion.div>
            </div>

            {/* Right — QR code + CTA buttons */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
              className="flex shrink-0 flex-col items-center gap-3 -mt-2">

              {/* QR Code card */}
              <div style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 10, padding: '8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{ background: '#ffffff', borderRadius: 6, padding: 4, lineHeight: 0 }}>
                  <img
                    src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https://aimplify.infovision.ai&color=1a237e&bgcolor=ffffff"
                    alt="QR – aimplify.infovision.ai"
                    width={80} height={80}
                    style={{ display: 'block', borderRadius: 3 }}
                  />
                </div>
                <p style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.55)', margin: 0, textAlign: 'center' }}>
                  aimplify.infovision.ai
                </p>
              </div>

              {/* Buttons side by side below QR */}
              <div className="flex items-center gap-2">
                <button onClick={() => navigate('/catalog')}
                  className="flex items-center justify-center gap-2 rounded-lg border border-white bg-transparent px-4 py-2 text-xs font-semibold text-white hover:bg-white/10 transition-colors whitespace-nowrap">
                  <LayoutGrid className="h-3.5 w-3.5 shrink-0" /> Browse Catalog
                </button>
                <button onClick={() => navigate('/submit')}
                  className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors shadow-lg whitespace-nowrap">
                  <FileText className="h-3.5 w-3.5 shrink-0" /> Submit Asset
                </button>
              </div>

            </motion.div>

          </div>
        </div>
      </div>

      {/* ── IVAI Intelligence Portal banner ─────────────────────────────── */}
      <a
        href="https://aivportal.infovision.ai/"
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center justify-between gap-4 border-b border-sky-100 bg-gradient-to-r from-sky-50 via-white to-sky-50 px-6 py-3 transition-colors hover:bg-sky-50 md:px-10"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
            <ExternalLink className="h-3.5 w-3.5" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-sky-700">IVAI Intelligence Portal</span>
            <span className="hidden text-gray-400 sm:inline">—</span>
            <span className="hidden text-gray-500 sm:inline">Access InfoVision's AI intelligence hub for insights, tools, and resources</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-sky-600 group-hover:text-sky-700">
          Visit Portal <ExternalLink className="h-3 w-3" />
        </div>
      </a>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-6 pt-8 md:px-10">

        {/* KPI stats */}
        <div className="mb-8">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-500">
                <LayoutGrid className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Platform Dashboard</h2>
                <p className="mt-0.5 text-xs text-gray-400">Key metrics across your activity and the catalog</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {STATS.map((stat, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                onClick={() => navigate(stat.path)}
                className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl bg-white transition-all hover:shadow-md hover:-translate-y-0.5">
                {/* Card body */}
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-auto flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition-transform group-hover:scale-110">
                      {stat.icon}
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-gray-500" />
                  </div>
                  <div className="mt-4">
                    {stat.value === null
                      ? <Skeleton className="mb-1 h-8 w-14" />
                      : <div className="text-3xl font-bold tabular-nums text-gray-900">{stat.value}</div>}
                    <div className="mt-0.5 text-xs font-semibold text-gray-700">{stat.label}</div>
                    <div className="text-[11px] text-gray-400">{stat.desc}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Platform Families */}
        <div className="mb-8">
          <SectionHeader
            icon={<Layers className="h-4 w-4" />}
            title="Platform Families"
            subtitle="Five practice-area domains of reusable AI accelerators"
            action="Browse all"
            onAction={() => navigate('/catalog')}
          />
          {familiesLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <Skeleton className="mb-3 h-5 w-20" /><Skeleton className="mb-1 h-3 w-full" /><Skeleton className="h-3 w-3/4" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {Object.entries(families).map(([k, f], i) => (
                <motion.div key={k}
                  initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                  onClick={() => navigate(`/family/${k}`)}
                  className="group relative flex h-36 cursor-pointer flex-col overflow-hidden rounded-xl border p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
                  style={{ backgroundColor: `${f.color}12`, borderColor: '#e5e7eb' }}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${f.color}25`, color: f.color }}>
                        {FAMILY_ICONS[k.toLowerCase()] ?? <Layers className="h-5 w-5" />}
                      </div>
                      <span className="text-sm font-bold leading-tight" style={{ color: f.color }}>{f.name}</span>
                    </div>
                  </div>
                  <p className="mb-3 text-[11px] leading-relaxed text-gray-400 group-hover:text-gray-600 transition-colors">
                    {(f as any).tagline}
                  </p>
                  <div className="mt-auto flex items-end justify-between">
                    <span className="text-4xl font-extrabold tabular-nums leading-none" style={{ color: f.color }}>
                      {(f as any).asset_count ?? 0}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] font-semibold opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: f.color }}>
                      Explore <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Main 3-col grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* Latest / Trending Assets — 2 cols with tab toggle */}
          <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
                <button
                  onClick={() => setAssetTab('latest')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${assetTab === 'latest' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  <BookOpen className="h-3.5 w-3.5" /> Latest
                </button>
                <button
                  onClick={() => setAssetTab('trending')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${assetTab === 'trending' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  <Flame className={`h-3.5 w-3.5 ${assetTab === 'trending' ? 'text-white' : 'text-orange-400'}`} /> Trending
                </button>
              </div>
              <button onClick={() => navigate('/catalog')}
                className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
                View all <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            {assetsLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                    <div className="flex-1"><Skeleton className="mb-1 h-3.5 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {(assetTab === 'latest' ? latestAssets : trendingAssets).map((a, i) => {
                  const fm = families[a.family] ?? defaultFamilyBadge();
                  return (
                    <div key={a.id} onClick={() => navigate(`/catalog/${a.slug}`)}
                      className="group flex cursor-pointer items-center gap-4 py-3 -mx-2 px-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                        style={{ backgroundColor: fm.color }}>
                        {a.family.slice(0, 3).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {assetTab === 'trending' && (
                            <span className="text-[10px] font-bold text-orange-400">#{i + 1}</span>
                          )}
                          <div className="truncate text-sm font-semibold text-gray-900">{a.title}</div>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="font-mono text-[10px] text-gray-400">{a.catalog_code}</span>
                          <span className="text-gray-300">·</span>
                          <span className="text-[10px] text-gray-400">{fm.name}</span>
                          {assetTab === 'trending' ? (
                            <div className="flex items-center gap-2 ml-1">
                              {a.view_count > 0 && (
                                <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                                  <Eye className="h-3 w-3" />{a.view_count}
                                </span>
                              )}
                              {a.artifact_download_count > 0 && (
                                <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                                  <Download className="h-3 w-3" />{a.artifact_download_count}
                                </span>
                              )}
                            </div>
                          ) : a.maturity ? (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className="text-[10px] font-semibold"
                                style={{ color: MATURITY_COLOR[a.maturity] ?? '#9CA3AF' }}>
                                {a.maturity}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {a.demo_ready && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 border border-emerald-100">
                            Demo
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 text-gray-200 group-hover:text-gray-400 transition-colors" />
                      </div>
                    </div>
                  );
                })}
                {assetTab === 'trending' && trendingAssets.length === 0 && (
                  <p className="py-8 text-center text-sm text-gray-400">No views or downloads tracked yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-6">

            {/* Maturity Breakdown */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <SectionHeader
                icon={<TrendingUp className="h-4 w-4" />}
                title="Maturity Breakdown"
                subtitle="Readiness levels across catalog"
              />
              {assetsLoading ? (
                <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : maturityBreakdown.length === 0 ? (
                <p className="text-sm text-gray-400">No data yet.</p>
              ) : (
                <div className="space-y-4">
                  {maturityBreakdown.map(([m, count]) => {
                    const pct = totalAssets > 0 ? Math.round((count / totalAssets) * 100) : 0;
                    const color = MATURITY_COLOR[m] ?? '#9CA3AF';
                    return (
                      <div key={m}>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-700">{m}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold tabular-nums" style={{ color }}>{count}</span>
                            <span className="text-[10px] text-gray-400">({pct}%)</span>
                          </div>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                          <motion.div className="h-full rounded-full"
                            initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.2 }}
                            style={{ backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* My Pipeline */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <SectionHeader
                icon={<GitBranch className="h-4 w-4" />}
                title="My Pipeline"
                subtitle="Your active submissions"
                action="View all"
                onAction={() => navigate('/pipeline')}
              />
              {/* Mini stats */}
              <div className="mb-4 flex gap-2">
                <div
                  onClick={() => navigate('/pipeline?tab=mine')}
                  className="flex cursor-pointer items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 transition-colors hover:bg-violet-100"
                >
                  {subsLoading ? <Skeleton className="h-5 w-6" /> : <span className="text-base font-bold tabular-nums text-violet-600">{submissions.length}</span>}
                  <span className="text-[11px] font-semibold text-violet-400">My Submissions</span>
                </div>
                <div
                  onClick={() => navigate('/pipeline?tab=mine')}
                  className="flex cursor-pointer items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 transition-colors hover:bg-amber-100"
                >
                  {subsLoading ? <Skeleton className="h-5 w-6" /> : <span className="text-base font-bold tabular-nums text-amber-600">{pendingSubs.length}</span>}
                  <span className="text-[11px] font-semibold text-amber-400">Pending Review</span>
                </div>
              </div>

              {subsLoading ? (
                <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : pendingSubs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center">
                  <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-gray-200" />
                  <p className="text-xs font-medium text-gray-400">No pending submissions</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {pendingSubs.slice(0, 4).map((s) => {
                    const meta = STATUS_META[s.status] ?? { color: '#9CA3AF', bg: '#F3F4F6', label: s.status };
                    return (
                      <div key={s.id} onClick={() => navigate(`/pipeline/${s.id}`)}
                        className="group flex cursor-pointer items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold text-gray-900">{s.title}</div>
                          <span className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ backgroundColor: meta.bg, color: meta.color }}>
                            {meta.label}
                          </span>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-200 group-hover:text-gray-400 transition-colors" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>


      </div>
    </div>
  );
}
