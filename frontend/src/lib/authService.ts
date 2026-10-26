import { loginRequest, msalInstance } from './msalConfig';
import { apiClient } from './apiClient';
import { authStore, type AppUser } from '../store/authStore';

const IS_LOCAL_DEV = import.meta.env.VITE_API_URL?.includes('localhost') ||
                     import.meta.env.VITE_API_URL?.includes('127.0.0.1');

let redirectResult: Promise<void> | undefined;
let loginStarting = false;

export async function login(devEmail?: string): Promise<void> {
  if (IS_LOCAL_DEV) {
    // Bypass MSAL — call dev-login endpoint directly
    const { data } = await apiClient.post<{ access_token: string }>('/auth/dev-login', {
      email: devEmail ?? 'admin@amplify.local',
    });
    // Fetch user with the token before touching the store, so isAuthenticated
    // never becomes true while user is null (which would cause a redirect loop).
    const { data: user } = await apiClient.get<AppUser>('/auth/me', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    authStore.getState().setAuth(data.access_token, user);
    return;
  }

  if (loginStarting) return;
  loginStarting = true;
  try {
    await handleRedirectResult();
    await msalInstance.loginRedirect(loginRequest);
  } catch (error) {
    loginStarting = false;
    if ((error as { errorCode?: string }).errorCode === 'interaction_in_progress') {
      throw new Error('Microsoft sign-in is already in progress. Finish it in the original tab, then try again.');
    }
    throw error;
  }
  // Execution stops here — browser navigates away; handleRedirectResult() picks up on return
}

export async function logout(): Promise<void> {
  try {
    await apiClient.delete('/auth/session');
  } catch {
    // Best-effort — always clear local state
  }
  authStore.getState().logout();
  // Skip MSAL logout in local dev — MSAL is never initialized there
  if (!IS_LOCAL_DEV) {
    try {
      await msalInstance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
    } catch {
      // MSAL not initialized — local state already cleared above
    }
  }
}

// Wake the App Service from cold start before the auth exchange.
// Azure App Service (Basic/Free) can take 60–90 s on first request;
// the /health endpoint is cheap and has no auth requirement.
async function _warmBackend(): Promise<void> {
  try {
    await apiClient.get('/health', { timeout: 90_000 });
  } catch {
    // Ignore — backend may already be warm, or /health is temporarily unavailable.
  }
}

// Called once on app startup to process the Azure AD redirect response.
// If the user just returned from loginRedirect, exchanges the id_token for an Amplify JWT.
export function handleRedirectResult(): Promise<void> {
  if (IS_LOCAL_DEV) return Promise.resolve();
  // Share the complete redirect and backend exchange across startup, callback,
  // and React StrictMode effects. Process each response only once per page.
  return redirectResult ??= completeRedirectResult();
}

async function completeRedirectResult(): Promise<void> {
    await msalInstance.initialize();
    const result = await msalInstance.handleRedirectPromise();
    console.log('[MSAL] handleRedirectPromise result:', result ? 'got token' : 'null (no redirect)');
    if (!result) return; // Not a redirect return — normal page load

    // Ensure the backend is awake before token exchange (cold-start guard).
    console.log('[MSAL] Warming backend before token exchange...');
    await _warmBackend();
    console.log('[MSAL] Backend warm, calling /auth/login...');

    const azureToken = result.idToken;
    const { data } = await apiClient.post<{ access_token: string }>('/auth/login', {
      azure_token: azureToken,
    }, { timeout: 90_000 });
    const { data: user } = await apiClient.get<AppUser>('/auth/me', {
      headers: { Authorization: `Bearer ${data.access_token}` },
      timeout: 90_000,
    });
    authStore.getState().setAuth(data.access_token, user);
}

export async function loadCurrentUser(): Promise<AppUser | null> {
  const token = authStore.getState().accessToken;
  if (!token) return null;
  try {
    const { data } = await apiClient.get<AppUser>('/auth/me');
    authStore.setState({ user: data });
    return data;
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 401) authStore.getState().logout();
    return null;
  }
}

export function getUser(): AppUser | null {
  return authStore.getState().user;
}

export function isAuthenticated(): boolean {
  return !!authStore.getState().accessToken;
}

export function hasRole(...roles: AppUser['role'][]): boolean {
  const user = authStore.getState().user;
  return user ? roles.includes(user.role) : false;
}
