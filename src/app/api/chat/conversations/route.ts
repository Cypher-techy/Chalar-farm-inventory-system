import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import * as t from '@/db/schema';
import { ApiError, requireAuth, jsonOk, jsonError, clientIp, rateLimit } from '@/lib/guards';
import { recordAuditLog } from '@/lib/auth';
import { canInitiateDirect, createNotification, ChatAccessError } from '@/lib/chat';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const db = await getDb();

    const res = (await db.execute(sql`
      SELECT
        c.id,
        c.code,
        c.title,
        c.conversation_type AS "conversationType",
        c.target_dashboard_code AS "targetDashboardCode",
        c.last_message_at AS "lastMessageAt",
        cm.last_read_at AS "lastReadAt",
        cm.member_role AS "memberRole",
        (
          SELECT m.body FROM messages m
          WHERE m.conversation_id = c.id AND m.is_deleted = false
          ORDER BY m.created_at DESC LIMIT 1
        ) AS "lastMessageBody",
        (
          SELECT m.created_at FROM messages m
          WHERE m.conversation_id = c.id AND m.is_deleted = false
          ORDER BY m.created_at DESC LIMIT 1
        ) AS "lastMessageAtExact",
        (
          SELECT u.full_name FROM messages m
          JOIN users u ON u.id = m.sender_user_id
          WHERE m.conversation_id = c.id AND m.is_deleted = false
          ORDER BY m.created_at DESC LIMIT 1
        ) AS "lastSenderName",
        (
          SELECT count(*)::int FROM messages m
          WHERE m.conversation_id = c.id
            AND m.sender_user_id != ${user.id}
            AND m.is_deleted = false
            AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01'::timestamptz)
        ) AS "unreadCount",
        (
          SELECT string_agg(u.full_name, ', ' ORDER BY u.full_name)
          FROM conversation_members cm2
          JOIN users u ON u.id = cm2.user_id
          WHERE cm2.conversation_id = c.id AND cm2.revoked_at IS NULL AND cm2.user_id != ${user.id}
        ) AS "otherMembers"
      FROM conversations c
      JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ${user.id}
      WHERE cm.revoked_at IS NULL AND c.is_archived = false
      ORDER BY c.last_message_at DESC
      LIMIT 60;
    `)) as unknown as { rows: Array<Record<string, unknown>> };

    return jsonOk({ conversations: res.rows });
  } catch (e) {
    if (e instanceof ApiError) return jsonError(e.status, e.message);
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('conversations GET', e);
    return jsonError(500, 'Failed to load conversations.');
  }
}

const startSchema = z.object({
  targetUserId: z.number().int().positive().optional(),
  targetRoleCode: z.string().min(3).max(64).optional(),
  title: z.string().min(2).max(120).optional(),
  conversationType: z.enum(['DIRECT_PRIVATE', 'DASHBOARD_CHANNEL', 'PRIVATE_GROUP']).default('DIRECT_PRIVATE'),
  participantUserIds: z.array(z.number().int().positive()).max(20).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const ip = clientIp(req);
    rateLimit(`chat-start:${user.id}`, 15, 60_000);

    const body = await req.json().catch(() => null);
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, parsed.error.issues[0]?.message ?? 'Invalid payload.');
    }
    const db = await getDb();
    const data = parsed.data;

    // Resolve target user(s)
    let targetIds: number[] = [];
    if (data.targetUserId) {
      targetIds = [data.targetUserId];
    } else if (data.targetRoleCode) {
      const rows = (await db.execute(sql`
        SELECT u.id FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON r.id = ur.role_id
        WHERE r.code = ${data.targetRoleCode} AND u.status = 'ACTIVE'
        ORDER BY u.last_login_at DESC NULLS LAST
        LIMIT 1;
      `)) as unknown as { rows: Array<{ id: number }> };
      if (!rows.rows[0]) return jsonError(404, 'No active user holds that dashboard role.');
      targetIds = [rows.rows[0].id];
    } else if (data.participantUserIds?.length) {
      targetIds = data.participantUserIds.filter((id) => id !== user.id);
    }

    if (targetIds.length === 0) {
      return jsonError(400, 'Select a recipient for the conversation.');
    }

    // Authorization: policy enforced server-side, using target roles read from the database
    if (data.conversationType === 'DIRECT_PRIVATE' && targetIds.length === 1) {
      const targetRoles = (await db.execute(sql`
        SELECT r.code FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = ${targetIds[0]}
      `)) as unknown as { rows: Array<{ code: string | null }> };
      const check = canInitiateDirect(
        user,
        targetIds[0],
        targetRoles.rows.map((r) => String(r.code ?? ''))
      );
      if (!check.allowed) return jsonError(403, check.reason ?? 'Not allowed.');
    } else if (!user.permissions.includes('communications.initiate_any')) {
      return jsonError(403, 'Only authorized administrators can create group or dashboard-channel conversations.');
    }

    // Idempotent-ish duplicate check for existing 1:1
    if (data.conversationType === 'DIRECT_PRIVATE' && targetIds.length === 1) {
      const existing = (await db.execute(sql`
        SELECT c.id FROM conversations c
        JOIN conversation_members a ON a.conversation_id = c.id AND a.user_id = ${user.id} AND a.revoked_at IS NULL
        JOIN conversation_members b ON b.conversation_id = c.id AND b.user_id = ${targetIds[0]} AND b.revoked_at IS NULL
        WHERE c.conversation_type = 'DIRECT_PRIVATE' AND c.is_archived = false
        LIMIT 1;
      `)) as unknown as { rows: Array<{ id: number }> };
      if (existing.rows[0]) {
        return jsonOk({ conversationId: existing.rows[0].id, existing: true });
      }
    }

    const targetUsers = await db
      .select({ id: t.users.id, fullName: t.users.fullName, primaryRoleCode: t.users.primaryRoleCode })
      .from(t.users)
      .where(inArray(t.users.id, targetIds));

    const title =
      data.title ??
      (data.conversationType === 'DIRECT_PRIVATE' && targetUsers.length === 1
        ? `Private: ${user.fullName} ↔ ${targetUsers[0].fullName}`
        : data.title ?? `Group with ${targetUsers.length + 1} participants`);

    const convCode = `CONV-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;

    const conv = await db
      .insert(t.conversations)
      .values({
        code: convCode,
        title,
        conversationType: data.conversationType,
        targetDashboardCode: data.targetRoleCode ?? null,
        createdByUserId: user.id,
      })
      .returning();

    const conversationId = conv[0].id;

    await db.insert(t.conversationMembers).values([
      { conversationId, userId: user.id, memberRole: 'OWNER' },
      ...targetIds.map((id) => ({ conversationId, userId: id, memberRole: 'PARTICIPANT' })),
    ]);

    // Notify recipients (no message content exposed)
    for (const tu of targetUsers) {
      await createNotification({
        userId: tu.id,
        category: 'MESSAGES',
        title: 'New private conversation',
        summary: `${user.fullName} started a private conversation with you.`,
        linkUrl: '/portal/communications',
      });
    }

    await recordAuditLog({
      actor: user,
      action: 'CONVERSATION_STARTED',
      module: 'COMMUNICATIONS',
      entityType: 'CONVERSATION',
      entityId: convCode,
      summary: `Started ${data.conversationType} conversation "${title}" with ${targetUsers.length} participant(s)`,
      ipAddress: ip,
    });

    return jsonOk({ conversationId, existing: false });
  } catch (e) {
    if (e instanceof ChatAccessError) return jsonError(e.status, e.message);
    if (e instanceof ApiError) return jsonError(e.status, e.message);
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('conversations POST', e);
    return jsonError(500, 'Failed to start conversation.');
  }
}
