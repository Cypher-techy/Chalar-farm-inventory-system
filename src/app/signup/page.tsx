import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { databaseFailureOf, type DatabaseFailure } from '@/db/connection-config';
import { getSessionUser, SESSION_COOKIE_NAME } from '@/lib/auth';
import { REQUESTABLE_ACCOUNT_TYPES } from '@/lib/account-types';
import { SignupForm } from './signup-form';

export const metadata: Metadata = {
  title: 'Request an account',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Public account request page. The applicant chooses the account type
 * (dashboard role) they need; nothing is granted until a Super Administrator
 * approves the request.
 */
export default async function SignupPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const user = await getSessionUser(token).catch(() => null);
    if (user) redirect('/portal');
  }

  let departments: Array<{ id: number; code: string; name: string }> = [];
  let noApprover = false;
  let databaseIssue: DatabaseFailure | null = null;
  try {
    const db = await getDb();
    const res = (await db.execute(sql`SELECT id, code, name FROM departments WHERE is_active IS NOT FALSE ORDER BY name`)) as unknown as {
      rows: Array<{ id: number; code: string; name: string }>;
    };
    departments = res.rows;
    const approvers = (await db.execute(sql`
      SELECT count(DISTINCT u.id)::int AS n
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN role_permissions rp ON rp.role_id = ur.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.code = 'users.manage' AND u.status = 'ACTIVE'
    `)) as unknown as { rows: Array<{ n: number }> };
    noApprover = Number(approvers.rows[0]?.n ?? 0) === 0;
  } catch (err) {
    databaseIssue = databaseFailureOf(err) ?? { code: 'DB_UNKNOWN', hint: 'See the server logs for details.' };
    console.error(`[signup] could not load form data (${databaseIssue.code})`, err);
  }

  return (
    <SignupForm
      accountTypes={REQUESTABLE_ACCOUNT_TYPES}
      departments={departments}
      noApprover={noApprover}
      databaseIssue={databaseIssue}
    />
  );
}
