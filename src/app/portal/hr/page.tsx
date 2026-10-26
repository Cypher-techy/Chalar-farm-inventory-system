import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/lib/server-session';
import { hasPermission } from '@/lib/auth';
import {
  hrKpis,
  headcountByDepartment,
  attendanceTrend,
  leaveQueue,
  leaveTypesWithBalances,
  recruitmentFunnel,
  vacancies,
  trainingCompliance,
  overtimeQueue,
  departmentsList,
} from '@/lib/hr-queries';
import { KPICard, PageHeader, Card, DataTable, StatusBadge, fmtKes, fmtNum, fmtDate } from '@/components/portal/ui';
import { DonutChart, StackedBarChart, SimpleBarChart } from '@/components/portal/charts';
import LeaveDesk, { ApprovalButtons } from './leave-desk';

export const dynamic = 'force-dynamic';

export default async function HrDashboard() {
  const user = await getSessionFromCookies();
  if (!user) redirect('/login');
  if (!hasPermission(user, 'dashboard.hr')) redirect('/portal/workspaces');

  const sensitive = hasPermission(user, 'hr.sensitive');
  const canDecide = hasPermission(user, 'hr.approve') || hasPermission(user, 'workspace.supervisor');

  const [k, byDept, attendance, leave, leaveTypes, funnel, vacs, training, overtime, departments] =
    await Promise.all([
      hrKpis(),
      headcountByDepartment(),
      attendanceTrend(14),
      leaveQueue(20),
      leaveTypesWithBalances(),
      recruitmentFunnel(),
      vacancies(10),
      trainingCompliance(12),
      overtimeQueue(12),
      departmentsList(),
    ]);

  const femalePct = k.active > 0 ? Math.round((k.female / k.active) * 100) : 0;
  const youthPct = k.active > 0 ? Math.round((k.youth / k.active) * 100) : 0;

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: 'Portal', href: '/portal' }, { label: 'Human Resources' }]}
        title="Human Resources"
        subtitle="Workforce, attendance, statutory leave under the Employment Act 2007, overtime, recruitment and training compliance."
        actions={
          <>
            <LeaveDesk
              leaveTypes={leaveTypes.map((lt) => ({
                code: lt.code,
                name: lt.name,
                statutoryBasis: lt.statutoryBasis,
              }))}
              canSubmitForOthers={hasPermission(user, 'hr.manage')}
              employeeId={null}
            />
            <a href="/api/reports/export?type=employees" className="btn-secondary">Export CSV</a>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard
          label="Active Employees"
          value={k.active}
          sub={`${k.total_employees} on record · ${k.on_leave} on leave · ${k.suspended} suspended`}
          delayIndex={0}
        />
        <KPICard
          label="Attendance Today"
          value={`${fmtNum(k.attendance_rate_today, 1)} %`}
          sub={`${k.present_today} present · ${k.late_today} late · ${k.absent_today} absent`}
          tone={Number(k.attendance_rate_today) >= 85 ? 'success' : Number(k.attendance_rate_today) >= 60 ? 'warning' : 'danger'}
          delayIndex={1}
        />
        <KPICard
          label="Leave Awaiting Decision"
          value={k.pending_leave}
          sub={`${k.approved_leave_30d} approved in 30 days`}
          tone={k.pending_leave > 0 ? 'warning' : 'success'}
          delayIndex={2}
        />
        <KPICard
          label="Overtime (approved, 30d)"
          value={`${fmtNum(k.approved_overtime_hours_30d)} h`}
          sub={`${k.pending_overtime} requests pending`}
          delayIndex={3}
        />
        <KPICard
          label="Monthly Payroll Base"
          value={fmtKes(k.monthly_payroll_cost)}
          sub="Basic pay of active staff"
          tone={sensitive ? 'info' : 'neutral'}
          delayIndex={4}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Headcount by department">
          <div className="p-4">
            <DonutChart data={byDept.map((d) => ({ name: d.name, value: d.value }))} height={260} />
          </div>
        </Card>
        <Card title="Attendance — last 14 days" className="lg:col-span-2">
          <div className="p-4">
            <StackedBarChart
              data={attendance.map((a) => ({ name: a.name, present: a.present, late: a.late, absent: a.absent }))}
              keys={['present', 'late', 'absent']}
              height={260}
            />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Workforce composition">
          <div className="space-y-3 p-4">
            {[
              { label: 'Female staff (active)', pct: femalePct, count: k.female },
              { label: 'Youth ≤ 35 years (active)', pct: youthPct, count: k.youth },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex items-center justify-between text-xs text-stone-600">
                  <span>{m.label}</span>
                  <span className="font-semibold tabular-nums">{m.count} · {m.pct}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-chalar-600 transition-all duration-700" style={{ width: `${Math.min(100, m.pct)}%` }} />
                </div>
              </div>
            ))}
            <div className="border-t border-stone-100 pt-3 text-xs text-stone-500">
              <p className="font-semibold text-stone-600">Employment types (active)</p>
              <ul className="mt-1 space-y-0.5">
                <li>Permanent: {k.permanent}</li>
                <li>Contract: {k.contract}</li>
                <li>Seasonal: {k.seasonal}</li>
                <li>Casual: {k.casual}</li>
              </ul>
            </div>
          </div>
        </Card>

        <Card title="Statutory leave types & configuration">
          <DataTable
            headers={['Leave type', 'Days', 'Paid', 'Statutory basis']}
            rows={leaveTypes.map((lt) => [
              <span key="n" className="text-sm font-medium">{lt.name}</span>,
              <span key="d" className="tabular-nums">{lt.defaultAnnualDays}</span>,
              <span key="p"><StatusBadge status={lt.isPaid ? 'PAID' : 'UNPAID'} tone={lt.isPaid ? 'success' : 'neutral'} /></span>,
              <span key="b" className="max-w-[320px] text-[11px] leading-relaxed text-stone-500">{lt.statutoryBasis}</span>,
            ])}
          />
        </Card>

        <Card title="Training compliance">
          <DataTable
            headers={['Employee', 'Programme', 'Trainer', 'Date', 'Expiry', 'Status']}
            emptyMessage="No training records."
            rows={training.map((tr) => [
              <span key="e" className="text-xs">{tr.employee}</span>,
              <span key="c" className="text-xs">{tr.course}</span>,
              <span key="t" className="text-[11px] text-stone-500">{tr.trainer}</span>,
              <span key="d" className="text-[11px]">{fmtDate(tr.trainingDate)}</span>,
              <span key="x" className="text-[11px]">{tr.expiryDate ? fmtDate(tr.expiryDate) : '—'}</span>,
              <span key="s"><StatusBadge status={tr.status} /></span>,
            ])}
          />
        </Card>
      </div>

      <div className="mt-4">
        <Card
          title="Leave queue"
          action={
            <span className="text-[11px] text-stone-400">
              {canDecide
                ? 'Decisions are recorded with segregation of duties — you cannot approve your own submission.'
                : 'Read-only: you do not hold the leave approval permission.'}
            </span>
          }
        >
          <DataTable
            headers={['Request', 'Employee', 'Department', 'Type', 'Period', 'Days', 'Balance left', 'Status', canDecide ? 'Decision' : 'Reason']}
            emptyMessage="No leave requests recorded."
            rows={leave.map((l) => [
              <span key="r" className="font-mono text-xs text-chalar-700">{l.requestNumber}</span>,
              <span key="e" className="text-sm">
                {l.employee}
                <span className="block text-[10px] text-stone-400">{l.employeeCode}</span>
              </span>,
              <span key="d" className="text-xs text-stone-500">{l.department}</span>,
              <span key="t" className="text-xs">{l.leaveType}</span>,
              <span key="p" className="whitespace-nowrap text-xs">{fmtDate(l.startDate)} → {fmtDate(l.endDate)}</span>,
              <span key="dy" className="tabular-nums">{fmtNum(l.totalDays, 1)}</span>,
              <span key="b" className="tabular-nums text-xs">{l.remainingDays ?? '—'}</span>,
              <span key="s"><StatusBadge status={l.status} /></span>,
              canDecide && l.status === 'PENDING' && l.approvalCode ? (
                <ApprovalButtons key="a" code={l.approvalCode} />
              ) : (
                <span key="rs" className="max-w-[220px] truncate text-xs text-stone-500" title={l.reason}>{l.reason}</span>
              ),
            ])}
          />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Overtime queue">
          <DataTable
            headers={['Employee', 'Date', 'Hours', 'Rate', 'Status']}
            emptyMessage="No overtime requests."
            rows={overtime.map((o) => [
              <span key="e" className="text-xs">
                {o.employee}
                <span className="block text-[10px] text-stone-400">{o.department}</span>
              </span>,
              <span key="d" className="text-[11px]">{fmtDate(o.workDate)}</span>,
              <span key="h" className="tabular-nums">{fmtNum(o.requestedHours, 2)}</span>,
              <span key="r" className="tabular-nums">×{fmtNum(o.rateMultiplier, 2)}</span>,
              <span key="s"><StatusBadge status={o.status} /></span>,
            ])}
          />
        </Card>

        <Card title="Recruitment pipeline">
          <div className="p-4">
            <SimpleBarChart data={funnel.map((f) => ({ name: f.name.replace('_', ' '), value: f.value }))} height={230} />
          </div>
        </Card>

        <Card title="Open vacancies">
          <DataTable
            headers={['Ref', 'Role', 'Dept', 'Positions', 'Applicants', 'Closes', 'Status']}
            emptyMessage="No vacancies."
            rows={vacs.map((v) => [
              <span key="c" className="font-mono text-[10px] text-chalar-700">{v.vacancyCode}</span>,
              <span key="t" className="text-xs">{v.title}</span>,
              <span key="d" className="text-[11px] text-stone-500">{v.department}</span>,
              <span key="p" className="tabular-nums">{v.positionsCount}</span>,
              <span key="a" className="tabular-nums">{v.applicants}</span>,
              <span key="cl" className="text-[11px]">{fmtDate(v.closingDate)}</span>,
              <span key="s"><StatusBadge status={v.status} /></span>,
            ])}
          />
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Departments & budgeted headcount">
          <DataTable
            headers={['Department', 'Active headcount']}
            rows={departments.map((d) => [
              <span key="n" className="text-sm">{d.name}</span>,
              <span key="h" className="tabular-nums">{d.headcount}</span>,
            ])}
          />
        </Card>
      </div>
    </div>
  );
}
