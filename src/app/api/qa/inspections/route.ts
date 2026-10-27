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
  stage: z.enum([
    'INCOMING_HARVEST',
    'IN_PROCESS_PACKHOUSE',
    'FINISHED_COLD_CHAIN',
    'PRE_EXPORT_PHYTOSANITARY',
  ]),
  packingBatchId: z.number().int().positive().optional(),
  harvestBatchId: z.number().int().positive().optional(),
  inventoryLotId: z.number().int().positive().optional(),
  sampleWeightKg: z.number().positive().max(1000),
  measuredTempC: z.number().min(-20).max(60),
  maxAllowedTempC: z.number().min(-20).max(60),
  moistureStatus: z.enum(['OPTIMAL', 'HIGH', 'LOW']).default('OPTIMAL'),
  pestFreeStatus: z.boolean().default(true),
  pesticideResidueCompliant: z.boolean().default(true),
  packagingIntegrity: z.enum(['VERIFIED', 'MINOR_DAMAGE', 'COMPROMISED']).default('VERIFIED'),
  defectPercent: z.number().min(0).max(100),
  notes: z.string().max(1000).optional(),
  // Required when the inspection fails, so CAPA is captured at the point of failure
  ncr: z
    .object({
      severity: z.enum(['MINOR', 'MAJOR', 'CRITICAL']),
      category: z.string().min(2).max(64),
      rootCause: z.string().min(5).max(500),
      correctiveAction: z.string().min(5).max(500),
      preventiveAction: z.string().min(5).max(500),
      assignedToUserId: z.number().int().positive().optional(),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .optional(),
});

/** Server-side decision rules — the inspector cannot simply declare a pass. */
function evaluate(d: z.infer<typeof schema>): {
  result: 'PASS' | 'CONDITIONAL_PASS' | 'FAIL_QUARANTINE';
  reasons: string[];
} {
  const reasons: string[] = [];
  if (d.measuredTempC > d.maxAllowedTempC) {
    reasons.push(`Temperature ${d.measuredTempC}°C exceeds the ${d.maxAllowedTempC}°C limit (cold-chain breach)`);
  }
  if (!d.pestFreeStatus) reasons.push('Pest activity detected in sample');
  if (!d.pesticideResidueCompliant) reasons.push('Pesticide residue non-compliant with EU MRLs');
  if (d.packagingIntegrity === 'COMPROMISED') reasons.push('Packaging integrity compromised');
  if (d.defectPercent > 5) reasons.push(`Defect rate ${d.defectPercent}% exceeds the 5% rejection threshold`);

  if (reasons.length > 0) return { result: 'FAIL_QUARANTINE', reasons };

  if (d.defectPercent > 2 || d.moistureStatus !== 'OPTIMAL' || d.packagingIntegrity === 'MINOR_DAMAGE') {
    if (d.defectPercent > 2) reasons.push(`Defect rate ${d.defectPercent}% above the 2% acceptance threshold`);
    if (d.moistureStatus !== 'OPTIMAL') reasons.push(`Moisture status ${d.moistureStatus}`);
    if (d.packagingIntegrity === 'MINOR_DAMAGE') reasons.push('Minor packaging damage recorded');
    return { result: 'CONDITIONAL_PASS', reasons };
  }

  return { result: 'PASS', reasons: [] };
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'qa.inspect');
    const ip = clientIp(req);
    rateLimit(`qa:${user.id}`, 30, 60_000);

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.join('.') ?? 'payload';
      return jsonError(400, issue?.message === 'Required' ? `${field} is required.` : issue?.message ?? 'Invalid payload.');
    }
    const d = parsed.data;

    if (!d.packingBatchId && !d.harvestBatchId && !d.inventoryLotId) {
      return jsonError(400, 'Attach the inspection to a packing batch, harvest batch or inventory lot.');
    }

    const { result, reasons } = evaluate(d);
    if (result === 'FAIL_QUARANTINE' && !d.ncr) {
      return jsonError(
        400,
        'A failing inspection requires a non-conformity record (severity, category, root cause, corrective and preventive action, due date).'
      );
    }

    const db = await getDb();
    const inspectionCode = `QI-${Date.now().toString().slice(-8)}`;
    const quarantine = result === 'FAIL_QUARANTINE';

    const inspectionId = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(t.qualityInspections)
        .values({
          inspectionCode,
          stage: d.stage,
          harvestBatchId: d.harvestBatchId ?? null,
          packingBatchId: d.packingBatchId ?? null,
          inventoryLotId: d.inventoryLotId ?? null,
          sampleWeightKg: d.sampleWeightKg.toFixed(2),
          measuredTempC: d.measuredTempC.toFixed(2),
          maxAllowedTempC: d.maxAllowedTempC.toFixed(2),
          moistureStatus: d.moistureStatus,
          pestFreeStatus: d.pestFreeStatus,
          pesticideResidueCompliant: d.pesticideResidueCompliant,
          packagingIntegrity: d.packagingIntegrity,
          defectPercent: d.defectPercent.toFixed(2),
          result,
          quarantineStatus: quarantine ? 'QUARANTINED' : 'NONE',
          inspectorUserId: user.id,
          notes: d.notes ? `${d.notes}${reasons.length ? ' | Findings: ' + reasons.join('; ') : ''}` : reasons.join('; ') || null,
        })
        .returning();
      const newInspectionId = inserted[0].id;

      // Resolve the affected packing batch + lot and apply the QA decision
      const target = (await tx.execute(sql`
        SELECT pb.id AS "packingBatchId", pb.packing_batch_code AS "batchCode",
               pb.inventory_lot_id AS "lotId", l.lot_number AS "lotNumber"
        FROM packing_batches pb
        LEFT JOIN inventory_lots l ON l.id = pb.inventory_lot_id
        WHERE pb.id = ${d.packingBatchId ?? 0}
        LIMIT 1;
      `)) as unknown as {
        rows: Array<{ packingBatchId: number; batchCode: string; lotId: number | null; lotNumber: string | null }>;
      };
      const row = target.rows[0];

      if (row) {
        await tx.execute(sql`
          UPDATE packing_batches SET qa_status = ${quarantine ? 'QUARANTINED' : result === 'PASS' ? 'PASSED' : 'PASSED'}
          WHERE id = ${row.packingBatchId};
        `);
        if (row.lotId) {
          if (quarantine) {
            await tx.execute(sql`
              UPDATE inventory_lots SET quality_status = 'QUARANTINED', available_qty = '0.000'
              WHERE id = ${row.lotId};
            `);
          } else if (result === 'PASS') {
            // Passed at inspection but still requires a separate release authority action
            await tx.execute(sql`
              UPDATE inventory_lots SET quality_status = 'QUARANTINED' WHERE id = ${row.lotId};
            `);
          }
        }
      } else if (d.inventoryLotId) {
        await tx.execute(sql`
          UPDATE inventory_lots SET quality_status = ${quarantine ? 'QUARANTINED' : 'AVAILABLE'}
          WHERE id = ${d.inventoryLotId};
        `);
      }

      if (quarantine && d.ncr) {
        const ncrNumber = `NCR-${Date.now().toString().slice(-8)}`;
        await tx.insert(t.nonconformities).values({
          ncrNumber,
          inspectionId: newInspectionId,
          severity: d.ncr.severity,
          category: d.ncr.category,
          description: reasons.join('; ') || 'Quality inspection failure',
          rootCause: d.ncr.rootCause,
          correctiveAction: d.ncr.correctiveAction,
          preventiveAction: d.ncr.preventiveAction,
          assignedToUserId: d.ncr.assignedToUserId ?? user.id,
          status: 'OPEN',
          dueDate: d.ncr.dueDate,
        });

        if (d.ncr.assignedToUserId && d.ncr.assignedToUserId !== user.id) {
          await createNotification({
            userId: d.ncr.assignedToUserId,
            category: 'QUALITY',
            title: 'Non-conformity assigned to you',
            summary: `${ncrNumber} (${d.ncr.severity}) raised from inspection ${inspectionCode}.`,
            linkUrl: '/portal/qa',
          });
        }
      }

      return newInspectionId;
    });

    await recordAuditLog({
      actor: user,
      action: quarantine ? 'QA_INSPECTION_FAILED' : 'QA_INSPECTION_RECORDED',
      module: 'QUALITY',
      entityType: 'QUALITY_INSPECTION',
      entityId: inspectionCode,
      summary: `Inspection ${inspectionCode} (${d.stage.replace(/_/g, ' ')}) → ${result}${reasons.length ? `: ${reasons.join('; ')}` : ''}; sample ${d.sampleWeightKg} kg, ${d.measuredTempC}°C vs limit ${d.maxAllowedTempC}°C, defects ${d.defectPercent}%`,
      afterState: d,
      ipAddress: ip,
    });

    return jsonOk({
      inspectionCode,
      inspectionId,
      result,
      reasons,
      quarantined: quarantine,
      message: quarantine
        ? `Inspection failed — batch quarantined and a non-conformity was raised. Release requires a separate authorized QA release action.`
        : `Inspection recorded as ${result.replace('_', ' ')}. Stock release still requires the QA release action.`,
    });
  } catch (e) {
    if (e instanceof ApiError) return jsonError(e.status, e.message);
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('qa inspection POST', e);
    return jsonError(500, 'Failed to record inspection.');
  }
}
