import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { msalInstance } from './msalConfig';
import { apiClient } from './apiClient';

const scopes = ['User.ReadBasic.All'];
const root = 'https://graph.microsoft.com/v1.0';
export interface DirectoryAttendee { id: string; name: string; email: string; source?: 'AIMPLIFY' | 'Microsoft' }

export async function searchPlatformAttendees(query: string, signal?: AbortSignal): Promise<DirectoryAttendee[]> {
  if (query.trim().length < 2) return [];
  const { data } = await apiClient.get<{items: DirectoryAttendee[]}>('/meeting-plans/attendees', { params: { search: query.trim() }, signal });
  return directoryAttendees({ value: (data.items || []).map(person => ({id:person.id,displayName:person.name,mail:person.email})) })
    .map(person => ({...person,source:'AIMPLIFY'}));
}

export class DirectoryConsentRequired extends Error {
  constructor() { super('Connect your Microsoft directory to search for attendees. Your organization may need to approve directory access.'); }
}

function account() {
  const active = msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0];
  if (!active) throw new Error('Sign in with your Microsoft work account to search the directory. You can still enter emails manually.');
  return active;
}

/** Interactive authentication runs only from the user's Connect directory click. */
export async function connectAttendeeDirectory(): Promise<void> {
  try {
    await msalInstance.acquireTokenPopup({ account: account(), scopes });
  } catch (error) {
    if (error instanceof Error && 'errorCode' in error && error.errorCode === 'interaction_in_progress') {
      throw new Error('Another Microsoft sign-in is in progress. Complete it before connecting the directory.');
    }
    throw new Error('Directory connection was not completed. Your administrator may need to approve User.ReadBasic.All. You can enter emails manually.', { cause: error });
  }
}

export function directorySearchPath(query: string): string {
  // OData string literals escape apostrophes by doubling them. URL encoding is separate.
  const prefix = query.trim().replace(/'/g, "''");
  const params = new URLSearchParams({
    '$select': 'id,displayName,mail,userPrincipalName',
    '$filter': ['displayName', 'givenName', 'surname', 'mail', 'userPrincipalName']
      .map(property => `startswith(${property},'${prefix}')`).join(' or '),
    '$top': '8',
  });
  return `/users?${params}`;
}

export function directoryAttendees(data: unknown): DirectoryAttendee[] {
  const rows = data && typeof data === 'object' && 'value' in data ? data.value : null;
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  return rows.flatMap(row => {
    if (!row || typeof row !== 'object') return [];
    const mail = typeof row.mail === 'string' ? row.mail.trim() : '';
    const upn = typeof row.userPrincipalName === 'string' ? row.userPrincipalName.trim() : '';
    const email = (mail || (upn.includes('#EXT#') ? '' : upn)).toLowerCase();
    if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) || seen.has(email)) return [];
    seen.add(email);
    return [{ id: String(row.id || email), name: String(row.displayName || email), email }];
  });
}

export async function searchDirectoryAttendees(query: string, signal?: AbortSignal): Promise<DirectoryAttendee[]> {
  if (query.trim().length < 2) return [];
  let accessToken: string;
  try {
    accessToken = (await msalInstance.acquireTokenSilent({ account: account(), scopes })).accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) throw new DirectoryConsentRequired();
    throw error;
  }
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const response = await fetch(root + directorySearchPath(query), {
    headers: { Authorization: `Bearer ${accessToken}` }, signal,
  });
  if (response.status === 401 || response.status === 403) throw new DirectoryConsentRequired();
  if (response.status === 429) throw new Error('Directory search is busy. Please try again shortly, or enter emails manually.');
  if (!response.ok) throw new Error('Directory search is unavailable. You can still enter attendee emails manually.');
  return directoryAttendees(await response.json());
}
