import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import * as t from '@/db/schema';
import { requirePermission, jsonOk, jsonError, clientIp, rateLimit } from '@/lib/guards';
import { recordAuditLog } from '@/lib/auth';
import { createNotification } from '@/lib/chat';

export const dynamic = 'force-dynamic';

const schema = z.object({
  packingBatchCode: z.string().min(3).max(64).optional(),
  inventoryLotId: z.number().int().positive().optional(),
  decision: z.enum(['RELEASE', 'HOLD', 'DESTROY']),
  reason: z.string().min(5).max(500),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * Release authority for quarantined stock.
 * Segregation of duties: the inspector who recorded the latest inspection on the
 * batch cannot also be the person releasing it.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'qa.release');
    const ip = clientIp(req);
    rateLimit(`qa-release:${user.id}`, 20, 60_000);

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return jsonError(400, issue?.message === 'Required' ? 'All fields are required.' : issue?.message ?? 'Invalid payload.');
    }
    const d = parsed.data;
    if (!d.packingBatchCode && !d.inventoryLotId) {
      return jsonError(400, 'Provide a packing batch code or an inventory lot id.');
    }

    const db = await getDb();

    const target = (await db.execute(sql`
      SELECT pb.id AS "packingBatchId", pb.packing_batch_code AS "batchCode", pb.qa_status AS "batchStatus",
             l.id AS "lotId", l.lot_number AS "lotNumber", l.physical_qty AS "lotQty",
             l.quality_status AS "lotStatus", p.name AS product
      FROM packing_batches pb
      JOIN inventory_lots l ON l.id = pb.inventory_lot_id
      JOIN products p ON p.id = l.product_id
      WHERE pb.packing_batch_code = ${d.packingBatchCode ?? ''}
      LIMIT 1;
    `)) as unknown as {
      rows: Array<{
        packingBatchId: number;
        batchCode: string;
        batchStatus: string;
        lotId: number;
        lotNumber: string;
        lotQty: string;
        lotStatus: string;
        product: string;
      }>;
    };

    let lotId = target.rows[0]?.lotId;
    let lotNumber = target.rows[0]?.lotNumber ?? '';
    let product = target.rows[0]?.product ?? '';
    if (!lotId && d.inventoryLotId) {
      const lotRows = (await db.execute(sql`
        SELECT l.id AS "lotId", l.lot_number AS "lotNumber", p.name AS product
        FROM inventory_lots l JOIN products p ON p.id = l.product_id
        WHERE l.id = ${d.inventoryLotId} LIMIT 1;
      `)) as unknown as { rows: Array<{ lotId: number; lotNumber: string; product: string }> };
      lotId = lotRows.rows[0]?.lotId;
      lotNumber = lotRows.rows[0]?.lotNumber ?? '';
      product = lotRows.rows[0]?.product ?? '';
    }
    if (!lotId) return jsonError(404, 'Packing batch or inventory lot not found.');

    // Segregation of duties: releaser must differ from the last inspector
    const lastInspection = (await db.execute(sql`
      SELECT inspection_code, result, inspector_user_id
      FROM quality_inspections
      WHERE (packing_batch_id = ${target.rows[0]?.packingBatchId ?? 0} OR inventory_lot_id = ${lotId})
      ORDER BY inspected_at DESC
      LIMIT 1;
    `)) as unknown as {
      rows: Array<{ inspection_code: string; result: string; inspector_user_id: number | null }>;
    };
    const inspector = lastInspection.rows[0];
    if (inspector?.inspector_user_id === user.id) {
      return jsonError(
        403,
        `Segregation of duties: you recorded inspection ${inspector.inspection_code} on this batch, so a different QA officer with release authority must make the release decision.`
      );
    }
    if (d.decision === 'RELEASE' && inspector?.result === 'FAIL_QUARANTINE') {
      return jsonError(
        409,
        `Inspection ${inspector.inspection_code} failed with a quarantine decision. Close the non-conformity (CAPA verified) before releasing this stock.`
      );
    }

    await db.transaction(async (tx) => {
      if (d.decision === 'RELEASE') {
        await tx.execute(sql`
          UPDATE inventory_lots
          SET quality_status = 'RELEASED',
              available_qty = physical_qty${d.expiryDate ? sql`, expiry_date = ${d.expiryDate}` : sql``}
          WHERE id = ${lotId};
        `);
        if (target.rows[0]) {
          await tx.execute(sql`
            UPDATE packing_batches SET qa_status = 'PASSED' WHERE id = ${target.rows[0].packingBatchId};
          `);
        }
        await tx.execute(sql`
          UPDATE quality_inspections
          SET quarantine_status = 'RELEASED', released_by_user_id = ${user.id}, released_at = now()
          WHERE id = ${inspector ? sql`(SELECT id FROM quality_inspections WHERE inspection_code = ${inspector.inspection_code})` : 0};
        `);
      } else if (d.decision === 'HOLD') {
        await tx.execute(sql`
          UPDATE inventory_lots SET quality_status = 'BLOCKED', available_qty = '0.000' WHERE id = ${lotId};
        `);
      } else {
        await tx.execute(sql`
          UPDATE inventory_lots SET quality_status = 'EXPIRED', available_qty = '0.000' WHERE id = ${lotId};
        `);
        const lotInfo = (await tx.execute(sql`
          SELECT product_id, warehouse_id, physical_qty, unit_cost_kes
          FROM inventory_lots WHERE id = ${lotId} LIMIT 1;
        `)) as unknown as {
          rows: Array<{ product_id: number; warehouse_id: number; physical_qty: string; unit_cost_kes: string }>;
        };
        const info = lotInfo.rows[0];
        if (info) {
          await tx.insert(t.stockMovements).values({
            movementNumber: `SM-DEST-${Date.now().toString().slice(-8)}`,
            idempotencyKey: `destroy-${lotId}-${Date.now()}`,
            movementType: 'ADJUSTMENT',
            productId: info.product_id,
            lotId,
            fromWarehouseId: info.warehouse_id,
            quantity: info.physical_qty,
            uomCode: 'KG',
            unitCostKes: info.unit_cost_kes,
            totalCostKes: (Number(info.physical_qty) * Number(info.unit_cost_kes)).toFixed(2),
            referenceType: 'QA_DESTRUCTION',
            referenceId: lotNumber,
            reason: `QA destruction decision: ${d.reason}`,
            performedByUserId: user.id,
            approvedByUserId: user.id,
          });
          await tx.execute(sql`
            UPDATE inventory_lots SET physical_qty = '0.000' WHERE id = ${lotId};
          `);
        }
      }
    });

    await recordAuditLog({
      actor: user,
      action: `QA_${d.decision}`,
      module: 'QUALITY',
      entityType: 'INVENTORY_LOT',
      entityId: lotNumber,
      summary: `${d.decision} decision on lot ${lotNumber} (${product})${target.rows[0] ? ` for packing batch ${target.rows[0].batchCode}` : ''} — ${d.reason}`,
      afterState: d,
      ipAddress: ip,
    });

    if (target.rows[0]) {
      await createNotification({
        userId: 1,
        category: 'QUALITY',
        title: `QA ${d.decision.toLowerCase()} recorded`,
        summary: `Lot ${lotNumber} (${product}) — ${d.decision} by ${user.fullName}.`,
        linkUrl: '/portal/qa',
      });
    }

    return jsonOk({
      message: `Lot ${lotNumber} marked ${d.decision}.`,
      lotNumber,
      decision: d.decision,
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('qa release POST', e);
    return jsonError(500, 'Failed to process QA release decision.');
  }
}
