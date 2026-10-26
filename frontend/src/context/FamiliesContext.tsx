import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getPlatformFamilies, type PlatformFamily } from '../lib/catalogService';
import { authStore } from '../store/authStore';

export interface FamilyUi {
  name: string;
  tagline: string;
  color: string;
  bg: string;
  longDesc: string;
  summary: string;
  keyAssets: string[];
  useCases: string[];
  dependsOn: string[];
  enables: string[];
  solutions: { name: string; description: string }[];
  asset_count: number;
}

type FamiliesContextValue = {
  families: Record<string, FamilyUi>;
  loading: boolean;
};

const FamiliesContext = createContext<FamiliesContextValue>({ families: {}, loading: true });

export function familyAction(family: string): string {
  return ({ forge: 'Build AI.', atlas: 'Enable AI.', sentinel: 'Secure AI.', titan: 'Execute AI.' } as Record<string, string>)[family.toLowerCase()] ?? '';
}

function toFamilyUi(f: PlatformFamily): FamilyUi {
  return {
    name: f.name,
    tagline: f.tagline ?? f.description ?? '',
    color: f.color,
    bg: `${f.color}14`,
    longDesc: f.long_description ?? f.description ?? '',
    summary: f.summary ?? '',
    keyAssets: f.key_assets ?? [],
    useCases: f.use_cases ?? [],
    dependsOn: f.depends_on ?? [],
    enables: f.enables ?? [],
    solutions: f.solutions ?? [],
    asset_count: f.asset_count ?? 0,
  };
}

// Hardcoded fallback so the dropdown always works even when the API is unreachable
export const FALLBACK_FAMILIES: Record<string, FamilyUi> = {
  Forge:    { name: 'Forge', tagline: 'AI Engineering & Development', color: '#F05A0A', bg: '#F05A0A14', summary: 'Forge builds, engineers and operationalizes AI solutions from idea to production.', longDesc: 'FORGE is the AI engineering and development family within AIMPLIFY, enabling organizations to design, build, test, deploy and continuously improve AI-powered solutions. It provides the engineering capabilities required across the AI Software Development Lifecycle, from experimentation and prototyping through production deployment and evolution.', keyAssets: ['AI Engineering', 'AI Development', 'AI SDLC', 'GenAI', 'Agentic AI', 'AI Applications'], useCases: [], dependsOn: [], enables: [], solutions: [], asset_count: 0 },
  Atlas:    { name: 'Atlas', tagline: 'AI Foundation & Platform', color: '#147FE6', bg: '#147FE614', summary: 'ATLAS provides the data, models, knowledge, platform and infrastructure that power enterprise AI.', longDesc: 'ATLAS is the foundational layer of AIMPLIFY, providing the technology ecosystem required to build and operate enterprise AI at scale. It brings together AI infrastructure, data, models, knowledge, compute, platforms and reusable services into a scalable and composable AI foundation.', keyAssets: ['AI Foundation', 'Data', 'Models', 'Knowledge', 'Platform', 'Infrastructure'], useCases: [], dependsOn: [], enables: [], solutions: [], asset_count: 0 },
  Sentinel: { name: 'Sentinel', tagline: 'AI Security, Risk & Governance', color: '#07885C', bg: '#07885C14', summary: 'SENTINEL secures, governs, monitors and assures AI across its entire lifecycle.', longDesc: "SENTINEL is AIMPLIFY's AI Trust, Security and Governance family, designed to protect AI systems from emerging threats while ensuring responsible, compliant and controlled AI adoption. It provides continuous security, risk management, governance, guardrails and observability across models, agents, applications and AI workflows.", keyAssets: ['AI Security', 'Red Team', 'Guardrails', 'Observability', 'Risk', 'Compliance', 'Governance'], useCases: [], dependsOn: [], enables: [], solutions: [], asset_count: 0 },
  Titan:    { name: 'Titan', tagline: 'Agentic Automation & Functional AI', color: '#5B35CC', bg: '#5B35CC14', summary: 'TITAN puts AI to work through intelligent agents, automated workflows and AI-powered business operations.', longDesc: 'TITAN is the execution and business-value layer of AIMPLIFY. It transforms AI capabilities into autonomous and semi-autonomous digital workers that can reason, make decisions, orchestrate workflows and execute business processes across enterprise systems.', keyAssets: ['Agents', 'Workflows', 'Process Automation', 'Functional AI', 'Digital Workers', 'Business Operations'], useCases: [], dependsOn: [], enables: [], solutions: [], asset_count: 0 },
};

export function FamiliesProvider({ children }: { children: ReactNode }) {
  const [families, setFamilies] = useState<Record<string, FamilyUi>>(FALLBACK_FAMILIES);
  const [loading, setLoading] = useState(true);
  // Re-fetch when the user logs in so cold-start misses are recovered
  const isAuthenticated = authStore((s) => !!s.accessToken);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const loadFamilies = (retryCount = 0) => {
      setLoading(true);
      void getPlatformFamilies().then((list) => {
        if (cancelled) return;
        if (list.length > 0) {
          const record: Record<string, FamilyUi> = {};
          list.forEach((f) => { record[f.id] = toFamilyUi(f); });
          setFamilies(record);
        }
        // if API returns empty, keep fallback
      })
      .catch((err) => {
        console.error('[FamiliesContext] Failed to load platform families:', err);
        // Retry up to 3 times with backoff so a cold-start or brief network hiccup
        // doesn't leave all family cards showing 0 assets permanently.
        if (!cancelled && retryCount < 3) {
          retryTimer = setTimeout(() => loadFamilies(retryCount + 1), 2000 * (retryCount + 1));
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    };
    loadFamilies();
    window.addEventListener('portal-settings-updated', () => loadFamilies());
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener('portal-settings-updated', () => loadFamilies());
    };
  }, [isAuthenticated]);

  const value = useMemo(() => ({ families, loading }), [families, loading]);
  return <FamiliesContext.Provider value={value}>{children}</FamiliesContext.Provider>;
}

export function useFamilies(): FamiliesContextValue {
  return useContext(FamiliesContext);
}

export function defaultFamilyBadge(): FamilyUi {
  return { name: 'Platform', tagline: '', color: '#64748B', bg: '#64748B14', summary: '', longDesc: '', keyAssets: [], useCases: [], dependsOn: [], enables: [], solutions: [], asset_count: 0 };
}
