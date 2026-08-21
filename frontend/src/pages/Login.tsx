import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useFamilies } from '../context/FamiliesContext';
import { useAuth } from '../context/AuthContext';

function MicrosoftLogo() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export const Login: React.FC = () => {
  const [isSsoLoading, setIsSsoLoading] = useState(false);
  const [devEmail, setDevEmail] = useState('admin@amplify.local');
  const isLocalDev = import.meta.env.VITE_API_URL?.includes('localhost') ||
                     import.meta.env.VITE_API_URL?.includes('127.0.0.1');
  const navigate  = useNavigate();
  const location  = useLocation();
  const { families, loading: familiesLoading } = useFamilies();
  const { isAuthenticated, isLoading: authLoading, authError, login } = useAuth();

  useEffect(() => {
    if (!authLoading && isAuthenticated) navigate('/', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const handleMicrosoftSignIn = async (email?: string) => {
    setIsSsoLoading(true);
    try { await login(email); } finally { setIsSsoLoading(false); }
  };

  const displayError =
    authError ?? (location.state as { authError?: string } | null)?.authError ?? null;

  const familyEntries = Object.entries(families);

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* ── Left panel ── */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative hidden w-[52%] flex-col justify-between overflow-hidden p-10 text-white lg:flex"
        style={{ background: 'linear-gradient(120deg, #1a237e 0%, #3949ab 30%, #6a1b9a 65%, #c2185b 100%)' }}
      >
        {/* background glows */}
        <div className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 20% 60%, rgba(255,255,255,0.07) 0%, transparent 55%), radial-gradient(ellipse at 80% 30%, rgba(255,100,150,0.12) 0%, transparent 50%)' }} />

        {/* Logo */}
        <div className="relative z-10">
          <img src="/aimplify-logo.png" alt="AIMPLIFY" className="h-32 w-auto" />
        </div>

        {/* Hero copy */}
        <div className="relative z-10">
          <h1 className="mb-3 text-3xl font-bold leading-snug xl:text-4xl">
            AImplify Outcome.
          </h1>
          <p className="mb-8 max-w-sm text-sm leading-relaxed text-blue-100/60">
            Discover, deploy, and demonstrate InfoVision's AI assets — from prompt libraries and agent patterns to production-ready accelerators.
          </p>

          {/* Family stats */}
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-blue-200/40">
            Platform families
          </p>
          <div className="grid grid-cols-3 gap-2.5 xl:grid-cols-5">
            {familiesLoading && familyEntries.length === 0
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center rounded-lg bg-white/5 px-2 py-2.5">
                    <div className="mb-1.5 h-6 w-8 animate-pulse rounded bg-white/10" />
                    <div className="h-2.5 w-12 animate-pulse rounded bg-white/10" />
                  </div>
                ))
              : familyEntries.map(([id, f], idx) => {
                  const palette = [
                    { num: '#93C5FD', bg: 'rgba(59,130,246,0.18)'  }, // blue
                    { num: '#6EE7B7', bg: 'rgba(16,185,129,0.18)'  }, // emerald
                    { num: '#FCD34D', bg: 'rgba(245,158,11,0.18)'  }, // amber
                    { num: '#F9A8D4', bg: 'rgba(236,72,153,0.18)'  }, // pink
                    { num: '#C4B5FD', bg: 'rgba(139,92,246,0.18)'  }, // violet
                  ];
                  const p = palette[idx % palette.length];
                  return (
                    <div key={id} className="flex flex-col items-center rounded-xl px-2 py-3" style={{ background: p.bg }}>
                        <span className="mb-0.5 text-2xl font-bold tabular-nums" style={{ color: p.num }}>
                          {f.asset_count}
                        </span>
                        <span className="text-center text-[9px] font-semibold uppercase leading-tight tracking-wide text-white/60">
                          {f.name}
                        </span>
                    </div>
                  );
                })}
          </div>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-xs text-white/70">© {new Date().getFullYear()} InfoVision Inc.</p>
      </motion.div>

      {/* ── Right panel ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="flex flex-1 flex-col items-center justify-center bg-white px-8 py-8"
      >
        <div className="w-full max-w-sm">
          {/* Logos */}
          <div className="mb-6 flex flex-col items-center gap-2">
            <img src="/aimplify-header-logo.png" alt="AIMPLIFY" className="h-36 w-auto object-contain mx-auto" />
            <div className="flex w-full items-center gap-3 px-4">
              <div className="h-px flex-1 bg-slate-200" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Powered by</p>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            <img src="/infovision_logo.png" alt="InfoVision" className="h-16 w-auto object-contain mx-auto" />
          </div>

          <div className="mb-6 text-center">
            <h2 className="mb-1 text-2xl font-bold text-slate-900">Sign in to AImplify Platform</h2>
            <p className="text-sm text-slate-500">Use your InfoVision Microsoft account</p>
          </div>

          {authLoading ? (
            <div className="flex justify-center py-6">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
            </div>
          ) : (
            <div className="space-y-3">
              {displayError && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                >
                  {displayError}
                </motion.div>
              )}

              {isLocalDev ? (
                <div className="space-y-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    Local Dev — Select a test account
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: 'Standard User', email: 'standarduser@amplify.local', color: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' },
                      { label: 'Admin',         email: 'admin@amplify.local',        color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
                      { label: 'Owner',         email: 'owner@amplify.local',        color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
                    ].map(({ label, email, color }) => (
                      <button key={email} type="button" onClick={() => setDevEmail(email)}
                        className={`rounded-lg border px-2 py-2 text-center text-xs font-bold transition ${color} ${devEmail === email ? 'ring-2 ring-amber-400' : ''}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <input type="email" value={devEmail} onChange={(e) => setDevEmail(e.target.value)}
                    placeholder="or type any email"
                    className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                  <button type="button" onClick={() => void handleMicrosoftSignIn(devEmail)}
                    disabled={isSsoLoading || !devEmail.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60">
                    {isSsoLoading ? 'Signing in…' : `Sign in as ${devEmail.split('@')[0]}`}
                  </button>
                </div>
              ) : (
                <>
                  <motion.button
                    whileHover={{ scale: isSsoLoading ? 1 : 1.01 }}
                    whileTap={{ scale: isSsoLoading ? 1 : 0.99 }}
                    type="button"
                    onClick={() => void handleMicrosoftSignIn()}
                    disabled={isSsoLoading}
                    className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3 font-medium text-slate-800 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md disabled:opacity-60"
                  >
                    <MicrosoftLogo />
                    {isSsoLoading ? 'Signing in with Microsoft…' : 'Sign in with Microsoft SSO'}
                  </motion.button>
                  <p className="text-center text-xs text-slate-400">
                    Secured with Microsoft Entra ID (Azure AD)
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
