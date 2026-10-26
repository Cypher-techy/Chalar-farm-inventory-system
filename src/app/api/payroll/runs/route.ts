import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import * as t from '@/db/schema';
import { ApiError, requirePermission, jsonOk, jsonError, clientIp, rateLimit, withIdempotency } from '@/lib/guards';
import { recordAuditLog } from '@/lib/auth';
import { computePayrollRun } from '@/lib/payroll-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, 'payroll.view');
    const db = await getDb();
    const runs = (await db.execute(sql`
      SELECT pr.run_code AS "runCode", pr.period_month AS "periodMonth", pr.pay_date AS "payDate",
             pr.statutory_version_code AS "statutoryVersionCode", pr.employee_count AS "employeeCount",
             pr.total_gross_kes AS "totalGrossKes", pr.total_paye_kes AS "totalPayeKes",
             pr.total_nssf_employee_kes AS "totalNssfKes", pr.total_shif_kes AS "totalShifKes",
             pr.total_housing_levy_kes AS "totalHousingLevyKes", pr.total_net_pay_kes AS "totalNetKes",
             pr.status AS status, pr.prepared_by_user_id AS "preparedByUserId",
             pr.approved_by_user_id AS "approvedByUserId", pr.approved_at AS "approvedAt",
             pu.full_name AS "preparedByName", au.full_name AS "approvedByName",
             pr.created_at AS "createdAt"
      FROM payroll_runs pr
      LEFT JOIN users pu ON pu.id = pr.prepared_by_user_id
      LEFT JOIN users au ON au.id = pr.approved_by_user_id
      ORDER BY pr.period_month DESC, pr.id DESC
      LIMIT 24;
    `)) as unknown as { rows: unknown[] };
    return jsonOk({ runs: runs.rows });
  } catch (e) {
    if (e instanceof ApiError) return jsonError(e.status, e.message);
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('payroll runs GET', e);
    return jsonError(500, 'Failed to load payroll runs.');
  }
}

const createSchema = z.object({
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM.'),
  payDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.'),
});

/**
 * Creates a DRAFT payroll run computed from employee records + the statutory
 * rule version in force on the pay date. Approval is a separate step performed
 * by a different user (segregation of duties).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'payroll.manage');
    const ip = clientIp(req);
    rateLimit(`payroll-run:${user.id}`, 6, 300_000);

    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return jsonError(400, issue?.message ?? 'Invalid payroll run payload.');
    }
    const { periodMonth, payDate } = parsed.data;

    const idempotencyKey = req.headers.get('idempotency-key') ?? `payroll-${periodMonth}-${payDate}`;

    const outcome = await withIdempotency(idempotencyKey, async () => {
      const db = await getDb();

      const existing = (await db.execute(sql`
        SELECT run_code, status FROM payroll_runs WHERE period_month = ${periodMonth} LIMIT 1;
      `)) as unknown as { rows: Array<{ run_code: string; status: string }> };
      if (existing.rows[0]) {
        throw new Error(`RUN_EXISTS:${existing.rows[0].run_code}:${existing.rows[0].status}`);
      }

      const computation = await computePayrollRun(periodMonth, payDate);
      if (computation.lines.length === 0) throw new Error('NO_ACTIVE_EMPLOYEES');

      const runCode = `PAY-${periodMonth.replace('-', '')}-DRAFT`;
      const { totals, rules } = computation;

      const runId = await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(t.payrollRuns)
          .values({
            runCode,
            periodMonth,
            payDate,
            statutoryVersionCode: rules.versionCode,
            employeeCount: totals.employeeCount,
            totalGrossKes: totals.gross.toFixed(2),
            totalPayeKes: totals.paye.toFixed(2),
            totalNssfEmployeeKes: totals.nssfEmployee.toFixed(2),
            totalShifKes: totals.shif.toFixed(2),
            totalHousingLevyKes: totals.housingLevyEmployee.toFixed(2),
            totalOtherDeductionsKes: totals.otherDeductions.toFixed(2),
            totalNetPayKes: totals.net.toFixed(2),
            status: 'DRAFT',
            preparedByUserId: user.id,
          })
          .returning();
        const payrollRunId = inserted[0].id;

        for (const line of computation.lines) {
          const r = line.result;
          await tx.insert(t.payslipRecords).values({
            payslipNumber: `PS-${periodMonth.replace('-', '')}-${line.employeeCode}`,
            payrollRunId,
            employeeId: line.employeeId,
            periodMonth,
            basicPayKes: r.basicPayKes.toFixed(2),
            overtimePayKes: r.overtimePayKes.toFixed(2),
            allowancesKes: r.allowancesKes.toFixed(2),
            grossPayKes: r.grossPayKes.toFixed(2),
            nssfEmployeeKes: r.nssfEmployeeKes.toFixed(2),
            nssfEmployerKes: r.nssfEmployerKes.toFixed(2),
            shifKes: r.shifKes.toFixed(2),
            housingLevyEmployeeKes: r.housingLevyEmployeeKes.toFixed(2),
            housingLevyEmployerKes: r.housingLevyEmployerKes.toFixed(2),
            taxablePayKes: r.taxablePayKes.toFixed(2),
            payeBeforeReliefKes: r.payeBeforeReliefKes.toFixed(2),
            personalReliefKes: r.personalReliefKes.toFixed(2),
            payeTaxKes: r.payeTaxKes.toFixed(2),
            otherDeductionsKes: r.otherDeductionsKes.toFixed(2),
            netPayKes: r.netPayKes.toFixed(2),
            paymentStatus: 'PENDING',
          });
        }

        // Approval routed to a payroll approver role (cannot be the preparer)
        await tx.insert(t.approvalRequests).values({
          requestCode: `APR-${runCode}`,
          module: 'PAYROLL',
          entityType: 'PAYROLL_RUN',
          entityId: payrollRunId,
          title: `Payroll run ${periodMonth} — ${totals.employeeCount} employees, net ${totals.net.toFixed(2)} KES`,
          amountKes: totals.net.toFixed(2),
          assignedRoleCode: 'FINANCE_MANAGER',
          submittedByUserId: user.id,
          status: 'PENDING',
        });

        return payrollRunId;
      });

      await recordAuditLog({
        actor: user,
        action: 'PAYROLL_RUN_CREATED',
        module: 'PAYROLL',
        entityType: 'PAYROLL_RUN',
        entityId: runCode,
        summary: `Created draft payroll for ${periodMonth}: ${totals.employeeCount} employees, gross ${totals.gross.toFixed(2)}, PAYE ${totals.paye.toFixed(2)}, NSSF ${totals.nssfEmployee.toFixed(2)}, SHIF ${totals.shif.toFixed(2)}, housing levy ${totals.housingLevyEmployee.toFixed(2)}, net ${totals.net.toFixed(2)} (rules ${rules.versionCode})`,
        afterState: { periodMonth, payDate, totals, statutoryVersion: rules.versionCode },
        ipAddress: ip,
      });

      return { status: 201, body: { ok: true, runCode, payrollRunId: runId, totals, statutoryVersion: rules.versionCode } };
    });

    return new Response(JSON.stringify(outcome.body), {
      status: outcome.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    if (e instanceof ApiError) return jsonError(e.status, e.message);
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    const msg = e instanceof Error ? e.message : 'Unknown error';
    if (msg.startsWith('RUN_EXISTS:')) {
      const [, code, status] = msg.split(':');
      return jsonError(409, `A payroll run for this period already exists (${code}, status ${status}). Reverse or approve it instead of creating a duplicate.`);
    }
    if (msg === 'NO_ACTIVE_EMPLOYEES') {
      return jsonError(409, 'No active employees to pay in this period.');
    }
    if (msg.startsWith('No statutory rule version')) {
      return jsonError(409, msg);
    }
    console.error('payroll run POST', e);
    return jsonError(500, 'Failed to create payroll run.');
  }
}
