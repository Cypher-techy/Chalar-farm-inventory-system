import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import {
  calculateKenyanPayroll,
  type PayrollCalculationResult,
  type StatutoryRuleConfig,
} from '@/lib/payroll-calculator';

/** Standard monthly hours used to derive an overtime hourly rate (Kenyan 52h week cap basis). */
export const STANDARD_MONTHLY_HOURS = 208;

/**
 * Loads the statutory rule version in force on a given date.
 * Rules are date-effective and configurable — never hardcoded at call sites.
 */
export async function loadStatutoryRules(asOfISODate: string): Promise<StatutoryRuleConfig> {
  const db = await getDb();
  const res = (await db.execute(sql`
    SELECT version_code, personal_relief_kes, shif_rate_percent,
           ahl_employee_rate_percent, ahl_employer_rate_percent,
           nssf_tier1_limit_kes, nssf_tier2_limit_kes, nssf_rate_percent, paye_bands_json
    FROM statutory_rule_versions
    WHERE is_active
      AND effective_from::date <= ${asOfISODate}::date
      AND (effective_to IS NULL OR effective_to::date >= ${asOfISODate}::date)
    ORDER BY effective_from::date DESC
    LIMIT 1;
  `)) as unknown as {
    rows: Array<{
      version_code: string;
      personal_relief_kes: string;
      shif_rate_percent: string;
      ahl_employee_rate_percent: string;
      ahl_employer_rate_percent: string;
      nssf_tier1_limit_kes: string;
      nssf_tier2_limit_kes: string;
      nssf_rate_percent: string;
      paye_bands_json: string;
    }>;
  };

  const row = res.rows[0];
  if (!row) {
    throw new Error(
      `No statutory rule version is in force for ${asOfISODate}. Configure one in Finance → Statutory Rules before running payroll.`
    );
  }

  let bands: Array<{ upToKes: number | null; ratePercent: number }> = [];
  try {
    bands = JSON.parse(row.paye_bands_json);
  } catch {
    throw new Error(`Statutory version ${row.version_code} has malformed PAYE band JSON.`);
  }
  if (!Array.isArray(bands) || bands.length === 0) {
    throw new Error(`Statutory version ${row.version_code} defines no PAYE bands.`);
  }

  return {
    versionCode: row.version_code,
    personalReliefKes: Number(row.personal_relief_kes),
    shifRatePercent: Number(row.shif_rate_percent),
    ahlEmployeeRatePercent: Number(row.ahl_employee_rate_percent),
    ahlEmployerRatePercent: Number(row.ahl_employer_rate_percent),
    nssfTier1LimitKes: Number(row.nssf_tier1_limit_kes),
    nssfTier2LimitKes: Number(row.nssf_tier2_limit_kes),
    nssfRatePercent: Number(row.nssf_rate_percent),
    payeBands: bands,
  };
}

export interface PayrollLine {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  department: string;
  jobTitle: string;
  payFrequency: string;
  basicPayKes: number;
  overtimeHours: number;
  overtimePayKes: number;
  allowancesKes: number;
  otherDeductionsKes: number;
  result: PayrollCalculationResult;
}

export interface PayrollRunComputation {
  periodMonth: string;
  payDate: string;
  rules: StatutoryRuleConfig;
  lines: PayrollLine[];
  totals: {
    employeeCount: number;
    gross: number;
    paye: number;
    nssfEmployee: number;
    nssfEmployer: number;
    shif: number;
    housingLevyEmployee: number;
    housingLevyEmployer: number;
    otherDeductions: number;
    net: number;
  };
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Computes a full payroll run from database records:
 *  - basic pay from employee_profiles
 *  - approved overtime within the period, priced at the derived hourly rate × multiplier
 *  - statutory deductions from the date-effective rule version
 * Nothing is hardcoded: change the statutory version and results change.
 */
export async function computePayrollRun(
  periodMonth: string,
  payDate: string
): Promise<PayrollRunComputation> {
  const db = await getDb();
  const rules = await loadStatutoryRules(payDate);

  const empRes = (await db.execute(sql`
    SELECT e.id, e.employee_code, e.full_name, e.job_title, e.pay_frequency,
           e.basic_salary_kes, d.name AS department
    FROM employee_profiles e
    JOIN departments d ON d.id = e.department_id
    WHERE e.employment_status = 'ACTIVE'
    ORDER BY e.employee_code;
  `)) as unknown as {
    rows: Array<{
      id: number;
      employee_code: string;
      full_name: string;
      job_title: string;
      pay_frequency: string;
      basic_salary_kes: string;
      department: string;
    }>;
  };

  // Approved overtime hours inside the period, per employee
  const otRes = (await db.execute(sql`
    SELECT employee_id, COALESCE(SUM(requested_hours), 0)::float8 AS hours
    FROM overtime_requests
    WHERE status = 'APPROVED'
      AND to_char(work_date::date, 'YYYY-MM') = ${periodMonth}
    GROUP BY employee_id;
  `)) as unknown as { rows: Array<{ employee_id: number; hours: number }> };
  const otByEmployee = new Map<number, number>(otRes.rows.map((r) => [r.employee_id, r.hours]));

  // Average approved overtime multiplier for the period (defaults to 1.5 statutory minimum)
  const multRes = (await db.execute(sql`
    SELECT COALESCE(AVG(rate_multiplier), 1.5)::float8 AS mult
    FROM overtime_requests
    WHERE status = 'APPROVED' AND to_char(work_date::date, 'YYYY-MM') = ${periodMonth};
  `)) as unknown as { rows: Array<{ mult: number }> };
  const otMultiplier = multRes.rows[0]?.mult ?? 1.5;

  const lines: PayrollLine[] = empRes.rows.map((e) => {
    const basicPayKes = round2(Number(e.basic_salary_kes));
    const overtimeHours = round2(otByEmployee.get(e.id) ?? 0);
    const hourlyRate = basicPayKes / STANDARD_MONTHLY_HOURS;
    const overtimePayKes = round2(overtimeHours * hourlyRate * otMultiplier);

    const result = calculateKenyanPayroll({
      basicPayKes,
      overtimePayKes,
      allowancesKes: 0,
      otherDeductionsKes: 0,
      rules,
    });

    return {
      employeeId: e.id,
      employeeCode: e.employee_code,
      fullName: e.full_name,
      department: e.department,
      jobTitle: e.job_title,
      payFrequency: e.pay_frequency,
      basicPayKes,
      overtimeHours,
      overtimePayKes,
      allowancesKes: 0,
      otherDeductionsKes: 0,
      result,
    };
  });

  const totals = lines.reduce(
    (acc, l) => {
      acc.gross += l.result.grossPayKes;
      acc.paye += l.result.payeTaxKes;
      acc.nssfEmployee += l.result.nssfEmployeeKes;
      acc.nssfEmployer += l.result.nssfEmployerKes;
      acc.shif += l.result.shifKes;
      acc.housingLevyEmployee += l.result.housingLevyEmployeeKes;
      acc.housingLevyEmployer += l.result.housingLevyEmployerKes;
      acc.otherDeductions += l.result.otherDeductionsKes;
      acc.net += l.result.netPayKes;
      return acc;
    },
    {
      employeeCount: lines.length,
      gross: 0,
      paye: 0,
      nssfEmployee: 0,
      nssfEmployer: 0,
      shif: 0,
      housingLevyEmployee: 0,
      housingLevyEmployer: 0,
      otherDeductions: 0,
      net: 0,
    }
  );

  Object.keys(totals).forEach((key) => {
    if (key !== 'employeeCount') {
      (totals as unknown as Record<string, number>)[key] = round2(
        (totals as unknown as Record<string, number>)[key]
      );
    }
  });

  return { periodMonth, payDate, rules, lines, totals };
}
