import { useEffect, useRef } from 'react';
import { BrainCircuit, Layers3, ShieldCheck, Target, TrendingUp, Users, Workflow } from 'lucide-react';
import { familyAction, useFamilies } from '../context/FamiliesContext';
import { FamilyIcon } from '../components/families/FamilyIcon';
import { usePortalSettings } from '../context/PortalSettingsContext';

const pillars = [
  {
    num: '1', icon: '🧭', color: '#00C6FF',
    title: 'Driving an AI-First Culture',
    body: "Becoming AI-First is a baseline imperative. Culture shifts don't happen on their own -they need a place to live. AImplify is that place. It provides a central, visible platform that accelerates mindset change, fuels ideation, and makes AI adoption tangible for every team, not just the tech leads.",
  },
  {
    num: '2', icon: '🤝', color: '#7B4FFF',
    title: 'Scaling Collective Innovation',
    body: 'Our delivery teams are the eyes and ears of every customer engagement. AImplify gives them a voice beyond project delivery. It enables every InfoVisioner to contribute ideas, frameworks, and thought leadership that the entire organization can benefit from -through real use cases, not theoretical exercises.',
  },
  {
    num: '3', icon: '🎯', color: '#FFB400',
    title: 'Capturing Real Customer Problems',
    body: 'The platform is built around actual customer problem statements, not hypothetical use cases. That focus is deliberate and powerful.',
    bullets: [
      'Learn what challenges clients face across engagements',
      'Identify common patterns across customers and industries',
      'Turn those patterns into reusable, scalable solutions',
    ],
  },
  {
    num: '4', icon: '💡', color: '#00B4A0',
    title: 'Converting Ideas into Reusable IP',
    body: 'An idea without a home is an idea lost. AImplify is the mechanism that turns insights, accelerators, and solutions into durable, reusable intellectual property. Every asset built lives on -available to delivery teams, sales teams, and future engagements. We compound value instead of starting over.',
  },
  {
    num: '5', icon: '📦', color: '#1A3A6B',
    title: 'Arming Sales With What We Actually Solve',
    body: 'AImplify is not just an internal innovation platform. It directly equips customer-facing teams with real capability evidence.',
    bullets: [
      'Know which customer problems InfoVision can solve today',
      'Access accelerators that already exist and can be demonstrated',
      'Bring proven assets into proposals and customer conversations',
    ],
    footer: 'A catalog of proven capabilities beats a slide deck every time.',
  },
  {
    num: '6', icon: '👁️', color: '#FF6B9D',
    title: 'Changing Customer Perception',
    body: 'In a competitive market, seeing is believing. A platform that demonstrates real, working AI capabilities shifts customer and prospect perception in ways that no presentation ever can. AImplify is a proof point -tangible, interactive, and differentiated. It shows the market that InfoVision builds, not just recommends.',
  },
  {
    num: '7', icon: '⚡', color: '#00B4A0',
    title: 'Transforming Delivery Teams to Move Faster',
    body: 'Delivery teams should not start from zero on every engagement. AImplify puts proven assets directly in their hands -so they spend less time building foundations and more time solving the actual client problem.',
    bullets: [
      'Clone and deploy vetted accelerators in days, not months',
      'Reduce ramp-up time on new engagements',
      'Deliver with consistency, quality, and speed across every project',
    ],
    footer: 'Faster delivery is not just a competitive advantage. It is a margin advantage.',
  },
  {
    num: '8', icon: '🧠', color: '#FF7A45',
    title: 'Enabling Organizational Learning',
    body: "Some of AImplify's most important outcomes are tacit. The platform becomes the place where InfoVisioners grow -not through mandatory training, but through real contribution and peer collaboration.",
    bullets: [
      'Cross-team collaboration on shared problems',
      'Knowledge sharing from the front lines of delivery',
      'Learning from real use cases and industry patterns',
      "Understanding what's coming before it arrives",
    ],
  },
  {
    num: '9', icon: '📡', color: '#7B4FFF',
    title: 'Investing in What Customers Are Actually Adopting',
    body: 'Not all assets are equal. AImplify tracks which accelerators are actively being implemented by customers and gaining real traction -so we know where to double down.',
    bullets: [
      'Full traceability of asset adoption across customer engagements',
      'Surface what is working in the market, in real time',
      'Direct investment and improvement effort toward highest-impact assets',
    ],
    footer: 'We build what customers use. Traction guides every roadmap decision.',
  },
];

const chips = [
  '🚀 Faster Delivery', '🔁 Reusable IP', '💼 Stronger Sales', '📈 Better Margins',
  '🤖 AI-Native Culture', '🌐 Smarter Teams', '🔍 Proven Capabilities',
  '🎓 Continuous Learning', '⚡ Accelerated Delivery', '📡 Asset Traceability',
];

const benefits = [
  { icon: Target, title: 'End-to-End AI Lifecycle', body: 'Manage the entire AI journey from ideation to impact.' },
  { icon: Layers3, title: 'Unified & Integrated Platform', body: 'One platform. One experience. All your AI needs.' },
  { icon: ShieldCheck, title: 'Built for Trust, Security & Compliance', body: 'Enterprise-grade security, governance and responsible AI by design.' },
  { icon: Users, title: 'Human + AI Collaboration', body: 'Empower your teams with AI that augments human potential.' },
  { icon: TrendingUp, title: 'Drive Measurable Outcomes', body: 'Optimize processes, accelerate flow and maximize yield.' },
  { icon: BrainCircuit, title: 'Scalable. Flexible. Future-Ready.', body: "Built to scale with your business and adapt to what's next." },
];

function PreviewTabs({ value, onChange }: { value: 'current' | 'infographic'; onChange: (value: 'current' | 'infographic') => void }) {
  return <div className="border-b border-slate-200 bg-white px-4 py-2">
    <div className="mx-auto flex max-w-7xl justify-center gap-1 rounded-lg bg-slate-100 p-1 text-xs font-semibold sm:w-fit">
      <button onClick={() => onChange('current')} className={`rounded-md px-4 py-1.5 transition ${value === 'current' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Current design</button>
      <button onClick={() => onChange('infographic')} className={`rounded-md px-4 py-1.5 transition ${value === 'infographic' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500'}`}>Infographic design</button>
    </div>
  </div>;
}

function InfographicWhy({ families, title, subtitle }: { families: ReturnType<typeof useFamilies>['families']; title: string; subtitle: string }) {
  const familyCopy: Record<string, string> = {
    Forge: 'Engineer, develop and customize AI solutions faster with best practices, tools and accelerators.',
    Atlas: 'Unify and prepare your data, modernize platforms and establish the foundation to scale AI with confidence.',
    Sentinel: 'Protect AI assets and data, manage risks, ensure compliance and build trust with robust governance and guardrails.',
    Titan: 'Operationalize AI at scale with agents, automation and functional solutions that drive productivity and business outcomes.',
  };
  return <main className="min-h-screen overflow-hidden bg-[#02091d] text-white">
    <section className="relative mx-auto max-w-[1500px] overflow-hidden px-5 py-10 sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute inset-0 opacity-80" style={{ background: 'radial-gradient(circle at 58% 42%, rgba(0,126,255,.25), transparent 28%), radial-gradient(circle at 70% 55%, rgba(249,115,22,.15), transparent 23%), radial-gradient(circle at 45% 58%, rgba(109,40,217,.2), transparent 26%)' }} />
      <div className="relative grid gap-8 xl:grid-cols-[.72fr_1.28fr] xl:items-center">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">{title}</h1>
          <div className="my-5 h-0.5 w-28 bg-gradient-to-r from-cyan-400 to-fuchsia-500" />
          <p className="text-xl leading-relaxed text-slate-200 sm:text-2xl">{subtitle}</p>
          <p className="mt-7 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">AIMPLIFY brings together everything you need to manage the AI lifecycle end-to-end — driving Intelligence, accelerating Flow and maximizing Yield for measurable business impact.</p>
        </div>
        <div className="relative grid gap-3 sm:grid-cols-2">
          <div className="pointer-events-none absolute left-1/2 top-1/2 hidden h-44 w-96 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-[10px] border-cyan-400/40 shadow-[0_0_50px_#0ea5e9] lg:block" />
          {['Forge','Atlas','Sentinel','Titan'].map((id) => { const family = families[id]; if (!family) return null; return <article key={id} className="relative min-h-44 rounded-2xl border border-white/10 bg-slate-950/55 p-5 backdrop-blur-sm" style={{ boxShadow: `inset 0 1px 0 ${family.color}45` }}>
            <div className="flex items-start gap-4"><FamilyIcon family={id} color={family.color} className="h-14 w-14 shrink-0"/><div><h2 className="text-xl font-extrabold uppercase" style={{ color: family.color }}>{family.name}</h2><p className="font-bold text-white">{id === 'Forge' ? 'Build AI.' : id === 'Atlas' ? 'Enable AI.' : id === 'Sentinel' ? 'Secure AI.' : 'Execute AI.'}</p></div></div>
            <p className="mt-3 text-xs leading-5 text-slate-300 sm:text-sm">{familyCopy[id]}</p>
          </article>; })}
          <div className="pointer-events-none absolute left-1/2 top-1/2 hidden h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-cyan-300 bg-[#061637] text-4xl font-black shadow-[0_0_35px_#2563eb] lg:flex"><span className="bg-gradient-to-b from-cyan-300 to-violet-500 bg-clip-text text-transparent">A</span></div>
        </div>
      </div>
      <div className="relative mt-8 grid gap-px overflow-hidden rounded-xl border border-cyan-400/30 bg-cyan-400/20 sm:grid-cols-2 lg:grid-cols-4">
        {[['Process Lifecycle','Manage AI from ideation to retirement.'],['Intelligence','Turn data into intelligence with AI/ML and analytics.'],['Flow','Orchestrate workflows and automation.'],['Yield','Drive measurable outcomes and maximize impact.']].map(([title, body], i) => <div key={title} className="flex gap-3 bg-[#06132d] p-4"><Workflow className={`h-7 w-7 shrink-0 ${['text-cyan-400','text-blue-400','text-fuchsia-400','text-amber-400'][i]}`}/><div><h3 className="text-sm font-bold text-cyan-300">{title}</h3><p className="mt-1 text-[11px] leading-4 text-slate-300">{body}</p></div></div>)}
      </div>
      <h2 className="relative mt-5 text-center text-lg font-semibold">Why Enterprises Choose <span className="text-cyan-400">AIMPLIFY</span></h2>
      <div className="relative mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{benefits.map(({ icon: Icon, title, body }, i) => <article key={title} className="rounded-xl border border-blue-400/25 bg-[#06132d]/90 p-4 text-center"><Icon className={`mx-auto h-8 w-8 ${['text-cyan-400','text-sky-400','text-violet-400','text-amber-400','text-cyan-400','text-teal-400'][i]}`}/><h3 className="mt-3 text-xs font-bold leading-4">{title}</h3><p className="mt-2 text-[10px] leading-4 text-slate-300">{body}</p></article>)}</div>
      <p className="relative mt-5 text-center text-xs font-semibold uppercase tracking-[.35em] text-cyan-400">One Platform. Every Model. Every Process. Every Outcome.</p>
    </section>
  </main>;
}

export function WhyAimplify() {
  const revealRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { families } = useFamilies();
  const { banners } = usePortalSettings();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('opacity-100', 'translate-y-0');
            entry.target.classList.remove('opacity-0', 'translate-y-6');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 },
    );
    revealRefs.current.forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  const addRef = (i: number) => (el: HTMLDivElement | null) => { revealRefs.current[i] = el; };

  return (
    <div className="min-h-screen" style={{ background: '#F4F7FF', color: '#1E2D4A', fontFamily: 'Rubik, sans-serif' }}>

      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #0066cc 0%, #00aaff 40%, #00ccaa 100%)', padding: '1rem 1.5rem 1.25rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          {/* Pre Title */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 100, padding: '5px 14px', fontFamily: 'Poppins, sans-serif', fontSize: '0.75rem', fontWeight: 400, color: '#ffffff', letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: '40px', marginBottom: '0.5rem' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="#fff" strokeWidth="1.5"/><path d="M4 6l1.5 1.5L8 4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Enterprise AI Platform
          </div>
          {/* H1 */}
          <h1 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 'clamp(1.3rem, 2.8vw, 2rem)', fontWeight: 400, color: '#FFFFFF', lineHeight: '1.28', marginBottom: '0.5rem', marginTop: '0.25rem' }}>
            {banners.why.title}
          </h1>
          {/* Body — Rubik Regular */}
          <p style={{ fontFamily: 'Rubik, sans-serif', fontSize: '0.95rem', fontWeight: 400, color: 'rgba(255,255,255,0.85)', lineHeight: '1.67', margin: 0 }}>
            {banners.why.subtitle}
          </p>
        </div>
      </section>

      {/* Executive Summary */}
      <div style={{ background: '#ffffff', padding: '2.5rem 1.5rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', borderLeft: '4px solid #0099ee', paddingLeft: '1.5rem' }}>
          {/* Pre Title */}
          <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.75rem', fontWeight: 700, color: '#0066cc', letterSpacing: '0.14em', textTransform: 'uppercase', lineHeight: '40px', marginBottom: '0.25rem' }}>Executive Summary</div>
          {/* Body Secondary */}
          <p style={{ fontFamily: 'Rubik, sans-serif', fontSize: '1.125rem', fontWeight: 400, color: '#374151', lineHeight: '1.67', textAlign: 'justify', margin: 0 }}>
            AImplify exists to transform individual ideas and customer insights into shared organizational capabilities. It is a structured platform where InfoVisioners collaborate on real customer problems, generate reusable IP and accelerators, learn from one another, and build assets that strengthen delivery, sales, innovation, and customer outcomes across the enterprise. AImplify is the key accelerant in InfoVision's journey toward becoming an AI-Native organization - for our people, and for our customers.
          </p>
        </div>
      </div>

      {/* FAST asset-family definitions are sourced from the shared family API. */}
      <section style={{ background: '#f8fafc', padding: '3.5rem 1.5rem', borderTop: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.75rem', fontWeight: 700, color: '#0066cc', letterSpacing: '0.14em', textTransform: 'uppercase' }}>FAST Asset Families</div>
            <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 500, color: '#111827', margin: '0.6rem 0' }}>How every asset is aligned</h2>
            <p style={{ fontFamily: 'Rubik, sans-serif', color: '#6b7280', margin: 0 }}>Forge, Atlas, Sentinel, and Titan provide a clear objective and home for reusable capabilities.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {Object.entries(families).map(([id, family]) => (
              <article key={id} style={{ background: '#fff', border: `1px solid ${family.color}35`, borderTop: `4px solid ${family.color}`, borderRadius: 12, padding: '1.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}><FamilyIcon family={id} color={family.color} className="h-11 w-11" /><h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1rem', fontWeight: 700, color: family.color, margin: 0, lineHeight: 1.35 }}><span style={{ display: 'block' }}>{family.name}</span><span style={{ display: 'block' }}>{familyAction(id)}</span></h3></div>
                <p style={{ fontFamily: 'Rubik, sans-serif', fontSize: '0.82rem', fontWeight: 700, color: '#374151', margin: '0.45rem 0 0.7rem' }}>{family.tagline}</p>
                <p style={{ fontFamily: 'Rubik, sans-serif', fontSize: '0.9rem', fontWeight: 600, lineHeight: 1.6, color: '#374151', margin: '0 0 0.7rem' }}>{family.summary}</p>
                <p style={{ fontFamily: 'Rubik, sans-serif', fontSize: '0.9rem', lineHeight: 1.65, color: '#6b7280', margin: 0 }}>{family.longDesc}</p>
                {family.keyAssets.length > 0 && <div style={{ marginTop: '1rem' }}>
                  <p style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.72rem', fontWeight: 700, color: '#374151', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Key assets</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>{family.keyAssets.map(asset => <span key={asset} style={{ borderRadius: 999, background: `${family.color}12`, color: family.color, border: `1px solid ${family.color}30`, padding: '4px 9px', fontSize: '0.72rem', fontWeight: 600 }}>{asset}</span>)}</div>
                </div>}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Pillars */}
      <div style={{ background: '#f8fafc', padding: '5rem 1.5rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div ref={addRef(0)} className="opacity-0 translate-y-6 transition-all duration-500" style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            {/* H2 — Poppins Regular 50pt */}
            <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 400, color: '#111827', lineHeight: '1.4' }}>
              Key reasons AImplify matters to InfoVision
            </h2>
            {/* Body — Rubik */}
            <p style={{ fontFamily: 'Rubik, sans-serif', fontSize: '1.125rem', fontWeight: 400, color: '#6b7280', maxWidth: 560, margin: '0.5rem auto 0', lineHeight: '1.67' }}>
              From culture to customer traction, each pillar addresses a distinct and urgent organizational need.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {pillars.map((p, i) => (
              <div key={i} ref={addRef(i + 1)}
                className="opacity-0 translate-y-6 transition-all duration-500"
                style={{ background: '#ffffff', padding: '2rem', position: 'relative', transition: 'box-shadow 0.22s ease', cursor: 'default', border: '1px solid #e5e7eb' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(0,102,204,0.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}>
                <span style={{ position: 'absolute', top: -1, left: -1, width: 18, height: 18, borderTop: '2.5px solid #0066cc', borderLeft: '2.5px solid #0066cc' }} />
                <span style={{ position: 'absolute', bottom: -1, right: -1, width: 18, height: 18, borderBottom: '2.5px solid #0066cc', borderRight: '2.5px solid #0066cc' }} />
                {/* H3 — Poppins Medium 50pt scaled */}
                <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#111827', marginBottom: '0.75rem', lineHeight: '1.4' }}>{p.title}</h3>
                {/* Body — Rubik Regular 18pt */}
                <p style={{ fontFamily: 'Rubik, sans-serif', fontSize: '1rem', fontWeight: 400, color: '#4b5563', lineHeight: '1.67', textAlign: 'justify' }}>{p.body}</p>
                {p.bullets && (
                  <ul style={{ marginTop: '0.8rem', paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {p.bullets.map((b, j) => (
                      <li key={j} style={{ fontFamily: 'Rubik, sans-serif', fontSize: '0.95rem', fontWeight: 400, color: '#4b5563', paddingLeft: '1.2rem', position: 'relative', lineHeight: '1.6' }}>
                        <span style={{ position: 'absolute', left: 0, fontSize: '0.75rem', color: '#0066cc', top: 3 }}>→</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
                {p.footer && <p style={{ marginTop: '0.75rem', fontFamily: 'Rubik, sans-serif', fontSize: '0.95rem', fontWeight: 400, color: '#6b7280', lineHeight: '1.65' }}>{p.footer}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Outcomes Band */}
      <div style={{ background: '#ffffff', padding: '4rem 1.5rem', textAlign: 'center', borderTop: '1px solid #e5e7eb' }}>
        <div ref={addRef(pillars.length + 1)} className="opacity-0 translate-y-6 transition-all duration-500" style={{ maxWidth: 700, margin: '0 auto' }}>
          {/* H2 — Poppins Regular */}
          <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 400, color: '#111827', lineHeight: '1.4', marginBottom: '1rem' }}>
            One platform. Many outcomes.
          </h2>
          {/* Body — Rubik */}
          <p style={{ fontFamily: 'Rubik, sans-serif', fontSize: '1.125rem', fontWeight: 400, color: '#6b7280', lineHeight: '1.67', marginBottom: '2rem' }}>
            AImplify creates a flywheel. Teams contribute use cases. Those become accelerators. Accelerators win customers. Customer wins generate new problems. Problems generate new ideas. The loop compounds.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', justifyContent: 'center' }}>
            {chips.map((chip, i) => (
              <span key={i} style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.8rem', fontWeight: 400, background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 100, padding: '6px 14px', color: '#0066cc', cursor: 'default', transition: 'background 0.18s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLSpanElement).style.background = '#dbeafe'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLSpanElement).style.background = '#f0f7ff'; }}>
                {chip}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Closing */}
      <div style={{ background: '#f8fafc', padding: '5rem 1.5rem', textAlign: 'center', borderTop: '1px solid #e5e7eb' }}>
        <div ref={addRef(pillars.length + 2)} className="opacity-0 translate-y-6 transition-all duration-500" style={{ maxWidth: 720, margin: '0 auto' }}>
          {/* H2 — Poppins Regular */}
          <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)', fontWeight: 400, color: '#111827', lineHeight: '1.4', marginBottom: '1.2rem' }}>
            We are not just building a platform.<br />We are building InfoVision's future.
          </h2>
          <div style={{ width: 48, height: 3, background: 'linear-gradient(90deg, #0066cc, #00ccaa)', borderRadius: 4, margin: '2rem auto' }} />
          {/* Body — Rubik */}
          <p style={{ fontFamily: 'Rubik, sans-serif', fontSize: '1.125rem', fontWeight: 400, color: '#6b7280', lineHeight: '1.67', marginBottom: '0.6rem' }}>
            The organizations that win the next decade will not be the ones with the largest headcount or the most tools. They will be the ones that learn fastest, build reusably, and bring proven capabilities to every conversation.
          </p>
          <p style={{ fontFamily: 'Rubik, sans-serif', fontSize: '1.125rem', fontWeight: 400, color: '#6b7280', lineHeight: '1.67', marginBottom: '1.5rem' }}>
            AImplify Outcome. is how InfoVision does all three - simultaneously, at scale, and in a way that our customers can see and feel.
          </p>
          {/* Body Secondary — Droid Serif italic */}
          <p style={{ fontFamily: 'Rubik, sans-serif', fontSize: '1.125rem', fontWeight: 400, color: '#374151', fontStyle: 'italic', lineHeight: '1.67' }}>
            "The platform becomes the proof. The proof becomes the pipeline."
          </p>
        </div>
      </div>

    </div>
  );
}
