import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ArchevalTool } from '../features/archeval/ArchevalTool';
import { Button } from '../components/ui/Button';
import { getCatalogAsset, type CatalogAsset } from '../lib/catalog';
import { catalogAssetPath } from '../lib/catalogSlug';
import { resolveInternalDemoSlug } from '../lib/launchDemo';

export function AssetDemo() {
  const { slug: routeSlug } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<CatalogAsset | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!routeSlug) return;

    const assetId = routeSlug;
    let cancelled = false;

    async function hydrate() {
      const currentAsset = await getCatalogAsset(assetId);
      if (!cancelled) {
        setAsset(currentAsset);
        setIsLoading(false);
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [routeSlug]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="text-sm font-medium text-gray-500">Loading demo...</div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h2 className="text-xl font-bold text-gray-900">Asset not found</h2>
        <Button className="mt-4" onClick={() => navigate('/catalog')}>
          Back to Catalog
        </Button>
      </div>
    );
  }

  const slug = resolveInternalDemoSlug(asset);

  if (!slug) {
    const externalUrl = asset.launchDemoUrl ?? asset.demoUrl;
    if (externalUrl) {
      window.location.replace(externalUrl);
      return (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="text-sm font-medium text-gray-500">Opening external demo...</div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h2 className="text-xl font-bold text-gray-900">No embedded demo available</h2>
        <Button className="mt-4" onClick={() => navigate(catalogAssetPath(asset))}>
          Back to Asset
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="border-b border-slate-200 bg-white px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate(catalogAssetPath(asset))}
            className="inline-flex items-center gap-2 text-sm font-semibold text-sky-600 transition-colors hover:text-sky-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {asset.name}
          </button>
          <span className="font-mono text-xs font-semibold text-slate-500">
            {asset.displayId ?? asset.id}
          </span>
        </div>
      </div>

      {slug === 'archeval' && <ArchevalTool />}
    </div>
  );
}
