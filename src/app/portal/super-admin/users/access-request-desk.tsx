'use client';

import { useState } from 'react';
import { Check, Inbox, Loader2, ShieldAlert, X } from 'lucide-react';
import { StatusBadge, fmtDateTime } from '@/components/portal/ui';

export interface AccessRequestRow {
  id: number;
  requestCode: string;
  email: string;
  fullName: string;
  phone: string | null;
  jobTitle: string | null;
  departmentId: number | null;
  department: string | null;
  requestedRoleCode: string;
  grantedRoleCode: string | null;
  message: string | null;
  status: string;
  decisionNote: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  createdAt: string;
}

interface Props {
  requests: AccessRequestRow[];
  accountTypes: Array<{ code: string; name: string }>;
  departments: Array<{ id: number; name: string }>;
}

/** Super Admin review queue for self-service account requests. */
export function AccessRequestDesk({ requests, accountTypes, departments }: Props) {
  const pending = requests.filter((r) => r.status === 'PENDING');
  const decided = requests.filter((r) => r.status !== 'PENDING').slice(0, 15);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { roleCode: string; departmentId: string; note: string }>>({});
  const roleName = (code: string | null) => accountTypes.find((a) => a.code === code)?.name ?? code ?? '—';

  const draftFor = (r: AccessRequestRow) =>
    drafts[r.id] ?? { roleCode: r.requestedRoleCode, departmentId: r.departmentId ? String(r.departmentId) : '', note: '' };
  const setDraft = (r: AccessRequestRow, patch: Partial<{ roleCode: string; departmentId: string; note: string }>) =>
    setDrafts((d) => ({ ...d, [r.id]: { ...draftFor(r), ...patch } }));

  async function decide(r: AccessRequestRow, action: 'APPROVE' | 'REJECT') {
    const d = draftFor(r);
    if (action === 'REJECT' && d.note.trim().length < 3) {
      setNotice({ kind: 'err', text: 'Add a short reason in the note before rejecting.' });
      return;
    }
    setBusy(`${action}-${r.id}`);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/access-requests/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          action === 'APPROVE'
            ? {
                action,
                roleCode: d.roleCode,
                departmentId: d.departmentId ? Number(d.departmentId) : null,
                note: d.note.trim() || undefined,
              }
            : { action, note: d.note.trim() }
        ),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
      setNotice({ kind: 'ok', text: data.message ?? 'Done.' });
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : 'Action failed.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section id="access-requests" className="card mb-4 scroll-mt-24">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-stone-800">
          <Inbox className="h-4 w-4 text-chalar-600" aria-hidden />
          Account requests
          {pending.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
              {pending.length} pending
            </span>
          )}
        </h2>
        <p className="flex items-center gap-1.5 text-[11px] text-stone-500">
          <ShieldAlert className="h-3.5 w-3.5 text-amber-600" aria-hidden />
          Email addresses are not verified — confirm each person&apos;s identity (phone, line manager) before approving.
        </p>
      </header>

      {notice && (
        <div
          className={`mx-4 mt-3 rounded-lg px-3 py-2 text-xs ${notice.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}
          role={notice.kind === 'ok' ? 'status' : 'alert'}
        >
          {notice.text}
        </div>
      )}

      {pending.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-stone-400">
          No pending requests. New staff can ask for an account from the &ldquo;Request account&rdquo; link on the sign-in page.
        </p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {pending.map((r) => {
            const d = draftFor(r);
            return (
              <li key={r.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[1.1fr_1fr]">
                <div className="min-w-0 text-xs">
                  <p className="text-sm font-semibold text-stone-800">{r.fullName}</p>
                  <p className="font-mono text-[11px] text-stone-500">{r.email}</p>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-stone-600">
                    <dt className="text-stone-400">Requested</dt>
                    <dd className="font-semibold text-chalar-700">{roleName(r.requestedRoleCode)}</dd>
                    {r.jobTitle && (<><dt className="text-stone-400">Job title</dt><dd>{r.jobTitle}</dd></>)}
                    <dt className="text-stone-400">Department</dt>
                    <dd>{r.department ?? 'Not specified'}</dd>
                    {r.phone && (<><dt className="text-stone-400">Phone</dt><dd>{r.phone}</dd></>)}
                    <dt className="text-stone-400">Submitted</dt>
                    <dd>{fmtDateTime(r.createdAt)} · <span className="font-mono text-[10px]">{r.requestCode}</span></dd>
                  </dl>
                  {r.message && (
                    <p className="mt-2 whitespace-pre-line rounded-lg bg-stone-50 px-3 py-2 text-stone-600">{r.message}</p>
                  )}
                </div>

                <div className="space-y-2.5">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="text-[11px] text-stone-500">
                      Grant account type
                      <select className="input mt-1 h-9 text-xs" value={d.roleCode} onChange={(e) => setDraft(r, { roleCode: e.target.value })}>
                        {accountTypes.map((a) => (
                          <option key={a.code} value={a.code}>{a.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[11px] text-stone-500">
                      Department
                      <select className="input mt-1 h-9 text-xs" value={d.departmentId} onChange={(e) => setDraft(r, { departmentId: e.target.value })}>
                        <option value="">None</option>
                        {departments.map((dep) => (
                          <option key={dep.id} value={dep.id}>{dep.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="block text-[11px] text-stone-500">
                    Note (required to reject; recorded in the audit log)
                    <input className="input mt-1 h-9 text-xs" maxLength={500} value={d.note} onChange={(e) => setDraft(r, { note: e.target.value })} />
                  </label>
                  {d.roleCode !== r.requestedRoleCode && (
                    <p className="text-[11px] text-amber-700">
                      Granting {roleName(d.roleCode)} instead of the requested {roleName(r.requestedRoleCode)}.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button type="button" className="btn-primary h-9 flex-1 text-xs" disabled={busy !== null} onClick={() => decide(r, 'APPROVE')}>
                      {busy === `APPROVE-${r.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Approve &amp; create account
                    </button>
                    <button type="button" className="btn-secondary h-9 text-xs hover:border-red-300 hover:text-red-700" disabled={busy !== null} onClick={() => decide(r, 'REJECT')}>
                      {busy === `REJECT-${r.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                      Reject
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {decided.length > 0 && (
        <details className="border-t border-stone-100 px-4 py-3 text-xs">
          <summary className="cursor-pointer font-medium text-stone-600">Recent decisions ({decided.length})</summary>
          <ul className="mt-2 divide-y divide-stone-50">
            {decided.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <StatusBadge status={r.status} />
                <span className="font-medium text-stone-700">{r.fullName}</span>
                <span className="font-mono text-[10px] text-stone-500">{r.email}</span>
                <span className="text-stone-500">
                  {r.status === 'APPROVED'
                    ? `as ${roleName(r.grantedRoleCode)}${r.grantedRoleCode !== r.requestedRoleCode ? ` (asked: ${roleName(r.requestedRoleCode)})` : ''}`
                    : `asked: ${roleName(r.requestedRoleCode)}`}
                </span>
                <span className="text-stone-400">
                  {r.decidedBy ?? '—'} · {fmtDateTime(r.decidedAt)}
                  {r.decisionNote ? ` — ${r.decisionNote}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
