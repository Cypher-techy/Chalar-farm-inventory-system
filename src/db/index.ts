import fs from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite, PgliteDatabase } from 'drizzle-orm/pglite';
import { drizzle as drizzlePg, NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';
import { sql } from 'drizzle-orm';
import {
  buildPgPoolConfig,
  DatabaseConfigError,
  DatabaseSchemaError,
  DatabaseUnavailableError,
  isPostgresUrl,
  isServerlessHost,
  resolveDatabaseUrl,
} from './connection-config';

export { DatabaseUnavailableError, databaseFailureOf } from './connection-config';

export type ChalarDatabase = PgliteDatabase<typeof schema> | NodePgDatabase<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __chalarDbInstance: ChalarDatabase | undefined;
  // eslint-disable-next-line no-var
  var __chalarDbInitPromise: Promise<ChalarDatabase> | undefined;
  // eslint-disable-next-line no-var
  var __chalarPgliteClient: PGlite | undefined;
  // eslint-disable-next-line no-var
  var __chalarDbClose: (() => Promise<void>) | undefined;
}

/* ------------------------------------------------------------------------- */
/* Migrations                                                                 */
/* ------------------------------------------------------------------------- */

const MIGRATIONS_TABLE = 'chalar_schema_migrations';
/** Arbitrary constants for pg_advisory_xact_lock — serialise concurrent cold starts. */
const MIGRATION_LOCK_KEY = 72917001;
const SEED_LOCK_KEY = 72917002;

interface MigrationFile {
  name: string;
  statements: string[];
}

function readMigrationFiles(): MigrationFile[] {
  const migrationsDir = path.join(process.cwd(), 'drizzle', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    throw new DatabaseSchemaError(
      `Migrations folder not found at ${migrationsDir}. Make sure drizzle/migrations is deployed with the app.`
    );
  }
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => ({
      name,
      statements: fs
        .readFileSync(path.join(migrationsDir, name), 'utf8')
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean),
    }));
}

function resultRows<T>(result: unknown): T[] {
  const r = result as { rows?: T[] } | T[];
  return Array.isArray(r) ? r : (r.rows ?? []);
}

function isAlreadyExistsError(err: unknown): boolean {
  let cur: unknown = err;
  for (let i = 0; i < 5 && cur && typeof cur === 'object'; i++) {
    const code = (cur as { code?: unknown }).code;
    const msg = String((cur as { message?: unknown }).message ?? '');
    if (code === '42P07' || code === '42710' || code === '42701' || code === '42P06' || /already exists/i.test(msg)) {
      return true;
    }
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Applies pending SQL migrations from drizzle/migrations.
 *
 * - Runs in ONE transaction under an advisory lock: concurrent serverless cold
 *   starts queue up instead of racing, and a timeout/crash can never leave a
 *   half-created schema behind (previously a partial schema was treated as done).
 * - Each applied file is recorded in chalar_schema_migrations.
 * - Databases created by older builds (tables present, no tracking rows) are
 *   brought up to date idempotently, statement by statement under savepoints.
 */
export async function applySchemaMigrations(db: ChalarDatabase): Promise<void> {
  const files = readMigrationFiles();
  if (files.length === 0) {
    throw new DatabaseSchemaError('No .sql files found in drizzle/migrations.');
  }

  await (db as PgliteDatabase<typeof schema>).transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${MIGRATION_LOCK_KEY})`);
    await tx.execute(
      sql.raw(
        `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`
      )
    );
    const applied = new Set(
      resultRows<{ name: string }>(await tx.execute(sql.raw(`SELECT name FROM ${MIGRATIONS_TABLE}`))).map((r) => r.name)
    );
    const pending = files.filter((f) => !applied.has(f.name));
    if (pending.length === 0) return;

    const legacyRows = resultRows<{ exists: boolean }>(
      await tx.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles'
        ) AS "exists"
      `)
    );
    const legacy = applied.size === 0 && Boolean(legacyRows[0]?.exists);

    for (const file of pending) {
      for (const [i, stmt] of file.statements.entries()) {
        if (!legacy) {
          await tx.execute(sql.raw(stmt));
          continue;
        }
        const sp = `chalar_mig_${i}`;
        await tx.execute(sql.raw(`SAVEPOINT ${sp}`));
        try {
          await tx.execute(sql.raw(stmt));
          await tx.execute(sql.raw(`RELEASE SAVEPOINT ${sp}`));
        } catch (err) {
          await tx.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${sp}`));
          if (!isAlreadyExistsError(err)) throw err;
        }
      }
      await tx.execute(sql`INSERT INTO chalar_schema_migrations (name) VALUES (${file.name}) ON CONFLICT (name) DO NOTHING`);
    }
  });
}

/** Seeds configuration (and demo data when enabled) atomically, once, under a lock. */
async function seedAtomically(db: ChalarDatabase): Promise<void> {
  const { ensureSeeded } = await import('./seed-runner');
  await (db as PgliteDatabase<typeof schema>).transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${SEED_LOCK_KEY})`);
    await ensureSeeded(tx as unknown as ChalarDatabase);
  });
}

/* ------------------------------------------------------------------------- */
/* Connections                                                                */
/* ------------------------------------------------------------------------- */

interface DatabaseConnection {
  db: ChalarDatabase;
  close: () => Promise<void>;
}

async function createDatabaseConnection(): Promise<DatabaseConnection> {
  const resolved = resolveDatabaseUrl();
  const configured = resolved.url;
  if (resolved.ignoredDatabaseUrl) {
    console.warn(`[chalar-db] Ignoring non-PostgreSQL DATABASE_URL on this serverless host; using ${resolved.source}. Remove DATABASE_URL from the deployment environment to silence this.`);
  }

  if (isPostgresUrl(configured)) {
    const pool = new pg.Pool(buildPgPoolConfig(configured as string));
    // An idle client losing its connection must not crash the server process.
    pool.on('error', (err) => console.error('[chalar-db] idle PostgreSQL client error:', err.message));
    const db = drizzlePg(pool, { schema });
    try {
      await applySchemaMigrations(db);
    } catch (err) {
      await pool.end().catch(() => undefined);
      throw err;
    }
    return { db, close: () => pool.end() };
  }

  if (configured && !configured.startsWith('pglite://') && configured !== 'memory://') {
    throw new DatabaseConfigError(
      'DATABASE_URL must start with postgresql:// (or pglite:// for local development).'
    );
  }
  if (isServerlessHost()) {
    throw new DatabaseConfigError(
      configured
        ? 'DATABASE_URL points to the embedded database, which cannot run on Vercel (read-only, ephemeral filesystem). Set it to your PostgreSQL / Supabase connection string.'
        : 'No PostgreSQL connection string found (checked DATABASE_URL, POSTGRES_URL, POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING). On Vercel connect the Supabase integration or set DATABASE_URL — the embedded development database cannot run there.'
    );
  }

  const dbUrl: string = configured || 'pglite://./.data/chalar-pg';
  // Embedded PostgreSQL via PGlite (local development / single-server installs)
  const isMemory = dbUrl === 'memory://' || process.env.VITEST === 'true';
  const dataDir = isMemory ? null : path.resolve(/*turbopackIgnore: true*/ process.cwd(), dbUrl.replace(/^pglite:\/\//, ''));

  const open = async (): Promise<DatabaseConnection> => {
    if (dataDir) fs.mkdirSync(path.dirname(/*turbopackIgnore: true*/ dataDir), { recursive: true });
    const client = dataDir ? new PGlite(dataDir) : new PGlite();
    globalThis.__chalarPgliteClient = client;
    const db = drizzlePglite(client, { schema });
    try {
      await applySchemaMigrations(db);
    } catch (err) {
      await client.close().catch(() => undefined);
      throw err;
    }
    return { db, close: () => client.close() };
  };

  try {
    return await open();
  } catch (err) {
    // PGlite is single-process: a killed dev server can leave a stale postmaster
    // lock behind. Clear it and retry once rather than serving a dead database.
    if (!(err instanceof DatabaseConfigError) && !(err instanceof DatabaseSchemaError) && dataDir && fs.existsSync(dataDir)) {
      for (const f of ['postmaster.pid', '.s.PGSQL.5432', '.s.PGSQL.5432.lock', '.s.PGSQL.5432.lock.out']) {
        try {
          fs.rmSync(path.join(/*turbopackIgnore: true*/ dataDir, f), { force: true });
        } catch {
          /* ignore */
        }
      }
      const conn = await open();
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[chalar-db] Cleared a stale PGlite lock and reconnected (first attempt failed: ${msg.slice(0, 120)}).`);
      return conn;
    }
    throw err;
  }
}

/**
 * Shared database handle. First call connects, migrates, seeds and bootstraps
 * the first admin. A failed initialisation is NOT cached — the next request
 * retries — and surfaces as DatabaseUnavailableError with a classified cause.
 */
export async function getDb(): Promise<ChalarDatabase> {
  if (globalThis.__chalarDbInstance) {
    return globalThis.__chalarDbInstance;
  }
  if (!globalThis.__chalarDbInitPromise) {
    globalThis.__chalarDbInitPromise = (async () => {
      const conn = await createDatabaseConnection();
      try {
        await seedAtomically(conn.db);
      } catch (err) {
        await conn.close().catch(() => undefined);
        throw err;
      }
      // First-run Super Administrator for configuration-only (production) databases
      try {
        const { ensureInitialAdmin } = await import('./bootstrap-admin');
        // Locked so concurrent cold starts cannot race to create the same account.
        await (conn.db as PgliteDatabase<typeof schema>).transaction(async (tx) => {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(${SEED_LOCK_KEY})`);
          await ensureInitialAdmin(tx as unknown as ChalarDatabase);
        });
      } catch (err) {
        console.error('[chalar] Initial admin bootstrap failed', err);
      }
      globalThis.__chalarDbInstance = conn.db;
      globalThis.__chalarDbClose = conn.close;
      return conn.db;
    })().catch((err: unknown) => {
      globalThis.__chalarDbInitPromise = undefined;
      const wrapped = err instanceof DatabaseUnavailableError ? err : new DatabaseUnavailableError(err);
      console.error(`[chalar-db] ${wrapped.failure.code}: ${wrapped.failure.hint}`, err);
      throw wrapped;
    });
  }
  return globalThis.__chalarDbInitPromise;
}

/** Closes the shared connection (CLI scripts; lets the process exit). */
export async function closeDb(): Promise<void> {
  const close = globalThis.__chalarDbClose;
  globalThis.__chalarDbInstance = undefined;
  globalThis.__chalarDbInitPromise = undefined;
  globalThis.__chalarDbClose = undefined;
  if (close) await close();
}

export async function resetTestDb(): Promise<ChalarDatabase> {
  globalThis.__chalarDbInstance = undefined;
  globalThis.__chalarDbInitPromise = undefined;
  const client = new PGlite();
  globalThis.__chalarPgliteClient = client;
  const db = drizzlePglite(client, { schema });
  await applySchemaMigrations(db);
  await seedAtomically(db);
  globalThis.__chalarDbInstance = db;
  globalThis.__chalarDbInitPromise = Promise.resolve(db);
  return db;
}
