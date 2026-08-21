import { supabase } from './supabase';

/** UI shape consumed by family pages and catalog badges (formerly hardcoded `FAMILIES`). */
export type FamilyUi = {
  name: string;
  tagline: string;
  color: string;
  /** Light tint for badges / pills (CSS hex + alpha). */
  bg: string;
  longDesc: string;
  useCases: string[];
  dependsOn: string[];
  enables: string[];
  /** Each entry is `Title — description` for signature solution cards. */
  solutions: string[];
};

type FamilyRow = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  color: string;
  when_to_sell: unknown;
  depends_on: unknown;
  enables: unknown;
};

type SolutionRow = {
  family_id: string;
  name: string;
  description: string;
  sort_order: number;
};

function hexWithAlpha(hex: string, alphaHex = '14'): string {
  const h = hex?.trim();
  if (!h.startsWith('#')) return '#64748B14';
  if (h.length === 7) return `${h}${alphaHex}`;
  return h;
}

function parseJsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

/** Loads platform marketing content from `platform_families` + `signature_solutions`. */
export async function loadFamiliesRecord(): Promise<Record<string, FamilyUi>> {
  if (!supabase) return {};

  const [{ data: famRows, error: famErr }, { data: solRows }] = await Promise.all([
    supabase.from('platform_families').select('*').order('id'),
    supabase.from('signature_solutions').select('family_id, name, description, sort_order').order('sort_order'),
  ]);

  if (famErr || !famRows?.length) return {};

  const solutionsByFamily = new Map<string, string[]>();
  for (const row of (solRows ?? []) as SolutionRow[]) {
    const line = row.description?.trim()
      ? `${row.name} — ${row.description}`
      : row.name;
    const list = solutionsByFamily.get(row.family_id) ?? [];
    list.push(line);
    solutionsByFamily.set(row.family_id, list);
  }

  const out: Record<string, FamilyUi> = {};

  for (const row of famRows as FamilyRow[]) {
    const color = row.color || '#64748B';
    out[row.id] = {
      name: row.name,
      tagline: row.tagline,
      color,
      bg: hexWithAlpha(color),
      longDesc: row.description,
      useCases: parseJsonStringArray(row.when_to_sell),
      dependsOn: parseJsonStringArray(row.depends_on),
      enables: parseJsonStringArray(row.enables),
      solutions: solutionsByFamily.get(row.id) ?? [],
    };
  }

  return out;
}
