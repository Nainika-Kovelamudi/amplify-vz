import { Layers } from 'lucide-react';

const DEFAULT_COLORS: Record<string, string> = { forge: '#F05A0A', atlas: '#147FE6', sentinel: '#07885C', titan: '#5B35CC' };

export function FamilyIcon({ family, color, className = 'h-6 w-6' }: { family: string; color?: string; className?: string }) {
  const key = family.toLowerCase();
  const common = { viewBox: '0 0 96 96', fill: 'none', stroke: 'currentColor', strokeWidth: 4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className, style: { color: color ?? DEFAULT_COLORS[key] } };
  if (key === 'forge') return <svg {...common} aria-hidden="true"><circle cx="48" cy="48" r="43"/><path d="M52 18 39 34l7 6 13-16-7-6Z"/><path d="m48 37 23 20c3 3 3 7 1 9-2 3-6 3-9 1L43 42"/><path d="M19 59h48l-9 8c-4 3-6 6-6 11H34c0-5-2-8-6-11l-9-8Z"/><path d="m29 42-5-4m14 2-1-7m-13 17-7-1"/></svg>;
  if (key === 'atlas') return <svg {...common} aria-hidden="true"><circle cx="48" cy="48" r="43"/><ellipse cx="48" cy="27" rx="14" ry="6"/><path d="M34 27v18c0 4 6 7 14 7s14-3 14-7V27M34 36c0 4 6 7 14 7s14-3 14-7"/><path d="m28 56 20 10 20-10-8-5m-24 0-8 5v10l20 10 20-10V56"/><path d="M19 46a31 31 0 0 0 4 25m54-25a31 31 0 0 1-4 25"/><circle cx="21" cy="43" r="3"/><circle cx="75" cy="43" r="3"/></svg>;
  if (key === 'sentinel') return <svg {...common} aria-hidden="true"><circle cx="48" cy="48" r="43"/><path d="M48 20c8 6 15 9 23 12v17c0 15-9 24-23 30-14-6-23-15-23-30V32c8-3 15-6 23-12Z"/><rect x="38" y="46" width="20" height="18" rx="3"/><path d="M42 46v-6a6 6 0 0 1 12 0v6M14 42h9m-9 12h9m50-12h9m-9 12h9"/><circle cx="12" cy="42" r="2"/><circle cx="12" cy="54" r="2"/><circle cx="84" cy="42" r="2"/><circle cx="84" cy="54" r="2"/></svg>;
  if (key === 'titan') return <svg {...common} aria-hidden="true"><circle cx="48" cy="48" r="43"/><path d="M39 70V58c-8-5-12-13-12-23 0-12 9-21 21-21 10 0 18 7 20 16l5 10-7 4v9c0 5-4 8-9 8h-6v9"/><circle cx="47" cy="35" r="9"/><path d="M47 22v5m0 16v5m-13-13h5m16 0h5m-22-9 4 4m10 10 4 4m0-18-4 4m-10 10-4 4"/><path d="M71 25h10v10M70 48h12M71 67h10V57"/><path d="m78 31 5-5m-1 22h5m-9 13 5 5"/></svg>;
  return <Layers className={className} style={{ color }} />;
}
