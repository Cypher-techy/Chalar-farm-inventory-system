import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/lib/server-session';
import { hasPermission } from '@/lib/auth';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { PageHeader, Card, DataTable, StatusBadge, fmtDateTime } from '@/components/portal/ui';
import { UserAdminDesk } from './user-admin-desk';

export const dynamic = 'force-dynamic';

export default async function UsersAdminPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect('/login');
  if (!hasPermission(user, 'users.manage')) redirect('/portal');

  const db = await getDb();
  const usersRes = (await db.execute(sql`
    SELECT u.id, u.email, u.full_name AS "fullName", u.phone, u.status,
           u.primary_role_code AS "primaryRoleCode", u.last_login_at AS "lastLoginAt",
           u.failed_login_attempts AS "failedAttempts", u.locked_until AS "lockedUntil",
           u.created_at AS "createdAt", d.name AS department,
           COALESCE((SELECT string_agg(r.code, ', ' ORDER BY r.code)
              FROM user_roles ur JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = u.id), '') AS roles,
           e.employee_code AS "employeeCode"
    FROM users u
    LEFT JOIN departments d ON d.id = u.department_id
    LEFT JOIN employee_profiles e ON e.user_id = u.id
    ORDER BY u.id;
  `)) as unknown as { rows: Array<Record<string, never>> };

  const rolesRes = (await db.execute(sql`
    SELECT r.code, r.name, r.default_dashboard AS "defaultDashboard",
           (SELECT count(*)::int FROM role_permissions rp WHERE rp.role_id = r.id)::int AS "permissionCount",
           (SELECT count(*)::int FROM user_roles ur WHERE ur.role_id = r.id)::int AS "userCount"
    FROM roles r ORDER BY r.code;
  `)) as unknown as { rows: Array<Record<string, string | number | null>> };

  const departmentsRes = (await db.execute(sql`
    SELECT id, code, name FROM departments ORDER BY name;
  `)) as unknown as { rows: Array<{ id: number; code: string; name: string }> };

  const securityRes = (await db.execute(sql`
    SELECT se.event_type AS "eventType", se.severity, se.description, se.ip_address AS ip,
           se.created_at AS "createdAt", u.email
    FROM security_events se LEFT JOIN users u ON u.id = se.user_id
    ORDER BY se.created_at DESC LIMIT 20;
  `)) as unknown as { rows: Array<Record<string, string | null>> };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: 'Portal', href: '/portal' },
          { label: 'Super Admin', href: '/portal/super-admin' },
          { label: 'Users & Roles' },
        ]}
        title="User & Role Administration"
        subtitle="Create accounts, assign system roles, reset credentials, lock or deactivate users. Every administrative action is written to the audit log and security event register."
        actions={<a href="/api/reports/export?type=audit-log" className="btn-secondary">Audit log CSV</a>}
      />

      <UserAdminDesk
        users={usersRes.rows as unknown as React.ComponentProps<typeof UserAdminDesk>['users']}
        roles={rolesRes.rows as unknown as React.ComponentProps<typeof UserAdminDesk>['roles']}
        departments={departmentsRes.rows}
        isSuperAdmin={user.roleCodes.includes('SUPER_ADMIN')}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="System roles (permission bundles)">
          <DataTable
            headers={['Code', 'Role', 'Default dashboard', 'Permissions', 'Assigned users']}
            rows={rolesRes.rows.map((r) => [
              <span key="c" className="font-mono text-[10px] text-chalar-700">{String(r.code)}</span>,
              <span key="n" className="text-xs">{String(r.name)}</span>,
              <span key="d" className="font-mono text-[10px] text-stone-500">{String(r.defaultDashboard)}</span>,
              <span key="p" className="tabular-nums text-xs">{r.permissionCount}</span>,
              <span key="u" className="tabular-nums text-xs">{r.userCount}</span>,
            ])}
          />
        </Card>

        <Card title="Recent security events">
          <DataTable
            headers={['When', 'Account', 'Event', 'Severity', 'Detail', 'IP']}
            emptyMessage="No security events recorded."
            rows={securityRes.rows.map((s) => [
              <span key="t" className="whitespace-nowrap text-[10px] text-stone-400">{fmtDateTime(String(s.createdAt))}</span>,
              <span key="e" className="text-[10px]">{String(s.email ?? 'unknown')}</span>,
              <span key="ev" className="text-[10px] font-semibold text-chalar-700">{String(s.eventType).replace(/_/g, ' ')}</span>,
              <span key="sv"><StatusBadge status={String(s.severity)} /></span>,
              <span key="d" className="max-w-[260px] truncate text-[10px] text-stone-500" title={String(s.description)}>{String(s.description)}</span>,
              <span key="ip" className="font-mono text-[10px] text-stone-400">{String(s.ip ?? '—')}</span>,
            ])}
          />
        </Card>
      </div>
    </div>
  );
}
