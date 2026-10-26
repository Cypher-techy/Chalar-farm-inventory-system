import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import * as t from '@/db/schema';
import { requirePermission, jsonOk, jsonError, clientIp, rateLimit } from '@/lib/guards';
import { recordAuditLog, hashPassword, recordSecurityEvent } from '@/lib/auth';
import { INITIAL_SYSTEM_ROLES } from '@/lib/rbac-catalog';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, 'users.manage');
    const db = await getDb();
    const users = (await db.execute(sql`
      SELECT u.id, u.email, u.full_name AS "fullName", u.phone, u.status,
             u.primary_role_code AS "primaryRoleCode", u.last_login_at AS "lastLoginAt",
             u.failed_login_attempts AS "failedAttempts", u.locked_until AS "lockedUntil",
             u.created_at AS "createdAt", d.name AS department,
             COALESCE((SELECT string_agg(r.code, ', ' ORDER BY r.code)
                FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                WHERE ur.user_id = u.id), '') AS roles,
             e.employee_code AS "employeeCode"
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN employee_profiles e ON e.user_id = u.id
      ORDER BY u.id;
    `)) as unknown as { rows: unknown[] };

    const roles = INITIAL_SYSTEM_ROLES.map((r) => ({
      code: r.code,
      name: r.name,
      defaultDashboard: r.defaultDashboard,
      permissionCount: r.permissions.length,
    }));

    const counts = (await db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM users WHERE status = 'ACTIVE')::int AS active,
        (SELECT count(*)::int FROM users WHERE status != 'ACTIVE')::int AS inactive,
        (SELECT count(*)::int FROM users WHERE locked_until IS NOT NULL AND locked_until > now())::int AS locked,
        (SELECT count(*)::int FROM sessions WHERE expires_at > now())::int AS live_sessions,
        (SELECT count(*)::int FROM security_events WHERE created_at > now() - interval '24 hours')::int AS security_events_24h;
    `)) as unknown as { rows: unknown[] };

    return jsonOk({ users: users.rows, roles, counts: counts.rows[0] });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('admin users GET', e);
    return jsonError(500, 'Failed to load users.');
  }
}

const createSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(120),
  phone: z.string().min(6).max(32).optional(),
  departmentId: z.number().int().positive().optional(),
  roleCodes: z.array(z.string().min(2)).min(1, 'Assign at least one role.'),
  temporaryPassword: z.string().min(10).max(128),
  employeeCode: z.string().max(32).optional(),
});

/** Creates a user with assigned roles, or reactivates/updates an existing account. */
export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission(req, 'users.manage');
    const ip = clientIp(req);
    rateLimit(`admin-user:${actor.id}`, 20, 60_000);

    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return jsonError(400, issue?.message === 'Required' ? 'All required fields must be provided.' : issue?.message ?? 'Invalid payload.');
    }
    const d = parsed.data;
    const db = await getDb();

    const validRoles = INITIAL_SYSTEM_ROLES.filter((r) => d.roleCodes.includes(r.code));
    if (validRoles.length !== d.roleCodes.length) {
      const known = new Set(INITIAL_SYSTEM_ROLES.map((r) => r.code));
      const bad = d.roleCodes.filter((c) => !known.has(c));
      return jsonError(400, `Unknown role code(s): ${bad.join(', ')}.`);
    }

    // Only a Super Admin may grant the Super Admin role
    if (d.roleCodes.includes('SUPER_ADMIN') && !actor.roleCodes.includes('SUPER_ADMIN')) {
      return jsonError(403, 'Only a Super Administrator may grant the Super Administrator role.');
    }

    const primaryRole = d.roleCodes[0];
    const passwordHash = await hashPassword(d.temporaryPassword);

    const existing = (await db.execute(sql`
      SELECT id, status FROM users WHERE lower(email) = lower(${d.email}) LIMIT 1;
    `)) as unknown as { rows: Array<{ id: number; status: string }> };

    let userId: number;
    let action: string;

    if (existing.rows[0]) {
      userId = existing.rows[0].id;
      await db.execute(sql`
        UPDATE users
        SET full_name = ${d.fullName},
            phone = COALESCE(${d.phone ?? null}, phone),
            department_id = COALESCE(${d.departmentId ?? null}, department_id),
            primary_role_code = ${primaryRole},
            password_hash = ${passwordHash},
            status = 'ACTIVE',
            failed_login_attempts = 0,
            locked_until = NULL,
            updated_at = now()
        WHERE id = ${userId};
      `);
      action = 'USER_RESET_AND_REACTIVATED';
    } else {
      const inserted = await db
        .insert(t.users)
        .values({
          email: d.email.toLowerCase(),
          fullName: d.fullName,
          phone: d.phone ?? '',
          passwordHash,
          primaryRoleCode: primaryRole,
          departmentId: d.departmentId ?? null,
          status: 'ACTIVE',
        })
        .returning();
      userId = inserted[0].id;
      action = 'USER_CREATED';
    }

    // Replace role assignments atomically
    await db.transaction(async (tx) => {
      await tx.execute(sql`DELETE FROM user_roles WHERE user_id = ${userId}`);
      for (const code of d.roleCodes) {
        await tx.execute(sql`
          INSERT INTO user_roles (user_id, role_id)
          SELECT ${userId}, id FROM roles WHERE code = ${code}
          ON CONFLICT DO NOTHING;
        `);
      }
      if (d.employeeCode) {
        await tx.execute(sql`
          UPDATE employee_profiles SET user_id = ${userId} WHERE employee_code = ${d.employeeCode};
        `);
      }
    });

    await recordSecurityEvent(null, userId, action, 'WARNING', { ipAddress: ip },
      `${action} by ${actor.email}: roles ${d.roleCodes.join(', ')}`);
    await recordAuditLog({
      actor,
      action,
      module: 'ADMIN',
      entityType: 'USER',
      entityId: String(userId),
      summary: `${action}: ${d.email} (${d.fullName}) — roles ${d.roleCodes.join(', ')}${d.employeeCode ? `, linked employee ${d.employeeCode}` : ''}; temporary password set (share out of band and require a change at first login)`,
      afterState: { email: d.email, roleCodes: d.roleCodes, departmentId: d.departmentId ?? null },
      ipAddress: ip,
    });

    return jsonOk({
      userId,
      message: `${action === 'USER_CREATED' ? 'Created' : 'Reset and reactivated'} ${d.email} with role(s) ${d.roleCodes.join(', ')}. Share the temporary password out of band and require the user to change it at first login.`,
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('admin users POST', e);
    return jsonError(500, 'Failed to save user.');
  }
}
