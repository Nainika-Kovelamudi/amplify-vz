/** Presentation-only labels for catalog filters and badges (not catalog records). */
export const CL: Record<string, string> = { aws: 'AWS', gcp: 'GCP', azure: 'Azure' };
export const CC: Record<string, string> = { aws: '#F59E0B', gcp: '#0EA5E9', azure: '#06B6D4' };
export const ML: Record<string, string> = {
  Experimental: 'Experimental',
  'Battle-Tested': 'Battle-Tested',
  Production: 'Production',
  // legacy aliases
  experimental: 'Experimental',
  validated: 'Production',
  'battle-tested': 'Battle-Tested',
  Beta: 'Battle-Tested',
  Prototype: 'Experimental',
};
export const MC: Record<string, string> = {
  Experimental: 'text-amber-500',
  'Battle-Tested': 'text-sky-500',
  Production: 'text-emerald-500',
  // legacy aliases
  experimental: 'text-amber-500',
  validated: 'text-emerald-500',
  'battle-tested': 'text-sky-500',
  Beta: 'text-sky-500',
  Prototype: 'text-amber-500',
};
export const EC: Record<string, string> = {
  low: 'text-emerald-500',
  medium: 'text-amber-500',
  high: 'text-rose-500',
};
export const ACM: Record<string, string> = {
  blue: '#0EA5E9',
  purple: '#8B5CF6',
  orange: '#F59E0B',
  green: '#22C55E',
};
