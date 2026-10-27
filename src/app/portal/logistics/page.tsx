import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { getSessionFromCookies } from '@/lib/server-session';
import { hasPermission } from '@/lib/auth';
import { logisticsKpis, shipments, fleet, shipmentsByStatus, many } from '@/lib/ops-queries';
import { KPICard, PageHeader, Card, DataTable, StatusBadge, fmtKes, fmtNum, fmtDateTime } from '@/components/portal/ui';
import { DonutChart } from '@/components/portal/charts';
import { DispatchForm } from './dispatch-form';

export const dynamic = 'force-dynamic';

export default async function LogisticsDashboard() {
  const user = await getSessionFromCookies();
  if (!user) redirect('/login');
  if (!hasPermission(user, 'dashboard.logistics')) redirect('/portal/workspaces');

  const canManage = hasPermission(user, 'logistics.manage');

  const [k, ship, vehicles, byStatus, packableOrders, fleetOptions] = await Promise.all([
    logisticsKpis(),
    shipments(15),
    fleet(),
    shipmentsByStatus(),
    many<{ value: string; label: string; allocated: string; customer: string; spec: string }>(sql`
      SELECT so.order_number AS value,
             so.order_number || ' — ' || c.name || ' (' || so.status || ')' AS label,
             so.allocated_kg AS allocated, c.name AS customer, c.cold_chain_spec_c AS spec
      FROM sales_orders so JOIN customers c ON c.id = so.customer_id
      WHERE so.status IN ('PACKED','STOCK_RESERVED','APPROVED')
      ORDER BY so.requested_delivery_date::date LIMIT 40;`),
    many<{ id: number; label: string; status: string; range: string }>(sql`
      SELECT id, registration_number || ' — ' || make_model || ' (' || driver_name || ')' AS label,
             status, reefer_temp_min_c || '°C to ' || COALESCE(reefer_temp_max_c::text, '—') AS range
      FROM vehicles ORDER BY status, registration_number;`),
  ]);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: 'Portal', href: '/portal' }, { label: 'Logistics & Cold Chain' }]}
        title="Logistics & Cold Chain"
        subtitle="Refrigerated fleet from Taveta to JKIA, dispatch verification with temperature gates, airwaybill tracking and proof of delivery."
        actions={<a href="/api/reports/export?type=shipments" className="btn-secondary">Shipment register CSV</a>}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard label="Active Shipments" value={Number(k.active_shipments)} sub={`${k.in_air} departed by air · ${k.delivered} delivered`} delayIndex={0} />
        <KPICard label="Exceptions" value={Number(k.exceptions)} tone={Number(k.exceptions) > 0 ? 'danger' : 'success'} sub="Temperature or delivery failures" delayIndex={1} />
        <KPICard label="Dispatched (30 days)" value={`${fmtNum(k.kg_30d)} kg`} sub={`Transport cost ${fmtKes(k.cost_30d)}`} delayIndex={2} />
        <KPICard
          label="Avg Departure Temp"
          value={`${fmtNum(k.avg_departure_c, 1)} °C`}
          sub={`${k.temp_excursions} arrivals above 8 °C`}
          tone={Number(k.temp_excursions) > 0 ? 'warning' : 'success'}
          delayIndex={3}
        />
        <KPICard
          label="Fleet Availability"
          value={`${k.vehicles_available} / ${Number(k.vehicles_available) + Number(k.vehicles_in_transit) + Number(k.vehicles_down)}`}
          sub={`${k.vehicles_in_transit} in transit · ${k.vehicles_down} in maintenance`}
          tone={Number(k.vehicles_down) > 0 ? 'warning' : 'success'}
          delayIndex={4}
        />
      </div>

      {canManage && (
        <div className="mb-4">
          <DispatchForm orders={packableOrders} vehicles={fleetOptions} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Shipments by status">
          <div className="p-4">
            <DonutChart data={byStatus.map((s) => ({ name: s.name.replace(/_/g, ' '), value: s.value }))} height={240} />
          </div>
        </Card>

        <Card title="Refrigerated fleet" className="lg:col-span-2">
          <DataTable
            headers={['Registration', 'Type', 'Model', 'Reefer range', 'Driver', 'Contact', 'Route', 'Active loads', 'Status']}
            emptyMessage="No vehicles registered."
            rows={vehicles.map((v) => [
              <span key="r" className="font-mono text-xs text-chalar-700">{String(v.registration)}</span>,
              <span key="t" className="text-[10px]">{String(v.type).replace(/_/g, ' ')}</span>,
              <span key="m" className="text-xs">{String(v.model)}</span>,
              <span key="tr" className="tabular-nums text-[10px]">{fmtNum(v.tempMin, 1)} – {v.tempMax != null ? `${fmtNum(v.tempMax, 1)} °C` : '—'}</span>,
              <span key="d" className="text-xs">{String(v.driver)}</span>,
              <span key="p" className="text-[10px] text-stone-500">{String(v.phone)}</span>,
              <span key="rt" className="max-w-[180px] truncate text-[10px] text-stone-500" title={String(v.route ?? '')}>{String(v.route ?? '—')}</span>,
              <span key="l" className="tabular-nums text-xs">{v.activeLoads}</span>,
              <span key="s"><StatusBadge status={String(v.status)} /></span>,
            ])}
          />
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Shipment register">
          <DataTable
            headers={['Shipment', 'Order', 'Customer', 'Dest.', 'Vehicle', 'Driver', 'AWB', 'Airline', 'Kg', 'Cartons', 'Dep. °C', 'Arr. °C', 'Cost', 'Dispatched', 'Status', 'POD']}
            emptyMessage="No shipments recorded."
            rows={ship.map((s) => [
              <span key="c" className="font-mono text-[10px] text-chalar-700">{String(s.shipmentCode)}</span>,
              <span key="o" className="font-mono text-[10px]">{String(s.orderNumber ?? '—')}</span>,
              <span key="cu" className="text-[10px]">{String(s.customer ?? '—')}</span>,
              <span key="d" className="text-[10px]">{String(s.destination ?? '—')}</span>,
              <span key="v" className="font-mono text-[10px]">{String(s.vehicle ?? '—')}</span>,
              <span key="dr" className="text-[10px] text-stone-500">{String(s.driver ?? '—')}</span>,
              <span key="a" className="font-mono text-[10px]">{String(s.awb ?? 'pending')}</span>,
              <span key="al" className="text-[10px] text-stone-500">{String(s.airline ?? '—')}</span>,
              <span key="kg" className="tabular-nums text-[10px]">{fmtNum(s.kg)}</span>,
              <span key="ct" className="tabular-nums text-[10px]">{s.cartons}</span>,
              <span key="dt" className="tabular-nums text-[10px]">{fmtNum(s.departureTemp, 1)}</span>,
              <span key="at" className={`tabular-nums text-[10px] ${s.arrivalTemp != null && Number(s.arrivalTemp) > 8 ? 'font-semibold text-red-600' : ''}`}>
                {s.arrivalTemp != null ? fmtNum(s.arrivalTemp, 1) : '—'}
              </span>,
              <span key="cost" className="tabular-nums text-[10px]">{fmtKes(s.cost)}</span>,
              <span key="ts" className="whitespace-nowrap text-[10px] text-stone-400">{fmtDateTime(String(s.dispatchedAt ?? ''))}</span>,
              <span key="s"><StatusBadge status={String(s.status)} /></span>,
              <span key="pod" className="text-[10px] text-stone-500">{String(s.pod ?? '—')}</span>,
            ])}
          />
        </Card>
      </div>
      <p className="mt-2 text-[11px] text-stone-400">
        Cold-chain targets: most herbs 2–4 °C, basil 8–10 °C. Dispatch is blocked when the load
        temperature or the vehicle reefer range cannot hold the customer specification.
      </p>
    </div>
  );
}

