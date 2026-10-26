import { apiClient } from './apiClient';

export interface PortalFamilyContent {
  id: string; name: string; tagline: string; description: string; summary: string; long_description: string;
  key_assets: string[];
  color: string; department: string; use_cases: string[]; depends_on: string[]; enables: string[];
}

export interface WhyPillar {
  num: string; icon: string; color: string; title: string; body: string;
  bullets: string[]; footer: string;
}

export interface WhyBenefit {
  icon_key: string; title: string; body: string;
}

export interface WhyContent {
  executive_summary: string;
  pillars_heading: string;
  pillars_subheading: string;
  pillars: WhyPillar[];
  chips: string[];
  outcomes_heading: string;
  outcomes_body: string;
  benefits_heading: string;
  benefits: WhyBenefit[];
  closing: { heading: string; body1: string; body2: string; quote: string };
}

export interface PortalContent {
  aiv_portal_name: string;
  aiv_portal_description: string;
  aiv_portal_url: string;
  banners: Record<string, { title: string; subtitle: string }>;
  families: PortalFamilyContent[];
  family_order?: string[];
  why?: WhyContent | null;
}

export async function getPortalSettings(): Promise<PortalContent> {
  return (await apiClient.get<PortalContent>('/portal-settings')).data;
}

export async function updatePortalSettings(payload: PortalContent): Promise<PortalContent> {
  return (await apiClient.put<PortalContent>('/portal-settings', payload)).data;
}
