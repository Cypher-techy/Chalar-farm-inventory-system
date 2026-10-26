import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { getSessionFromCookies } from '@/lib/server-session';
import { hasPermission } from '@/lib/auth';
import {
  procurementKpis,
  requisitions,
  purchaseOrders,
  supplierInvoices,
  spendBySupplier,
  many,
} from '@/lib/ops-queries';
import { KPICard, PageHeader, Card, DataTable, StatusBadge, fmtKes, fmtNum, fmtDate } from '@/components/portal/ui';
import { SimpleBarChart } from '@/components/portal/charts';
import RecordForm, { type FieldDef } from '@/components/portal/record-form';
import { ApprovalButtons } from '../hr/leave-desk';

export const dynamic = 'force-dynamic';

export default async function ProcurementDashboard() {
  const user = await getSessionFromCookies();
  if (!user) redirect('/login');
  if (!hasPermission(user, 'dashboard.procurement')) redirect('/portal/workspaces');

  const canCreate = hasPermission(user, 'procurement.create');
  const canReceive = hasPermission(user, 'inventory.create');
  const canDecide = hasPermission(user, 'procurement.approve');

  const [k, reqs, pos, invoices, spend, departments, products, warehouses, openPos] =
    await Promise.all([
      procurementKpis(),
      requisitions(14),
      purchaseOrders(14),
      supplierInvoices(14),
      spendBySupplier(),
      many<{ id: number; label: string }>(sql`SELECT id, name AS label FROM departments ORDER BY name;`),
      many<{ id: number; label: string; stock: string; reorder: string }>(sql`
        SELECT id, sku || ' — ' || name AS label, physical_stock AS stock, reorder_level AS reorder
        FROM products WHERE is_active ORDER BY name LIMIT 100;`),
      many<{ id: number; label: string }>(sql`SELECT id, code || ' — ' || name AS label FROM warehouses WHERE is_active ORDER BY code;`),
      many<{ id: number; label: string; outstanding: string; unit: string; price: string }>(sql`
        SELECT po.id, po.po_number || ' — ' || p.name AS label,
               (po.ordered_qty::numeric - po.received_qty::numeric)::text AS outstanding,
               p.uom_code AS unit, po.unit_price_kes AS price
        FROM purchase_orders po JOIN products p ON p.id = po.product_id
        WHERE po.status IN ('APPROVED','ISSUED','PARTIALLY_RECEIVED')
        ORDER BY po.created_at DESC LIMIT 40;`),
    ]);

  const requisitionFields: FieldDef[] = [
    { name: 'departmentId', label: 'Requesting department', type: 'select', required: true, options: departments.map((d) => ({ value: String(d.id), label: d.label })) },
    {
      name: 'productId',
      label: 'Item',
      type: 'select',
      required: true,
      span: 2,
      options: products.map((p) => ({ value: String(p.id), label: `${p.label} (stock ${fmtNum(p.stock)} / reorder ${fmtNum(p.reorder)})` })),
    },
    { name: 'quantity', label: 'Quantity', type: 'number', step: '0.01', min: 0.01, required: true },
    { name: 'estimatedUnitCostKes', label: 'Estimated unit cost (KES)', type: 'number', step: '0.01', min: 0, required: true },
    { name: 'requiredByDate', label: 'Required by', type: 'date' },
    { name: 'justification', label: 'Justification', type: 'textarea', required: true, span: 3, hint: 'Routed to Finance for commitments of KES 250,000 and above, otherwise to the Executive Manager.' },
  ];

  const grnFields: FieldDef[] = [
    { name: 'purchaseOrderId', label: 'Open purchase order', type: 'select', required: true, span: 2, options: openPos.map((p) => ({ value: String(p.id), label: `${p.label} — outstanding ${fmtNum(p.outstanding)} ${p.unit} @ ${fmtKes(p.price)}` })) },
    { name: 'warehouseId', label: 'Receiving warehouse', type: 'select', required: true, options: warehouses.map((w) => ({ value: String(w.id), label: w.label })) },
    { name: 'receivedQty', label: 'Received quantity', type: 'number', step: '0.01', min: 0.01, required: true },
    { name: 'rejectedQty', label: 'Rejected at intake', type: 'number', step: '0.01', min: 0, defaultValue: '0', hint: 'Rejected units are recorded but never enter stock.' },
    { name: 'deliveryNoteRef', label: 'Delivery note reference', type: 'text', required: true },
    { name: 'binCode', label: 'Bin code', type: 'text', defaultValue: 'GRN-STAGE' },
    { name: 'expiryDate', label: 'Expiry date (if applicable)', type: 'date' },
    { name: 'inspectionNotes', label: 'Intake inspection notes', type: 'textarea', span: 3 },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: 'Portal', href: '/portal' }, { label: 'Procurement' }]}
        title="Procurement & Supplier Management"
        subtitle="Requisitions with value-based approval routing, purchase orders, goods receipting into traceable lots, and three-way matching against supplier invoices."
        actions={<a href="/api/reports/export?type=purchase-orders" className="btn-secondary">PO register CSV</a>}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard label="Requisitions Pending" value={Number(k.reqs_pending)} sub={fmtKes(k.reqs_pending_value)} tone={Number(k.reqs_pending) > 0 ? 'warning' : 'success'} delayIndex={0} />
        <KPICard label="Open Purchase Orders" value={Number(k.pos_open)} sub={fmtKes(k.pos_open_value)} delayIndex={1} />
        <KPICard label="Supplier Payables" value={fmtKes(k.payables_value)} sub={`${k.overdue_invoices} invoices overdue`} tone={Number(k.overdue_invoices) > 0 ? 'danger' : 'neutral'} delayIndex={2} />
        <KPICard label="3-Way Match Exceptions" value={Number(k.match_exceptions)} sub="Invoice vs PO vs GRN variances" tone={Number(k.match_exceptions) > 0 ? 'danger' : 'success'} delayIndex={3} />
        <KPICard label="Active Suppliers" value={Number(k.active_suppliers)} sub={`${k.receipts_with_rejects} receipts with rejects (30d)`} delayIndex={4} />
      </div>

      {(canCreate || canReceive) && (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          {canCreate && (
            <RecordForm
              endpoint="/api/procurement/requisitions"
              title="Raise purchase requisition"
              buttonLabel="Raise purchase requisition"
              description="Creates a pending approval routed by value. You cannot approve your own requisition."
              fields={requisitionFields}
              submitLabel="Submit requisition"
            />
          )}
          {canReceive && (
            <RecordForm
              endpoint="/api/procurement/goods-receipts"
              title="Post goods receipt (GRN)"
              buttonLabel="Post goods receipt note"
              buttonClass="btn-secondary"
              description="Receives stock against an open PO, creates the inventory lot and posts a RECEIPT movement. Over-receipt beyond the outstanding PO quantity is blocked."
              fields={grnFields}
              submitLabel="Post GRN"
            />
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Spend by supplier (open + received POs)">
          <div className="p-4">
            <SimpleBarChart data={spend.map((s) => ({ name: s.name.split(' ')[0], value: Number(s.value) }))} height={250} />
          </div>
        </Card>

        <Card title="Requisitions" className="lg:col-span-2">
          <DataTable
            headers={['Req', 'Department', 'Item', 'Qty', 'Est. total', 'Requested by', 'Status', canDecide ? 'Decision' : 'Justification']}
            emptyMessage="No requisitions raised."
            rows={reqs.map((r) => [
              <span key="c" className="font-mono text-[10px] text-chalar-700">{String(r.reqNumber)}</span>,
              <span key="d" className="text-xs">{String(r.department)}</span>,
              <span key="p" className="text-xs">{String(r.product)}<span className="block text-[10px] text-stone-400">{String(r.sku)}</span></span>,
              <span key="q" className="tabular-nums text-xs">{fmtNum(r.quantity)}</span>,
              <span key="t" className="tabular-nums text-xs">{fmtKes(r.total)}</span>,
              <span key="by" className="text-[10px] text-stone-500">{String(r.requestedBy ?? '—')}</span>,
              <span key="s"><StatusBadge status={String(r.status)} /></span>,
              canDecide && r.status === 'PENDING_APPROVAL' && r.approvalCode ? (
                <ApprovalButtons key="a" code={String(r.approvalCode)} />
              ) : (
                <span key="j" className="max-w-[220px] truncate text-[11px] text-stone-500" title={String(r.justification ?? '')}>{String(r.justification ?? '—')}</span>
              ),
            ])}
          />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Purchase orders">
          <DataTable
            headers={['PO', 'Supplier', 'Item', 'Ordered', 'Received', 'Unit price', 'Total', 'Expected', 'Status']}
            emptyMessage="No purchase orders."
            rows={pos.map((p) => [
              <span key="c" className="font-mono text-[10px] text-chalar-700">{String(p.poNumber)}</span>,
              <span key="s" className="text-xs">{String(p.supplier)}</span>,
              <span key="p" className="text-xs">{String(p.product)}</span>,
              <span key="o" className="tabular-nums text-xs">{fmtNum(p.ordered)}</span>,
              <span key="r" className="tabular-nums text-xs">{fmtNum(p.received)}</span>,
              <span key="up" className="tabular-nums text-[10px]">{fmtKes(p.unitPrice)}</span>,
              <span key="t" className="tabular-nums text-xs">{fmtKes(p.total)}</span>,
              <span key="e" className="text-[10px]">{fmtDate(String(p.expected ?? ''))}</span>,
              <span key="st"><StatusBadge status={String(p.status)} /></span>,
            ])}
          />
        </Card>

        <Card title="Supplier invoices & three-way match">
          <DataTable
            headers={['Invoice', 'Supplier', 'PO', 'Invoice', 'PO value', 'GRN value', 'Match', 'Payment', 'Due']}
            emptyMessage="No supplier invoices."
            rows={invoices.map((i) => [
              <span key="n" className="font-mono text-[10px] text-chalar-700">{String(i.invoiceNumber)}</span>,
              <span key="s" className="text-xs">{String(i.supplier)}</span>,
              <span key="po" className="font-mono text-[10px] text-stone-500">{String(i.poNumber)}</span>,
              <span key="a" className="tabular-nums text-xs">{fmtKes(i.invoice)}</span>,
              <span key="b" className="tabular-nums text-[10px]">{fmtKes(i.po_amount)}</span>,
              <span key="c" className="tabular-nums text-[10px]">{fmtKes(i.grn_amount)}</span>,
              <span key="m"><StatusBadge status={String(i.matchStatus)} /></span>,
              <span key="p"><StatusBadge status={String(i.paymentStatus)} /></span>,
              <span key="d" className="text-[10px]">{fmtDate(String(i.dueDate ?? ''))}</span>,
            ])}
          />
        </Card>
      </div>
    </div>
  );
}
