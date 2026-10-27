import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/lib/server-session';
import { hasPermission } from '@/lib/auth';
import {
  financeKpis,
  trialBalance,
  payrollRuns,
  payrollCostByDepartment,
  statutoryBreakdown,
  expenseByCategory,
  payablesAging,
  pendingFinanceApprovals,
  expenseRegister,
  statutoryRuleVersions,
} from '@/lib/finance-queries';
import { KPICard, PageHeader, Card, DataTable, StatusBadge, fmtKes, fmtDate } from '@/components/portal/ui';
import { DonutChart, SimpleBarChart } from '@/components/portal/charts';
import PayrollDesk from './payroll-desk';

export const dynamic = 'force-dynamic';

export default async function FinanceDashboard() {
  const user = await getSessionFromCookies();
  if (!user) redirect('/login');
  if (!hasPermission(user, 'dashboard.finance')) redirect('/portal/workspaces');

  const canManagePayroll = hasPermission(user, 'payroll.manage');
  const canApprovePayroll = hasPermission(user, 'payroll.approve');

  const [k, tb, runs, payrollByDept, statutory, expenses, aging, approvals, register, rules] =
    await Promise.all([
      financeKpis(),
      trialBalance(),
      payrollRuns(8),
      payrollCostByDepartment(),
      statutoryBreakdown(),
      expenseByCategory(),
      payablesAging(),
      pendingFinanceApprovals(10),
      expenseRegister(12),
      statutoryRuleVersions(),
    ]);

  const balanced = k.trial_debit === k.trial_credit;

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: 'Portal', href: '/portal' }, { label: 'Finance & Payroll' }]}
        title="Finance & Payroll"
        subtitle="Ledger position, payables, expense control and Kenyan statutory payroll — all figures computed from posted records."
        actions={
          <>
            <a href="/api/reports/export?type=trial-balance" className="btn-secondary">Trial balance CSV</a>
            <a href="/api/reports/export?type=expenses" className="btn-secondary">Expense register</a>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard label="Cash & Equivalents" value={fmtKes(k.cash_balance)} sub="Account 1000 posted balance" delayIndex={0} />
        <KPICard label="Trade Receivables" value={fmtKes(k.receivables)} sub="Export & local customers" tone="info" delayIndex={1} />
        <KPICard label="Trade Payables" value={fmtKes(k.payables)} sub={`${k.overdue_invoices} invoices overdue (${fmtKes(k.overdue_amount)})`} tone={k.overdue_invoices > 0 ? 'warning' : 'success'} delayIndex={2} />
        <KPICard label="Revenue (30 days)" value={fmtKes(k.revenue_period)} sub={`${fmtKes(k.expenses_period)} approved expenses`} tone="success" delayIndex={3} />
        <KPICard
          label="Trial Balance"
          value={balanced ? 'BALANCED' : 'OUT OF BALANCE'}
          sub={`Dr ${fmtKes(k.trial_debit)} · Cr ${fmtKes(k.trial_credit)} · ${k.journal_count} posted journals`}
          tone={balanced ? 'success' : 'danger'}
          delayIndex={4}
        />
      </div>

      <div className="mb-4">
        <PayrollDesk
          canManage={canManagePayroll}
          canApprove={canApprovePayroll}
          latestPeriod={k.payroll_period_latest}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Statutory deductions withheld (all runs)">
          <div className="p-4">
            <DonutChart data={statutory.map((s) => ({ name: s.name, value: Number(s.value) }))} height={240} />
          </div>
        </Card>
        <Card title="Payroll cost by department (gross)">
          <div className="p-4">
            <SimpleBarChart data={payrollByDept.map((d) => ({ name: d.name.split(' ')[0], value: Number(d.value) }))} height={240} />
          </div>
        </Card>
        <Card title="Expense by category">
          <div className="p-4">
            <SimpleBarChart data={expenses.map((e) => ({ name: e.name, value: Number(e.value) }))} height={240} />
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Payroll runs">
          <DataTable
            headers={['Run', 'Period', 'Pay date', 'Statutory version', 'Staff', 'Gross', 'PAYE', 'NSSF', 'SHIF', 'Housing levy', 'Net', 'Status', 'Prepared / approved']}
            emptyMessage="No payroll runs yet."
            rows={runs.map((r) => [
              <span key="c" className="font-mono text-xs text-chalar-700">{r.runCode}</span>,
              <span key="p" className="text-xs">{r.periodMonth}</span>,
              <span key="d" className="text-xs">{fmtDate(r.payDate)}</span>,
              <span key="v" className="font-mono text-[10px] text-stone-500">{r.statutoryVersion}</span>,
              <span key="n" className="tabular-nums">{r.employeeCount}</span>,
              <span key="g" className="tabular-nums text-xs">{fmtKes(r.gross)}</span>,
              <span key="paye" className="tabular-nums text-xs">{fmtKes(r.paye)}</span>,
              <span key="nssf" className="tabular-nums text-xs">{fmtKes(r.nssf)}</span>,
              <span key="shif" className="tabular-nums text-xs">{fmtKes(r.shif)}</span>,
              <span key="ahl" className="tabular-nums text-xs">{fmtKes(r.housing)}</span>,
              <span key="net" className="tabular-nums text-xs font-semibold">{fmtKes(r.net)}</span>,
              <span key="s"><StatusBadge status={r.status} /></span>,
              <span key="by" className="text-[10px] text-stone-500">
                {r.preparedBy ?? '—'}
                <span className="block">{r.approvedBy ? `✓ ${r.approvedBy}` : 'not yet approved'}</span>
              </span>,
            ])}
          />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Trial balance (posted journals)">
          <DataTable
            headers={['Account', 'Name', 'Type', 'Debit', 'Credit', 'Balance']}
            emptyMessage="No accounts."
            rows={tb.map((a) => [
              <span key="c" className="font-mono text-xs">{a.code}</span>,
              <span key="n" className="text-xs">{a.name}</span>,
              <span key="t"><StatusBadge status={a.type} tone="neutral" /></span>,
              <span key="d" className="tabular-nums text-xs">{Number(a.debit) > 0 ? fmtKes(a.debit) : '—'}</span>,
              <span key="cr" className="tabular-nums text-xs">{Number(a.credit) > 0 ? fmtKes(a.credit) : '—'}</span>,
              <span key="b" className="tabular-nums text-xs">{fmtKes(a.balance)}</span>,
            ])}
          />
        </Card>

        <div className="space-y-4">
          <Card title="Payables ageing">
            <div className="p-4">
              <SimpleBarChart data={aging.map((a) => ({ name: a.name, value: Number(a.value) }))} height={200} />
            </div>
          </Card>

          <Card title="Statutory rule versions (date-effective configuration)">
            <DataTable
              headers={['Version', 'Effective from', 'To', 'Personal relief', 'SHIF %', 'AHL %', 'NSSF %', 'NSSF Tier II cap', 'Status']}
              rows={rules.map((r) => [
                <span key="v" className="font-mono text-xs">{r.versionCode}</span>,
                <span key="f" className="text-xs">{fmtDate(r.effectiveFrom)}</span>,
                <span key="t" className="text-xs">{r.effectiveTo ? fmtDate(r.effectiveTo) : 'open'}</span>,
                <span key="pr" className="tabular-nums text-xs">{fmtKes(r.personalReliefKes)}</span>,
                <span key="sh" className="tabular-nums text-xs">{r.shifRatePercent}%</span>,
                <span key="ah" className="tabular-nums text-xs">{r.ahlEmployeeRatePercent}%</span>,
                <span key="ns" className="tabular-nums text-xs">{r.nssfRatePercent}%</span>,
                <span key="cap" className="tabular-nums text-xs">{fmtKes(r.nssfTier2LimitKes)}</span>,
                <span key="s"><StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} /></span>,
              ])}
            />
            <p className="border-t border-stone-100 px-4 py-2 text-[10px] leading-relaxed text-stone-400">
              Rates are stored per version with effective dates, so historical payroll can be
              recomputed under the rules that applied at the time. Verify current rates against KRA,
              NSSF, SHA and the Affordable Housing Act before relying on them for statutory filing.
            </p>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Finance approvals pending">
          <DataTable
            headers={['Request', 'Title', 'Amount', 'Awaiting', 'Submitted']}
            emptyMessage="No pending finance approvals."
            rows={approvals.map((a) => [
              <span key="c" className="font-mono text-[10px] text-chalar-700">{a.requestCode}</span>,
              <span key="t" className="text-xs">{a.title}</span>,
              <span key="a" className="tabular-nums text-xs">{fmtKes(a.amountKes)}</span>,
              <span key="r" className="text-[10px] text-stone-500">{a.assignedRoleCode.replace(/_/g, ' ')}</span>,
              <span key="s" className="text-[10px] text-stone-400">{a.submittedBy} · {fmtDate(a.submittedAt)}</span>,
            ])}
          />
        </Card>

        <Card title="Recent expenses">
          <DataTable
            headers={['Expense', 'Date', 'Department', 'Category', 'Vendor', 'Amount', 'Status']}
            emptyMessage="No expenses recorded."
            rows={register.map((e) => [
              <span key="n" className="font-mono text-[10px] text-chalar-700">{e.expenseNumber}</span>,
              <span key="d" className="text-xs">{fmtDate(e.date)}</span>,
              <span key="dep" className="text-xs">{e.department}</span>,
              <span key="c" className="text-xs">{e.category}</span>,
              <span key="v" className="text-xs text-stone-500">{e.vendor}</span>,
              <span key="a" className="tabular-nums text-xs">{fmtKes(Number(e.amount) + Number(e.tax))}</span>,
              <span key="s"><StatusBadge status={e.status} /></span>,
            ])}
          />
        </Card>
      </div>
    </div>
  );
}
