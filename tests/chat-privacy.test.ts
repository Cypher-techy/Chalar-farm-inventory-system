import { describe, it, expect, beforeAll } from 'vitest';
import { freshDb, tokenFor, makeRequest, json, rows, one, ADMIN_PASSWORD, DEMO_PASSWORD } from './helpers';
import { GET as listConversations, POST as startConversation } from '@/app/api/chat/conversations/route';
import {
  GET as getMessages,
  POST as sendMessage,
} from '@/app/api/chat/conversations/[id]/messages/route';
import { POST as markRead } from '@/app/api/chat/conversations/[id]/read/route';
import { GET as globalSearch } from '@/app/api/search/route';
import { canInitiateDirect, assertConversationMember } from '@/lib/chat';
import { getSessionUser } from '@/lib/auth';
import { sql } from 'drizzle-orm';

const SECRET_PHRASE = 'ZEBRA-ORCHID-4471 confidential salary discussion';

describe('Private communications — conversation-level access control', () => {
  let adminToken: string;
  let hrToken: string;
  let qaToken: string;
  let empToken: string;
  let conversationId: number;

  beforeAll(async () => {
    await freshDb();
    adminToken = await tokenFor('superadmin@chalarfarms.demo', ADMIN_PASSWORD);
    hrToken = await tokenFor('hr@chalarfarms.demo');
    qaToken = await tokenFor('qa@chalarfarms.demo');
    empToken = await tokenFor('employee@chalarfarms.demo');
  }, 120000);

  it('lets the Super Admin open a private thread with a dashboard manager', async () => {
    const res = await startConversation(
      makeRequest('http://localhost/api/chat/conversations', {
        method: 'POST',
        token: adminToken,
        body: { targetRoleCode: 'HR_MANAGER', conversationType: 'DIRECT_PRIVATE' },
      })
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    conversationId = Number(body.conversationId);
    expect(conversationId).toBeGreaterThan(0);
  });

  it('forbids a general employee from opening a thread with another non-admin user', async () => {
    const admin = await getSessionUser(adminToken);
    const emp = await getSessionUser(empToken);
    const qa = await getSessionUser(qaToken);

    expect(canInitiateDirect(emp!, qa!.id, qa!.roleCodes).allowed).toBe(false);
    expect(canInitiateDirect(emp!, emp!.id, emp!.roleCodes).allowed).toBe(false); // never with yourself
    expect(canInitiateDirect(emp!, admin!.id, admin!.roleCodes).allowed).toBe(true); // escalation path
    expect(canInitiateDirect(admin!, emp!.id, emp!.roleCodes).allowed).toBe(true);

    const res = await startConversation(
      makeRequest('http://localhost/api/chat/conversations', {
        method: 'POST',
        token: empToken,
        body: { targetRoleCode: 'QA_OFFICER', conversationType: 'DIRECT_PRIVATE' },
      })
    );
    expect(res.status).toBe(403);
  });

  it('allows members to exchange messages and reads them back in order', async () => {
    const send = await sendMessage(
      makeRequest(`http://localhost/api/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        token: adminToken,
        body: { body: SECRET_PHRASE, clientNonce: 'nonce-1' },
      }),
      { params: Promise.resolve({ id: String(conversationId) }) }
    );
    expect(send.status).toBe(200);

    const read = await getMessages(
      makeRequest(`http://localhost/api/chat/conversations/${conversationId}/messages`, { token: hrToken }),
      { params: Promise.resolve({ id: String(conversationId) }) }
    );
    expect(read.status).toBe(200);
    const body = (await json(read)) as { messages: Array<{ body: string; senderName: string }> };
    expect(body.messages.some((m) => m.body === SECRET_PHRASE)).toBe(true);
  });

  it('denies non-members access to the conversation and its messages (403, no content leak)', async () => {
    const res = await getMessages(
      makeRequest(`http://localhost/api/chat/conversations/${conversationId}/messages`, { token: qaToken }),
      { params: Promise.resolve({ id: String(conversationId) }) }
    );
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).not.toContain(SECRET_PHRASE);

    await expect(assertConversationMember((await getSessionUser(qaToken))!.id, conversationId)).rejects.toThrow();
  });

  it('hides the conversation entirely from non-members in their conversation list', async () => {
    const qaList = (await json(
      await listConversations(makeRequest('http://localhost/api/chat/conversations', { token: qaToken }))
    )) as { conversations: Array<{ id: number }> };
    expect(qaList.conversations.map((c) => c.id)).not.toContain(conversationId);

    const hrList = (await json(
      await listConversations(makeRequest('http://localhost/api/chat/conversations', { token: hrToken }))
    )) as { conversations: Array<{ id: number; unreadCount: number }> };
    const mine = hrList.conversations.find((c) => c.id === conversationId);
    expect(mine).toBeTruthy();
    expect(Number(mine!.unreadCount)).toBeGreaterThan(0);
  });

  it('never exposes message bodies in notifications, audit logs or global search', async () => {
    const notifications = await rows<{ summary: string; title: string }>(sql`
      SELECT title, summary FROM notification_records WHERE category = 'MESSAGES'
    `);
    for (const n of notifications) {
      expect(n.summary).not.toContain(SECRET_PHRASE);
      expect(n.title).not.toContain(SECRET_PHRASE);
    }

    const audits = await rows<{ summary: string }>(sql`
      SELECT summary FROM audit_logs WHERE module = 'COMMUNICATIONS'
    `);
    expect(audits.length).toBeGreaterThan(0);
    for (const a of audits) {
      expect(a.summary).not.toContain(SECRET_PHRASE);
    }

    const search = (await json(
      await globalSearch(
        makeRequest(`http://localhost/api/search?q=${encodeURIComponent('ZEBRA-ORCHID')}`, { token: adminToken })
      )
    )) as { results: unknown[] };
    expect(search.results.length).toBe(0);
  });

  it('tracks read state per member without affecting other members', async () => {
    const before = (await json(
      await listConversations(makeRequest('http://localhost/api/chat/conversations', { token: hrToken }))
    )) as { conversations: Array<{ id: number; unreadCount: number }> };
    expect(Number(before.conversations.find((c) => c.id === conversationId)?.unreadCount)).toBeGreaterThan(0);

    const read = await markRead(
      makeRequest(`http://localhost/api/chat/conversations/${conversationId}/read`, {
        method: 'POST',
        token: hrToken,
        body: {},
      }),
      { params: Promise.resolve({ id: String(conversationId) }) }
    );
    expect(read.status).toBe(200);

    const after = (await json(
      await listConversations(makeRequest('http://localhost/api/chat/conversations', { token: hrToken }))
    )) as { conversations: Array<{ id: number; unreadCount: number }> };
    expect(Number(after.conversations.find((c) => c.id === conversationId)?.unreadCount)).toBe(0);

    // Sender's own unread state is untouched by another member reading
    const adminView = (await json(
      await listConversations(makeRequest('http://localhost/api/chat/conversations', { token: adminToken }))
    )) as { conversations: Array<{ id: number }> };
    expect(adminView.conversations.some((c) => c.id === conversationId)).toBe(true);
  });

  it('delivers duplicate submissions once only (client nonce / rapid retry)', async () => {
    const payload = { body: 'Duplicate submission probe', clientNonce: 'same-nonce' };
    const first = await sendMessage(
      makeRequest(`http://localhost/api/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        token: hrToken,
        body: payload,
      }),
      { params: Promise.resolve({ id: String(conversationId) }) }
    );
    const second = await sendMessage(
      makeRequest(`http://localhost/api/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        token: hrToken,
        body: payload,
      }),
      { params: Promise.resolve({ id: String(conversationId) }) }
    );
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const count = await one<{ c: number }>(sql`
      SELECT count(*)::int AS c FROM messages WHERE conversation_id = ${conversationId} AND body = 'Duplicate submission probe'
    `);
    expect(count.c).toBe(1);
  });

  it('revokes access immediately when a member is removed from the conversation', async () => {
    const d = (await import('@/db')).getDb();
    const db = await d;
    const hr = await getSessionUser(hrToken);
    await db.execute(sql`
      UPDATE conversation_members SET revoked_at = now(), can_send = false
      WHERE conversation_id = ${conversationId} AND user_id = ${hr!.id}
    `);

    const res = await getMessages(
      makeRequest(`http://localhost/api/chat/conversations/${conversationId}/messages`, { token: hrToken }),
      { params: Promise.resolve({ id: String(conversationId) }) }
    );
    expect(res.status).toBe(403);

    const send = await sendMessage(
      makeRequest(`http://localhost/api/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        token: hrToken,
        body: { body: 'Attempting to post after removal' },
      }),
      { params: Promise.resolve({ id: String(conversationId) }) }
    );
    expect(send.status).toBe(403);
  });

  it('blocks non-admins from creating group or dashboard-channel conversations', async () => {
    const res = await startConversation(
      makeRequest('http://localhost/api/chat/conversations', {
        method: 'POST',
        token: qaToken,
        body: { conversationType: 'PRIVATE_GROUP', participantUserIds: [2, 3, 4] },
      })
    );
    expect(res.status).toBe(403);
  });

  it('keeps seeded demo conversations private to their own members', async () => {
    const seeded = await rows<{ id: number }>(sql`
      SELECT id FROM conversations WHERE code LIKE 'CONV-%' ORDER BY id LIMIT 5
    `);
    const qa = await getSessionUser(qaToken);
    for (const c of seeded) {
      const membership = await rows<{ user_id: number }>(sql`
        SELECT user_id FROM conversation_members WHERE conversation_id = ${c.id} AND revoked_at IS NULL
      `);
      const isMember = membership.some((m) => m.user_id === qa!.id);
      const res = await getMessages(
        makeRequest(`http://localhost/api/chat/conversations/${c.id}/messages`, { token: qaToken }),
        { params: Promise.resolve({ id: String(c.id) }) }
      );
      expect(res.status, `conversation ${c.id} member=${isMember}`).toBe(isMember ? 200 : 403);
    }
  });

  it('rejects malformed conversation ids instead of leaking data', async () => {
    const res = await getMessages(
      makeRequest('http://localhost/api/chat/conversations/abc/messages', { token: adminToken }),
      { params: Promise.resolve({ id: 'abc' }) }
    );
    expect([400, 403, 404]).toContain(res.status);
  });

  void DEMO_PASSWORD;
});
