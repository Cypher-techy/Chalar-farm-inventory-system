import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, getSessionUser, type SessionUser } from '@/lib/auth';

export async function getSessionFromCookies(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return getSessionUser(token);
}
