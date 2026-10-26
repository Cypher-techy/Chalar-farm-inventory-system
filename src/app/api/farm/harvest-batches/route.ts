import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import * as t from '@/db/schema';
import { requirePermission, jsonOk, jsonError, clientIp, rateLimit, withIdempotency } from '@/lib/guards';
import { recordAuditLog } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const harvestSchema = z.object({
  cropCycleId: z.number().int().positive(),
  harvestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.'),
  harvestedWeightKg: z.number().positive().max(100000),
  rejectedFieldWeightKg: z.number().min(0).max(100000).default(0),
  cratesCount: z.number().int().min(1).max(5000).default(10),
  fieldTempC: z.number().min(-5).max(60),
  harvestedByUserId: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'farm.create');
    const ip = clientIp(req);
    rateLimit(`harvest:${user.id}`, 30, 60_000);

    const body = await req.json().catch(() => null);
    const parsed = harvestSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.join('.') ?? 'payload';
      return jsonError(400, issue?.message === 'Required' ? `${field} is required.` : issue?.message ?? 'Invalid payload.');
    }
    const data = parsed.data;

    const idempotencyKey =
      req.headers.get('idempotency-key') ??
      `harvest-${data.cropCycleId}-${data.harvestDate}-${data.harvestedWeightKg}`;

    const outcome = await withIdempotency(idempotencyKey, async () => {
      const db = await getDb();

      const cycleRows = await db
        .select({ id: t.cropCycles.id, cropId: t.cropCycles.cropId, fieldId: t.cropCycles.fieldId, status: t.cropCycles.status })
        .from(t.cropCycles)
        .where(eq(t.cropCycles.id, data.cropCycleId))
        .limit(1);
      const cycle = cycleRows[0];
      if (!cycle) throw new Error('CYCLE_NOT_FOUND');
      if (cycle.status === 'COMPLETED' || cycle.status === 'CANCELLED') {
        throw new Error('CYCLE_CLOSED');
      }

      const netKg = (data.harvestedWeightKg - data.rejectedFieldWeightKg).toFixed(2);
      if (Number(netKg) <= 0) throw new Error('NET_WEIGHT_NOT_POSITIVE');

      // Resolve the finished-goods product mapped to this crop (traceability requires a real SKU)
      const productRows = (await db.execute(sql`
        SELECT id, sku FROM products
        WHERE crop_id = ${cycle.cropId} AND is_active
        ORDER BY (uom_code = 'KG') DESC, id
        LIMIT 1;
      `)) as unknown as { rows: Array<{ id: number; sku: string }> };
      const product = productRows.rows[0];
      if (!product) throw new Error('NO_PRODUCT_FOR_CROP');

      const batchNumber = `HB-${data.harvestDate.replace(/-/g, '')}-${Date.now().toString().slice(-5)}`;

      const result = await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(t.harvestBatches)
          .values({
            batchNumber,
            cropCycleId: cycle.id,
            fieldId: cycle.fieldId,
            cropId: cycle.cropId,
            harvestDate: data.harvestDate,
            harvestedWeightKg: data.harvestedWeightKg.toFixed(2),
            rejectedFieldWeightKg: data.rejectedFieldWeightKg.toFixed(2),
            netTransferredKg: netKg,
            cratesCount: data.cratesCount,
            fieldTempC: data.fieldTempC.toFixed(2),
            destination: 'PACKHOUSE',
            status: 'IN_PACKHOUSE',
            harvestedByUserId: data.harvestedByUserId ?? user.id,
            notes: data.notes ?? null,
          })
          .returning();
        const harvestBatchId = inserted[0].id;

        // Roll actual harvested weight onto the crop cycle
        await tx.execute(sql`
          UPDATE crop_cycles
          SET actual_harvested_kg = COALESCE(actual_harvested_kg, 0) + ${netKg}::numeric,
              status = CASE WHEN status IN ('PLANNED','PLANTED','GROWING') THEN 'HARVESTING' ELSE status END
          WHERE id = ${cycle.id};
        `);

        // Create the traceable packhouse lot for the harvested batch
        const lotNumber = `LOT-${batchNumber}`;
        await tx.insert(t.inventoryLots).values({
          lotNumber,
          productId: product.id,
          warehouseId: 1,
          binCode: 'CR1-INTAKE',
          harvestBatchId,
          physicalQty: netKg,
          reservedQty: '0.000',
          availableQty: netKg,
          unitCostKes: '0.00',
          receivedDate: data.harvestDate,
          qualityStatus: 'QUARANTINED',
        });

        return { harvestBatchId, batchNumber, lotNumber, netKg };
      });

      await recordAuditLog({
        actor: user,
        action: 'HARVEST_BATCH_RECORDED',
        module: 'FARM',
        entityType: 'HARVEST_BATCH',
        entityId: result.batchNumber,
        summary: `Recorded harvest ${result.batchNumber}: ${data.harvestedWeightKg} kg gross, ${data.rejectedFieldWeightKg} kg field reject, ${result.netKg} kg net to packhouse`,
        afterState: data,
        ipAddress: ip,
      });

      return { status: 201, body: { ok: true, harvest: result } };
    });

    return new Response(JSON.stringify(outcome.body), {
      status: outcome.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    const msg = e instanceof Error ? e.message : 'Unknown error';
    const map: Record<string, [number, string]> = {
      CYCLE_NOT_FOUND: [404, 'Crop cycle not found.'],
      CYCLE_CLOSED: [409, 'This crop cycle is closed — harvests can no longer be recorded against it.'],
      NET_WEIGHT_NOT_POSITIVE: [400, 'Net transferred weight must be greater than zero (gross minus field rejects).'],
      NO_PRODUCT_FOR_CROP: [
        409,
        'No active finished-goods product is mapped to this crop, so the harvested lot cannot be made traceable. Map a product SKU to the crop first.',
      ],
    };
    if (map[msg]) return jsonError(map[msg][0], map[msg][1]);
    console.error('harvest POST', e);
    return jsonError(500, 'Failed to record harvest batch.');
  }
}
