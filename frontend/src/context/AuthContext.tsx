import React, { createContext, useContext, useEffect, useMemo, useCallback, useState } from 'react';
import { msalInstance } from '../lib/msalConfig';
import { login, logout, loadCurrentUser } from '../lib/authService';
import { authStore, type AppUser } from '../store/authStore';

interface AuthContextValue {
  user: AppUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (devEmail?: string) => Promise<void>;
  logout: () => Promise<void>;
  authError: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
  authError: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Use selectors to avoid re-rendering on unrelated store changes
  const user = authStore((s) => s.user);
  const accessToken = authStore((s) => s.accessToken);
  const isLoading = authStore((s) => s.isLoading);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const isLocalDev = import.meta.env.VITE_API_URL?.includes('localhost') ||
                       import.meta.env.VITE_API_URL?.includes('127.0.0.1');
    let cancelled = false;

    // Safety net: if loading hasn't resolved in 10 s, clear stale auth and redirect
    const loadingTimeout = setTimeout(() => {
      if (authStore.getState().isLoading) {
        authStore.getState().logout();
      }
    }, 10_000);

    (async () => {
      try {
        if (isLocalDev) {
          authStore.setState({ isLoading: false });
          return;
        }

        await msalInstance.initialize();

        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0 && !authStore.getState().accessToken) {
          try { await loadCurrentUser(); } catch { authStore.getState().logout(); }
        } else if (authStore.getState().accessToken) {
          try { await loadCurrentUser(); } catch { authStore.getState().logout(); }
        }
      } catch {
        // MSAL init or any unexpected failure — clear stale auth so user can log in
        authStore.getState().logout();
      } finally {
        // Always unblock the UI regardless of what happened
        if (!cancelled) authStore.setState({ isLoading: false });
        clearTimeout(loadingTimeout);
      }
    })();
    return () => { cancelled = true; clearTimeout(loadingTimeout); };
  }, []);

  const handleLogin = useCallback(async (devEmail?: string) => {
    setAuthError(null);
    try {
      await login(devEmail);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setAuthError(msg);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    setAuthError(null);
    await logout();
  }, []);

  const value = useMemo(() => ({
    user,
    isLoading,
    isAuthenticated: !!accessToken,
    login: handleLogin,
    logout: handleLogout,
    authError,
  }), [user, isLoading, accessToken, handleLogin, handleLogout, authError]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
