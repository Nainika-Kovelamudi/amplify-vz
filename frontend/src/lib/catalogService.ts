import { apiClient } from './apiClient';

export interface CatalogAsset {
  id: string;
  catalog_code: string;
  slug: string;
  title: string;
  description: string;
  family: string;
  department: string;
  tech_stack: string[];
  collaborators: string[] | null;
  cloud_provider: string | null;
  maturity: string | null;
  demo_ready: boolean;
  video_url: string | null;
  video_urls: string[] | null;
  demo_url: string | null;
  thumbnail_url: string | null;
  dependencies: string | null;
  commands: string[] | null;
  architecture_file_url: string | null;
  repo_url: string | null;
  category: string | null;
  status: string;
  ai_score: number | null;
  ai_feedback: Record<string, unknown> | null;
  owner_id: string;
  owner_name: string | null;
  owner_email: string | null;
  manager_name: string | null;
  manager_email: string | null;
  designation: string | null;
  clone_request_count: number;
  deployment_count: number;
  like_count: number;
  liked_by_me: boolean;
  artifact_download_count: number;
  demo_view_count: number;
  view_count: number;
  demo_request_count: number;
  created_at: string;
  updated_at: string;
}

export interface PlatformFamily {
  id: string;
  name: string;
  color: string;
  department: string;
  tagline?: string;
  description?: string;
  long_description?: string;
  use_cases?: string[];
  depends_on?: string[];
  enables?: string[];
  solutions?: { name: string; description: string }[];
  asset_count?: number;
}

export interface CatalogListResponse {
  items: CatalogAsset[];
  total: number;
}

export interface CatalogFilters {
  family?: string;
  department?: string;
  maturity?: string;
  cloud_provider?: string;
  demo_ready?: boolean;
  search?: string;
  skip?: number;
  limit?: number;
}

export async function getCatalog(filters: CatalogFilters = {}): Promise<CatalogListResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  const { data } = await apiClient.get<CatalogListResponse>(`/catalog?${params}`, { timeout: 90_000 });
  return data;
}

export async function getCatalogAsset(slug: string): Promise<CatalogAsset> {
  const { data } = await apiClient.get<CatalogAsset>(`/catalog/${slug}`);
  return data;
}

export async function getPlatformFamilies(): Promise<PlatformFamily[]> {
  const { data } = await apiClient.get<PlatformFamily[]>('/catalog/families', { timeout: 90_000 });
  return data;
}

export async function createCatalogAsset(payload: Partial<CatalogAsset>): Promise<CatalogAsset> {
  const { data } = await apiClient.post<CatalogAsset>('/catalog', payload);
  return data;
}

export async function updateCatalogAsset(id: string, payload: Partial<CatalogAsset>): Promise<CatalogAsset> {
  const { data } = await apiClient.patch<CatalogAsset>(`/catalog/${id}`, payload);
  return data;
}

export async function deleteCatalogAsset(id: string): Promise<void> {
  await apiClient.delete(`/catalog/${id}`);
}

export async function toggleAssetLike(assetId: string): Promise<{ like_count: number; liked_by_me: boolean }> {
  const { data } = await apiClient.post(`/catalog/${assetId}/like`);
  return data;
}

export async function trackArtifactDownload(assetId: string): Promise<void> {
  await apiClient.post(`/catalog/${assetId}/track-download`).catch(() => {});
}

export async function trackDemoView(assetId: string): Promise<void> {
  await apiClient.post(`/catalog/${assetId}/track-demo-view`).catch(() => {});
}

export async function trackAssetView(assetId: string): Promise<void> {
  await apiClient.post(`/catalog/${assetId}/track-view`).catch(() => {});
}

export interface AssetFeedback {
  id: string;
  asset_id: string;
  name: string;
  email: string;
  comment: string;
  created_at: string;
}

export async function getAssetFeedback(assetId: string): Promise<AssetFeedback[]> {
  const { data } = await apiClient.get<AssetFeedback[]>(`/catalog/${assetId}/feedback`);
  return data;
}

export async function submitAssetFeedback(
  assetId: string,
  payload: { name: string; email: string; comment: string },
): Promise<AssetFeedback> {
  const { data } = await apiClient.post<AssetFeedback>(`/catalog/${assetId}/feedback`, payload);
  return data;
}
