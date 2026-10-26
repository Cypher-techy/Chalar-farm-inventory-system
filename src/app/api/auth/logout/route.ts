import { NextRequest, NextResponse } from 'next/server';
import { revokeSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { jsonOk } from '@/lib/guards';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await revokeSession(token, 'USER_LOGOUT');
  }
  const res = jsonOk({ message: 'Signed out.' });
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return res;
}
