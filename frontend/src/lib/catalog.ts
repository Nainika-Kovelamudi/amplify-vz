import { REGISTRY_ASSETS } from '../data/registryAssets';
import { assignCatalogSlugs } from './catalogSlug';
import { resolveWatchDemoUrl } from './demoMediaUrl';
import { supabase } from './supabase';
import { lookupSubmissionRow, rowToSubmission, type PipelineSubmission, type SubmissionRow } from './pipeline';

type AssetRow = {
  id: string;
  name: string;
  family_id: string;
  category: string;
  solution: string;
  description: string;
  about: string;
  owner: string;
  owner_initials: string;
  maturity: string;
  effort: string;
  clouds: string[] | null;
  tags: string[] | null;
  demo_url: string | null;
  repo_url: string | null;
  video_url: string | null;
  users_count: number | null;
  deployments_count: number | null;
  pipelines_count: number | null;
  score: number | null;
  architecture: string[] | null;
  quick_start: string[] | null;
  prerequisites: string[] | null;
  dependencies: string[] | null;
  updated_at?: string;
};

export type CatalogFamily = 'forge' | 'atlas' | 'sentinel' | 'titan';
export type CatalogCloud = 'aws' | 'gcp' | 'azure';
export type CatalogMaturity = 'Experimental' | 'Battle-Tested' | 'Production';
export type CatalogEffort = 'low' | 'medium' | 'high';

export type CatalogAsset = {
  id: string;
  slug: string;
  name: string;
  family: CatalogFamily;
  category: string;
  clouds: CatalogCloud[];
  maturity: CatalogMaturity;
  effort: CatalogEffort;
  demoReady: boolean;
  solution: string;
  owner: string;
  ownerInit: string;
  desc: string;
  longDesc: string;
  architecture: string[];
  archColors: string[];
  quickStart: string;
  prerequisites: { name: string; done: boolean }[];
  dependencies: string[];
  stats: { deployments: number; demos: number; projects: number; satisfaction: number };
  changelog: { ver: string; date: string; desc: string }[];
  tags: string[];
  displayId?: string;
  launchDemoUrl?: string;
  demoUrl?: string;
  repoUrl?: string;
  videoUrl?: string;
  architectureFileUrl?: string | null;
  sourceSubmissionId?: string;
};

const ARCH_COLORS = ['blue', 'purple', 'orange', 'green'] as const;

const CATALOG_CODE_RE = /\bCatalog id\s+([A-Z]{2,4}-\d{3})\b/i;

/** Matches `scripts/gen-supabase-from-aimplify-xlsx.mjs` — card copy + full About in one DB column. */
const CARD_LONG_SPLIT = '\n---AIMPLIFY---\n';

function splitCardAndLongDescription(raw: string): { card: string; long: string } {
  const text = raw?.trim() || '';
  const idx = text.indexOf(CARD_LONG_SPLIT);
  if (idx === -1) {
    return { card: text, long: text };
  }
  const card = text.slice(0, idx).trim();
  const long = text.slice(idx + CARD_LONG_SPLIT.length).trim() || card;
  return { card, long };
}

function extractJsonPrefixedLine<T>(govNotes: string | undefined, prefix: string): T | null {
  if (!govNotes?.trim()) return null;
  const line = govNotes.split('\n').find((l) => l.startsWith(prefix));
  if (!line) return null;
  const jsonPart = line.slice(prefix.length).trim();
  try {
    return JSON.parse(jsonPart) as T;
  } catch {
    return null;
  }
}

function extractEffortFromGovNotes(govNotes: string | undefined): CatalogEffort | null {
  const line = govNotes?.split('\n').find((l) => /^AIMPLIFY_EFFORT:/i.test(l));
  if (!line) return null;
  const v = line.replace(/^AIMPLIFY_EFFORT:\s*/i, '').trim().toLowerCase();
  if (v === 'low' || v === 'medium' || v === 'high') return v;
  return null;
}

function extractDemoReadyFromGovNotes(govNotes: string | undefined): boolean | null {
  const line = govNotes?.split('\n').find((l) => /^AIMPLIFY_DEMO_READY:/i.test(l));
  if (!line) return null;
  const v = line.replace(/^AIMPLIFY_DEMO_READY:\s*/i, '').trim().toLowerCase();
  if (v === 'yes' || v === 'true') return true;
  if (v === 'no' || v === 'false') return false;
  return null;
}

type AimplifyStatsGov = { deployments?: number; demos?: number; projects?: number; satisfaction?: number };

function extractStatsFromGovNotes(govNotes: string | undefined): AimplifyStatsGov | null {
  return extractJsonPrefixedLine<AimplifyStatsGov>(govNotes, 'AIMPLIFY_STATS_JSON:');
}

function extractCatalogCodeFromGovNotes(govNotes: string | undefined): string | undefined {
  if (!govNotes?.trim()) return undefined;
  const m = govNotes.match(CATALOG_CODE_RE);
  return m?.[1];
}

function compareSubmissionDate(a: PipelineSubmission, b: PipelineSubmission) {
  return (b.date || '').localeCompare(a.date || '');
}

/**
 * Public catalog: **`submissions` is the source of truth** (video_url, demo_url, metadata,
 * attachments, gov_notes). Falls back to legacy `assets`, then bundled registry when offline.
 */
export async function loadCatalogAssets(): Promise<CatalogAsset[]> {
  const fromSubmissions = await loadCatalogFromSubmissions();
  if (fromSubmissions.length) return assignCatalogSlugs(fromSubmissions);

  const fromAssets = await loadAssetsFromDbFallback();
  if (fromAssets.length) return assignCatalogSlugs(fromAssets);

  return assignCatalogSlugs(REGISTRY_ASSETS.map(registryToCatalogAsset));
}

/** Resolve a catalog asset by URL slug (e.g. datasmith-synthetic-data-generator) or legacy id (ATL-002). */
export async function getCatalogAsset(routeParam: string): Promise<CatalogAsset | null> {
  const trimmed = routeParam?.trim();
  if (!trimmed) return null;

  const all = await loadCatalogAssets();
  const param = trimmed.toLowerCase();

  const fromList =
    all.find((asset) => asset.slug === param) ??
    all.find(
      (asset) =>
        asset.id.toLowerCase() === param ||
        asset.displayId?.toLowerCase() === param ||
        asset.sourceSubmissionId?.toLowerCase() === param,
    );
  if (fromList) return fromList;

  const direct = await getCatalogAssetDirectLookup(trimmed);
  if (!direct) return null;

  return assignCatalogSlugs([direct])[0];
}

async function getCatalogAssetDirectLookup(id: string): Promise<CatalogAsset | null> {
  const fromSubmission = await getCatalogSubmissionByLookup(id);
  if (fromSubmission) return submissionToAsset(fromSubmission, 0);

  const fromAsset = await getAssetFromDbFallback(id);
  if (fromAsset) return fromAsset;

  const registry = REGISTRY_ASSETS.find((asset) => asset.id.toUpperCase() === id.toUpperCase());
  return registry ? registryToCatalogAsset(registry) : null;
}
async function loadCatalogFromSubmissions(): Promise<CatalogAsset[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (error) {
    console.warn('Unable to load catalog from submissions:', error.message);
    return [];
  }
  if (!data?.length) return [];

  const catalogSubmissions = dedupeCatalogSubmissions(
    (data as SubmissionRow[]).map((row) => rowToSubmission(row)).filter(isCatalogSubmission),
  );

  return catalogSubmissions
    .sort(compareSubmissionDate)
    .map((submission, index) => submissionToAsset(submission, index));
}

async function getCatalogSubmissionByLookup(id: string): Promise<PipelineSubmission | null> {
  const row = await lookupSubmissionRow(id);
  return row ? rowToSubmission(row) : null;
}

function isCatalogSubmission(submission: PipelineSubmission): boolean {
  if (extractCatalogCodeFromGovNotes(submission.govNotes)) return true;
  return submission.status === 'Published';
}

function dedupeCatalogSubmissions(submissions: PipelineSubmission[]): PipelineSubmission[] {
  const byKey = new Map<string, PipelineSubmission>();

  for (const submission of submissions) {
    const catalogId = extractCatalogCodeFromGovNotes(submission.govNotes)?.toUpperCase();
    const key = catalogId ?? submission.id;
    const existing = byKey.get(key);
    if (!existing || compareSubmissionDate(submission, existing) < 0) {
      byKey.set(key, submission);
    }
  }

  return Array.from(byKey.values());
}

/** Legacy fallback when `submissions` is empty or unreadable. */
async function loadAssetsFromDbFallback(): Promise<CatalogAsset[]> {
  if (!supabase) return [];

  const { data, error } = await supabase.from('assets').select('*').order('updated_at', { ascending: false });
  if (error) {
    console.warn('Unable to load assets fallback from Supabase:', error.message);
    return [];
  }

  return (data as AssetRow[]).map((row) => assetRowToCatalogAsset(row));
}

async function getAssetFromDbFallback(id: string): Promise<CatalogAsset | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.from('assets').select('*').ilike('id', id).maybeSingle();
  if (error || !data) return null;

  return assetRowToCatalogAsset(data as AssetRow);
}

function assetRowToCatalogAsset(row: AssetRow): CatalogAsset {
  const family = normalizeFamily(row.family_id);
  const architecture = jsonbToList(row.architecture, ['Not applicable']);
  const prerequisites = jsonbToList(row.prerequisites, ['See asset documentation']).map((name) => ({
    name,
    done: true,
  }));
  const dependencies = jsonbToList(row.dependencies, ['Not applicable']);
  const clouds = normalizeClouds(row.clouds ?? []);
  const effort = normalizeEffort(row.effort);
  const demoUrl = cleanUrl(row.demo_url);
  const videoUrl = resolveWatchDemoUrl({
    videoUrl: row.video_url,
    demoUrl: row.demo_url,
  });
  const quickStart = Array.isArray(row.quick_start)
    ? row.quick_start.filter(Boolean).join('\n')
    : normalizeText(row.quick_start ?? '');

  return {
    id: row.id,
    slug: '',
    displayId: row.id,
    name: row.name,
    family,
    category: row.category,
    clouds,
    maturity: normalizeMaturity(row.maturity),
    effort,
    demoReady: Boolean(demoUrl || videoUrl),
    solution: row.solution,
    owner: row.owner,
    ownerInit: row.owner_initials,
    desc: row.description?.trim() || row.name,
    longDesc: row.about?.trim() || row.description?.trim() || row.name,
    architecture,
    archColors: architecture.map((_, index) => ARCH_COLORS[index % 4]),
    quickStart,
    prerequisites,
    dependencies,
    stats: {
      deployments: row.deployments_count ?? 0,
      demos: row.pipelines_count ?? 0,
      projects: row.users_count ?? 0,
      satisfaction: row.score ?? 0,
    },
    changelog: [
      {
        ver: 'registry',
        date: row.updated_at?.slice(0, 10) ?? '2026-05-08',
        desc: 'AIMPLIFY catalog registry.',
      },
    ],
    tags: row.tags?.length ? row.tags : [row.category, row.solution].filter(Boolean),
    launchDemoUrl: demoUrl,
    demoUrl,
    repoUrl: cleanUrl(row.repo_url),
    videoUrl,
  };
}

function registryToCatalogAsset(asset: (typeof REGISTRY_ASSETS)[number]): CatalogAsset {
  const demoUrl = 'demoUrl' in asset ? asset.demoUrl : undefined;
  return {
    ...asset,
    slug: '',
    displayId: asset.id,
    launchDemoUrl: demoUrl,
    demoUrl,
    repoUrl: undefined,
    videoUrl: undefined,
    sourceSubmissionId: undefined,
  };
}

function jsonbToList(value: string[] | null | undefined, fallback: string[]) {
  if (!Array.isArray(value) || !value.length) return fallback;
  const items = value.map((item) => String(item).trim()).filter(Boolean);
  if (!items.length) return fallback;
  if (items.length === 1 && ['not applicable', 'none', 'tbd', 'wip'].includes(items[0].toLowerCase())) {
    return fallback;
  }
  return items;
}

function normalizeEffort(value: string | undefined): CatalogEffort {
  const effort = value?.trim().toLowerCase();
  if (effort === 'low' || effort === 'medium' || effort === 'high') return effort;
  return 'medium';
}

function submissionToAsset(submission: PipelineSubmission, index: number): CatalogAsset {
  const clouds = normalizeClouds(submission.clouds);
  const family = normalizeFamily(submission.family);
  const architecture = detailToList(submission.architectures, ['Not applicable']);
  const prerequisites = detailToList(submission.prerequisites, ['Not applicable']).map((name) => ({ name, done: true }));
  const dependencies = detailToList(submission.dependencies, ['Not applicable']);
  const legacyAttachmentUrl = firstAttachmentUrl(submission.attachments);
  const launchDemoUrl = cleanUrl(submission.demoUrl) ?? legacyAttachmentUrl;
  const repoUrl = cleanUrl(submission.repoUrl);
  const videoUrl = resolveWatchDemoUrl({
    videoUrl: submission.videoUrl,
    demoUrl: submission.demoUrl,
    govNotes: submission.govNotes,
    attachments: submission.attachments,
  });
  const { card: descCard, long: descLong } = splitCardAndLongDescription(submission.desc);
  const parsedTags = extractJsonPrefixedLine<string[]>(submission.govNotes, 'AIMPLIFY_TAGS_JSON:');
  const tags = parsedTags?.length
    ? Array.from(new Set(parsedTags.filter(Boolean)))
    : Array.from(
        new Set(
          [submission.category, submission.solution, ...clouds.map((cloud) => cloud.toUpperCase())].filter(Boolean),
        ),
      );

  const catalogId = extractCatalogCodeFromGovNotes(submission.govNotes);
  const displayId = catalogId ?? `${familyPrefix(family)}-${String(index + 1).padStart(3, '0')}`;

  const effortParsed = extractEffortFromGovNotes(submission.govNotes);
  const effort: CatalogEffort = effortParsed ?? 'medium';

  const demoReadyGov = extractDemoReadyFromGovNotes(submission.govNotes);
  const demoReady =
    demoReadyGov !== null ? demoReadyGov : Boolean(launchDemoUrl || videoUrl);

  const parsedStats = extractStatsFromGovNotes(submission.govNotes);
  const stats = parsedStats
    ? {
        deployments: Number(parsedStats.deployments) || 0,
        demos: Number(parsedStats.demos) || 0,
        projects: Number(parsedStats.projects) || 0,
        satisfaction: Number(parsedStats.satisfaction) || submission.aiScore,
      }
    : { deployments: 1, demos: launchDemoUrl || videoUrl ? 1 : 0, projects: 0, satisfaction: submission.aiScore };

  return {
    id: catalogId ?? submission.id,
    slug: '',
    displayId,
    name: submission.name,
    family,
    category: submission.category,
    clouds,
    maturity: normalizeMaturity(submission.maturity),
    effort,
    demoReady,
    solution: submission.solution,
    owner: submission.submitter,
    ownerInit: submission.submitterInit,
    desc: descCard,
    longDesc: descLong || 'Published contribution from the AIMPLIFY review pipeline.',
    architecture,
    archColors: architecture.map((_, i) => ARCH_COLORS[i % 4]),
    quickStart: normalizeText(submission.commands),
    prerequisites,
    dependencies,
    stats,
    changelog: [{ ver: 'v1.0.0', date: submission.date, desc: 'Published from contribution pipeline.' }],
    tags,
    launchDemoUrl,
    repoUrl,
    videoUrl,
    architectureFileUrl: submission.architectureFileUrl ?? null,
    sourceSubmissionId: submission.id,
  };
}

function familyPrefix(family: string) {
  const prefixes: Record<string, string> = {
    atlas: 'ATL',
    forge: 'FRG',
    titan: 'TIT',
    sentinel: 'SEN',
  };
  return prefixes[family] ?? 'AST';
}

function normalizeFamily(value: string): CatalogFamily {
  const family = value.toLowerCase();
  if (family === 'atlas' || family === 'forge' || family === 'titan' || family === 'sentinel') {
    return family;
  }
  return 'titan';
}

function normalizeMaturity(value: string): CatalogMaturity {
  const m = value.toLowerCase().trim();
  if (m === 'beta' || m === 'battle-tested' || m === 'battletested' || m === 'beta phase') return 'Battle-Tested';
  if (m === 'production' || m === 'validated') return 'Production';
  return 'Experimental';
}

function normalizeClouds(values: string[]): CatalogCloud[] {
  const normalized = values
    .map((cloud) => cloud.toLowerCase())
    .map((cloud) => {
      if (cloud.includes('amazon') || cloud === 'aws') return 'aws';
      if (cloud.includes('google') || cloud === 'gcp') return 'gcp';
      if (cloud.includes('azure')) return 'azure';
      return '';
    })
    .filter(Boolean) as CatalogCloud[];

  return (normalized.length ? Array.from(new Set(normalized)) : ['aws']) as CatalogCloud[];
}

function detailToList(value: string, fallback: string[]) {
  const text = normalizeText(value);
  if (text.toLowerCase() === 'not applicable') return fallback;
  return text
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeText(value: string) {
  return value?.trim() || 'Not applicable';
}

function cleanUrl(value?: string | null) {
  const url = value?.trim();
  if (!url || url.toLowerCase() === 'not applicable') return undefined;
  return url;
}

function firstAttachmentUrl(attachments: PipelineSubmission['attachments']) {
  for (const attachment of attachments) {
    const url = cleanUrl(attachment.url);
    if (url) return url;
  }
  return undefined;
}
