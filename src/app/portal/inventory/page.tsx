import { redirect } from 'next/navigation';
import { sql, desc } from 'drizzle-orm';
import { getDb } from '@/db';
import * as t from '@/db/schema';
import { getSessionFromCookies } from '@/lib/server-session';
import { hasPermission } from '@/lib/auth';
import { KPICard, PageHeader, Card, DataTable, StatusBadge, fmtKes, fmtNum } from '@/components/portal/ui';
import { DonutChart } from '@/components/portal/charts';
import MovementDesk from './movement-desk';

export const dynamic = 'force-dynamic';

export default async function InventoryDashboard() {
  const user = await getSessionFromCookies();
  if (!user) redirect('/login');
  if (!hasPermission(user, 'dashboard.inventory')) redirect('/portal/workspaces');

  const db = await getDb();
  const canCreate = hasPermission(user, 'inventory.create');

  const kpis = (await db.execute(sql`
    SELECT
      (SELECT COALESCE(SUM(physical_qty * unit_cost_kes), 0) FROM inventory_lots)::text AS valuation,
      (SELECT COALESCE(SUM(physical_qty), 0) FROM inventory_lots)::text AS total_qty,
      (SELECT count(*)::int FROM products WHERE is_active AND physical_stock <= reorder_level)::int AS low_stock,
      (SELECT count(*)::int FROM products WHERE is_active AND physical_stock <= 0)::int AS out_stock,
      (SELECT count(*)::int FROM inventory_lots WHERE quality_status IN ('QUARANTINED','BLOCKED','EXPIRED'))::int AS held_lots,
      (SELECT count(*)::int FROM stock_adjustments WHERE status = 'PENDING_APPROVAL')::int AS pending_adj,
      (SELECT count(*)::int FROM products WHERE is_active)::int AS active_skus,
      (SELECT count(*)::int FROM inventory_lots WHERE expiry_date IS NOT NULL AND expiry_date::date <= CURRENT_DATE + 7 AND physical_qty > 0)::int AS expiring_soon;
  `)) as unknown as { rows: Array<Record<string, string | number>> };
  const k = kpis.rows[0];

  const stockByCategory = (await db.execute(sql`
    SELECT pc.name AS name,
           COALESCE(SUM(p.physical_stock * p.unit_cost_kes), 0)::numeric AS value
    FROM products p
    JOIN product_categories pc ON pc.id = p.category_id
    GROUP BY pc.name
    ORDER BY value DESC;
  `)) as unknown as { rows: Array<{ name: string; value: string }> };

  const lowStock = (await db.execute(sql`
    SELECT sku, name, physical_stock AS stock, reorder_level AS reorder,
           safety_stock_level AS safety, uom_code AS uom
    FROM products
    WHERE is_active AND physical_stock <= reorder_level
    ORDER BY (physical_stock::numeric - reorder_level::numeric)
    LIMIT 10;
  `)) as unknown as { rows: Array<Record<string, string>> };

  const heldLots = (await db.execute(sql`
    SELECT l.lot_number AS lot, p.name AS product, l.physical_qty AS qty,
           l.quality_status AS status, l.expiry_date AS expiry, w.name AS wh
    FROM inventory_lots l
    JOIN products p ON p.id = l.product_id
    JOIN warehouses w ON w.id = l.warehouse_id
    WHERE l.quality_status IN ('QUARANTINED','BLOCKED','EXPIRED') OR (l.expiry_date IS NOT NULL AND l.expiry_date::date <= CURRENT_DATE + 7 AND l.physical_qty > 0)
    ORDER BY l.expiry_date NULLS LAST
    LIMIT 8;
  `)) as unknown as { rows: Array<Record<string, string>> };

  // Options for movement desk
  const productOpts = (await db.execute(sql`
    SELECT id, sku || ' — ' || name AS label FROM products WHERE is_active ORDER BY name LIMIT 80;
  `)) as unknown as { rows: Array<{ id: number; label: string }> };
  const whOpts = (await db.execute(sql`
    SELECT id, code || ' — ' || name AS label FROM warehouses WHERE is_active ORDER BY code;
  `)) as unknown as { rows: Array<{ id: number; label: string }> };
  const lotOpts = (await db.execute(sql`
    SELECT l.id, l.lot_number || ' · ' || p.sku AS label, l.warehouse_id AS "warehouseId",
           l.available_qty::float8 AS available, l.quality_status AS status
    FROM inventory_lots l
    JOIN products p ON p.id = l.product_id
    WHERE l.physical_qty > 0
    ORDER BY l.created_at DESC
    LIMIT 100;
  `)) as unknown as { rows: Array<{ id: number; label: string; warehouseId: number; available: number; status: string }> };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: 'Portal', href: '/portal' }, { label: 'Inventory & Warehouse' }]}
        title="Inventory & Warehouse"
        subtitle="Cold rooms, agro-input store, packaging & tools — lot-level traceability with FIFO costing, negative-stock prevention and auditable corrections."
        actions={
          <>
            <a href="/api/reports/export?type=inventory" className="btn-secondary">Export CSV</a>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Inventory Valuation (lots)" value={fmtKes(k?.valuation)} sub={`${fmtNum(k?.total_qty)} units on hand`} delayIndex={0} />
        <KPICard label="Low Stock SKUs" value={Number(k?.low_stock)} tone="warning" sub={`${k?.out_stock} fully out of stock`} delayIndex={1} />
        <KPICard label="Quarantined / Held Lots" value={Number(k?.held_lots)} tone={Number(k?.held_lots) > 0 ? 'danger' : 'success'} sub="Blocked from issuance" delayIndex={2} />
        <KPICard label="Expiring Within 7 Days" value={Number(k?.expiring_soon)} tone={Number(k?.expiring_soon) > 0 ? 'warning' : 'success'} sub={`${k?.pending_adj} adjustments pending approval`} delayIndex={3} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Stock value by category">
          <div className="p-4">
            <DonutChart
              data={stockByCategory.rows.map((r) => ({ name: r.name, value: Number(r.value) })).filter((r) => r.value > 0)}
            />
          </div>
        </Card>

        <Card title="Reorder alerts" className="lg:col-span-2">
          <DataTable
            headers={['SKU', 'Product', 'On hand', 'Reorder level', 'Safety stock', 'Status']}
            emptyMessage="All active SKUs are above their reorder thresholds."
            rows={lowStock.rows.map((p) => [
              <span key="s" className="font-mono text-xs text-chalar-700">{p.sku}</span>,
              <span key="n" className="text-sm">{p.name}</span>,
              <span key="o" className="tabular-nums">{fmtNum(p.stock)} {p.uom}</span>,
              <span key="r" className="tabular-nums text-stone-500">{fmtNum(p.reorder)}</span>,
              <span key="sf" className="tabular-nums text-stone-500">{fmtNum(p.safety)}</span>,
              <span key="st">
                <StatusBadge status={Number(p.stock) <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK'} />
              </span>,
            ])}
          />
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Lot watchlist — quarantined, blocked or expiring">
          <DataTable
            headers={['Lot', 'Product', 'Warehouse', 'Qty', 'Expiry', 'Status']}
            emptyMessage="No held or expiring lots."
            rows={heldLots.rows.map((l) => [
              <span key="l" className="font-mono text-xs text-chalar-700">{l.lot}</span>,
              <span key="p" className="text-sm">{l.product}</span>,
              <span key="w" className="text-xs text-stone-500">{l.wh}</span>,
              <span key="q" className="tabular-nums">{fmtNum(l.qty)}</span>,
              <span key="e" className="text-xs">{l.expiry ?? '—'}</span>,
              <span key="s"><StatusBadge status={l.status} /></span>,
            ])}
          />
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Stock movement ledger">
          <div className="p-4">
            <MovementDesk
              products={productOpts.rows}
              warehouses={whOpts.rows}
              lots={lotOpts.rows}
              canCreate={canCreate}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
