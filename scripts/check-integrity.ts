import { sql } from 'drizzle-orm';
import { getDb } from '../src/db';

async function main() {
  const db = await getDb();
  const one = async (q: Parameters<typeof db.execute>[0]) => {
    const r = (await db.execute(q)) as unknown as { rows: Record<string, unknown>[] };
    return r.rows[0];
  };
  const results = {
    employees: (await one(sql`SELECT count(*)::int c FROM employee_profiles`)).c,
    attendance: (await one(sql`SELECT count(*)::int c FROM attendance_records`)).c,
    leaveRequests: (await one(sql`SELECT count(*)::int c FROM leave_requests`)).c,
    leaveBalances: (await one(sql`SELECT count(*)::int c FROM leave_balances`)).c,
    overtime: (await one(sql`SELECT count(*)::int c FROM overtime_requests`)).c,
    workOrders: (await one(sql`SELECT count(*)::int c FROM maintenance_work_orders`)).c,
    assets: (await one(sql`SELECT count(*)::int c FROM assets`)).c,
    conversations: (await one(sql`SELECT count(*)::int c FROM conversations`)).c,
    convoMembers: (await one(sql`SELECT count(*)::int c FROM conversation_members`)).c,
    notifications: (await one(sql`SELECT count(*)::int c FROM notification_records`)).c,
    auditLogs: (await one(sql`SELECT count(*)::int c FROM audit_logs`)).c,
    trialBalanceDr: (await one(sql`SELECT COALESCE(sum(total_debit_kes),0)::text v FROM journal_entries WHERE status='POSTED'`)).v,
    trialBalanceCr: (await one(sql`SELECT COALESCE(sum(total_credit_kes),0)::text v FROM journal_entries WHERE status='POSTED'`)).v,
    selfApprovedApprovals: (await one(sql`SELECT count(*)::int c FROM approval_requests WHERE status='APPROVED' AND decided_by_user_id = submitted_by_user_id`)).c,
    payrollTotalNet: (await one(sql`SELECT COALESCE(sum(net_pay_kes),0)::text v FROM payslip_records`)).v,
    payrollRunNet: (await one(sql`SELECT COALESCE(sum(total_net_pay_kes),0)::text v FROM payroll_runs`)).v,
    payrollRunCount: (await one(sql`SELECT count(*)::int c FROM payroll_runs`)).c,
    // Per-run reconciliation: every run header must equal the sum of its own payslips
    payrollRunDrift: (await one(sql`
      SELECT COALESCE(sum(abs(pr.total_net_pay_kes - s.net)),0)::text v
      FROM payroll_runs pr
      JOIN (SELECT payroll_run_id, sum(net_pay_kes) AS net FROM payslip_records GROUP BY payroll_run_id) s
        ON s.payroll_run_id = pr.id`)).v,
    orphanPayslips: (await one(sql`
      SELECT count(*)::int c FROM payslip_records ps
      LEFT JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
      WHERE pr.id IS NULL`)).c,
    stockRows: (await one(sql`SELECT count(*)::int c FROM stock_movements`)).c,
    trainingRecords: (await one(sql`SELECT count(*)::int c FROM training_records`)).c,
    perfReviews: (await one(sql`SELECT count(*)::int c FROM performance_reviews`)).c,
    candidates: (await one(sql`SELECT count(*)::int c FROM candidates`)).c,
    exportDocs: (await one(sql`SELECT count(*)::int c FROM export_documents`)).c,
    pendingApprovals: (await one(sql`SELECT count(*)::int c FROM approval_requests WHERE status='PENDING'`)).c,
  };
  console.log(JSON.stringify(results, null, 2));
  const balanced = results.trialBalanceDr === results.trialBalanceCr;
  const payrollMatch = results.payrollTotalNet === results.payrollRunNet;
  const perRunDrift = Number(results.payrollRunDrift ?? 0);
  console.log('TRIAL BALANCE:', balanced ? 'BALANCED ✓' : 'MISMATCH ✗');
  console.log('PAYROLL RECONCILES (all runs vs payslips):', payrollMatch ? 'YES ✓' : 'NO ✗');
  console.log('PAYROLL PER-RUN DRIFT (KES):', perRunDrift.toFixed(2), perRunDrift <= 0.05 ? '✓' : '✗');
  console.log('ORPHAN PAYSLIPS:', results.orphanPayslips, results.orphanPayslips === 0 ? '✓' : '✗');
  if (!balanced || !payrollMatch || perRunDrift > 0.05 || results.orphanPayslips !== 0 || results.selfApprovedApprovals !== 0) {
    process.exit(1);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
