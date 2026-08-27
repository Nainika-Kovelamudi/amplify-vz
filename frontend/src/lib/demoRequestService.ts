import { apiClient } from './apiClient';

export interface DemoRequest {
  id: string;
  asset_id: string;
  asset_title?: string;
  asset_slug?: string;
  requester_name?: string;
  requester_email?: string;
  customer_name: string;
  project_name: string;
  vertical?: string;
  additional_details?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  decision_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  requested_at: string;
}

export interface DemoRequestCreate {
  asset_id: string;
  customer_name: string;
  project_name: string;
  vertical?: string;
  additional_details?: string;
}

export async function createDemoRequest(payload: DemoRequestCreate): Promise<DemoRequest> {
  const { data } = await apiClient.post<DemoRequest>('/demo-requests', payload);
  return data;
}

export async function getMyDemoRequests(): Promise<DemoRequest[]> {
  const { data } = await apiClient.get<DemoRequest[]>('/demo-requests/my');
  return data;
}

export async function getDemoRequestsForAsset(assetId: string): Promise<DemoRequest[]> {
  const { data } = await apiClient.get<DemoRequest[]>(`/demo-requests/asset/${assetId}`);
  return data;
}

export async function getAllDemoRequests(): Promise<DemoRequest[]> {
  const { data } = await apiClient.get<DemoRequest[]>('/demo-requests');
  return data;
}

export async function approveDemoRequest(id: string, notes?: string): Promise<DemoRequest> {
  const { data } = await apiClient.patch<DemoRequest>(`/demo-requests/${id}/approve`, { notes });
  return data;
}

export async function rejectDemoRequest(id: string, notes?: string): Promise<DemoRequest> {
  const { data } = await apiClient.patch<DemoRequest>(`/demo-requests/${id}/reject`, { notes });
  return data;
}
