import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import * as t from '@/db/schema';
import { ApiError, requirePermission, jsonOk, jsonError, clientIp, rateLimit } from '@/lib/guards';
import { recordAuditLog } from '@/lib/auth';
import { createNotification } from '@/lib/chat';

export const dynamic = 'force-dynamic';

const schema = z.object({
  departmentId: z.number().int().positive(),
  productId: z.number().int().positive(),
  quantity: z.number().positive().max(1_000_000),
  estimatedUnitCostKes: z.number().min(0).max(10_000_000),
  justification: z.string().min(10, 'Provide a justification of at least 10 characters.').max(1000),
  requiredByDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * Raises a purchase requisition. The approval route is derived from the value:
 * larger commitments escalate to Finance, smaller ones stay with the Executive.
 * The submitter can never be the approver (enforced at decision time).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'procurement.create');
    const ip = clientIp(req);
    rateLimit(`requisition:${user.id}`, 20, 60_000);

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.join('.') ?? 'payload';
      return jsonError(400, issue?.message === 'Required' ? `${field} is required.` : issue?.message ?? 'Invalid payload.');
    }
    const d = parsed.data;
    const db = await getDb();

    const product = (await db.execute(sql`
      SELECT id, sku, name, uom_code, physical_stock, reorder_level FROM products WHERE id = ${d.productId} AND is_active LIMIT 1;
    `)) as unknown as { rows: Array<{ id: number; sku: string; name: string; uom_code: string; physical_stock: string; reorder_level: string }> };
    if (!product.rows[0]) return jsonError(404, 'Product not found or inactive.');

    const dept = (await db.execute(sql`
      SELECT id, name FROM departments WHERE id = ${d.departmentId} LIMIT 1;
    `)) as unknown as { rows: Array<{ id: number; name: string }> };
    if (!dept.rows[0]) return jsonError(404, 'Department not found.');

    const totalKes = Number((d.quantity * d.estimatedUnitCostKes).toFixed(2));
    const reqNumber = `PR-${Date.now().toString().slice(-8)}`;
    const assignedRole = totalKes >= 250000 ? 'FINANCE_MANAGER' : 'EXECUTIVE_MANAGER';

    const requisitionId = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(t.purchaseRequisitions)
        .values({
          reqNumber,
          departmentId: d.departmentId,
          productId: d.productId,
          quantity: d.quantity.toFixed(2),
          estimatedUnitCostKes: d.estimatedUnitCostKes.toFixed(2),
          totalEstimatedKes: totalKes.toFixed(2),
          justification: d.justification + (d.requiredByDate ? ` (required by ${d.requiredByDate})` : ''),
          status: 'PENDING_APPROVAL',
          requestedByUserId: user.id,
        })
        .returning();
      const newId = inserted[0].id;

      await tx.insert(t.approvalRequests).values({
        requestCode: `APR-PR-${reqNumber}`,
        module: 'PROCUREMENT',
        entityType: 'PURCHASE_REQUISITION',
        entityId: newId,
        title: `${product.rows[0].name} × ${d.quantity} ${product.rows[0].uom_code} — ${totalKes.toLocaleString('en-KE')} KES (${dept.rows[0].name})`,
        amountKes: totalKes.toFixed(2),
        assignedRoleCode: assignedRole,
        submittedByUserId: user.id,
        status: 'PENDING',
      });

      return newId;
    });

    // Notify one active holder of the assigned approval role
    const approvers = (await db.execute(sql`
      SELECT u.id FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.code = ${assignedRole} AND u.status = 'ACTIVE' AND u.id != ${user.id}
      LIMIT 3;
    `)) as unknown as { rows: Array<{ id: number }> };
    for (const a of approvers.rows) {
      await createNotification({
        userId: a.id,
        category: 'APPROVALS',
        title: 'Purchase requisition awaiting approval',
        summary: `${reqNumber} — ${product.rows[0].name} (${totalKes.toLocaleString('en-KE')} KES) from ${dept.rows[0].name}.`,
        linkUrl: '/portal/procurement',
      });
    }

    await recordAuditLog({
      actor: user,
      action: 'PURCHASE_REQUISITION_RAISED',
      module: 'PROCUREMENT',
      entityType: 'PURCHASE_REQUISITION',
      entityId: reqNumber,
      summary: `Raised requisition ${reqNumber}: ${d.quantity} ${product.rows[0].uom_code} of ${product.rows[0].name} for ${dept.rows[0].name}, estimated ${totalKes} KES — routed to ${assignedRole}`,
      afterState: d,
      ipAddress: ip,
    });

    return jsonOk({
      reqNumber,
      requisitionId,
      totalEstimatedKes: totalKes,
      routedTo: assignedRole,
      message: `Requisition ${reqNumber} submitted for ${totalKes.toLocaleString('en-KE')} KES and routed to ${assignedRole.replace('_', ' ')} for approval.`,
    });
  } catch (e) {
    if (e instanceof ApiError) return jsonError(e.status, e.message);
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('requisition POST', e);
    return jsonError(500, 'Failed to raise requisition.');
  }
}
