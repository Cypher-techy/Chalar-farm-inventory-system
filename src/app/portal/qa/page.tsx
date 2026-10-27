import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { getSessionFromCookies } from '@/lib/server-session';
import { hasPermission } from '@/lib/auth';
import { qaKpis, inspections, nonconformities, qaResultsTrend, many } from '@/lib/ops-queries';
import { KPICard, PageHeader, Card, DataTable, StatusBadge, fmtNum, fmtDateTime, fmtDate } from '@/components/portal/ui';
import { StackedBarChart } from '@/components/portal/charts';
import RecordForm, { type FieldDef } from '@/components/portal/record-form';

export const dynamic = 'force-dynamic';

export default async function QaDashboard() {
  const user = await getSessionFromCookies();
  if (!user) redirect('/login');
  if (!hasPermission(user, 'dashboard.qa')) redirect('/portal/workspaces');

  const canInspect = hasPermission(user, 'qa.inspect');
  const canRelease = hasPermission(user, 'qa.release');

  const [k, insp, ncrs, trend, batchOptions, lotOptions] = await Promise.all([
    qaKpis(),
    inspections(15),
    nonconformities(15),
    qaResultsTrend(),
    many<{ id: number; label: string; qaStatus: string }>(sql`
      SELECT id, packing_batch_code || ' — ' || net_weight_kg || ' kg' AS label, qa_status AS "qaStatus"
      FROM packing_batches ORDER BY created_at DESC LIMIT 40;
    `),
    many<{ id: number; label: string; status: string }>(sql`
      SELECT l.id, l.lot_number || ' — ' || p.sku AS label, l.quality_status AS status
      FROM inventory_lots l JOIN products p ON p.id = l.product_id
      WHERE l.physical_qty > 0 ORDER BY l.created_at DESC LIMIT 40;
    `),
  ]);

  const total = Number(k.inspections_30d ?? 0);
  const passRate = total > 0 ? (Number(k.passed_30d ?? 0) / total) * 100 : 0;

  const inspectionFields: FieldDef[] = [
    {
      name: 'stage',
      label: 'Inspection stage',
      type: 'select',
      required: true,
      options: [
        { value: 'INCOMING_HARVEST', label: 'Incoming harvest' },
        { value: 'IN_PROCESS_PACKHOUSE', label: 'In-process (packhouse)' },
        { value: 'FINISHED_COLD_CHAIN', label: 'Finished cold chain' },
        { value: 'PRE_EXPORT_PHYTOSANITARY', label: 'Pre-export phytosanitary' },
      ],
    },
    {
      name: 'packingBatchId',
      label: 'Packing batch (optional)',
      type: 'select',
      options: batchOptions.map((b) => ({ value: String(b.id), label: `${b.label} · ${b.qaStatus}` })),
    },
    {
      name: 'inventoryLotId',
      label: 'Inventory lot (optional)',
      type: 'select',
      options: lotOptions.map((l) => ({ value: String(l.id), label: `${l.label} · ${l.status}` })),
    },
    { name: 'sampleWeightKg', label: 'Sample weight (kg)', type: 'number', step: '0.01', min: 0.01, required: true },
    { name: 'measuredTempC', label: 'Measured temperature (°C)', type: 'number', step: '0.1', min: -20, max: 60, required: true },
    { name: 'maxAllowedTempC', label: 'Maximum allowed (°C)', type: 'number', step: '0.1', min: -20, max: 60, required: true, hint: 'Most herbs 2–4 °C; basil 8–10 °C.' },
    { name: 'defectPercent', label: 'Defect rate (%)', type: 'number', step: '0.1', min: 0, max: 100, required: true, hint: 'Above 5% fails; above 2% is a conditional pass.' },
    {
      name: 'moistureStatus',
      label: 'Moisture status',
      type: 'select',
      defaultValue: 'OPTIMAL',
      options: [
        { value: 'OPTIMAL', label: 'Optimal' },
        { value: 'HIGH', label: 'Too high' },
        { value: 'LOW', label: 'Too dry' },
      ],
    },
    {
      name: 'pestFreeStatus',
      label: 'Pest free',
      type: 'select',
      defaultValue: 'true',
      options: [
        { value: 'true', label: 'Yes — no pest activity' },
        { value: 'false', label: 'No — pest detected' },
      ],
    },
    {
      name: 'pesticideResidueCompliant',
      label: 'Residue compliant (EU MRL)',
      type: 'select',
      defaultValue: 'true',
      options: [
        { value: 'true', label: 'Compliant' },
        { value: 'false', label: 'Non-compliant' },
      ],
    },
    {
      name: 'packagingIntegrity',
      label: 'Packaging integrity',
      type: 'select',
      defaultValue: 'VERIFIED',
      options: [
        { value: 'VERIFIED', label: 'Verified' },
        { value: 'MINOR_DAMAGE', label: 'Minor damage' },
        { value: 'COMPROMISED', label: 'Compromised' },
      ],
    },
    { name: 'notes', label: 'Inspector notes', type: 'textarea', span: 3 },
  ];

  const releaseFields: FieldDef[] = [
    {
      name: 'packingBatchCode',
      label: 'Packing batch code',
      type: 'select',
      options: batchOptions.map((b) => ({ value: b.label.split(' — ')[0], label: `${b.label} · ${b.qaStatus}` })),
      hint: 'Release applies to the finished lot of this batch.',
    },
    {
      name: 'decision',
      label: 'Decision',
      type: 'select',
      required: true,
      options: [
        { value: 'RELEASE', label: 'Release for dispatch' },
        { value: 'HOLD', label: 'Hold (block stock)' },
        { value: 'DESTROY', label: 'Destroy (write off)' },
      ],
    },
    { name: 'expiryDate', label: 'Confirmed expiry date (optional)', type: 'date' },
    { name: 'reason', label: 'Reason / justification', type: 'textarea', required: true, span: 3 },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: 'Portal', href: '/portal' }, { label: 'Quality Assurance' }]}
        title="Quality Assurance & Food Safety"
        subtitle="Inspections, quarantine control, non-conformities and CAPA — release authority is separated from inspection authority."
        actions={<a href="/api/reports/export?type=quality-inspections" className="btn-secondary">Inspection register CSV</a>}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard label="Inspections (30 days)" value={total} sub={`${k.passed_30d} pass · ${k.conditional_30d} conditional · ${k.failed_30d} fail`} delayIndex={0} />
        <KPICard
          label="First-Time Pass Rate"
          value={`${fmtNum(passRate, 1)} %`}
          tone={passRate >= 90 ? 'success' : passRate >= 75 ? 'warning' : 'danger'}
          sub={`Average defect rate ${fmtNum(k.avg_defect_pct, 2)}%`}
          delayIndex={1}
        />
        <KPICard label="In Quarantine" value={Number(k.in_quarantine)} sub={`${k.held_lots} lots held across stores`} tone={Number(k.in_quarantine) > 0 ? 'warning' : 'success'} delayIndex={2} />
        <KPICard
          label="Open Non-Conformities"
          value={Number(k.open_ncr)}
          sub={`${k.critical_ncr} critical · ${k.overdue_ncr} overdue`}
          tone={Number(k.critical_ncr) > 0 ? 'danger' : Number(k.open_ncr) > 0 ? 'warning' : 'success'}
          delayIndex={3}
        />
        <KPICard label="Cold-Chain Excursions" value={Number(k.temp_excursions)} sub="Inspections above max allowed temp" tone={Number(k.temp_excursions) > 0 ? 'danger' : 'success'} delayIndex={4} />
      </div>

      {(canInspect || canRelease) && (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          {canInspect && (
            <RecordForm
              endpoint="/api/qa/inspections"
              title="Record inspection"
              buttonLabel="Record quality inspection"
              description="The pass/conditional/fail outcome is decided by server-side rules (temperature limits, defect thresholds, pest and residue compliance) — it cannot be overridden manually. Failures require a non-conformity with root cause and CAPA."
              fields={inspectionFields}
              submitLabel="Submit inspection"
            />
          )}
          {canRelease && (
            <RecordForm
              endpoint="/api/qa/release"
              title="Release / hold decision"
              buttonLabel="Release or hold quarantined stock"
              buttonClass="btn-secondary"
              description="Segregation of duties: the inspector who recorded the latest inspection on a batch cannot release it. Failed batches cannot be released until their non-conformity is resolved."
              fields={releaseFields}
              submitLabel="Record decision"
            />
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Inspection outcomes — last 14 days">
          <div className="p-4">
            <StackedBarChart
              data={trend.map((t) => ({ name: t.name, pass: t.pass, conditional: t.conditional, fail: t.fail }))}
              keys={['pass', 'conditional', 'fail']}
              height={250}
            />
          </div>
        </Card>

        <Card title="Inspection register" className="lg:col-span-2">
          <DataTable
            headers={['Inspection', 'Stage', 'Subject', 'Temp', 'Defects', 'Result', 'Quarantine', 'Inspector', 'Released by', 'When']}
            emptyMessage="No inspections recorded."
            rows={insp.map((i) => [
              <span key="c" className="font-mono text-[10px] text-chalar-700">{String(i.inspectionCode)}</span>,
              <span key="s" className="text-[10px]">{String(i.stage).replace(/_/g, ' ')}</span>,
              <span key="sub" className="font-mono text-[10px] text-stone-500">{String(i.subject)}</span>,
              <span key="t" className={`tabular-nums text-[10px] ${Number(i.measuredTemp) > Number(i.maxTemp) ? 'font-semibold text-red-600' : ''}`}>
                {fmtNum(String(i.measuredTemp ?? 0), 1)}/{fmtNum(String(i.maxTemp ?? 0), 1)}°C
              </span>,
              <span key="d" className="tabular-nums text-[10px]">{fmtNum(String(i.defects ?? 0), 2)}%</span>,
              <span key="r"><StatusBadge status={String(i.result)} /></span>,
              <span key="q"><StatusBadge status={String(i.quarantine)} /></span>,
              <span key="i" className="text-[10px] text-stone-500">{String(i.inspector ?? '—')}</span>,
              <span key="rb" className="text-[10px] text-stone-500">{String(i.releasedBy ?? '—')}</span>,
              <span key="at" className="whitespace-nowrap text-[10px] text-stone-400">{fmtDateTime(String(i.inspectedAt ?? ''))}</span>,
            ])}
          />
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Non-conformities & CAPA">
          <DataTable
            headers={['NCR', 'Severity', 'Category', 'Description', 'Root cause', 'Corrective action', 'Preventive action', 'Owner', 'Due', 'Status']}
            emptyMessage="No non-conformities recorded."
            rows={ncrs.map((n) => [
              <span key="c" className="font-mono text-[10px] text-chalar-700">{String(n.ncrNumber)}</span>,
              <span key="s"><StatusBadge status={String(n.severity)} /></span>,
              <span key="cat" className="text-[10px]">{String(n.category)}</span>,
              <span key="d" className="max-w-[240px] text-[11px] text-stone-600">{String(n.description)}</span>,
              <span key="rc" className="max-w-[200px] text-[11px] text-stone-600">{String(n.rootCause)}</span>,
              <span key="ca" className="max-w-[200px] text-[11px] text-stone-600">{String(n.correctiveAction)}</span>,
              <span key="pa" className="max-w-[200px] text-[11px] text-stone-600">{String(n.preventiveAction)}</span>,
              <span key="o" className="text-[10px] text-stone-500">{String(n.assignedTo ?? '—')}</span>,
              <span key="due" className="text-[10px]">{fmtDate(String(n.dueDate ?? ''))}</span>,
              <span key="st"><StatusBadge status={String(n.status)} /></span>,
            ])}
          />
        </Card>
      </div>
    </div>
  );
}
