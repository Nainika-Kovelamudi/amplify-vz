import { apiClient } from './apiClient';

export interface SubmissionComment {
  id: string;
  submission_id: string;
  author_id: string;
  author_name: string;
  author_email: string;
  body: string;
  created_at: string;
}

export async function getComments(submissionId: string): Promise<SubmissionComment[]> {
  const { data } = await apiClient.get<SubmissionComment[]>(`/submissions/${submissionId}/comments`);
  return data;
}

export async function addComment(submissionId: string, body: string): Promise<SubmissionComment> {
  const { data } = await apiClient.post<SubmissionComment>(`/submissions/${submissionId}/comments`, { body });
  return data;
}
