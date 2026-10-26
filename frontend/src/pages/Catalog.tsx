import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useFamilies } from '../context/FamiliesContext';
import { AssetCard } from '../components/catalog/AssetCard';
import { AssetRow } from '../components/catalog/AssetRow';
import { Button } from '../components/ui/Button';
import { Download, LayoutGrid, List, SearchX } from 'lucide-react';
import { cn } from '../utils/cn';
import { getCatalog, type CatalogAsset } from '../lib/catalogService';
import { usePortalSettings } from '../context/PortalSettingsContext';
import { useAuth } from '../context/AuthContext';

const CC: Record<string, string> = { aws: '#FF9900', gcp: '#4285F4', azure: '#0078D4' };
const CL: Record<string, string> = { aws: 'AWS', gcp: 'GCP', azure: 'Azure' };
const ML: Record<string, string> = { Experimental: 'Experimental', 'Battle-Tested': 'Battle-Tested', Production: 'Production' };

export function Catalog() {
  const { banners } = usePortalSettings();
  const { user } = useAuth();
  const canDownload = user?.role === 'Aimplify.Admin' || user?.role === 'Aimplify.Owner';
  const { families } = useFamilies();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [assets, setAssets] = useState<CatalogAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [familyFilter, setFamilyFilter] = useState('all');
  const [cloudFilter, setCloudFilter] = useState('');
  const [maturityFilter, setMaturityFilter] = useState(() => searchParams.get('maturity') || '');
  const [demoReady, setDemoReady] = useState(() => searchParams.get('demo') === 'true');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(false);
    getCatalog({ limit: 500 }).then(({ items }) => {
      if (!cancelled) { setAssets(items); setIsLoading(false); }
    }).catch(() => {
      if (!cancelled) { setLoadError(true); setIsLoading(false); }
    });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const toggleCloud = (cloud: string) => setCloudFilter((current) => current === cloud ? '' : cloud);
  const toggleMaturity = (maturity: string) => setMaturityFilter((current) => current === maturity ? '' : maturity);

  const downloadCatalogCsv = async () => {
    setIsDownloading(true);
    try {
      const firstPage = await getCatalog({ limit: 500 });
      const allAssets = [...firstPage.items];

      for (let skip = allAssets.length; skip < firstPage.total; skip += 500) {
        const page = await getCatalog({ skip, limit: 500 });
        allAssets.push(...page.items);
      }

      const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const formatDemoReference = (value: string) => {
        try {
          const hostname = new URL(value).hostname.toLowerCase();
          return hostname.endsWith('.blob.core.windows.net') ? 'Demo Video' : value;
        } catch {
          return value;
        }
      };
      const documentUrls = (raw: string | null) => {
        const empty = { architecture: '', salesPitch: '', marketing: '', technical: '' };
        if (!raw) return empty;
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          return {
            architecture: String(parsed.overall_architecture ?? ''),
            salesPitch: String(parsed.sales_pitch ?? ''),
            marketing: String(parsed.marketing_collateral ?? ''),
            technical: String(parsed.technical_delivery ?? ''),
          };
        } catch {
          return { ...empty, architecture: raw };
        }
      };
      const rows = [
        [
          'Assets ID', 'Asset_name', 'Family_ID', 'Author', 'Owner_Email',
          'Department', 'Maturity Status', 'Hyperscaler', 'Demo Ready', 'Demo Video or URL',
          'Github Repo URL', 'Tech Stack', 'Architecture Doc', 'Sales Pitch Doc',
          'Marketing Doc', 'Technical Doc', 'Published', 'Updated',
        ],
        ...allAssets.map((asset) => {
          const docs = documentUrls(asset.architecture_file_url);
          const demos = [...new Set([
            ...(asset.video_urls ?? []),
            ...(asset.video_url ? [asset.video_url] : []),
            ...(asset.demo_url ? [asset.demo_url] : []),
          ].filter(Boolean).map(formatDemoReference))].join('; ');
          return [
            asset.catalog_code,
            asset.title,
            asset.family,
            asset.owner_name || '',
            asset.owner_email || '',
            asset.department,
            asset.maturity || '',
            asset.cloud_provider || '',
            asset.demo_ready ? 'Yes' : 'No',
            demos,
            asset.repo_url || '',
            (asset.tech_stack ?? []).join('; '),
            docs.architecture ? 'Yes' : 'No',
            docs.salesPitch ? 'Yes' : 'No',
            docs.marketing ? 'Yes' : 'No',
            docs.technical ? 'Yes' : 'No',
            asset.created_at,
            asset.updated_at,
          ];
        }),
      ];
      const blob = new Blob([`\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`], {
        type: 'text/csv;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `aimplify-catalog-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  };

  const filteredAssets = useMemo(() => assets.filter((a) => {
    if (familyFilter !== 'all' && a.family !== familyFilter) return false;
    if (cloudFilter && !a.cloud_provider?.toLowerCase().includes(cloudFilter)) return false;
    if (maturityFilter && a.maturity !== maturityFilter) return false;
    if (demoReady && !a.demo_ready) return false;
    if (query) {
      const s = query.toLowerCase();
      return a.title.toLowerCase().includes(s) || a.description.toLowerCase().includes(s) || a.catalog_code.toLowerCase().includes(s);
    }
    return true;
  }), [assets, familyFilter, cloudFilter, maturityFilter, demoReady, query]);

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
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{banners.catalog.title}</h1>
          <p className="mt-1 text-sm text-gray-500">{banners.catalog.subtitle} {!isLoading && !loadError && `· ${filteredAssets.length} of ${assets.length} assets`}</p>
        </div>
        <div className="flex items-center gap-3">
          {canDownload && (
            <Button variant="outline" onClick={downloadCatalogCsv} disabled={isLoading || isDownloading}>
              <Download className="mr-2 h-4 w-4" />
              {isDownloading ? 'Generating...' : 'Download'}
            </Button>
          )}
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
          <FilterChip key={c} active={cloudFilter === c} onClick={() => toggleCloud(c)} color={CC[c]} dot>{CL[c]}</FilterChip>
        ))}
        <div className="h-6 w-px bg-gray-200 mx-1" />
        {([
          { label: 'Experimental',  color: '#F59E0B' },
          { label: 'Battle-Tested', color: '#0EA5E9' },
          { label: 'Production',    color: '#10B981' },
        ] as const).map(({ label, color }) => (
          <FilterChip key={label} active={maturityFilter === label} onClick={() => toggleMaturity(label)} color={color}>{label}</FilterChip>
        ))}
        <div className="h-6 w-px bg-gray-200 mx-1" />
        <FilterChip active={demoReady} onClick={() => setDemoReady(!demoReady)} color="#22C55E">Demo Ready</FilterChip>
        {(cloudFilter || maturityFilter || demoReady || familyFilter !== 'all' || query) && (
          <button onClick={() => { setCloudFilter(''); setMaturityFilter(''); setDemoReady(false); setFamilyFilter('all'); setSearchParams({}); }} className="ml-2 text-xs font-medium text-gray-500 hover:text-gray-900 underline underline-offset-2">
            Clear all
          </button>
        )}
      </div>

      <div className="px-4 md:px-10">
        {isLoading ? (
          <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm font-medium text-gray-500 shadow-sm">Loading catalog assets...</div>
        ) : loadError ? (
          <div className="flex min-h-40 items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-10">
            <Button variant="outline" onClick={() => setReloadKey(key => key + 1)}>Retry</Button>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-24 text-center">
            <SearchX className="mb-4 h-12 w-12 text-gray-300" />
            <h3 className="text-lg font-bold text-gray-900">No matching assets found</h3>
            <p className="mt-1 text-sm text-gray-500">Try adjusting your filters or search query.</p>
            <Button variant="outline" className="mt-6" onClick={() => { setCloudFilter(''); setMaturityFilter(''); setDemoReady(false); setFamilyFilter('all'); setSearchParams({}); }}>
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
