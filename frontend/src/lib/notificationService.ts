import { apiClient } from './apiClient';
import { authStore } from '../store/authStore';

export interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  event_type: string;
  entity_id: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  items: Notification[];
  unread_count: number;
}

export async function getNotifications(params?: { skip?: number; limit?: number; unread_only?: boolean }): Promise<NotificationListResponse> {
  const { data } = await apiClient.get<NotificationListResponse>('/notifications', { params });
  return data;
}

export async function markNotificationsRead(notificationIds?: string[]): Promise<{ updated: number }> {
  const body = notificationIds
    ? { notification_ids: notificationIds, mark_all: false }
    : { mark_all: true };
  const { data } = await apiClient.patch<{ updated: number }>('/notifications/read', body);
  return data;
}

// ── WebSocket ─────────────────────────────────────────────────────────────────

type WsEventHandler = (payload: Record<string, unknown>) => void;

let _socket: WebSocket | null = null;
let _handlers: WsEventHandler[] = [];
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _retryCount = 0;
const MAX_RETRIES = 5;

export function connectNotificationsWS(): void {
  if (_socket?.readyState === WebSocket.OPEN) return;

  const base = (import.meta.env.VITE_API_URL as string || 'http://localhost:8000');
  const wsBase = base.replace(/^http/, 'ws');
  const token = authStore.getState().accessToken;
  const url = `${wsBase}/ws/notifications?token=${token}`;

  _socket = new WebSocket(url);

  _socket.onopen = () => { _retryCount = 0; };

  _socket.onmessage = (evt) => {
    try {
      const payload = JSON.parse(evt.data as string) as Record<string, unknown>;
      _handlers.forEach((h) => h(payload));
    } catch {
      // non-JSON frame — ignore
    }
  };

  _socket.onclose = (evt) => {
    // 1000 = normal close, 1008 = auth rejected — don't retry
    if (evt.code === 1000 || evt.code === 1008) return;
    if (_retryCount >= MAX_RETRIES) return; // give up silently after 5 attempts
    _retryCount++;
    const delay = Math.min(1000 * 2 ** _retryCount, 60_000); // 2s, 4s, 8s … max 60s
    _reconnectTimer = setTimeout(connectNotificationsWS, delay);
  };

  _socket.onerror = () => {
    // onerror always fires before onclose — let onclose handle the retry
  };
}

export function disconnectNotificationsWS(): void {
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
  _socket?.close(1000);
  _socket = null;
}

export function onNotificationEvent(handler: WsEventHandler): () => void {
  _handlers.push(handler);
  return () => { _handlers = _handlers.filter((h) => h !== handler); };
}
