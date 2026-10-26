import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, getSessionUser, hasPermission, type SessionUser } from './auth';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export function jsonError(status: number, message: string, details?: unknown): NextResponse {
  return NextResponse.json({ ok: false, error: message, details }, { status });
}

export function jsonOk(payload: unknown = {}): NextResponse {
  return NextResponse.json({ ok: true, ...((payload as object) || {}) });
}

export async function requireAuth(req: NextRequest): Promise<SessionUser> {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = await getSessionUser(token);
  if (!user) {
    throw new ApiError(401, 'Authentication required.');
  }
  return user;
}

export async function requirePermission(
  req: NextRequest,
  permissionCode: string
): Promise<SessionUser> {
  const user = await requireAuth(req);
  if (!hasPermission(user, permissionCode)) {
    throw new ApiError(403, 'You do not have permission to perform this action.');
  }
  return user;
}

// ---------------------------------------------------------------------------
// Simple in-memory sliding-window rate limiter (per key).
// Suitable for single-instance deployments; swap for Redis-backed limiter
// when running multiple replicas in production.
// ---------------------------------------------------------------------------
const rateBuckets = new Map<string, number[]>();

export function rateLimit(key: string, maxRequests: number, windowMs: number): void {
  const now = Date.now();
  const windowStart = now - windowMs;
  const hits = (rateBuckets.get(key) ?? []).filter((ts) => ts > windowStart);
  if (hits.length >= maxRequests) {
    rateBuckets.set(key, hits);
    throw new ApiError(429, 'Too many requests. Please wait a moment and try again.');
  }
  hits.push(now);
  rateBuckets.set(key, hits);
}

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

/**
 * Idempotency helper: executes `fn` only if the key hasn't succeeded before.
 * Repeat requests with the same key return the stored result envelope.
 */
const completedIdempotency = new Map<string, { status: number; body: unknown }>();

export async function withIdempotency(
  key: string,
  fn: () => Promise<{ status?: number; body: unknown }>
): Promise<{ status: number; body: unknown; replayed: boolean }> {
  const cached = completedIdempotency.get(key);
  if (cached) {
    return { ...cached, replayed: true };
  }
  const result = await fn();
  const status = result.status ?? 200;
  completedIdempotency.set(key, { status, body: result.body });
  // Prevent unbounded growth
  if (completedIdempotency.size > 5000) {
    const firstKey = completedIdempotency.keys().next().value;
    if (firstKey) completedIdempotency.delete(firstKey);
  }
  return { status, body: result.body, replayed: false };
}

/** Neutralise CSV formula injection (=, +, -, @, tab, CR leading chars). */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (rows.length === 0) return '';
  const cols = columns ?? Object.keys(rows[0]);
  const header = cols.map((c) => escapeCsvCell(c)).join(',');
  const lines = rows.map((r) => cols.map((c) => escapeCsvCell(r[c])).join(','));
  return [header, ...lines].join('\r\n');
}
