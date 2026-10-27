import { NextRequest, NextResponse } from 'next/server';
import { sql, type SQL } from 'drizzle-orm';
import { getDb } from '@/db';
import { ApiError, requireAuth, escapeCsvCell, jsonError } from '@/lib/guards';
import { hasPermission, recordAuditLog } from '@/lib/auth';
import { buildPdf, type PdfTable } from '@/lib/pdf';

export const dynamic = 'force-dynamic';

type Rows = { rows: Record<string, string | number | null>[] };

interface ReportDef {
  title: string;
  permission: string;
  query: SQL;
  columns: Array<{ key: string; label: string }>;
}

const REPORTS: Record<string, (period?: string) => ReportDef> = {
  inventory: () => ({
    title: 'Inventory valuation & stock position',
    permission: 'dashboard.inventory',
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Product' },
      { key: 'category', label: 'Category' },
      { key: 'uom', label: 'UoM' },
      { key: 'physical', label: 'Physical stock' },
      { key: 'reserved', label: 'Reserved' },
      { key: 'available', label: 'Available' },
      { key: 'reorder', label: 'Reorder level' },
      { key: 'unitCost', label: 'Unit cost (KES)' },
      { key: 'value', label: 'Stock value (KES)' },
    ],
    query: sql`
      SELECT p.sku, p.name, pc.name AS category, p.uom_code AS uom,
             p.physical_stock AS physical, p.reserved_stock AS reserved,
             p.available_stock AS available, p.reorder_level AS reorder,
             p.unit_cost_kes AS "unitCost",
             (p.physical_stock::numeric * p.unit_cost_kes::numeric) AS value
      FROM products p
      JOIN product_categories pc ON pc.id = p.category_id
      ORDER BY pc.name, p.name;
    `,
  }),
  'inventory-lots': () => ({
    title: 'Inventory lot traceability',
    permission: 'dashboard.inventory',
    columns: [
      { key: 'lot', label: 'Lot number' },
      { key: 'sku', label: 'SKU' },
      { key: 'warehouse', label: 'Warehouse' },
      { key: 'bin', label: 'Bin' },
      { key: 'physical', label: 'Physical qty' },
      { key: 'available', label: 'Available qty' },
      { key: 'unitCost', label: 'Unit cost (KES)' },
      { key: 'received', label: 'Received' },
      { key: 'expiry', label: 'Expiry' },
      { key: 'status', label: 'QA status' },
    ],
    query: sql`
      SELECT l.lot_number AS lot, p.sku, w.name AS warehouse, l.bin_code AS bin,
             l.physical_qty AS physical, l.available_qty AS available,
             l.unit_cost_kes AS "unitCost", l.received_date AS received,
             l.expiry_date AS expiry, l.quality_status AS status
      FROM inventory_lots l
      JOIN products p ON p.id = l.product_id
      JOIN warehouses w ON w.id = l.warehouse_id
      ORDER BY l.received_date::date DESC, l.lot_number;
    `,
  }),
  'stock-movements': () => ({
    title: 'Stock movement ledger',
    permission: 'dashboard.inventory',
    columns: [
      { key: 'movement', label: 'Movement' },
      { key: 'at', label: 'Timestamp' },
      { key: 'type', label: 'Type' },
      { key: 'sku', label: 'SKU' },
      { key: 'qty', label: 'Quantity' },
      { key: 'uom', label: 'UoM' },
      { key: 'totalCost', label: 'Value (KES)' },
      { key: 'reason', label: 'Reason' },
      { key: 'by', label: 'Performed by' },
    ],
    query: sql`
      SELECT sm.movement_number AS movement, sm.created_at AS at, sm.movement_type AS type,
             p.sku, sm.quantity AS qty, sm.uom_code AS uom, sm.total_cost_kes AS "totalCost",
             sm.reason, u.full_name AS by
      FROM stock_movements sm
      JOIN products p ON p.id = sm.product_id
      LEFT JOIN users u ON u.id = sm.performed_by_user_id
      ORDER BY sm.created_at DESC;
    `,
  }),
  'farm-harvest': () => ({
    title: 'Harvest batches',
    permission: 'dashboard.farm',
    columns: [
      { key: 'batch', label: 'Batch' },
      { key: 'date', label: 'Harvest date' },
      { key: 'crop', label: 'Crop' },
      { key: 'field', label: 'Field' },
      { key: 'gross', label: 'Gross (kg)' },
      { key: 'rejects', label: 'Field rejects (kg)' },
      { key: 'net', label: 'Net to packhouse (kg)' },
      { key: 'crates', label: 'Crates' },
      { key: 'temp', label: 'Field temp (°C)' },
      { key: 'status', label: 'Status' },
    ],
    query: sql`
      SELECT hb.batch_number AS batch, hb.harvest_date AS date, c.name AS crop, f.name AS field,
             hb.harvested_weight_kg AS gross, hb.rejected_field_weight_kg AS rejects,
             hb.net_transferred_kg AS net, hb.crates_count AS crates, hb.field_temp_c AS temp,
             hb.status
      FROM harvest_batches hb
      JOIN crop_catalog c ON c.id = hb.crop_id
      JOIN fields f ON f.id = hb.field_id
      ORDER BY hb.harvest_date::date DESC, hb.id DESC;
    `,
  }),
  payroll: (period?: string) => ({
    title: `Payroll register${period ? ` — ${period}` : ''}`,
    permission: 'payroll.view',
    columns: [
      { key: 'employeeCode', label: 'Employee code' },
      { key: 'name', label: 'Employee' },
      { key: 'department', label: 'Department' },
      { key: 'period', label: 'Period' },
      { key: 'basic', label: 'Basic (KES)' },
      { key: 'overtime', label: 'Overtime (KES)' },
      { key: 'gross', label: 'Gross (KES)' },
      { key: 'paye', label: 'PAYE (KES)' },
      { key: 'nssf', label: 'NSSF EE (KES)' },
      { key: 'shif', label: 'SHIF (KES)' },
      { key: 'housing', label: 'Housing levy EE (KES)' },
      { key: 'net', label: 'Net pay (KES)' },
      { key: 'status', label: 'Payment status' },
    ],
    query: period
      ? sql`
          SELECT e.employee_code AS "employeeCode", e.full_name AS name, d.name AS department,
                 ps.period_month AS period, ps.basic_pay_kes AS basic, ps.overtime_pay_kes AS overtime,
                 ps.gross_pay_kes AS gross, ps.paye_tax_kes AS paye, ps.nssf_employee_kes AS nssf,
                 ps.shif_kes AS shif, ps.housing_levy_employee_kes AS housing, ps.net_pay_kes AS net,
                 ps.payment_status AS status
          FROM payslip_records ps
          JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
          JOIN employee_profiles e ON e.id = ps.employee_id
          JOIN departments d ON d.id = e.department_id
          WHERE pr.period_month = ${period}
          ORDER BY e.employee_code;
        `
      : sql`
          SELECT e.employee_code AS "employeeCode", e.full_name AS name, d.name AS department,
                 ps.period_month AS period, ps.basic_pay_kes AS basic, ps.overtime_pay_kes AS overtime,
                 ps.gross_pay_kes AS gross, ps.paye_tax_kes AS paye, ps.nssf_employee_kes AS nssf,
                 ps.shif_kes AS shif, ps.housing_levy_employee_kes AS housing, ps.net_pay_kes AS net,
                 ps.payment_status AS status
          FROM payslip_records ps
          JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
          JOIN employee_profiles e ON e.id = ps.employee_id
          JOIN departments d ON d.id = e.department_id
          ORDER BY pr.period_month DESC, e.employee_code;
        `,
  }),
  'trial-balance': () => ({
    title: 'Trial balance (posted journals by account)',
    permission: 'dashboard.finance',
    columns: [
      { key: 'code', label: 'Account' },
      { key: 'name', label: 'Account name' },
      { key: 'type', label: 'Type' },
      { key: 'debit', label: 'Debits (KES)' },
      { key: 'credit', label: 'Credits (KES)' },
      { key: 'balance', label: 'Running balance (KES)' },
    ],
    query: sql`
      SELECT a.account_code AS code, a.account_name AS name, a.account_type AS type,
             COALESCE(SUM(jl.debit_kes), 0) AS debit,
             COALESCE(SUM(jl.credit_kes), 0) AS credit,
             a.balance_kes AS balance
      FROM chart_of_accounts a
      LEFT JOIN journal_lines jl ON jl.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'POSTED'
      GROUP BY a.id, a.account_code, a.account_name, a.account_type, a.balance_kes
      ORDER BY a.account_code;
    `,
  }),
  expenses: () => ({
    title: 'Expense register',
    permission: 'dashboard.finance',
    columns: [
      { key: 'expenseNumber', label: 'Expense' },
      { key: 'date', label: 'Date' },
      { key: 'department', label: 'Department' },
      { key: 'category', label: 'Category' },
      { key: 'vendor', label: 'Vendor' },
      { key: 'amount', label: 'Amount (KES)' },
      { key: 'tax', label: 'VAT (KES)' },
      { key: 'status', label: 'Status' },
      { key: 'submittedBy', label: 'Submitted by' },
    ],
    query: sql`
      SELECT er.expense_number AS "expenseNumber", er.expense_date AS date, d.name AS department,
             er.category, er.vendor_name AS vendor, er.amount_kes AS amount, er.tax_kes AS tax,
             er.payment_status AS status, u.full_name AS "submittedBy"
      FROM expense_records er
      JOIN departments d ON d.id = er.department_id
      LEFT JOIN users u ON u.id = er.submitted_by_user_id
      ORDER BY er.expense_date::date DESC;
    `,
  }),
  'purchase-orders': () => ({
    title: 'Purchase orders',
    permission: 'dashboard.procurement',
    columns: [
      { key: 'poNumber', label: 'PO number' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'orderDate', label: 'Order date' },
      { key: 'expected', label: 'Expected delivery' },
      { key: 'total', label: 'Total (KES)' },
      { key: 'status', label: 'Status' },
      { key: 'received', label: 'Received value (KES)' },
    ],
    query: sql`
      SELECT po.po_number AS "poNumber", s.name AS supplier,
             po.created_at::date::text AS "orderDate",
             po.expected_delivery_date AS expected, po.total_amount_kes AS total, po.status,
             COALESCE((SELECT SUM(gr.accepted_qty::numeric * po.unit_price_kes::numeric)
                         FROM goods_receipts gr WHERE gr.purchase_order_id = po.id), 0) AS received
      FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      ORDER BY po.created_at DESC;
    `,
  }),
  'sales-orders': () => ({
    title: 'Sales & export orders',
    permission: 'dashboard.sales',
    columns: [
      { key: 'orderNumber', label: 'Order' },
      { key: 'customer', label: 'Customer' },
      { key: 'market', label: 'Market' },
      { key: 'orderDate', label: 'Order date' },
      { key: 'delivery', label: 'Requested delivery' },
      { key: 'total', label: 'Total (KES)' },
      { key: 'status', label: 'Status' },
      { key: 'incoterm', label: 'Incoterm' },
    ],
    query: sql`
      SELECT so.order_number AS "orderNumber", c.name AS customer, c.country AS market,
             so.created_at::date::text AS "orderDate", so.requested_delivery_date AS delivery,
             so.total_kes_amount AS total, so.status, c.incoterms AS incoterm
      FROM sales_orders so
      JOIN customers c ON c.id = so.customer_id
      ORDER BY so.created_at DESC;
    `,
  }),
  shipments: () => ({
    title: 'Shipments & export documentation',
    permission: 'dashboard.logistics',
    columns: [
      { key: 'shipment', label: 'Shipment' },
      { key: 'order', label: 'Sales order' },
      { key: 'customer', label: 'Customer' },
      { key: 'awb', label: 'Airwaybill' },
      { key: 'flight', label: 'Flight' },
      { key: 'dispatchDate', label: 'Dispatch date' },
      { key: 'status', label: 'Status' },
      { key: 'docs', label: 'Export documents issued' },
    ],
    query: sql`
      SELECT sh.shipment_code AS shipment, so.order_number AS "order", c.name AS customer,
             sh.air_waybill_no AS awb, sh.flight_number AS flight,
             sh.dispatch_date AS "dispatchDate", sh.dispatch_status AS status,
             (SELECT string_agg(ed.doc_type || ':' || COALESCE(ed.doc_number,'pending'), ', ')
                FROM export_documents ed WHERE ed.shipment_id = sh.id) AS docs
      FROM shipments sh
      JOIN sales_orders so ON so.id = sh.sales_order_id
      JOIN customers c ON c.id = so.customer_id
      ORDER BY sh.dispatch_date::date DESC NULLS LAST;
    `,
  }),
  'quality-inspections': () => ({
    title: 'Quality inspections',
    permission: 'dashboard.qa',
    columns: [
      { key: 'inspection', label: 'Inspection' },
      { key: 'type', label: 'Type' },
      { key: 'date', label: 'Date' },
      { key: 'batch', label: 'Batch / lot' },
      { key: 'result', label: 'Result' },
      { key: 'score', label: 'Score' },
      { key: 'inspector', label: 'Inspector' },
      { key: 'notes', label: 'Notes' },
    ],
    query: sql`
      SELECT qi.inspection_code AS inspection, qi.inspection_type AS type,
             qi.inspected_at::date::text AS date,
             COALESCE(pb.packing_batch_code, hb.batch_number, '—') AS batch,
             qi.result, qi.score_percent AS score, u.full_name AS inspector, qi.notes
      FROM quality_inspections qi
      LEFT JOIN packing_batches pb ON pb.id = qi.packing_batch_id
      LEFT JOIN harvest_batches hb ON hb.id = qi.harvest_batch_id
      LEFT JOIN users u ON u.id = qi.inspected_by_user_id
      ORDER BY qi.inspected_at DESC;
    `,
  }),
  'maintenance': () => ({
    title: 'Maintenance work orders',
    permission: 'dashboard.maintenance',
    columns: [
      { key: 'woNumber', label: 'Work order' },
      { key: 'asset', label: 'Asset' },
      { key: 'type', label: 'Type' },
      { key: 'priority', label: 'Priority' },
      { key: 'scheduled', label: 'Scheduled' },
      { key: 'status', label: 'Status' },
      { key: 'cost', label: 'Cost (KES)' },
      { key: 'technician', label: 'Technician' },
    ],
    query: sql`
      SELECT wo.work_order_number AS "woNumber", a.asset_name AS asset, wo.work_type AS type,
             wo.priority, wo.scheduled_date AS scheduled, wo.status, wo.actual_cost_kes AS cost,
             u.full_name AS technician
      FROM maintenance_work_orders wo
      JOIN assets a ON a.id = wo.asset_id
      LEFT JOIN users u ON u.id = wo.assigned_to_user_id
      ORDER BY wo.scheduled_date::date DESC;
    `,
  }),
  employees: () => ({
    title: 'Employee directory (sensitive fields excluded)',
    permission: 'dashboard.hr',
    columns: [
      { key: 'employeeCode', label: 'Code' },
      { key: 'name', label: 'Name' },
      { key: 'department', label: 'Department' },
      { key: 'jobTitle', label: 'Job title' },
      { key: 'type', label: 'Employment type' },
      { key: 'status', label: 'Status' },
      { key: 'hireDate', label: 'Hire date' },
    ],
    query: sql`
      SELECT e.employee_code AS "employeeCode", e.full_name AS name, d.name AS department,
             e.job_title AS "jobTitle", e.employment_type AS type, e.employment_status AS status,
             e.hire_date AS "hireDate"
      FROM employee_profiles e
      JOIN departments d ON d.id = e.department_id
      ORDER BY d.name, e.full_name;
    `,
  }),
  'audit-log': () => ({
    title: 'Audit log',
    permission: 'audit.view',
    columns: [
      { key: 'at', label: 'Timestamp' },
      { key: 'actor', label: 'Actor' },
      { key: 'action', label: 'Action' },
      { key: 'module', label: 'Module' },
      { key: 'entity', label: 'Entity' },
      { key: 'summary', label: 'Summary' },
      { key: 'ip', label: 'IP address' },
    ],
    query: sql`
      SELECT al.created_at AS at, al.actor_email AS actor, al.action, al.module,
             al.entity_type || COALESCE(' #' || al.entity_id::text, '') AS entity,
             al.summary, al.ip_address AS ip
      FROM audit_logs al
      ORDER BY al.created_at DESC
      LIMIT 2000;
    `,
  }),
  approvals: () => ({
    title: 'Approval register',
    permission: 'dashboard.super_admin',
    columns: [
      { key: 'code', label: 'Request' },
      { key: 'module', label: 'Module' },
      { key: 'title', label: 'Title' },
      { key: 'amount', label: 'Amount (KES)' },
      { key: 'submittedBy', label: 'Submitted by' },
      { key: 'assignedRole', label: 'Assigned role' },
      { key: 'status', label: 'Status' },
      { key: 'decidedBy', label: 'Decided by' },
      { key: 'submittedAt', label: 'Submitted' },
    ],
    query: sql`
      SELECT ar.request_code AS code, ar.module, ar.title, ar.amount_kes AS amount,
             su.full_name AS "submittedBy", ar.assigned_role_code AS "assignedRole",
             ar.status, du.full_name AS "decidedBy", ar.submitted_at AS "submittedAt"
      FROM approval_requests ar
      JOIN users su ON su.id = ar.submitted_by_user_id
      LEFT JOIN users du ON du.id = ar.decided_by_user_id
      ORDER BY ar.submitted_at DESC;
    `,
  }),
};

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const type = req.nextUrl.searchParams.get('type') ?? '';
    const format = (req.nextUrl.searchParams.get('format') ?? 'csv').toLowerCase();
    const period = req.nextUrl.searchParams.get('period') ?? undefined;

    const def = REPORTS[type]?.(period);
    if (!def) {
      return jsonError(404, `Unknown report "${type}".`);
    }
    if (!hasPermission(user, def.permission) && !hasPermission(user, 'reports.export')) {
      return jsonError(403, 'You are not authorized to export this report.');
    }

    const db = await getDb();
    const res = (await db.execute(def.query)) as unknown as Rows;
    const rows = res.rows ?? [];

    await recordAuditLog({
      actor: user,
      action: 'REPORT_EXPORTED',
      module: 'REPORTS',
      entityType: 'REPORT',
      entityId: type,
      summary: `Exported "${def.title}" as ${format.toUpperCase()} (${rows.length} rows)`,
      ipAddress: req.headers.get('x-forwarded-for') ?? 'unknown',
    });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `chalar-${type}-${stamp}`;

    if (format === 'pdf') {
      const table: PdfTable = {
        columns: def.columns.map((c) => c.label),
        rows: rows.map((r) => def.columns.map((c) => String(r[c.key] ?? ''))),
      };
      const pdf = buildPdf({
        title: `Chalar Farms Limited — ${def.title}`,
        subtitle: `Exported ${new Date().toLocaleString('en-KE')} by ${user.fullName} (${user.email}) · ${rows.length} record(s)`,
        table,
      });
      return new NextResponse(Buffer.from(pdf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}.pdf"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // CSV with formula-injection escaping on every cell
    const header = def.columns.map((c) => escapeCsvCell(c.label)).join(',');
    const lines = rows.map((r) => def.columns.map((c) => escapeCsvCell(r[c.key])).join(','));
    const csv = `\uFEFF${[header, ...lines].join('\r\n')}\r\n`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return jsonError(e.status, e.message);
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('report export', e);
    return jsonError(500, 'Failed to build report.');
  }
}
