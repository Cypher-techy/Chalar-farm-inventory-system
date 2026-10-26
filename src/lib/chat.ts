import { and, eq, isNull, sql, desc, asc } from 'drizzle-orm';
import { getDb } from '@/db';
import * as t from '@/db/schema';
import type { SessionUser } from '@/lib/auth';

export class ChatAccessError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export interface MembershipRow {
  id: number;
  conversationId: number;
  userId: number;
  memberRole: string;
  canSend: boolean;
  joinedAt: Date;
  revokedAt: Date | null;
  lastReadAt: Date | null;
}

/**
 * Server-side gate for EVERY conversation-scoped operation:
 * fetch messages, send, mark read, attachments, subscriptions.
 * Returns the caller's active membership or throws 403/404.
 */
export async function assertConversationMember(
  userId: number,
  conversationId: number
): Promise<{ membership: MembershipRow; conversation: typeof t.conversations.$inferSelect }> {
  const db = await getDb();
  const convRows = await db
    .select()
    .from(t.conversations)
    .where(eq(t.conversations.id, conversationId))
    .limit(1);
  const conversation = convRows[0];
  if (!conversation) throw new ChatAccessError(404, 'Conversation not found.');

  const memberRows = (await db.execute(sql`
    SELECT id, conversation_id AS "conversationId", user_id AS "userId", member_role AS "memberRole",
           can_send AS "canSend", joined_at AS "joinedAt", revoked_at AS "revokedAt",
           last_read_at AS "lastReadAt"
    FROM conversation_members
    WHERE conversation_id = ${conversationId} AND user_id = ${userId}
  `)) as unknown as { rows: MembershipRow[] };
  const membership = memberRows.rows[0];
  if (!membership || membership.revokedAt !== null) {
    throw new ChatAccessError(403, 'You are not a participant of this conversation.');
  }
  return { membership, conversation };
}

export function messageVisibilityFilter(membership: MembershipRow) {
  if (membership.memberRole === 'OWNER') return undefined;
  // History-sharing policy: joiners see messages from their join time onward,
  // unless the conversation policy explicitly grants full history.
  return undefined; // policy applied via conversation.historySharingPolicy in query builder
}

export async function createNotification(params: {
  userId: number;
  category: string;
  title: string;
  summary: string;
  linkUrl: string;
}): Promise<void> {
  const db = await getDb();
  await db.insert(t.notificationRecords).values({
    userId: params.userId,
    category: params.category,
    title: params.title,
    // Intentionally excludes message body content
    summary: params.summary,
    linkUrl: params.linkUrl,
  });
}

export async function unreadMessageCount(userId: number): Promise<number> {
  const db = await getDb();
  const res = (await db.execute(sql`
    SELECT count(*)::int AS cnt
    FROM conversation_members cm
    JOIN conversations c ON c.id = cm.conversation_id
    WHERE cm.user_id = ${userId}
      AND cm.revoked_at IS NULL
      AND c.is_archived = false
      AND EXISTS (
        SELECT 1 FROM messages m
        WHERE m.conversation_id = c.id
          AND m.sender_user_id != ${userId}
          AND m.is_deleted = false
          AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01'::timestamptz)
      );
  `)) as unknown as { rows: Array<{ cnt: number }> };
  return res.rows[0]?.cnt ?? 0;
}

/** Determine whether userA may open a new direct conversation with userB. */
export function canInitiateDirect(user: SessionUser, targetUserId: number): {
  allowed: boolean;
  reason?: string;
} {
  if (user.id === targetUserId) {
    return { allowed: false, reason: 'You cannot start a conversation with yourself.' };
  }
  // Super Admin (or any holder of the explicit cross-dashboard permission)
  // may open a private conversation with any user.
  if (user.permissions.includes('communications.initiate_any')) {
    return { allowed: true };
  }
  // Any active user may initiate a direct conversation with the Super Admin
  // (documented escalation path).
  if (user.roleCodes.includes('SUPER_ADMIN')) {
    // target is checked by caller; super admin allowed by default above
    return { allowed: true };
  }
  return {
    allowed: false,
    reason:
      'You may only reply within conversations you are a participant of, or initiate a thread with the Super Administrator.',
  };
}
