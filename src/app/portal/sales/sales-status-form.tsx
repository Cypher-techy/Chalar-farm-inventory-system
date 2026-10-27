'use client';

import { useState, FormEvent } from 'react';
import { Loader2, GitBranch } from 'lucide-react';
import type { FieldDef } from '@/components/portal/record-form';

/**
 * Sales order state-machine form. Posts to /api/sales/orders/{number}/status —
 * the order number is part of the path, so the client builds the endpoint from
 * the selection and the server re-validates the transition and permissions.
 */
export default function SalesStatusForm({
  orders,
  fields,
}: {
  orders: Array<{ value: string; label: string; status: string }>;
  batches: Array<{ value: string; label: string; qa: string }>;
  fields: FieldDef[];
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [orderNumber, setOrderNumber] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!orderNumber) {
      setNotice({ kind: 'err', text: 'Select a sales order first.' });
      return;
    }
    setBusy(true);
    setNotice(null);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.name === 'orderNumber') continue;
      const raw = fd.get(f.name);
      if (raw === null || raw === '') continue;
      payload[f.name] = f.type === 'number' ? Number(raw) : String(raw);
    }
    try {
      const res = await fetch(`/api/sales/orders/${encodeURIComponent(orderNumber)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ kind: 'err', text: data.error ?? 'Transition rejected.' });
        return;
      }
      setNotice({ kind: 'ok', text: data.message ?? 'Order updated.' });
      setTimeout(() => window.location.reload(), 900);
    } catch {
      setNotice({ kind: 'err', text: 'Network error.' });
    } finally {
      setBusy(false);
    }
  }

  const orderField = fields.find((f) => f.name === 'orderNumber');

  return (
    <div className="card">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-chalar-800">
          <GitBranch className="h-4 w-4" /> Advance a sales order (state machine)
        </span>
        <span className="text-xs text-stone-400">{orders.length} open orders</span>
      </button>

      {open && (
        <form onSubmit={submit} className="grid gap-3 border-t border-stone-100 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="ssf-order">{orderField?.label ?? 'Sales order'}</label>
            <select
              id="ssf-order"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              required
              className="input"
            >
              <option value="">Select an open order…</option>
              {orders.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {orderField?.hint && <p className="mt-1 text-[10px] text-stone-400">{orderField.hint}</p>}
          </div>

          {fields
            .filter((f) => f.name !== 'orderNumber')
            .map((f) => (
              <div key={f.name} className={f.span === 3 ? 'sm:col-span-2 lg:col-span-3' : f.span === 2 ? 'sm:col-span-2' : ''}>
                <label className="label" htmlFor={`ssf-${f.name}`}>{f.label}</label>
                {f.type === 'select' ? (
                  <select id={`ssf-${f.name}`} name={f.name} required={f.required} className="input">
                    <option value="">Select…</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea id={`ssf-${f.name}`} name={f.name} rows={2} className="input resize-none" />
                ) : (
                  <input
                    id={`ssf-${f.name}`}
                    name={f.name}
                    type={f.type}
                    step={f.step}
                    min={f.min}
                    required={f.required}
                    className="input"
                  />
                )}
                {f.hint && <p className="mt-1 text-[10px] text-stone-400">{f.hint}</p>}
              </div>
            ))}

          {notice && (
            <p className={`sm:col-span-2 lg:col-span-3 rounded-md px-3 py-2 text-sm ${notice.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {notice.text}
            </p>
          )}

          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
            <button type="submit" disabled={busy} className="btn-primary">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Apply transition
            </button>
            <span className="text-[11px] text-stone-400">
              Transitions are validated server-side; allocation is checked against QA-released stock.
            </span>
          </div>
        </form>
      )}
    </div>
  );
}
