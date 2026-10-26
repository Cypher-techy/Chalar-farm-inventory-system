import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import * as t from '@/db/schema';
import { ApiError, requirePermission, jsonOk, jsonError, clientIp, rateLimit } from '@/lib/guards';
import { recordAuditLog } from '@/lib/auth';
import { createNotification } from '@/lib/chat';

export const dynamic = 'force-dynamic';

const dispatchSchema = z.object({
  salesOrderNumber: z.string().min(3).max(64),
  vehicleId: z.number().int().positive(),
  packingBatchCode: z.string().min(3).max(64).optional(),
  originLocation: z.string().min(2).max(120).default('Chalar Farms Packhouse, Taveta'),
  destinationLocation: z.string().min(2).max(120).default('JKIA Nairobi — Airfreight Terminal'),
  dispatchedKg: z.number().positive().max(100000),
  cartonsCount: z.number().int().min(1).max(20000),
  departureTempC: z.number().min(-10).max(30),
  transportCostKes: z.number().min(0).max(10_000_000),
  airWaybillNo: z.string().max(64).optional(),
  airlineName: z.string().max(120).optional(),
});

/**
 * Dispatches a shipment. Enforces cold-chain preconditions (vehicle reefer range
 * must cover the required temperature, order must be packed, QA batch passed),
 * consumes the allocated finished lot and moves the order to DISPATCHED.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'logistics.manage');
    const ip = clientIp(req);
    rateLimit(`dispatch:${user.id}`, 20, 60_000);

    const body = await req.json().catch(() => null);
    const parsed = dispatchSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.join('.') ?? 'payload';
      return jsonError(400, issue?.message === 'Required' ? `${field} is required.` : issue?.message ?? 'Invalid payload.');
    }
    const d = parsed.data;
    const db = await getDb();

    const orderRows = (await db.execute(sql`
      SELECT so.id, so.order_number, so.status, so.ordered_kg, so.allocated_kg, so.product_id,
             so.packing_batch_id, c.name AS customer, c.cold_chain_spec_c AS spec
      FROM sales_orders so JOIN customers c ON c.id = so.customer_id
      WHERE so.order_number = ${d.salesOrderNumber} LIMIT 1;
    `)) as unknown as {
      rows: Array<{
        id: number; order_number: string; status: string; ordered_kg: string; allocated_kg: string;
        product_id: number; packing_batch_id: number | null; customer: string; spec: string;
      }>;
    };
    const order = orderRows.rows[0];
    if (!order) return jsonError(404, 'Sales order not found.');
    if (!['PACKED', 'STOCK_RESERVED', 'APPROVED'].includes(order.status)) {
      return jsonError(409, `Order ${order.order_number} is ${order.status} — it must be packed before dispatch.`);
    }
    if (d.dispatchedKg > Number(order.allocated_kg || order.ordered_kg) + 0.001) {
      return jsonError(
        409,
        `Dispatch of ${d.dispatchedKg} kg exceeds the ${order.allocated_kg || order.ordered_kg} kg allocated/ordered on ${order.order_number}.`
      );
    }

    // Cold-chain compatibility: spec like "2-4" or "8-10"
    const specMatch = /(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)/.exec(order.spec ?? '');
    if (specMatch) {
      const minSpec = Number(specMatch[1]);
      const maxSpec = Number(specMatch[2]);
      if (d.departureTempC < minSpec - 1 || d.departureTempC > maxSpec + 1) {
        return jsonError(
          409,
          `Cold-chain breach prevented: ${order.customer} requires ${order.spec}°C but the load departs at ${d.departureTempC}°C.`
        );
      }
    }

    const vehicleRows = (await db.execute(sql`
      SELECT id, registration_number, status, reefer_temp_min_c, reefer_temp_max_c, driver_name
      FROM vehicles WHERE id = ${d.vehicleId} LIMIT 1 FOR UPDATE;
    `)) as unknown as {
      rows: Array<{
        id: number; registration_number: string; status: string;
        reefer_temp_min_c: string; reefer_temp_max_c: string | null; driver_name: string;
      }>;
    };
    const vehicle = vehicleRows.rows[0];
    if (!vehicle) return jsonError(404, 'Vehicle not found.');
    if (vehicle.status === 'MAINTENANCE') {
      return jsonError(409, `${vehicle.registration_number} is under maintenance and cannot be dispatched.`);
    }
    const reeferMax = Number(vehicle.reefer_temp_max_c ?? 99);
    const reeferMin = Number(vehicle.reefer_temp_min_c ?? -99);
    if (d.departureTempC < reeferMin || d.departureTempC > reeferMax) {
      return jsonError(
        409,
        `${vehicle.registration_number} reefer range is ${reeferMin}°C to ${reeferMax}°C — cannot hold ${d.departureTempC}°C.`
      );
    }

    // Resolve the QA-passed finished lot to consume
    let lotId: number | null = null;
    let lotNumber = '';
    const lotRows = (await db.execute(sql`
      SELECT l.id, l.lot_number, l.available_qty, l.physical_qty, l.quality_status, l.warehouse_id
      FROM inventory_lots l
      ${d.packingBatchCode
        ? sql`JOIN packing_batches pb ON pb.inventory_lot_id = l.id AND pb.packing_batch_code = ${d.packingBatchCode}`
        : order.packing_batch_id
          ? sql`JOIN packing_batches pb ON pb.inventory_lot_id = l.id AND pb.id = ${order.packing_batch_id}`
          : sql``}
      WHERE ${d.packingBatchCode || order.packing_batch_id ? sql`TRUE` : sql`l.product_id = ${order.product_id}`}
        AND l.quality_status IN ('RELEASED','AVAILABLE')
      ORDER BY l.received_date::date
      LIMIT 1 FOR UPDATE;
    `)) as unknown as {
      rows: Array<{ id: number; lot_number: string; available_qty: string; physical_qty: string; quality_status: string; warehouse_id: number }>;
    };
    const lot = lotRows.rows[0];
    if (lot) {
      if (Number(lot.physical_qty) + 0.001 < d.dispatchedKg) {
        return jsonError(
          409,
          `Lot ${lot.lot_number} holds ${lot.physical_qty} kg but ${d.dispatchedKg} kg is being dispatched.`
        );
      }
      lotId = lot.id;
      lotNumber = lot.lot_number;
    }

    const shipmentCode = `SHP-${Date.now().toString().slice(-8)}`;

    const result = await db.transaction(async (tx) => {
      const shipment = await tx
        .insert(t.shipments)
        .values({
          shipmentCode,
          salesOrderId: order.id,
          vehicleId: vehicle.id,
          packingBatchId: order.packing_batch_id,
          originLocation: d.originLocation,
          destinationLocation: d.destinationLocation,
          airWaybillNo: d.airWaybillNo ?? null,
          airlineName: d.airlineName ?? null,
          dispatchedKg: d.dispatchedKg.toFixed(2),
          cartonsCount: d.cartonsCount,
          departureTempC: d.departureTempC.toFixed(2),
          transportCostKes: d.transportCostKes.toFixed(2),
          dispatchStatus: 'IN_TRANSIT_TO_JKIA',
          dispatchedByUserId: user.id,
          dispatchedAt: new Date(),
        })
        .returning();

      await tx.execute(sql`
        UPDATE vehicles SET status = 'IN_TRANSIT', current_route = ${'Taveta → JKIA (' + shipmentCode + ')'}
        WHERE id = ${vehicle.id};
      `);
      await tx.execute(sql`
        UPDATE sales_orders SET status = 'DISPATCHED', dispatched_kg = ${d.dispatchedKg.toFixed(2)}
        WHERE id = ${order.id};
      `);

      if (lotId) {
        await tx.execute(sql`
          UPDATE inventory_lots
          SET physical_qty = (physical_qty::numeric - ${d.dispatchedKg}::numeric),
              available_qty = GREATEST(available_qty::numeric - ${d.dispatchedKg}::numeric, 0)
          WHERE id = ${lotId};
        `);
        await tx.execute(sql`
          UPDATE products SET
            physical_stock = GREATEST(physical_stock - ${d.dispatchedKg}::numeric, 0),
            available_stock = GREATEST(available_stock - ${d.dispatchedKg}::numeric, 0)
          WHERE id = ${order.product_id};
        `);
        await tx.insert(t.stockMovements).values({
          movementNumber: `SM-DSP-${Date.now().toString().slice(-8)}`,
          idempotencyKey: `dispatch-${shipmentCode}`,
          movementType: 'ISSUE',
          productId: order.product_id,
          lotId,
          fromWarehouseId: lot.warehouse_id,
          quantity: d.dispatchedKg.toFixed(3),
          uomCode: 'KG',
          unitCostKes: '0.00',
          totalCostKes: '0.00',
          referenceType: 'SHIPMENT',
          referenceId: shipmentCode,
          reason: `Dispatched to ${order.customer} on ${vehicle.registration_number} (AWB ${d.airWaybillNo ?? 'pending'})`,
          performedByUserId: user.id,
        });
      }

      return { shipmentId: shipment[0].id };
    });

    await recordAuditLog({
      actor: user,
      action: 'SHIPMENT_DISPATCHED',
      module: 'LOGISTICS',
      entityType: 'SHIPMENT',
      entityId: shipmentCode,
      summary: `Dispatched ${shipmentCode}: ${d.dispatchedKg} kg / ${d.cartonsCount} cartons for ${order.customer} on ${vehicle.registration_number} (driver ${vehicle.driver_name}), departure ${d.departureTempC}°C${lotNumber ? `, consumed lot ${lotNumber}` : ''}, cost ${d.transportCostKes} KES`,
      afterState: d,
      ipAddress: ip,
    });

    await createNotification({
      userId: 1,
      category: 'LOGISTICS',
      title: 'Shipment dispatched',
      summary: `${shipmentCode} — ${d.dispatchedKg} kg for ${order.customer}.`,
      linkUrl: '/portal/logistics',
    });

    return jsonOk({
      shipmentCode,
      shipmentId: result.shipmentId,
      message: `Shipment ${shipmentCode} dispatched for ${order.customer}; ${vehicle.registration_number} is now in transit${lotNumber ? ` and lot ${lotNumber} was consumed` : ''}.`,
    });
  } catch (e) {
    if (e instanceof ApiError) return jsonError(e.status, e.message);
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('dispatch POST', e);
    return jsonError(500, 'Failed to dispatch shipment.');
  }
}
