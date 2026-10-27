import { describe, it, expect, beforeAll } from 'vitest';
import { freshDb, rows, DEMO_PASSWORD, ADMIN_PASSWORD } from './helpers';
import {
  login,
  hashPassword,
  verifyPassword,
  getSessionUser,
  revokeSession,
  revokeAllUserSessions,
} from '@/lib/auth';
import { sql } from 'drizzle-orm';

describe('Authentication', () => {
  beforeAll(async () => {
    await freshDb();
  }, 120000);

  it('hashes passwords with a per-password salt (bcrypt)', async () => {
    const a = await hashPassword('Same@Password123');
    const b = await hashPassword('Same@Password123');
    expect(a).not.toBe(b);
    expect(a.startsWith('$2')).toBe(true);
    expect(await verifyPassword('Same@Password123', a)).toBe(true);
    expect(await verifyPassword('wrong', a)).toBe(false);
  });

  it('authenticates a valid demo user and resolves role permissions', async () => {
    const result = await login('superadmin@chalarfarms.demo', ADMIN_PASSWORD, {
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });
    expect(result.ok).toBe(true);
    expect(result.token).toBeTruthy();
    expect(result.user?.primaryRoleCode).toBe('SUPER_ADMIN');
    expect(result.user?.permissions).toContain('users.manage');
    expect(result.user?.permissions).toContain('dashboard.super_admin');
  });

  it('rejects a wrong password and records a security event', async () => {
    const before = await rows<{ c: number }>(
      sql`SELECT count(*)::int AS c FROM security_events WHERE event_type LIKE 'LOGIN_FAILED%'`
    );
    const result = await login('hr@chalarfarms.demo', 'not-the-password', { ipAddress: '127.0.0.1' });
    expect(result.ok).toBe(false);
    const after = await rows<{ c: number }>(
      sql`SELECT count(*)::int AS c FROM security_events WHERE event_type LIKE 'LOGIN_FAILED%'`
    );
    expect(after[0].c).toBeGreaterThan(before[0].c);
  });

  it('locks an account after repeated failed attempts', async () => {
    const email = 'inventory@chalarfarms.demo';
    for (let i = 0; i < 6; i++) {
      await login(email, `bad-password-${i}`, { ipAddress: '127.0.0.1' });
    }
    const locked = await login(email, DEMO_PASSWORD, { ipAddress: '127.0.0.1' });
    expect(locked.ok).toBe(false);
    expect(locked.lockoutMinutes ?? 0).toBeGreaterThan(0);
  });

  it('creates, validates and revokes sessions', async () => {
    const loggedIn = await login('qa@chalarfarms.demo', DEMO_PASSWORD, {
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });
    expect(loggedIn.ok).toBe(true);
    const token = loggedIn.token!;

    const sessionUser = await getSessionUser(token);
    expect(sessionUser?.email).toBe('qa@chalarfarms.demo');
    expect(sessionUser?.permissions).toContain('qa.inspect');

    // Session tokens are stored hashed — the raw token never lands in the database
    const raw = await rows<{ c: number }>(
      sql`SELECT count(*)::int AS c FROM sessions WHERE token_hash = ${token}`
    );
    expect(raw[0].c).toBe(0);

    await revokeSession(token, 'TEST');
    expect(await getSessionUser(token)).toBeNull();
  });

  it('revokes every session for a user at once (admin action)', async () => {
    const first = await login('sales@chalarfarms.demo', DEMO_PASSWORD, { ipAddress: '127.0.0.1' });
    const second = await login('sales@chalarfarms.demo', DEMO_PASSWORD, { ipAddress: '127.0.0.2' });
    const t1 = first.token!;
    const t2 = second.token!;
    expect(await getSessionUser(t1)).not.toBeNull();
    expect(await getSessionUser(t2)).not.toBeNull();

    const users = await rows<{ id: number }>(sql`SELECT id FROM users WHERE email = 'sales@chalarfarms.demo'`);
    const revoked = await revokeAllUserSessions(users[0].id, 'TEST_BULK');
    expect(revoked).toBeGreaterThanOrEqual(2);
    expect(await getSessionUser(t1)).toBeNull();
    expect(await getSessionUser(t2)).toBeNull();
  });

  it('rejects unknown emails without revealing whether the account exists', async () => {
    const res = await login('nobody@chalarfarms.demo', 'Whatever@12345', { ipAddress: '127.0.0.1' });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/invalid/i);
  });

  it('blocks login for deactivated accounts', async () => {
    const users = await rows<{ id: number }>(sql`SELECT id FROM users WHERE email = 'auditor@chalarfarms.demo'`);
    const { getDb } = await import('@/db');
    const d = await getDb();
    await d.execute(sql`UPDATE users SET status = 'INACTIVE' WHERE id = ${users[0].id}`);
    const res = await login('auditor@chalarfarms.demo', DEMO_PASSWORD, { ipAddress: '127.0.0.1' });
    expect(res.ok).toBe(false);
    await d.execute(sql`UPDATE users SET status = 'ACTIVE' WHERE id = ${users[0].id}`);
  });
});
