import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import * as t from '@/db/schema';
import { requirePermission, jsonOk, jsonError, clientIp, rateLimit } from '@/lib/guards';
import { recordAuditLog } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  assetId: z.number().int().positive(),
  maintenanceType: z.enum(['PREVENTIVE', 'CORRECTIVE_REPAIR', 'CALIBRATION']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  issueDescription: z.string().min(8, 'Describe the fault or service scope (min 8 characters).').max(1000),
  technicianName: z.string().min(2).max(120),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sparePartProductId: z.number().int().positive().optional(),
  sparePartQtyUsed: z.number().min(0).max(10000).optional(),
});

const completeSchema = z.object({
  workOrderNo: z.string().min(3).max(64),
  labourCostKes: z.number().min(0).max(10_000_000),
  partsCostKes: z.number().min(0).max(10_000_000).default(0),
  downtimeHours: z.number().min(0).max(2000).default(0),
  resolutionNotes: z.string().min(5).max(1000),
  newCondition: z.enum(['EXCELLENT', 'GOOD', 'FAIR', 'NEEDS_REPAIR']).optional(),
  nextServiceDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** POST creates a work order; PATCH completes one (consumes spares, updates the asset). */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'maintenance.manage');
    const ip = clientIp(req);
    rateLimit(`wo:${user.id}`, 30, 60_000);

    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.join('.') ?? 'payload';
      return jsonError(400, issue?.message === 'Required' ? `${field} is required.` : issue?.message ?? 'Invalid payload.');
    }
    const d = parsed.data;
    const db = await getDb();

    const asset = (await db.execute(sql`
      SELECT id, asset_tag, name, condition, location FROM assets WHERE id = ${d.assetId} LIMIT 1;
    `)) as unknown as { rows: Array<{ id: number; asset_tag: string; name: string; condition: string; location: string }> };
    if (!asset.rows[0]) return jsonError(404, 'Asset not found.');

    // Spare part availability check
    if (d.sparePartProductId && (d.sparePartQtyUsed ?? 0) > 0) {
      const stock = (await db.execute(sql`
        SELECT COALESCE(SUM(available_qty),0)::text AS avail FROM inventory_lots
        WHERE product_id = ${d.sparePartProductId} AND quality_status IN ('AVAILABLE','RELEASED');
      `)) as unknown as { rows: Array<{ avail: string }> };
      if (Number(stock.rows[0]?.avail ?? 0) + 0.001 < (d.sparePartQtyUsed ?? 0)) {
        return jsonError(
          409,
          `Only ${stock.rows[0]?.avail ?? 0} spare part units are available — raise a requisition before scheduling this work.`
        );
      }
    }

    const workOrderNo = `WO-${Date.now().toString().slice(-8)}`;
    const inserted = await db
      .insert(t.maintenanceWorkOrders)
      .values({
        workOrderNo,
        assetId: d.assetId,
        maintenanceType: d.maintenanceType,
        priority: d.priority,
        issueDescription: d.issueDescription,
        sparePartProductId: d.sparePartProductId ?? null,
        sparePartQtyUsed: (d.sparePartQtyUsed ?? 0).toFixed(2),
        technicianName: d.technicianName,
        status: 'OPEN',
        scheduledDate: d.scheduledDate,
      })
      .returning();

    await recordAuditLog({
      actor: user,
      action: 'WORK_ORDER_CREATED',
      module: 'MAINTENANCE',
      entityType: 'MAINTENANCE_WORK_ORDER',
      entityId: workOrderNo,
      summary: `Raised ${d.priority} ${d.maintenanceType.replace('_', ' ')} work order ${workOrderNo} on ${asset.rows[0].asset_tag} (${asset.rows[0].name}) for ${d.scheduledDate}: ${d.issueDescription}`,
      afterState: d,
      ipAddress: ip,
    });

    return jsonOk({
      workOrderNo,
      id: inserted[0].id,
      message: `Work order ${workOrderNo} raised against ${asset.rows[0].asset_tag} (${asset.rows[0].name}).`,
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('work order POST', e);
    return jsonError(500, 'Failed to raise work order.');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'maintenance.manage');
    const ip = clientIp(req);
    rateLimit(`wo:${user.id}`, 30, 60_000);

    const body = await req.json().catch(() => null);
    const parsed = completeSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.join('.') ?? 'payload';
      return jsonError(400, issue?.message === 'Required' ? `${field} is required.` : issue?.message ?? 'Invalid payload.');
    }
    const d = parsed.data;
    const db = await getDb();

    const wo = (await db.execute(sql`
      SELECT wo.id, wo.work_order_no, wo.status, wo.asset_id, wo.spare_part_product_id, wo.spare_part_qty_used,
             a.asset_tag, a.name AS asset_name
      FROM maintenance_work_orders wo JOIN assets a ON a.id = wo.asset_id
      WHERE wo.work_order_no = ${d.workOrderNo} LIMIT 1;
    `)) as unknown as {
      rows: Array<{
        id: number; work_order_no: string; status: string; asset_id: number;
        spare_part_product_id: number | null; spare_part_qty_used: string | null;
        asset_tag: string; asset_name: string;
      }>;
    };
    const order = wo.rows[0];
    if (!order) return jsonError(404, 'Work order not found.');
    if (order.status === 'COMPLETED') return jsonError(409, 'This work order is already completed.');
    if (order.status === 'CANCELLED') return jsonError(409, 'This work order was cancelled.');

    await db.transaction(async (tx) => {
      // Consume spare parts from the oldest available lot (FIFO)
      if (order.spare_part_product_id && Number(order.spare_part_qty_used ?? 0) > 0) {
        const qty = Number(order.spare_part_qty_used);
        const lots = (await tx.execute(sql`
          SELECT id, lot_number, available_qty, warehouse_id FROM inventory_lots
          WHERE product_id = ${order.spare_part_product_id}
            AND quality_status IN ('AVAILABLE','RELEASED') AND available_qty > 0
          ORDER BY received_date::date LIMIT 5 FOR UPDATE;
        `)) as unknown as { rows: Array<{ id: number; lot_number: string; available_qty: string; warehouse_id: number }> };

        let remaining = qty;
        for (const lot of lots.rows) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, Number(lot.available_qty));
          await tx.execute(sql`
            UPDATE inventory_lots
            SET physical_qty = (physical_qty::numeric - ${take}::numeric),
                available_qty = (available_qty::numeric - ${take}::numeric)
            WHERE id = ${lot.id};
          `);
          await tx.insert(t.stockMovements).values({
            movementNumber: `SM-WO-${Date.now().toString().slice(-8)}-${lot.id}`,
            idempotencyKey: `wo-${order.work_order_no}-lot-${lot.id}`,
            movementType: 'ISSUE',
            productId: order.spare_part_product_id,
            lotId: lot.id,
            fromWarehouseId: lot.warehouse_id,
            quantity: take.toFixed(3),
            uomCode: 'EACH',
            unitCostKes: '0.00',
            totalCostKes: '0.00',
            referenceType: 'MAINTENANCE_WORK_ORDER',
            referenceId: order.work_order_no,
            reason: `Spare parts consumed on ${order.work_order_no} (${order.asset_tag})`,
            performedByUserId: user.id,
          });
          remaining -= take;
        }
        if (remaining > 0.001) {
          throw new Error(`INSUFFICIENT_SPARES:Only ${qty - remaining} of ${qty} spare units were available.`);
        }
        await tx.execute(sql`
          UPDATE products SET
            physical_stock = GREATEST(physical_stock - ${qty}::numeric, 0),
            available_stock = GREATEST(available_stock - ${qty}::numeric, 0)
          WHERE id = ${order.spare_part_product_id};
        `);
      }

      await tx.execute(sql`
        UPDATE maintenance_work_orders
        SET status = 'COMPLETED', labour_cost_kes = ${d.labourCostKes.toFixed(2)},
            parts_cost_kes = ${d.partsCostKes.toFixed(2)}, downtime_hours = ${d.downtimeHours.toFixed(2)},
            completed_at = now(),
            issue_description = issue_description || ${' | Resolution: ' + d.resolutionNotes}
        WHERE id = ${order.id};
      `);

      await tx.execute(sql`
        UPDATE assets
        SET last_service_date = to_char(CURRENT_DATE, 'YYYY-MM-DD'),
            downtime_hours_total = downtime_hours_total + ${d.downtimeHours}::numeric
            ${d.newCondition ? sql`, condition = ${d.newCondition}` : sql``}
            ${d.nextServiceDueDate ? sql`, next_service_due_date = ${d.nextServiceDueDate}` : sql``}
        WHERE id = ${order.asset_id};
      `);
    });

    await recordAuditLog({
      actor: user,
      action: 'WORK_ORDER_COMPLETED',
      module: 'MAINTENANCE',
      entityType: 'MAINTENANCE_WORK_ORDER',
      entityId: order.work_order_no,
      summary: `Completed ${order.work_order_no} on ${order.asset_tag} (${order.asset_name}): labour ${d.labourCostKes} KES, parts ${d.partsCostKes} KES, downtime ${d.downtimeHours} h${d.newCondition ? `, condition now ${d.newCondition}` : ''} — ${d.resolutionNotes}`,
      afterState: d,
      ipAddress: ip,
    });

    return jsonOk({ message: `Work order ${order.work_order_no} completed and asset record updated.` });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    const msg = e instanceof Error ? e.message : '';
    if (msg.startsWith('INSUFFICIENT_SPARES:')) return jsonError(409, msg.split(':').slice(1).join(':'));
    console.error('work order PATCH', e);
    return jsonError(500, 'Failed to complete work order.');
  }
}
