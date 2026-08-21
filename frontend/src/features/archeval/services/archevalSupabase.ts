import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url =
  import.meta.env.VITE_ARCHEVAL_SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;

const key =
  import.meta.env.VITE_ARCHEVAL_SUPABASE_KEY ??
  import.meta.env.VITE_ARCHEVAL_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.VITE_SUPABASE_KEY;

export const archevalSupabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null;

export const archevalTableNames = (): string[] => {
  const primary = import.meta.env.VITE_ARCHEVAL_TABLE?.trim() || 'archeval_submissions';
  const legacy = import.meta.env.VITE_ARCHEVAL_LEGACY_TABLE?.trim();
  return legacy && legacy !== primary ? [primary, legacy] : [primary];
};

/** Standalone ArchEval stored assessments in `submissions`; embedded Amplify uses `archeval_submissions`. */
export const defaultLegacyArchevalTable = 'submissions';
