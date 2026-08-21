import type { User } from '@supabase/supabase-js';

export const ALLOWED_EMAIL_DOMAIN = 'infovision.com';
export const DEMO_USER_STORAGE_KEY = 'user';

export type UserDisplay = {
  name: string;
  initials: string;
  email: string;
};

export type AuthMode = 'demo' | 'sso' | null;

export function isAllowedEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

export function userDisplayFromEmail(email: string): UserDisplay {
  const emailParts = email.split('@')[0].split('.');
  const fullName = emailParts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  const initials =
    emailParts
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2) || 'U';

  return { name: fullName, initials, email };
}

export function getEmailFromUser(user: User): string | undefined {
  const candidates = [
    user.email,
    user.user_metadata?.email,
    user.user_metadata?.preferred_username,
    user.user_metadata?.upn,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.includes('@')) {
      return candidate.toLowerCase();
    }
  }

  return undefined;
}

export function userDisplayFromSession(user: User): UserDisplay {
  const email = getEmailFromUser(user) ?? '';
  const metaName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined);

  if (metaName) {
    const parts = metaName.trim().split(/\s+/);
    const initials =
      parts
        .map((part) => part.charAt(0).toUpperCase())
        .join('')
        .substring(0, 2) || 'U';
    return { name: metaName, initials, email };
  }

  return userDisplayFromEmail(email);
}

export function readDemoUser(): UserDisplay | null {
  const stored = localStorage.getItem(DEMO_USER_STORAGE_KEY);
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored) as Partial<UserDisplay>;
    if (!parsed.email || !isAllowedEmail(parsed.email)) return null;

    return {
      name: parsed.name || userDisplayFromEmail(parsed.email).name,
      initials: parsed.initials || userDisplayFromEmail(parsed.email).initials,
      email: parsed.email,
    };
  } catch {
    return null;
  }
}

export function writeDemoUser(email: string): UserDisplay {
  const user = userDisplayFromEmail(email);
  localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(user));
  return user;
}

export function clearDemoUser(): void {
  localStorage.removeItem(DEMO_USER_STORAGE_KEY);
}
