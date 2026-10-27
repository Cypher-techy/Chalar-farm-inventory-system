import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { freshDb, one, ADMIN_PASSWORD } from './helpers';
import { getDb } from '@/db';
import { login } from '@/lib/auth';
import { isDemoSeedEnabled } from '@/lib/demo-mode';
import { ensureInitialAdmin, countActiveSuperAdmins } from '@/db/bootstrap-admin';

/**
 * Demo accounts' passwords are published in this repository. If demo data ever
 * lands in a production database (e.g. ENABLE_DEMO_SEED=true copied into Vercel),
 * those accounts must be unusable and must not block the real first admin.
 */
describe('Demo data is never usable on a Vercel production deployment', () => {
  const saved = { ...process.env };
  beforeAll(async () => {
    await freshDb(); // seeded with demo data (development defaults)
  }, 120000);
  afterEach(() => {
    process.env = { ...saved };
  });

  it('demo data is opt-in and never allowed on Vercel production', () => {
    delete process.env.ENABLE_DEMO_SEED;
    expect(isDemoSeedEnabled()).toBe(false); // real system by default
    process.env.ENABLE_DEMO_SEED = 'false';
    expect(isDemoSeedEnabled()).toBe(false);
    process.env.ENABLE_DEMO_SEED = 'true';
    expect(isDemoSeedEnabled()).toBe(true);
    process.env.VERCEL_ENV = 'production';
    expect(isDemoSeedEnabled()).toBe(false);
    process.env.ALLOW_DEMO_SEED_IN_PRODUCTION = 'true'; // no override exists
    expect(isDemoSeedEnabled()).toBe(false);
  });

  it('blocks demo-account sign-in when demo mode is off, with the generic error', async () => {
    expect((await login('superadmin@chalarfarms.demo', ADMIN_PASSWORD)).ok).toBe(true);
    process.env.VERCEL_ENV = 'production';
    const res = await login('superadmin@chalarfarms.demo', ADMIN_PASSWORD);
    expect(res.ok).toBe(false);
    expect(res.error).toBe('Invalid email or password.');
    const ev = await one<{ c: number }>(sql`SELECT count(*)::int AS c FROM security_events WHERE event_type = 'LOGIN_BLOCKED_DEMO_ACCOUNT'`);
    expect(ev.c).toBeGreaterThan(0);
  });

  it('a blocked demo Super Admin does not stop the real first admin being created', async () => {
    process.env.VERCEL_ENV = 'production';
    const db = await getDb();
    expect(await countActiveSuperAdmins(db)).toBe(0);
    const result = await ensureInitialAdmin(db, {
      INITIAL_ADMIN_EMAIL: 'owner@chalarfarms.example',
      INITIAL_ADMIN_PASSWORD: 'Taveta#Herbs2026',
    });
    expect(result).toBe('created');
    expect((await login('owner@chalarfarms.example', 'Taveta#Herbs2026')).ok).toBe(true);
  });
});
