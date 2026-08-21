import { apiClient } from './apiClient';

export interface CloneRequest {
  id: string;
  asset_id: string;
  status: 'Pending' | 'Approved' | 'Denied';
  reason: string;
  environment: string;
  purpose?: string | null;
  customer_name?: string | null;
  project_name?: string | null;
  is_internal?: boolean | null;
  created_at: string;
  decided_at: string | null;
  asset_title?: string;
  requester_name?: string;
  requester_email?: string;
  clone_token_uuid?: string | null;
}

export interface CloneTokenResult {
  download_url: string;
  expires_at: string;
  asset_title: string;
}

export async function requestClone(
  assetId: string,
  reason: string,
  environment: string,
  purpose?: string,
  customerName?: string,
  projectName?: string,
): Promise<CloneRequest> {
  const { data } = await apiClient.post<CloneRequest>('/clone-requests', {
    asset_id: assetId,
    reason,
    environment,
    purpose: purpose || null,
    customer_name: customerName || null,
    project_name: projectName || null,
  });
  return data;
}

export async function getMyCloneRequests(): Promise<CloneRequest[]> {
  const { data } = await apiClient.get<CloneRequest[]>('/clone-requests/mine');
  return data;
}

export async function getIncomingCloneRequests(): Promise<CloneRequest[]> {
  const { data } = await apiClient.get<CloneRequest[]>('/clone-requests/incoming');
  return data;
}

export async function approveClone(cloneId: string): Promise<CloneRequest> {
  const { data } = await apiClient.patch<CloneRequest>(`/clone-requests/${cloneId}/approve`);
  return data;
}

export async function denyClone(cloneId: string): Promise<CloneRequest> {
  const { data } = await apiClient.patch<CloneRequest>(`/clone-requests/${cloneId}/deny`);
  return data;
}

export async function getAllCloneRequests(): Promise<CloneRequest[]> {
  const { data } = await apiClient.get<CloneRequest[]>('/clone-requests/all');
  return data;
}

export async function cancelClone(cloneId: string): Promise<CloneRequest> {
  const { data } = await apiClient.patch<CloneRequest>(`/clone-requests/${cloneId}/cancel`);
  return data;
}

export async function resendCloneLink(cloneId: string): Promise<CloneRequest> {
  const { data } = await apiClient.post<CloneRequest>(`/clone-requests/${cloneId}/resend-link`);
  return data;
}

export async function redeemCloneToken(tokenUuid: string): Promise<CloneTokenResult> {
  const { data } = await apiClient.get<CloneTokenResult>(`/clone/token/${tokenUuid}`);
  return data;
}
