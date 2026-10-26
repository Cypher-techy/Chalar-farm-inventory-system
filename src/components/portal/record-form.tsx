'use client';

import { useState, FormEvent, type ReactNode } from 'react';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';

export interface FieldDef {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  step?: string;
  min?: number;
  max?: number;
  defaultValue?: string;
  hint?: string;
  span?: 1 | 2 | 3;
}

/**
 * Generic, server-validated record form used across ERP modules.
 * Posts JSON to `endpoint` and surfaces the server's business-rule errors verbatim
 * (no client-side pretending: all validation and authorization happens server-side).
 */
export default function RecordForm({
  endpoint,
  method = 'POST',
  title,
  description,
  fields,
  submitLabel = 'Save record',
  buttonLabel,
  buttonClass = 'btn-primary',
  transform,
  onDone,
  children,
}: {
  endpoint: string;
  method?: 'POST' | 'PATCH' | 'PUT';
  title: string;
  description?: string;
  fields: FieldDef[];
  submitLabel?: string;
  buttonLabel?: string;
  buttonClass?: string;
  /** Optional client-side shaping of the payload (server still validates). */
  transform?: (payload: Record<string, unknown>) => Record<string, unknown>;
  onDone?: (response: Record<string, unknown>) => void;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = fd.get(f.name);
      if (raw === null || raw === '') {
        if (f.type === 'number') continue;
        payload[f.name] = raw === null ? undefined : '';
        continue;
      }
      payload[f.name] = f.type === 'number' ? Number(raw) : String(raw);
    }
    const body = transform ? transform(payload) : payload;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (method === 'POST') {
        headers['Idempotency-Key'] = `${endpoint}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      }
      const res = await fetch(endpoint, { method, headers, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ kind: 'err', text: data.error ?? `Request failed (${res.status}).` });
        return;
      }
      setNotice({
        kind: 'ok',
        text:
          typeof data.message === 'string'
            ? data.message
            : `Recorded${data.code ? ` — ${data.code}` : ''}${data.number ? ` — ${data.number}` : ''}.`,
      });
      (e.target as HTMLFormElement).reset();
      onDone?.(data as Record<string, unknown>);
    } catch {
      setNotice({ kind: 'err', text: 'Network error — nothing was saved.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span>
          <span className={`inline-flex items-center gap-2 text-sm font-semibold ${buttonClass.includes('danger') ? 'text-red-700' : 'text-chalar-800'}`}>
            {buttonLabel ?? title}
          </span>
          {description && !open && (
            <span className="ml-2 hidden text-xs text-stone-400 sm:inline">{description}</span>
          )}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {open && (
        <form onSubmit={submit} className="grid gap-3 border-t border-stone-100 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {description && (
            <p className="sm:col-span-2 lg:col-span-3 text-xs text-stone-500">{description}</p>
          )}
          {fields.map((f) => (
            <div
              key={f.name}
              className={f.span === 3 ? 'sm:col-span-2 lg:col-span-3' : f.span === 2 ? 'sm:col-span-2' : ''}
            >
              <label className="label" htmlFor={`rf-${f.name}`}>{f.label}</label>
              {f.type === 'select' ? (
                <select id={`rf-${f.name}`} name={f.name} required={f.required} className="input">
                  <option value="">Select…</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea
                  id={`rf-${f.name}`}
                  name={f.name}
                  required={f.required}
                  rows={2}
                  placeholder={f.placeholder}
                  className="input resize-none"
                />
              ) : (
                <input
                  id={`rf-${f.name}`}
                  name={f.name}
                  type={f.type}
                  required={f.required}
                  step={f.step}
                  min={f.min}
                  max={f.max}
                  defaultValue={f.defaultValue}
                  placeholder={f.placeholder}
                  className="input"
                />
              )}
              {f.hint && <p className="mt-1 text-[10px] leading-relaxed text-stone-400">{f.hint}</p>}
            </div>
          ))}

          {children}

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
            <button type="submit" disabled={busy} className={buttonClass}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitLabel}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
