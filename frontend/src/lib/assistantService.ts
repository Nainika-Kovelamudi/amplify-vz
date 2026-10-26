import { apiClient } from './apiClient';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatSource {
  title: string;
  link: string;
  source_type: string | null;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  is_confident: boolean;
}

export async function getChatbotConfig(): Promise<{ enabled: boolean }> {
  const { data } = await apiClient.get<{ enabled: boolean }>('/assistant/config');
  return data;
}

export async function sendChatMessage(message: string, history: ChatTurn[]): Promise<ChatResponse> {
  const { data } = await apiClient.post<ChatResponse>('/assistant/chat', { message, history: history.slice(-6) }, { timeout: 300_000 });
  return data;
}
