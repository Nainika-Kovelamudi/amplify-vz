import { apiClient } from './apiClient';

export interface SubmissionComment {
  id: string;
  submission_id: string;
  author_id: string;
  author_name: string | null;
  author_email: string | null;
  body: string;
  channel: CommentChannel;
  created_at: string;
}

export type CommentChannel = 'submitter' | 'internal';

export async function getComments(submissionId: string, channel: CommentChannel = 'submitter'): Promise<SubmissionComment[]> {
  const { data } = await apiClient.get<SubmissionComment[]>(`/submissions/${submissionId}/comments`, { params: { channel } });
  return data;
}

export async function addComment(submissionId: string, body: string, channel: CommentChannel = 'submitter'): Promise<SubmissionComment> {
  const { data } = await apiClient.post<SubmissionComment>(`/submissions/${submissionId}/comments`, { body, channel });
  return data;
}
