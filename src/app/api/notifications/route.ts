import { NextRequest } from 'next/server';
import { eq, desc, and, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import * as t from '@/db/schema';
import { ApiError, requireAuth, jsonOk, jsonError } from '@/lib/guards';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const db = await getDb();
    const notifications = await db
      .select()
      .from(t.notificationRecords)
      .where(eq(t.notificationRecords.userId, user.id))
      .orderBy(desc(t.notificationRecords.createdAt))
      .limit(30);
    return jsonOk({ notifications });
  } catch (e) {
    if (e instanceof ApiError) return jsonError(e.status, e.message);
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('notifications GET', e);
    return jsonError(500, 'Failed to load notifications.');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const db = await getDb();
    if (body.action === 'mark_all') {
      await db
        .update(t.notificationRecords)
        .set({ isRead: true, readAt: new Date() })
        .where(
          and(eq(t.notificationRecords.userId, user.id), eq(t.notificationRecords.isRead, false))
        );
      return jsonOk({ message: 'All notifications marked read.' });
    }
    if (body.action === 'mark_read' && typeof body.id === 'number') {
      const updated = await db
        .update(t.notificationRecords)
        .set({ isRead: true, readAt: new Date() })
        .where(
          and(eq(t.notificationRecords.id, body.id), eq(t.notificationRecords.userId, user.id))
        );
      const rowCount = (updated as { rowCount?: number }).rowCount ?? 0;
      if (rowCount === 0) {
        return jsonError(404, 'Notification not found.');
      }
      return jsonOk({ message: 'Notification marked read.' });
    }
    return jsonError(400, 'Unknown action.');
  } catch (e) {
    if (e instanceof ApiError) return jsonError(e.status, e.message);
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('notifications PATCH', e);
    return jsonError(500, 'Failed to update notifications.');
  }
}
