import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleRedirectResult } from '../lib/authService';
import { authStore } from '../store/authStore';

export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function complete() {
      try {
        console.log('[AuthCallback] Calling handleRedirectPromise...');
        await handleRedirectResult();
        console.log('[AuthCallback] handleRedirectResult complete, auth state:',
          !!authStore.getState().accessToken);

        if (!cancelled) navigate('/', { replace: true });
      } catch (err) {
        console.error('[AuthCallback] Error during redirect handling:', err);
        const msg = err instanceof Error ? err.message : 'Sign-in failed';
        if (!cancelled) navigate('/login', { replace: true, state: { authError: msg } });
      } finally {
        if (!cancelled) authStore.setState({ isLoading: false });
      }
    }

    void complete();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <p className="text-sm text-slate-600">Completing sign in…</p>
      </div>
    </div>
  );
}
