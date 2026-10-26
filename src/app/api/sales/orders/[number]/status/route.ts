import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { ApiError, requirePermission, jsonOk, jsonError, clientIp, rateLimit } from '@/lib/guards';
import { recordAuditLog } from '@/lib/auth';
import { createNotification } from '@/lib/chat';

export const dynamic = 'force-dynamic';

const schema = z.object({
  status: z.enum(['APPROVED', 'STOCK_RESERVED', 'PACKED', 'DISPATCHED', 'DELIVERED', 'INVOICED', 'PAID', 'CANCELLED']),
  allocatedKg: z.number().min(0).max(1_000_000).optional(),
  packingBatchCode: z.string().min(3).max(64).optional(),
  reason: z.string().min(3).max(500).optional(),
});

const ALLOWED: Record<string, string[]> = {
  DRAFT: ['APPROVED', 'CANCELLED'],
  APPROVED: ['STOCK_RESERVED', 'CANCELLED'],
  STOCK_RESERVED: ['PACKED', 'CANCELLED'],
  PACKED: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['INVOICED'],
  INVOICED: ['PAID'],
};

/**
 * Sales order state machine. Transitions are validated server-side, allocation
 * must not exceed ordered quantity, packing must reference a QA-passed batch,
 * and approval requires the sales.approve permission (separate from manage).
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ number: string }> }) {
  try {
    const user = await requirePermission(req, 'sales.manage');
    const ip = clientIp(req);
    rateLimit(`sales:${user.id}`, 40, 60_000);

    const { number } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? 'Invalid payload.');
    const d = parsed.data;

    const db = await getDb();
    const rows = (await db.execute(sql`
      SELECT so.id, so.order_number, so.status, so.ordered_kg, so.allocated_kg, so.dispatched_kg,
             so.customer_id, so.product_id, so.packing_batch_id, c.name AS customer
      FROM sales_orders so JOIN customers c ON c.id = so.customer_id
      WHERE so.order_number = ${number} LIMIT 1;
    `)) as unknown as {
      rows: Array<{
        id: number; order_number: string; status: string; ordered_kg: string; allocated_kg: string;
        dispatched_kg: string; customer_id: number; product_id: number; packing_batch_id: number | null;
        customer: string;
      }>;
    };
    const order = rows.rows[0];
    if (!order) return jsonError(404, 'Sales order not found.');

    const allowed = ALLOWED[order.status] ?? [];
    if (!allowed.includes(d.status)) {
      return jsonError(
        409,
        `Invalid transition: an order in ${order.status} cannot move to ${d.status}. Allowed next states: ${allowed.join(', ') || 'none'}.`
      );
    }

    // Approval of an export order needs the separate approve permission
    if (d.status === 'APPROVED' && order.status === 'DRAFT') {
      const { hasPermission } = await import('@/lib/auth');
      if (!hasPermission(user, 'sales.approve')) {
        return jsonError(403, 'Approving export sales orders requires the sales approval permission.');
      }
    }

    // Stock allocation checks
    let allocatedKg = Number(order.allocated_kg);
    if (typeof d.allocatedKg === 'number') {
      if (d.allocatedKg > Number(order.ordered_kg) + 0.001) {
        return jsonError(409, `Allocation of ${d.allocatedKg} kg exceeds the ordered ${order.ordered_kg} kg.`);
      }
      const available = (await db.execute(sql`
        SELECT COALESCE(SUM(available_qty),0)::text AS avail
        FROM inventory_lots
        WHERE product_id = ${order.product_id} AND quality_status IN ('RELEASED','AVAILABLE')
          AND (expiry_date IS NULL OR expiry_date::date >= CURRENT_DATE);
      `)) as unknown as { rows: Array<{ avail: string }> };
      const avail = Number(available.rows[0]?.avail ?? 0);
      if (d.allocatedKg > avail + 0.001) {
        return jsonError(
          409,
          `Insufficient QA-released stock to allocate ${d.allocatedKg} kg — only ${avail.toFixed(2)} kg is released and unexpired.`
        );
      }
      allocatedKg = d.allocatedKg;
    }

    // Packing must reference a QA-passed batch
    let packingBatchId = order.packing_batch_id;
    if (d.status === 'PACKED') {
      if (!d.packingBatchCode) {
        return jsonError(400, 'Packing an order requires the packing batch code that fulfilled it.');
      }
      const pb = (await db.execute(sql`
        SELECT id, qa_status, net_weight_kg, product_ok FROM (
          SELECT pb.id, pb.qa_status, pb.net_weight_kg, (pb.finished_product_id = ${order.product_id}) AS product_ok
          FROM packing_batches pb WHERE pb.packing_batch_code = ${d.packingBatchCode}
        ) x LIMIT 1;
      `)) as unknown as { rows: Array<{ id: number; qa_status: string; net_weight_kg: string; product_ok: boolean }> };
      const batch = pb.rows[0];
      if (!batch) return jsonError(404, `Packing batch ${d.packingBatchCode} not found.`);
      if (!batch.product_ok) {
        return jsonError(409, 'That packing batch contains a different product than this order line.');
      }
      if (batch.qa_status !== 'PASSED') {
        return jsonError(
          409,
          `Packing batch ${d.packingBatchCode} has QA status ${batch.qa_status} — only QA-passed batches may be allocated to export orders.`
        );
      }
      if (Number(batch.net_weight_kg) + 0.001 < allocatedKg) {
        return jsonError(
          409,
          `Packing batch holds ${batch.net_weight_kg} kg but ${allocatedKg} kg is allocated to this order.`
        );
      }
      packingBatchId = batch.id;
    }

    const dispatchedKg = d.status === 'DISPATCHED' ? allocatedKg : Number(order.dispatched_kg);

    await db.execute(sql`
      UPDATE sales_orders
      SET status = ${d.status},
          allocated_kg = ${allocatedKg.toFixed(2)},
          dispatched_kg = ${dispatchedKg.toFixed(2)},
          packing_batch_id = ${packingBatchId},
          approved_by_user_id = CASE WHEN ${d.status} = 'APPROVED' THEN ${user.id} ELSE approved_by_user_id END,
          payment_status = CASE WHEN ${d.status} = 'PAID' THEN 'PAID' ELSE payment_status END
      WHERE id = ${order.id};
    `);

    // Cancellations must release any allocation
    if (d.status === 'CANCELLED' && allocatedKg > 0) {
      await db.execute(sql`
        UPDATE sales_orders SET allocated_kg = '0.00', dispatched_kg = '0.00' WHERE id = ${order.id};
      `);
    }

    await recordAuditLog({
      actor: user,
      action: `SALES_ORDER_${d.status}`,
      module: 'SALES',
      entityType: 'SALES_ORDER',
      entityId: order.order_number,
      summary: `Order ${order.order_number} (${order.customer}) moved ${order.status} → ${d.status}${typeof d.allocatedKg === 'number' ? `, allocation ${d.allocatedKg} kg` : ''}${d.packingBatchCode ? `, packing batch ${d.packingBatchCode}` : ''}${d.reason ? ` — ${d.reason}` : ''}`,
      beforeState: { status: order.status, allocated_kg: order.allocated_kg },
      afterState: { status: d.status, allocated_kg: allocatedKg, packing_batch_id: packingBatchId },
      ipAddress: ip,
    });

    if (d.status === 'CANCELLED') {
      await createNotification({
        userId: 1,
        category: 'SALES',
        title: 'Sales order cancelled',
        summary: `${order.order_number} for ${order.customer} was cancelled by ${user.fullName}.`,
        linkUrl: '/portal/sales',
      });
    }

    return jsonOk({
      message: `Order ${order.order_number} is now ${d.status}.`,
      orderNumber: order.order_number,
      status: d.status,
      allocatedKg,
    });
  } catch (e) {
    if (e instanceof ApiError) return jsonError(e.status, e.message);
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('sales status PATCH', e);
    return jsonError(500, 'Failed to update sales order.');
  }
}
