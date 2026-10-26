import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import * as t from '@/db/schema';
import { requirePermission, jsonOk, jsonError, clientIp, rateLimit } from '@/lib/guards';
import { recordAuditLog } from '@/lib/auth';
import { createNotification } from '@/lib/chat';

export const dynamic = 'force-dynamic';

const schema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  comments: z.string().max(1000).optional(),
});

const num = (v: string | number | null | undefined) => Number(v ?? 0);

/**
 * Approves or rejects a payroll run.
 * Enforces segregation of duties (preparer ≠ approver), reconciles payslips
 * against the run header, and on approval posts a balanced double-entry journal.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  try {
    const user = await requirePermission(req, 'payroll.approve');
    const ip = clientIp(req);
    rateLimit(`payroll-approve:${user.id}`, 10, 60_000);

    const { code } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? 'Invalid payload.');

    const db = await getDb();
    const runRows = (await db.execute(sql`
      SELECT id, run_code, period_month, status, prepared_by_user_id, employee_count,
             total_gross_kes, total_paye_kes, total_nssf_employee_kes, total_shif_kes,
             total_housing_levy_kes, total_other_deductions_kes, total_net_pay_kes
      FROM payroll_runs WHERE run_code = ${code} LIMIT 1;
    `)) as unknown as {
      rows: Array<{
        id: number;
        run_code: string;
        period_month: string;
        status: string;
        prepared_by_user_id: number | null;
        employee_count: number;
        total_gross_kes: string;
        total_paye_kes: string;
        total_nssf_employee_kes: string;
        total_shif_kes: string;
        total_housing_levy_kes: string;
        total_other_deductions_kes: string;
        total_net_pay_kes: string;
      }>;
    };

    const run = runRows.rows[0];
    if (!run) return jsonError(404, 'Payroll run not found.');
    if (run.status === 'APPROVED' || run.status === 'DISBURSED') {
      return jsonError(409, `This payroll run is already ${run.status.toLowerCase()}.`);
    }
    if (run.status === 'REJECTED') {
      return jsonError(409, 'This payroll run was rejected. Prepare a fresh run for the period.');
    }
    if (run.prepared_by_user_id === user.id) {
      return jsonError(
        403,
        'Segregation of duties: you prepared this payroll run, so you cannot approve it. A second authorized approver must review it.'
      );
    }

    const recon = (await db.execute(sql`
      SELECT count(*)::int AS cnt,
             COALESCE(SUM(net_pay_kes),0)::text AS net,
             COALESCE(SUM(gross_pay_kes),0)::text AS gross,
             COALESCE(SUM(paye_tax_kes),0)::text AS paye,
             COALESCE(SUM(shif_kes),0)::text AS shif
      FROM payslip_records WHERE payroll_run_id = ${run.id};
    `)) as unknown as { rows: Array<{ cnt: number; net: string; gross: string; paye: string; shif: string }> };
    const r = recon.rows[0];
    if (!r || r.cnt !== run.employee_count) {
      return jsonError(
        409,
        `Payslip records (${r?.cnt ?? 0}) do not match the run headcount (${run.employee_count}). Rebuild the run.`
      );
    }
    if (Math.abs(num(r.net) - num(run.total_net_pay_kes)) > 0.05) {
      return jsonError(
        409,
        `Payslip net pay total (${r.net}) does not reconcile with the run header (${run.total_net_pay_kes}). Rebuild the run.`
      );
    }
    if (Math.abs(num(r.gross) - num(run.total_gross_kes)) > 0.05) {
      return jsonError(409, 'Payslip gross pay does not reconcile with the run header. Rebuild the run.');
    }

    if (parsed.data.decision === 'REJECT') {
      await db.execute(sql`UPDATE payroll_runs SET status = 'REJECTED' WHERE id = ${run.id}`);
      await db.execute(sql`
        UPDATE approval_requests SET status = 'REJECTED', decided_by_user_id = ${user.id},
               decision_comments = ${parsed.data.comments ?? null}, decided_at = now()
        WHERE entity_type = 'PAYROLL_RUN' AND entity_id = ${run.id} AND status = 'PENDING';
      `);
      if (run.prepared_by_user_id) {
        await createNotification({
          userId: run.prepared_by_user_id,
          category: 'APPROVALS',
          title: 'Payroll run rejected',
          summary: `Payroll run ${run.run_code} for ${run.period_month} was rejected.`,
          linkUrl: '/portal/finance',
        });
      }
      await recordAuditLog({
        actor: user,
        action: 'PAYROLL_RUN_REJECTED',
        module: 'PAYROLL',
        entityType: 'PAYROLL_RUN',
        entityId: run.run_code,
        summary: `Rejected payroll run ${run.run_code} (${run.period_month})${parsed.data.comments ? ` — ${parsed.data.comments}` : ''}`,
        ipAddress: ip,
      });
      return jsonOk({ message: `Payroll run ${run.run_code} rejected.`, status: 'REJECTED' });
    }

    // ---------------- APPROVE: post balanced journal ----------------
    const employerNssf = num(run.total_nssf_employee_kes); // equal-share scheme
    const employerHousing = num(run.total_housing_levy_kes);
    const employerCost = employerNssf + employerHousing;

    const gross = num(run.total_gross_kes);
    const paye = num(run.total_paye_kes);
    const shif = num(run.total_shif_kes);
    const otherDeductions = num(run.total_other_deductions_kes);
    const netPay = num(run.total_net_pay_kes);

    // Debits: gross wages + employer statutory contributions
    const totalDebit = gross + employerCost;
    // Credits: PAYE + NSSF (both shares) + SHIF + housing levy (both shares) + other deductions + net pay
    const totalCredit =
      paye + (num(run.total_nssf_employee_kes) + employerNssf) + shif +
      (num(run.total_housing_levy_kes) + employerHousing) + otherDeductions + netPay;

    if (Math.abs(totalDebit - totalCredit) > 0.05) {
      return jsonError(
        409,
        `Journal would not balance (debits ${totalDebit.toFixed(2)} vs credits ${totalCredit.toFixed(2)}). Payroll was NOT approved — investigate the run figures.`
      );
    }

    const entryNumber = `JE-PAY-${run.period_month}-${run.id}`;
    const periodCode = run.period_month;

    await db.transaction(async (tx) => {
      await tx.execute(sql`
        UPDATE payroll_runs SET status = 'APPROVED', approved_by_user_id = ${user.id}, approved_at = now()
        WHERE id = ${run.id};
      `);
      await tx.execute(sql`
        UPDATE payslip_records SET payment_status = 'PAID' WHERE payroll_run_id = ${run.id};
      `);
      await tx.execute(sql`
        UPDATE approval_requests SET status = 'APPROVED', decided_by_user_id = ${user.id},
               decision_comments = ${parsed.data.comments ?? null}, decided_at = now()
        WHERE entity_type = 'PAYROLL_RUN' AND entity_id = ${run.id} AND status = 'PENDING';
      `);

      const entryRows = await tx
        .insert(t.journalEntries)
        .values({
          entryNumber,
          entryDate: `${run.period_month}-28`,
          periodCode,
          description: `Payroll run ${run.run_code} for ${run.period_month} — ${run.employee_count} employees (approved by ${user.fullName})`,
          referenceType: 'PAYROLL_RUN',
          referenceId: String(run.id),
          totalDebitKes: totalDebit.toFixed(2),
          totalCreditKes: totalCredit.toFixed(2),
          status: 'POSTED',
          createdByUserId: user.id,
          approvedByUserId: user.id,
        })
        .returning();
      const journalEntryId = entryRows[0].id;

      const accountRows = (await tx.execute(sql`
        SELECT id, account_code FROM chart_of_accounts
        WHERE account_code IN ('6000','6100','2100','2110','2120','2130','1000');
      `)) as unknown as { rows: Array<{ id: number; account_code: string }> };
      const acct = new Map(accountRows.rows.map((a) => [a.account_code, a.id]));

      const lines: Array<[string, number, number, string]> = [
        ['6000', gross, 0, 'Gross wages & salaries'],
        ['6100', employerCost, 0, 'Employer NSSF + housing levy'],
        ['2100', 0, paye, 'PAYE withheld (KRA)'],
        ['2110', 0, num(run.total_nssf_employee_kes) + employerNssf, 'NSSF employee + employer'],
        ['2120', 0, shif, 'SHIF contribution'],
        ['2130', 0, num(run.total_housing_levy_kes) + employerHousing, 'Housing levy employee + employer'],
        ['1000', 0, netPay + otherDeductions, 'Net pay disbursed to staff bank accounts'],
      ];

      for (const [accountCode, debit, credit, memo] of lines) {
        const accountId = acct.get(accountCode);
        if (!accountId) throw new Error(`ACCOUNT_MISSING:${accountCode}`);
        if (debit === 0 && credit === 0) continue;
        await tx.insert(t.journalLines).values({
          journalEntryId,
          accountId,
          costCenterCode: 'CC-CORE',
          debitKes: debit.toFixed(2),
          creditKes: credit.toFixed(2),
          memo: `${run.run_code} — ${memo}`,
        });
        await tx.execute(sql`
          UPDATE chart_of_accounts
          SET balance_kes = balance_kes + (${debit}::numeric - ${credit}::numeric)
          WHERE id = ${accountId};
        `);
      }
    });

    if (run.prepared_by_user_id) {
      await createNotification({
        userId: run.prepared_by_user_id,
        category: 'APPROVALS',
        title: 'Payroll run approved',
        summary: `Payroll run ${run.run_code} for ${run.period_month} was approved and posted to the ledger.`,
        linkUrl: '/portal/finance',
      });
    }

    await recordAuditLog({
      actor: user,
      action: 'PAYROLL_RUN_APPROVED',
      module: 'PAYROLL',
      entityType: 'PAYROLL_RUN',
      entityId: run.run_code,
      summary: `Approved payroll run ${run.run_code} (${run.period_month}, ${run.employee_count} employees, net ${netPay.toFixed(2)}); posted journal ${entryNumber} (Dr ${totalDebit.toFixed(2)} = Cr ${totalCredit.toFixed(2)})`,
      ipAddress: ip,
    });

    return jsonOk({
      message: `Payroll run ${run.run_code} approved and posted to the ledger.`,
      status: 'APPROVED',
      journalEntry: entryNumber,
      totalDebit: totalDebit.toFixed(2),
      totalCredit: totalCredit.toFixed(2),
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    const msg = e instanceof Error ? e.message : '';
    if (msg.startsWith('ACCOUNT_MISSING:')) {
      return jsonError(500, `Chart of accounts is missing account ${msg.split(':')[1]} — cannot post payroll journal.`);
    }
    console.error('payroll approve', e);
    return jsonError(500, 'Failed to process payroll approval.');
  }
}
