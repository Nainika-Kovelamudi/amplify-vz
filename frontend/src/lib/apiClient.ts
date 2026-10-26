import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { authStore } from '../store/authStore';

// In dev, always use '' (relative paths) so Vite's proxy handles routing — no CORS needed.
// In production, VITE_API_URL is baked in at build time pointing to the real backend.
const BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL as string) ?? '';

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT from memory on every request
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = authStore.getState().accessToken;
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401 — attempt refresh once, then force logout
let _refreshing: Promise<void> | null = null;

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    // Login and refresh failures must reach their caller without refreshing again.
    const isAuthExchange = /\/auth\/(login|refresh)(?:\?|$)/.test(original?.url ?? '');
    if (error.response?.status === 401 && original && !original._retry && !isAuthExchange) {
      original._retry = true;
      if (!_refreshing) {
        _refreshing = authStore.getState().refresh().finally(() => { _refreshing = null; });
      }
      try {
        await _refreshing;
        const token = authStore.getState().accessToken;
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      } catch {
        authStore.getState().logout();
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);
