/**
 * Command-line database setup: applies pending migrations, seeds system
 * configuration (plus demo data only when ENABLE_DEMO_SEED=true) and creates the
 * first Super Administrator from INITIAL_ADMIN_* — exactly what the app does on
 * its first request, but runnable ahead of a deployment:
 *
 *   DATABASE_URL="postgresql://…" ENABLE_DEMO_SEED=false npm run db:migrate
 *
 * Both `npm run db:migrate` and `npm run db:seed` run this script.
 */
import { sql } from 'drizzle-orm';
import { getDb, closeDb } from './index';
import { databaseFailureOf } from './connection-config';

async function main() {
  const started = Date.now();
  const db = await getDb();
  const r = (await db.execute(sql`
    SELECT (SELECT count(*)::int FROM chalar_schema_migrations) AS migrations,
           (SELECT count(*)::int FROM roles) AS roles,
           (SELECT count(*)::int FROM users WHERE status = 'ACTIVE') AS active_users
  `)) as unknown as { rows?: Array<Record<string, number>> } | Array<Record<string, number>>;
  const row = (Array.isArray(r) ? r : (r.rows ?? []))[0] ?? {};
  console.log(
    `Database ready in ${Date.now() - started} ms — migrations: ${row.migrations}, roles: ${row.roles}, active users: ${row.active_users}.`
  );
  if (!row.active_users) {
    console.log('No active staff accounts: set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD (12+ characters) and run again.');
  }
  await closeDb();
}

main().catch(async (err) => {
  const failure = databaseFailureOf(err);
  console.error(failure ? `Database setup failed (${failure.code}): ${failure.hint}` : 'Database setup failed.');
  console.error(err instanceof Error && err.cause ? err.cause : err);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
