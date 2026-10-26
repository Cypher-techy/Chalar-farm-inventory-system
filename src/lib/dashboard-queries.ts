import { sql, type SQL } from 'drizzle-orm';
import { getDb } from '@/db';

type Rows<T> = { rows: T[] };

async function one<T extends Record<string, unknown>>(query: SQL): Promise<T> {
  const db = await getDb();
  const res = (await db.execute(query)) as unknown as Rows<T>;
  return res.rows[0] ?? ({} as T);
}

export async function superAdminKpis() {
  const [people, inventory, ops, approvals, comms] = await Promise.all([
    one<{
      total: number;
      active: number;
      inactive: number;
      attendance_today: number;
      on_leave: number;
    }>(sql`
      SELECT
        (SELECT count(*)::int FROM employee_profiles)::int AS total,
        (SELECT count(*)::int FROM employee_profiles WHERE employment_status = 'ACTIVE')::int AS active,
        (SELECT count(*)::int FROM employee_profiles WHERE employment_status != 'ACTIVE')::int AS inactive,
        (SELECT count(*)::int FROM attendance_records WHERE attendance_date = CURRENT_DATE AND status IN ('PRESENT','LATE'))::int AS attendance_today,
        (SELECT count(*)::int FROM employee_profiles WHERE employment_status = 'ON_LEAVE')::int AS on_leave;
    `),
    one<{ valuation: string; low_stock: number; out_of_stock: number; lots: number }>(sql`
      SELECT
        (SELECT COALESCE(SUM(physical_qty * unit_cost_kes), 0) FROM inventory_lots)::text AS valuation,
        (SELECT count(*)::int FROM products WHERE is_active AND physical_stock <= reorder_level AND physical_stock > 0)::int AS low_stock,
        (SELECT count(*)::int FROM products WHERE is_active AND physical_stock <= 0)::int AS out_of_stock,
        (SELECT count(*)::int FROM inventory_lots WHERE physical_qty > 0)::int AS lots;
    `),
    one<{
      today_harvest: string;
      week_packed: string;
      open_pos: number;
      open_orders: number;
      open_wos: number;
      open_ncr: number;
      low_stock_alerts: number;
      overdue_invoices: number;
    }>(sql`
      SELECT
        (SELECT COALESCE(SUM(harvested_weight_kg),0) FROM harvest_batches WHERE harvest_date = CURRENT_DATE)::text AS today_harvest,
        (SELECT COALESCE(SUM(packed_output_kg),0) FROM packing_orders WHERE created_at > now() - interval '7 days')::text AS week_packed,
        (SELECT count(*)::int FROM purchase_orders WHERE status IN ('APPROVED','ISSUED','PARTIALLY_RECEIVED'))::int AS open_pos,
        (SELECT count(*)::int FROM sales_orders WHERE status NOT IN ('PAID','CANCELLED'))::int AS open_orders,
        (SELECT count(*)::int FROM maintenance_work_orders WHERE status IN ('OPEN','IN_PROGRESS'))::int AS open_wos,
        (SELECT count(*)::int FROM nonconformities WHERE status != 'VERIFIED_CLOSED')::int AS open_ncr,
        (SELECT count(*)::int FROM products WHERE is_active AND physical_stock <= reorder_level)::int AS low_stock_alerts,
        (SELECT count(*)::int FROM supplier_invoices WHERE payment_status IN ('UNPAID','DISPUTED') AND due_date < CURRENT_DATE)::int AS overdue_invoices;
    `),
    one<{ pending: number; pending_amount: string; expenses_pending: number; leave_pending: number }>(sql`
      SELECT
        (SELECT count(*)::int FROM approval_requests WHERE status = 'PENDING')::int AS pending,
        (SELECT COALESCE(SUM(amount_kes),0) FROM approval_requests WHERE status = 'PENDING')::text AS pending_amount,
        (SELECT count(*)::int FROM expense_records WHERE payment_status = 'PENDING_APPROVAL')::int AS expenses_pending,
        (SELECT count(*)::int FROM leave_requests WHERE status = 'PENDING')::int AS leave_pending;
    `),
    one<{ unread: number; conversations: number }>(sql`
      SELECT
        (SELECT count(*)::int FROM notification_records WHERE is_read = false)::int AS unread,
        (SELECT count(*)::int FROM conversations WHERE is_archived = false)::int AS conversations;
    `),
  ]);

  return { people, inventory, ops, approvals, comms };
}

export async function recentActivity(limit = 14) {
  const db = await getDb();
  const res = (await db.execute(sql`
    SELECT action, module, entity_type AS "entityType", entity_id AS "entityId",
           summary, actor_email AS "actorEmail", created_at AS "createdAt"
    FROM audit_logs
    ORDER BY created_at DESC
    LIMIT ${limit};
  `)) as unknown as Rows<Record<string, string>>;
  return res.rows;
}

export async function departmentBudgetSnapshot() {
  const db = await getDb();
  const res = (await db.execute(sql`
    SELECT d.name,
           d.budget_allocated_kes AS budget,
           COALESCE(SUM(e.amount_kes + e.tax_kes), 0) AS spent
    FROM departments d
    LEFT JOIN expense_records e
      ON e.department_id = d.id AND e.payment_status IN ('APPROVED','PAID','PENDING_APPROVAL')
    GROUP BY d.id, d.name, d.budget_allocated_kes
    ORDER BY d.budget_allocated_kes DESC;
  `)) as unknown as Rows<{ name: string; budget: string; spent: string }>;
  return res.rows;
}

export async function harvestTrend(days = 14) {
  const db = await getDb();
  const res = (await db.execute(sql`
    SELECT to_char(harvest_date, 'DD Mon') AS name,
           COALESCE(SUM(harvested_weight_kg), 0)::numeric AS value
    FROM harvest_batches
    WHERE harvest_date >= CURRENT_DATE - ${days}::int
    GROUP BY harvest_date
    ORDER BY harvest_date;
  `)) as unknown as Rows<{ name: string; value: string }>;
  return res.rows.map((r) => ({ ...r, value: Number(r.value) }));
}

export async function stockMovementTrend(days = 14) {
  const db = await getDb();
  const res = (await db.execute(sql`
    SELECT to_char(created_at, 'DD Mon') AS name,
           SUM(CASE WHEN movement_type IN ('RECEIPT','PRODUCTION_OUTPUT') THEN quantity::numeric ELSE 0 END) AS receipts,
           SUM(CASE WHEN movement_type IN ('ISSUE','PRODUCTION_CONSUME','TRANSFER') THEN quantity::numeric ELSE 0 END) AS issues
    FROM stock_movements
    WHERE created_at >= now() - (${days} || ' days')::interval
    GROUP BY date_trunc('day', created_at)
    ORDER BY date_trunc('day', created_at);
  `)) as unknown as Rows<{ name: string; receipts: string; issues: string }>;
  return res.rows.map((r) => ({
    name: r.name,
    receipts: Number(r.receipts),
    issues: Number(r.issues),
  }));
}

export async function salesByMonth() {
  const db = await getDb();
  const res = (await db.execute(sql`
    SELECT to_char(date_trunc('month', created_at), 'Mon YY') AS name,
           COALESCE(SUM(total_kes_amount), 0)::numeric AS value
    FROM sales_orders
    WHERE created_at >= now() - interval '6 months'
      AND status NOT IN ('DRAFT','CANCELLED')
    GROUP BY date_trunc('month', created_at)
    ORDER BY date_trunc('month', created_at);
  `)) as unknown as Rows<{ name: string; value: string }>;
  return res.rows.map((r) => ({ ...r, value: Number(r.value) }));
}

export async function payrollTotals() {
  const db = await getDb();
  const res = (await db.execute(sql`
    SELECT run_code AS name,
           total_gross_kes AS gross,
           total_net_pay_kes AS net,
           total_paye_kes AS paye,
           total_nssf_employee_kes AS nssf,
           total_shif_kes AS shif,
           total_housing_levy_kes AS ahl
    FROM payroll_runs
    ORDER BY period_month DESC
    LIMIT 6;
  `)) as unknown as Rows<{
    name: string;
    gross: string;
    net: string;
    paye: string;
    nssf: string;
    shif: string;
    ahl: string;
  }>;
  return res.rows;
}

export async function expenseByDepartment() {
  const db = await getDb();
  const res = (await db.execute(sql`
    SELECT d.name,
           COALESCE(SUM(e.amount_kes + e.tax_kes), 0)::numeric AS value
    FROM expense_records e
    JOIN departments d ON d.id = e.department_id
    WHERE e.payment_status IN ('APPROVED','PAID')
    GROUP BY d.name
    ORDER BY value DESC
    LIMIT 8;
  `)) as unknown as Rows<{ name: string; value: string }>;
  return res.rows.map((r) => ({ ...r, value: Number(r.value) }));
}

export async function attendanceTrend(days = 14) {
  const db = await getDb();
  const res = (await db.execute(sql`
    SELECT to_char(attendance_date, 'DD Mon') AS name,
           count(*) FILTER (WHERE status IN ('PRESENT','LATE'))::int AS present,
           count(*) FILTER (WHERE status = 'ABSENT')::int AS absent
    FROM attendance_records
    WHERE attendance_date >= CURRENT_DATE - ${days}::int
    GROUP BY attendance_date
    ORDER BY attendance_date;
  `)) as unknown as Rows<{ name: string; present: number; absent: number }>;
  return res.rows;
}
