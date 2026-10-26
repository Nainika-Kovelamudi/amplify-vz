/**
 * Reads `AIMPLIFY Tags.xlsx` (Sheet1) and prints SQL to upsert `assets` + `submissions`
 * with the same column mapping as the app (see src/lib/catalog.ts).
 *
 * Usage:
 *   node scripts/gen-supabase-from-aimplify-xlsx.mjs > supabase/migrations/20260512_from_aimplify_xlsx.sql
 *   node scripts/gen-supabase-from-aimplify-xlsx.mjs --manual-approval   # keep Manual Approval instead of Published
 *
 * Card vs long copy: `submissions.description` stores short + long separated by \n---AIMPLIFY---\n
 * Tags + effort: appended to gov_notes (parsed in catalog.ts).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const MANUAL = process.argv.includes('--manual-approval');
const DEFAULT_SHEET = 'Sheet1';

/** Stable submission UUIDs (must match existing Supabase rows for upsert). Parsed from gen-aimplify-seed-sql.mjs */
const KNOWN_SUBMISSION_IDS = Object.fromEntries(
  Array.from(
    readFileSync(join(ROOT, 'scripts/gen-aimplify-seed-sql.mjs'), 'utf8').matchAll(/\{\s*sid:\s*"([^"]+)",\s*aid:\s*"([^"]+)"/g),
    (m) => [m[2], m[1]],
  ),
);

const CARD_LONG_SPLIT = '\n---AIMPLIFY---\n';

function deterministicSubmissionId(catalogId) {
  const digest = createHash('sha256').update(`aimplify:submission:v1:${catalogId}`).digest();
  const b = Buffer.from(digest.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function sqlStr(s) {
  return `'${String(s ?? '').replace(/'/g, "''")}'`;
}

function sqlJsonb(arr) {
  return `'${JSON.stringify(arr)}'::jsonb`;
}

function initialsFromOwner(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0] || '';
    const b = parts[parts.length - 1][0] || '';
    return (a + b).toUpperCase() || 'NA';
  }
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return 'NA';
}

function normalizeFamilyFromSheet(value, catalogId) {
  const v = String(value || '').toLowerCase();
  if (v.includes('atlas')) return 'atlas';
  if (v.includes('forge')) return 'forge';
  if (v.includes('relay')) return 'relay';
  if (v.includes('sentinel')) return 'sentinel';
  if (v.includes('nexus')) return 'nexus';
  const prefix = String(catalogId || '').toUpperCase().slice(0, 3);
  const map = { ATL: 'atlas', FRG: 'forge', RLY: 'relay', SNT: 'sentinel', NXS: 'nexus' };
  return map[prefix] || 'relay';
}

function normalizeMaturity(v) {
  const s = String(v || '').toLowerCase();
  if (s.includes('battle')) return 'battle-tested';
  if (s.includes('valid')) return 'validated';
  if (s.includes('experiment')) return 'experimental';
  return 'experimental';
}

function normalizeEffort(v) {
  const s = String(v || '').toLowerCase();
  if (s.includes('low')) return 'low';
  if (s.includes('high')) return 'high';
  return 'medium';
}

function parseClouds(cell) {
  const s = String(cell || '').toLowerCase().trim();
  if (!s || s.includes('agnostic')) return ['aws', 'gcp', 'azure'];
  const out = [];
  if (s.includes('aws') || s.includes('amazon')) out.push('aws');
  if (s.includes('gcp') || s.includes('google')) out.push('gcp');
  if (s.includes('azure')) out.push('azure');
  return out.length ? [...new Set(out)] : ['aws', 'gcp', 'azure'];
}

function parseTags(cell) {
  return String(cell || '')
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseListish(cell) {
  const s = String(cell || '').trim();
  if (!s || s.toUpperCase() === 'NA' || s.toUpperCase() === 'N/A') return ['Not applicable'];
  return s
    .split(/[,;]|\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseArchitectureSteps(cell) {
  const s = String(cell || '').trim();
  if (!s || s.toUpperCase() === 'TBD' || s.toUpperCase() === 'NA') return ['TBD'];
  return s
    .split(/\s*(?:-->|\u2192|→)\s*/i)
    .map((x) => x.trim())
    .filter(Boolean);
}

function normalizeUrl(cell, { allowHttp = true } = {}) {
  const raw = String(cell || '').trim();
  if (!raw || /^not\s*available/i.test(raw) || /^request\s*for\s*repo/i.test(raw) || raw.toUpperCase() === 'NA' || raw.toUpperCase() === 'N/A') {
    return null;
  }
  if (/^https?:\/\//i.test(raw)) return allowHttp ? raw : raw.startsWith('https://') ? raw : raw.replace(/^http:/, 'https:');
  if (/^www\./i.test(raw)) return `https://${raw}`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(raw)) return `https://${raw}`;
  return null;
}

function excelSerialToDateString(n) {
  if (typeof n === 'number' && Number.isFinite(n) && n > 20000) {
    const d = XLSX.SSF.parse_date_code(n);
    if (d && d.y) {
      const mm = String(d.m).padStart(2, '0');
      const dd = String(d.d).padStart(2, '0');
      return `${d.y}-${mm}-${dd}`;
    }
  }
  const s = String(n || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Date().toISOString().slice(0, 10);
}

function buildGovNotes({ catalogId, tags, effort, videoFile, deployGuideUrl, stats, demoReady }) {
  const lines = [
    `Catalog id ${catalogId}. AIMPLIFY Excel import ${new Date().toISOString().slice(0, 10)}.`,
    `AIMPLIFY_TAGS_JSON:${JSON.stringify(tags)}`,
    `AIMPLIFY_EFFORT:${effort}`,
    `AIMPLIFY_STATS_JSON:${JSON.stringify(stats)}`,
    `AIMPLIFY_DEMO_READY:${demoReady ? 'yes' : 'no'}`,
  ];
  if (videoFile && String(videoFile).trim() && !/^https?:/i.test(String(videoFile))) {
    lines.push(`Video file: ${String(videoFile).trim()}`);
  }
  if (deployGuideUrl) lines.push(`Deploy guide: ${deployGuideUrl}`);
  return lines.join('\n');
}

function readRows() {
  const path = join(ROOT, 'AIMPLIFY Tags.xlsx');
  const wb = XLSX.readFile(path);
  const ws = wb.Sheets[DEFAULT_SHEET];
  if (!ws) throw new Error(`Sheet "${DEFAULT_SHEET}" not found. Available: ${wb.SheetNames.join(', ')}`);
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
}

function rowToRecord(row) {
  const catalogId = String(row[1] || '').trim();
  const name = String(row[0] || row[2] || '').trim();
  if (!/^[A-Z]{2,4}-\d{3}$/i.test(catalogId)) return null;

  const family = normalizeFamilyFromSheet(row[3], catalogId);
  const category = String(row[4] || '').trim() || 'Process Automation';
  const solution = String(row[5] || '').trim() || 'Agent Orchestration';
  const shortDesc = String(row[6] || '').trim();
  const longDesc = String(row[7] || '').trim() || shortDesc;
  const maturity = normalizeMaturity(row[8]);
  const effort = normalizeEffort(row[9]);
  const clouds = parseClouds(row[11]);
  const tags = parseTags(row[12]);
  const quickStart = String(row[13] || '').trim() || 'Not applicable';
  const repoUrl = normalizeUrl(row[14]);
  const demoUrl = normalizeUrl(row[15]);
  const deployGuideUrl = normalizeUrl(row[16]);
  const owner = String(row[17] || '').trim() || 'Unknown';
  const ownerEmail = String(row[31] || '').trim() || null;
  const prerequisites = parseListish(row[22]);
  const dependencies = parseListish(row[23]);
  const arch = parseArchitectureSteps(row[24]);
  const dep = Number(row[26]) || 0;
  const demos = Number(row[27]) || 0;
  const proj = Number(row[28]) || 0;
  const scoreRaw = row[29];
  const score = String(scoreRaw || '').toUpperCase() === 'NA' || scoreRaw === '' ? 0 : Number(scoreRaw) || 0;
  const submittedAt = excelSerialToDateString(row[19] || row[20]);
  const publishedAt = excelSerialToDateString(row[20] || row[19]);
  const videoFile = row[32];

  const combinedDescription = shortDesc + CARD_LONG_SPLIT + (longDesc || shortDesc);
  const archStr = arch.join(' --> ');
  const sid = KNOWN_SUBMISSION_IDS[catalogId.toUpperCase()] || deterministicSubmissionId(catalogId.toUpperCase());
  const demoReadyCell = String(row[10] || '').toLowerCase();
  const demoReadyFlag = demoReadyCell.includes('yes') || demoReadyCell.includes('true');

  const govNotes = buildGovNotes({
    catalogId: catalogId.toUpperCase(),
    tags,
    effort,
    videoFile,
    deployGuideUrl,
    stats: { deployments: dep, demos, projects: proj, satisfaction: score },
    demoReady: demoReadyFlag,
  });

  const attachments =
    deployGuideUrl && deployGuideUrl.length > 0
      ? [{ label: 'Deploy guide', url: deployGuideUrl, type: 'Link' }]
      : [];

  const status = MANUAL ? 'Manual Approval' : 'Published';
  const videoUrl = typeof videoFile === 'string' && /^https?:\/\//i.test(videoFile.trim()) ? videoFile.trim() : null;

  return {
    catalogId: catalogId.toUpperCase(),
    sid,
    name,
    family,
    category,
    solution,
    combinedDescription,
    shortDesc,
    longDesc,
    maturity,
    effort,
    clouds,
    tags,
    quickStart,
    repoUrl,
    demoUrl,
    videoUrl,
    owner,
    ownerEmail,
    ownerInitials: initialsFromOwner(owner),
    prerequisites,
    dependencies,
    arch,
    archStr,
    dep,
    demos,
    proj,
    score,
    submittedAt,
    publishedAt,
    govNotes,
    attachments,
    status,
  };
}

function emit() {
  const matrix = readRows();
  const records = [];
  for (let i = 3; i < matrix.length; i++) {
    const rec = rowToRecord(matrix[i]);
    if (rec) records.push(rec);
  }
  if (!records.length) throw new Error('No data rows found (expected Asset Id like ATL-001 from row 4 onward).');

  let out = `-- Generated from AIMPLIFY Tags.xlsx (${DEFAULT_SHEET}) — ${new Date().toISOString()}
-- Idempotent upserts: updates existing rows by assets.id / submissions.id.
-- Submission description = card summary + '${CARD_LONG_SPLIT.replace(/\n/g, '\\n')}' + long "About" (see src/lib/catalog.ts).
-- Status: ${MANUAL ? 'Manual Approval' : 'Published'} (catalog UI lists Published only).

`;

  for (const o of records) {
    const preqJoin = o.prerequisites.join('\n');
    const depJoin = o.dependencies.join('\n');

    out += `insert into assets (id, name, family_id, category, solution, description, about, owner, owner_initials, maturity, effort, clouds, tags, demo_url, video_url, repo_url, users_count, deployments_count, pipelines_count, score, architecture, quick_start, prerequisites, dependencies, updated_at)
values (${sqlStr(o.catalogId)}, ${sqlStr(o.name)}, ${sqlStr(o.family)}, ${sqlStr(o.category)}, ${sqlStr(o.solution)}, ${sqlStr(o.shortDesc)}, ${sqlStr(o.longDesc)}, ${sqlStr(o.owner)}, ${sqlStr(o.ownerInitials)}, ${sqlStr(o.maturity)}, ${sqlStr(o.effort)}, ${sqlJsonb(o.clouds)}, ${sqlJsonb(o.tags)}, ${o.demoUrl ? sqlStr(o.demoUrl) : 'null'}, ${o.videoUrl ? sqlStr(o.videoUrl) : 'null'}, ${o.repoUrl ? sqlStr(o.repoUrl) : 'null'}, ${o.proj}, ${o.dep}, ${o.demos}, ${o.score}, ${sqlJsonb(o.arch)}, ${sqlJsonb([o.quickStart])}, ${sqlJsonb(o.prerequisites)}, ${sqlJsonb(o.dependencies)}, now())
on conflict (id) do update set
  name = excluded.name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  description = excluded.description, about = excluded.about, owner = excluded.owner, owner_initials = excluded.owner_initials,
  maturity = excluded.maturity, effort = excluded.effort, clouds = excluded.clouds, tags = excluded.tags,
  demo_url = excluded.demo_url, video_url = excluded.video_url, repo_url = excluded.repo_url, users_count = excluded.users_count,
  deployments_count = excluded.deployments_count, pipelines_count = excluded.pipelines_count, score = excluded.score,
  architecture = excluded.architecture, quick_start = excluded.quick_start, prerequisites = excluded.prerequisites,
  dependencies = excluded.dependencies, updated_at = now();

`;

    out += `insert into submissions (id, asset_name, family_id, category, solution, author, author_initials, status, score, description, owner_email, repo_url, demo_url, video_url, clouds, maturity, dependencies, prerequisites, commands, architecture, architectures, attachments, submitted_at, gov_notes, approved_at, published_at)
values (${sqlStr(o.sid)}, ${sqlStr(o.name)}, ${sqlStr(o.family)}, ${sqlStr(o.category)}, ${sqlStr(o.solution)}, ${sqlStr(o.owner)}, ${sqlStr(o.ownerInitials)}, ${sqlStr(o.status)}, ${o.score}, ${sqlStr(o.combinedDescription)}, ${o.ownerEmail ? sqlStr(o.ownerEmail) : 'null'}, ${o.repoUrl ? sqlStr(o.repoUrl) : 'null'}, ${o.demoUrl ? sqlStr(o.demoUrl) : 'null'}, ${o.videoUrl ? sqlStr(o.videoUrl) : 'null'}, ${sqlJsonb(o.clouds)}, ${sqlStr(o.maturity)}, ${sqlStr(depJoin)}, ${sqlStr(preqJoin)}, ${sqlStr(o.quickStart)}, ${sqlStr(o.archStr)}, ${sqlStr(o.archStr)}, ${sqlJsonb(o.attachments)}, ${sqlStr(o.submittedAt)}, ${sqlStr(o.govNotes)}, ${MANUAL ? 'null' : sqlStr(o.publishedAt)}, ${MANUAL ? 'null' : sqlStr(o.publishedAt)})
on conflict (id) do update set
  asset_name = excluded.asset_name, family_id = excluded.family_id, category = excluded.category, solution = excluded.solution,
  author = excluded.author, author_initials = excluded.author_initials, status = excluded.status, score = excluded.score, description = excluded.description,
  owner_email = excluded.owner_email, repo_url = excluded.repo_url, demo_url = excluded.demo_url, video_url = excluded.video_url,
  clouds = excluded.clouds, maturity = excluded.maturity, dependencies = excluded.dependencies, prerequisites = excluded.prerequisites,
  commands = excluded.commands, architecture = excluded.architecture, architectures = excluded.architectures, attachments = excluded.attachments,
  gov_notes = excluded.gov_notes, approved_at = excluded.approved_at, published_at = excluded.published_at;

`;
  }

  out += `
-- Verification: compare sheet ids to DB
-- select id, name, family_id, left(description, 80) from submissions where gov_notes ilike '%AIMPLIFY Excel import%' order by asset_name;
`;

  return out;
}

process.stdout.write(emit());
