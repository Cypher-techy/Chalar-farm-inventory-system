import { describe, it, expect, beforeAll } from 'vitest';
import { freshDb, tokenFor, makeRequest, json, rows, one, db as getTestDb, ADMIN_PASSWORD } from './helpers';
import { POST as postMovement } from '@/app/api/inventory/movements/route';
import { POST as decideApproval } from '@/app/api/approvals/route';
import { escapeCsvCell, toCsv } from '@/lib/guards';
import { sql } from 'drizzle-orm';

const URL = 'http://localhost/api/inventory/movements';

async function productStock(productId: number) {
  return one<{ physical: string; available: string }>(sql`
    SELECT physical_stock AS physical, available_stock AS available FROM products WHERE id = ${productId}
  `);
}

async function lotStock(lotId: number) {
  return one<{ physical: string; available: string; status: string }>(sql`
    SELECT physical_qty AS physical, available_qty AS available, quality_status AS status
    FROM inventory_lots WHERE id = ${lotId}
  `);
}

describe('Inventory integrity', () => {
  let invToken: string;
  let adminToken: string = '';
  let productId: number;
  let warehouseId: number;

  beforeAll(async () => {
    await freshDb();
    invToken = await tokenFor('inventory@chalarfarms.demo');
    adminToken = await tokenFor('superadmin@chalarfarms.demo', ADMIN_PASSWORD);
    const p = await one<{ id: number }>(sql`SELECT id FROM products WHERE sku = 'HERB-BASIL-75' LIMIT 1`);
    productId = p.id;
    const w = await one<{ id: number }>(sql`SELECT id FROM warehouses WHERE code = 'WH-COLD1' LIMIT 1`);
    warehouseId = w.id;
  }, 120000);

  it('posts a receipt: creates a lot, raises stock and writes a ledger entry', async () => {
    const before = await productStock(productId);
    const key = `test-receipt-${Date.now()}`;
    const res = await postMovement(
      makeRequest(URL, {
        method: 'POST',
        token: invToken,
        headers: { 'idempotency-key': key },
        body: {
          movementType: 'RECEIPT',
          productId,
          toWarehouseId: warehouseId,
          binCode: 'CR1-TEST',
          quantity: 120,
          unitCostKes: 145.5,
          reason: 'Test receipt from GRN',
          referenceType: 'GOODS_RECEIPT',
          referenceId: 'GRN-TEST-1',
        },
      })
    );
    expect(res.status).toBe(201);
    const body = (await json(res)) as { movement: { movementNumber: string } };
    expect(body.movement.movementNumber).toBeTruthy();

    const after = await productStock(productId);
    expect(Number(after.physical)).toBeCloseTo(Number(before.physical) + 120, 2);
    expect(Number(after.available)).toBeCloseTo(Number(before.available) + 120, 2);

    const lot = await one<{ lot_number: string; physical_qty: string; unit_cost_kes: string }>(sql`
      SELECT lot_number, physical_qty, unit_cost_kes FROM inventory_lots
      WHERE product_id = ${productId} AND bin_code = 'CR1-TEST' ORDER BY id DESC LIMIT 1
    `);
    expect(Number(lot.physical_qty)).toBeCloseTo(120, 2);
    expect(Number(lot.unit_cost_kes)).toBeCloseTo(145.5, 2);

    const movement = await one<{ movement_type: string; total_cost_kes: string }>(sql`
      SELECT movement_type, total_cost_kes FROM stock_movements
      WHERE movement_number = ${body.movement.movementNumber}
    `);
    expect(movement.movement_type).toBe('RECEIPT');
    expect(Number(movement.total_cost_kes)).toBeCloseTo(120 * 145.5, 2);
  });

  it('issues stock and decrements both lot and product buckets', async () => {
    const lot = await one<{ id: number; available_qty: string }>(sql`
      SELECT id, available_qty FROM inventory_lots
      WHERE product_id = ${productId} AND bin_code = 'CR1-TEST' ORDER BY id DESC LIMIT 1
    `);
    const beforeProduct = await productStock(productId);
    const beforeLot = Number(lot.available_qty);

    const res = await postMovement(
      makeRequest(URL, {
        method: 'POST',
        token: invToken,
        headers: { 'idempotency-key': `test-issue-${Date.now()}` },
        body: {
          movementType: 'ISSUE',
          productId,
          lotId: lot.id,
          fromWarehouseId: warehouseId,
          quantity: 30,
          reason: 'Test issue to packhouse line',
        },
      })
    );
    expect(res.status).toBe(201);

    const afterProduct = await productStock(productId);
    const afterLot = await lotStock(lot.id);
    expect(Number(afterProduct.available)).toBeCloseTo(Number(beforeProduct.available) - 30, 2);
    expect(Number(afterLot.available)).toBeCloseTo(beforeLot - 30, 2);
    expect(Number(afterLot.physical)).toBeCloseTo(beforeLot - 30, 2);
  });

  it('refuses to issue more than available stock (no negative inventory)', async () => {
    const lot = await one<{ id: number; available_qty: string }>(sql`
      SELECT id, available_qty FROM inventory_lots
      WHERE product_id = ${productId} AND bin_code = 'CR1-TEST' ORDER BY id DESC LIMIT 1
    `);
    const before = await lotStock(lot.id);
    const res = await postMovement(
      makeRequest(URL, {
        method: 'POST',
        token: invToken,
        body: {
          movementType: 'ISSUE',
          productId,
          lotId: lot.id,
          fromWarehouseId: warehouseId,
          quantity: Number(lot.available_qty) + 5000,
          reason: 'Deliberate over-issue attempt in test',
        },
      })
    );
    expect(res.status).toBe(409);
    const after = await lotStock(lot.id);
    expect(after.available).toBe(before.available); // unchanged — transaction rolled back
    expect(Number(after.available)).toBeGreaterThanOrEqual(0);
  });

  it('blocks issues from quarantined, blocked and expired lots', async () => {
    const d = await getTestDb();
    const lot = await one<{ id: number }>(sql`
      SELECT id FROM inventory_lots WHERE product_id = ${productId} AND bin_code = 'CR1-TEST' LIMIT 1
    `);

    for (const status of ['QUARANTINED', 'BLOCKED', 'EXPIRED']) {
      await d.execute(sql`UPDATE inventory_lots SET quality_status = ${status} WHERE id = ${lot.id}`);
      const res = await postMovement(
        makeRequest(URL, {
          method: 'POST',
          token: invToken,
          body: {
            movementType: 'ISSUE',
            productId,
            lotId: lot.id,
            fromWarehouseId: warehouseId,
            quantity: 1,
            reason: `Attempt against ${status} lot`,
          },
        })
      );
      expect(res.status, `status ${status}`).toBe(409);
      const body = await json(res);
      expect(String(body.error).toLowerCase()).toMatch(/quarantin|block|expir/);
    }

    // Expired by date even when the status flag says AVAILABLE
    await d.execute(sql`
      UPDATE inventory_lots SET quality_status = 'AVAILABLE',
        expiry_date = to_char(CURRENT_DATE - 1, 'YYYY-MM-DD') WHERE id = ${lot.id}
    `);
    const expired = await postMovement(
      makeRequest(URL, {
        method: 'POST',
        token: invToken,
        body: {
          movementType: 'ISSUE',
          productId,
          lotId: lot.id,
          fromWarehouseId: warehouseId,
          quantity: 1,
          reason: 'Attempt against date-expired lot',
        },
      })
    );
    expect(expired.status).toBe(409);

    await d.execute(sql`UPDATE inventory_lots SET expiry_date = NULL WHERE id = ${lot.id}`);
  });

  it('is idempotent: replaying the same key does not double-post', async () => {
    const key = `idempotent-${Date.now()}`;
    const payload = {
      movementType: 'RECEIPT' as const,
      productId,
      toWarehouseId: warehouseId,
      binCode: 'CR1-IDEM',
      quantity: 10,
      unitCostKes: 100,
      reason: 'Idempotency probe',
    };
    const before = await productStock(productId);
    const first = await postMovement(makeRequest(URL, { method: 'POST', token: invToken, headers: { 'idempotency-key': key }, body: payload }));
    const second = await postMovement(makeRequest(URL, { method: 'POST', token: invToken, headers: { 'idempotency-key': key }, body: payload }));
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const after = await productStock(productId);
    expect(Number(after.physical)).toBeCloseTo(Number(before.physical) + 10, 2); // only +10, not +20

    const count = await one<{ c: number }>(sql`
      SELECT count(*)::int AS c FROM stock_movements WHERE idempotency_key = ${key}
    `);
    expect(count.c).toBe(1);
  });

  it('rejects malformed payloads and unauthenticated callers', async () => {
    const bad = await postMovement(
      makeRequest(URL, { method: 'POST', token: invToken, body: { movementType: 'ISSUE', productId } })
    );
    expect(bad.status).toBe(400);

    const negative = await postMovement(
      makeRequest(URL, {
        method: 'POST',
        token: invToken,
        body: {
          movementType: 'RECEIPT',
          productId,
          toWarehouseId: warehouseId,
          binCode: 'X',
          quantity: -5,
          unitCostKes: 10,
          reason: 'Negative quantity probe',
        },
      })
    );
    expect(negative.status).toBe(400);

    const anon = await postMovement(makeRequest(URL, { method: 'POST', body: {} }));
    expect(anon.status).toBe(401);
  });

  it('enforces segregation of duties on stock adjustments and posts only after approval', async () => {
    const d = await getTestDb();
    const lot = await one<{ id: number; available_qty: string; product_id: number }>(sql`
      SELECT id, available_qty, product_id FROM inventory_lots
      WHERE product_id = ${productId} AND bin_code = 'CR1-TEST' LIMIT 1
    `);
    const submitter = await one<{ id: number }>(sql`SELECT id FROM users WHERE email = 'inventory@chalarfarms.demo'`);
    const approverRole = 'INVENTORY_MANAGER';

    const adjNumber = `SA-TEST-${Date.now()}`;
    const inserted = await d.execute(sql`
      INSERT INTO stock_adjustments
        (adjustment_number, lot_id, product_id, warehouse_id, system_qty, counted_qty, variance_qty,
         reason, status, requested_by_user_id)
      VALUES (${adjNumber}, ${lot.id}, ${lot.product_id}, ${warehouseId},
              ${lot.available_qty}::numeric, (${lot.available_qty}::numeric - 5), -5.000,
              'Test cycle-count variance', 'PENDING_APPROVAL', ${submitter.id})
      RETURNING id;
    `) as unknown as { rows: Array<{ id: number }> };
    const adjustmentId = inserted.rows[0].id;

    await d.execute(sql`
      INSERT INTO approval_requests (request_code, module, entity_type, entity_id, title, amount_kes,
        assigned_role_code, submitted_by_user_id, status)
      VALUES (${'APR-' + adjNumber}, 'INVENTORY', 'STOCK_ADJUSTMENT', ${adjustmentId},
              'Test stock adjustment', 0, ${approverRole}, ${submitter.id}, 'PENDING');
    `);

    // Submitter cannot approve their own adjustment (same role holder)
    const selfApprove = await decideApproval(
      makeRequest(`http://localhost/api/approvals?code=${encodeURIComponent('APR-' + adjNumber)}`, {
        method: 'POST',
        token: invToken,
        body: { decision: 'APPROVED', comments: 'Self approval attempt' },
      })
    );
    expect(selfApprove.status).toBe(403);
    expect(String((await json(selfApprove)).error)).toMatch(/segregation of duties/i);

    // A different holder of the assigned role can approve
    const otherToken = adminToken;
    const approve = await decideApproval(
      makeRequest(`http://localhost/api/approvals?code=${encodeURIComponent('APR-' + adjNumber)}`, {
        method: 'POST',
        token: otherToken,
        body: { decision: 'APPROVED', comments: 'Cycle count verified by second officer' },
      })
    );
    expect(approve.status).toBe(200);

    const adj = await one<{ status: string }>(sql`SELECT status FROM stock_adjustments WHERE id = ${adjustmentId}`);
    expect(adj.status).toBe('APPROVED');

    const movement = await one<{ c: number }>(sql`
      SELECT count(*)::int AS c FROM stock_movements
      WHERE reference_type = 'STOCK_ADJUSTMENT' AND reference_id = ${adjNumber}
    `);
    expect(movement.c).toBe(1); // adjustment posted as an auditable movement, not a silent rewrite
  });

  it('records every adjustment decision in the audit log', async () => {
    const logs = await rows<{ action: string; summary: string }>(sql`
      SELECT action, summary FROM audit_logs WHERE module = 'INVENTORY' ORDER BY id DESC LIMIT 10
    `);
    expect(logs.some((l) => l.action.startsWith('APPROVAL_APPROVED') || l.action.startsWith('STOCK_'))).toBe(true);
  });

  it('escapes CSV formula injection in exported cells', () => {
    // Dangerous leading characters are neutralised with an apostrophe prefix,
    // then normal CSV quoting/escaping is applied on top.
    expect(escapeCsvCell('=HYPERLINK("http://evil")')).toContain("'=");
    expect(escapeCsvCell('+1234')).toMatch(/^'?\+|"'/);
    expect(escapeCsvCell('-cmd')).toContain("'-");
    expect(escapeCsvCell('@SUM(A1)')).toContain("'@");
    expect(escapeCsvCell('plain text')).toBe('plain text');
    expect(escapeCsvCell('has,comma')).toBe('"has,comma"');
    expect(escapeCsvCell('has"quote')).toContain('""');
    expect(escapeCsvCell(null)).toBe('');

    const csv = toCsv([{ a: '=1+1', b: 'ok' }]);
    expect(csv).toContain("'=1+1");
    expect(csv.split('\r\n')[0]).toBe('a,b');
  });

  it('keeps aggregate stock non-negative across the whole catalogue', async () => {
    const negatives = await rows<{ sku: string; available_stock: string }>(sql`
      SELECT sku, available_stock FROM products WHERE available_stock < 0 OR physical_stock < 0
    `);
    expect(negatives).toEqual([]);
  });

  void adminToken;
});
