import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { requireAuth, jsonOk, jsonError } from '@/lib/guards';
import { hasPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Payslip listing. Access is deliberately narrow:
 *  - payroll.view / hr.sensitive  → all payslips
 *  - everyone else                → only payslips linked to their own employee record
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const db = await getDb();
    const period = req.nextUrl.searchParams.get('period');
    const canSeeAll = hasPermission(user, 'payroll.view') || hasPermission(user, 'hr.sensitive');

    const scopeClause = canSeeAll
      ? sql`TRUE`
      : sql`e.user_id = ${user.id}`;

    const rows = (await db.execute(sql`
      SELECT ps.payslip_number AS "payslipNumber", pr.run_code AS "runCode",
             pr.period_month AS "periodMonth", pr.pay_date AS "payDate",
             pr.statutory_version_code AS "statutoryVersion", pr.status AS "runStatus",
             e.employee_code AS "employeeCode", e.full_name AS "employeeName",
             d.name AS department, e.job_title AS "jobTitle",
             ps.basic_pay_kes AS "basicPayKes", ps.overtime_pay_kes AS "overtimePayKes",
             ps.allowances_kes AS "allowancesKes", ps.gross_pay_kes AS "grossPayKes",
             ps.nssf_employee_kes AS "nssfEmployeeKes", ps.nssf_employer_kes AS "nssfEmployerKes",
             ps.shif_kes AS "shifKes",
             ps.housing_levy_employee_kes AS "housingLevyEmployeeKes",
             ps.housing_levy_employer_kes AS "housingLevyEmployerKes",
             ps.taxable_pay_kes AS "taxablePayKes",
             ps.paye_before_relief_kes AS "payeBeforeReliefKes",
             ps.personal_relief_kes AS "personalReliefKes",
             ps.paye_tax_kes AS "payeTaxKes",
             ps.other_deductions_kes AS "otherDeductionsKes",
             ps.net_pay_kes AS "netPayKes", ps.payment_status AS "paymentStatus"
      FROM payslip_records ps
      JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
      JOIN employee_profiles e ON e.id = ps.employee_id
      JOIN departments d ON d.id = e.department_id
      WHERE ${scopeClause}
        AND ${period ? sql`pr.period_month = ${period}` : sql`TRUE`}
      ORDER BY pr.period_month DESC, e.employee_code
      LIMIT ${canSeeAll ? 200 : 24}::int;
    `)) as unknown as { rows: unknown[] };

    return jsonOk({ payslips: rows.rows, scope: canSeeAll ? 'all' : 'self' });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('payslips GET', e);
    return jsonError(500, 'Failed to load payslips.');
  }
}
