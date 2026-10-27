import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import * as t from '@/db/schema';
import { ApiError, requirePermission, jsonOk, jsonError, clientIp, rateLimit, withIdempotency } from '@/lib/guards';
import { recordAuditLog } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const schema = z.object({
  purchaseOrderId: z.number().int().positive(),
  warehouseId: z.number().int().positive(),
  receivedQty: z.number().positive().max(1_000_000),
  rejectedQty: z.number().min(0).max(1_000_000).default(0),
  deliveryNoteRef: z.string().min(2).max(64),
  inspectionNotes: z.string().max(1000).optional(),
  binCode: z.string().max(32).default('GRN-STAGE'),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * Goods receipt against an approved purchase order.
 * Enforces: PO must be open, product/quantity must not exceed the outstanding
 * order quantity, accepted stock creates a lot and a RECEIPT movement, rejected
 * quantities are recorded but never enter stock.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'inventory.create');
    const ip = clientIp(req);
    rateLimit(`grn:${user.id}`, 30, 60_000);

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.join('.') ?? 'payload';
      return jsonError(400, issue?.message === 'Required' ? `${field} is required.` : issue?.message ?? 'Invalid payload.');
    }
    const d = parsed.data;
    if (d.rejectedQty >= d.receivedQty) {
      return jsonError(400, 'Rejected quantity must be less than received quantity.');
    }

    const idempotencyKey =
      req.headers.get('idempotency-key') ?? `grn-${d.purchaseOrderId}-${d.deliveryNoteRef}`;

    const outcome = await withIdempotency(idempotencyKey, async () => {
      const db = await getDb();

      const po = (await db.execute(sql`
        SELECT po.id, po.po_number, po.status, po.ordered_qty, po.received_qty, po.unit_price_kes,
               po.product_id, po.supplier_id, p.sku, p.name AS product_name, p.uom_code
        FROM purchase_orders po JOIN products p ON p.id = po.product_id
        WHERE po.id = ${d.purchaseOrderId} LIMIT 1;
      `)) as unknown as {
        rows: Array<{
          id: number; po_number: string; status: string; ordered_qty: string; received_qty: string;
          unit_price_kes: string; product_id: number; supplier_id: number; sku: string;
          product_name: string; uom_code: string;
        }>;
      };
      const order = po.rows[0];
      if (!order) throw new Error('PO_NOT_FOUND');
      if (!['APPROVED', 'ISSUED', 'PARTIALLY_RECEIVED'].includes(order.status)) {
        throw new Error(`PO_NOT_OPEN:${order.status}`);
      }

      const outstanding = Number(order.ordered_qty) - Number(order.received_qty);
      if (d.receivedQty > outstanding + 0.001) {
        throw new Error(
          `OVER_RECEIPT:Receipt of ${d.receivedQty} exceeds the outstanding order quantity of ${outstanding.toFixed(2)} ${order.uom_code} on ${order.po_number}.`
        );
      }

      const acceptedQty = Number((d.receivedQty - d.rejectedQty).toFixed(3));
      const grnNumber = `GRN-${Date.now().toString().slice(-8)}`;
      const lotNumber = `LOT-${grnNumber}`;
      const today = new Date().toISOString().slice(0, 10);
      const lineValue = Number((acceptedQty * Number(order.unit_price_kes)).toFixed(2));

      const result = await db.transaction(async (tx) => {
        const lot = await tx
          .insert(t.inventoryLots)
          .values({
            lotNumber,
            productId: order.product_id,
            warehouseId: d.warehouseId,
            binCode: d.binCode,
            supplierId: order.supplier_id,
            physicalQty: acceptedQty.toFixed(3),
            reservedQty: '0.000',
            availableQty: acceptedQty.toFixed(3),
            unitCostKes: Number(order.unit_price_kes).toFixed(2),
            receivedDate: today,
            expiryDate: d.expiryDate ?? null,
            qualityStatus: 'AVAILABLE',
          })
          .returning();
        const lotId = lot[0].id;

        const grn = await tx
          .insert(t.goodsReceipts)
          .values({
            grnNumber,
            purchaseOrderId: order.id,
            supplierId: order.supplier_id,
            productId: order.product_id,
            warehouseId: d.warehouseId,
            lotCreatedId: lotId,
            receivedQty: d.receivedQty.toFixed(2),
            acceptedQty: acceptedQty.toFixed(2),
            rejectedQty: d.rejectedQty.toFixed(2),
            deliveryNoteRef: d.deliveryNoteRef,
            inspectionNotes: d.inspectionNotes ?? null,
            receivedByUserId: user.id,
          })
          .returning();

        await tx.insert(t.stockMovements).values({
          movementNumber: `SM-GRN-${Date.now().toString().slice(-8)}`,
          idempotencyKey: `${idempotencyKey}-receipt`,
          movementType: 'RECEIPT',
          productId: order.product_id,
          lotId,
          toWarehouseId: d.warehouseId,
          quantity: acceptedQty.toFixed(3),
          uomCode: order.uom_code,
          unitCostKes: Number(order.unit_price_kes).toFixed(2),
          totalCostKes: lineValue.toFixed(2),
          referenceType: 'GOODS_RECEIPT',
          referenceId: grnNumber,
          reason: `Goods received against ${order.po_number} (delivery note ${d.deliveryNoteRef}); ${d.rejectedQty} rejected at intake`,
          performedByUserId: user.id,
        });

        const newReceived = Number(order.received_qty) + acceptedQty;
        const newStatus =
          newReceived + 0.001 >= Number(order.ordered_qty) ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
        await tx.execute(sql`
          UPDATE purchase_orders SET received_qty = ${newReceived.toFixed(2)}, status = ${newStatus}
          WHERE id = ${order.id};
        `);
        await tx.execute(sql`
          UPDATE products SET
            physical_stock = physical_stock + ${acceptedQty}::numeric,
            available_stock = available_stock + ${acceptedQty}::numeric
          WHERE id = ${order.product_id};
        `);

        return { grnId: grn[0].id, grnNumber, lotNumber, acceptedQty, lineValue, newStatus };
      });

      await recordAuditLog({
        actor: user,
        action: 'GOODS_RECEIPT_POSTED',
        module: 'PROCUREMENT',
        entityType: 'GOODS_RECEIPT',
        entityId: result.grnNumber,
        summary: `GRN ${result.grnNumber} against ${order.po_number}: received ${d.receivedQty}, rejected ${d.rejectedQty}, accepted ${result.acceptedQty} ${order.uom_code} of ${order.product_name} into lot ${result.lotNumber} (value ${result.lineValue} KES); PO now ${result.newStatus}`,
        afterState: d,
        ipAddress: ip,
      });

      return {
        status: 201,
        body: {
          ok: true,
          ...result,
          message: `Goods receipt ${result.grnNumber} posted — ${result.acceptedQty} ${order.uom_code} accepted into lot ${result.lotNumber}; ${d.rejectedQty} rejected. PO ${order.po_number} is now ${result.newStatus}.`,
        },
      };
    });

    return new Response(JSON.stringify(outcome.body), {
      status: outcome.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    if (e instanceof ApiError) return jsonError(e.status, e.message);
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'PO_NOT_FOUND') return jsonError(404, 'Purchase order not found.');
    if (msg.startsWith('PO_NOT_OPEN:')) {
      return jsonError(409, `Purchase order is ${msg.split(':')[1].toLowerCase()} — goods cannot be received against it.`);
    }
    if (msg.startsWith('OVER_RECEIPT:')) return jsonError(409, msg.split(':').slice(1).join(':'));
    console.error('grn POST', e);
    return jsonError(500, 'Failed to post goods receipt.');
  }
}
