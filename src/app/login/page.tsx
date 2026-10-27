import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { databaseFailureOf, type DatabaseFailure } from '@/db/connection-config';
import { getSessionUser, SESSION_COOKIE_NAME } from '@/lib/auth';
import { isDemoSeedEnabled } from '@/lib/demo-mode';
import { safeNextPath } from '@/lib/safe-redirect';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

// Reads the session cookie and live account state on every request.
export const dynamic = 'force-dynamic';
// A cold start may migrate and seed the database before the page can render.
export const maxDuration = 60;

function firstRow<T>(result: unknown): T | undefined {
  const r = result as { rows?: T[] } | T[];
  return (Array.isArray(r) ? r : (r.rows ?? []))[0];
}

/**
 * Login page (server). Responsibilities kept off the client:
 *  - already signed in → straight to the (sanitised) destination
 *  - demo-account shortcuts only when those seeded accounts really exist
 *  - a setup notice when the database has no staff accounts at all
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(Array.isArray(params.next) ? params.next[0] : params.next);

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const user = await getSessionUser(token).catch(() => null);
    if (user) redirect(next);
  }

  let showDemoAccounts = false;
  let setupRequired = false;
  let databaseIssue: DatabaseFailure | null = null;
  try {
    const db = await getDb();
    const counts = firstRow<{ real_total: number; total: number; demo: number }>(
      await db.execute(sql`
        SELECT count(*) FILTER (WHERE email NOT LIKE '%@chalarfarms.demo')::int AS real_total,
               count(*)::int AS total,
               count(*) FILTER (WHERE email = 'superadmin@chalarfarms.demo' AND status = 'ACTIVE')::int AS demo
        FROM users
      `)
    );
    // Demo accounts are unusable when demo mode is off, so they don't count as staff accounts.
    setupRequired = Number((isDemoSeedEnabled() ? counts?.total : counts?.real_total) ?? 0) === 0;
    showDemoAccounts = isDemoSeedEnabled() && Number(counts?.demo ?? 0) > 0;
  } catch (err) {
    databaseIssue = databaseFailureOf(err) ?? { code: 'DB_UNKNOWN', hint: 'See the server logs for details.' };
    console.error(`[login] could not read account state (${databaseIssue.code})`, err);
  }

  return (
    <LoginForm
      next={next}
      showDemoAccounts={showDemoAccounts}
      setupRequired={setupRequired}
      databaseIssue={databaseIssue}
    />
  );
}
