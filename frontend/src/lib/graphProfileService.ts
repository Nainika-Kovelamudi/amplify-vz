import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { msalInstance } from './msalConfig';

// User.Read covers the signed-in user's profile. Manager lookup is temporarily
// disabled until the organization approves the broader directory permission.
const GRAPH_SCOPES = ['User.Read'];
const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';

export interface GraphUserProfile {
  id: string;
  displayName: string;
  givenName?: string | null;
  surname?: string | null;
  mail?: string | null;
  userPrincipalName?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  officeLocation?: string | null;
  mobilePhone?: string | null;
}

export interface DirectorySubmitterProfile {
  user: GraphUserProfile;
  manager: GraphUserProfile | null;
}

const cleanEmail = (value?: string | null) => (value ?? '').replace(/\\+@/g, '@').trim();

async function graphGet<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${GRAPH_ROOT}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Microsoft Graph request failed (${response.status}): ${body || response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function getDirectorySubmitterProfile(): Promise<DirectorySubmitterProfile> {
  const account = msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0];
  if (!account) throw new Error('No signed-in Microsoft account is available.');

  let accessToken: string;
  try {
    const token = await msalInstance.acquireTokenSilent({ account, scopes: GRAPH_SCOPES });
    accessToken = token.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      throw new Error(
        'Microsoft Graph consent is required. Sign out and sign in again after admin consent is granted.',
        { cause: error },
      );
    }
    throw error;
  }

  const userSelect = 'id,displayName,givenName,surname,mail,userPrincipalName,department,jobTitle,officeLocation,mobilePhone';
  const user = await graphGet<GraphUserProfile>(`/me?$select=${userSelect}`, accessToken);
  const manager: GraphUserProfile | null = null;

  user.mail = cleanEmail(user.mail) || cleanEmail(user.userPrincipalName);
  if (manager) manager.mail = cleanEmail(manager.mail) || cleanEmail(manager.userPrincipalName);
  return { user, manager };
}
