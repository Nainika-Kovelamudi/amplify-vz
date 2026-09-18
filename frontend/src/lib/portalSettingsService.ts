import { apiClient } from './apiClient';

export interface PortalFamilyContent {
  id: string; name: string; tagline: string; description: string; summary: string; long_description: string;
  key_assets: string[];
  color: string; department: string; use_cases: string[]; depends_on: string[]; enables: string[];
}

export interface PortalContent {
  aiv_portal_name: string;
  aiv_portal_description: string;
  aiv_portal_url: string;
  banners: Record<string, { title: string; subtitle: string }>;
  families: PortalFamilyContent[];
  family_order?: string[];
}

export async function getPortalSettings(): Promise<PortalContent> {
  return (await apiClient.get<PortalContent>('/portal-settings')).data;
}

export async function updatePortalSettings(payload: PortalContent): Promise<PortalContent> {
  return (await apiClient.put<PortalContent>('/portal-settings', payload)).data;
}
