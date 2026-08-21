import { apiClient } from './apiClient';

export interface Submission {
  id: string;
  title: string;
  description: string;
  family: string;
  department: string;
  tech_stack: string[];
  cloud_provider: string | null;
  maturity: string | null;
  demo_ready: boolean;
  repo_url: string | null;
  video_url: string | null;
  video_urls: string[] | null;
  demo_url: string | null;
  status: string;
  ai_score: number | null;
  ai_feedback: Record<string, unknown> | null;
  admin_notes: string | null;
  submitter_id: string;
  created_at: string;
  updated_at: string;
  // Section 1
  owner_name: string | null;
  owner_email: string | null;
  manager_name: string | null;
  manager_email: string | null;
  designation: string | null;
  category: string | null;
  architecture_file_url: string | null;
  collaborators: string[] | null;
  dependencies: string | null;
  commands: string[] | null;
}

export interface SubmissionCreate {
  title: string;
  description: string;
  family: string;
  department: string;
  tech_stack?: string[];
  cloud_provider?: string;
  maturity?: string;
  demo_ready?: boolean;
  video_url?: string;
  video_urls?: string[];
  demo_url?: string;
  repo_url?: string;
}

export interface SubmissionListResponse {
  items: Submission[];
  total: number;
}

export async function getMySubmissions(): Promise<SubmissionListResponse> {
  const { data } = await apiClient.get<SubmissionListResponse>('/submissions/mine');
  return data;
}

export async function getAllSubmissions(params?: { status?: string; skip?: number; limit?: number }): Promise<SubmissionListResponse> {
  const { data } = await apiClient.get<SubmissionListResponse>('/submissions/all', { params });
  return data;
}

export async function getSubmission(id: string): Promise<Submission> {
  const { data } = await apiClient.get<Submission>(`/submissions/${id}`);
  return data;
}

export async function createSubmission(payload: SubmissionCreate): Promise<Submission> {
  const { data } = await apiClient.post<Submission>('/submissions', payload);
  return data;
}

export async function updateSubmission(id: string, payload: Partial<SubmissionCreate>): Promise<Submission> {
  const { data } = await apiClient.patch<Submission>(`/submissions/${id}`, payload);
  return data;
}

export async function deleteSubmission(id: string): Promise<void> {
  await apiClient.delete(`/submissions/${id}`);
}

export async function publishSubmission(id: string): Promise<Submission> {
  const { data } = await apiClient.post<Submission>(`/submissions/${id}/publish`);
  return data;
}

export async function retrySubmissionAIScore(id: string): Promise<Submission> {
  const { data } = await apiClient.post<Submission>(`/submissions/${id}/rescore`);
  return data;
}

export async function getSubmissionForCatalogAsset(catalogAssetId: string): Promise<Submission> {
  const { data } = await apiClient.get<Submission>(`/submissions/for-catalog/${catalogAssetId}`);
  return data;
}
