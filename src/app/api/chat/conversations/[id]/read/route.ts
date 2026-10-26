import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { requireAuth, jsonOk, jsonError } from '@/lib/guards';
import { assertConversationMember, ChatAccessError, unreadMessageCount } from '@/lib/chat';

export const dynamic = 'force-dynamic';

/** Mark conversation read up to the latest message for the caller only. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const conversationId = Number((await ctx.params).id);
    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      return jsonError(400, 'Invalid conversation id.');
    }
    await assertConversationMember(user.id, conversationId);

    const db = await getDb();
    const body = await req.json().catch(() => ({}));

    if (typeof body?.uptoMessageId === 'number') {
      await db.execute(sql`
        UPDATE conversation_members
        SET last_read_at = GREATEST(
          COALESCE(last_read_at, '1970-01-01'::timestamptz),
          (SELECT created_at FROM messages WHERE id = ${body.uptoMessageId} AND conversation_id = ${conversationId})
        )
        WHERE conversation_id = ${conversationId} AND user_id = ${user.id};
      `);
    } else {
      await db.execute(sql`
        UPDATE conversation_members
        SET last_read_at = GREATEST(COALESCE(last_read_at, '1970-01-01'::timestamptz), now())
        WHERE conversation_id = ${conversationId} AND user_id = ${user.id};
      `);
    }

    // Mark receipts as read for messages in this conversation
    await db.execute(sql`
      UPDATE message_receipts SET read_at = COALESCE(read_at, now())
      WHERE conversation_id = ${conversationId} AND user_id = ${user.id} AND read_at IS NULL;
    `);

    const unread = await unreadMessageCount(user.id);
    return jsonOk({ unread });
  } catch (e) {
    if (e instanceof ChatAccessError) return jsonError(e.status, e.message);
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('read POST', e);
    return jsonError(500, 'Failed to mark conversation read.');
  }
}
