import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { getSessionFromCookies } from '@/lib/server-session';
import { hasPermission } from '@/lib/auth';
import { salesKpis, salesOrders, revenueByMarket, revenueByCustomer, exportDocuments, many } from '@/lib/ops-queries';
import { KPICard, PageHeader, Card, DataTable, StatusBadge, fmtKes, fmtNum, fmtDate } from '@/components/portal/ui';
import { DonutChart, SimpleBarChart } from '@/components/portal/charts';
import { type FieldDef } from '@/components/portal/record-form';
import SalesStatusForm from './sales-status-form';

export const dynamic = 'force-dynamic';

export default async function SalesDashboard() {
  const user = await getSessionFromCookies();
  if (!user) redirect('/login');
  if (!hasPermission(user, 'dashboard.sales')) redirect('/portal/workspaces');

  const canManage = hasPermission(user, 'sales.manage');

  const [k, orders, markets, customers, docs, orderOptions, batchOptions] = await Promise.all([
    salesKpis(),
    salesOrders(15),
    revenueByMarket(),
    revenueByCustomer(),
    exportDocuments(15),
    many<{ value: string; label: string; status: string; allocated: string; ordered: string }>(sql`
      SELECT order_number AS value, order_number || ' — ' || status AS label, status,
             allocated_kg AS allocated, ordered_kg AS ordered
      FROM sales_orders WHERE status NOT IN ('PAID','CANCELLED') ORDER BY created_at DESC LIMIT 40;`),
    many<{ value: string; label: string; qa: string }>(sql`
      SELECT packing_batch_code AS value, packing_batch_code || ' — ' || net_weight_kg || ' kg (' || qa_status || ')' AS label,
             qa_status AS qa
      FROM packing_batches ORDER BY created_at DESC LIMIT 40;`),
  ]);

  const allocated = Number(k.allocated_kg_30d ?? 0);
  const ordered = Number(k.ordered_kg_30d ?? 0);
  const fillRate = ordered > 0 ? (allocated / ordered) * 100 : 0;

  const statusFields: FieldDef[] = [
    {
      name: 'orderNumber',
      label: 'Sales order',
      type: 'select',
      required: true,
      span: 2,
      options: orderOptions.map((o) => ({ value: o.value, label: `${o.label} · allocated ${fmtNum(o.allocated)}/${fmtNum(o.ordered)} kg` })),
      hint: 'Endpoint is /api/sales/orders/{number}/status — the portal form posts to the selected order.',
    },
    {
      name: 'status',
      label: 'New status',
      type: 'select',
      required: true,
      options: [
        { value: 'APPROVED', label: 'APPROVED (needs sales approval right)' },
        { value: 'STOCK_RESERVED', label: 'STOCK_RESERVED' },
        { value: 'PACKED', label: 'PACKED (needs a QA-passed batch)' },
        { value: 'DISPATCHED', label: 'DISPATCHED' },
        { value: 'DELIVERED', label: 'DELIVERED' },
        { value: 'INVOICED', label: 'INVOICED' },
        { value: 'PAID', label: 'PAID' },
        { value: 'CANCELLED', label: 'CANCELLED (releases allocation)' },
      ],
    },
    { name: 'allocatedKg', label: 'Allocation (kg)', type: 'number', step: '0.01', min: 0, hint: 'Validated against QA-released, unexpired stock.' },
    { name: 'packingBatchCode', label: 'Packing batch (for PACKED)', type: 'select', options: batchOptions.map((b) => ({ value: b.value, label: b.label })) },
    { name: 'reason', label: 'Reason / note', type: 'textarea', span: 3 },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: 'Portal', href: '/portal' }, { label: 'Sales & Export' }]}
        title="Sales & Export Orders"
        subtitle="Customer orders, stock allocation against QA-released batches, export documentation and market performance."
        actions={<a href="/api/reports/export?type=sales-orders" className="btn-secondary">Order book CSV</a>}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard label="Open Orders" value={Number(k.orders_open)} sub={`${k.orders_30d} raised in 30 days · ${k.under_allocated} under-allocated`} delayIndex={0} />
        <KPICard label="Revenue (30 days)" value={fmtKes(k.revenue_30d)} sub={`≈ EUR ${fmtNum(k.revenue_eur_30d, 0)}`} tone="success" delayIndex={1} />
        <KPICard
          label="Allocation Fill Rate"
          value={`${fmtNum(fillRate, 1)} %`}
          sub={`${fmtNum(allocated)} kg allocated of ${fmtNum(ordered)} kg ordered`}
          tone={fillRate >= 95 ? 'success' : fillRate >= 80 ? 'warning' : 'danger'}
          delayIndex={2}
        />
        <KPICard label="Dispatched (30 days)" value={`${fmtNum(k.dispatched_kg_30d)} kg`} sub={`${k.active_customers} active customers`} delayIndex={3} />
        <KPICard
          label="Export Documents"
          value={Number(k.docs_in_progress)}
          sub={`${k.docs_expiring} expiring within 7 days`}
          tone={Number(k.docs_expiring) > 0 ? 'warning' : 'neutral'}
          delayIndex={4}
        />
      </div>

      {canManage && (
        <div className="mb-4">
          <SalesStatusForm orders={orderOptions} batches={batchOptions} fields={statusFields} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Revenue by destination market">
          <div className="p-4">
            <DonutChart data={markets.map((m) => ({ name: m.name, value: Number(m.value) }))} height={250} />
          </div>
        </Card>
        <Card title="Revenue by customer" className="lg:col-span-2">
          <div className="p-4">
            <SimpleBarChart data={customers.map((c) => ({ name: c.name.split(' ')[0], value: Number(c.value) }))} height={250} />
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Order book">
          <DataTable
            headers={['Order', 'Customer', 'Market', 'Product', 'Ordered', 'Allocated', 'Dispatched', 'Price', 'Total', 'Delivery', 'Batch', 'Status', 'Payment']}
            emptyMessage="No sales orders."
            rows={orders.map((o) => [
              <span key="n" className="font-mono text-[10px] text-chalar-700">{String(o.orderNumber)}</span>,
              <span key="c" className="text-xs">{String(o.customer)}<span className="block text-[10px] text-stone-400">{String(o.buyerType)}</span></span>,
              <span key="m" className="text-[10px]">{String(o.country)}</span>,
              <span key="p" className="text-xs">{String(o.product)}</span>,
              <span key="o" className="tabular-nums text-xs">{fmtNum(o.ordered)}</span>,
              <span key="a" className="tabular-nums text-xs">{fmtNum(o.allocated)}</span>,
              <span key="d" className="tabular-nums text-xs">{fmtNum(o.dispatched)}</span>,
              <span key="up" className="tabular-nums text-[10px]">{String(o.currency)} {fmtNum(o.unitPrice, 2)}</span>,
              <span key="t" className="tabular-nums text-xs">{fmtKes(o.totalKes)}</span>,
              <span key="dl" className="text-[10px]">{fmtDate(String(o.deliveryDate ?? ''))}</span>,
              <span key="pb" className="font-mono text-[10px] text-stone-500">{String(o.packingBatch ?? '—')}</span>,
              <span key="s"><StatusBadge status={String(o.status)} /></span>,
              <span key="ps"><StatusBadge status={String(o.paymentStatus)} /></span>,
            ])}
          />
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Export documentation register">
          <DataTable
            headers={['Document', 'Type', 'Authority', 'Issued', 'Expires', 'Order', 'Shipment', 'Verified by', 'Status', 'Notes']}
            emptyMessage="No export documents recorded."
            rows={docs.map((dc) => [
              <span key="n" className="font-mono text-[10px] text-chalar-700">{String(dc.docNumber)}</span>,
              <span key="t" className="text-[10px]">{String(dc.docType).replace(/_/g, ' ')}</span>,
              <span key="a" className="text-[10px] text-stone-500">{String(dc.authority)}</span>,
              <span key="i" className="text-[10px]">{fmtDate(String(dc.issueDate ?? ''))}</span>,
              <span key="e" className="text-[10px]">{fmtDate(String(dc.expiryDate ?? ''))}</span>,
              <span key="o" className="font-mono text-[10px]">{String(dc.orderNumber ?? '—')}</span>,
              <span key="s" className="font-mono text-[10px]">{String(dc.shipmentCode ?? '—')}</span>,
              <span key="v" className="text-[10px] text-stone-500">{String(dc.verifiedBy ?? '—')}</span>,
              <span key="st"><StatusBadge status={String(dc.status)} /></span>,
              <span key="no" className="max-w-[260px] truncate text-[10px] text-stone-500" title={String(dc.notes ?? '')}>{String(dc.notes ?? '—')}</span>,
            ])}
          />
          <p className="border-t border-stone-100 px-4 py-2 text-[10px] text-stone-400">
            Certificate numbers appear only where an issuing authority has provided them. Documents
            awaiting issue are shown as pending rather than filled with placeholder numbers.
          </p>
        </Card>
      </div>
    </div>
  );
}

