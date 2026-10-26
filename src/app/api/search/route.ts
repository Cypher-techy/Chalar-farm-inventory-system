import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { requireAuth, jsonOk, jsonError } from '@/lib/guards';

export const dynamic = 'force-dynamic';

interface SearchHit {
  title: string;
  subtitle: string;
  href: string;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
    if (q.length < 2) return jsonOk({ results: [] });

    const pattern = `%${q}%`;
    const db = await getDb();
    const results: SearchHit[] = [];
    const perms = new Set(user.permissions);

    const run = async (
      query: ReturnType<typeof sql>,
      map: (row: Record<string, string | number | null>) => SearchHit | null
    ) => {
      const res = (await db.execute(query)) as unknown as {
        rows: Record<string, string | number | null>[];
      };
      for (const row of res.rows) {
        const hit = map(row);
        if (hit) results.push(hit);
      }
    };

    if (perms.has('dashboard.inventory')) {
      await run(
        sql`SELECT sku, name FROM products WHERE (sku ILIKE ${pattern} OR name ILIKE ${pattern}) LIMIT 5`,
        (r) => ({ title: String(r.name), subtitle: `Inventory product · ${r.sku}`, href: '/portal/inventory' })
      );
      await run(
        sql`SELECT lot_number, quality_status FROM inventory_lots WHERE lot_number ILIKE ${pattern} LIMIT 5`,
        (r) => ({ title: String(r.lot_number), subtitle: `Inventory lot · ${r.quality_status}`, href: '/portal/inventory' })
      );
    }
    if (perms.has('dashboard.procurement')) {
      await run(
        sql`SELECT po_number, status FROM purchase_orders WHERE po_number ILIKE ${pattern} LIMIT 5`,
        (r) => ({ title: String(r.po_number), subtitle: `Purchase order · ${r.status}`, href: '/portal/procurement' })
      );
      await run(
        sql`SELECT supplier_code, name FROM suppliers WHERE supplier_code ILIKE ${pattern} OR name ILIKE ${pattern} LIMIT 5`,
        (r) => ({ title: String(r.name), subtitle: `Supplier · ${r.supplier_code}`, href: '/portal/procurement' })
      );
    }
    if (perms.has('dashboard.sales')) {
      await run(
        sql`SELECT order_number, status FROM sales_orders WHERE order_number ILIKE ${pattern} LIMIT 5`,
        (r) => ({ title: String(r.order_number), subtitle: `Sales order · ${r.status}`, href: '/portal/sales' })
      );
      await run(
        sql`SELECT shipment_code, dispatch_status FROM shipments WHERE shipment_code ILIKE ${pattern} OR air_waybill_no ILIKE ${pattern} LIMIT 5`,
        (r) => ({ title: String(r.shipment_code), subtitle: `Shipment · ${r.dispatch_status}`, href: '/portal/logistics' })
      );
    }
    if (perms.has('dashboard.farm')) {
      await run(
        sql`SELECT batch_number, status FROM harvest_batches WHERE batch_number ILIKE ${pattern} LIMIT 5`,
        (r) => ({ title: String(r.batch_number), subtitle: `Harvest batch · ${r.status}`, href: '/portal/farm' })
      );
      await run(
        sql`SELECT cycle_code, status FROM crop_cycles WHERE cycle_code ILIKE ${pattern} LIMIT 5`,
        (r) => ({ title: String(r.cycle_code), subtitle: `Crop cycle · ${r.status}`, href: '/portal/farm' })
      );
    }
    if (perms.has('dashboard.packhouse')) {
      await run(
        sql`SELECT order_code, status FROM packing_orders WHERE order_code ILIKE ${pattern} LIMIT 5`,
        (r) => ({ title: String(r.order_code), subtitle: `Packing order · ${r.status}`, href: '/portal/packhouse' })
      );
      await run(
        sql`SELECT packing_batch_code, qa_status FROM packing_batches WHERE packing_batch_code ILIKE ${pattern} LIMIT 5`,
        (r) => ({ title: String(r.packing_batch_code), subtitle: `Packing batch · QA ${r.qa_status}`, href: '/portal/packhouse' })
      );
    }
    if (perms.has('dashboard.qa')) {
      await run(
        sql`SELECT inspection_code, result FROM quality_inspections WHERE inspection_code ILIKE ${pattern} LIMIT 5`,
        (r) => ({ title: String(r.inspection_code), subtitle: `Quality inspection · ${r.result}`, href: '/portal/qa' })
      );
      await run(
        sql`SELECT ncr_number, status FROM nonconformities WHERE ncr_number ILIKE ${pattern} LIMIT 5`,
        (r) => ({ title: String(r.ncr_number), subtitle: `Non-conformity · ${r.status}`, href: '/portal/qa' })
      );
    }
    if (perms.has('dashboard.hr') || perms.has('workspace.supervisor')) {
      await run(
        sql`SELECT employee_code, full_name, job_title FROM employee_profiles
             WHERE (employee_code ILIKE ${pattern} OR full_name ILIKE ${pattern}) LIMIT 5`,
        (r) => ({ title: String(r.full_name), subtitle: `Employee · ${r.employee_code} · ${r.job_title}`, href: '/portal/hr' })
      );
    } else if (perms.has('workspace.self_service')) {
      await run(
        sql`SELECT employee_code, full_name, job_title FROM employee_profiles
             WHERE user_id = ${user.id} AND (employee_code ILIKE ${pattern} OR full_name ILIKE ${pattern}) LIMIT 3`,
        (r) => ({ title: String(r.full_name), subtitle: `Your employee record · ${r.employee_code}`, href: '/portal/workspaces' })
      );
    }
    if (perms.has('dashboard.finance')) {
      await run(
        sql`SELECT expense_number, payment_status FROM expense_records WHERE expense_number ILIKE ${pattern} OR description ILIKE ${pattern} LIMIT 5`,
        (r) => ({ title: String(r.expense_number), subtitle: `Expense · ${r.payment_status}`, href: '/portal/finance' })
      );
    }

    // Private conversations are deliberately EXCLUDED from global search:
    // message content must never leak outside authorized conversation members.
    return jsonOk({ results: results.slice(0, 20) });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('search error', e);
    return jsonError(500, 'Search failed.');
  }
}
