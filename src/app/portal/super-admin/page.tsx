import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/lib/server-session';
import { hasPermission } from '@/lib/auth';
import {
  superAdminKpis,
  recentActivity,
  departmentBudgetSnapshot,
} from '@/lib/dashboard-queries';
import { KPICard, PageHeader, Card, DataTable, StatusBadge, fmtKes, fmtNum, fmtDateTime } from '@/components/portal/ui';
import { SimpleBarChart } from '@/components/portal/charts';

export const dynamic = 'force-dynamic';

export default async function SuperAdminDashboard() {
  const user = await getSessionFromCookies();
  if (!user) redirect('/login');
  if (!hasPermission(user, 'dashboard.super_admin')) {
    redirect('/portal/workspaces');
  }

  const [kpis, activity, budgets] = await Promise.all([
    superAdminKpis(),
    recentActivity(14),
    departmentBudgetSnapshot(),
  ]);

  const budgetData = budgets.slice(0, 8).map((b) => ({
    name: b.name.split(' ')[0],
    budget: Number(b.budget),
    spent: Number(b.spent),
  }));

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: 'Portal', href: '/portal' }, { label: 'Super Administrator' }]}
        title="Super Administrator Dashboard"
        subtitle="Enterprise-wide operational overview · figures computed live from database records"
        actions={
          <>
            <Link href="/portal/super-admin/users" className="btn-secondary">Manage Users</Link>
            <Link href="/portal/super-admin/audit" className="btn-secondary">Audit Logs</Link>
            <Link href="/portal/communications" className="btn-primary">Private Messages</Link>
          </>
        }
      />

      {/* People & workforce */}
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-stone-400">Workforce</p>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard label="Registered Employees" value={kpis.people.total} sub={`${kpis.people.active} active · ${kpis.people.inactive} inactive/leave`} delayIndex={0} href="/portal/hr" />
        <KPICard label="Present Today" value={kpis.people.attendance_today} sub={`${kpis.people.on_leave} on leave`} tone="success" delayIndex={1} href="/portal/hr" />
        <KPICard label="Pending Leave Requests" value={kpis.approvals.leave_pending} tone={kpis.approvals.leave_pending > 0 ? 'warning' : 'neutral'} delayIndex={2} href="/portal/hr" />
        <KPICard label="Total Conversations" value={kpis.comms.conversations} sub="Private, dashboard & group threads" delayIndex={3} href="/portal/communications" />
        <KPICard label="Unread Notifications" value={kpis.comms.unread} tone={kpis.comms.unread > 0 ? 'info' : 'neutral'} delayIndex={4} />
      </div>

      {/* Inventory & operations */}
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-stone-400">Inventory &amp; Operations</p>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard label="Inventory Valuation" value={fmtKes(kpis.inventory.valuation)} sub={`${kpis.inventory.lots} active lots`} delayIndex={0} href="/portal/inventory" />
        <KPICard label="Low / Out of Stock" value={`${kpis.inventory.low_stock} / ${kpis.inventory.out_of_stock}`} tone="warning" delayIndex={1} href="/portal/inventory" />
        <KPICard label="Today's Harvest" value={`${fmtNum(kpis.ops.today_harvest)} kg`} delayIndex={2} href="/portal/farm" />
        <KPICard label="Packed (7 days)" value={`${fmtNum(kpis.ops.week_packed)} kg`} delayIndex={3} href="/portal/packhouse" />
        <KPICard label="Open Quality Issues" value={kpis.ops.open_ncr} tone={kpis.ops.open_ncr > 0 ? 'danger' : 'success'} delayIndex={4} href="/portal/qa" />
      </div>

      {/* Approvals & finance */}
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-stone-400">Approvals &amp; Finance</p>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard label="Pending Approvals" value={kpis.approvals.pending} sub={fmtKes(kpis.approvals.pending_amount)} tone="warning" delayIndex={0} href="/portal/super-admin/approvals" />
        <KPICard label="Pending POs" value={kpis.ops.open_pos} delayIndex={1} href="/portal/procurement" />
        <KPICard label="Overdue Supplier Invoices" value={kpis.ops.overdue_invoices} tone={kpis.ops.overdue_invoices > 0 ? 'danger' : 'success'} delayIndex={2} href="/portal/finance" />
        <KPICard label="Open Sales Orders" value={kpis.ops.open_orders} delayIndex={3} href="/portal/sales" />
        <KPICard label="Maintenance Work Orders" value={kpis.ops.open_wos} tone={kpis.ops.open_wos > 3 ? 'warning' : 'neutral'} delayIndex={4} href="/portal/maintenance" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Department Budget vs Actual Spend (FY approved expenses)">
          <div className="p-4">
            <SimpleBarChart
              data={budgetData.flatMap((b) => [
                { name: `${b.name} · Budget`, value: b.budget },
                { name: `${b.name} · Spent`, value: b.spent },
              ])}
              height={280}
            />
          </div>
        </Card>

        <Card title="Recent System Activity (audit trail)">
          <DataTable
            headers={['When', 'Actor', 'Action', 'Summary']}
            caption="Recent audit log entries"
            rows={activity.map((a) => [
              <span key="t" className="whitespace-nowrap text-xs text-stone-500">{fmtDateTime(a.createdAt)}</span>,
              <span key="a" className="text-xs text-stone-600">{String(a.actorEmail).split('@')[0]}</span>,
              <span key="ac" className="text-xs font-semibold text-chalar-700">{String(a.action).replace(/_/g, ' ')}</span>,
              <span key="s" className="line-clamp-2 text-xs text-stone-600">{a.summary}</span>,
            ])}
          />
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Pending Approval Queue (role-routed)">
          <PendingApprovalsTable />
        </Card>
      </div>
    </div>
  );
}

async function PendingApprovalsTable() {
  const { getDb } = await import('@/db');
  const t = await import('@/db/schema');
  const { sql } = await import('drizzle-orm');
  const db = await getDb();
  const res = (await db.execute(sql`
    SELECT request_code AS "requestCode", module, title, amount_kes AS "amountKes",
           assigned_role_code AS "assignedRoleCode", submitted_at AS "submittedAt"
    FROM approval_requests
    WHERE status = 'PENDING'
    ORDER BY submitted_at
    LIMIT 10;
  `)) as unknown as { rows: Array<Record<string, string>> };
  void t;

  return (
    <DataTable
      headers={['Request', 'Module', 'Title', 'Amount', 'Awaiting Role']}
      emptyMessage="No pending approvals — the queue is clear."
      rows={res.rows.map((r) => [
        <span key="c" className="font-mono text-xs text-chalar-700">{r.requestCode}</span>,
        <span key="m" className="text-xs"><StatusBadge status={r.module} tone="info" /></span>,
        <span key="t" className="text-sm text-stone-700">{r.title}</span>,
        <span key="a" className="text-sm tabular-nums">{Number(r.amountKes) > 0 ? fmtKes(r.amountKes) : '—'}</span>,
        <span key="r" className="text-xs text-stone-500">{String(r.assignedRoleCode).replace(/_/g, ' ')}</span>,
      ])}
    />
  );
}
