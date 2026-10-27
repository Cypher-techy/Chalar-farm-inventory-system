import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { ApiError, jsonError, jsonOk, requirePermission } from '@/lib/guards';

export const dynamic = 'force-dynamic';

/** Lists account requests (newest first). Never returns password hashes. */
export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, 'users.manage');
    const status = req.nextUrl.searchParams.get('status');
    const filter = status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status) ? status : null;
    const db = await getDb();
    const res = (await db.execute(sql`
      SELECT ar.id, ar.request_code AS "requestCode", ar.email, ar.full_name AS "fullName", ar.phone,
             ar.job_title AS "jobTitle", ar.department_id AS "departmentId", d.name AS department,
             ar.requested_role_code AS "requestedRoleCode", ar.granted_role_code AS "grantedRoleCode",
             ar.message, ar.status, ar.decision_note AS "decisionNote", ar.decided_at AS "decidedAt",
             du.email AS "decidedBy", ar.created_at AS "createdAt"
      FROM access_requests ar
      LEFT JOIN departments d ON d.id = ar.department_id
      LEFT JOIN users du ON du.id = ar.decided_by_user_id
      ${filter ? sql`WHERE ar.status = ${filter}` : sql``}
      ORDER BY (ar.status = 'PENDING') DESC, ar.created_at DESC
      LIMIT 200
    `)) as unknown as { rows: unknown[] };
    return jsonOk({ requests: res.rows });
  } catch (e) {
    if (e instanceof ApiError) return jsonError(e.status, e.message);
    console.error('access requests GET', e);
    return jsonError(500, 'Failed to load account requests.');
  }
}
