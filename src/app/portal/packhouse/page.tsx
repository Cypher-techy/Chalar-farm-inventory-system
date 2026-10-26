import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/lib/server-session';
import { hasPermission } from '@/lib/auth';
import { many } from '@/lib/ops-queries';
import {
  packhouseKpis,
  packingOrders,
  packingBatches,
  packhouseYieldByCrop,
  packhouseDailyThroughput,
} from '@/lib/ops-queries';
import { sql } from 'drizzle-orm';
import { KPICard, PageHeader, Card, DataTable, StatusBadge, fmtKes, fmtNum, fmtDate, fmtDateTime } from '@/components/portal/ui';
import { StackedBarChart, SimpleLineChart } from '@/components/portal/charts';
import RecordForm, { type FieldDef } from '@/components/portal/record-form';

export const dynamic = 'force-dynamic';

export default async function PackhouseDashboard() {
  const user = await getSessionFromCookies();
  if (!user) redirect('/login');
  if (!hasPermission(user, 'dashboard.packhouse')) redirect('/portal/workspaces');

  const canManage = hasPermission(user, 'packhouse.manage');

  const [k, orders, batches, yieldByCrop, throughput, harvestOptions, packagingOptions] =
    await Promise.all([
      packhouseKpis(),
      packingOrders(12),
      packingBatches(12),
      packhouseYieldByCrop(),
      packhouseDailyThroughput(14),
      many<{ id: number; label: string; netKg: string }>(sql`
        SELECT id, batch_number || ' — ' || net_transferred_kg || ' kg net' AS label,
               net_transferred_kg AS "netKg"
        FROM harvest_batches
        WHERE status IN ('HARVESTED','IN_PACKHOUSE')
        ORDER BY harvest_date::date DESC, id DESC
        LIMIT 40;
      `),
      many<{ id: number; label: string }>(sql`
        SELECT id, sku || ' — ' || name AS label FROM products
        WHERE category_id IN (SELECT id FROM product_categories WHERE name ILIKE '%packaging%')
          AND is_active ORDER BY name LIMIT 30;
      `),
    ]);

  const intake = Number(k.intake_7d ?? 0);
  const packed = Number(k.packed_7d ?? 0);
  const yieldPct = intake > 0 ? (packed / intake) * 100 : 0;

  const intakeFields: FieldDef[] = [
    {
      name: 'harvestBatchId',
      label: 'Harvest batch',
      type: 'select',
      required: true,
      span: 2,
      options: harvestOptions.map((h) => ({ value: String(h.id), label: h.label })),
      hint: 'Only batches still awaiting packhouse processing are listed.',
    },
    { name: 'intakeWeightKg', label: 'Intake weight (kg)', type: 'number', step: '0.01', min: 0.01, required: true },
    { name: 'intakeTempC', label: 'Intake temperature (°C)', type: 'number', step: '0.1', min: -10, max: 60, required: true, hint: 'Cold-chain check at packhouse door.' },
    { name: 'gradedAcceptedKg', label: 'Graded accepted (kg)', type: 'number', step: '0.01', min: 0, required: true },
    { name: 'gradedRejectedKg', label: 'Graded rejected (kg)', type: 'number', step: '0.01', min: 0, required: true },
    { name: 'washingLossKg', label: 'Washing loss (kg)', type: 'number', step: '0.01', min: 0, required: true },
    { name: 'packedOutputKg', label: 'Packed output (kg)', type: 'number', step: '0.01', min: 0, required: true },
    {
      name: 'packFormat',
      label: 'Pack format',
      type: 'select',
      required: true,
      options: [
        { value: 'BUNCH_75G', label: 'Bunches 75 g' },
        { value: 'BUNCH_100G', label: 'Bunches 100 g' },
        { value: 'LINER_1KG', label: 'Liners 1 kg' },
        { value: 'LINER_3KG', label: 'Liners 3 kg' },
        { value: 'SLEEVE_MAP', label: 'Sleeves / MAP bags' },
      ],
    },
    { name: 'unitsPackedCount', label: 'Units packed', type: 'number', min: 0, required: true },
    { name: 'labourCount', label: 'Labour count', type: 'number', min: 1, max: 500, defaultValue: '18' },
    { name: 'hoursPerWorker', label: 'Hours per worker', type: 'number', step: '0.5', min: 0, max: 16, defaultValue: '8' },
    { name: 'labourRateKesPerHour', label: 'Labour rate (KES/h)', type: 'number', step: '1', min: 0, defaultValue: '95' },
    {
      name: 'packagingProductId',
      label: 'Packaging material (optional)',
      type: 'select',
      options: packagingOptions.map((p) => ({ value: String(p.id), label: p.label })),
    },
    { name: 'packagingQtyUsed', label: 'Packaging qty used', type: 'number', step: '1', min: 0 },
    {
      name: 'shiftCode',
      label: 'Shift',
      type: 'select',
      defaultValue: 'SHIFT-DAY',
      options: [
        { value: 'SHIFT-DAY', label: 'Day shift' },
        { value: 'SHIFT-EARLY', label: 'Early shift' },
        { value: 'SHIFT-COLD', label: 'Cold room shift' },
      ],
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: 'Portal', href: '/portal' }, { label: 'Packhouse' }]}
        title="Packhouse & Production"
        subtitle="Intake, grading, washing and packing with yield accounting, unexplained-variance capture and batch-level traceability from harvest to finished lot."
        actions={<a href="/api/reports/export?type=inventory-lots" className="btn-secondary">Lot traceability CSV</a>}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard label="Awaiting Intake" value={Number(k.awaiting_intake)} sub="Harvest batches in the yard" tone={Number(k.awaiting_intake) > 0 ? 'warning' : 'success'} delayIndex={0} />
        <KPICard label="Intake (7 days)" value={`${fmtNum(k.intake_7d)} kg`} sub={`${k.orders_7d} packing runs · ${k.orders_open} open`} delayIndex={1} />
        <KPICard
          label="Packed Output (7 days)"
          value={`${fmtNum(k.packed_7d)} kg`}
          sub={`Yield ${fmtNum(yieldPct, 1)}% of intake`}
          tone={yieldPct >= 80 ? 'success' : yieldPct >= 60 ? 'warning' : 'danger'}
          delayIndex={2}
        />
        <KPICard
          label="Rejects + Washing Loss"
          value={`${fmtNum(Number(k.rejected_7d ?? 0) + Number(k.washing_loss_7d ?? 0))} kg`}
          sub={`Unexplained variance ${fmtNum(k.variance_7d)} kg`}
          tone={Number(k.variance_7d ?? 0) > 0 ? 'danger' : 'neutral'}
          delayIndex={3}
        />
        <KPICard
          label="Cold Room Avg"
          value={`${fmtNum(k.avg_cold_room_c, 1)} °C`}
          sub={`Intake avg ${fmtNum(k.avg_intake_c, 1)} °C · target 2–4 °C`}
          tone={Number(k.avg_cold_room_c ?? 0) <= 4 ? 'success' : 'warning'}
          delayIndex={4}
        />
      </div>

      {canManage && (
        <div className="mb-4">
          <RecordForm
            endpoint="/api/packhouse/packing-orders"
            title="Record packhouse run"
            buttonLabel="Record packhouse run (intake → grading → packing)"
            description="Consumes the harvest lot, creates a finished-goods lot in QUARANTINED status and posts auditable production movements. Packed output cannot exceed accepted weight less washing loss."
            fields={intakeFields}
            submitLabel="Post packhouse run"
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Intake vs packed vs rejected by crop">
          <div className="p-4">
            <StackedBarChart
              data={yieldByCrop.map((y) => ({ name: y.name, intake: Number(y.intake), packed: Number(y.packed), rejected: Number(y.rejected) }))}
              keys={['intake', 'packed', 'rejected']}
              height={270}
            />
          </div>
        </Card>
        <Card title="Packed throughput — last 14 days (kg)">
          <div className="p-4">
            <SimpleLineChart data={throughput.map((t) => ({ name: t.name, value: Number(t.value) }))} height={270} />
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Packing runs">
          <DataTable
            headers={['Run', 'Harvest batch', 'Crop', 'Intake', 'Accepted', 'Rejected', 'Washing', 'Packed', 'Variance', 'Format', 'Units', 'Labour', 'Cost', 'Status']}
            emptyMessage="No packing runs recorded."
            rows={orders.map((o) => [
              <span key="c" className="font-mono text-xs text-chalar-700">{String(o.orderCode)}</span>,
              <span key="h" className="font-mono text-[10px] text-stone-500">{String(o.harvestBatch ?? '—')}</span>,
              <span key="cr" className="text-xs">{String(o.crop ?? '—')}</span>,
              <span key="i" className="tabular-nums text-xs">{fmtNum(o.intake)}</span>,
              <span key="a" className="tabular-nums text-xs">{fmtNum(o.accepted)}</span>,
              <span key="r" className="tabular-nums text-xs text-red-600">{fmtNum(o.rejected)}</span>,
              <span key="w" className="tabular-nums text-xs">{fmtNum(o.washing)}</span>,
              <span key="p" className="tabular-nums text-xs font-medium">{fmtNum(o.packed)}</span>,
              <span key="v" className={`tabular-nums text-xs ${Number(o.variance) > 0 ? 'font-semibold text-red-600' : 'text-stone-400'}`}>{fmtNum(o.variance, 3)}</span>,
              <span key="f" className="text-[10px] text-stone-500">{String(o.packFormat)}</span>,
              <span key="u" className="tabular-nums text-xs">{o.units}</span>,
              <span key="l" className="tabular-nums text-xs">{o.labour}</span>,
              <span key="cost" className="tabular-nums text-xs">{fmtKes(o.cost)}</span>,
              <span key="s"><StatusBadge status={String(o.status)} /></span>,
            ])}
          />
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Finished packing batches (QA gate before dispatch)">
          <DataTable
            headers={['Batch', 'Product', 'Lot', 'Grade', 'Net kg', 'Cartons', 'Cold room °C', 'Packed', 'Expiry', 'QA status', 'Lot status']}
            emptyMessage="No packing batches."
            rows={batches.map((b) => [
              <span key="c" className="font-mono text-xs text-chalar-700">{String(b.batchCode)}</span>,
              <span key="p" className="text-xs">{String(b.product ?? '—')}<span className="block text-[10px] text-stone-400">{String(b.sku ?? '')}</span></span>,
              <span key="l" className="font-mono text-[10px] text-stone-500">{String(b.lotNumber ?? '—')}</span>,
              <span key="g" className="text-[10px]">{String(b.grade)}</span>,
              <span key="n" className="tabular-nums text-xs">{fmtNum(b.netWeight)}</span>,
              <span key="ct" className="tabular-nums text-xs">{b.cartons}</span>,
              <span key="t" className="tabular-nums text-xs">{fmtNum(b.coldRoomTemp, 1)}</span>,
              <span key="d" className="text-[10px]">{fmtDate(String(b.packedDate ?? ''))}</span>,
              <span key="e" className="text-[10px]">{fmtDate(String(b.expiryDate ?? ''))}</span>,
              <span key="qa"><StatusBadge status={String(b.qaStatus)} /></span>,
              <span key="ls"><StatusBadge status={String(b.lotStatus ?? 'PENDING')} /></span>,
            ])}
          />
        </Card>
      </div>

      <p className="mt-3 text-[11px] text-stone-400">
        Batch records show when each run was posted ({fmtDateTime(new Date())} is the current server time).
        Unexplained variance is captured separately from graded rejects and washing loss so shrinkage
        can be investigated rather than absorbed silently.
      </p>
    </div>
  );
}
