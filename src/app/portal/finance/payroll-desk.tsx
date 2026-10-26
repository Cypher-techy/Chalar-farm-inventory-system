'use client';

import { useState } from 'react';
import { Loader2, Calculator, ShieldCheck, FileText } from 'lucide-react';

export default function PayrollDesk({
  canManage,
  canApprove,
  latestPeriod,
}: {
  canManage: boolean;
  canApprove: boolean;
  latestPeriod: string;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [period, setPeriod] = useState(() => nextPeriod(latestPeriod));
  const [payDate, setPayDate] = useState(() => lastDayOfMonth(nextPeriod(latestPeriod)));
  const [approveCode, setApproveCode] = useState('');

  async function createRun() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/payroll/runs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `payroll-${period}-${Date.now()}`,
        },
        body: JSON.stringify({ periodMonth: period, payDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ kind: 'err', text: data.error ?? 'Payroll run failed.' });
        return;
      }
      const t = data.totals;
      setNotice({
        kind: 'ok',
        text: `Draft run ${data.runCode} created for ${t.employeeCount} employees under statutory version ${data.statutoryVersion}: gross ${fmt(t.gross)}, PAYE ${fmt(t.paye)}, NSSF ${fmt(t.nssfEmployee)}, SHIF ${fmt(t.shif)}, housing levy ${fmt(t.housingLevyEmployee)}, net ${fmt(t.net)}. It now awaits an approver other than you.`,
      });
      setApproveCode(data.runCode);
    } catch {
      setNotice({ kind: 'err', text: 'Network error.' });
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: 'APPROVE' | 'REJECT') {
    if (!approveCode.trim()) {
      setNotice({ kind: 'err', text: 'Enter the run code to decide on (e.g. PAY-202611-DRAFT).' });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/payroll/runs/${encodeURIComponent(approveCode.trim())}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ kind: 'err', text: data.error ?? 'Decision failed.' });
        return;
      }
      setNotice({
        kind: 'ok',
        text:
          decision === 'APPROVE'
            ? `Run approved and posted — journal ${data.journalEntry} (Dr ${data.totalDebit} = Cr ${data.totalCredit}).`
            : 'Run rejected; the preparer has been notified.',
      });
      window.location.reload();
    } catch {
      setNotice({ kind: 'err', text: 'Network error.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-end gap-3">
        {canManage && (
          <>
            <div>
              <label className="label" htmlFor="pr-period">Pay period</label>
              <input
                id="pr-period"
                type="month"
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setPayDate(lastDayOfMonth(e.target.value));
                }}
                className="input w-40"
              />
            </div>
            <div>
              <label className="label" htmlFor="pr-paydate">Pay date</label>
              <input
                id="pr-paydate"
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="input w-44"
              />
            </div>
            <button onClick={createRun} disabled={busy} className="btn-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              Compute draft payroll
            </button>
          </>
        )}

        {canApprove && (
          <>
            <div>
              <label className="label" htmlFor="pr-code">Run code to decide</label>
              <input
                id="pr-code"
                value={approveCode}
                onChange={(e) => setApproveCode(e.target.value)}
                placeholder="PAY-202611-DRAFT"
                className="input w-52 font-mono text-xs"
              />
            </div>
            <button onClick={() => decide('APPROVE')} disabled={busy} className="btn bg-emerald-600 text-white hover:bg-emerald-700">
              <ShieldCheck className="h-4 w-4" /> Approve &amp; post
            </button>
            <button onClick={() => decide('REJECT')} disabled={busy} className="btn-danger">Reject</button>
          </>
        )}

        <a href={`/api/reports/export?type=payroll&period=${encodeURIComponent(period)}`} className="btn-secondary">
          <FileText className="h-4 w-4" /> Payroll register CSV
        </a>
        <a href={`/api/reports/export?type=payroll&period=${encodeURIComponent(period)}&format=pdf`} className="btn-secondary">
          <FileText className="h-4 w-4" /> PDF
        </a>
      </div>

      {notice && (
        <p
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            notice.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-stone-400">
        Deductions are computed from the date-effective Kenyan statutory rule version (graduated PAYE
        bands with personal relief, NSSF Tier I/II, SHIF 2.75% with the KES 300 minimum, and the 1.5%
        Affordable Housing Levy on both sides). Approval requires a second authorized user — the
        preparer cannot approve their own run — and posts a balanced double-entry journal.
      </p>
    </div>
  );
}

function fmt(n: number | string): string {
  return `KES ${Number(n).toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;
}

function nextPeriod(current: string): string {
  if (!/^\d{4}-\d{2}$/.test(current)) {
    return new Date().toISOString().slice(0, 7);
  }
  const [y, m] = current.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1)); // month is 0-indexed → next month
  return d.toISOString().slice(0, 7);
}

function lastDayOfMonth(period: string): string {
  if (!/^\d{4}-\d{2}$/.test(period)) return new Date().toISOString().slice(0, 10);
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
