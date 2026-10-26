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
    payrollRunNet: (await one(sql`SELECT COALESCE(total_net_pay_kes,0)::text v FROM payroll_runs LIMIT 1`)).v,
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
  console.log('TRIAL BALANCE:', balanced ? 'BALANCED ✓' : 'MISMATCH ✗');
  console.log('PAYROLL RECONCILES:', payrollMatch ? 'YES ✓' : 'NO ✗');
  if (!balanced || !payrollMatch || results.selfApprovedApprovals !== 0) process.exit(1);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
