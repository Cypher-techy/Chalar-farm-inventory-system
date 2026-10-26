'use client';

import { useState, FormEvent } from 'react';
import { Loader2, CalendarPlus, Check, X } from 'lucide-react';

interface LeaveType {
  code: string;
  name: string;
  statutoryBasis: string;
}

export default function LeaveDesk({
  leaveTypes,
  canSubmitForOthers,
  employeeId,
}: {
  leaveTypes: LeaveType[];
  canSubmitForOthers: boolean;
  employeeId: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      leaveTypeCode: String(fd.get('leaveTypeCode')),
      startDate: String(fd.get('startDate')),
      endDate: String(fd.get('endDate')),
      reason: String(fd.get('reason')),
    };
    const onBehalf = String(fd.get('employeeId') ?? '');
    if (onBehalf) payload.employeeId = Number(onBehalf);

    try {
      const res = await fetch('/api/hr/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ kind: 'err', text: data.error ?? 'Leave request not submitted.' });
        return;
      }
      setNotice({
        kind: 'ok',
        text: `${data.requestNumber} submitted — ${data.totalDays} working day(s) of ${data.leaveType}. Balance after this pending request: ${data.balanceAfterPending} day(s). It is now awaiting the assigned approver.`,
      });
      (e.target as HTMLFormElement).reset();
    } catch {
      setNotice({ kind: 'err', text: 'Network error — request not submitted.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="btn-primary" onClick={() => setOpen((v) => !v)}>
        <CalendarPlus className="h-4 w-4" /> Submit Leave Request
      </button>

      {open && (
        <form onSubmit={submit} className="card mt-3 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {canSubmitForOthers && (
            <div>
              <label className="label" htmlFor="ld-emp">Employee ID (blank = your own record)</label>
              <input id="ld-emp" name="employeeId" type="number" min="1" className="input" placeholder={employeeId ? String(employeeId) : '—'} />
              <p className="mt-1 text-[10px] text-stone-400">
                HR may enter requests on behalf of staff; every submission is audited.
              </p>
            </div>
          )}
          <div>
            <label className="label" htmlFor="ld-type">Leave type</label>
            <select id="ld-type" name="leaveTypeCode" required className="input">
              <option value="">Select…</option>
              {leaveTypes.map((lt) => (
                <option key={lt.code} value={lt.code} title={lt.statutoryBasis}>
                  {lt.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="ld-start">Start date</label>
            <input id="ld-start" name="startDate" type="date" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="ld-end">End date</label>
            <input id="ld-end" name="endDate" type="date" required className="input" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label" htmlFor="ld-reason">Reason</label>
            <input id="ld-reason" name="reason" required minLength={5} maxLength={500} className="input" />
          </div>
          {notice && (
            <p
              className={`sm:col-span-2 lg:col-span-3 rounded-md px-3 py-2 text-sm ${
                notice.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {notice.text}
            </p>
          )}
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
            <button type="submit" disabled={busy} className="btn-primary">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit request
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Close</button>
            <span className="text-[11px] text-stone-400">
              Working days exclude Sundays (rest day, Employment Act 2007). Balances, overlaps and
              entitlements are validated server-side.
            </span>
          </div>
        </form>
      )}
    </div>
  );
}

export function ApprovalButtons({ code, onDecided }: { code: string; onDecided?: () => void }) {
  const [busy, setBusy] = useState<null | 'APPROVED' | 'REJECTED'>(null);
  const [err, setErr] = useState<string | null>(null);

  async function decide(decision: 'APPROVED' | 'REJECTED') {
    setBusy(decision);
    setErr(null);
    try {
      const comments =
        decision === 'REJECTED'
          ? window.prompt('Reason for rejection (recorded in the audit log):') ?? ''
          : undefined;
      const res = await fetch(`/api/approvals?code=${encodeURIComponent(code)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, comments }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? 'Decision failed.');
        return;
      }
      onDecided?.();
      window.location.reload();
    } catch {
      setErr('Network error.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <span className="flex items-center gap-1.5">
      <button
        onClick={() => decide('APPROVED')}
        disabled={busy !== null}
        className="btn bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700"
        title="Approve"
      >
        {busy === 'APPROVED' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={() => decide('REJECTED')}
        disabled={busy !== null}
        className="btn bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
        title="Reject"
      >
        {busy === 'REJECTED' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
      </button>
      {err && <span className="text-[10px] text-red-600">{err}</span>}
    </span>
  );
}
