import { describe, it, expect, beforeAll } from 'vitest';
import { freshDb, tokenFor, makeRequest, json, rows, one, db as getTestDb, ADMIN_PASSWORD } from './helpers';
import { calculateKenyanPayroll, DEFAULT_KENYA_2026_STATUTORY_RULES } from '@/lib/payroll-calculator';
import { loadStatutoryRules, computePayrollRun, STANDARD_MONTHLY_HOURS } from '@/lib/payroll-service';
import { POST as createRun, GET as listRuns } from '@/app/api/payroll/runs/route';
import { POST as approveRun } from '@/app/api/payroll/runs/[code]/approve/route';
import { GET as getPayslips } from '@/app/api/payroll/payslips/route';
import { sql } from 'drizzle-orm';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

describe('Kenyan statutory payroll', () => {
  beforeAll(async () => {
    await freshDb();
  }, 120000);

  describe('statutory calculation engine', () => {
    it('applies NSSF at 6% with the Tier II ceiling', () => {
      const low = calculateKenyanPayroll({ basicPayKes: 30000, overtimePayKes: 0, allowancesKes: 0 });
      expect(low.nssfEmployeeKes).toBeCloseTo(1800, 2); // 6% of 30,000
      expect(low.nssfEmployerKes).toBeCloseTo(1800, 2); // equal-share scheme

      const high = calculateKenyanPayroll({ basicPayKes: 250000, overtimePayKes: 0, allowancesKes: 0 });
      expect(high.nssfEmployeeKes).toBeCloseTo(4320, 2); // 6% of the 72,000 ceiling
    });

    it('applies SHIF at 2.75% with a KES 300 minimum', () => {
      const mid = calculateKenyanPayroll({ basicPayKes: 30000, overtimePayKes: 0, allowancesKes: 0 });
      expect(mid.shifKes).toBeCloseTo(825, 2); // 2.75% of 30,000

      const small = calculateKenyanPayroll({ basicPayKes: 5000, overtimePayKes: 0, allowancesKes: 0 });
      expect(small.shifKes).toBe(300); // floor applies (2.75% would be 137.50)

      const zero = calculateKenyanPayroll({ basicPayKes: 0, overtimePayKes: 0, allowancesKes: 0 });
      expect(zero.shifKes).toBe(0); // no pay, no contribution
    });

    it('applies the Affordable Housing Levy at 1.5% employee and 1.5% employer', () => {
      const r = calculateKenyanPayroll({ basicPayKes: 100000, overtimePayKes: 0, allowancesKes: 0 });
      expect(r.housingLevyEmployeeKes).toBeCloseTo(1500, 2);
      expect(r.housingLevyEmployerKes).toBeCloseTo(1500, 2);
    });

    it('computes graduated PAYE with personal relief', () => {
      // 30,000 gross → taxable 26,925 after statutory deductions
      const r = calculateKenyanPayroll({ basicPayKes: 30000, overtimePayKes: 0, allowancesKes: 0 });
      expect(r.taxablePayKes).toBeCloseTo(30000 - 1800 - 825 - 450, 2);
      // 24,000 @10% = 2,400 plus 2,925 @25% = 731.25 → 3,131.25 less 2,400 relief
      expect(r.payeBeforeReliefKes).toBeCloseTo(3131.25, 2);
      expect(r.personalReliefKes).toBe(2400);
      expect(r.payeTaxKes).toBeCloseTo(731.25, 2);
    });

    it('charges no PAYE when taxable pay is within the relieved threshold', () => {
      const r = calculateKenyanPayroll({ basicPayKes: 10000, overtimePayKes: 0, allowancesKes: 0 });
      expect(r.payeTaxKes).toBe(0);
      expect(r.netPayKes).toBeCloseTo(10000 - 600 - 300 - 150, 2);
    });

    it('reaches the top band (35%) for very high earners', () => {
      const r = calculateKenyanPayroll({ basicPayKes: 1200000, overtimePayKes: 0, allowancesKes: 0 });
      // bands: 24,000@10% + 8,333@25% + 467,667@30% + 300,000@32.5% + remainder@35%
      const taxable = r.taxablePayKes;
      const expectedBeforeRelief = round2(
        24000 * 0.1 + (32333 - 24000) * 0.25 + (500000 - 32333) * 0.3 +
        (800000 - 500000) * 0.325 + (taxable - 800000) * 0.35
      );
      expect(r.payeBeforeReliefKes).toBeCloseTo(expectedBeforeRelief, 1);
      expect(r.payeTaxKes).toBeCloseTo(expectedBeforeRelief - 2400, 1);
    });

    it('always satisfies net = gross − deductions and never returns a negative net', () => {
      for (const basic of [0, 4500, 12000, 30000, 78500, 250000, 1500000]) {
        const r = calculateKenyanPayroll({ basicPayKes: basic, overtimePayKes: basic * 0.1, allowancesKes: 2500 });
        const deductions = round2(
          r.nssfEmployeeKes + r.shifKes + r.housingLevyEmployeeKes + r.payeTaxKes + r.otherDeductionsKes
        );
        expect(r.grossPayKes).toBeCloseTo(round2(basic + basic * 0.1 + 2500), 2);
        expect(r.totalDeductionsKes).toBeCloseTo(deductions, 2);
        expect(r.netPayKes).toBeCloseTo(round2(r.grossPayKes - deductions), 2);
        expect(r.netPayKes).toBeGreaterThanOrEqual(0);
      }
    });

    it('uses the configured rule version rather than hardcoded rates', () => {
      const custom = {
        ...DEFAULT_KENYA_2026_STATUTORY_RULES,
        versionCode: 'KE-STAT-TEST',
        shifRatePercent: 3.0,
        personalReliefKes: 3000,
        nssfRatePercent: 7,
      };
      const r = calculateKenyanPayroll({ basicPayKes: 50000, overtimePayKes: 0, allowancesKes: 0, rules: custom });
      expect(r.shifKes).toBeCloseTo(1500, 2); // 3% of 50,000
      expect(r.nssfEmployeeKes).toBeCloseTo(3500, 2); // 7% of 50,000
    });
  });

  describe('date-effective statutory configuration', () => {
    it('loads the rule version in force on the pay date from the database', async () => {
      const rules = await loadStatutoryRules('2026-10-31');
      expect(rules.versionCode).toBe('KE-STAT-2026-V1');
      expect(rules.personalReliefKes).toBe(2400);
      expect(rules.shifRatePercent).toBe(2.75);
      expect(rules.payeBands.length).toBeGreaterThan(3);
    });

    it('refuses to run payroll when no rule version is in force', async () => {
      await expect(loadStatutoryRules('2019-01-31')).rejects.toThrow(/No statutory rule version/);
    });

    it('picks the newest version whose effective date has passed', async () => {
      const d = await getTestDb();
      await d.execute(sql`
        INSERT INTO statutory_rule_versions
          (version_code, country_code, effective_from, personal_relief_kes, shif_rate_percent,
           ahl_employee_rate_percent, ahl_employer_rate_percent, nssf_tier1_limit_kes,
           nssf_tier2_limit_kes, nssf_rate_percent, paye_bands_json, is_active)
        VALUES ('KE-STAT-2027-V1', 'KE', '2027-01-01', 2500.00, 2.75, 1.5, 1.5, 8000, 72000, 6.0,
                '[{"upToKes":24000,"ratePercent":10},{"upToKes":null,"ratePercent":30}]', true)
        ON CONFLICT (version_code) DO NOTHING;
      `);
      const before2027 = await loadStatutoryRules('2026-12-31');
      const after2027 = await loadStatutoryRules('2027-02-01');
      expect(before2027.versionCode).toBe('KE-STAT-2026-V1');
      expect(after2027.versionCode).toBe('KE-STAT-2027-V1');
      expect(after2027.personalReliefKes).toBe(2500);
    });
  });

  describe('run computation from live records', () => {
    it('derives overtime pay from approved overtime requests at the derived hourly rate', async () => {
      const computation = await computePayrollRun('2026-10', '2026-10-31');
      expect(computation.lines.length).toBeGreaterThan(0);

      const withOt = computation.lines.filter((l) => l.overtimeHours > 0);
      for (const line of withOt) {
        const expectedHourly = line.basicPayKes / STANDARD_MONTHLY_HOURS;
        expect(line.overtimePayKes).toBeGreaterThan(0);
        expect(line.overtimePayKes).toBeCloseTo(line.overtimeHours * expectedHourly * 1.5, 0);
      }
    });

    it('reconciles: sum of lines equals the run totals', async () => {
      const computation = await computePayrollRun('2026-10', '2026-10-31');
      const sum = (pick: (l: (typeof computation.lines)[number]) => number) =>
        round2(computation.lines.reduce((a, l) => a + pick(l), 0));

      expect(computation.totals.gross).toBeCloseTo(sum((l) => l.result.grossPayKes), 2);
      expect(computation.totals.paye).toBeCloseTo(sum((l) => l.result.payeTaxKes), 2);
      expect(computation.totals.shif).toBeCloseTo(sum((l) => l.result.shifKes), 2);
      expect(computation.totals.net).toBeCloseTo(sum((l) => l.result.netPayKes), 2);
      expect(computation.totals.employeeCount).toBe(computation.lines.length);
    });
  });

  describe('run lifecycle and segregation of duties', () => {
    const period = '2026-12';
    let runCode = '';

    it('creates a draft run and refuses duplicates for the same period', async () => {
      // The Super Administrator holds payroll.manage, which lets us prove the
      // segregation-of-duties rule below against the very same preparer.
      const payrollToken = await tokenFor('superadmin@chalarfarms.demo', ADMIN_PASSWORD);
      const res = await createRun(
        makeRequest('http://localhost/api/payroll/runs', {
          method: 'POST',
          token: payrollToken,
          headers: { 'idempotency-key': `test-run-${period}` },
          body: { periodMonth: period, payDate: '2026-12-31' },
        })
      );
      expect(res.status).toBe(201);
      const body = (await json(res)) as { runCode: string; totals: Record<string, number> };
      runCode = body.runCode;
      expect(body.totals.employeeCount).toBeGreaterThan(0);
      expect(body.totals.gross).toBeGreaterThan(0);

      const duplicate = await createRun(
        makeRequest('http://localhost/api/payroll/runs', {
          method: 'POST',
          token: payrollToken,
          body: { periodMonth: period, payDate: '2026-12-31' },
        })
      );
      expect(duplicate.status).toBe(409);
    });

    it('blocks the preparer from approving their own run', async () => {
      const payrollToken = await tokenFor('superadmin@chalarfarms.demo', ADMIN_PASSWORD);
      const res = await approveRun(
        makeRequest(`http://localhost/api/payroll/runs/${runCode}/approve`, {
          method: 'POST',
          token: payrollToken,
          body: { decision: 'APPROVE' },
        }),
        { params: Promise.resolve({ code: runCode }) }
      );
      expect(res.status).toBe(403);
      expect(String((await json(res)).error)).toMatch(/segregation of duties/i);
    });

    it('blocks approval by a user without the payroll approval permission', async () => {
      const qaToken = await tokenFor('qa@chalarfarms.demo');
      const res = await approveRun(
        makeRequest(`http://localhost/api/payroll/runs/${runCode}/approve`, {
          method: 'POST',
          token: qaToken,
          body: { decision: 'APPROVE' },
        }),
        { params: Promise.resolve({ code: runCode }) }
      );
      expect(res.status).toBe(403);
    });

    it('allows a second authorized approver and posts a balanced journal', async () => {
      const financeToken = await tokenFor('finance@chalarfarms.demo');
      const before = await one<{ dr: string; cr: string }>(sql`
        SELECT COALESCE(SUM(total_debit_kes),0)::text AS dr, COALESCE(SUM(total_credit_kes),0)::text AS cr
        FROM journal_entries WHERE status = 'POSTED'
      `);

      const res = await approveRun(
        makeRequest(`http://localhost/api/payroll/runs/${runCode}/approve`, {
          method: 'POST',
          token: financeToken,
          body: { decision: 'APPROVE', comments: 'Verified against timesheets in test' },
        }),
        { params: Promise.resolve({ code: runCode }) }
      );
      expect(res.status).toBe(200);
      const body = (await json(res)) as { journalEntry: string; totalDebit: string; totalCredit: string };
      expect(body.totalDebit).toBe(body.totalCredit);

      const after = await one<{ dr: string; cr: string }>(sql`
        SELECT COALESCE(SUM(total_debit_kes),0)::text AS dr, COALESCE(SUM(total_credit_kes),0)::text AS cr
        FROM journal_entries WHERE status = 'POSTED'
      `);
      expect(Number(after.dr)).toBeCloseTo(Number(before.dr) + Number(body.totalDebit), 2);
      expect(after.dr).toBe(after.cr); // trial balance still balanced

      // Payslips marked paid and the run approved by a different user than the preparer
      const run = await one<{ status: string; prepared: number | null; approved: number | null }>(sql`
        SELECT status, prepared_by_user_id AS prepared, approved_by_user_id AS approved
        FROM payroll_runs WHERE run_code = ${runCode}
      `);
      expect(run.status).toBe('APPROVED');
      expect(run.approved).not.toBeNull();
      expect(run.approved).not.toBe(run.prepared);

      const unpaid = await one<{ c: number }>(sql`
        SELECT count(*)::int AS c FROM payslip_records ps
        JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
        WHERE pr.run_code = ${runCode} AND ps.payment_status != 'PAID'
      `);
      expect(unpaid.c).toBe(0);

      // Statutory liabilities posted to the correct control accounts
      const liabilities = await rows<{ code: string; credit: string }>(sql`
        SELECT a.account_code AS code, SUM(jl.credit_kes)::text AS credit
        FROM journal_lines jl
        JOIN chart_of_accounts a ON a.id = jl.account_id
        JOIN journal_entries je ON je.id = jl.journal_entry_id
        WHERE je.entry_number = ${body.journalEntry} AND a.account_code IN ('2100','2110','2120','2130')
        GROUP BY a.account_code ORDER BY a.account_code
      `);
      expect(liabilities.length).toBe(4);
      for (const l of liabilities) expect(Number(l.credit)).toBeGreaterThan(0);
    });

    it('refuses to re-approve an already approved run', async () => {
      const financeToken = await tokenFor('finance@chalarfarms.demo');
      const res = await approveRun(
        makeRequest(`http://localhost/api/payroll/runs/${runCode}/approve`, {
          method: 'POST',
          token: financeToken,
          body: { decision: 'APPROVE' },
        }),
        { params: Promise.resolve({ code: runCode }) }
      );
      expect(res.status).toBe(409);
    });
  });

  describe('payslip confidentiality', () => {
    it('gives payroll staff the full register', async () => {
      const token = await tokenFor('payroll@chalarfarms.demo');
      const res = await getPayslips(makeRequest('http://localhost/api/payroll/payslips', { token }));
      expect(res.status).toBe(200);
      const body = (await json(res)) as { payslips: unknown[]; scope: string };
      expect(body.scope).toBe('all');
      expect(body.payslips.length).toBeGreaterThan(1);
    });

    it('restricts an ordinary employee to their own payslips only', async () => {
      const token = await tokenFor('employee@chalarfarms.demo');
      const res = await getPayslips(makeRequest('http://localhost/api/payroll/payslips', { token }));
      expect(res.status).toBe(200);
      const body = (await json(res)) as { payslips: Array<{ employeeName: string }>; scope: string };
      expect(body.scope).toBe('self');
      const names = new Set(body.payslips.map((p) => p.employeeName));
      expect(names.size).toBeLessThanOrEqual(1);
    });

    it('denies payroll access entirely to roles without the permission', async () => {
      const token = await tokenFor('logistics@chalarfarms.demo');
      const res = await listRuns(makeRequest('http://localhost/api/payroll/runs', { token }));
      expect(res.status).toBe(403);
    });
  });
});
