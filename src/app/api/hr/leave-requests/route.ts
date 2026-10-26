import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import * as t from '@/db/schema';
import { requireAuth, jsonOk, jsonError, clientIp, rateLimit } from '@/lib/guards';
import { recordAuditLog, hasPermission } from '@/lib/auth';
import { createNotification } from '@/lib/chat';

export const dynamic = 'force-dynamic';

/** Whole working days between two dates inclusive, excluding Sundays (Kenyan rest day). */
export function workingDaysInclusive(startISO: string, endISO: string): number {
  const start = new Date(startISO + 'T00:00:00Z');
  const end = new Date(endISO + 'T00:00:00Z');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  let days = 0;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() !== 0) days += 1;
  }
  return days;
}

const leaveSchema = z
  .object({
    employeeId: z.number().int().positive().optional(),
    leaveTypeCode: z.string().min(2).max(32),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.'),
    reason: z.string().min(5, 'Give a short reason (at least 5 characters).').max(500),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: 'End date cannot be before start date.',
    path: ['endDate'],
  });

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const db = await getDb();
    const canSeeAll = hasPermission(user, 'hr.manage');
    const scope = req.nextUrl.searchParams.get('scope');

    if (!canSeeAll || scope === 'mine') {
      const mine = (await db.execute(sql`
        SELECT lr.request_number AS "requestNumber", lt.name AS "leaveType",
               lr.start_date AS "startDate", lr.end_date AS "endDate",
               lr.total_days AS "totalDays", lr.reason, lr.status,
               lr.review_comments AS "reviewComments", lr.created_at AS "createdAt"
        FROM leave_requests lr
        JOIN employee_profiles e ON e.id = lr.employee_id
        JOIN leave_types lt ON lt.id = lr.leave_type_id
        WHERE e.user_id = ${user.id}
        ORDER BY lr.created_at DESC
        LIMIT 40;
      `)) as unknown as { rows: unknown[] };
      return jsonOk({ requests: mine.rows, scope: 'mine' });
    }

    const all = (await db.execute(sql`
      SELECT lr.request_number AS "requestNumber", e.full_name AS employee,
             lt.name AS "leaveType", lr.start_date AS "startDate", lr.end_date AS "endDate",
             lr.total_days AS "totalDays", lr.status, lr.created_at AS "createdAt"
      FROM leave_requests lr
      JOIN employee_profiles e ON e.id = lr.employee_id
      JOIN leave_types lt ON lt.id = lr.leave_type_id
      ORDER BY (lr.status = 'PENDING') DESC, lr.created_at DESC
      LIMIT 60;
    `)) as unknown as { rows: unknown[] };
    return jsonOk({ requests: all.rows, scope: 'all' });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('leave GET', e);
    return jsonError(500, 'Failed to load leave requests.');
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const ip = clientIp(req);
    rateLimit(`leave:${user.id}`, 10, 60_000);

    const body = await req.json().catch(() => null);
    const parsed = leaveSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.join('.') ?? 'payload';
      return jsonError(
        400,
        issue?.message === 'Required' ? `${field} is required.` : issue?.message ?? 'Invalid payload.'
      );
    }
    const data = parsed.data;
    const db = await getDb();

    // ---- Resolve the employee the request is for (self-service unless HR) ----
    let employeeId = data.employeeId;
    if (employeeId && employeeId !== undefined) {
      if (!hasPermission(user, 'hr.manage')) {
        return jsonError(403, 'You can only submit leave requests for your own employee record.');
      }
    } else {
      const ownRows = (await db.execute(sql`
        SELECT id FROM employee_profiles WHERE user_id = ${user.id} LIMIT 1;
      `)) as unknown as { rows: Array<{ id: number }> };
      if (!ownRows.rows[0]) {
        return jsonError(404, 'No employee record is linked to your user account.');
      }
      employeeId = ownRows.rows[0].id;
    }

    const empRows = (await db.execute(sql`
      SELECT e.id, e.full_name, e.employment_status, e.employment_type, e.hire_date,
             e.department_id, e.supervisor_user_id, d.name AS department
      FROM employee_profiles e JOIN departments d ON d.id = e.department_id
      WHERE e.id = ${employeeId} LIMIT 1;
    `)) as unknown as {
      rows: Array<{
        id: number;
        full_name: string;
        employment_status: string;
        employment_type: string;
        hire_date: string;
        department_id: number;
        supervisor_user_id: number | null;
        department: string;
      }>;
    };
    const emp = empRows.rows[0];
    if (!emp) return jsonError(404, 'Employee not found.');
    if (emp.employment_status === 'TERMINATED') {
      return jsonError(409, 'Leave cannot be requested for a terminated employee record.');
    }

    const typeRows = (await db.execute(sql`
      SELECT id, code, name, default_annual_days, is_paid, statutory_basis
      FROM leave_types WHERE code = ${data.leaveTypeCode} LIMIT 1;
    `)) as unknown as {
      rows: Array<{ id: number; code: string; name: string; default_annual_days: number; is_paid: boolean; statutory_basis: string }>;
    };
    const leaveType = typeRows.rows[0];
    if (!leaveType) return jsonError(404, 'Unknown leave type.');

    const totalDays = workingDaysInclusive(data.startDate, data.endDate);
    if (totalDays <= 0) {
      return jsonError(400, 'The selected period contains no working days (Sundays are rest days under the Employment Act, 2007).');
    }

    // ---- Balance check (entitlement less used less already pending) ----
    const year = Number(data.startDate.slice(0, 4));
    const balRows = (await db.execute(sql`
      SELECT entitled_days, used_days, pending_days, remaining_days
      FROM leave_balances
      WHERE employee_id = ${employeeId} AND leave_type_id = ${leaveType.id} AND year = ${year}
      LIMIT 1;
    `)) as unknown as {
      rows: Array<{ entitled_days: string; used_days: string; pending_days: string; remaining_days: string }>;
    };
    const bal = balRows.rows[0];
    if (!bal) {
      return jsonError(409, `No ${leaveType.name} balance exists for ${year}. HR must initialise the entitlement first.`);
    }
    const available = Number(bal.entitled_days) - Number(bal.used_days) - Number(bal.pending_days);
    if (totalDays > available) {
      return jsonError(
        409,
        `Insufficient ${leaveType.name} balance: requesting ${totalDays} working day(s) but only ${available} available (entitled ${bal.entitled_days}, used ${bal.used_days}, pending ${bal.pending_days}).`
      );
    }

    // ---- Overlap check: no double-booked leave ----
    const overlap = (await db.execute(sql`
      SELECT request_number FROM leave_requests
      WHERE employee_id = ${employeeId}
        AND status IN ('PENDING','APPROVED')
        AND start_date::date <= ${data.endDate}::date
        AND end_date::date >= ${data.startDate}::date
      LIMIT 1;
    `)) as unknown as { rows: Array<{ request_number: string }> };
    if (overlap.rows[0]) {
      return jsonError(409, `This period overlaps existing leave request ${overlap.rows[0].request_number}.`);
    }

    const requestNumber = `LR-${year}-${Date.now().toString().slice(-6)}`;

    const result = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(t.leaveRequests)
        .values({
          requestNumber,
          employeeId: employeeId as number,
          leaveTypeId: leaveType.id,
          startDate: data.startDate,
          endDate: data.endDate,
          totalDays: String(totalDays),
          reason: data.reason,
          status: 'PENDING',
        })
        .returning();
      const leaveRequestId = inserted[0].id;

      // Reserve the days as pending so balances cannot be over-committed
      await tx.execute(sql`
        UPDATE leave_balances
        SET pending_days = pending_days + ${totalDays}::numeric,
            remaining_days = GREATEST(entitled_days - used_days - (pending_days + ${totalDays}::numeric), 0)
        WHERE employee_id = ${employeeId} AND leave_type_id = ${leaveType.id} AND year = ${year};
      `);

      // Route the approval to the employee's supervisor (or HR if none)
      const assignedRole = emp.supervisor_user_id ? 'DEPARTMENT_SUPERVISOR' : 'HR_MANAGER';
      await tx.insert(t.approvalRequests).values({
        requestCode: `APR-LV-${requestNumber}`,
        module: 'HR',
        entityType: 'LEAVE_REQUEST',
        entityId: leaveRequestId,
        title: `${leaveType.name} — ${emp.full_name} (${totalDays} wd, ${data.startDate} → ${data.endDate})`,
        amountKes: '0.00',
        assignedRoleCode: assignedRole,
        submittedByUserId: user.id,
        status: 'PENDING',
      });

      return { leaveRequestId };
    });

    // Notify the approver (content-free payload)
    const approverRows = (await db.execute(sql`
      SELECT id FROM users WHERE id = ${emp.supervisor_user_id} AND status = 'ACTIVE' LIMIT 1;
    `)) as unknown as { rows: Array<{ id: number }> };
    const approverId = approverRows.rows[0]?.id;
    if (approverId) {
      await createNotification({
        userId: approverId,
        category: 'APPROVALS',
        title: 'Leave request awaiting your decision',
        summary: `${emp.full_name} requested ${leaveType.name} (${totalDays} working day(s)) — ${requestNumber}.`,
        linkUrl: '/portal/hr',
      });
    }

    await recordAuditLog({
      actor: user,
      action: 'LEAVE_REQUEST_SUBMITTED',
      module: 'HR',
      entityType: 'LEAVE_REQUEST',
      entityId: requestNumber,
      summary: `${leaveType.name} for ${emp.full_name}, ${data.startDate} → ${data.endDate} (${totalDays} working days) routed to ${emp.supervisor_user_id ? 'supervisor' : 'HR'}`,
      afterState: data,
      ipAddress: ip,
    });

    return jsonOk({
      requestNumber,
      totalDays,
      leaveType: leaveType.name,
      balanceAfterPending: (available - totalDays).toFixed(2),
      id: result.leaveRequestId,
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('leave POST', e);
    return jsonError(500, 'Failed to submit leave request.');
  }
}
