import { describe, it, expect, beforeAll } from 'vitest';
import { freshDb, tokenFor, makeRequest, json, rows, DEMO_PASSWORD, ADMIN_PASSWORD } from './helpers';
import { getSessionUser, hasPermission, defaultDashboardFor } from '@/lib/auth';
import { INITIAL_SYSTEM_ROLES, ALL_PERMISSIONS } from '@/lib/rbac-catalog';
import { POST as postMovement } from '@/app/api/inventory/movements/route';
import { GET as getPayrollRuns } from '@/app/api/payroll/runs/route';
import { GET as getNotifications } from '@/app/api/notifications/route';
import { GET as getSearch } from '@/app/api/search/route';
import { sql } from 'drizzle-orm';

describe('Authorization (RBAC enforced server-side)', () => {
  beforeAll(async () => {
    await freshDb();
  }, 120000);

  it('every catalog permission code is unique and role permissions reference real codes', () => {
    const codes = ALL_PERMISSIONS.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const role of INITIAL_SYSTEM_ROLES) {
      for (const perm of role.permissions) {
        expect(codes, `role ${role.code} references unknown permission ${perm}`).toContain(perm);
      }
    }
  });

  it('resolves the correct permission set per role from the database', async () => {
    const inventoryToken = await tokenFor('inventory@chalarfarms.demo');
    const inventoryUser = await getSessionUser(inventoryToken);
    expect(inventoryUser?.permissions).toContain('inventory.create');
    expect(inventoryUser?.permissions).not.toContain('payroll.approve');
    expect(inventoryUser?.permissions).not.toContain('hr.sensitive');

    const hrToken = await tokenFor('hr@chalarfarms.demo');
    const hrUser = await getSessionUser(hrToken);
    expect(hrUser?.permissions).toContain('hr.manage');
    expect(hrUser?.permissions).not.toContain('inventory.create');

    const adminToken = await tokenFor('superadmin@chalarfarms.demo', ADMIN_PASSWORD);
    const admin = await getSessionUser(adminToken);
    expect(admin?.permissions.length).toBeGreaterThanOrEqual(ALL_PERMISSIONS.length - 2);
    expect(hasPermission(admin, 'users.manage')).toBe(true);
  });

  it('maps each role to its own default dashboard', async () => {
    const cases: Array<[string, string]> = [
      ['superadmin@chalarfarms.demo', '/portal/super-admin'],
      ['farm@chalarfarms.demo', '/portal/farm'],
      ['inventory@chalarfarms.demo', '/portal/inventory'],
      ['hr@chalarfarms.demo', '/portal/hr'],
      ['finance@chalarfarms.demo', '/portal/finance'],
      ['packhouse@chalarfarms.demo', '/portal/packhouse'],
      ['qa@chalarfarms.demo', '/portal/qa'],
      ['procurement@chalarfarms.demo', '/portal/procurement'],
      ['sales@chalarfarms.demo', '/portal/sales'],
      ['logistics@chalarfarms.demo', '/portal/logistics'],
      ['maintenance@chalarfarms.demo', '/portal/maintenance'],
      ['executive@chalarfarms.demo', '/portal/executive'],
      ['employee@chalarfarms.demo', '/portal/workspaces'],
    ];
    for (const [email, expected] of cases) {
      const password = email.startsWith('superadmin') ? ADMIN_PASSWORD : DEMO_PASSWORD;
      const user = await getSessionUser(await tokenFor(email, password));
      expect(user, email).not.toBeNull();
      expect(defaultDashboardFor(user!), email).toBe(expected);
    }
  });

  it('rejects unauthenticated API calls', async () => {
    const res = await postMovement(
      makeRequest('http://localhost/api/inventory/movements', {
        method: 'POST',
        body: { movementType: 'RECEIPT', productId: 1, toWarehouseId: 1, binCode: 'A1', quantity: 1, unitCostKes: 1, reason: 'anon' },
      })
    );
    expect(res.status).toBe(401);
  });

  it('blocks an HR manager from posting stock movements', async () => {
    const token = await tokenFor('hr@chalarfarms.demo');
    const res = await postMovement(
      makeRequest('http://localhost/api/inventory/movements', {
        method: 'POST',
        token,
        body: {
          movementType: 'RECEIPT',
          productId: 1,
          toWarehouseId: 1,
          binCode: 'A1',
          quantity: 10,
          unitCostKes: 100,
          reason: 'HR should not be able to post stock',
        },
      })
    );
    expect(res.status).toBe(403);
    const body = await json(res);
    expect(String(body.error)).toMatch(/permission/i);
  });

  it('blocks a QA officer from reading payroll runs', async () => {
    const token = await tokenFor('qa@chalarfarms.demo');
    const res = await getPayrollRuns(makeRequest('http://localhost/api/payroll/runs', { token }));
    expect(res.status).toBe(403);
  });

  it('allows a payroll officer to read payroll runs but not approve them', async () => {
    const token = await tokenFor('payroll@chalarfarms.demo');
    const res = await getPayrollRuns(makeRequest('http://localhost/api/payroll/runs', { token }));
    expect(res.status).toBe(200);
    const user = await getSessionUser(token);
    expect(user?.permissions).toContain('payroll.manage');
    expect(user?.permissions).not.toContain('payroll.approve');
  });

  it('allows a general employee their own notifications but not enterprise search of others', async () => {
    const token = await tokenFor('employee@chalarfarms.demo');
    const notif = await getNotifications(makeRequest('http://localhost/api/notifications', { token }));
    expect(notif.status).toBe(200);

    const search = await getSearch(
      makeRequest('http://localhost/api/search?q=EMP', { token })
    );
    expect(search.status).toBe(200);
    const body = (await json(search)) as { results: Array<{ subtitle: string }> };
    // An employee must not see other employees' records
    const leaked = body.results.filter((r) => /Employee ·/.test(r.subtitle));
    expect(leaked.length).toBe(0);
  });

  it('gives HR search access to employee records, and inventory search to inventory staff only', async () => {
    const hrToken = await tokenFor('hr@chalarfarms.demo');
    const hrSearch = (await json(
      await getSearch(makeRequest('http://localhost/api/search?q=EMP-', { token: hrToken }))
    )) as { results: Array<{ subtitle: string }> };
    expect(hrSearch.results.some((r) => /Employee ·/.test(r.subtitle))).toBe(true);

    const invToken = await tokenFor('inventory@chalarfarms.demo');
    const invSearch = (await json(
      await getSearch(makeRequest('http://localhost/api/search?q=EMP-', { token: invToken }))
    )) as { results: Array<{ subtitle: string }> };
    expect(invSearch.results.some((r) => /Employee ·/.test(r.subtitle))).toBe(false);
  });

  it('never grants sensitive HR permission to roles outside HR/Finance/Super Admin', async () => {
    const sensitive = await rows<{ code: string }>(sql`
      SELECT r.code FROM roles r
      JOIN role_permissions rp ON rp.role_id = r.id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.code = 'hr.sensitive'
      ORDER BY r.code;
    `);
    const codes = sensitive.map((s) => s.code);
    expect(codes).toContain('SUPER_ADMIN');
    for (const code of codes) {
      expect(['SUPER_ADMIN', 'HR_MANAGER', 'FINANCE_MANAGER', 'PAYROLL_OFFICER', 'EXECUTIVE_MANAGER']).toContain(code);
    }
  });
});
