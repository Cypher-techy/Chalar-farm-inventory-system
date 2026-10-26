'use client';

import { useCallback, useEffect, useState, FormEvent } from 'react';
import { Loader2, PackagePlus, PackageMinus, ArrowLeftRight, RefreshCw } from 'lucide-react';
import { StatusBadge, fmtNum, fmtDateTime, fmtKes } from '@/components/portal/ui';

interface MovementRow {
  id: number;
  movementNumber: string;
  movementType: string;
  quantity: string;
  uomCode: string;
  unitCostKes: string;
  totalCostKes: string;
  reason: string;
  createdAt: string;
  productName: string | null;
  productSku: string | null;
  actorName: string | null;
}

interface Option {
  id: number;
  label: string;
}

export default function InventoryMovementDesk({
  products,
  warehouses,
  lots,
  canCreate,
}: {
  products: Option[];
  warehouses: Option[];
  lots: Array<Option & { warehouseId: number; available: number; status: string }>;
  canCreate: boolean;
}) {
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState<'RECEIPT' | 'ISSUE' | 'TRANSFER' | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (typeFilter) qs.set('type', typeFilter);
      const res = await fetch(`/api/inventory/movements?${qs}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.movements ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitMovement(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const fd = new FormData(e.currentTarget);
    const num = (k: string) => Number(fd.get(k));
    const str = (k: string) => String(fd.get(k) ?? '');

    let payload: Record<string, unknown>;
    if (formOpen === 'RECEIPT') {
      payload = {
        movementType: 'RECEIPT',
        productId: num('productId'),
        toWarehouseId: num('warehouseId'),
        binCode: str('binCode') || 'CR1-A01',
        quantity: num('quantity'),
        unitCostKes: num('unitCostKes'),
        reason: str('reason'),
      };
    } else if (formOpen === 'ISSUE') {
      payload = {
        movementType: 'ISSUE',
        productId: num('productId'),
        lotId: num('lotId'),
        fromWarehouseId: num('warehouseId'),
        quantity: num('quantity'),
        reason: str('reason'),
      };
    } else {
      payload = {
        movementType: 'TRANSFER',
        productId: num('productId'),
        lotId: num('lotId'),
        fromWarehouseId: num('warehouseId'),
        toWarehouseId: num('targetWarehouseId'),
        quantity: num('quantity'),
        reason: str('reason'),
      };
    }

    try {
      const res = await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ kind: 'err', text: data.error ?? 'Movement rejected.' });
        return;
      }
      setNotice({
        kind: 'ok',
        text: `Posted ${formOpen?.toLowerCase()} — movement ${data.movement?.movementNumber ?? ''}`,
      });
      setFormOpen(null);
      setPage(1);
      await load();
    } catch {
      setNotice({ kind: 'err', text: 'Network error.' });
    } finally {
      setBusy(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {canCreate && (
          <>
            <button className="btn-primary" onClick={() => setFormOpen(formOpen === 'RECEIPT' ? null : 'RECEIPT')}>
              <PackagePlus className="h-4 w-4" /> Receive Stock
            </button>
            <button className="btn-secondary" onClick={() => setFormOpen(formOpen === 'ISSUE' ? null : 'ISSUE')}>
              <PackageMinus className="h-4 w-4" /> Issue Stock
            </button>
            <button className="btn-secondary" onClick={() => setFormOpen(formOpen === 'TRANSFER' ? null : 'TRANSFER')}>
              <ArrowLeftRight className="h-4 w-4" /> Transfer
            </button>
          </>
        )}
        <select
          value={typeFilter}
          onChange={(e) => { setPage(1); setTypeFilter(e.target.value); }}
          className="input w-auto text-sm"
          aria-label="Filter by movement type"
        >
          <option value="">All movement types</option>
          <option value="RECEIPT">Receipt</option>
          <option value="ISSUE">Issue</option>
          <option value="TRANSFER">Transfer</option>
          <option value="PRODUCTION_OUTPUT">Production output</option>
          <option value="ADJUSTMENT">Adjustment</option>
        </select>
        <button onClick={load} className="btn-secondary" aria-label="Refresh">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <span className="ml-auto text-xs text-stone-400">{total} movements recorded</span>
      </div>

      {notice && (
        <div
          className={`rounded-md px-3 py-2 text-sm ${
            notice.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </div>
      )}

      {formOpen && (
        <form onSubmit={submitMovement} className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label" htmlFor="mv-product">Product</label>
            <select id="mv-product" name="productId" required className="input">
              <option value="">Select product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="mv-lot">Lot {formOpen !== 'RECEIPT' ? '(required)' : '(unused for receipt)'}</label>
            <select id="mv-lot" name="lotId" required={formOpen !== 'RECEIPT'} className="input">
              <option value="">Select lot…</option>
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label} — {fmtNum(l.available)} avail · {l.status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="mv-wh">{formOpen === 'TRANSFER' ? 'Source warehouse' : 'Warehouse'}</label>
            <select id="mv-wh" name="warehouseId" required className="input">
              <option value="">Select…</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.label}</option>
              ))}
            </select>
          </div>
          {formOpen === 'TRANSFER' && (
            <div>
              <label className="label" htmlFor="mv-twh">Target warehouse</label>
              <select id="mv-twh" name="targetWarehouseId" required className="input">
                <option value="">Select…</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.label}</option>
                ))}
              </select>
            </div>
          )}
          {formOpen === 'RECEIPT' && (
            <>
              <div>
                <label className="label" htmlFor="mv-bin">Bin code</label>
                <input id="mv-bin" name="binCode" className="input" placeholder="CR1-A01" />
              </div>
              <div>
                <label className="label" htmlFor="mv-cost">Unit cost (KES)</label>
                <input id="mv-cost" name="unitCostKes" type="number" step="0.01" min="0" required className="input" />
              </div>
            </>
          )}
          <div>
            <label className="label" htmlFor="mv-qty">Quantity (base units)</label>
            <input id="mv-qty" name="quantity" type="number" step="0.001" min="0.001" required className="input" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label" htmlFor="mv-reason">Reason / reference</label>
            <input id="mv-reason" name="reason" required minLength={3} maxLength={500} className="input" placeholder="e.g. GRN-2026-0219 goods received from supplier" />
          </div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Post {formOpen?.toLowerCase()}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setFormOpen(null)}>Cancel</button>
            <p className="self-center text-[11px] text-stone-400">
              Stock updates run in a database transaction. Issues are blocked if the lot is
              quarantined/expired or available stock would go negative. Repeated submissions are
              deduplicated by idempotency key.
            </p>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Movement</th>
                <th>When</th>
                <th>Type</th>
                <th>Product</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Value</th>
                <th>Reason</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm text-stone-400">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm text-stone-400">
                    No stock movements match this filter.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs text-chalar-700">{r.movementNumber}</td>
                    <td className="whitespace-nowrap text-xs text-stone-500">{fmtDateTime(r.createdAt)}</td>
                    <td><StatusBadge status={r.movementType} /></td>
                    <td>
                      <span className="block text-sm font-medium text-stone-700">{r.productName}</span>
                      <span className="block text-[10px] text-stone-400">{r.productSku}</span>
                    </td>
                    <td className="text-right tabular-nums">{fmtNum(r.quantity, 3)} {r.uomCode}</td>
                    <td className="text-right tabular-nums">{fmtKes(r.totalCostKes)}</td>
                    <td className="max-w-[260px] truncate text-xs text-stone-600" title={r.reason}>{r.reason}</td>
                    <td className="text-xs text-stone-500">{r.actorName ?? '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-stone-100 px-4 py-2.5">
          <span className="text-xs text-stone-400">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button className="btn-secondary px-2.5 py-1 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <button className="btn-secondary px-2.5 py-1 text-xs" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
