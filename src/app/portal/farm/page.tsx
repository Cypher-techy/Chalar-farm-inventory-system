import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/lib/server-session';
import { hasPermission } from '@/lib/auth';
import {
  farmKpis,
  cropCycleList,
  recentHarvestBatches,
  harvestByCrop,
  harvestDailySeries,
  weeklyTargetsVsActual,
  fieldActivityLog,
  fieldUtilisation,
  phiWarnings,
  farmOptions,
} from '@/lib/farm-queries';
import { KPICard, PageHeader, Card, DataTable, StatusBadge, fmtNum, fmtDate, fmtKes } from '@/components/portal/ui';
import { SimpleBarChart, StackedBarChart, SimpleLineChart } from '@/components/portal/charts';
import HarvestForm from './harvest-form';

export const dynamic = 'force-dynamic';

export default async function FarmDashboard() {
  const user = await getSessionFromCookies();
  if (!user) redirect('/login');
  if (!hasPermission(user, 'dashboard.farm')) redirect('/portal/workspaces');

  const canRecord = hasPermission(user, 'farm.create');

  const [k, cycles, batches, byCrop, daily, targets, activities, fields, phi, options] =
    await Promise.all([
      farmKpis(),
      cropCycleList(12),
      recentHarvestBatches(12),
      harvestByCrop(30),
      harvestDailySeries(14),
      weeklyTargetsVsActual(),
      fieldActivityLog(14),
      fieldUtilisation(),
      phiWarnings(),
      farmOptions(),
    ]);

  const targetData = targets.map((t) => ({
    name: t.name,
    target: Number(t.target),
    actual: Number(t.actual),
  }));

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: 'Portal', href: '/portal' }, { label: 'Farm Operations' }]}
        title="Farm Operations"
        subtitle="Crop cycles, harvest batches, field activities and pre-harvest interval control across the Taveta production site."
        actions={
          <>
            {canRecord && <HarvestForm cycles={options.cycles} />}
            <a href="/api/reports/export?type=farm-harvest" className="btn-secondary">Export CSV</a>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard label="Active Crop Cycles" value={k.active_cycles} sub={`${k.growing} growing · ${k.harvesting} harvesting · ${k.planned} planned`} delayIndex={0} />
        <KPICard label="Area Under Production" value={`${fmtNum(k.hectares_active, 2)} ha`} sub={`${k.greenhouses} greenhouses · ${k.open_fields} open fields`} delayIndex={1} />
        <KPICard label="Harvested Today" value={`${fmtNum(k.today_harvest_kg)} kg`} tone={Number(k.today_harvest_kg) > 0 ? 'success' : 'neutral'} delayIndex={2} />
        <KPICard label="Harvested (7 days)" value={`${fmtNum(k.week_harvest_kg)} kg`} sub={`${fmtNum(k.month_harvest_kg)} kg in 30 days`} delayIndex={3} />
        <KPICard
          label="Yield vs Expected"
          value={`${fmtNum(k.yield_vs_target_pct, 1)} %`}
          tone={Number(k.yield_vs_target_pct) >= 90 ? 'success' : Number(k.yield_vs_target_pct) >= 70 ? 'warning' : 'danger'}
          sub={`${k.open_batches} batches in packhouse · ${k.quarantined_batches} quarantined`}
          delayIndex={4}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Weekly target vs actual harvest (kg)">
          <div className="p-4">
            <StackedBarChart data={targetData} keys={['target', 'actual']} height={280} />
          </div>
        </Card>
        <Card title="Harvest trend — last 14 days (kg)">
          <div className="p-4">
            <SimpleLineChart data={daily.map((d) => ({ name: d.name, value: Number(d.value) }))} height={280} />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Harvest by crop (30 days)">
          <div className="p-4">
            <SimpleBarChart data={byCrop.map((c) => ({ name: c.name, value: Number(c.value) }))} height={250} />
          </div>
        </Card>

        <Card title="Pre-harvest interval (PHI) watchlist" className="lg:col-span-2">
          <DataTable
            headers={['Field', 'Crop', 'Activity', 'Input', 'Applied', 'PHI days', 'Clear date']}
            emptyMessage="No active pre-harvest intervals — all treated blocks are clear for cutting."
            rows={phi.map((p) => [
              <span key="f" className="text-sm">{p.field}</span>,
              <span key="c" className="text-sm">{p.crop ?? '—'}</span>,
              <span key="a"><StatusBadge status={p.activityType} tone="info" /></span>,
              <span key="i" className="text-xs text-stone-600">{p.inputName}</span>,
              <span key="d" className="text-xs">{fmtDate(p.activityDate)}</span>,
              <span key="p" className="tabular-nums">{p.phiDays}</span>,
              <span key="cl" className="text-xs font-medium text-amber-700">{fmtDate(p.clearDate)}</span>,
            ])}
          />
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Open crop cycles">
          <DataTable
            headers={['Cycle', 'Crop', 'Field', 'Status', 'Area (ha)', 'Planted', 'Expected harvest', 'Expected yield', 'Actual', 'Supervisor']}
            emptyMessage="No open crop cycles."
            rows={cycles.map((c) => [
              <span key="cc" className="font-mono text-xs text-chalar-700">{c.cycleCode}</span>,
              <span key="cr" className="text-sm">{c.crop}</span>,
              <span key="f" className="text-xs text-stone-600">{c.field} <span className="text-stone-400">({c.fieldType.replace('_', ' ')})</span></span>,
              <span key="s"><StatusBadge status={c.status} /></span>,
              <span key="a" className="tabular-nums">{fmtNum(c.plantedAreaHa, 2)}</span>,
              <span key="p" className="text-xs">{fmtDate(c.plantingDate)}</span>,
              <span key="e" className="text-xs">{fmtDate(c.expectedHarvestDate)}</span>,
              <span key="ey" className="tabular-nums">{fmtNum(c.expectedYieldKg)} kg</span>,
              <span key="ay" className="tabular-nums">{c.actualHarvestedKg ? `${fmtNum(c.actualHarvestedKg)} kg` : '—'}</span>,
              <span key="sup" className="text-xs text-stone-500">{c.supervisor ?? '—'}</span>,
            ])}
          />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Recent harvest batches">
          <DataTable
            headers={['Batch', 'Crop / Field', 'Date', 'Gross', 'Rejects', 'Net', 'Status']}
            emptyMessage="No harvest batches recorded."
            rows={batches.map((b) => [
              <span key="b" className="font-mono text-xs text-chalar-700">{b.batchNumber}</span>,
              <span key="cf" className="text-xs">{b.crop} <span className="text-stone-400">· {b.field}</span></span>,
              <span key="d" className="text-xs">{fmtDate(b.harvestDate)}</span>,
              <span key="g" className="tabular-nums">{fmtNum(b.harvestedWeightKg)}</span>,
              <span key="r" className="tabular-nums text-red-600">{fmtNum(b.rejectedFieldWeightKg)}</span>,
              <span key="n" className="tabular-nums font-medium">{fmtNum(b.netTransferredKg)}</span>,
              <span key="s"><StatusBadge status={b.status} /></span>,
            ])}
          />
        </Card>

        <Card title="Field utilisation">
          <DataTable
            headers={['Field', 'Status', 'Area (ha)', 'Current crop', 'Cycle']}
            emptyMessage="No fields registered."
            rows={fields.map((f) => [
              <span key="n" className="text-sm">{f.name}</span>,
              <span key="s"><StatusBadge status={f.status} /></span>,
              <span key="a" className="tabular-nums">{fmtNum(f.areaHa, 2)}</span>,
              <span key="c" className="text-xs">{f.crop ?? <span className="text-stone-400">Fallow / between cycles</span>}</span>,
              <span key="cc" className="font-mono text-[10px] text-stone-400">{f.cycleCode ?? '—'}</span>,
            ])}
          />
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Field activity log (traceability record)">
          <DataTable
            headers={['Date', 'Type', 'Field', 'Crop', 'Input', 'Qty', 'PHI', 'Labour', 'Cost', 'Recorded by', 'Finding']}
            emptyMessage="No field activities logged."
            rows={activities.map((a) => [
              <span key="d" className="whitespace-nowrap text-xs">{fmtDate(a.activityDate)}</span>,
              <span key="t"><StatusBadge status={a.activityType} tone="info" /></span>,
              <span key="f" className="text-xs">{a.field}</span>,
              <span key="c" className="text-xs">{a.crop ?? '—'}</span>,
              <span key="i" className="text-xs">{a.inputName ?? '—'}</span>,
              <span key="q" className="text-xs tabular-nums">{a.inputQuantity ? `${fmtNum(a.inputQuantity)} ${a.inputUnit ?? ''}` : '—'}</span>,
              <span key="p" className="text-xs tabular-nums">{a.phiDays > 0 ? `${a.phiDays} d` : '—'}</span>,
              <span key="l" className="text-xs tabular-nums">{fmtNum(a.labourHours)} h</span>,
              <span key="cost" className="text-xs tabular-nums">{fmtKes(a.costKes)}</span>,
              <span key="r" className="text-xs text-stone-500">{a.recordedBy ?? '—'}</span>,
              <span key="fi" className="max-w-[220px] truncate text-xs text-stone-600" title={a.finding ?? ''}>{a.finding ?? '—'}</span>,
            ])}
          />
        </Card>
      </div>
    </div>
  );
}
