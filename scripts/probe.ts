import { getDb } from '@/db';
import { sql } from 'drizzle-orm';
async function main() {
  const db = await getDb();
  const r = await db.execute(sql`SELECT lot_number, physical_qty, available_qty FROM inventory_lots WHERE product_id = 4 ORDER BY id`);
  console.log('lots pid4:', JSON.stringify((r as any).rows));
  const p = await db.execute(sql`SELECT sku, physical_stock, available_stock FROM products WHERE id = 4`);
  console.log('product:', JSON.stringify((p as any).rows));
  const m = await db.execute(sql`SELECT movement_number, movement_type, quantity FROM stock_movements ORDER BY id DESC LIMIT 4`);
  console.log('movements:', JSON.stringify((m as any).rows));
  process.exit(0);
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
