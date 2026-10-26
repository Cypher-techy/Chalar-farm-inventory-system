import { NextRequest } from 'next/server';
import { getSessionUser, SESSION_COOKIE_NAME } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/guards';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = await getSessionUser(token);
  if (!user) return jsonError(401, 'Not authenticated.');
  return jsonOk({ user });
}
