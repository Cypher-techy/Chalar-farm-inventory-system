import { NextRequest } from 'next/server';
import { getDb, resetTestDb } from '@/db';
import { sql } from 'drizzle-orm';
import { login, SESSION_COOKIE_NAME } from '@/lib/auth';

/**
 * Shared test harness.
 * Each test file gets a fresh in-memory PostgreSQL (PGlite) with migrations
 * applied and the demo seed loaded, so tests exercise the same code paths as
 * the running application rather than mocks.
 */
export async function freshDb() {
  process.env.VITEST = 'true';
  return resetTestDb();
}

export async function db() {
  return getDb();
}

export async function rows<T>(query: ReturnType<typeof sql>): Promise<T[]> {
  const d = await getDb();
  const res = (await d.execute(query)) as unknown as { rows: T[] };
  return res.rows;
}

export async function one<T>(query: ReturnType<typeof sql>): Promise<T> {
  const r = await rows<T>(query);
  return r[0] as T;
}

export const DEMO_PASSWORD = 'Chalar@Demo2026!';
export const ADMIN_PASSWORD = 'Chalar@Admin2026!';

/** Signs in a demo user and returns their raw session token. */
export async function tokenFor(email: string, password = DEMO_PASSWORD): Promise<string> {
  const res = await login(email, password, { ipAddress: '127.0.0.1', userAgent: 'vitest' });
  if (!res.ok || !res.token) {
    throw new Error(`Test login failed for ${email}: ${res.error}`);
  }
  return res.token;
}

/** Builds a NextRequest that route handlers accept, with the session cookie attached. */
export function makeRequest(
  url: string,
  options: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {}
): NextRequest {
  const headers = new Headers(options.headers ?? {});
  if (options.token) headers.set('cookie', `${SESSION_COOKIE_NAME}=${options.token}`);
  if (options.body !== undefined) headers.set('content-type', 'application/json');

  return new NextRequest(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

export async function json(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}
