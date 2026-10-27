import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { databaseFailureOf } from '@/db/connection-config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Public health check for uptime monitors and deployment troubleshooting.
 * Reports only coarse status codes and generic remediation hints — never
 * hosts, user names, connection strings or record contents.
 */
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const db = await getDb();
    const r = (await db.execute(
      sql`SELECT (SELECT count(*)::int FROM users WHERE status = 'ACTIVE') AS active_users`
    )) as unknown as { rows?: Array<{ active_users: number }> } | Array<{ active_users: number }>;
    const row = (Array.isArray(r) ? r : (r.rows ?? []))[0];
    const setupRequired = Number(row?.active_users ?? 0) === 0;
    return NextResponse.json(
      {
        status: 'ok',
        database: 'ok',
        setupRequired,
        ...(setupRequired
          ? { hint: 'No staff accounts yet: set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD (12+ characters), then redeploy.' }
          : {}),
      },
      { headers }
    );
  } catch (err) {
    const failure = databaseFailureOf(err) ?? { code: 'DB_UNKNOWN', hint: 'See the server logs for details.' };
    return NextResponse.json(
      { status: 'error', database: 'unavailable', code: failure.code, hint: failure.hint },
      { status: 503, headers }
    );
  }
}
