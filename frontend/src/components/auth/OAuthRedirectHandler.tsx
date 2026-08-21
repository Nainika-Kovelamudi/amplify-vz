import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Supabase may redirect to Site URL root (e.g. /?code=...) instead of /auth/callback
 * when Redirect URLs are not allowlisted. Forward those to the callback route.
 */
export function OAuthRedirectHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === '/auth/callback') return;

    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const oauthError = params.get('error_description') ?? params.get('error');

    if (!code && !oauthError) return;

    const next = new URLSearchParams();
    if (code) next.set('code', code);
    if (oauthError) next.set('error_description', oauthError);

    navigate(`/auth/callback?${next.toString()}`, { replace: true });
  }, [location.pathname, location.search, navigate]);

  return null;
}
