import { MAX_POSSIBLE_SCORE, ModelChoice } from '../types';
import type { Submission } from '../types';
import {
  archevalSupabase,
  archevalTableNames,
  defaultLegacyArchevalTable,
} from './archevalSupabase';

function isAssessmentRow(row: Record<string, unknown>): boolean {
  const rawData = row.data;
  if (rawData == null) return false;

  let parsed: unknown = rawData;
  if (typeof rawData === 'string') {
    try {
      parsed = JSON.parse(rawData);
    } catch {
      return false;
    }
  }

  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    'projectName' in parsed &&
    'userName' in parsed
  );
}

function mapRowToSubmission(row: Record<string, unknown>): Submission | null {
  if (!isAssessmentRow(row)) return null;

  const rawExplanation = row.ai_explanation ?? row.aiExplanation ?? '';
  const rawData = row.data;
  let data: Submission['data'];
  if (typeof rawData === 'string') {
    try {
      data = JSON.parse(rawData) as Submission['data'];
    } catch {
      return null;
    }
  } else {
    data = rawData as Submission['data'];
  }

  const decisionRaw = String(row.decision ?? '');
  const decision =
    decisionRaw === ModelChoice.SLM || decisionRaw === ModelChoice.LLM
      ? decisionRaw
      : decisionRaw.toUpperCase().includes('SLM')
        ? ModelChoice.SLM
        : ModelChoice.LLM;

  return {
    id: String(row.id),
    user: String(row.user_name ?? row.user ?? data.userName ?? 'Unknown user'),
    timestamp: new Date(String(row.created_at ?? row.timestamp ?? Date.now())),
    data,
    score: Number(row.score) || 0,
    maxScore: Number(row.max_score ?? row.maxScore) || MAX_POSSIBLE_SCORE,
    decision,
    aiExplanation:
      typeof rawExplanation === 'string' ? rawExplanation : String(rawExplanation),
    hardBlocker: row.hard_blocker
      ? String(row.hard_blocker)
      : row.hardBlocker
        ? String(row.hardBlocker)
        : undefined,
  };
}

async function fetchFromTable(table: string): Promise<Submission[]> {
  if (!archevalSupabase) return [];

  const { data, error } = await archevalSupabase
    .from(table)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`Archeval Supabase fetch error (${table}):`, error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => mapRowToSubmission(row as Record<string, unknown>))
    .filter((row): row is Submission => row !== null);
}

export const fetchSubmissions = async (): Promise<Submission[]> => {
  if (!archevalSupabase) {
    console.warn('Archeval Supabase not configured.');
    return [];
  }

  const tables = archevalTableNames();
  const legacyConfigured = Boolean(import.meta.env.VITE_ARCHEVAL_LEGACY_TABLE?.trim());
  const tablesToTry = legacyConfigured
    ? tables
    : [...tables, defaultLegacyArchevalTable].filter(
        (table, index, all) => all.indexOf(table) === index,
      );

  for (const table of tablesToTry) {
    const rows = await fetchFromTable(table);
    if (rows.length > 0) return rows;
  }

  return [];
};

export const saveSubmission = async (submission: Submission): Promise<boolean> => {
  if (!archevalSupabase) return false;

  const table = import.meta.env.VITE_ARCHEVAL_TABLE?.trim() || 'archeval_submissions';
  const { error } = await archevalSupabase.from(table).insert([
    {
      id: submission.id,
      user_name: submission.user,
      created_at: submission.timestamp.toISOString(),
      data: submission.data,
      score: submission.score,
      max_score: submission.maxScore,
      decision: submission.decision,
      ai_explanation: submission.aiExplanation,
      hard_blocker: submission.hardBlocker ?? null,
    },
  ]);

  if (error) {
    console.error(`Archeval Supabase save error (${table}):`, error.message);
    return false;
  }
  return true;
};
