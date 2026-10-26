'use client';

import { useState, FormEvent } from 'react';
import { Loader2, Sprout } from 'lucide-react';

interface CycleOption {
  id: number;
  label: string;
  cropId: number;
  fieldId: number;
}

export default function HarvestForm({
  cycles,
  onPosted,
}: {
  cycles: CycleOption[];
  onPosted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      cropCycleId: Number(fd.get('cropCycleId')),
      harvestDate: String(fd.get('harvestDate')),
      harvestedWeightKg: Number(fd.get('harvestedWeightKg')),
      rejectedFieldWeightKg: Number(fd.get('rejectedFieldWeightKg') || 0),
      cratesCount: Number(fd.get('cratesCount') || 10),
      fieldTempC: Number(fd.get('fieldTempC')),
      notes: String(fd.get('notes') || '') || undefined,
    };
    try {
      const res = await fetch('/api/farm/harvest-batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `harvest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ kind: 'err', text: data.error ?? 'Harvest not recorded.' });
        return;
      }
      setNotice({
        kind: 'ok',
        text: `Recorded ${data.harvest?.batchNumber} — ${data.harvest?.netKg} kg net transferred to packhouse as lot ${data.harvest?.lotNumber} (quarantined pending QA).`,
      });
      (e.target as HTMLFormElement).reset();
      onPosted?.();
    } catch {
      setNotice({ kind: 'err', text: 'Network error — harvest not recorded.' });
    } finally {
      setBusy(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <button className="btn-primary" onClick={() => setOpen((v) => !v)}>
        <Sprout className="h-4 w-4" /> Record Harvest Batch
      </button>

      {open && (
        <form onSubmit={submit} className="card mt-3 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label" htmlFor="hf-cycle">Crop cycle</label>
            <select id="hf-cycle" name="cropCycleId" required className="input">
              <option value="">Select an active crop cycle…</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="hf-date">Harvest date</label>
            <input id="hf-date" name="harvestDate" type="date" required max={today} defaultValue={today} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="hf-gross">Gross weight (kg)</label>
            <input id="hf-gross" name="harvestedWeightKg" type="number" step="0.01" min="0.01" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="hf-reject">Field rejects (kg)</label>
            <input id="hf-reject" name="rejectedFieldWeightKg" type="number" step="0.01" min="0" defaultValue="0" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="hf-crates">Crates</label>
            <input id="hf-crates" name="cratesCount" type="number" min="1" defaultValue="10" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="hf-temp">Field temperature (°C)</label>
            <input id="hf-temp" name="fieldTempC" type="number" step="0.1" min="-5" max="60" required className="input" placeholder="e.g. 21.5" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label" htmlFor="hf-notes">Notes (optional)</label>
            <input id="hf-notes" name="notes" maxLength={500} className="input" placeholder="Crew, block, weather conditions…" />
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
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Save harvest batch
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Close</button>
            <span className="text-[11px] text-stone-400">
              Posting creates a traceable packhouse lot in QUARANTINED status and rolls net weight onto the crop cycle.
            </span>
          </div>
        </form>
      )}
    </div>
  );
}
