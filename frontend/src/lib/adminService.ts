import { authStore } from '../store/authStore';
import { apiClient } from './apiClient';
import type { Submission, SubmissionListResponse } from './submissionService';

export interface AdminStats {
  pending_approvals: number;
  awaiting_publish: number;
  published_assets: number;
  pending_clones: number;
  pending_demos: number;
  total_users: number;
}

export interface ActivityEvent {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface ExecutiveSummary {
  total_assets: number;
  published_assets: number;
  awaiting_review: number;
  l1_waiting_approval: number;
  l2_waiting_approval: number;
  new_submissions: number;
  ai_passed: number;
  ai_needs_changes: number;
  ai_failures: number;
  approved: number;
  published: number;
  rejected: number;
  pending_approvals: number;
  awaiting_publish: number;
  on_hold: number;
  average_ai_score: number;
  ai_pass_rate: number;
  approval_rate: number;
  publication_rate: number;
  average_review_hours: number;
  oldest_pending_hours: number;
}

export interface ReportTrendPoint {
  date: string;
  submitted: number;
  approved: number;
  published: number;
  needs_changes: number;
}

export interface ReportBreakdown {
  name: string;
  submitted: number;
  approved: number;
  published: number;
  average_ai_score: number;
}

export interface ExecutiveReport {
  generated_at: string;
  period_start: string;
  period_end: string;
  days: number;
  summary: ExecutiveSummary;
  status_funnel: Record<string, number>;
  daily_trend: ReportTrendPoint[];
  departments: ReportBreakdown[];
  families: ReportBreakdown[];
  engagement: {
    catalog_views: number;
    artifact_downloads: number;
    demo_views: number;
    clone_requests: number;
    demo_requests: number;
    active_users: number;
  };
  family_assets: Array<{ name: string; asset_count: number; percentage: number }>;
  top_events: Array<{ key: string; label: string; count: number }>;
  trending_assets: Array<{
    id: string; slug: string; title: string; family: string; views: number;
    downloads: number; clone_requests: number; demo_requests: number; engagement_score: number;
  }>;
  active_users: Array<{
    user_id: string; name: string; email: string; events: number; last_active: string;
  }>;
}

export interface AppUser {
  id: string;
  email: string;
  display_name: string | null;
  role: 'Aimplify.User' | 'Aimplify.Admin' | 'Aimplify.Owner';
  role_locked: boolean;
  department: string | null;
  last_login: string | null;
  created_at: string;
}

export interface UserListResponse {
  items: AppUser[];
  total: number;
}

export interface AuditLog {
  id: string;
  actor_email: string | null;
  actor_display_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditListResponse {
  items: AuditLog[];
  total: number;
  page: number;
  page_size: number;
}

// ── Approvals ────────────────────────────────────────────────────────────────

export async function getPendingApprovals(params?: { department?: string; skip?: number; limit?: number }): Promise<SubmissionListResponse> {
  const { data } = await apiClient.get<SubmissionListResponse>('/admin/approvals', { params });
  return data;
}

export async function getMyReviewQueue(params?: { skip?: number; limit?: number }): Promise<SubmissionListResponse> {
  const { data } = await apiClient.get<SubmissionListResponse>('/admin/my-review-queue', { params });
  return data;
}

export async function assignSubmissionReview(id: string, email: string): Promise<Submission> {
  const { data } = await apiClient.patch<Submission>(`/admin/approvals/${id}/assign`, { email });
  return data;
}

export async function approveSubmission(id: string, notes?: string): Promise<Submission> {
  const { data } = await apiClient.patch<Submission>(`/admin/approvals/${id}/approve`, notes ? { notes } : {}, { timeout: 90_000 });
  return data;
}

export async function rejectSubmission(id: string, notes: string): Promise<Submission> {
  const { data } = await apiClient.patch<Submission>(`/admin/approvals/${id}/reject`, { notes }, { timeout: 90_000 });
  return data;
}

export async function finalRejectSubmission(id: string, notes: string): Promise<Submission> {
  const { data } = await apiClient.patch<Submission>(`/admin/approvals/${id}/final-reject`, { notes }, { timeout: 90_000 });
  return data;
}

export async function holdSubmission(id: string, notes?: string): Promise<Submission> {
  const { data } = await apiClient.patch<Submission>(`/admin/approvals/${id}/hold`, notes ? { notes } : {}, { timeout: 90_000 });
  return data;
}

export async function getPublishQueue(params?: { skip?: number; limit?: number }): Promise<SubmissionListResponse> {
  const { data } = await apiClient.get<SubmissionListResponse>('/admin/publish-queue', { params });
  return data;
}

// ── Stats ────────────────────────────────────────────────────────────────────

export async function getAdminStats(): Promise<AdminStats> {
  const { data } = await apiClient.get<AdminStats>('/admin/stats');
  return data;
}

export async function getRecentActivity(): Promise<ActivityEvent[]> {
  const { data } = await apiClient.get<ActivityEvent[]>('/admin/activity');
  return data;
}

const executiveReportRequests = new Map<string, Promise<ExecutiveReport>>();

export function getExecutiveReport(days = 30, refresh = false): Promise<ExecutiveReport> {
  const key = `${authStore.getState().user?.id ?? 'guest'}:${days}:${refresh}`;
  const pending = executiveReportRequests.get(key);
  if (pending) return pending;
  const request = apiClient.get<ExecutiveReport>('/admin/executive-report', { params: { days, refresh } })
    .then(({ data }) => data)
    .finally(() => executiveReportRequests.delete(key));
  executiveReportRequests.set(key, request);
  return request;
}

export type ExecutiveReportFormat = 'docx' | 'xlsx' | 'pdf';

export async function downloadExecutiveReport(days = 30, format: ExecutiveReportFormat = 'docx'): Promise<void> {
  const response = await apiClient.get<Blob>('/admin/executive-report/download', {
    params: { days, format }, responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `AIMPLIFY_Executive_Report_${new Date().toISOString().slice(0, 10)}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadObservabilityReport(format: ExecutiveReportFormat = 'xlsx'): Promise<void> {
  const response = await apiClient.get<Blob>('/admin/observability-report/download', {
    params: { format }, responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `AIMPLIFY_Observability_Report_${new Date().toISOString().slice(0, 10)}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function sendExecutiveReportTestEmail(days = 30, format: ExecutiveReportFormat = 'docx'): Promise<{ status: string; recipient: string; format: string }> {
  const { data } = await apiClient.post<{ status: string; recipient: string; format: string }>('/admin/executive-report/test-email', null, { params: { days, format } });
  return data;
}

// ── Users ────────────────────────────────────────────────────────────────────

export async function getUsers(params?: { role?: string; department?: string; search?: string; skip?: number; limit?: number }): Promise<UserListResponse> {
  const { data } = await apiClient.get<UserListResponse>('/admin/users', { params });
  return data;
}

export async function updateUserRole(userId: string, role: AppUser['role'], department?: string, role_locked = true): Promise<AppUser> {
  const { data } = await apiClient.patch<AppUser>(`/admin/users/${userId}/role`, { role, department, role_locked });
  return data;
}

export async function deleteUser(userId: string, replacementOwnerId?: string): Promise<void> {
  await apiClient.delete(`/admin/users/${userId}`, { params: { replacement_owner_id: replacementOwnerId || undefined } });
}

// ── Audit ────────────────────────────────────────────────────────────────────

export async function getAuditLogs(params?: {
  action?: string; entity_type?: string; actor_email?: string;
  date_from?: string; date_to?: string; skip?: number; limit?: number;
}): Promise<AuditListResponse> {
  const { data } = await apiClient.get<AuditListResponse>('/admin/audit', { params });
  return data;
}

export function exportAuditLogsUrl(params?: Record<string, string>): string {
  const base = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000';
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return `${base}/admin/audit/export${qs}`;
}

export async function downloadAuditLogs(params?: {
  action?: string; entity_type?: string; actor_email?: string;
  date_from?: string; date_to?: string;
}): Promise<void> {
  const response = await apiClient.post<Blob>('/admin/audit/export', null, {
    params,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `aimplify-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
