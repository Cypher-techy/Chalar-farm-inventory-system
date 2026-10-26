import { sql, type SQL } from 'drizzle-orm';
import { getDb } from '@/db';

type Rows<T> = { rows: T[] };

async function many<T>(query: SQL): Promise<T[]> {
  const db = await getDb();
  const res = (await db.execute(query)) as unknown as Rows<T>;
  return res.rows;
}

async function one<T extends Record<string, unknown>>(query: SQL): Promise<T> {
  const rows = await many<T>(query);
  return rows[0] ?? ({} as T);
}

export async function financeKpis() {
  return one<{
    cash_balance: string;
    receivables: string;
    payables: string;
    inventory_value: string;
    revenue_period: string;
    expenses_period: string;
    overdue_invoices: number;
    overdue_amount: string;
    pending_expenses: number;
    pending_expense_amount: string;
    payroll_net_latest: string;
    payroll_period_latest: string;
    payroll_status_latest: string;
    statutory_paye: string;
    statutory_nssf: string;
    statutory_shif: string;
    statutory_ahl: string;
    journal_count: number;
    trial_debit: string;
    trial_credit: string;
  }>(sql`
    SELECT
      (SELECT COALESCE(balance_kes,0) FROM chart_of_accounts WHERE account_code = '1000')::text AS cash_balance,
      (SELECT COALESCE(balance_kes,0) FROM chart_of_accounts WHERE account_code = '1100')::text AS receivables,
      (SELECT COALESCE(balance_kes,0) FROM chart_of_accounts WHERE account_code = '2000')::text AS payables,
      (SELECT COALESCE(SUM(physical_qty * unit_cost_kes),0) FROM inventory_lots)::text AS inventory_value,
      (SELECT COALESCE(SUM(total_kes_amount),0) FROM sales_orders
        WHERE status NOT IN ('DRAFT','CANCELLED') AND created_at > now() - interval '30 days')::text AS revenue_period,
      (SELECT COALESCE(SUM(amount_kes + tax_kes),0) FROM expense_records
        WHERE payment_status IN ('APPROVED','PAID') AND created_at > now() - interval '30 days')::text AS expenses_period,
      (SELECT count(*)::int FROM supplier_invoices
        WHERE payment_status IN ('UNPAID','DISPUTED') AND due_date::date < CURRENT_DATE)::int AS overdue_invoices,
      (SELECT COALESCE(SUM(invoice_amount_kes),0) FROM supplier_invoices
        WHERE payment_status IN ('UNPAID','DISPUTED') AND due_date::date < CURRENT_DATE)::text AS overdue_amount,
      (SELECT count(*)::int FROM expense_records WHERE payment_status = 'PENDING_APPROVAL')::int AS pending_expenses,
      (SELECT COALESCE(SUM(amount_kes + tax_kes),0) FROM expense_records WHERE payment_status = 'PENDING_APPROVAL')::text AS pending_expense_amount,
      (SELECT COALESCE(total_net_pay_kes,'0') FROM payroll_runs ORDER BY period_month DESC LIMIT 1)::text AS payroll_net_latest,
      (SELECT COALESCE(period_month,'—') FROM payroll_runs ORDER BY period_month DESC LIMIT 1)::text AS payroll_period_latest,
      (SELECT COALESCE(status,'—') FROM payroll_runs ORDER BY period_month DESC LIMIT 1)::text AS payroll_status_latest,
      (SELECT COALESCE(SUM(total_paye_kes),0) FROM payroll_runs)::text AS statutory_paye,
      (SELECT COALESCE(SUM(total_nssf_employee_kes),0) FROM payroll_runs)::text AS statutory_nssf,
      (SELECT COALESCE(SUM(total_shif_kes),0) FROM payroll_runs)::text AS statutory_shif,
      (SELECT COALESCE(SUM(total_housing_levy_kes),0) FROM payroll_runs)::text AS statutory_ahl,
      (SELECT count(*)::int FROM journal_entries WHERE status = 'POSTED')::int AS journal_count,
      (SELECT COALESCE(SUM(total_debit_kes),0) FROM journal_entries WHERE status = 'POSTED')::text AS trial_debit,
      (SELECT COALESCE(SUM(total_credit_kes),0) FROM journal_entries WHERE status = 'POSTED')::text AS trial_credit;
  `);
}

export async function trialBalance() {
  return many<{ code: string; name: string; type: string; debit: string; credit: string; balance: string }>(sql`
    SELECT a.account_code AS code, a.account_name AS name, a.account_type AS type,
           COALESCE(SUM(jl.debit_kes) FILTER (WHERE je.status = 'POSTED'), 0)::text AS debit,
           COALESCE(SUM(jl.credit_kes) FILTER (WHERE je.status = 'POSTED'), 0)::text AS credit,
           a.balance_kes AS balance
    FROM chart_of_accounts a
    LEFT JOIN journal_lines jl ON jl.account_id = a.id
    LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
    GROUP BY a.id, a.account_code, a.account_name, a.account_type, a.balance_kes
    ORDER BY a.account_code;
  `);
}

export async function payrollRuns(limit = 8) {
  return many<{
    runCode: string;
    periodMonth: string;
    payDate: string;
    statutoryVersion: string;
    employeeCount: number;
    gross: string;
    paye: string;
    nssf: string;
    shif: string;
    housing: string;
    net: string;
    status: string;
    preparedBy: string | null;
    approvedBy: string | null;
  }>(sql`
    SELECT pr.run_code AS "runCode", pr.period_month AS "periodMonth", pr.pay_date AS "payDate",
           pr.statutory_version_code AS "statutoryVersion", pr.employee_count AS "employeeCount",
           pr.total_gross_kes AS gross, pr.total_paye_kes AS paye,
           pr.total_nssf_employee_kes AS nssf, pr.total_shif_kes AS shif,
           pr.total_housing_levy_kes AS housing, pr.total_net_pay_kes AS net, pr.status,
           pu.full_name AS "preparedBy", au.full_name AS "approvedBy"
    FROM payroll_runs pr
    LEFT JOIN users pu ON pu.id = pr.prepared_by_user_id
    LEFT JOIN users au ON au.id = pr.approved_by_user_id
    ORDER BY pr.period_month DESC, pr.id DESC
    LIMIT ${limit}::int;
  `);
}

export async function payrollCostByDepartment(period?: string) {
  return many<{ name: string; value: number }>(sql`
    SELECT d.name, COALESCE(SUM(ps.gross_pay_kes), 0)::numeric AS value
    FROM payslip_records ps
    JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
    JOIN employee_profiles e ON e.id = ps.employee_id
    JOIN departments d ON d.id = e.department_id
    ${period ? sql`WHERE pr.period_month = ${period}` : sql``}
    GROUP BY d.name
    ORDER BY value DESC;
  `);
}

export async function statutoryBreakdown() {
  return many<{ name: string; value: number }>(sql`
    SELECT 'PAYE (KRA)' AS name, COALESCE(SUM(total_paye_kes),0)::numeric AS value FROM payroll_runs
    UNION ALL SELECT 'NSSF (employee)', COALESCE(SUM(total_nssf_employee_kes),0)::numeric FROM payroll_runs
    UNION ALL SELECT 'SHIF (2.75%)', COALESCE(SUM(total_shif_kes),0)::numeric FROM payroll_runs
    UNION ALL SELECT 'Housing Levy (1.5%)', COALESCE(SUM(total_housing_levy_kes),0)::numeric FROM payroll_runs;
  `);
}

export async function expenseByCategory() {
  return many<{ name: string; value: number }>(sql`
    SELECT category AS name, COALESCE(SUM(amount_kes + tax_kes),0)::numeric AS value
    FROM expense_records
    WHERE payment_status IN ('APPROVED','PAID','PENDING_APPROVAL')
    GROUP BY category
    ORDER BY value DESC;
  `);
}

export async function payablesAging() {
  return many<{ name: string; value: number }>(sql`
    SELECT CASE
             WHEN due_date::date < CURRENT_DATE THEN 'Overdue'
             WHEN due_date::date <= CURRENT_DATE + 7 THEN 'Due in 7 days'
             WHEN due_date::date <= CURRENT_DATE + 30 THEN 'Due in 30 days'
             ELSE 'Later'
           END AS name,
           COALESCE(SUM(invoice_amount_kes),0)::numeric AS value
    FROM supplier_invoices
    WHERE payment_status IN ('UNPAID','PART_PAID','DISPUTED')
    GROUP BY 1
    ORDER BY MIN(due_date::date);
  `);
}

export async function pendingFinanceApprovals(limit = 10) {
  return many<{
    requestCode: string;
    title: string;
    entityType: string;
    amountKes: string;
    assignedRoleCode: string;
    submittedAt: string;
    submittedBy: string;
  }>(sql`
    SELECT ar.request_code AS "requestCode", ar.title, ar.entity_type AS "entityType",
           ar.amount_kes AS "amountKes", ar.assigned_role_code AS "assignedRoleCode",
           ar.submitted_at AS "submittedAt", u.full_name AS "submittedBy"
    FROM approval_requests ar
    JOIN users u ON u.id = ar.submitted_by_user_id
    WHERE ar.status = 'PENDING' AND ar.module IN ('FINANCE','PAYROLL','PROCUREMENT')
    ORDER BY ar.submitted_at
    LIMIT ${limit}::int;
  `);
}

export async function expenseRegister(limit = 15) {
  return many<{
    expenseNumber: string;
    date: string;
    department: string;
    category: string;
    vendor: string;
    amount: string;
    tax: string;
    status: string;
    submittedBy: string | null;
  }>(sql`
    SELECT er.expense_number AS "expenseNumber", er.expense_date AS date, d.name AS department,
           er.category, er.vendor_name AS vendor, er.amount_kes AS amount, er.tax_kes AS tax,
           er.payment_status AS status, u.full_name AS "submittedBy"
    FROM expense_records er
    JOIN departments d ON d.id = er.department_id
    LEFT JOIN users u ON u.id = er.submitted_by_user_id
    ORDER BY er.expense_date::date DESC
    LIMIT ${limit}::int;
  `);
}

export async function statutoryRuleVersions() {
  return many<{
    versionCode: string;
    effectiveFrom: string;
    effectiveTo: string | null;
    personalReliefKes: string;
    shifRatePercent: string;
    ahlEmployeeRatePercent: string;
    nssfRatePercent: string;
    nssfTier1LimitKes: string;
    nssfTier2LimitKes: string;
    isActive: boolean;
  }>(sql`
    SELECT version_code AS "versionCode", effective_from AS "effectiveFrom", effective_to AS "effectiveTo",
           personal_relief_kes AS "personalReliefKes", shif_rate_percent AS "shifRatePercent",
           ahl_employee_rate_percent AS "ahlEmployeeRatePercent", nssf_rate_percent AS "nssfRatePercent",
           nssf_tier1_limit_kes AS "nssfTier1LimitKes", nssf_tier2_limit_kes AS "nssfTier2LimitKes",
           is_active AS "isActive"
    FROM statutory_rule_versions
    ORDER BY effective_from::date DESC;
  `);
}
