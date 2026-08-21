import { apiClient } from './apiClient';
import type { Submission, SubmissionListResponse } from './submissionService';

export interface AdminStats {
  pending_approvals: number;
  awaiting_publish: number;
  published_assets: number;
  pending_clones: number;
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

export async function approveSubmission(id: string, notes?: string): Promise<Submission> {
  const { data } = await apiClient.patch<Submission>(`/admin/approvals/${id}/approve`, notes ? { notes } : {});
  return data;
}

export async function rejectSubmission(id: string, notes: string): Promise<Submission> {
  const { data } = await apiClient.patch<Submission>(`/admin/approvals/${id}/reject`, { notes });
  return data;
}

export async function finalRejectSubmission(id: string, notes: string): Promise<Submission> {
  const { data } = await apiClient.patch<Submission>(`/admin/approvals/${id}/final-reject`, { notes });
  return data;
}

export async function holdSubmission(id: string, notes?: string): Promise<Submission> {
  const { data } = await apiClient.patch<Submission>(`/admin/approvals/${id}/hold`, notes ? { notes } : {});
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

export async function getExecutiveReport(days = 30): Promise<ExecutiveReport> {
  const { data } = await apiClient.get<ExecutiveReport>('/admin/executive-report', { params: { days } });
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

export async function deleteUser(userId: string): Promise<void> {
  await apiClient.delete(`/admin/users/${userId}`);
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
