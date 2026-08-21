import { supabase } from './supabase';

export type ActivityFeedItem = {
  who: string;
  action: string;
  what: string;
  time: string;
  color: string;
};

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Recent rows from `activity_log`; empty if Supabase is unavailable or the table has no rows. */
export async function loadRecentActivity(limit = 8): Promise<ActivityFeedItem[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('activity_log')
    .select('person, action, target, family_id, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data?.length) return [];

  const familyIds = [...new Set(data.map((row) => row.family_id).filter(Boolean))] as string[];
  let colorByFamily: Record<string, string> = {};
  if (familyIds.length) {
    const { data: famColors } = await supabase.from('platform_families').select('id, color').in('id', familyIds);
    colorByFamily = Object.fromEntries((famColors ?? []).map((row) => [row.id, row.color]));
  }

  return data.map((row) => ({
    who: row.person,
    action: row.action,
    what: row.target,
    time: formatRelativeTime(row.created_at),
    color: (row.family_id && colorByFamily[row.family_id]) || '#64748B',
  }));
}
