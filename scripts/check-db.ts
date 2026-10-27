import { getDb } from '../src/db';
import { getSeedStatus } from '../src/db/seed-runner';

async function main() {
  const db = await getDb();
  const status = await getSeedStatus(db);
  const { sql } = await import('drizzle-orm');

  const users = await db.execute(sql`SELECT count(*)::int AS cnt FROM users`);
  const products = await db.execute(sql`SELECT count(*)::int AS cnt FROM products`);
  const so = await db.execute(sql`SELECT count(*)::int AS cnt FROM sales_orders`);
  const msgs = await db.execute(sql`SELECT count(*)::int AS cnt FROM messages`);
  const payslips = await db.execute(sql`SELECT count(*)::int AS cnt FROM payslip_records`);
  const g = (r: unknown) => (r as { rows: Array<{ cnt: number }> }).rows[0].cnt;

  console.log(JSON.stringify({
    ...status,
    users: g(users),
    products: g(products),
    salesOrders: g(so),
    messages: g(msgs),
    payslips: g(payslips),
  }, null, 2));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
