import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { requirePermission, jsonOk, jsonError, clientIp, rateLimit } from '@/lib/guards';
import { recordAuditLog, recordSecurityEvent, revokeAllUserSessions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  action: z.enum(['ACTIVATE', 'DEACTIVATE', 'SUSPEND', 'UNLOCK', 'REVOKE_SESSIONS']),
  reason: z.string().min(3).max(500).optional(),
});

/** Administrative state changes on a user account. Every change is audited. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission(req, 'users.manage');
    const ip = clientIp(req);
    rateLimit(`admin-user:${actor.id}`, 30, 60_000);

    const targetId = Number((await ctx.params).id);
    if (!Number.isInteger(targetId) || targetId <= 0) return jsonError(400, 'Invalid user id.');

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? 'Invalid payload.');
    const { action, reason } = parsed.data;

    if (targetId === actor.id && action !== 'REVOKE_SESSIONS') {
      return jsonError(403, 'You cannot change your own account status. Ask another administrator.');
    }

    const db = await getDb();
    const target = (await db.execute(sql`
      SELECT id, email, full_name, status, primary_role_code FROM users WHERE id = ${targetId} LIMIT 1;
    `)) as unknown as { rows: Array<{ id: number; email: string; full_name: string; status: string; primary_role_code: string }> };
    const user = target.rows[0];
    if (!user) return jsonError(404, 'User not found.');

    // Protect against locking out the last Super Administrator
    if (user.primary_role_code === 'SUPER_ADMIN' && ['DEACTIVATE', 'SUSPEND'].includes(action)) {
      const remaining = (await db.execute(sql`
        SELECT count(*)::int AS c FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON r.id = ur.role_id
        WHERE r.code = 'SUPER_ADMIN' AND u.status = 'ACTIVE' AND u.id != ${targetId};
      `)) as unknown as { rows: Array<{ c: number }> };
      if ((remaining.rows[0]?.c ?? 0) === 0) {
        return jsonError(409, 'Refused: this is the only active Super Administrator. Activate another administrator first.');
      }
    }

    if (action === 'REVOKE_SESSIONS') {
      const revoked = await revokeAllUserSessions(targetId, 'ADMIN_REVOCATION');
      await recordAuditLog({
        actor,
        action: 'USER_SESSIONS_REVOKED',
        module: 'ADMIN',
        entityType: 'USER',
        entityId: String(targetId),
        summary: `Revoked ${revoked} active session(s) for ${user.email}${reason ? ` — ${reason}` : ''}`,
        ipAddress: ip,
      });
      return jsonOk({ message: `Revoked ${revoked} active session(s) for ${user.email}.` });
    }

    const newStatus = action === 'ACTIVATE' ? 'ACTIVE' : action === 'SUSPEND' ? 'SUSPENDED' : 'INACTIVE';
    await db.execute(sql`
      UPDATE users
      SET status = ${newStatus},
          locked_until = ${action === 'UNLOCK' ? null : sql`locked_until`},
          failed_login_attempts = ${action === 'UNLOCK' ? 0 : sql`failed_login_attempts`},
          updated_at = now()
      WHERE id = ${targetId};
    `);
    if (action !== 'ACTIVATE') {
      await revokeAllUserSessions(targetId, `ACCOUNT_${newStatus}`);
    }

    await recordSecurityEvent(null, targetId, `ADMIN_${action}`, 'WARNING', { ipAddress: ip },
      `${action} by ${actor.email}${reason ? `: ${reason}` : ''}`);
    await recordAuditLog({
      actor,
      action: `USER_${action}`,
      module: 'ADMIN',
      entityType: 'USER',
      entityId: String(targetId),
      summary: `${action} applied to ${user.email} (${user.full_name})${reason ? ` — ${reason}` : ''}`,
      beforeState: { status: user.status },
      afterState: { status: action === 'UNLOCK' ? user.status : newStatus },
      ipAddress: ip,
    });

    return jsonOk({
      message:
        action === 'UNLOCK'
          ? `Unlocked ${user.email}; failed-attempt counter reset and active sessions revoked.`
          : `${user.email} is now ${newStatus}.`,
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('admin user PATCH', e);
    return jsonError(500, 'Failed to update user.');
  }
}
