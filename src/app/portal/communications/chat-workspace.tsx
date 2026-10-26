'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  MessageSquarePlus,
  Send,
  Search,
  CheckCheck,
  Check,
  Loader2,
  Users,
  Radio,
} from 'lucide-react';
import { StatusBadge } from '@/components/portal/ui';

interface ConversationRow {
  id: number;
  code: string;
  title: string;
  conversationType: string;
  targetDashboardCode: string | null;
  lastMessageBody: string | null;
  lastSenderName: string | null;
  lastMessageAtExact: string | null;
  unreadCount: number;
  otherMembers: string | null;
}

interface MessageRow {
  id: number;
  body: string;
  messageType: string;
  attachmentFileName: string | null;
  createdAt: string;
  senderUserId: number;
  senderName: string;
  senderRole: string;
  readByRecipient: boolean;
  deliveredToRecipient: boolean;
}

const ROLE_OPTIONS = [
  ['SUPER_ADMIN', 'Super Administrator'],
  ['EXECUTIVE_MANAGER', 'Executive Manager'],
  ['FARM_MANAGER', 'Farm Manager'],
  ['INVENTORY_MANAGER', 'Inventory Manager'],
  ['HR_MANAGER', 'HR Manager'],
  ['FINANCE_MANAGER', 'Finance Manager'],
  ['PACKHOUSE_MANAGER', 'Packhouse Manager'],
  ['QA_OFFICER', 'Quality Assurance Officer'],
  ['PROCUREMENT_OFFICER', 'Procurement Officer'],
  ['SALES_EXPORT_MANAGER', 'Sales & Export Manager'],
  ['LOGISTICS_OFFICER', 'Logistics Officer'],
  ['MAINTENANCE_MANAGER', 'Maintenance Manager'],
  ['PAYROLL_OFFICER', 'Payroll Officer'],
  ['DEPARTMENT_SUPERVISOR', 'Department Supervisor'],
  ['GENERAL_EMPLOYEE', 'General Employee'],
  ['AUDITOR', 'Auditor / Compliance Officer'],
];

export default function ChatWorkspace({ me }: { me: { id: number; fullName: string; canInitiateAny: boolean } }) {
  const params = useSearchParams();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [startOpen, setStartOpen] = useState(false);
  const [startTargetRole, setStartTargetRole] = useState('HR_MANAGER');
  const [startBusy, setStartBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } catch {
      setError('Could not load conversations.');
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  const loadMessages = useCallback(async (convId: number) => {
    setLoadingMsgs(true);
    setError(null);
    try {
      const res = await fetch(`/api/chat/conversations/${convId}/messages`);
      if (res.status === 403 || res.status === 404) {
        setMessages([]);
        setError('You are not authorized to view this conversation.');
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(data.messages ?? []);
      await fetch(`/api/chat/conversations/${convId}/read`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      loadConversations();
    } catch {
      setError('Could not load messages.');
    } finally {
      setLoadingMsgs(false);
    }
  }, [loadConversations]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Deep link ?c=ID
  useEffect(() => {
    const c = Number(params.get('c'));
    if (c > 0) setActiveId(c);
  }, [params]);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
  }, [activeId, loadMessages]);

  // Polling: lightweight real-time updates (unread badge + new messages)
  useEffect(() => {
    const timer = setInterval(() => {
      loadConversations();
      if (activeId) loadMessages(activeId);
    }, 8000);
    return () => clearInterval(timer);
  }, [activeId, loadConversations, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  async function send() {
    if (!activeId || !draft.trim() || sending) return;
    setSending(true);
    const body = draft.trim();
    setDraft('');
    try {
      const res = await fetch(`/api/chat/conversations/${activeId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, clientNonce: `n-${Date.now()}` }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Message failed to send.');
        setDraft(body);
        return;
      }
      await loadMessages(activeId);
    } catch {
      setError('Network error — message not sent.');
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  async function startConversation() {
    setStartBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetRoleCode: startTargetRole,
          conversationType: 'DIRECT_PRIVATE',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not start conversation.');
        return;
      }
      setStartOpen(false);
      await loadConversations();
      setActiveId(data.conversationId);
    } catch {
      setError('Network error.');
    } finally {
      setStartBusy(false);
    }
  }

  const filtered = conversations.filter(
    (c) =>
      !filter.trim() ||
      c.title.toLowerCase().includes(filter.toLowerCase()) ||
      (c.otherMembers ?? '').toLowerCase().includes(filter.toLowerCase()) ||
      (c.lastMessageBody ?? '').toLowerCase().includes(filter.toLowerCase())
  );
  const active = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[340px,1fr]">
      {/* Conversation list */}
      <div className="card flex max-h-[70vh] flex-col">
        <div className="border-b border-stone-100 p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-stone-400" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search your conversations…"
                className="input pl-8 text-sm"
              />
            </div>
            <button
              onClick={() => setStartOpen((v) => !v)}
              className="btn-primary px-2.5 py-2"
              title="Start a private conversation"
              aria-label="Start a private conversation"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </button>
          </div>
          {startOpen && (
            <div className="mt-3 rounded-md border border-stone-200 bg-stone-50 p-3">
              <p className="text-xs font-semibold text-stone-600">New private conversation with…</p>
              <select
                value={startTargetRole}
                onChange={(e) => setStartTargetRole(e.target.value)}
                className="input mt-2 text-sm"
                aria-label="Recipient dashboard role"
              >
                {ROLE_OPTIONS.map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
              <div className="mt-2 flex gap-2">
                <button onClick={startConversation} disabled={startBusy} className="btn-primary flex-1 py-1.5 text-xs">
                  {startBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Start'}
                </button>
                <button onClick={() => setStartOpen(false)} className="btn-secondary py-1.5 text-xs">Cancel</button>
              </div>
              {!me.canInitiateAny && (
                <p className="mt-2 text-[10px] text-stone-400">
                  You can start threads with the Super Administrator, or reply within your existing
                  conversations. Cross-department initiation requires the administrator policy
                  permission.
                </p>
              )}
            </div>
          )}
        </div>

        <ul className="thin-scrollbar flex-1 overflow-y-auto divide-y divide-stone-100">
          {loadingConvs && (
            <li className="flex items-center justify-center gap-2 p-6 text-sm text-stone-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </li>
          )}
          {!loadingConvs && filtered.length === 0 && (
            <li className="p-6 text-center text-sm text-stone-400">No conversations yet.</li>
          )}
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setActiveId(c.id)}
                className={`block w-full px-3 py-3 text-left transition-colors ${
                  activeId === c.id ? 'bg-chalar-50' : 'hover:bg-stone-50'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-stone-800">{c.title}</span>
                  {c.unreadCount > 0 && (
                    <span className="animate-badge-pop flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                      {c.unreadCount}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-stone-400">
                  {c.conversationType === 'DASHBOARD_CHANNEL' ? <Radio className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                  {c.otherMembers ?? '—'}
                </span>
                <span className="mt-1 block truncate text-xs text-stone-500">
                  {c.lastSenderName && <strong className="font-medium">{c.lastSenderName.split(' ')[0]}: </strong>}
                  {c.lastMessageBody ?? 'No messages yet'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Message pane */}
      <div className="card flex max-h-[70vh] flex-col">
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
            <MessageSquarePlus className="h-10 w-10 text-stone-300" />
            <p className="mt-3 text-sm font-medium text-stone-600">Select a conversation</p>
            <p className="mt-1 max-w-sm text-xs text-stone-400">
              Private conversations are isolated to their participants. The Super Administrator can
              open a direct thread with any dashboard manager; unrelated employee conversations stay
              private.
            </p>
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-stone-800">{active.title}</p>
                <p className="text-[10px] uppercase tracking-wide text-stone-400">
                  {active.conversationType.replace(/_/g, ' ').toLowerCase()} · {active.code}
                </p>
              </div>
              <StatusBadge status="ACTIVE" />
            </header>

            <div className="thin-scrollbar flex-1 space-y-3 overflow-y-auto bg-stone-50/70 p-4">
              {loadingMsgs && (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
                </div>
              )}
              {error && !loadingMsgs && (
                <div className="mx-auto max-w-md rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-700">
                  {error}
                </div>
              )}
              {messages.map((m) => {
                const mine = m.senderUserId === me.id;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] rounded-xl px-3.5 py-2.5 shadow-sm ${
                        mine
                          ? 'rounded-br-sm bg-chalar-700 text-white'
                          : 'rounded-bl-sm border border-stone-200 bg-white text-stone-800'
                      }`}
                    >
                      {!mine && (
                        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-chalar-600">
                          {m.senderName} · {m.senderRole.replace(/_/g, ' ').toLowerCase()}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.body}</p>
                      <p
                        className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                          mine ? 'text-emerald-200' : 'text-stone-400'
                        }`}
                      >
                        {new Date(m.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        {mine &&
                          (m.readByRecipient ? (
                            <CheckCheck className="h-3.5 w-3.5" aria-label="Read" />
                          ) : m.deliveredToRecipient ? (
                            <Check className="h-3.5 w-3.5" aria-label="Delivered" />
                          ) : null)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <footer className="border-t border-stone-100 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={2}
                  maxLength={4000}
                  placeholder="Type a private message… (Enter to send, Shift+Enter for new line)"
                  className="input resize-none"
                />
                <button onClick={send} disabled={sending || !draft.trim()} className="btn-primary h-[52px] px-4">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
