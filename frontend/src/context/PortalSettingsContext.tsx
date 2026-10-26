import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getPortalSettings, type PortalContent, type WhyContent } from '../lib/portalSettingsService';

const DEFAULT_BANNERS: PortalContent['banners'] = {
  home: { title: 'AIMPLIFY', subtitle: 'One platform for discovering, reusing, and deploying proven AI accelerators.' },
  login: { title: 'AIMPLIFY', subtitle: 'AI Management for Process Lifecycle, Intelligence, Flow & Yield' },
  catalog: { title: 'Asset Catalog', subtitle: 'Discover reusable, approved AI assets across the FAST platform families.' },
  pipeline: { title: 'Assets Pipeline', subtitle: 'Track submissions, reviews, requests, and publishing activity.' },
  submit: { title: 'Submit a New Asset', subtitle: 'Share a reusable AI capability for evaluation and publication.' },
  why: { title: 'Why AIMPLIFY?', subtitle: 'The platform that turns collective intelligence into company advantage.' },
  observability: { title: 'Observability Dashboard', subtitle: 'Monitor platform activity, governance, adoption, and engagement.' },
  executive: { title: 'Asset Governance & Adoption', subtitle: 'Executive reporting across AIMPLIFY performance and outcomes.' },
};

export const DEFAULT_WHY: WhyContent = {
  executive_summary: "AImplify exists to transform individual ideas and customer insights into shared organizational capabilities. It is a structured platform where InfoVisioners collaborate on real customer problems, generate reusable IP and accelerators, learn from one another, and build assets that strengthen delivery, sales, innovation, and customer outcomes across the enterprise. AImplify is the key accelerant in InfoVision's journey toward becoming an AI-Native organization - for our people, and for our customers.",
  pillars_heading: 'Key reasons AImplify matters to InfoVision',
  pillars_subheading: 'From culture to customer traction, each pillar addresses a distinct and urgent organizational need.',
  pillars: [
    { num: '1', icon: '🧭', color: '#00C6FF', title: 'Driving an AI-First Culture', body: "Becoming AI-First is a baseline imperative. Culture shifts don't happen on their own -they need a place to live. AImplify is that place. It provides a central, visible platform that accelerates mindset change, fuels ideation, and makes AI adoption tangible for every team, not just the tech leads.", bullets: [], footer: '' },
    { num: '2', icon: '🤝', color: '#7B4FFF', title: 'Scaling Collective Innovation', body: 'Our delivery teams are the eyes and ears of every customer engagement. AImplify gives them a voice beyond project delivery. It enables every InfoVisioner to contribute ideas, frameworks, and thought leadership that the entire organization can benefit from -through real use cases, not theoretical exercises.', bullets: [], footer: '' },
    { num: '3', icon: '🎯', color: '#FFB400', title: 'Capturing Real Customer Problems', body: 'The platform is built around actual customer problem statements, not hypothetical use cases. That focus is deliberate and powerful.', bullets: ['Learn what challenges clients face across engagements', 'Identify common patterns across customers and industries', 'Turn those patterns into reusable, scalable solutions'], footer: '' },
    { num: '4', icon: '💡', color: '#00B4A0', title: 'Converting Ideas into Reusable IP', body: 'An idea without a home is an idea lost. AImplify is the mechanism that turns insights, accelerators, and solutions into durable, reusable intellectual property. Every asset built lives on -available to delivery teams, sales teams, and future engagements. We compound value instead of starting over.', bullets: [], footer: '' },
    { num: '5', icon: '📦', color: '#1A3A6B', title: 'Arming Sales With What We Actually Solve', body: 'AImplify is not just an internal innovation platform. It directly equips customer-facing teams with real capability evidence.', bullets: ['Know which customer problems InfoVision can solve today', 'Access accelerators that already exist and can be demonstrated', 'Bring proven assets into proposals and customer conversations'], footer: 'A catalog of proven capabilities beats a slide deck every time.' },
    { num: '6', icon: '👁️', color: '#FF6B9D', title: 'Changing Customer Perception', body: 'In a competitive market, seeing is believing. A platform that demonstrates real, working AI capabilities shifts customer and prospect perception in ways that no presentation ever can. AImplify is a proof point -tangible, interactive, and differentiated. It shows the market that InfoVision builds, not just recommends.', bullets: [], footer: '' },
    { num: '7', icon: '⚡', color: '#00B4A0', title: 'Transforming Delivery Teams to Move Faster', body: 'Delivery teams should not start from zero on every engagement. AImplify puts proven assets directly in their hands -so they spend less time building foundations and more time solving the actual client problem.', bullets: ['Clone and deploy vetted accelerators in days, not months', 'Reduce ramp-up time on new engagements', 'Deliver with consistency, quality, and speed across every project'], footer: 'Faster delivery is not just a competitive advantage. It is a margin advantage.' },
    { num: '8', icon: '🧠', color: '#FF7A45', title: 'Enabling Organizational Learning', body: "Some of AImplify's most important outcomes are tacit. The platform becomes the place where InfoVisioners grow -not through mandatory training, but through real contribution and peer collaboration.", bullets: ['Cross-team collaboration on shared problems', 'Knowledge sharing from the front lines of delivery', 'Learning from real use cases and industry patterns', "Understanding what's coming before it arrives"], footer: '' },
    { num: '9', icon: '📡', color: '#7B4FFF', title: 'Investing in What Customers Are Actually Adopting', body: 'Not all assets are equal. AImplify tracks which accelerators are actively being implemented by customers and gaining real traction -so we know where to double down.', bullets: ['Full traceability of asset adoption across customer engagements', 'Surface what is working in the market, in real time', 'Direct investment and improvement effort toward highest-impact assets'], footer: 'We build what customers use. Traction guides every roadmap decision.' },
  ],
  chips: ['🚀 Faster Delivery', '🔁 Reusable IP', '💼 Stronger Sales', '📈 Better Margins', '🤖 AI-Native Culture', '🌐 Smarter Teams', '🔍 Proven Capabilities', '🎓 Continuous Learning', '⚡ Accelerated Delivery', '📡 Asset Traceability'],
  outcomes_heading: 'One platform. Many outcomes.',
  outcomes_body: 'AImplify creates a flywheel. Teams contribute use cases. Those become accelerators. Accelerators win customers. Customer wins generate new problems. Problems generate new ideas. The loop compounds.',
  benefits_heading: 'Why Enterprises Choose AIMPLIFY',
  benefits: [
    { icon_key: 'Target', title: 'End-to-End AI Lifecycle', body: 'Manage the entire AI journey from ideation to impact.' },
    { icon_key: 'Layers3', title: 'Unified & Integrated Platform', body: 'One platform. One experience. All your AI needs.' },
    { icon_key: 'ShieldCheck', title: 'Built for Trust, Security & Compliance', body: 'Enterprise-grade security, governance and responsible AI by design.' },
    { icon_key: 'Users', title: 'Human + AI Collaboration', body: 'Empower your teams with AI that augments human potential.' },
    { icon_key: 'TrendingUp', title: 'Drive Measurable Outcomes', body: 'Optimize processes, accelerate flow and maximize yield.' },
    { icon_key: 'BrainCircuit', title: 'Scalable. Flexible. Future-Ready.', body: "Built to scale with your business and adapt to what's next." },
  ],
  closing: {
    heading: "We are not just building a platform.\nWe are building InfoVision's future.",
    body1: 'The organizations that win the next decade will not be the ones with the largest headcount or the most tools. They will be the ones that learn fastest, build reusably, and bring proven capabilities to every conversation.',
    body2: 'AImplify Outcome. is how InfoVision does all three - simultaneously, at scale, and in a way that our customers can see and feel.',
    quote: '"The platform becomes the proof. The proof becomes the pipeline."',
  },
};

const PortalSettingsContext = createContext({ banners: DEFAULT_BANNERS, why: DEFAULT_WHY });

export function PortalSettingsProvider({ children }: { children: ReactNode }) {
  const [banners, setBanners] = useState(DEFAULT_BANNERS);
  const [why, setWhy] = useState<WhyContent>(DEFAULT_WHY);
  useEffect(() => {
    let active = true;
    const load = () => void getPortalSettings().then((content) => {
      if (!active) return;
      setBanners({ ...DEFAULT_BANNERS, ...content.banners });
      if (content.why) setWhy({ ...DEFAULT_WHY, ...content.why });
    }).catch(() => undefined);
    load();
    window.addEventListener('portal-settings-updated', load);
    return () => { active = false; window.removeEventListener('portal-settings-updated', load); };
  }, []);
  const value = useMemo(() => ({ banners, why }), [banners, why]);
  return <PortalSettingsContext.Provider value={value}>{children}</PortalSettingsContext.Provider>;
}

export const usePortalSettings = () => useContext(PortalSettingsContext);
