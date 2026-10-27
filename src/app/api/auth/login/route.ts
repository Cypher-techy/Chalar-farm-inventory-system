import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { login, SESSION_COOKIE_NAME } from '@/lib/auth';
import { databaseFailureOf } from '@/db/connection-config';
import { ApiError, clientIp, jsonError, jsonOk, rateLimit } from '@/lib/guards';

// First request on a cold serverless instance may run migrations + seeding.
export const maxDuration = 60;

const loginSchema = z.object(
  {
    email: z
      .string({ required_error: 'Enter your email address.', invalid_type_error: 'Enter your email address.' })
      .trim()
      .min(1, 'Enter your email address.')
      .max(254, 'Enter a valid email address.')
      .email('Enter a valid email address.'),
    password: z
      .string({ required_error: 'Enter your password.', invalid_type_error: 'Enter your password.' })
      .min(1, 'Enter your password.')
      .max(256, 'Password is too long.'),
  },
  { required_error: 'Invalid sign-in request.', invalid_type_error: 'Invalid sign-in request.' }
);

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    rateLimit(`login:${ip}`, 8, 60_000);
    rateLimit(`login-global`, 60, 60_000);

    const body = await req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, parsed.error.issues[0]?.message ?? 'Invalid input.');
    }

    const result = await login(parsed.data.email, parsed.data.password, {
      ipAddress: ip,
      userAgent: req.headers.get('user-agent') ?? undefined,
    });

    if (!result.ok || !result.token || !result.user) {
      return jsonError(result.error === 'Account temporarily locked due to repeated failed attempts.' || (result.lockoutMinutes ?? 0) > 0 ? 423 : 401, result.error ?? 'Login failed.');
    }

    const res = jsonOk({ user: result.user });
    res.cookies.set(SESSION_COOKIE_NAME, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: Number(process.env.SESSION_TTL_HOURS || 12) * 3600,
    });
    return res;
  } catch (err) {
    // Rate limiting and lockout surface their real status codes (429 / 423)
    if (err instanceof ApiError) return jsonError(err.status, err.message);
    const dbFailure = databaseFailureOf(err);
    if (dbFailure) {
      console.error(`[chalar-db] sign-in unavailable (${dbFailure.code})`, err);
      return NextResponse.json(
        {
          ok: false,
          error: "Sign-in is temporarily unavailable: the server can't reach its database.",
          code: dbFailure.code,
          hint: dbFailure.hint,
        },
        { status: 503, headers: { 'Retry-After': '30' } }
      );
    }
    console.error('[chalar] login error', err);
    return jsonError(500, 'An unexpected error occurred during sign-in.');
  }
}
