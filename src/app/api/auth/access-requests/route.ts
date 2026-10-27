import { NextRequest, NextResponse } from 'next/server';
import { databaseFailureOf } from '@/db/connection-config';
import { ApiError, clientIp, jsonError, rateLimit } from '@/lib/guards';
import {
  accessRequestProblem,
  accessRequestSchema,
  GENERIC_SUBMIT_MESSAGE,
  submitAccessRequest,
} from '@/lib/access-requests';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Public sign-up: records a request for an account of a chosen type.
 * Grants no access by itself — a Super Administrator must approve it.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    rateLimit(`signup:${ip}`, 5, 15 * 60_000);
    rateLimit('signup-global', 40, 60_000);

    const body = await req.json().catch(() => null);
    const parsed = accessRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, parsed.error.issues[0]?.message ?? 'Invalid request.');
    }
    const problem = accessRequestProblem(parsed.data);
    if (problem) return jsonError(400, problem);

    await submitAccessRequest(parsed.data, {
      ipAddress: ip,
      userAgent: req.headers.get('user-agent') ?? undefined,
    });
    // Same response whether stored, duplicate, or existing account (no enumeration)
    return NextResponse.json({ ok: true, message: GENERIC_SUBMIT_MESSAGE }, { status: 202 });
  } catch (err) {
    if (err instanceof ApiError) return jsonError(err.status, err.message);
    const dbFailure = databaseFailureOf(err);
    if (dbFailure) {
      console.error(`[chalar-db] sign-up unavailable (${dbFailure.code})`, err);
      return NextResponse.json(
        { ok: false, error: "Sign-up is temporarily unavailable: the server can't reach its database.", code: dbFailure.code },
        { status: 503 }
      );
    }
    console.error('[chalar] access request error', err);
    return jsonError(500, 'Could not submit your request. Please try again.');
  }
}
