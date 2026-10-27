import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { freshDb, rows } from './helpers';
import { getDb } from '@/db';
import { ensureInitialAdmin, countActiveSuperAdmins, initialAdminPasswordProblem } from '@/db/bootstrap-admin';
import { login } from '@/lib/auth';
import { safeNextPath } from '@/lib/safe-redirect';
import { POST as loginRoute } from '@/app/api/auth/login/route';

const STRONG = 'Taveta#Herbs2026';

describe('Login redirect sanitiser', () => {
  it('keeps same-origin paths', () => {
    expect(safeNextPath('/portal/finance')).toBe('/portal/finance');
    expect(safeNextPath('/portal/hr?tab=leave#x')).toBe('/portal/hr?tab=leave#x');
  });

  it('rejects open-redirect and script payloads', () => {
    for (const bad of [
      '//evil.example',
      '/\\evil.example',
      'https://evil.example',
      'javascript:alert(1)',
      '/%0d%0aSet-Cookie:x',
      ' //evil.example',
      '/\t/evil.example',
      '',
      null,
      undefined,
    ]) {
      const out = safeNextPath(bad as string | null | undefined);
      expect(out.startsWith('/')).toBe(true);
      expect(out.startsWith('//')).toBe(false);
      expect(new URL(out, 'http://chalar.invalid').origin).toBe('http://chalar.invalid');
    }
    expect(safeNextPath('//evil.example')).toBe('/portal');
    expect(safeNextPath('/login')).toBe('/portal');
  });
});

describe('Login API input handling', () => {
  beforeAll(async () => {
    await freshDb();
  }, 120000);

  const call = (body: string) =>
    loginRoute(
      new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.9.${Math.floor(Math.random() * 250)}.1` },
        body,
      })
    );

  it('returns readable validation messages', async () => {
    let res = await call('{}');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Enter your email address.');

    res = await call('not json');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid sign-in request.');

    res = await call(JSON.stringify({ email: 'hr@chalarfarms.demo' }));
    expect((await res.json()).error).toBe('Enter your password.');
  });

  it('accepts emails with surrounding whitespace and mixed case', async () => {
    const res = await call(JSON.stringify({ email: '  SuperAdmin@ChalarFarms.demo ', password: 'Chalar@Admin2026!' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('chalar_session=');
  });
});

describe('First-run Super Administrator bootstrap (production, no demo data)', () => {
  const prev = process.env.ENABLE_DEMO_SEED;

  beforeAll(async () => {
    process.env.ENABLE_DEMO_SEED = 'false';
    await freshDb(); // configuration-only seed: roles, permissions, departments — zero users
  }, 120000);

  afterAll(() => {
    if (prev === undefined) delete process.env.ENABLE_DEMO_SEED;
    else process.env.ENABLE_DEMO_SEED = prev;
  });

  it('starts with no accounts, so nobody can sign in', async () => {
    const [{ n }] = await rows<{ n: number }>(sql`SELECT count(*)::int AS n FROM users`);
    expect(n).toBe(0);
    const res = await login('superadmin@chalarfarms.demo', 'Chalar@Admin2026!');
    expect(res.ok).toBe(false);
  });

  it('does nothing without configuration, or with a weak password', async () => {
    const db = await getDb();
    expect(await ensureInitialAdmin(db, {})).toBe('not-configured');
    expect(
      await ensureInitialAdmin(db, { INITIAL_ADMIN_EMAIL: 'admin@chalarfarms.com', INITIAL_ADMIN_PASSWORD: 'short' })
    ).toBe('invalid-config');
    expect(
      await ensureInitialAdmin(db, { INITIAL_ADMIN_EMAIL: 'not-an-email', INITIAL_ADMIN_PASSWORD: STRONG })
    ).toBe('invalid-config');
    expect(initialAdminPasswordProblem('alllowercaseletters')).not.toBeNull();
    expect(initialAdminPasswordProblem(STRONG)).toBeNull();
    expect(await countActiveSuperAdmins(db)).toBe(0);
  });

  it('creates exactly one Super Administrator who can sign in, then becomes a no-op', async () => {
    const db = await getDb();
    const env = { INITIAL_ADMIN_EMAIL: ' Admin@ChalarFarms.com ', INITIAL_ADMIN_PASSWORD: STRONG, INITIAL_ADMIN_NAME: 'Ops Admin' };
    expect(await ensureInitialAdmin(db, env)).toBe('created');
    expect(await countActiveSuperAdmins(db)).toBe(1);

    const res = await login('admin@chalarfarms.com', STRONG);
    expect(res.ok).toBe(true);
    expect(res.user?.primaryRoleCode).toBe('SUPER_ADMIN');
    expect(res.user?.permissions).toContain('users.manage');

    const [stored] = await rows<{ password_hash: string }>(
      sql`SELECT password_hash FROM users WHERE email = 'admin@chalarfarms.com'`
    );
    expect(stored.password_hash.startsWith('$2')).toBe(true);
    expect(stored.password_hash).not.toContain(STRONG);

    const events = await rows<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM security_events WHERE event_type = 'BOOTSTRAP_ADMIN_CREATED'`
    );
    expect(events[0].n).toBe(1);

    // Second run (every server start) must not create or modify anything.
    expect(await ensureInitialAdmin(db, { ...env, INITIAL_ADMIN_PASSWORD: 'Different#Pass2026' })).toBe('admin-exists');
    expect((await login('admin@chalarfarms.com', STRONG)).ok).toBe(true);
  });

  it('never takes over an existing non-admin account', async () => {
    const db = await getDb();
    await db.execute(sql`UPDATE users SET status = 'INACTIVE' WHERE email = 'admin@chalarfarms.com'`);
    await db.execute(sql`
      INSERT INTO users (email, password_hash, full_name, primary_role_code, status)
      VALUES ('clerk@chalarfarms.com', '$2a$12$abcdefghijklmnopqrstuuJ6f8i1o3KpQe2b7m0yH2Zx4Wq9LrTzS', 'Clerk', 'GENERAL_EMPLOYEE', 'ACTIVE')
    `);
    expect(
      await ensureInitialAdmin(db, { INITIAL_ADMIN_EMAIL: 'clerk@chalarfarms.com', INITIAL_ADMIN_PASSWORD: STRONG })
    ).toBe('email-taken');
    const [clerk] = await rows<{ primary_role_code: string }>(
      sql`SELECT primary_role_code FROM users WHERE email = 'clerk@chalarfarms.com'`
    );
    expect(clerk.primary_role_code).toBe('GENERAL_EMPLOYEE');
  });
});
