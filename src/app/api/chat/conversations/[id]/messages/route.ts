import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import * as t from '@/db/schema';
import { requireAuth, jsonOk, jsonError, clientIp, rateLimit } from '@/lib/guards';
import { recordAuditLog } from '@/lib/auth';
import {
  assertConversationMember,
  ChatAccessError,
  createNotification,
} from '@/lib/chat';

export const dynamic = 'force-dynamic';

function parseConvId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ChatAccessError(400, 'Invalid conversation id.');
  return id;
}

/**
 * GET messages — membership enforced. Honours the conversation's
 * history-sharing policy for members added after messages were sent.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const conversationId = parseConvId((await ctx.params).id);
    const { membership, conversation } = await assertConversationMember(user.id, conversationId);

    const db = await getDb();
    const before = req.nextUrl.searchParams.get('before');
    const limit = Math.min(100, Math.max(10, Number(req.nextUrl.searchParams.get('limit') ?? 40)));

    const historyFloor =
      conversation.historySharingPolicy === 'FROM_JOIN_TIME' && membership.memberRole !== 'OWNER'
        ? membership.joinedAt
        : new Date(0);

    const rows = (await db.execute(sql`
      SELECT
        m.id,
        m.body,
        m.message_type AS "messageType",
        m.attachment_file_name AS "attachmentFileName",
        m.is_edited AS "isEdited",
        m.created_at AS "createdAt",
        m.sender_user_id AS "senderUserId",
        u.full_name AS "senderName",
        u.primary_role_code AS "senderRole",
        EXISTS (
          SELECT 1 FROM message_receipts r
          WHERE r.message_id = m.id AND r.read_at IS NOT NULL AND r.user_id != m.sender_user_id
        ) AS "readByRecipient",
        EXISTS (
          SELECT 1 FROM message_receipts r
          WHERE r.message_id = m.id AND r.delivered_at IS NOT NULL AND r.user_id != m.sender_user_id
        ) AS "deliveredToRecipient"
      FROM messages m
      JOIN users u ON u.id = m.sender_user_id
      WHERE m.conversation_id = ${conversationId}
        AND m.is_deleted = false
        AND m.created_at >= ${historyFloor}
        ${before ? sql`AND m.created_at < ${new Date(before)}` : sql``}
      ORDER BY m.created_at DESC
      LIMIT ${limit};
    `)) as unknown as { rows: Array<Record<string, unknown>> };

    return jsonOk({
      messages: rows.rows.reverse(),
      conversation: {
        id: conversation.id,
        code: conversation.code,
        title: conversation.title,
        conversationType: conversation.conversationType,
        historySharingPolicy: conversation.historySharingPolicy,
      },
      memberRole: membership.memberRole,
      canSend: membership.canSend,
    });
  } catch (e) {
    if (e instanceof ChatAccessError) return jsonError(e.status, e.message);
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('messages GET', e);
    return jsonError(500, 'Failed to load messages.');
  }
}

const sendSchema = z.object({
  body: z.string().min(1, 'Message cannot be empty.').max(4000),
  clientNonce: z.string().max(64).optional(),
});

/**
 * POST send message — membership + canSend enforced; delivery receipts and
 * content-free notifications created for other active members only.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const ip = clientIp(req);
    rateLimit(`chat-send:${user.id}`, 60, 60_000);

    const conversationId = parseConvId((await ctx.params).id);
    const { membership, conversation } = await assertConversationMember(user.id, conversationId);
    if (!membership.canSend) {
      return jsonError(403, 'Your send permission in this conversation has been revoked.');
    }

    const payload = await req.json().catch(() => null);
    const parsed = sendSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonError(400, parsed.error.issues[0]?.message ?? 'Invalid message.');
    }

    const db = await getDb();

    // Idempotency: repeated submissions with same nonce don't duplicate
    if (parsed.data.clientNonce) {
      const dup = (await db.execute(sql`
        SELECT id FROM messages
        WHERE conversation_id = ${conversationId}
          AND sender_user_id = ${user.id}
          AND body = ${parsed.data.body}
          AND created_at > now() - interval '2 minutes'
        LIMIT 1;
      `)) as unknown as { rows: Array<{ id: number }> };
      if (dup.rows[0]) {
        return jsonOk({ messageId: dup.rows[0].id, duplicate: true });
      }
    }

    const inserted = await db
      .insert(t.messages)
      .values({
        conversationId,
        senderUserId: user.id,
        body: parsed.data.body,
        messageType: 'TEXT',
      })
      .returning();
    const messageId = inserted[0].id;
    const messageCreatedAt = inserted[0].createdAt as Date;

    // Delivery receipts for every other active member
    const others = (await db.execute(sql`
      SELECT user_id FROM conversation_members
      WHERE conversation_id = ${conversationId} AND user_id != ${user.id} AND revoked_at IS NULL;
    `)) as unknown as { rows: Array<{ user_id: number }> };
    if (others.rows.length) {
      await db.insert(t.messageReceipts).values(
        others.rows.map((o) => ({
          messageId,
          conversationId,
          userId: o.user_id,
        }))
      );
    }

    // Bump conversation ordering
    await db
      .update(t.conversations)
      .set({ lastMessageAt: messageCreatedAt })
      .where(eq(t.conversations.id, conversationId));

    // Notify members — payload intentionally carries NO message content
    for (const o of others.rows) {
      await createNotification({
        userId: o.user_id,
        category: 'MESSAGES',
        title: 'New private message',
        summary: `${user.fullName} sent you a message in "${conversation.title}".`,
        linkUrl: `/portal/communications?c=${conversationId}`,
      });
    }

    await recordAuditLog({
      actor: user,
      action: 'MESSAGE_SENT',
      module: 'COMMUNICATIONS',
      entityType: 'MESSAGE',
      entityId: String(messageId),
      summary: `Sent a message in conversation ${conversation.code} (${parsed.data.body.length} chars) — content not logged`,
      ipAddress: ip,
    });

    return jsonOk({ messageId, createdAt: messageCreatedAt });
  } catch (e) {
    if (e instanceof ChatAccessError) return jsonError(e.status, e.message);
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('messages POST', e);
    return jsonError(500, 'Failed to send message.');
  }
}
