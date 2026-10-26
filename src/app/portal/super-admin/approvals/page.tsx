import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { getSessionFromCookies } from '@/lib/server-session';
import { hasPermission } from '@/lib/auth';
import { many } from '@/lib/ops-queries';
import { PageHeader, Card, DataTable, StatusBadge, KPICard, fmtKes, fmtDateTime } from '@/components/portal/ui';
import { ApprovalButtons } from '../../hr/leave-desk';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect('/login');
  if (!hasPermission(user, 'dashboard.super_admin') && !hasPermission(user, 'workspace.auditor')) {
    redirect('/portal');
  }

  const [queue, decided, totals] = await Promise.all([
    many<Record<string, string | number | null>>(sql`
      SELECT ar.request_code AS code, ar.module, ar.entity_type AS "entityType", ar.title,
             ar.amount_kes AS amount, ar.assigned_role_code AS "assignedRole", ar.status,
             ar.submitted_at AS "submittedAt", u.full_name AS submitter, u.email AS "submitterEmail",
             du.full_name AS "decidedBy", ar.decision_comments AS comments, ar.decided_at AS "decidedAt",
             (ar.submitted_by_user_id = ar.decided_by_user_id) AS "selfApproved"
      FROM approval_requests ar
      JOIN users u ON u.id = ar.submitted_by_user_id
      LEFT JOIN users du ON du.id = ar.decided_by_user_id
      WHERE ar.status = 'PENDING'
      ORDER BY ar.amount_kes DESC NULLS LAST, ar.submitted_at
      LIMIT 60;
    `),
    many<Record<string, string | number | boolean | null>>(sql`
      SELECT ar.request_code AS code, ar.module, ar.title, ar.amount_kes AS amount, ar.status,
             ar.submitted_at AS "submittedAt", u.full_name AS submitter,
             du.full_name AS "decidedBy", ar.decision_comments AS comments, ar.decided_at AS "decidedAt",
             (ar.submitted_by_user_id = ar.decided_by_user_id) AS "selfApproved"
      FROM approval_requests ar
      JOIN users u ON u.id = ar.submitted_by_user_id
      LEFT JOIN users du ON du.id = ar.decided_by_user_id
      WHERE ar.status != 'PENDING'
      ORDER BY ar.decided_at DESC NULLS LAST
      LIMIT 40;
    `),
    many<{ pending: number; pending_value: string; decided_30d: number; self_approved: number }>(sql`
      SELECT
        (SELECT count(*)::int FROM approval_requests WHERE status = 'PENDING')::int AS pending,
        (SELECT COALESCE(SUM(amount_kes),0) FROM approval_requests WHERE status = 'PENDING')::text AS pending_value,
        (SELECT count(*)::int FROM approval_requests WHERE decided_at > now() - interval '30 days')::int AS decided_30d,
        (SELECT count(*)::int FROM approval_requests WHERE submitted_by_user_id = decided_by_user_id AND decided_by_user_id IS NOT NULL)::int AS self_approved;
    `),
  ]);
  const t = totals[0];

  const canDecide = (assignedRole: string) => user.roleCodes.includes(String(assignedRole));

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: 'Portal', href: '/portal' },
          { label: 'Super Admin', href: '/portal/super-admin' },
          { label: 'Approvals' },
        ]}
        title="Approval Queue & Segregation of Duties"
        subtitle="Every approval is routed to a role, and the submitter can never decide their own request. Decisions cascade to the underlying requisition, expense, stock adjustment, leave request or payroll run."
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Pending Decisions" value={t?.pending ?? 0} sub={fmtKes(t?.pending_value)} tone={(t?.pending ?? 0) > 0 ? 'warning' : 'success'} delayIndex={0} />
        <KPICard label="Decided (30 days)" value={t?.decided_30d ?? 0} delayIndex={1} />
        <KPICard
          label="Self-Approved Records"
          value={t?.self_approved ?? 0}
          sub="Must remain zero — segregation of duties control"
          tone={(t?.self_approved ?? 0) === 0 ? 'success' : 'danger'}
          delayIndex={2}
        />
        <KPICard label="Your Decidable Roles" value={user.roleCodes.length} sub={user.roleCodes.join(', ')} delayIndex={3} />
      </div>

      <Card title="Pending queue">
        <DataTable
          headers={['Request', 'Module', 'Title', 'Amount', 'Submitted by', 'Awaiting role', 'Submitted', 'Decision']}
          emptyMessage="No pending approvals — the queue is clear."
          rows={queue.map((a) => [
            <span key="c" className="font-mono text-[10px] text-chalar-700">{String(a.code)}</span>,
            <span key="m"><StatusBadge status={String(a.module)} tone="info" /></span>,
            <span key="t" className="text-xs">
              {String(a.title)}
              <span className="block text-[10px] text-stone-400">{String(a.entityType).replace(/_/g, ' ').toLowerCase()}</span>
            </span>,
            <span key="a" className="tabular-nums text-xs">{Number(a.amount ?? 0) > 0 ? fmtKes(Number(a.amount ?? 0)) : '—'}</span>,
            <span key="s" className="text-[10px] text-stone-500">{String(a.submitter)}<span className="block text-stone-400">{String(a.submitterEmail)}</span></span>,
            <span key="r" className="text-[10px]">{String(a.assignedRole).replace(/_/g, ' ')}</span>,
            <span key="at" className="whitespace-nowrap text-[10px] text-stone-400">{fmtDateTime(String(a.submittedAt))}</span>,
            <span key="d">
              {canDecide(String(a.assignedRole ?? '')) ? (
                <ApprovalButtons code={String(a.code)} />
              ) : (
                <span className="text-[10px] text-stone-400">not your role</span>
              )}
            </span>,
          ])}
        />
      </Card>

      <div className="mt-4">
        <Card title="Recent decisions">
          <DataTable
            headers={['Request', 'Module', 'Title', 'Amount', 'Submitted by', 'Decided by', 'Decision', 'Comments', 'SoD check']}
            emptyMessage="No decisions recorded yet."
            rows={decided.map((a) => [
              <span key="c" className="font-mono text-[10px] text-chalar-700">{String(a.code)}</span>,
              <span key="m"><StatusBadge status={String(a.module)} tone="neutral" /></span>,
              <span key="t" className="max-w-[280px] truncate text-xs" title={String(a.title)}>{String(a.title)}</span>,
              <span key="a" className="tabular-nums text-xs">{Number(a.amount ?? 0) > 0 ? fmtKes(Number(a.amount ?? 0)) : '—'}</span>,
              <span key="s" className="text-[10px] text-stone-500">{String(a.submitter)}</span>,
              <span key="d" className="text-[10px] text-stone-500">{String(a.decidedBy ?? '—')}</span>,
              <span key="st"><StatusBadge status={String(a.status)} /></span>,
              <span key="cm" className="max-w-[200px] truncate text-[10px] text-stone-500" title={String(a.comments ?? '')}>{String(a.comments ?? '—')}</span>,
              <span key="sod">
                {a.selfApproved ? (
                  <StatusBadge status="SELF_APPROVED" tone="danger" />
                ) : (
                  <StatusBadge status="SEGREGATED" tone="success" />
                )}
              </span>,
            ])}
          />
        </Card>
      </div>
    </div>
  );
}
