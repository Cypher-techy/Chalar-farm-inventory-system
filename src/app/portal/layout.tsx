import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { getSessionFromCookies } from '@/lib/server-session';
import PortalClientBridge from './portal-client';

export const dynamic = 'force-dynamic';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionFromCookies();
  if (!user) {
    redirect('/login');
  }

  let unreadMessages = 0;
  let unreadNotifications = 0;
  try {
    const db = await getDb();
    const msgRes = (await db.execute(sql`
      SELECT count(*)::int AS cnt
      FROM conversation_members cm
      JOIN conversations c ON c.id = cm.conversation_id
      WHERE cm.user_id = ${user.id}
        AND cm.revoked_at IS NULL
        AND c.is_archived = false
        AND EXISTS (
          SELECT 1 FROM messages m
          WHERE m.conversation_id = c.id
            AND m.sender_user_id != ${user.id}
            AND m.is_deleted = false
            AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01'::timestamptz)
        );
    `)) as unknown as { rows: Array<{ cnt: number }> };
    unreadMessages = msgRes.rows[0]?.cnt ?? 0;

    const notifRes = (await db.execute(sql`
      SELECT count(*)::int AS cnt FROM notification_records
      WHERE user_id = ${user.id} AND is_read = false;
    `)) as unknown as { rows: Array<{ cnt: number }> };
    unreadNotifications = notifRes.rows[0]?.cnt ?? 0;
  } catch {
    // counts degrade gracefully
  }

  return (
    <PortalClientBridge
      permissions={user.permissions}
      user={{
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        primaryRoleCode: user.primaryRoleCode,
        departmentName: user.departmentName,
      }}
      unreadMessages={unreadMessages}
      unreadNotifications={unreadNotifications}
    >
      {children}
    </PortalClientBridge>
  );
}
