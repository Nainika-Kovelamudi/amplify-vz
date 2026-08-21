import type { CatalogAsset } from './catalog';
import { catalogDemoPath } from './catalogSlug';

/** Catalog asset that embeds ArchEval inside AIMPLIFY (not external redirect). */
export const EMBEDDED_DEMO_CATALOG_ID = 'NXS-001';

export type InternalDemoSlug = 'archeval';

export function isEmbeddedDemoAsset(
  asset: Pick<CatalogAsset, 'displayId' | 'id'>,
): boolean {
  const catalogId = asset.displayId ?? asset.id;
  return catalogId === EMBEDDED_DEMO_CATALOG_ID;
}

export function resolveInternalDemoSlug(
  asset: Pick<CatalogAsset, 'displayId' | 'id'>,
): InternalDemoSlug | null {
  return isEmbeddedDemoAsset(asset) ? 'archeval' : null;
}

export type LaunchDemoTarget =
  | { mode: 'internal'; path: string; slug: InternalDemoSlug }
  | { mode: 'external'; url: string }
  | { mode: 'unavailable' };

export function resolveLaunchDemo(asset: CatalogAsset): LaunchDemoTarget {
  const slug = resolveInternalDemoSlug(asset);
  if (slug) {
    return { mode: 'internal', path: catalogDemoPath(asset), slug };
  }

  const url = asset.launchDemoUrl ?? asset.demoUrl;
  if (url) return { mode: 'external', url };

  return { mode: 'unavailable' };
}
