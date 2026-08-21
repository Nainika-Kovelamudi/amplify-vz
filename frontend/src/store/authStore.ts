import { create } from 'zustand';
import { apiClient } from '../lib/apiClient';

export interface AppUser {
  id: string;
  email: string;
  display_name: string | null;
  role: 'Aimplify.User' | 'Aimplify.Admin' | 'Aimplify.Owner';
  department: string | null;
  last_login: string | null;
}

interface AuthState {
  accessToken: string | null;
  user: AppUser | null;
  isLoading: boolean;
  setAuth: (token: string, user: AppUser) => void;
  logout: () => void;
  refresh: () => Promise<void>;
}

const TOKEN_KEY = 'amplify_access_token';
const USER_KEY  = 'amplify_user';

function readStoredUser(): AppUser | null {
  try { return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null'); } catch { return null; }
}

/** Wipe every auth-related key from localStorage including MSAL cache entries. */
function clearAllAuthStorage() {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i) ?? '';
    // our own keys + any MSAL / msal.* cache entries
    if (
      k === TOKEN_KEY ||
      k === USER_KEY ||
      k.startsWith('msal.') ||
      k.startsWith('msal-') ||
      k.startsWith('amplify_')
    ) {
      keysToRemove.push(k);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
  sessionStorage.clear();
}

export const authStore = create<AuthState>((set, get) => ({
  accessToken: localStorage.getItem(TOKEN_KEY),
  user: readStoredUser(),
  isLoading: true,

  setAuth: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ accessToken: token, user, isLoading: false });
  },

  logout: () => {
    clearAllAuthStorage();
    apiClient.defaults.headers.common['Authorization'] = '';
    set({ accessToken: null, user: null, isLoading: false });
    // Hard redirect so no stale React state lingers
    if (!window.location.pathname.startsWith('/login') &&
        !window.location.pathname.startsWith('/auth')) {
      window.location.href = '/login';
    }
  },

  refresh: async () => {
    const current = get().accessToken;
    if (!current) throw new Error('No token to refresh');
    // Timeout after 8 s so a dead backend doesn't leave the app stuck
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const { data } = await apiClient.post<{ access_token: string; user: AppUser }>(
        '/auth/refresh',
        {},
        { signal: controller.signal },
      );
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      set({ accessToken: data.access_token, user: data.user });
    } finally {
      clearTimeout(timer);
    }
  },
}));
