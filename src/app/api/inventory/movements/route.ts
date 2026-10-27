import { NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq, sql, gte, lte, desc } from 'drizzle-orm';
import { getDb } from '@/db';
import * as t from '@/db/schema';
import {
  ApiError,
  requirePermission,
  jsonOk,
  jsonError,
  clientIp,
  rateLimit,
  withIdempotency,
} from '@/lib/guards';
import { recordAuditLog, type SessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const movementSchema = z.discriminatedUnion('movementType', [
  z.object({
    movementType: z.literal('RECEIPT'),
    productId: z.number().int().positive(),
    toWarehouseId: z.number().int().positive(),
    binCode: z.string().min(1).max(32),
    quantity: z.number().positive().max(1_000_000),
    unitCostKes: z.number().nonnegative(),
    reason: z.string().min(3).max(500),
    referenceType: z.string().max(64).optional(),
    referenceId: z.string().max(64).optional(),
    expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  z.object({
    movementType: z.literal('ISSUE'),
    productId: z.number().int().positive(),
    lotId: z.number().int().positive(),
    fromWarehouseId: z.number().int().positive(),
    quantity: z.number().positive().max(1_000_000),
    reason: z.string().min(3).max(500),
    referenceType: z.string().max(64).optional(),
    referenceId: z.string().max(64).optional(),
  }),
  z.object({
    movementType: z.literal('TRANSFER'),
    productId: z.number().int().positive(),
    lotId: z.number().int().positive(),
    fromWarehouseId: z.number().int().positive(),
    toWarehouseId: z.number().int().positive(),
    binCode: z.string().min(1).max(32).optional(),
    quantity: z.number().positive().max(1_000_000),
    reason: z.string().min(3).max(500),
    referenceType: z.string().max(64).optional(),
    referenceId: z.string().max(64).optional(),
  }),
]);

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'dashboard.inventory');
    const db = await getDb();
    const url = req.nextUrl.searchParams;
    const page = Math.max(1, Number(url.get('page') ?? 1));
    const pageSize = Math.min(50, Math.max(5, Number(url.get('pageSize') ?? 15)));
    const type = url.get('type');
    const search = url.get('q')?.trim();

    const conditions = [];
    if (type && ['RECEIPT', 'ISSUE', 'TRANSFER', 'ADJUSTMENT', 'PRODUCTION_OUTPUT', 'PRODUCTION_CONSUME'].includes(type)) {
      conditions.push(eq(t.stockMovements.movementType, type));
    }
    if (search) {
      conditions.push(sql`(${t.stockMovements.movementNumber} ILIKE ${`%${search}%`} OR ${t.stockMovements.reason} ILIKE ${`%${search}%`})`);
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const countRes = (await db.execute(
      sql`SELECT count(*)::int AS cnt FROM stock_movements sm${
        where ? sql` WHERE ${where}` : sql``
      }`
    )) as unknown as { rows: Array<{ cnt: number }> };

    const rows = await db
      .select({
        id: t.stockMovements.id,
        movementNumber: t.stockMovements.movementNumber,
        movementType: t.stockMovements.movementType,
        quantity: t.stockMovements.quantity,
        uomCode: t.stockMovements.uomCode,
        unitCostKes: t.stockMovements.unitCostKes,
        totalCostKes: t.stockMovements.totalCostKes,
        reason: t.stockMovements.reason,
        referenceType: t.stockMovements.referenceType,
        referenceId: t.stockMovements.referenceId,
        createdAt: t.stockMovements.createdAt,
        productName: t.products.name,
        productSku: t.products.sku,
        actorName: t.users.fullName,
      })
      .from(t.stockMovements)
      .leftJoin(t.products, eq(t.stockMovements.productId, t.products.id))
      .leftJoin(t.users, eq(t.stockMovements.performedByUserId, t.users.id))
      .where(where)
      .orderBy(desc(t.stockMovements.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return jsonOk({
      movements: rows,
      total: countRes.rows[0]?.cnt ?? 0,
      page,
      pageSize,
    });
  } catch (e) {
    if (e instanceof ApiError) return jsonError(e.status, e.message);
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('movements GET', e);
    return jsonError(500, 'Failed to load stock movements.');
  }
}

export async function POST(req: NextRequest) {
  try {
    const user: SessionUser = await requirePermission(req, 'inventory.create');
    const ip = clientIp(req);
    rateLimit(`stock-move:${user.id}`, 30, 60_000);

    const body = await req.json().catch(() => null);
    const parsed = movementSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.join('.') ?? 'payload';
      const msg = issue?.message === 'Required' ? `${field} is required.` : issue?.message ?? 'Invalid movement payload.';
      return jsonError(400, msg);
    }

    const idempotencyKey =
      req.headers.get('idempotency-key') ??
      `auto-${JSON.stringify(parsed.data).slice(0, 200)}`;

    const outcome = await withIdempotency(idempotencyKey, async () => {
      const db = await getDb();
      const data = parsed.data;

      const result = await db.transaction(async (tx) => {
        const now = new Date();
        const movementNumber = `SM-${Date.now()}-${Math.floor(Math.random() * 90000 + 10000)}`;

        let unitCost = '0.00';
        if (data.movementType === 'RECEIPT') {
          unitCost = data.unitCostKes.toFixed(2);
        } else if (data.movementType === 'ISSUE' || data.movementType === 'TRANSFER') {
          const costRows = await tx
            .select({ unitCostKes: t.inventoryLots.unitCostKes })
            .from(t.inventoryLots)
            .where(eq(t.inventoryLots.id, data.lotId))
            .for('update');
          if (!costRows[0]) throw new Error('LOT_NOT_FOUND');
          unitCost = String(costRows[0].unitCostKes);
        }
        const totalCostKes = (data.quantity * Number(unitCost)).toFixed(2);

        // ---- Enforce stock rules (no unauthorized negative stock) ----
        if (data.movementType === 'ISSUE' || data.movementType === 'TRANSFER') {
          const lotRows = await tx
            .select()
            .from(t.inventoryLots)
            .where(eq(t.inventoryLots.id, data.lotId))
            .for('update');
          const lot = lotRows[0];
          if (!lot) throw new Error('LOT_NOT_FOUND');

          if (['QUARANTINED', 'BLOCKED', 'EXPIRED'].includes(lot.qualityStatus)) {
            throw new Error(`LOT_STATUS_${lot.qualityStatus}`);
          }
          if (lot.expiryDate && lot.expiryDate < now.toISOString().slice(0, 10)) {
            throw new Error('LOT_EXPIRED');
          }
          if (Number(lot.availableQty) < data.quantity) {
            throw new Error('INSUFFICIENT_AVAILABLE_STOCK');
          }

          const newPhysical = (Number(lot.physicalQty) - data.quantity).toFixed(3);
          const newAvailable = (Number(lot.availableQty) - data.quantity).toFixed(3);
          await tx
            .update(t.inventoryLots)
            .set({ physicalQty: newPhysical, availableQty: newAvailable })
            .where(eq(t.inventoryLots.id, lot.id));
        }

        if (data.movementType === 'RECEIPT') {
          const lotNumber = `LOT-RCV-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
          await tx.insert(t.inventoryLots).values({
            lotNumber,
            productId: data.productId,
            warehouseId: data.toWarehouseId,
            binCode: data.binCode,
            physicalQty: data.quantity.toFixed(3),
            reservedQty: '0.000',
            availableQty: data.quantity.toFixed(3),
            unitCostKes: data.unitCostKes.toFixed(2),
            receivedDate: now.toISOString().slice(0, 10),
            expiryDate: data.expiryDate ?? null,
            qualityStatus: 'AVAILABLE',
          });
        }

        // ---- Roll product-level stock buckets ----
        const prodRow = (
          await tx
            .select({ id: t.products.id, physicalStock: t.products.physicalStock, availableStock: t.products.availableStock })
            .from(t.products)
            .where(eq(t.products.id, data.productId))
            .for('update')
        )[0];
        if (!prodRow) throw new Error('PRODUCT_NOT_FOUND');

        const qty = data.quantity;
        if (data.movementType === 'RECEIPT') {
          await tx
            .update(t.products)
            .set({
              physicalStock: sql`${t.products.physicalStock} + ${qty}`,
              availableStock: sql`${t.products.availableStock} + ${qty}`,
            })
            .where(eq(t.products.id, data.productId));
        } else {
          if (Number(prodRow.availableStock) < qty) {
            throw new Error('INSUFFICIENT_PRODUCT_AVAILABLE_STOCK');
          }
          await tx
            .update(t.products)
            .set({
              physicalStock: sql`${t.products.physicalStock} - ${qty}`,
              availableStock: sql`${t.products.availableStock} - ${qty}`,
            })
            .where(eq(t.products.id, data.productId));
        }

        await tx.insert(t.stockMovements).values({
          movementNumber,
          idempotencyKey,
          movementType: data.movementType,
          productId: data.productId,
          lotId: data.movementType === 'RECEIPT' ? null : data.lotId,
          fromWarehouseId: data.movementType === 'RECEIPT' ? null : data.fromWarehouseId,
          toWarehouseId: data.movementType === 'ISSUE' ? null : data.toWarehouseId,
          quantity: qty.toFixed(3),
          uomCode: 'KG',
          unitCostKes: unitCost,
          totalCostKes,
          referenceType: data.referenceType ?? null,
          referenceId: data.referenceId ?? null,
          reason: data.reason,
          performedByUserId: user.id,
          createdAt: now,
        });

        return { movementNumber };
      });

      await recordAuditLog({
        actor: user,
        action: `STOCK_${data.movementType}_POSTED`,
        module: 'INVENTORY',
        entityType: 'STOCK_MOVEMENT',
        entityId: result.movementNumber,
        summary: `${data.movementType} of ${data.quantity} for product #${data.productId} — ${data.reason}`,
        afterState: data,
        ipAddress: ip,
      });

      return { status: 201, body: { ok: true, movement: result } };
    });

    return new Response(JSON.stringify(outcome.body), {
      status: outcome.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    if (e instanceof ApiError) return jsonError(e.status, e.message);
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');

    const msg = e instanceof Error ? e.message : 'Unknown error';
    const map: Record<string, [number, string]> = {
      LOT_NOT_FOUND: [404, 'Stock lot not found.'],
      PRODUCT_NOT_FOUND: [404, 'Product not found.'],
      INSUFFICIENT_AVAILABLE_STOCK: [409, 'Issue blocked: lot has insufficient available stock. Negative stock is not permitted.'],
      INSUFFICIENT_PRODUCT_AVAILABLE_STOCK: [409, 'Issue blocked: product-level available stock is insufficient.'],
      LOT_STATUS_QUARANTINED: [409, 'This lot is quarantined and cannot be issued until QA releases it.'],
      LOT_STATUS_BLOCKED: [409, 'This lot is blocked and cannot be issued.'],
      LOT_STATUS_EXPIRED: [409, 'This lot is expired and cannot be issued.'],
      LOT_EXPIRED: [409, 'This lot has passed its expiry date and cannot be issued.'],
    };
    if (map[msg]) return jsonError(map[msg][0], map[msg][1]);
    console.error('movements POST', e);
    return jsonError(500, 'Failed to post stock movement.');
  }
}
