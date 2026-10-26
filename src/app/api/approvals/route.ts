import { NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq, desc } from 'drizzle-orm';
import { getDb } from '@/db';
import * as t from '@/db/schema';
import { requireAuth, jsonOk, jsonError, clientIp, rateLimit } from '@/lib/guards';
import { recordAuditLog } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const db = await getDb();

    // Pending approvals assigned to roles the user holds, plus their own submissions.
    const rolePlaceholders = user.roleCodes;
    const rows = await db
      .select({
        id: t.approvalRequests.id,
        requestCode: t.approvalRequests.requestCode,
        module: t.approvalRequests.module,
        entityType: t.approvalRequests.entityType,
        entityId: t.approvalRequests.entityId,
        title: t.approvalRequests.title,
        amountKes: t.approvalRequests.amountKes,
        status: t.approvalRequests.status,
        submittedAt: t.approvalRequests.submittedAt,
        decidedAt: t.approvalRequests.decidedAt,
        decisionComments: t.approvalRequests.decisionComments,
        submittedByName: t.users.fullName,
        assignedRoleCode: t.approvalRequests.assignedRoleCode,
      })
      .from(t.approvalRequests)
      .leftJoin(t.users, eq(t.approvalRequests.submittedByUserId, t.users.id))
      .where(
        rolePlaceholders.length
          ? undefined
          : undefined
      )
      .orderBy(desc(t.approvalRequests.submittedAt))
      .limit(100);

    const visible = rows.filter(
      (r) =>
        r.status !== 'PENDING' ||
        user.roleCodes.includes(r.assignedRoleCode) ||
        r.submittedByName === user.fullName
    );

    return jsonOk({ approvals: visible, canDecideRoles: user.roleCodes });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('approvals GET', e);
    return jsonError(500, 'Failed to load approvals.');
  }
}

const decisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'RETURNED']),
  comments: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const ip = clientIp(req);
    rateLimit(`approval:${user.id}`, 40, 60_000);

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    if (!code) return jsonError(400, 'Approval code is required.');

    const body = await req.json().catch(() => ({}));
    const parsed = decisionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, parsed.error.issues[0]?.message ?? 'Invalid decision payload.');
    }

    const db = await getDb();
    const approvalRows = await db
      .select()
      .from(t.approvalRequests)
      .where(eq(t.approvalRequests.requestCode, code))
      .for('update')
      .limit(1);
    const approval = approvalRows[0];
    if (!approval) return jsonError(404, 'Approval request not found.');
    if (approval.status !== 'PENDING') {
      return jsonError(409, `This request was already ${approval.status.toLowerCase()}.`);
    }

    // Role must match an assigned role of the actor (least privilege).
    // The Super Administrator holds every permission and may decide any routed
    // approval — segregation of duties below still forbids deciding their own.
    const isSuperAdmin = user.roleCodes.includes('SUPER_ADMIN');
    if (!isSuperAdmin && !user.roleCodes.includes(approval.assignedRoleCode)) {
      await recordAuditLog({
        actor: user,
        action: 'APPROVAL_UNAUTHORIZED_ATTEMPT',
        module: approval.module,
        entityType: approval.entityType,
        entityId: approval.requestCode,
        summary: `Unauthorized approval attempt by ${user.email} (roles: ${user.roleCodes.join(',')}) — requires ${approval.assignedRoleCode}`,
        ipAddress: ip,
      });
      return jsonError(403, 'You are not authorized to decide this approval.');
    }

    // Segregation of duties: no self-approval
    if (approval.submittedByUserId === user.id) {
      return jsonError(
        403,
        'Segregation of duties: you cannot approve or reject your own submission. Another authorized approver must decide.'
      );
    }

    const now = new Date();
    await db
      .update(t.approvalRequests)
      .set({
        status: parsed.data.decision,
        decidedByUserId: user.id,
        decisionComments: parsed.data.comments ?? null,
        decidedAt: now,
      })
      .where(eq(t.approvalRequests.id, approval.id));

    // Cascade the decision to the underlying entity
    const { decision } = parsed.data;
    if (approval.entityType === 'PURCHASE_REQUISITION') {
      const st = decision === 'APPROVED' ? 'APPROVED' : decision === 'REJECTED' ? 'REJECTED' : 'PENDING_APPROVAL';
      await db
        .update(t.purchaseRequisitions)
        .set({
          status: st,
          approvedByUserId: decision === 'APPROVED' ? user.id : null,
          approvedAt: decision === 'APPROVED' ? now : null,
        })
        .where(eq(t.purchaseRequisitions.id, approval.entityId));
    } else if (approval.entityType === 'EXPENSE_RECORD') {
      const st = decision === 'APPROVED' ? 'APPROVED' : decision === 'REJECTED' ? 'REJECTED' : 'PENDING_APPROVAL';
      await db
        .update(t.expenseRecords)
        .set({
          paymentStatus: st,
          approvedByUserId: decision === 'APPROVED' ? user.id : null,
        })
        .where(eq(t.expenseRecords.id, approval.entityId));
    } else if (approval.entityType === 'STOCK_ADJUSTMENT') {
      const st = decision === 'APPROVED' ? 'APPROVED' : decision === 'REJECTED' ? 'REJECTED' : 'PENDING_APPROVAL';
      await db
        .update(t.stockAdjustments)
        .set({
          status: st,
          approvedByUserId: decision === 'APPROVED' ? user.id : null,
          approvedAt: decision === 'APPROVED' ? now : null,
        })
        .where(eq(t.stockAdjustments.id, approval.entityId));
      // On approval, post an auditable adjustment movement (never silent rewrite)
      if (decision === 'APPROVED') {
        const adjRows = await db
          .select()
          .from(t.stockAdjustments)
          .where(eq(t.stockAdjustments.id, approval.entityId))
          .limit(1);
        const adj = adjRows[0];
        if (adj && Number(adj.varianceQty) !== 0) {
          const lotRows = await db
            .select()
            .from(t.inventoryLots)
            .where(eq(t.inventoryLots.id, adj.lotId))
            .for('update');
          const lot = lotRows[0];
          if (lot) {
            const delta = Number(adj.varianceQty);
            const newPhysical = (Number(lot.physicalQty) + delta).toFixed(3);
            const newAvailable = (Number(lot.availableQty) + delta).toFixed(3);
            if (Number(newAvailable) >= 0) {
              await db
                .update(t.inventoryLots)
                .set({ physicalQty: newPhysical, availableQty: newAvailable })
                .where(eq(t.inventoryLots.id, lot.id));
              await db.insert(t.stockMovements).values({
                movementNumber: `SM-ADJ-${adj.adjustmentNumber}-${Date.now()}`,
                idempotencyKey: `ADJ-APPROVED-${adj.adjustmentNumber}`,
                movementType: 'ADJUSTMENT',
                productId: adj.productId,
                lotId: adj.lotId,
                fromWarehouseId: delta < 0 ? adj.warehouseId : null,
                toWarehouseId: delta > 0 ? adj.warehouseId : null,
                quantity: Math.abs(delta).toFixed(3),
                uomCode: 'KG',
                unitCostKes: lot.unitCostKes,
                totalCostKes: (Math.abs(delta) * Number(lot.unitCostKes)).toFixed(2),
                referenceType: 'STOCK_ADJUSTMENT',
                referenceId: adj.adjustmentNumber,
                reason: `Approved adjustment — ${adj.reason}`,
                performedByUserId: user.id,
                approvedByUserId: user.id,
              });
            }
          }
        }
      }
    } else if (approval.entityType === 'LEAVE_REQUEST') {
      const st = decision === 'APPROVED' ? 'APPROVED' : decision === 'REJECTED' ? 'REJECTED' : 'PENDING';
      await db
        .update(t.leaveRequests)
        .set({
          status: st,
          reviewedByUserId: user.id,
          reviewComments: parsed.data.comments ?? null,
          reviewedAt: now,
        })
        .where(eq(t.leaveRequests.id, approval.entityId));
      // Reconcile leave balances
      const lrRows = await db
        .select()
        .from(t.leaveRequests)
        .where(eq(t.leaveRequests.id, approval.entityId))
        .limit(1);
      const lr = lrRows[0];
      if (lr) {
        if (decision === 'APPROVED') {
          await db
            .update(t.leaveBalances)
            .set({
              pendingDays: sqlGtZero(t.leaveBalances.pendingDays, lr.totalDays),
              usedDays: sqlPlus(t.leaveBalances.usedDays, lr.totalDays),
            })
            .where(
              and(
                eq(t.leaveBalances.employeeId, lr.employeeId),
                eq(t.leaveBalances.leaveTypeId, lr.leaveTypeId),
                eq(t.leaveBalances.year, 2026)
              )
            );
        } else if (decision === 'REJECTED' || decision === 'RETURNED') {
          await db
            .update(t.leaveBalances)
            .set({
              pendingDays: sqlGtZero(t.leaveBalances.pendingDays, lr.totalDays),
            })
            .where(
              and(
                eq(t.leaveBalances.employeeId, lr.employeeId),
                eq(t.leaveBalances.leaveTypeId, lr.leaveTypeId),
                eq(t.leaveBalances.year, 2026)
              )
            );
        }
      }
    }

    await recordAuditLog({
      actor: user,
      action: `APPROVAL_${decision}`,
      module: approval.module,
      entityType: approval.entityType,
      entityId: approval.requestCode,
      summary: `${decision} "${approval.title}"${parsed.data.comments ? ` — ${parsed.data.comments}` : ''}`,
      beforeState: { status: approval.status },
      afterState: { status: decision, comments: parsed.data.comments ?? null },
      ipAddress: ip,
    });

    return jsonOk({ message: `Request ${decision.toLowerCase()}.`, code });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('approvals POST', e);
    return jsonError(500, 'Failed to process approval decision.');
  }
}

import { sql } from 'drizzle-orm';

function sqlPlus(col: typeof t.leaveBalances.usedDays, val: string) {
  return sql`${col} + ${val}::numeric`;
}
function sqlGtZero(col: typeof t.leaveBalances.pendingDays, val: string) {
  return sql`GREATEST(${col} - ${val}::numeric, 0)`;
}
