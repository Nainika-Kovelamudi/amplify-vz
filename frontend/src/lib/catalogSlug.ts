import type { CatalogAsset } from './catalogService';

export function slugifyAssetName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function assignCatalogSlugs(assets: CatalogAsset[]): CatalogAsset[] {
  // New API assets already have a slug field — return as-is
  return assets;
}

export function catalogAssetPath(asset: Pick<CatalogAsset, 'slug'>): string {
  return `/catalog/${asset.slug}`;
}

export function catalogDemoPath(asset: Pick<CatalogAsset, 'slug'>): string {
  return `/catalog/${asset.slug}/demo`;
}
