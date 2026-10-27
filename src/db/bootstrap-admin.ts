import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { isDemoSeedEnabled } from '@/lib/demo-mode';
import type { ChalarDatabase } from './index';

/**
 * First-run Super Administrator bootstrap.
 *
 * Production deployments seed configuration only (no *.demo accounts), so
 * without this nobody could ever sign in. When the database has **no active
 * Super Administrator**, and INITIAL_ADMIN_EMAIL + INITIAL_ADMIN_PASSWORD are
 * set, one is created. It is a no-op once any active Super Admin exists, never
 * modifies an existing account, and records a security event. Remove the two
 * variables (and rotate the password in the portal) after first sign-in.
 */
export type BootstrapAdminResult =
  | 'created'
  | 'admin-exists'
  | 'not-configured'
  | 'invalid-config'
  | 'email-taken';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function initialAdminPasswordProblem(password: string): string | null {
  if (password.length < 12) return 'must be at least 12 characters';
  if (password.length > 128) return 'must be at most 128 characters';
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3) return 'must mix at least three of: lowercase, uppercase, digits, symbols';
  return null;
}

function rows<T>(result: unknown): T[] {
  const r = result as { rows?: T[] } | T[];
  if (Array.isArray(r)) return r;
  return r.rows ?? [];
}

export async function countActiveSuperAdmins(db: ChalarDatabase): Promise<number> {
  const r = rows<{ n: number }>(
    await db.execute(sql`
      SELECT count(*)::int AS n
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.code = 'SUPER_ADMIN' AND u.status = 'ACTIVE'
        AND (${isDemoSeedEnabled()}::boolean OR u.email NOT LIKE '%@chalarfarms.demo')
    `)
  );
  return Number(r[0]?.n ?? 0);
}

export async function ensureInitialAdmin(
  db: ChalarDatabase,
  env: Record<string, string | undefined> = process.env
): Promise<BootstrapAdminResult> {
  if ((await countActiveSuperAdmins(db)) > 0) return 'admin-exists';

  const email = env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.INITIAL_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn(
      '[chalar] No active Super Administrator exists and INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD are not set — nobody can sign in. See docs/DEPLOYMENT.md.'
    );
    return 'not-configured';
  }
  if (!EMAIL_RE.test(email)) {
    console.error('[chalar] INITIAL_ADMIN_EMAIL is not a valid email address; bootstrap admin not created.');
    return 'invalid-config';
  }
  const problem = initialAdminPasswordProblem(password);
  if (problem) {
    console.error(`[chalar] INITIAL_ADMIN_PASSWORD ${problem}; bootstrap admin not created.`);
    return 'invalid-config';
  }

  const existing = rows<{ id: number }>(await db.execute(sql`SELECT id FROM users WHERE email = ${email}`));
  if (existing.length > 0) {
    // Never silently escalate or reset an existing account from environment variables.
    console.error(
      `[chalar] INITIAL_ADMIN_EMAIL belongs to an existing account; it was not modified. Grant SUPER_ADMIN deliberately or choose another email.`
    );
    return 'email-taken';
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const fullName = env.INITIAL_ADMIN_NAME?.trim() || 'System Administrator';

  await db.execute(sql`
    INSERT INTO users (email, password_hash, full_name, department_id, primary_role_code, status)
    VALUES (${email}, ${passwordHash}, ${fullName}, (SELECT id FROM departments WHERE code = 'IT'), 'SUPER_ADMIN', 'ACTIVE')
  `);
  await db.execute(sql`
    INSERT INTO user_roles (user_id, role_id)
    SELECT u.id, r.id FROM users u, roles r
    WHERE u.email = ${email} AND r.code = 'SUPER_ADMIN'
    ON CONFLICT DO NOTHING
  `);
  await db.execute(sql`
    INSERT INTO security_events (user_id, event_type, severity, ip_address, user_agent, description)
    SELECT u.id, 'BOOTSTRAP_ADMIN_CREATED', 'CRITICAL', 'system', 'bootstrap',
           'Initial Super Administrator created from INITIAL_ADMIN_* environment variables'
    FROM users u WHERE u.email = ${email}
  `);
  console.info(`[chalar] Initial Super Administrator created for ${email}. Remove INITIAL_ADMIN_PASSWORD from the environment now.`);
  return 'created';
}
