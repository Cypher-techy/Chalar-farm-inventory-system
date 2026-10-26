import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { getSessionFromCookies } from '@/lib/server-session';
import { hasPermission } from '@/lib/auth';
import { maintenanceKpis, workOrders, assetsNeedingAttention, maintenanceCostByType, many } from '@/lib/ops-queries';
import { KPICard, PageHeader, Card, DataTable, StatusBadge, fmtKes, fmtNum, fmtDate } from '@/components/portal/ui';
import { DonutChart } from '@/components/portal/charts';
import RecordForm, { type FieldDef } from '@/components/portal/record-form';

export const dynamic = 'force-dynamic';

export default async function MaintenanceDashboard() {
  const user = await getSessionFromCookies();
  if (!user) redirect('/login');
  if (!hasPermission(user, 'dashboard.maintenance')) redirect('/portal/workspaces');

  const canManage = hasPermission(user, 'maintenance.manage');

  const [k, wos, attention, costs, assets, spares] = await Promise.all([
    maintenanceKpis(),
    workOrders(15),
    assetsNeedingAttention(12),
    maintenanceCostByType(),
    many<{ id: number; label: string; condition: string; nextService: string }>(sql`
      SELECT id, asset_tag || ' — ' || name AS label, condition, next_service_due_date AS "nextService"
      FROM assets ORDER BY next_service_due_date::date LIMIT 60;`),
    many<{ id: number; label: string; available: string }>(sql`
      SELECT p.id, p.sku || ' — ' || p.name AS label,
             COALESCE((SELECT SUM(l.available_qty) FROM inventory_lots l
                       WHERE l.product_id = p.id AND l.quality_status IN ('AVAILABLE','RELEASED')), 0)::text AS available
      FROM products p
      JOIN product_categories pc ON pc.id = p.category_id
      WHERE pc.name ILIKE '%tool%' OR pc.name ILIKE '%spare%' OR p.sku ILIKE 'TOOL-%' OR p.sku ILIKE 'SPARE-%'
      ORDER BY p.name LIMIT 40;`),
  ]);

  const createFields: FieldDef[] = [
    { name: 'assetId', label: 'Asset', type: 'select', required: true, span: 2, options: assets.map((a) => ({ value: String(a.id), label: `${a.label} · ${a.condition} · next service ${a.nextService}` })) },
    {
      name: 'maintenanceType',
      label: 'Work type',
      type: 'select',
      required: true,
      options: [
        { value: 'PREVENTIVE', label: 'Preventive service' },
        { value: 'CORRECTIVE_REPAIR', label: 'Corrective repair' },
        { value: 'CALIBRATION', label: 'Calibration' },
      ],
    },
    {
      name: 'priority',
      label: 'Priority',
      type: 'select',
      defaultValue: 'MEDIUM',
      options: [
        { value: 'LOW', label: 'Low' },
        { value: 'MEDIUM', label: 'Medium' },
        { value: 'HIGH', label: 'High' },
        { value: 'CRITICAL', label: 'Critical — production stopper' },
      ],
    },
    { name: 'scheduledDate', label: 'Scheduled date', type: 'date', required: true },
    { name: 'technicianName', label: 'Technician', type: 'text', required: true },
    { name: 'sparePartProductId', label: 'Spare part (optional)', type: 'select', options: spares.map((s) => ({ value: String(s.id), label: `${s.label} · ${fmtNum(s.available)} available` })) },
    { name: 'sparePartQtyUsed', label: 'Spare qty', type: 'number', step: '1', min: 0 },
    { name: 'issueDescription', label: 'Fault / service scope', type: 'textarea', required: true, span: 3 },
  ];

  const completeFields: FieldDef[] = [
    { name: 'workOrderNo', label: 'Work order number', type: 'select', required: true, span: 2, options: wos.filter((w) => w.status !== 'COMPLETED' && w.status !== 'CANCELLED').map((w) => ({ value: String(w.workOrderNo), label: `${w.workOrderNo} — ${w.asset} (${w.priority})` })) },
    { name: 'labourCostKes', label: 'Labour cost (KES)', type: 'number', step: '1', min: 0, required: true },
    { name: 'partsCostKes', label: 'Parts cost (KES)', type: 'number', step: '1', min: 0, defaultValue: '0' },
    { name: 'downtimeHours', label: 'Downtime (hours)', type: 'number', step: '0.25', min: 0, defaultValue: '0' },
    {
      name: 'newCondition',
      label: 'Asset condition after work',
      type: 'select',
      options: [
        { value: 'EXCELLENT', label: 'Excellent' },
        { value: 'GOOD', label: 'Good' },
        { value: 'FAIR', label: 'Fair' },
        { value: 'NEEDS_REPAIR', label: 'Still needs repair' },
      ],
    },
    { name: 'nextServiceDueDate', label: 'Next service due', type: 'date' },
    { name: 'resolutionNotes', label: 'Resolution notes', type: 'textarea', required: true, span: 3 },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: 'Portal', href: '/portal' }, { label: 'Maintenance & Assets' }]}
        title="Maintenance & Asset Register"
        subtitle="Preventive schedules, corrective work orders, spare-part consumption and cold-chain asset availability."
        actions={<a href="/api/reports/export?type=maintenance" className="btn-secondary">Work order CSV</a>}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard label="Assets Registered" value={Number(k.assets_total)} sub={`Book value ${fmtKes(k.asset_value)}`} delayIndex={0} />
        <KPICard label="Open Work Orders" value={Number(k.wos_open)} sub={`${k.wos_critical} high/critical priority`} tone={Number(k.wos_critical) > 0 ? 'danger' : Number(k.wos_open) > 0 ? 'warning' : 'success'} delayIndex={1} />
        <KPICard label="Completed (30 days)" value={Number(k.wos_done_30d)} sub={`${fmtNum(k.downtime_90d)} downtime hours (90d)`} delayIndex={2} />
        <KPICard label="Maintenance Cost (90d)" value={fmtKes(k.cost_90d)} sub="Labour + parts consumed" delayIndex={3} />
        <KPICard
          label="Service Due ≤ 7 Days"
          value={Number(k.service_due_7d)}
          sub={`${k.service_overdue} already overdue · ${k.assets_degraded} assets degraded`}
          tone={Number(k.service_overdue) > 0 ? 'danger' : Number(k.service_due_7d) > 0 ? 'warning' : 'success'}
          delayIndex={4}
        />
      </div>

      {canManage && (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <RecordForm
            endpoint="/api/maintenance/work-orders"
            title="Raise work order"
            buttonLabel="Raise maintenance work order"
            description="Spare-part availability is checked before scheduling; parts are consumed from stock (FIFO) when the job is completed."
            fields={createFields}
            submitLabel="Raise work order"
          />
          <RecordForm
            endpoint="/api/maintenance/work-orders"
            method="PATCH"
            title="Complete work order"
            buttonLabel="Complete work order & update asset"
            buttonClass="btn-secondary"
            description="Records labour/parts cost and downtime, consumes spares from inventory and updates the asset condition and next service date."
            fields={completeFields}
            submitLabel="Mark completed"
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Maintenance cost by work type">
          <div className="p-4">
            <DonutChart data={costs.map((c) => ({ name: c.name.replace(/_/g, ' '), value: Number(c.value) }))} height={240} />
          </div>
        </Card>

        <Card title="Assets needing attention" className="lg:col-span-2">
          <DataTable
            headers={['Asset', 'Category', 'Location', 'Condition', 'Last service', 'Next service', 'Warranty', 'Downtime (h)', 'Custodian']}
            emptyMessage="No assets require attention."
            rows={attention.map((a) => [
              <span key="t" className="text-xs">{String(a.name)}<span className="block font-mono text-[10px] text-stone-400">{String(a.assetTag)}</span></span>,
              <span key="c" className="text-[10px]">{String(a.category)}</span>,
              <span key="l" className="text-[10px] text-stone-500">{String(a.location)}</span>,
              <span key="co"><StatusBadge status={String(a.condition)} /></span>,
              <span key="ls" className="text-[10px]">{fmtDate(String(a.lastService ?? ''))}</span>,
              <span key="ns" className="text-[10px]">{fmtDate(String(a.nextService ?? ''))}</span>,
              <span key="w" className="text-[10px]">{fmtDate(String(a.warranty ?? ''))}</span>,
              <span key="d" className="tabular-nums text-[10px]">{fmtNum(a.downtime, 1)}</span>,
              <span key="cu" className="text-[10px] text-stone-500">{String(a.custodian ?? '—')}</span>,
            ])}
          />
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Work orders">
          <DataTable
            headers={['WO', 'Asset', 'Type', 'Priority', 'Issue', 'Technician', 'Spare part', 'Labour', 'Parts', 'Downtime', 'Scheduled', 'Status']}
            emptyMessage="No work orders."
            rows={wos.map((w) => [
              <span key="n" className="font-mono text-[10px] text-chalar-700">{String(w.workOrderNo)}</span>,
              <span key="a" className="text-xs">{String(w.asset)}<span className="block font-mono text-[10px] text-stone-400">{String(w.assetTag)}</span></span>,
              <span key="t" className="text-[10px]">{String(w.type).replace(/_/g, ' ')}</span>,
              <span key="p"><StatusBadge status={String(w.priority)} /></span>,
              <span key="i" className="max-w-[260px] truncate text-[11px] text-stone-600" title={String(w.issue ?? '')}>{String(w.issue)}</span>,
              <span key="te" className="text-[10px] text-stone-500">{String(w.technician)}</span>,
              <span key="sp" className="text-[10px] text-stone-500">{String(w.sparePart ?? '—')}</span>,
              <span key="l" className="tabular-nums text-[10px]">{w.labour != null ? fmtKes(w.labour) : '—'}</span>,
              <span key="pa" className="tabular-nums text-[10px]">{w.parts != null ? fmtKes(w.parts) : '—'}</span>,
              <span key="d" className="tabular-nums text-[10px]">{w.downtime != null ? fmtNum(w.downtime, 1) : '—'}</span>,
              <span key="s" className="text-[10px]">{fmtDate(String(w.scheduled ?? ''))}</span>,
              <span key="st"><StatusBadge status={String(w.status)} /></span>,
            ])}
          />
        </Card>
      </div>
    </div>
  );
}
