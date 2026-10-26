import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/lib/server-session';
import { hasPermission } from '@/lib/auth';
import { recentActivity } from '@/lib/dashboard-queries';
import {
  executiveKpis,
  executiveValueChain,
  exportMarketMix,
  departmentSpend,
  salesKpis,
  logisticsKpis,
  qaKpis,
  procurementKpis,
} from '@/lib/ops-queries';
import { KPICard, PageHeader, Card, DataTable, StatusBadge, fmtKes, fmtNum, fmtDateTime } from '@/components/portal/ui';
import { StackedBarChart, DonutChart, SimpleBarChart } from '@/components/portal/charts';

export const dynamic = 'force-dynamic';

export default async function ExecutiveDashboard() {
  const user = await getSessionFromCookies();
  if (!user) redirect('/login');
  if (!hasPermission(user, 'dashboard.executive')) redirect('/portal/workspaces');

  const [k, chain, markets, deptSpend, activity, sales, logistics, qa, procurement] =
    await Promise.all([
      executiveKpis(),
      executiveValueChain(),
      exportMarketMix(),
      departmentSpend(),
      recentActivity(10),
      salesKpis(),
      logisticsKpis(),
      qaKpis(),
      procurementKpis(),
    ]);

  const revenue = Number(k.revenue_total ?? 0);
  const opex = Number(k.opex_total ?? 0);
  const payroll = Number(k.payroll_total ?? 0);
  const contribution = revenue - opex;
  const marginPct = revenue > 0 ? (contribution / revenue) * 100 : 0;

  const harvested7 = Number(k.harvest_7d ?? 0);
  const packed7 = Number(k.packed_7d ?? 0);
  const dispatched7 = Number(k.dispatched_7d ?? 0);
  const packYield = harvested7 > 0 ? (packed7 / harvested7) * 100 : 0;
  const shipRate = packed7 > 0 ? (dispatched7 / packed7) * 100 : 0;

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: 'Portal', href: '/portal' }, { label: 'Executive' }]}
        title="Executive Overview"
        subtitle="Enterprise performance across the value chain — field to flight — with financial position, quality exposure and governance queue."
        actions={
          <>
            <a href="/api/reports/export?type=trial-balance" className="btn-secondary">Trial balance</a>
            <a href="/api/reports/export?type=sales-orders&format=pdf" className="btn-secondary">Order book PDF</a>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Revenue (booked orders)" value={fmtKes(revenue)} sub={`${fmtKes(k.revenue_30d)} in the last 30 days`} tone="success" delayIndex={0} />
        <KPICard label="Operating Expenses" value={fmtKes(opex)} sub={`Payroll gross ${fmtKes(payroll)}`} delayIndex={1} />
        <KPICard
          label="Revenue less Opex"
          value={fmtKes(contribution)}
          sub={`${fmtNum(marginPct, 1)}% of booked revenue`}
          tone={contribution > 0 ? 'success' : 'danger'}
          delayIndex={2}
        />
        <KPICard label="Cash Position" value={fmtKes(k.cash)} sub={`Receivables ${fmtKes(k.receivables)} · payables ${fmtKes(k.payables)}`} delayIndex={3} />
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Field → Packhouse Yield (7d)"
          value={`${fmtNum(packYield, 1)} %`}
          sub={`${fmtNum(harvested7)} kg harvested → ${fmtNum(packed7)} kg packed`}
          tone={packYield >= 80 ? 'success' : packYield >= 60 ? 'warning' : 'danger'}
          delayIndex={0}
        />
        <KPICard
          label="Packhouse → Dispatch (7d)"
          value={`${fmtNum(shipRate, 1)} %`}
          sub={`${fmtNum(dispatched7)} kg dispatched`}
          tone={shipRate >= 80 ? 'success' : 'warning'}
          delayIndex={1}
        />
        <KPICard
          label="Quality Exposure"
          value={Number(qa.open_ncr ?? 0)}
          sub={`${qa.critical_ncr ?? 0} critical NCRs · ${qa.in_quarantine ?? 0} batches quarantined · pass rate ${fmtNum(Number(qa.inspections_30d) > 0 ? (Number(qa.passed_30d) / Number(qa.inspections_30d)) * 100 : 0, 1)}%`}
          tone={Number(qa.critical_ncr ?? 0) > 0 ? 'danger' : Number(qa.open_ncr ?? 0) > 0 ? 'warning' : 'success'}
          delayIndex={2}
        />
        <KPICard
          label="Governance Queue"
          value={Number(k.pending_approvals)}
          sub={`${procurement.reqs_pending ?? 0} requisitions · ${sales.orders_open ?? 0} open orders · ${logistics.exceptions ?? 0} logistics exceptions · ${k.stock_alerts ?? 0} stock alerts`}
          tone={Number(k.pending_approvals) > 0 ? 'warning' : 'success'}
          delayIndex={3}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Value chain — harvested vs packed vs dispatched (14 days)" className="lg:col-span-2">
          <div className="p-4">
            <StackedBarChart
              data={chain.map((c) => ({
                name: c.name,
                harvested: Number(c.harvested),
                packed: Number(c.packed),
                dispatched: Number(c.dispatched),
              }))}
              keys={['harvested', 'packed', 'dispatched']}
              height={290}
            />
          </div>
        </Card>
        <Card title="Export volume by market (kg)">
          <div className="p-4">
            <DonutChart data={markets.map((m) => ({ name: m.name, value: Number(m.value) }))} height={290} />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Department cost structure (payroll gross vs approved expenses)">
          <div className="p-4">
            <SimpleBarChart
              data={deptSpend.flatMap((d) => [
                { name: `${d.name.split(' ')[0]} · Payroll`, value: Number(d.payroll) },
                { name: `${d.name.split(' ')[0]} · Opex`, value: Number(d.expenses) },
              ])}
              height={300}
            />
          </div>
        </Card>

        <Card title="Latest enterprise activity (audit trail)">
          <DataTable
            headers={['When', 'Actor', 'Module', 'Action', 'Summary']}
            emptyMessage="No activity recorded."
            rows={activity.map((a) => [
              <span key="t" className="whitespace-nowrap text-[10px] text-stone-400">{fmtDateTime(a.createdAt)}</span>,
              <span key="ac" className="text-[10px]">{String(a.actorEmail).split('@')[0]}</span>,
              <span key="m"><StatusBadge status={String(a.module)} tone="neutral" /></span>,
              <span key="act" className="text-[10px] font-semibold text-chalar-700">{String(a.action).replace(/_/g, ' ')}</span>,
              <span key="s" className="max-w-[320px] truncate text-[11px] text-stone-600" title={String(a.summary)}>{String(a.summary)}</span>,
            ])}
          />
        </Card>
      </div>

      <p className="mt-3 text-[11px] text-stone-400">
        Headcount {k.headcount} active employees · inventory valued at {fmtKes(k.inventory_value)} ·
        figures are computed live from posted transactions, not cached snapshots.
      </p>
    </div>
  );
}
