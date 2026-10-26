import fs from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite, PgliteDatabase } from 'drizzle-orm/pglite';
import { drizzle as drizzlePg, NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';
import { sql } from 'drizzle-orm';

export type ChalarDatabase = PgliteDatabase<typeof schema> | NodePgDatabase<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __chalarDbInstance: ChalarDatabase | undefined;
  // eslint-disable-next-line no-var
  var __chalarDbInitPromise: Promise<ChalarDatabase> | undefined;
  // eslint-disable-next-line no-var
  var __chalarPgliteClient: PGlite | undefined;
}

function getMigrationSqlStatements(): string[] {
  const migrationsDir = path.join(process.cwd(), 'drizzle', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const statements: string[] = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const chunks = content
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);
    statements.push(...chunks);
  }
  return statements;
}

export async function applySchemaMigrations(db: ChalarDatabase): Promise<void> {
  // Check if roles table already exists
  const check = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'roles'
    ) AS "exists";
  `);
  const row = (check as unknown as { rows?: Array<{ exists: boolean }> }).rows?.[0];
  if (row?.exists) {
    return;
  }

  const statements = getMigrationSqlStatements();
  for (const stmt of statements) {
    try {
      await db.execute(sql.raw(stmt));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('already exists')) {
        throw err;
      }
    }
  }
}

async function createDatabaseConnection(): Promise<ChalarDatabase> {
  const dbUrl = process.env.DATABASE_URL || 'pglite://./.data/chalar-pg';

  if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
    const pool = new pg.Pool({
      connectionString: dbUrl,
      max: 10,
    });
    const db = drizzlePg(pool, { schema });
    await applySchemaMigrations(db);
    return db;
  }

  // Embedded PostgreSQL 16 via PGlite
  const isMemory = dbUrl === 'memory://' || process.env.VITEST === 'true';
  let client: PGlite;

  if (isMemory) {
    client = new PGlite();
  } else {
    const rawPath = dbUrl.replace(/^pglite:\/\//, '');
    const resolvedDir = path.resolve(process.cwd(), rawPath);
    fs.mkdirSync(path.dirname(resolvedDir), { recursive: true });
    try {
      client = new PGlite(resolvedDir);
    } catch {
      // Fallback to in-memory PGlite if secondary build worker hits directory lock
      client = new PGlite();
    }
  }

  globalThis.__chalarPgliteClient = client;
  const db = drizzlePglite(client, { schema });
  await applySchemaMigrations(db);
  return db;
}

export async function getDb(): Promise<ChalarDatabase> {
  if (globalThis.__chalarDbInstance) {
    return globalThis.__chalarDbInstance;
  }
  if (!globalThis.__chalarDbInitPromise) {
    globalThis.__chalarDbInitPromise = (async () => {
      const db = await createDatabaseConnection();
      globalThis.__chalarDbInstance = db;
      // Automatically seed initial enterprise data if database is empty
      const { ensureSeeded } = await import('./seed-runner');
      await ensureSeeded(db);
      return db;
    })();
  }
  return globalThis.__chalarDbInitPromise;
}

export async function resetTestDb(): Promise<ChalarDatabase> {
  globalThis.__chalarDbInstance = undefined;
  globalThis.__chalarDbInitPromise = undefined;
  const client = new PGlite();
  globalThis.__chalarPgliteClient = client;
  const db = drizzlePglite(client, { schema });
  await applySchemaMigrations(db);
  globalThis.__chalarDbInstance = db;
  globalThis.__chalarDbInitPromise = Promise.resolve(db);
  const { ensureSeeded } = await import('./seed-runner');
  await ensureSeeded(db);
  return db;
}
