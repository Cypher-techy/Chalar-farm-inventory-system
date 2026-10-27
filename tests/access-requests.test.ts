import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { freshDb, rows, one, tokenFor, makeRequest, ADMIN_PASSWORD } from './helpers';
import { login } from '@/lib/auth';
import { REQUESTABLE_ACCOUNT_TYPES } from '@/lib/account-types';
import { POST as submit } from '@/app/api/auth/access-requests/route';
import { GET as listRequests } from '@/app/api/admin/access-requests/route';
import { PATCH as decide } from '@/app/api/admin/access-requests/[id]/route';

const STRONG = 'Mavuno#Ledger2026';
let ipCounter = 1;

function signup(body: Record<string, unknown>) {
  // Distinct IP per call so the per-IP sign-up rate limit does not interfere
  return submit(
    makeRequest('http://localhost/api/auth/access-requests', {
      method: 'POST',
      body,
      headers: { 'x-forwarded-for': `10.77.${Math.floor(ipCounter / 250)}.${ipCounter++ % 250}` },
    })
  );
}

const base = (over: Record<string, unknown> = {}) => ({
  fullName: 'Amina Wanjiru',
  email: 'amina.finance@example.org',
  phone: '+254 700 000 111',
  jobTitle: 'Accounts Assistant',
  requestedRoleCode: 'FINANCE_MANAGER',
  message: 'Line manager: Finance Manager',
  password: STRONG,
  ...over,
});

async function requestId(email: string): Promise<number> {
  const r = await one<{ id: number }>(sql`SELECT id FROM access_requests WHERE email = ${email} ORDER BY id DESC LIMIT 1`);
  return r.id;
}

describe('Account types offered on sign-up', () => {
  it('mirror the portal roles, with dashboards, and never include Super Administrator', () => {
    const codes = REQUESTABLE_ACCOUNT_TYPES.map((a) => a.code);
    expect(codes).not.toContain('SUPER_ADMIN');
    expect(codes).toEqual(expect.arrayContaining(['FINANCE_MANAGER', 'HR_MANAGER', 'INVENTORY_MANAGER', 'GENERAL_EMPLOYEE']));
    const finance = REQUESTABLE_ACCOUNT_TYPES.find((a) => a.code === 'FINANCE_MANAGER')!;
    expect(finance.dashboards).toContain('Finance & Payroll');
    expect(finance.defaultDashboard).toBe('/portal/finance');
    expect(finance.suggestedDepartmentCode).toBe('FIN');
  });
});

describe('Self-service account requests', () => {
  let adminToken: string;
  let financeToken: string;

  beforeAll(async () => {
    await freshDb();
    adminToken = await tokenFor('superadmin@chalarfarms.demo', ADMIN_PASSWORD);
    financeToken = await tokenFor('finance@chalarfarms.demo');
  }, 120000);

  it('stores a pending request with a hashed password and grants no access', async () => {
    const res = await signup(base());
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.message).toMatch(/Super Administrator will review/);

    const r = await one<{ status: string; password_hash: string; requested_role_code: string }>(
      sql`SELECT status, password_hash, requested_role_code FROM access_requests WHERE email = 'amina.finance@example.org'`
    );
    expect(r.status).toBe('PENDING');
    expect(r.requested_role_code).toBe('FINANCE_MANAGER');
    expect(r.password_hash).toMatch(/^\$2[aby]\$12\$/);
    expect(r.password_hash).not.toContain(STRONG);

    expect(await rows(sql`SELECT id FROM users WHERE email = 'amina.finance@example.org'`)).toHaveLength(0);
    const attempt = await login('amina.finance@example.org', STRONG);
    expect(attempt.ok).toBe(false);
  });

  it('notifies everyone who can approve', async () => {
    const n = await one<{ c: number }>(sql`
      SELECT count(*)::int AS c FROM notification_records nr JOIN users u ON u.id = nr.user_id
      WHERE nr.category = 'ACCESS_REQUEST' AND u.email = 'superadmin@chalarfarms.demo'`);
    expect(n.c).toBeGreaterThan(0);
  });

  it('answers identically for duplicates and existing accounts (no enumeration)', async () => {
    const dup = await signup(base({ fullName: 'Someone Else' }));
    const existing = await signup(base({ email: 'finance@chalarfarms.demo' }));
    expect(dup.status).toBe(202);
    expect(existing.status).toBe(202);
    const [a, b] = [await dup.json(), await existing.json()];
    expect(a).toEqual(b);
    const c = await one<{ c: number }>(sql`SELECT count(*)::int AS c FROM access_requests WHERE email IN ('amina.finance@example.org', 'finance@chalarfarms.demo')`);
    expect(c.c).toBe(1);
  });

  it('rejects Super Administrator, unknown types, weak passwords and bad emails', async () => {
    for (const [over, msg] of [
      [{ email: 'x1@example.org', requestedRoleCode: 'SUPER_ADMIN' }, /valid account type/],
      [{ email: 'x2@example.org', requestedRoleCode: 'GOD_MODE' }, /valid account type/],
      [{ email: 'x3@example.org', password: 'short1A!' }, /at least 12/],
      [{ email: 'x4@example.org', password: 'alllowercaseletters' }, /three of/],
      [{ email: 'not-an-email' }, /valid email/],
    ] as const) {
      const res = await signup(base(over));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(msg);
    }
  });

  it('silently discards honeypot (bot) submissions', async () => {
    const res = await signup(base({ email: 'bot@example.org', website: 'http://spam.example' }));
    expect(res.status).toBe(202);
    expect(await rows(sql`SELECT id FROM access_requests WHERE email = 'bot@example.org'`)).toHaveLength(0);
  });

  it('rate-limits repeated submissions from one IP', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await submit(
        makeRequest('http://localhost/api/auth/access-requests', {
          method: 'POST',
          body: base({ email: `burst${i}@example.org` }),
          headers: { 'x-forwarded-for': '10.99.99.99' },
        })
      );
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 202)).toBe(true);
    expect(statuses[6]).toBe(429);
  });

  it('only users.manage holders can list or decide requests', async () => {
    const id = await requestId('amina.finance@example.org');
    expect((await listRequests(makeRequest('http://localhost/api/admin/access-requests'))).status).toBe(401);
    expect((await listRequests(makeRequest('http://localhost/api/admin/access-requests', { token: financeToken }))).status).toBe(403);
    const res = await decide(
      makeRequest(`http://localhost/api/admin/access-requests/${id}`, { method: 'PATCH', token: financeToken, body: { action: 'APPROVE' } }),
      { params: Promise.resolve({ id: String(id) }) }
    );
    expect(res.status).toBe(403);

    const list = await listRequests(makeRequest('http://localhost/api/admin/access-requests?status=PENDING', { token: adminToken }));
    expect(list.status).toBe(200);
    const data = (await list.json()) as { requests: Array<Record<string, unknown>> };
    expect(data.requests.some((r) => r.email === 'amina.finance@example.org')).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/password|\$2[aby]\$/);
  });

  it('refuses to grant Super Administrator through a request', async () => {
    const id = await requestId('amina.finance@example.org');
    const res = await decide(
      makeRequest(`http://localhost/api/admin/access-requests/${id}`, {
        method: 'PATCH', token: adminToken, body: { action: 'APPROVE', roleCode: 'SUPER_ADMIN' },
      }),
      { params: Promise.resolve({ id: String(id) }) }
    );
    expect(res.status).toBe(400);
    expect(await rows(sql`SELECT id FROM users WHERE email = 'amina.finance@example.org'`)).toHaveLength(0);
  });

  it('approval creates the account with the chosen role and the applicant’s own password', async () => {
    const id = await requestId('amina.finance@example.org');
    const res = await decide(
      makeRequest(`http://localhost/api/admin/access-requests/${id}`, {
        method: 'PATCH', token: adminToken, body: { action: 'APPROVE', note: 'Verified by phone with line manager' },
      }),
      { params: Promise.resolve({ id: String(id) }) }
    );
    expect(res.status).toBe(200);

    const u = await one<{ id: number; status: string; primary_role_code: string; dept: string }>(sql`
      SELECT u.id, u.status, u.primary_role_code, d.code AS dept FROM users u
      LEFT JOIN departments d ON d.id = u.department_id WHERE u.email = 'amina.finance@example.org'`);
    expect(u.status).toBe('ACTIVE');
    expect(u.primary_role_code).toBe('FINANCE_MANAGER');
    const roles = await rows<{ code: string }>(sql`SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ${u.id}`);
    expect(roles.map((r) => r.code)).toEqual(['FINANCE_MANAGER']);

    const r = await one<{ status: string; password_hash: string | null; created_user_id: number }>(
      sql`SELECT status, password_hash, created_user_id FROM access_requests WHERE id = ${id}`
    );
    expect(r.status).toBe('APPROVED');
    expect(r.password_hash).toBeNull();
    expect(r.created_user_id).toBe(u.id);

    const session = await login('amina.finance@example.org', STRONG);
    expect(session.ok).toBe(true);
    expect(session.user?.permissions).toContain('dashboard.finance');
    expect(session.user?.permissions).not.toContain('users.manage');

    const audit = await one<{ c: number }>(sql`SELECT count(*)::int AS c FROM audit_logs WHERE action = 'ACCESS_REQUEST_APPROVED'`);
    expect(audit.c).toBe(1);

    // Deciding twice is refused
    const again = await decide(
      makeRequest(`http://localhost/api/admin/access-requests/${id}`, { method: 'PATCH', token: adminToken, body: { action: 'APPROVE' } }),
      { params: Promise.resolve({ id: String(id) }) }
    );
    expect(again.status).toBe(409);
  });

  it('an approver may grant a narrower account type than requested', async () => {
    await signup(base({ email: 'peter.hr@example.org', fullName: 'Peter Otieno', requestedRoleCode: 'HR_MANAGER' }));
    const id = await requestId('peter.hr@example.org');
    const res = await decide(
      makeRequest(`http://localhost/api/admin/access-requests/${id}`, {
        method: 'PATCH', token: adminToken, body: { action: 'APPROVE', roleCode: 'GENERAL_EMPLOYEE', departmentId: null },
      }),
      { params: Promise.resolve({ id: String(id) }) }
    );
    expect(res.status).toBe(200);
    const u = await one<{ primary_role_code: string; department_id: number | null }>(
      sql`SELECT primary_role_code, department_id FROM users WHERE email = 'peter.hr@example.org'`
    );
    expect(u.primary_role_code).toBe('GENERAL_EMPLOYEE');
    expect(u.department_id).toBeNull();
  });

  it('rejection needs a reason, clears the password hash, and creates no account', async () => {
    await signup(base({ email: 'unknown.person@example.org', fullName: 'Unknown Person', requestedRoleCode: 'PAYROLL_OFFICER' }));
    const id = await requestId('unknown.person@example.org');
    const ctx = { params: Promise.resolve({ id: String(id) }) };
    const noReason = await decide(
      makeRequest(`http://localhost/api/admin/access-requests/${id}`, { method: 'PATCH', token: adminToken, body: { action: 'REJECT' } }),
      ctx
    );
    expect(noReason.status).toBe(400);
    const res = await decide(
      makeRequest(`http://localhost/api/admin/access-requests/${id}`, {
        method: 'PATCH', token: adminToken, body: { action: 'REJECT', note: 'Not a Chalar employee' },
      }),
      { params: Promise.resolve({ id: String(id) }) }
    );
    expect(res.status).toBe(200);
    const r = await one<{ status: string; password_hash: string | null }>(sql`SELECT status, password_hash FROM access_requests WHERE id = ${id}`);
    expect(r).toEqual({ status: 'REJECTED', password_hash: null });
    expect(await rows(sql`SELECT id FROM users WHERE email = 'unknown.person@example.org'`)).toHaveLength(0);

    // After a rejection the person may submit a fresh request
    const again = await signup(base({ email: 'unknown.person@example.org', fullName: 'Unknown Person' }));
    expect(again.status).toBe(202);
    const c = await one<{ c: number }>(sql`SELECT count(*)::int AS c FROM access_requests WHERE email = 'unknown.person@example.org'`);
    expect(c.c).toBe(2);
  });
});
