'use client';

import { useState, FormEvent } from 'react';
import { Loader2, Truck, CheckCircle2 } from 'lucide-react';

interface OrderOption {
  value: string;
  label: string;
  allocated: string;
  customer: string;
  spec: string;
}
interface VehicleOption {
  id: number;
  label: string;
  status: string;
  range: string;
}

export function DispatchForm({ orders, vehicles }: { orders: OrderOption[]; vehicles: VehicleOption[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [podOpen, setPodOpen] = useState(false);

  async function dispatch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      salesOrderNumber: String(fd.get('salesOrderNumber')),
      vehicleId: Number(fd.get('vehicleId')),
      packingBatchCode: String(fd.get('packingBatchCode') || '') || undefined,
      dispatchedKg: Number(fd.get('dispatchedKg')),
      cartonsCount: Number(fd.get('cartonsCount')),
      departureTempC: Number(fd.get('departureTempC')),
      transportCostKes: Number(fd.get('transportCostKes')),
      airWaybillNo: String(fd.get('airWaybillNo') || '') || undefined,
      airlineName: String(fd.get('airlineName') || '') || undefined,
      destinationLocation: String(fd.get('destinationLocation') || '') || undefined,
    };
    try {
      const res = await fetch('/api/logistics/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ kind: 'err', text: data.error ?? 'Dispatch rejected.' });
        return;
      }
      setNotice({ kind: 'ok', text: data.message });
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      setNotice({ kind: 'err', text: 'Network error.' });
    } finally {
      setBusy(false);
    }
  }

  async function recordPod(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/logistics/shipments/${encodeURIComponent(String(fd.get('shipmentCode')))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: String(fd.get('action')),
          arrivalTempC: fd.get('arrivalTempC') ? Number(fd.get('arrivalTempC')) : undefined,
          proofOfDeliveryRef: String(fd.get('proofOfDeliveryRef') || '') || undefined,
          deliveryRecipientName: String(fd.get('deliveryRecipientName') || '') || undefined,
          deliveryNotes: String(fd.get('deliveryNotes') || '') || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ kind: 'err', text: data.error ?? 'Update rejected.' });
        return;
      }
      setNotice({ kind: 'ok', text: data.message });
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      setNotice({ kind: 'err', text: 'Network error.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <button type="button" onClick={() => { setOpen((v) => !v); setPodOpen(false); }} className="inline-flex items-center gap-2 text-sm font-semibold text-chalar-800">
          <Truck className="h-4 w-4" /> Dispatch a load (cold-chain gated)
        </button>
        <button type="button" onClick={() => { setPodOpen((v) => !v); setOpen(false); }} className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600">
          <CheckCircle2 className="h-4 w-4" /> Record arrival / proof of delivery
        </button>
      </div>

      {open && (
        <form onSubmit={dispatch} className="grid gap-3 border-t border-stone-100 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="df-order">Sales order</label>
            <select id="df-order" name="salesOrderNumber" required className="input">
              <option value="">Select a packed/reserved order…</option>
              {orders.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} · allocated {Number(o.allocated).toFixed(1)} kg · spec {o.spec}°C
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="df-vehicle">Vehicle</label>
            <select id="df-vehicle" name="vehicleId" required className="input">
              <option value="">Select…</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.label} · {v.range} · {v.status}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="df-kg">Dispatched weight (kg)</label>
            <input id="df-kg" name="dispatchedKg" type="number" step="0.01" min="0.01" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="df-cartons">Cartons</label>
            <input id="df-cartons" name="cartonsCount" type="number" min="1" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="df-temp">Load temperature at departure (°C)</label>
            <input id="df-temp" name="departureTempC" type="number" step="0.1" min="-10" max="30" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="df-cost">Transport cost (KES)</label>
            <input id="df-cost" name="transportCostKes" type="number" step="1" min="0" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="df-awb">Airwaybill number (optional)</label>
            <input id="df-awb" name="airWaybillNo" className="input" placeholder="Recorded when the airline issues it" />
          </div>
          <div>
            <label className="label" htmlFor="df-airline">Airline (optional)</label>
            <input id="df-airline" name="airlineName" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="df-batch">Packing batch (optional)</label>
            <input id="df-batch" name="packingBatchCode" className="input" placeholder="PB-…" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label" htmlFor="df-dest">Destination</label>
            <input id="df-dest" name="destinationLocation" className="input" defaultValue="JKIA Nairobi — Airfreight Terminal" />
          </div>

          {notice && (
            <p className={`sm:col-span-2 lg:col-span-3 rounded-md px-3 py-2 text-sm ${notice.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {notice.text}
            </p>
          )}
          <div className="sm:col-span-2 lg:col-span-3">
            <button type="submit" disabled={busy} className="btn-primary">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Dispatch load
            </button>
          </div>
        </form>
      )}

      {podOpen && (
        <form onSubmit={recordPod} className="grid gap-3 border-t border-stone-100 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label" htmlFor="pod-code">Shipment code</label>
            <input id="pod-code" name="shipmentCode" required className="input font-mono text-xs" placeholder="SHP-…" />
          </div>
          <div>
            <label className="label" htmlFor="pod-action">Event</label>
            <select id="pod-action" name="action" required className="input">
              <option value="AIRFREIGHT_DEPARTED">Airfreight departed</option>
              <option value="DELIVERED">Delivered (POD)</option>
              <option value="EXCEPTION">Exception (temperature/damage)</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pod-temp">Arrival temperature (°C)</label>
            <input id="pod-temp" name="arrivalTempC" type="number" step="0.1" min="-10" max="40" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="pod-ref">POD reference</label>
            <input id="pod-ref" name="proofOfDeliveryRef" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="pod-name">Received by</label>
            <input id="pod-name" name="deliveryRecipientName" className="input" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label" htmlFor="pod-notes">Notes</label>
            <input id="pod-notes" name="deliveryNotes" className="input" />
          </div>
          {notice && (
            <p className={`sm:col-span-2 lg:col-span-3 rounded-md px-3 py-2 text-sm ${notice.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {notice.text}
            </p>
          )}
          <div className="sm:col-span-2 lg:col-span-3">
            <button type="submit" disabled={busy} className="btn-primary">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Record event
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
