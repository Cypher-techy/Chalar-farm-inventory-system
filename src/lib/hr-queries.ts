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

export async function hrKpis() {
  return one<{
    total_employees: number;
    active: number;
    on_leave: number;
    suspended: number;
    terminated: number;
    female: number;
    youth: number;
    permanent: number;
    contract: number;
    seasonal: number;
    casual: number;
    present_today: number;
    absent_today: number;
    late_today: number;
    attendance_rate_today: string;
    pending_leave: number;
    approved_leave_30d: number;
    pending_overtime: number;
    approved_overtime_hours_30d: string;
    open_vacancies: number;
    candidates_in_pipeline: number;
    training_due_30d: number;
    reviews_pending: number;
    monthly_payroll_cost: string;
  }>(sql`
    SELECT
      (SELECT count(*)::int FROM employee_profiles)::int AS total_employees,
      (SELECT count(*)::int FROM employee_profiles WHERE employment_status = 'ACTIVE')::int AS active,
      (SELECT count(*)::int FROM employee_profiles WHERE employment_status = 'ON_LEAVE')::int AS on_leave,
      (SELECT count(*)::int FROM employee_profiles WHERE employment_status = 'SUSPENDED')::int AS suspended,
      (SELECT count(*)::int FROM employee_profiles WHERE employment_status = 'TERMINATED')::int AS terminated,
      (SELECT count(*)::int FROM employee_profiles WHERE gender = 'FEMALE' AND employment_status = 'ACTIVE')::int AS female,
      (SELECT count(*)::int FROM employee_profiles
        WHERE employment_status = 'ACTIVE'
          AND date_of_birth::date >= CURRENT_DATE - interval '35 years')::int AS youth,
      (SELECT count(*)::int FROM employee_profiles WHERE employment_type = 'PERMANENT' AND employment_status = 'ACTIVE')::int AS permanent,
      (SELECT count(*)::int FROM employee_profiles WHERE employment_type = 'CONTRACT' AND employment_status = 'ACTIVE')::int AS contract,
      (SELECT count(*)::int FROM employee_profiles WHERE employment_type = 'SEASONAL' AND employment_status = 'ACTIVE')::int AS seasonal,
      (SELECT count(*)::int FROM employee_profiles WHERE employment_type = 'CASUAL' AND employment_status = 'ACTIVE')::int AS casual,
      (SELECT count(*)::int FROM attendance_records WHERE attendance_date::date = CURRENT_DATE AND status IN ('PRESENT','LATE'))::int AS present_today,
      (SELECT count(*)::int FROM attendance_records WHERE attendance_date::date = CURRENT_DATE AND status = 'ABSENT')::int AS absent_today,
      (SELECT count(*)::int FROM attendance_records WHERE attendance_date::date = CURRENT_DATE AND status = 'LATE')::int AS late_today,
      (SELECT CASE WHEN count(*) = 0 THEN '0'
              ELSE round(100.0 * count(*) FILTER (WHERE status IN ('PRESENT','LATE')) / count(*), 1)::text END
        FROM attendance_records WHERE attendance_date::date = CURRENT_DATE)::text AS attendance_rate_today,
      (SELECT count(*)::int FROM leave_requests WHERE status = 'PENDING')::int AS pending_leave,
      (SELECT count(*)::int FROM leave_requests WHERE status = 'APPROVED' AND reviewed_at > now() - interval '30 days')::int AS approved_leave_30d,
      (SELECT count(*)::int FROM overtime_requests WHERE status = 'PENDING')::int AS pending_overtime,
      (SELECT COALESCE(SUM(requested_hours),0) FROM overtime_requests
        WHERE status = 'APPROVED' AND approved_at > now() - interval '30 days')::text AS approved_overtime_hours_30d,
      (SELECT count(*)::int FROM recruitment_vacancies WHERE status IN ('OPEN','INTERVIEWING','OFFERED'))::int AS open_vacancies,
      (SELECT count(*)::int FROM candidates WHERE stage NOT IN ('HIRED','REJECTED'))::int AS candidates_in_pipeline,
      (SELECT count(*)::int FROM training_records WHERE expiry_date IS NOT NULL AND expiry_date::date <= CURRENT_DATE + 30 AND expiry_date::date >= CURRENT_DATE)::int AS training_due_30d,
      (SELECT count(*)::int FROM performance_reviews WHERE status IN ('DRAFT','IN_REVIEW'))::int AS reviews_pending,
      (SELECT COALESCE(SUM(basic_salary_kes),0) FROM employee_profiles WHERE employment_status = 'ACTIVE')::text AS monthly_payroll_cost;
  `);
}

export async function headcountByDepartment() {
  return many<{ name: string; value: number }>(sql`
    SELECT d.name, count(e.id)::int AS value
    FROM departments d
    LEFT JOIN employee_profiles e ON e.department_id = d.id AND e.employment_status = 'ACTIVE'
    GROUP BY d.id, d.name
    HAVING count(e.id) > 0
    ORDER BY value DESC;
  `);
}

export async function attendanceTrend(days = 14) {
  return many<{ name: string; present: number; absent: number; late: number }>(sql`
    SELECT to_char(attendance_date::date, 'DD Mon') AS name,
           count(*) FILTER (WHERE status = 'PRESENT')::int AS present,
           count(*) FILTER (WHERE status = 'ABSENT')::int AS absent,
           count(*) FILTER (WHERE status = 'LATE')::int AS late
    FROM attendance_records
    WHERE attendance_date::date >= CURRENT_DATE - ${days}::int
    GROUP BY attendance_date::date
    ORDER BY attendance_date::date;
  `);
}

export async function employeeDirectory(opts: {
  search?: string;
  departmentId?: number;
  status?: string;
  sensitive: boolean;
  limit?: number;
}) {
  const search = opts.search?.trim();
  const sensitiveCols = opts.sensitive
    ? sql`e.national_id_number AS "nationalId", e.kra_pin AS "kraPin", e.nssf_number AS "nssfNumber",
          e.shif_number AS "shifNumber", e.bank_name AS "bankName", e.bank_account_number AS "bankAccount",
          e.date_of_birth AS "dateOfBirth", e.emergency_contact_name AS "emergencyName",
          e.emergency_contact_phone AS "emergencyPhone", e.basic_salary_kes AS "basicSalaryKes",`
    : sql``;

  return many<Record<string, string | number | null>>(sql`
    SELECT e.id, e.employee_code AS "employeeCode", e.full_name AS "fullName", e.email,
           e.job_title AS "jobTitle", e.employment_type AS "employmentType",
           e.employment_status AS "employmentStatus", e.gender, e.hire_date AS "hireDate",
           e.contract_end_date AS "contractEndDate", e.pay_frequency AS "payFrequency",
           d.name AS department, s.full_name AS supervisor,
           ${sensitiveCols}
           (SELECT COALESCE(SUM(lb.remaining_days),0) FROM leave_balances lb
             WHERE lb.employee_id = e.id AND lb.leave_type_id = 1 AND lb.year = EXTRACT(YEAR FROM CURRENT_DATE)::int)::text AS "annualLeaveRemaining"
    FROM employee_profiles e
    JOIN departments d ON d.id = e.department_id
    LEFT JOIN users s ON s.id = e.supervisor_user_id
    WHERE (${search ? sql`e.full_name ILIKE ${'%' + search + '%'}` : sql`TRUE`}
       OR  ${search ? sql`e.employee_code ILIKE ${'%' + search + '%'}` : sql`TRUE`})
      AND ${opts.departmentId ? sql`e.department_id = ${opts.departmentId}` : sql`TRUE`}
      AND ${opts.status ? sql`e.employment_status = ${opts.status}` : sql`TRUE`}
    ORDER BY e.full_name
    LIMIT ${opts.limit ?? 60}::int;
  `);
}

export async function leaveQueue(limit = 20) {
  return many<{
    requestNumber: string;
    employee: string;
    employeeCode: string;
    department: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    totalDays: string;
    reason: string;
    status: string;
    createdAt: string;
    remainingDays: string | null;
    approvalCode: string | null;
  }>(sql`
    SELECT lr.request_number AS "requestNumber", e.full_name AS employee,
           e.employee_code AS "employeeCode", d.name AS department, lt.name AS "leaveType",
           lr.start_date AS "startDate", lr.end_date AS "endDate", lr.total_days AS "totalDays",
           lr.reason, lr.status, lr.created_at AS "createdAt",
           (SELECT lb.remaining_days::text FROM leave_balances lb
             WHERE lb.employee_id = lr.employee_id AND lb.leave_type_id = lr.leave_type_id
               AND lb.year = EXTRACT(YEAR FROM lr.start_date::date)::int
             LIMIT 1) AS "remainingDays",
           (SELECT ar.request_code FROM approval_requests ar
             WHERE ar.entity_type = 'LEAVE_REQUEST' AND ar.entity_id = lr.id
             ORDER BY ar.id DESC LIMIT 1) AS "approvalCode"
    FROM leave_requests lr
    JOIN employee_profiles e ON e.id = lr.employee_id
    JOIN departments d ON d.id = e.department_id
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    ORDER BY (lr.status = 'PENDING') DESC, lr.created_at DESC
    LIMIT ${limit}::int;
  `);
}

export interface LeaveTypeRow {
  id: number;
  code: string;
  name: string;
  defaultAnnualDays: number;
  statutoryBasis: string;
  isPaid: boolean;
  entitled: string | null;
  used: string | null;
  pending: string | null;
  remaining: string | null;
}

/** Leave types, optionally joined to one employee's balance for the current year. */
export async function leaveTypesWithBalances(employeeId?: number): Promise<LeaveTypeRow[]> {
  return many<LeaveTypeRow>(sql`
    SELECT lt.id, lt.code, lt.name, lt.default_annual_days AS "defaultAnnualDays",
           lt.statutory_basis AS "statutoryBasis", lt.is_paid AS "isPaid",
           lb.entitled_days AS entitled, lb.used_days AS used,
           lb.pending_days AS pending, lb.remaining_days AS remaining
    FROM leave_types lt
    ${
      employeeId
        ? sql`LEFT JOIN leave_balances lb ON lb.leave_type_id = lt.id
                AND lb.employee_id = ${employeeId}
                AND lb.year = EXTRACT(YEAR FROM CURRENT_DATE)::int`
        : sql`LEFT JOIN leave_balances lb ON FALSE`
    }
    ORDER BY lt.id;
  `);
}

export async function recruitmentFunnel() {
  return many<{ name: string; value: number }>(sql`
    SELECT stage AS name, count(*)::int AS value
    FROM candidates
    GROUP BY stage
    ORDER BY value DESC;
  `);
}

export async function vacancies(limit = 10) {
  return many<{
    vacancyCode: string;
    title: string;
    department: string;
    employmentType: string;
    positionsCount: number;
    status: string;
    closingDate: string;
    applicants: number;
  }>(sql`
    SELECT v.vacancy_code AS "vacancyCode", v.title, d.name AS department,
           v.employment_type AS "employmentType", v.positions_count AS "positionsCount",
           v.status, v.closing_date AS "closingDate",
           (SELECT count(*)::int FROM candidates c WHERE c.vacancy_id = v.id)::int AS applicants
    FROM recruitment_vacancies v
    JOIN departments d ON d.id = v.department_id
    ORDER BY (v.status = 'CLOSED') ASC, v.closing_date::date
    LIMIT ${limit}::int;
  `);
}

export async function trainingCompliance(limit = 12) {
  return many<{
    employee: string;
    course: string;
    category: string;
    trainer: string;
    trainingDate: string;
    expiryDate: string | null;
    status: string;
    completionStatus: string;
    scorePercent: number;
    certificateNumber: string | null;
  }>(sql`
    SELECT e.full_name AS employee, t.program_name AS course, t.category,
           t.trainer_name AS trainer, t.training_date AS "trainingDate",
           t.expiry_date AS "expiryDate",
           CASE
             WHEN t.expiry_date IS NULL THEN 'NO_EXPIRY'
             WHEN t.expiry_date::date < CURRENT_DATE THEN 'EXPIRED'
             WHEN t.expiry_date::date <= CURRENT_DATE + 30 THEN 'EXPIRING_SOON'
             ELSE 'VALID'
           END AS status,
           t.completion_status AS "completionStatus",
           t.score_percent AS "scorePercent",
           t.certificate_number AS "certificateNumber"
    FROM training_records t
    JOIN employee_profiles e ON e.id = t.employee_id
    ORDER BY (t.expiry_date IS NULL), t.expiry_date::date NULLS LAST
    LIMIT ${limit}::int;
  `);
}

export async function overtimeQueue(limit = 12) {
  return many<{
    employee: string;
    department: string;
    workDate: string;
    requestedHours: string;
    rateMultiplier: string;
    reason: string;
    status: string;
    approvedBy: string | null;
  }>(sql`
    SELECT e.full_name AS employee, d.name AS department, o.work_date AS "workDate",
           o.requested_hours AS "requestedHours", o.rate_multiplier AS "rateMultiplier",
           o.reason, o.status, u.full_name AS "approvedBy"
    FROM overtime_requests o
    JOIN employee_profiles e ON e.id = o.employee_id
    JOIN departments d ON d.id = e.department_id
    LEFT JOIN users u ON u.id = o.approved_by_user_id
    ORDER BY (o.status = 'PENDING') DESC, o.work_date::date DESC
    LIMIT ${limit}::int;
  `);
}

export async function departmentsList() {
  return many<{ id: number; name: string; headcount: number }>(sql`
    SELECT d.id, d.name,
           (SELECT count(*)::int FROM employee_profiles e
             WHERE e.department_id = d.id AND e.employment_status = 'ACTIVE')::int AS headcount
    FROM departments d
    ORDER BY d.name;
  `);
}
