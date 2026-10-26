import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import * as t from '@/db/schema';
import { requirePermission, jsonOk, jsonError, clientIp, rateLimit, withIdempotency } from '@/lib/guards';
import { recordAuditLog } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const schema = z
  .object({
    harvestBatchId: z.number().int().positive(),
    intakeWeightKg: z.number().positive().max(100000),
    intakeTempC: z.number().min(-10).max(60),
    gradedAcceptedKg: z.number().min(0).max(100000),
    gradedRejectedKg: z.number().min(0).max(100000),
    washingLossKg: z.number().min(0).max(100000),
    packedOutputKg: z.number().min(0).max(100000),
    packFormat: z.string().min(2).max(64),
    unitsPackedCount: z.number().int().min(0).max(1000000),
    labourCount: z.number().int().min(1).max(500).default(18),
    shiftCode: z.string().min(3).max(32).default('SHIFT-DAY'),
    packagingProductId: z.number().int().positive().optional(),
    packagingQtyUsed: z.number().min(0).max(100000).optional(),
    labourRateKesPerHour: z.number().min(0).max(10000).default(95),
    hoursPerWorker: z.number().min(0).max(16).default(8),
  })
  .refine((d) => d.gradedAcceptedKg + d.gradedRejectedKg <= d.intakeWeightKg + 0.001, {
    message: 'Graded accepted + rejected cannot exceed the intake weight.',
    path: ['gradedAcceptedKg'],
  })
  .refine((d) => d.packedOutputKg <= d.gradedAcceptedKg - d.washingLossKg + 0.001, {
    message: 'Packed output cannot exceed accepted weight less washing loss.',
    path: ['packedOutputKg'],
  });

/**
 * Records a packhouse run against a harvest batch: intake → grading → washing →
 * packing. Consumes the harvest intake lot, creates the finished-goods lot in
 * QUARANTINED status (pending QA release) and posts auditable stock movements.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'packhouse.manage');
    const ip = clientIp(req);
    rateLimit(`packing:${user.id}`, 30, 60_000);

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.join('.') ?? 'payload';
      return jsonError(400, issue?.message === 'Required' ? `${field} is required.` : issue?.message ?? 'Invalid payload.');
    }
    const d = parsed.data;

    const idempotencyKey =
      req.headers.get('idempotency-key') ?? `packing-${d.harvestBatchId}-${d.intakeWeightKg}`;

    const outcome = await withIdempotency(idempotencyKey, async () => {
      const db = await getDb();

      const hb = (await db.execute(sql`
        SELECT hb.id, hb.batch_number, hb.net_transferred_kg, hb.status, hb.crop_id, hb.field_id
        FROM harvest_batches hb WHERE hb.id = ${d.harvestBatchId} LIMIT 1;
      `)) as unknown as {
        rows: Array<{ id: number; batch_number: string; net_transferred_kg: string; status: string; crop_id: number; field_id: number }>;
      };
      const batch = hb.rows[0];
      if (!batch) throw new Error('HARVEST_BATCH_NOT_FOUND');
      if (!['HARVESTED', 'IN_PACKHOUSE'].includes(batch.status)) {
        throw new Error(`HARVEST_ALREADY_PROCESSED:${batch.status}`);
      }
      if (d.intakeWeightKg > Number(batch.net_transferred_kg) + 0.001) {
        throw new Error(
          `INTAKE_EXCEEDS_HARVEST:Intake ${d.intakeWeightKg} kg exceeds the ${batch.net_transferred_kg} kg net transferred from harvest batch ${batch.batch_number}.`
        );
      }

      const product = (await db.execute(sql`
        SELECT id, sku, unit_cost_kes FROM products
        WHERE crop_id = ${batch.crop_id} AND is_active
        ORDER BY (uom_code = 'KG') DESC, id LIMIT 1;
      `)) as unknown as { rows: Array<{ id: number; sku: string; unit_cost_kes: string }> };
      const finished = product.rows[0];
      if (!finished) throw new Error('NO_PRODUCT_FOR_CROP');

      const orderCode = `PO-PH-${Date.now().toString().slice(-8)}`;
      const batchCode = `PB-${Date.now().toString().slice(-8)}`;
      const varianceKg = Math.max(
        0,
        Number((d.gradedAcceptedKg - d.washingLossKg - d.packedOutputKg).toFixed(3))
      );
      const labourCost = d.labourCount * d.hoursPerWorker * d.labourRateKesPerHour;
      const packagingCost = d.packagingProductId
        ? await packagingCostFor(db, d.packagingProductId, d.packagingQtyUsed ?? 0)
        : 0;
      const productionCost = Number((labourCost + packagingCost).toFixed(2));
      const today = new Date().toISOString().slice(0, 10);

      const result = await db.transaction(async (tx) => {
        const order = await tx
          .insert(t.packingOrders)
          .values({
            orderCode,
            harvestBatchId: batch.id,
            cropId: batch.crop_id,
            targetProductId: finished.id,
            intakeWeightKg: d.intakeWeightKg.toFixed(2),
            intakeTempC: d.intakeTempC.toFixed(2),
            gradedAcceptedKg: d.gradedAcceptedKg.toFixed(2),
            gradedRejectedKg: d.gradedRejectedKg.toFixed(2),
            washingLossKg: d.washingLossKg.toFixed(2),
            packedOutputKg: d.packedOutputKg.toFixed(2),
            unaccountedVarianceKg: varianceKg.toFixed(3),
            packFormat: d.packFormat,
            unitsPackedCount: d.unitsPackedCount,
            packagingProductId: d.packagingProductId ?? null,
            packagingQtyUsed: (d.packagingQtyUsed ?? 0).toFixed(2),
            labourCount: d.labourCount,
            shiftCode: d.shiftCode,
            productionCostKes: productionCost.toFixed(2),
            status: 'COMPLETED',
            supervisorUserId: user.id,
          })
          .returning();
        const packingOrderId = order[0].id;

        // Consume the harvest intake lot (traceability: field lot → packed lot)
        const intakeLot = (await tx.execute(sql`
          SELECT id, lot_number, available_qty, unit_cost_kes, warehouse_id
          FROM inventory_lots WHERE harvest_batch_id = ${batch.id} ORDER BY id LIMIT 1 FOR UPDATE;
        `)) as unknown as {
          rows: Array<{ id: number; lot_number: string; available_qty: string; unit_cost_kes: string; warehouse_id: number }>;
        };
        const sourceLot = intakeLot.rows[0];
        let unitCost = Number(finished.unit_cost_kes);
        if (sourceLot) {
          if (Number(sourceLot.available_qty) + 0.001 < d.intakeWeightKg) {
            throw new Error(
              `INSUFFICIENT_INTAKE_LOT:Intake lot ${sourceLot.lot_number} holds ${sourceLot.available_qty} kg but ${d.intakeWeightKg} kg was requested.`
            );
          }
          unitCost = Number(sourceLot.unit_cost_kes) || unitCost;
          await tx.execute(sql`
            UPDATE inventory_lots
            SET physical_qty = (physical_qty::numeric - ${d.intakeWeightKg}::numeric)::text::numeric,
                available_qty = (available_qty::numeric - ${d.intakeWeightKg}::numeric)::text::numeric,
                quality_status = CASE WHEN (available_qty::numeric - ${d.intakeWeightKg}::numeric) <= 0 THEN 'CONSUMED' ELSE quality_status END
            WHERE id = ${sourceLot.id};
          `);
          await tx.insert(t.stockMovements).values({
            movementNumber: `SM-PC-${Date.now().toString().slice(-8)}`,
            idempotencyKey: `${idempotencyKey}-consume`,
            movementType: 'PRODUCTION_CONSUME',
            productId: finished.id,
            lotId: sourceLot.id,
            fromWarehouseId: sourceLot.warehouse_id,
            quantity: d.intakeWeightKg.toFixed(3),
            uomCode: 'KG',
            unitCostKes: unitCost.toFixed(2),
            totalCostKes: (d.intakeWeightKg * unitCost).toFixed(2),
            referenceType: 'PACKING_ORDER',
            referenceId: orderCode,
            reason: `Harvest lot ${sourceLot.lot_number} consumed into packhouse run ${orderCode}`,
            performedByUserId: user.id,
          });
        }

        // Finished-goods lot, held in quarantine until QA releases it
        const finishedLotNumber = `LOT-${batchCode}`;
        const finishedLot = await tx
          .insert(t.inventoryLots)
          .values({
            lotNumber: finishedLotNumber,
            productId: finished.id,
            warehouseId: 1,
            binCode: 'CR1-PACKED',
            physicalQty: d.packedOutputKg.toFixed(3),
            reservedQty: '0.000',
            availableQty: '0.000', // unavailable until QA release
            unitCostKes: unitCost.toFixed(2),
            receivedDate: today,
            expiryDate: null,
            qualityStatus: 'QUARANTINED',
          })
          .returning();
        const finishedLotId = finishedLot[0].id;

        const pb = await tx
          .insert(t.packingBatches)
          .values({
            packingBatchCode: batchCode,
            packingOrderId,
            harvestBatchId: batch.id,
            finishedProductId: finished.id,
            inventoryLotId: finishedLotId,
            grade: 'CLASS_I_EXPORT',
            netWeightKg: d.packedOutputKg.toFixed(2),
            cartonsCount: Math.max(1, Math.round(d.unitsPackedCount / 12)),
            coldRoomTempC: d.intakeTempC.toFixed(2),
            qaStatus: 'PENDING_QA',
            packedDate: today,
            expiryDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
          })
          .returning();

        await tx.insert(t.stockMovements).values({
          movementNumber: `SM-PO-${Date.now().toString().slice(-8)}`,
          idempotencyKey: `${idempotencyKey}-output`,
          movementType: 'PRODUCTION_OUTPUT',
          productId: finished.id,
          lotId: finishedLotId,
          toWarehouseId: 1,
          quantity: d.packedOutputKg.toFixed(3),
          uomCode: 'KG',
          unitCostKes: unitCost.toFixed(2),
          totalCostKes: (d.packedOutputKg * unitCost).toFixed(2),
          referenceType: 'PACKING_BATCH',
          referenceId: batchCode,
          reason: `Packed output from run ${orderCode} (harvest ${batch.batch_number}) — awaiting QA release`,
          performedByUserId: user.id,
        });

        await tx.execute(sql`
          UPDATE harvest_batches SET status = 'PACKED' WHERE id = ${batch.id};
        `);

        return { packingOrderId, packingBatchId: pb[0].id, finishedLotId };
      });

      await recordAuditLog({
        actor: user,
        action: 'PACKING_ORDER_RECORDED',
        module: 'PACKHOUSE',
        entityType: 'PACKING_ORDER',
        entityId: orderCode,
        summary: `Packhouse run ${orderCode} for harvest ${batch.batch_number}: intake ${d.intakeWeightKg} kg @ ${d.intakeTempC}°C, accepted ${d.gradedAcceptedKg} kg, rejected ${d.gradedRejectedKg} kg, washing loss ${d.washingLossKg} kg, packed ${d.packedOutputKg} kg (${d.unitsPackedCount} × ${d.packFormat}), variance ${varianceKg} kg, cost KES ${productionCost}`,
        afterState: { ...d, orderCode, batchCode, varianceKg, productionCost },
        ipAddress: ip,
      });

      return {
        status: 201,
        body: {
          ok: true,
          code: orderCode,
          packingBatch: batchCode,
          finishedLotId: result.finishedLotId,
          varianceKg,
          productionCostKes: productionCost,
          message: `Packhouse run ${orderCode} recorded. Packed batch ${batchCode} is PENDING_QA and its lot is quarantined until QA releases it.`,
        },
      };
    });

    return new Response(JSON.stringify(outcome.body), {
      status: outcome.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'HARVEST_BATCH_NOT_FOUND') return jsonError(404, 'Harvest batch not found.');
    if (msg.startsWith('HARVEST_ALREADY_PROCESSED:')) {
      return jsonError(409, `This harvest batch is already ${msg.split(':')[1].toLowerCase()} and cannot be packed again.`);
    }
    if (msg.startsWith('INTAKE_EXCEEDS_HARVEST:')) return jsonError(409, msg.split(':').slice(1).join(':'));
    if (msg.startsWith('INSUFFICIENT_INTAKE_LOT:')) return jsonError(409, msg.split(':').slice(1).join(':'));
    if (msg === 'NO_PRODUCT_FOR_CROP') {
      return jsonError(409, 'No active finished-goods product is mapped to this crop.');
    }
    console.error('packing POST', e);
    return jsonError(500, 'Failed to record packhouse run.');
  }
}

async function packagingCostFor(
  db: Awaited<ReturnType<typeof getDb>>,
  productId: number,
  qty: number
): Promise<number> {
  const rows = (await db.execute(sql`
    SELECT unit_cost_kes FROM products WHERE id = ${productId} LIMIT 1;
  `)) as unknown as { rows: Array<{ unit_cost_kes: string }> };
  const cost = Number(rows.rows[0]?.unit_cost_kes ?? 0);
  return Number((cost * qty).toFixed(2));
}
