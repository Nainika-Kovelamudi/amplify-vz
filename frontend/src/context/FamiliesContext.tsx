import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getPlatformFamilies, type PlatformFamily } from '../lib/catalogService';
import { authStore } from '../store/authStore';

export interface FamilyUi {
  name: string;
  tagline: string;
  color: string;
  bg: string;
  longDesc: string;
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

function toFamilyUi(f: PlatformFamily): FamilyUi {
  return {
    name: f.name,
    tagline: f.tagline ?? f.description ?? '',
    color: f.color,
    bg: `${f.color}14`,
    longDesc: f.long_description ?? f.description ?? '',
    useCases: f.use_cases ?? [],
    dependsOn: f.depends_on ?? [],
    enables: f.enables ?? [],
    solutions: f.solutions ?? [],
    asset_count: f.asset_count ?? 0,
  };
}

// Hardcoded fallback so the dropdown always works even when the API is unreachable
const FALLBACK_FAMILIES: Record<string, FamilyUi> = {
  Atlas:    { name: 'Atlas',    tagline: 'DataOps & Master Data',           color: '#3B82F6', bg: '#3B82F614', longDesc: '', useCases: [], dependsOn: [], enables: [], solutions: [], asset_count: 0 },
  Forge:    { name: 'Forge',    tagline: 'AI SDLC & Prompt Engineering',    color: '#8B5CF6', bg: '#8B5CF614', longDesc: '', useCases: [], dependsOn: [], enables: [], solutions: [], asset_count: 0 },
  Sentinel: { name: 'Sentinel', tagline: 'Security & Compliance',           color: '#EF4444', bg: '#EF444414', longDesc: '', useCases: [], dependsOn: [], enables: [], solutions: [], asset_count: 0 },
  Relay:    { name: 'Relay',    tagline: 'Process Automation & QE',         color: '#F59E0B', bg: '#F59E0B14', longDesc: '', useCases: [], dependsOn: [], enables: [], solutions: [], asset_count: 0 },
  Nexus:    { name: 'Nexus',    tagline: 'Infrastructure & Managed AI Ops', color: '#10B981', bg: '#10B98114', longDesc: '', useCases: [], dependsOn: [], enables: [], solutions: [], asset_count: 0 },
};

export function FamiliesProvider({ children }: { children: ReactNode }) {
  const [families, setFamilies] = useState<Record<string, FamilyUi>>(FALLBACK_FAMILIES);
  const [loading, setLoading] = useState(true);
  // Re-fetch when the user logs in so cold-start misses are recovered
  const isAuthenticated = authStore((s) => !!s.accessToken);

  useEffect(() => {
    let cancelled = false;
    getPlatformFamilies()
      .then((list) => {
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
        // keep FALLBACK_FAMILIES — dropdown still works offline
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const value = useMemo(() => ({ families, loading }), [families, loading]);
  return <FamiliesContext.Provider value={value}>{children}</FamiliesContext.Provider>;
}

export function useFamilies(): FamiliesContextValue {
  return useContext(FamiliesContext);
}

export function defaultFamilyBadge(): FamilyUi {
  return { name: 'Platform', tagline: '', color: '#64748B', bg: '#64748B14', longDesc: '', useCases: [], dependsOn: [], enables: [], solutions: [], asset_count: 0 };
}
