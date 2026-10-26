import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { getSessionFromCookies } from '@/lib/server-session';
import { hasPermission } from '@/lib/auth';
import { myWorkspace, teamWorkspace, auditTrail, auditModules, many } from '@/lib/ops-queries';
import { KPICard, PageHeader, Card, DataTable, StatusBadge, fmtKes, fmtNum, fmtDate, fmtDateTime } from '@/components/portal/ui';
import { SimpleBarChart, DonutChart } from '@/components/portal/charts';
import LeaveDesk, { ApprovalButtons } from '../hr/leave-desk';

export const dynamic = 'force-dynamic';

export default async function WorkspacesDashboard() {
  const user = await getSessionFromCookies();
  if (!user) redirect('/login');

  const selfService = hasPermission(user, 'workspace.self_service');
  const supervisor = hasPermission(user, 'workspace.supervisor');
  const auditor = hasPermission(user, 'workspace.auditor');
  if (!selfService && !supervisor && !auditor) redirect('/portal');

  const ws = selfService ? await myWorkspace(user.id) : null;
  const team = supervisor ? await teamWorkspace(user.id) : [];
  const [trail, modules, leaveTypes] = auditor || supervisor || selfService
    ? await Promise.all([
        auditor ? auditTrail(40) : Promise.resolve([]),
        auditor ? auditModules() : Promise.resolve([]),
        (async () => {
          return many<{ code: string; name: string; statutoryBasis: string }>(sql`
            SELECT code, name, statutory_basis AS "statutoryBasis" FROM leave_types ORDER BY id;
          `);
        })(),
      ])
    : [[], [], []];

  const profile = ws?.profile ?? null;
  const myLeave = ws?.leave ?? [];
  const pendingLeave = myLeave.filter((l) => String(l.status) === 'PENDING').length;
  const myAttendance = ws?.attendance ?? [];
  const presentDays = myAttendance.filter((a) => ['PRESENT', 'LATE'].includes(String(a.status))).length;
  const myPayslips = ws?.payslips ?? [];
  const latestPayslip = myPayslips[0];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: 'Portal', href: '/portal' }, { label: 'My Workspace' }]}
        title={supervisor ? 'Supervisor Workspace' : auditor ? 'Audit & Compliance Workspace' : 'My Workspace'}
        subtitle={
          supervisor
            ? 'Your team: attendance, pending leave and overtime decisions, and escalation into private messaging.'
            : auditor
              ? 'Read-only enterprise audit trail. Sensitive personal fields are excluded; every export is itself logged.'
              : 'Your employee record, leave entitlements, attendance, payslips and pending approvals — self-service without leaving the portal.'
        }
        actions={
          <>
            <Link href="/portal/communications" className="btn-primary">Private messages</Link>
            {auditor && <a href="/api/reports/export?type=audit-log" className="btn-secondary">Audit log CSV</a>}
          </>
        }
      />

      {selfService && (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <KPICard
              label="Employee Record"
              value={profile ? String(profile.employeeCode) : 'Not linked'}
              sub={profile ? `${profile.jobTitle} · ${profile.department}` : 'Ask HR to link your user account to an employee profile.'}
              delayIndex={0}
            />
            <KPICard
              label="Attendance (14 days)"
              value={`${presentDays}/${myAttendance.length}`}
              sub="Days present including late arrivals"
              tone={myAttendance.length > 0 && presentDays / myAttendance.length >= 0.9 ? 'success' : 'warning'}
              delayIndex={1}
            />
            <KPICard
              label="Leave Pending"
              value={pendingLeave}
              sub={`${myLeave.length} requests on record`}
              tone={pendingLeave > 0 ? 'warning' : 'neutral'}
              delayIndex={2}
            />
            <KPICard
              label="Latest Net Pay"
              value={latestPayslip ? fmtKes(latestPayslip.net) : '—'}
              sub={latestPayslip ? `Period ${latestPayslip.period} · ${latestPayslip.paymentStatus}` : 'No payslip yet'}
              tone="info"
              delayIndex={3}
            />
            <KPICard
              label="Employment"
              value={profile ? String(profile.employmentType) : '—'}
              sub={profile ? `Status ${profile.employmentStatus} · hired ${fmtDate(String(profile.hireDate))}` : ''}
              delayIndex={4}
            />
          </div>

          <div className="mb-4">
            <LeaveDesk leaveTypes={leaveTypes} canSubmitForOthers={false} employeeId={ws?.employeeId ?? null} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="My leave entitlements (current year)">
              <DataTable
                headers={['Leave type', 'Entitled', 'Used', 'Pending', 'Remaining', 'Statutory basis']}
                emptyMessage="No leave balances initialised for this year."
                rows={(ws?.balances ?? []).map((b) => [
                  <span key="n" className="text-xs font-medium">{String(b.leaveType)}</span>,
                  <span key="e" className="tabular-nums text-xs">{fmtNum(b.entitled, 1)}</span>,
                  <span key="u" className="tabular-nums text-xs">{fmtNum(b.used, 1)}</span>,
                  <span key="p" className="tabular-nums text-xs">{fmtNum(b.pending, 1)}</span>,
                  <span key="r" className="tabular-nums text-xs font-semibold">{fmtNum(b.remaining, 1)}</span>,
                  <span key="b" className="max-w-[280px] text-[10px] leading-relaxed text-stone-500">{String(b.basis)}</span>,
                ])}
              />
            </Card>

            <Card title="My leave requests">
              <DataTable
                headers={['Request', 'Type', 'Period', 'Days', 'Status', 'Reviewer comment']}
                emptyMessage="You have not submitted any leave requests."
                rows={myLeave.map((l) => [
                  <span key="n" className="font-mono text-[10px] text-chalar-700">{String(l.requestNumber)}</span>,
                  <span key="t" className="text-xs">{String(l.leaveType)}</span>,
                  <span key="p" className="whitespace-nowrap text-[10px]">{fmtDate(String(l.startDate))} → {fmtDate(String(l.endDate))}</span>,
                  <span key="d" className="tabular-nums text-xs">{fmtNum(l.totalDays, 1)}</span>,
                  <span key="s"><StatusBadge status={String(l.status)} /></span>,
                  <span key="c" className="max-w-[200px] truncate text-[10px] text-stone-500" title={String(l.reviewComments ?? '')}>{String(l.reviewComments ?? '—')}</span>,
                ])}
              />
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card title="My attendance (last 14 records)">
              <DataTable
                headers={['Date', 'Clock in', 'Clock out', 'Regular h', 'OT h', 'Late min', 'Status', 'Approved']}
                emptyMessage="No attendance recorded."
                rows={myAttendance.map((a) => [
                  <span key="d" className="text-[10px]">{fmtDate(String(a.date))}</span>,
                  <span key="i" className="font-mono text-[10px]">{String(a.clockIn ?? '—')}</span>,
                  <span key="o" className="font-mono text-[10px]">{String(a.clockOut ?? '—')}</span>,
                  <span key="r" className="tabular-nums text-[10px]">{fmtNum(a.regular, 2)}</span>,
                  <span key="ot" className="tabular-nums text-[10px]">{fmtNum(a.overtime, 2)}</span>,
                  <span key="l" className="tabular-nums text-[10px]">{a.late}</span>,
                  <span key="s"><StatusBadge status={String(a.status)} /></span>,
                  <span key="ap"><StatusBadge status={a.approved ? 'APPROVED' : 'PENDING'} tone={a.approved ? 'success' : 'warning'} /></span>,
                ])}
              />
            </Card>

            <Card title="My payslips" className="lg:col-span-2">
              <DataTable
                headers={['Payslip', 'Period', 'Pay date', 'Basic', 'OT', 'Gross', 'PAYE', 'NSSF', 'SHIF', 'Housing', 'Net', 'Status', 'PDF']}
                emptyMessage="No payslips issued yet."
                rows={myPayslips.map((p) => [
                  <span key="n" className="font-mono text-[10px] text-chalar-700">{String(p.payslipNumber)}</span>,
                  <span key="pe" className="text-[10px]">{String(p.period)}</span>,
                  <span key="pd" className="text-[10px]">{fmtDate(String(p.payDate))}</span>,
                  <span key="b" className="tabular-nums text-[10px]">{fmtNum(p.basic, 0)}</span>,
                  <span key="o" className="tabular-nums text-[10px]">{fmtNum(p.overtime, 0)}</span>,
                  <span key="g" className="tabular-nums text-[10px]">{fmtNum(p.gross, 0)}</span>,
                  <span key="py" className="tabular-nums text-[10px]">{fmtNum(p.paye, 0)}</span>,
                  <span key="ns" className="tabular-nums text-[10px]">{fmtNum(p.nssf, 0)}</span>,
                  <span key="sh" className="tabular-nums text-[10px]">{fmtNum(p.shif, 0)}</span>,
                  <span key="ho" className="tabular-nums text-[10px]">{fmtNum(p.housing, 0)}</span>,
                  <span key="ne" className="tabular-nums text-[10px] font-semibold">{fmtNum(p.net, 0)}</span>,
                  <span key="s"><StatusBadge status={String(p.paymentStatus)} /></span>,
                  <span key="pdf">
                    <a
                      className="text-[10px] font-semibold text-chalar-700 hover:underline"
                      href={`/api/payroll/payslips/${encodeURIComponent(String(p.payslipNumber))}/pdf`}
                    >
                      Download
                    </a>
                  </span>,
                ])}
              />
              <p className="border-t border-stone-100 px-4 py-2 text-[10px] text-stone-400">
                Payslips are visible only to the employee concerned and to holders of the payroll/HR
                sensitive permission. Each download is written to the audit log.
              </p>
            </Card>
          </div>
        </>
      )}

      {supervisor && (
        <div className="mt-4">
          <Card
            title={`My team (${team.length} direct report${team.length === 1 ? '' : 's'})`}
            action={<span className="text-[11px] text-stone-400">Leave and overtime decisions route to you as the assigned supervisor.</span>}
          >
            <DataTable
              headers={['Employee', 'Code', 'Job title', 'Today', 'Pending leave', 'Pending OT', 'Status']}
              emptyMessage="No employees report to your user account."
              rows={team.map((m) => [
                <span key="n" className="text-sm">{String(m.fullName)}</span>,
                <span key="c" className="font-mono text-[10px] text-stone-400">{String(m.employeeCode)}</span>,
                <span key="j" className="text-xs text-stone-600">{String(m.jobTitle)}</span>,
                <span key="t"><StatusBadge status={String(m.todayStatus ?? 'NO_RECORD')} /></span>,
                <span key="l" className="tabular-nums text-xs">{m.pendingLeave}</span>,
                <span key="o" className="tabular-nums text-xs">{m.pendingOvertime}</span>,
                <span key="s"><StatusBadge status={String(m.employmentStatus)} /></span>,
              ])}
            />
          </Card>

          <div className="mt-4">
            <Card title="Approvals routed to supervisors">
              <SupervisorApprovalQueue roleCodes={user.roleCodes} />
            </Card>
          </div>
        </div>
      )}

      {auditor && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card title="Audit events by module">
            <div className="p-4">
              <DonutChart data={modules.map((m) => ({ name: m.name, value: m.value }))} height={240} />
            </div>
          </Card>
          <Card title="Recent audit trail (read-only)" className="lg:col-span-2">
            <DataTable
              headers={['When', 'Actor', 'Module', 'Action', 'Entity', 'Summary', 'IP']}
              emptyMessage="No audit events."
              rows={trail.map((a) => [
                <span key="t" className="whitespace-nowrap text-[10px] text-stone-400">{fmtDateTime(String(a.createdAt))}</span>,
                <span key="ac" className="text-[10px]">{String(a.actor).split('@')[0]}</span>,
                <span key="m"><StatusBadge status={String(a.module)} tone="neutral" /></span>,
                <span key="act" className="text-[10px] font-semibold text-chalar-700">{String(a.action).replace(/_/g, ' ')}</span>,
                <span key="e" className="font-mono text-[10px] text-stone-500">{String(a.entityType)}{a.entityId ? ` #${a.entityId}` : ''}</span>,
                <span key="s" className="max-w-[380px] truncate text-[11px] text-stone-600" title={String(a.summary)}>{String(a.summary)}</span>,
                <span key="ip" className="font-mono text-[10px] text-stone-400">{String(a.ip)}</span>,
              ])}
            />
          </Card>
        </div>
      )}
    </div>
  );
}

async function SupervisorApprovalQueue({ roleCodes }: { roleCodes: string[] }) {
  if (roleCodes.length === 0) {
    return <DataTable headers={['Request']} rows={[]} emptyMessage="No roles assigned." />;
  }
  const roleList = sql.join(
    roleCodes.map((r) => sql`${r}`),
    sql`, `
  );
  const rows = await many<Record<string, string | null>>(sql`
    SELECT ar.request_code AS code, ar.module, ar.title, ar.amount_kes AS amount,
           ar.assigned_role_code AS role, ar.submitted_at AS submitted, u.full_name AS submitter
    FROM approval_requests ar
    JOIN users u ON u.id = ar.submitted_by_user_id
    WHERE ar.status = 'PENDING' AND ar.assigned_role_code IN (${roleList})
    ORDER BY ar.submitted_at
    LIMIT 12;
  `);

  return (
    <DataTable
      headers={['Request', 'Module', 'Title', 'Amount', 'Submitted by', 'Decision']}
      emptyMessage="Nothing is awaiting your decision."
      rows={rows.map((r) => [
        <span key="c" className="font-mono text-[10px] text-chalar-700">{String(r.code)}</span>,
        <span key="m"><StatusBadge status={String(r.module)} tone="info" /></span>,
        <span key="t" className="text-xs">{String(r.title)}</span>,
        <span key="a" className="tabular-nums text-xs">{Number(r.amount) > 0 ? fmtKes(r.amount) : '—'}</span>,
        <span key="s" className="text-[10px] text-stone-500">{String(r.submitter)} · {fmtDate(String(r.submitted))}</span>,
        <span key="d"><ApprovalButtons code={String(r.code)} /></span>,
      ])}
    />
  );
}

void SimpleBarChart;
