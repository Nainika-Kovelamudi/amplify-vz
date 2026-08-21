import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useFamilies } from '../context/FamiliesContext';
import { AssetCard } from '../components/catalog/AssetCard';
import { AssetRow } from '../components/catalog/AssetRow';
import { Button } from '../components/ui/Button';
import { LayoutGrid, List, SearchX } from 'lucide-react';
import { cn } from '../utils/cn';
import { getCatalog, type CatalogAsset } from '../lib/catalogService';

const CC: Record<string, string> = { aws: '#FF9900', gcp: '#4285F4', azure: '#0078D4' };
const CL: Record<string, string> = { aws: 'AWS', gcp: 'GCP', azure: 'Azure' };
const ML: Record<string, string> = { Experimental: 'Experimental', 'Battle-Tested': 'Battle-Tested', Production: 'Production' };

export function Catalog() {
  const { families } = useFamilies();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [assets, setAssets] = useState<CatalogAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [familyFilter, setFamilyFilter] = useState('all');
  const [cloudFilters, setCloudFilters] = useState<string[]>([]);
  const [maturityFilters, setMaturityFilters] = useState<string[]>(() => {
    const m = searchParams.get('maturity');
    return m ? [m] : [];
  });
  const [demoReady, setDemoReady] = useState(() => searchParams.get('demo') === 'true');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    let cancelled = false;
    getCatalog({ limit: 500 }).then(({ items }) => {
      if (!cancelled) { setAssets(items); setIsLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  const toggleCloud = (c: string) => setCloudFilters((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  const toggleMaturity = (m: string) => setMaturityFilters((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);

  const filteredAssets = useMemo(() => assets.filter((a) => {
    if (familyFilter !== 'all' && a.family !== familyFilter) return false;
    if (cloudFilters.length && !cloudFilters.some((c) => a.cloud_provider?.toLowerCase().includes(c))) return false;
    if (maturityFilters.length && !maturityFilters.includes(a.maturity ?? '')) return false;
    if (demoReady && !a.demo_ready) return false;
    if (query) {
      const s = query.toLowerCase();
      return a.title.toLowerCase().includes(s) || a.description.toLowerCase().includes(s) || a.catalog_code.toLowerCase().includes(s);
    }
    return true;
  }), [assets, familyFilter, cloudFilters, maturityFilters, demoReady, query]);

  const FilterChip = ({ active, onClick, color, dot, children }: { active: boolean; onClick: () => void; color: string; dot?: boolean; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
        active ? "border-transparent shadow-sm" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      )}
      style={active ? { backgroundColor: `${color}18`, color, borderColor: `${color}50` } : {}}
    >
      {dot
        ? <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        : <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: active ? color : `${color}70` }} />
      }
      {children}
    </button>
  );

  return (
    <div className="animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-4 py-8 md:px-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Asset Catalog</h1>
          <p className="mt-1 text-sm text-gray-500">{isLoading ? 'Loading assets...' : `${filteredAssets.length} of ${assets.length} assets`}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg bg-gray-100 p-1">
            <button onClick={() => setViewMode('grid')} className={cn("rounded-md p-1.5 transition-all", viewMode === 'grid' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900")}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode('list')} className={cn("rounded-md p-1.5 transition-all", viewMode === 'list' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900")}>
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 pb-6 md:px-10">
        <FilterChip active={familyFilter === 'all'} onClick={() => setFamilyFilter('all')} color="#6B7280">All</FilterChip>
        {Object.entries(families).map(([k, f]) => (
          <FilterChip key={k} active={familyFilter === k} onClick={() => setFamilyFilter(k)} color={f.color}>{f.name}</FilterChip>
        ))}
        <div className="h-6 w-px bg-gray-200 mx-1" />
        {['aws', 'gcp', 'azure'].map((c) => (
          <FilterChip key={c} active={cloudFilters.includes(c)} onClick={() => toggleCloud(c)} color={CC[c]} dot>{CL[c]}</FilterChip>
        ))}
        <div className="h-6 w-px bg-gray-200 mx-1" />
        {([
          { label: 'Experimental',  color: '#F59E0B' },
          { label: 'Battle-Tested', color: '#0EA5E9' },
          { label: 'Production',    color: '#10B981' },
        ] as const).map(({ label, color }) => (
          <FilterChip key={label} active={maturityFilters.includes(label)} onClick={() => toggleMaturity(label)} color={color}>{label}</FilterChip>
        ))}
        <div className="h-6 w-px bg-gray-200 mx-1" />
        <FilterChip active={demoReady} onClick={() => setDemoReady(!demoReady)} color="#22C55E">Demo Ready</FilterChip>
        {(cloudFilters.length > 0 || maturityFilters.length > 0 || demoReady || familyFilter !== 'all' || query) && (
          <button onClick={() => { setCloudFilters([]); setMaturityFilters([]); setDemoReady(false); setFamilyFilter('all'); setSearchParams({}); }} className="ml-2 text-xs font-medium text-gray-500 hover:text-gray-900 underline underline-offset-2">
            Clear all
          </button>
        )}
      </div>

      <div className="px-4 md:px-10">
        {isLoading ? (
          <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm font-medium text-gray-500 shadow-sm">Loading catalog assets...</div>
        ) : filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-24 text-center">
            <SearchX className="mb-4 h-12 w-12 text-gray-300" />
            <h3 className="text-lg font-bold text-gray-900">No matching assets found</h3>
            <p className="mt-1 text-sm text-gray-500">Try adjusting your filters or search query.</p>
            <Button variant="outline" className="mt-6" onClick={() => { setCloudFilters([]); setMaturityFilters([]); setDemoReady(false); setFamilyFilter('all'); setSearchParams({}); }}>
              Clear filters
            </Button>
          </div>
        ) : (
          <div className={cn("grid gap-4", viewMode === 'grid' ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1")}>
            <AnimatePresence mode="popLayout">
              {filteredAssets.map((asset, i) => (
                viewMode === 'grid'
                  ? <AssetCard key={asset.id} asset={asset} index={i} />
                  : <AssetRow key={asset.id} asset={asset} index={i} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
