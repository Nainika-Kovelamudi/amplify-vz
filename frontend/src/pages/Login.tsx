import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, Sparkles, Target, Workflow } from 'lucide-react';
import { useFamilies } from '../context/FamiliesContext';
import { FamilyIcon } from '../components/families/FamilyIcon';
import { useAuth } from '../context/AuthContext';

function MicrosoftLogo() {
  return <svg className="h-5 w-5 shrink-0" viewBox="0 0 21 21" aria-hidden="true"><rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" /><rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" /></svg>;
}

const FAMILY_ACTIONS: Record<string, string> = { Forge: 'Build AI', Atlas: 'Enable AI', Sentinel: 'Secure AI', Titan: 'Execute AI' };
const CAPABILITIES = [
  { icon: ShieldCheck, title: 'Enterprise Ready', text: 'Secure. Compliant. Trusted.', color: '#22d3ee' },
  { icon: Target, title: 'End-to-End AI', text: 'From ideation to measurable impact.', color: '#a855f7' },
  { icon: Workflow, title: 'Operationalize AI', text: 'Govern, monitor and scale with confidence.', color: '#d946ef' },
  { icon: Sparkles, title: 'Built for Impact', text: 'Maximize productivity, flow and yield.', color: '#f59e0b' },
];

export const Login: React.FC = () => {
  const [isSsoLoading, setIsSsoLoading] = useState(false);
  const [devEmail, setDevEmail] = useState('admin@amplify.local');
  const isLocalDev = import.meta.env.VITE_API_URL?.includes('localhost') || import.meta.env.VITE_API_URL?.includes('127.0.0.1');
  const navigate = useNavigate();
  const location = useLocation();
  const { families, loading: familiesLoading } = useFamilies();
  const { isAuthenticated, isLoading: authLoading, authError, login } = useAuth();

  useEffect(() => { if (!authLoading && isAuthenticated) navigate('/', { replace: true }); }, [authLoading, isAuthenticated, navigate]);

  const handleMicrosoftSignIn = async (email?: string) => {
    setIsSsoLoading(true);
    try { await login(email); } finally { setIsSsoLoading(false); }
  };
  const displayError = authError ?? (location.state as { authError?: string } | null)?.authError ?? null;
  const familyEntries = Object.entries(families);

  return (
    <main className="min-h-screen bg-slate-100 p-0 lg:h-screen lg:overflow-hidden lg:p-2">
      <div className="mx-auto grid min-h-screen max-w-[1800px] overflow-hidden bg-white shadow-2xl lg:h-[calc(100vh-1rem)] lg:min-h-0 lg:grid-cols-[57%_43%] lg:rounded-[22px]">
        <motion.section initial={{ opacity: 0, x: -25 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .55, ease: 'easeOut' }} className="relative hidden overflow-hidden bg-[#020a25] px-8 py-6 text-white lg:flex lg:flex-col xl:px-12 xl:py-7">
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at 82% 42%, rgba(55,48,255,.38), transparent 29%), radial-gradient(circle at 88% 76%, rgba(232,33,190,.25), transparent 27%), radial-gradient(circle at 12% 8%, rgba(14,165,233,.10), transparent 30%)' }} />
          <div className="pointer-events-none absolute -bottom-56 -right-24 h-[560px] w-[900px] rotate-[-10deg] rounded-[50%] opacity-60" style={{ backgroundImage: 'repeating-radial-gradient(ellipse at center, transparent 0 12px, rgba(37,99,235,.33) 13px 14px, transparent 15px 23px)', maskImage: 'linear-gradient(to top, black, transparent 82%)' }} />
          <div className="pointer-events-none absolute -bottom-72 -left-32 h-[520px] w-[900px] rotate-[8deg] rounded-[50%] opacity-40" style={{ backgroundImage: 'repeating-radial-gradient(ellipse at center, transparent 0 11px, rgba(147,51,234,.38) 12px 13px, transparent 14px 22px)', maskImage: 'linear-gradient(to top, black, transparent 80%)' }} />

          <div className="relative z-10 flex items-center">
            <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-4xl font-extrabold tracking-[.025em] xl:text-5xl"><span className="bg-gradient-to-b from-cyan-300 via-blue-500 to-violet-600 bg-clip-text text-transparent">AI</span><span className="text-white">MPLIFY</span></motion.h1>
          </div>

          <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-center">
            <div className="mt-4 max-w-2xl text-xl font-semibold leading-[1.3] xl:text-[26px]">
              <p className="text-white">AI Management for</p>
              <p><span className="text-blue-400">Process Lifecycle</span><span className="text-white">, </span><span className="text-emerald-400">Intelligence</span><span className="text-white">,</span></p>
              <p><span className="text-orange-400">Flow</span><span className="text-white"> &amp; </span><span className="text-pink-400">Yield</span></p>
            </div>
            <div className="mt-4 h-0.5 w-14 bg-gradient-to-r from-cyan-400 to-fuchsia-500" />
            <p className="mt-3 max-w-md text-xs leading-5 text-slate-300 xl:text-sm xl:leading-6">A unified platform to manage, operationalize and multiply value from AI across the enterprise.</p>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {familiesLoading && familyEntries.length === 0 ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl border border-white/10 bg-white/5" />) : familyEntries.map(([id, family], index) => {
                const displayColor = family.color;
                return <motion.div key={id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .22 + index * .07 }} whileHover={{ y: -3, backgroundColor: `${displayColor}18` }} className="flex min-h-[80px] items-center gap-3 rounded-xl border bg-slate-950/30 px-3 py-2.5 backdrop-blur-sm" style={{ borderColor: `${displayColor}75` }}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: displayColor, backgroundColor: `${displayColor}0f` }}><FamilyIcon family={id} color={displayColor} className="h-6 w-6" /></div>
                  <div className="min-w-0"><p className="text-sm font-extrabold uppercase tracking-wide" style={{ color: displayColor }}>{family.name}</p><p className="mt-0.5 text-xs font-medium text-white">{FAMILY_ACTIONS[id]}</p><span className="mt-1.5 inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold tabular-nums" style={{ color: displayColor, backgroundColor: `${displayColor}30` }}>{family.asset_count} {family.asset_count === 1 ? 'Asset' : 'Assets'}</span></div>
                </motion.div>;
              })}
            </div>

            <div className="mt-5 grid grid-cols-4 divide-x divide-white/15">
              {CAPABILITIES.map(({ icon: Icon, title, text, color }) => <div key={title} className="px-2 text-center first:pl-0 last:pr-0"><Icon className="mx-auto h-5 w-5" style={{ color }} /><p className="mt-1.5 text-[10px] font-semibold text-white xl:text-[11px]">{title}</p><p className="mt-0.5 text-[8px] leading-3.5 text-slate-400 xl:text-[9px]">{text}</p></div>)}
            </div>
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .15, duration: .45 }} className="relative flex min-h-screen items-center justify-center overflow-y-auto bg-[radial-gradient(circle_at_50%_15%,#ffffff_0%,#f8fbff_50%,#edf3fb_100%)] px-5 py-8 lg:min-h-0">
          <div className="w-full max-w-[480px] rounded-3xl border border-white/80 bg-white/90 px-7 py-9 shadow-[0_20px_65px_rgba(30,64,175,.10)] backdrop-blur sm:px-11 sm:py-11">
            <div className="mb-8 text-center"><img src="/aimplify-header-logo.png" alt="AIMPLIFY" className="mx-auto h-20 w-auto object-contain" /><h2 className="mt-3 text-2xl font-extrabold text-slate-950">Welcome back</h2><p className="mt-1.5 text-sm text-slate-500">Sign in to your AIMPLIFY platform</p></div>
            {displayError && <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{displayError}</motion.div>}
            {authLoading ? <div className="flex justify-center py-7"><div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" /></div> : isLocalDev ? (
              <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Local Dev — Select a test account</p>
                <div className="grid grid-cols-3 gap-1.5">{[['Standard User', 'standarduser@amplify.local'], ['Admin', 'admin@amplify.local'], ['Owner', 'owner@amplify.local']].map(([label, email]) => <button key={email} type="button" onClick={() => setDevEmail(email)} className={`rounded-lg border border-amber-200 bg-white px-2 py-2 text-xs font-bold text-amber-800 ${devEmail === email ? 'ring-2 ring-amber-400' : ''}`}>{label}</button>)}</div>
                <input type="email" value={devEmail} onChange={(event) => setDevEmail(event.target.value)} className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400" />
                <button type="button" onClick={() => void handleMicrosoftSignIn(devEmail)} disabled={isSsoLoading || !devEmail.trim()} className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{isSsoLoading ? 'Signing in…' : `Sign in as ${devEmail.split('@')[0]}`}</button>
              </div>
            ) : (
              <div><motion.button whileHover={{ y: isSsoLoading ? 0 : -2, boxShadow: '0 12px 25px rgba(37,99,235,.13)' }} whileTap={{ scale: isSsoLoading ? 1 : .99 }} type="button" onClick={() => void handleMicrosoftSignIn()} disabled={isSsoLoading} className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40 disabled:opacity-60"><MicrosoftLogo />{isSsoLoading ? 'Signing in with Microsoft…' : 'Sign in with Microsoft SSO'}</motion.button><p className="mt-4 text-center text-xs text-slate-400">Secured with Microsoft Entra ID (Azure AD)</p></div>
            )}
            <div className="my-7 flex items-center gap-3"><div className="h-px flex-1 bg-slate-200" /><span className="text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400">Powered by</span><div className="h-px flex-1 bg-slate-200" /></div>
            <img src="/infovision_logo.png" alt="InfoVision" className="mx-auto h-12 w-auto object-contain" />
          </div>
        </motion.section>
      </div>
    </main>
  );
};
