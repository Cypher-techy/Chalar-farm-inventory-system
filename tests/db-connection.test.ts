import fs from 'fs';
import path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { applySchemaMigrations, getDb, type ChalarDatabase } from '@/db';
import {
  buildPgPoolConfig,
  classifyDatabaseError,
  DatabaseConfigError,
  DatabaseSchemaError,
  DatabaseUnavailableError,
  resolveDatabaseUrl,
  cleanConnectionString,
  describeMissingDatabaseUrl,
  databaseFailureOf,
} from '@/db/connection-config';

const SUPABASE = 'postgresql://postgres.abcd:p%40ss@aws-1-eu-west-3.pooler.supabase.com:6543/postgres';

describe('PostgreSQL connection config', () => {
  it('encrypts remote connections without requiring a public CA by default (Supabase)', () => {
    const cfg = buildPgPoolConfig(SUPABASE, {});
    expect(cfg.ssl).toEqual({ rejectUnauthorized: false });
    expect(cfg.connectionString).toBe(SUPABASE);
  });

  it('treats sslmode=require with libpq semantics and strips SSL params from the URL', () => {
    const cfg = buildPgPoolConfig(`${SUPABASE}?sslmode=require&application_name=chalar`, {});
    expect(cfg.ssl).toEqual({ rejectUnauthorized: false });
    // pg would otherwise re-derive (stricter) SSL settings from the query string
    expect(cfg.connectionString).not.toMatch(/sslmode/);
    expect(cfg.connectionString).toMatch(/application_name=chalar/);
  });

  it('verifies the chain when a CA is provided, accepting escaped newlines', () => {
    const cfg = buildPgPoolConfig(SUPABASE, { DATABASE_CA_CERT: '-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----' });
    expect(cfg.ssl).toEqual({ rejectUnauthorized: true, ca: '-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----' });
  });

  it('honours verify-full, disable, DATABASE_SSL override and local hosts', () => {
    expect(buildPgPoolConfig(`${SUPABASE}?sslmode=verify-full`, {}).ssl).toEqual({ rejectUnauthorized: true });
    expect(buildPgPoolConfig(`${SUPABASE}?sslmode=disable`, {}).ssl).toBe(false);
    expect(buildPgPoolConfig(`${SUPABASE}?sslmode=verify-full`, { DATABASE_SSL: 'require' }).ssl).toEqual({ rejectUnauthorized: false });
    expect(buildPgPoolConfig('postgresql://u:p@localhost:5432/db', {}).ssl).toBe(false);
  });

  it('rejects unrecognised SSL modes instead of downgrading verification', () => {
    expect(() => buildPgPoolConfig(`${SUPABASE}?sslmode=verify_full`, {})).toThrow(DatabaseConfigError);
    expect(() => buildPgPoolConfig(SUPABASE, { DATABASE_SSL: 'verfy-full' })).toThrow(DatabaseConfigError);
  });

  it('keeps serverless pools small and allows an override', () => {
    expect(buildPgPoolConfig(SUPABASE, { VERCEL: '1' }).max).toBe(3);
    expect(buildPgPoolConfig(SUPABASE, {}).max).toBe(10);
    expect(buildPgPoolConfig(SUPABASE, { VERCEL: '1', DATABASE_POOL_MAX: '1' }).max).toBe(1);
  });

  it('rejects placeholder passwords and unparseable URLs with a config error', () => {
    expect(() => buildPgPoolConfig('postgresql://postgres:[YOUR-PASSWORD]@db.x.supabase.co:5432/postgres', {})).toThrow(
      DatabaseConfigError
    );
    expect(() => buildPgPoolConfig('postgresql://postgres:a b#c@/host:5432/db', {})).toThrow(DatabaseConfigError);
  });
});

describe('Connection string discovery (Vercel ↔ Supabase integration)', () => {
  const POOLED = 'postgres://postgres.ref:pw@aws-1-eu-west-3.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x';
  const DIRECT = 'postgres://postgres.ref:pw@aws-1-eu-west-3.pooler.supabase.com:5432/postgres?sslmode=require';

  it('uses the integration’s POSTGRES_URL when DATABASE_URL is absent', () => {
    expect(resolveDatabaseUrl({ POSTGRES_URL: POOLED, POSTGRES_URL_NON_POOLING: DIRECT, VERCEL: '1' })).toEqual({
      url: POOLED, source: 'POSTGRES_URL', ignoredDatabaseUrl: false,
    });
    expect(resolveDatabaseUrl({ POSTGRES_URL_NON_POOLING: DIRECT }).source).toBe('POSTGRES_URL_NON_POOLING');
  });

  it('an explicit PostgreSQL DATABASE_URL always wins', () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: SUPABASE, POSTGRES_URL: POOLED, VERCEL: '1' }).source).toBe('DATABASE_URL');
  });

  it('ignores a pglite DATABASE_URL copied into Vercel, but honours it locally', () => {
    const onVercel = resolveDatabaseUrl({ DATABASE_URL: 'pglite://./.data/chalar-pg', POSTGRES_URL: POOLED, VERCEL: '1' });
    expect(onVercel).toEqual({ url: POOLED, source: 'POSTGRES_URL', ignoredDatabaseUrl: true });
    expect(resolveDatabaseUrl({ DATABASE_URL: 'pglite://./.data/chalar-pg', POSTGRES_URL: POOLED }).url).toBe('pglite://./.data/chalar-pg');
    expect(resolveDatabaseUrl({}).url).toBeUndefined();
  });

  it('strips the integration’s non-PostgreSQL markers from the URL', () => {
    const cfg = buildPgPoolConfig(POOLED, { VERCEL: '1' });
    expect(cfg.connectionString).not.toMatch(/supa=|sslmode/);
    expect(cfg.ssl).toEqual({ rejectUnauthorized: false });
    expect(buildPgPoolConfig('postgres://u:p@h.example:6543/db?pgbouncer=true&connection_limit=1', {}).connectionString).not.toMatch(/pgbouncer|connection_limit/);
  });
});

describe('Pasted values and precise DB_CONFIG diagnosis', () => {
  const URL_ = 'postgresql://postgres.ref:pw@aws-1-eu-west-3.pooler.supabase.com:6543/postgres';

  it('repairs common copy/paste damage without touching valid URLs', () => {
    expect(cleanConnectionString(URL_)).toBe(URL_);
    expect(cleanConnectionString(`  "${URL_}"  `)).toBe(URL_);
    expect(cleanConnectionString(`'${URL_}';`)).toBe(URL_);
    expect(cleanConnectionString(`DATABASE_URL="${URL_}"`)).toBe(URL_);
    expect(cleanConnectionString(`export DATABASE_URL=${URL_}`)).toBe(URL_);
    expect(cleanConnectionString('   ')).toBeUndefined();
    expect(resolveDatabaseUrl({ DATABASE_URL: `"${URL_}"`, VERCEL: '1' }).url).toBe(URL_);
  });

  it('finds integration variables added with a custom prefix', () => {
    const r = resolveDatabaseUrl({ STORAGE_POSTGRES_URL: URL_, VERCEL: '1' });
    expect(r).toEqual({ url: URL_, source: 'STORAGE_POSTGRES_URL', ignoredDatabaseUrl: false });
    expect(resolveDatabaseUrl({ SUPABASE_DB_URL: URL_ }).source).toBe('SUPABASE_DB_URL');
    expect(resolveDatabaseUrl({ NEXT_PUBLIC_POSTGRES_URL: URL_ }).url).toBeUndefined();
  });

  it('explains a deployment with no database variables at all', () => {
    const msg = describeMissingDatabaseUrl({ VERCEL: '1', VERCEL_ENV: 'production', SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' });
    expect(msg).toMatch(/^This Production deployment has no usable PostgreSQL connection string/);
    expect(msg).toMatch(/Neither DATABASE_URL nor POSTGRES_URL is visible/);
    expect(msg).toMatch(/NEXT_PUBLIC_SUPABASE_URL, SUPABASE_URL/);
    expect(msg).toMatch(/Transaction pooler/);
  });

  it('names what is wrong with a present variable but never reveals its value', () => {
    const secret = 'pw-very-secret-123';
    const msg = describeMissingDatabaseUrl({
      VERCEL: '1', VERCEL_ENV: 'preview',
      DATABASE_URL: 'https://iqrmudlwstxmuaetmoat.supabase.co',
      POSTGRES_URL: 'pglite://./.data/chalar-pg',
      POSTGRES_PRISMA_URL: `mysql://u:${secret}@h/db`,
      POSTGRES_PASSWORD: secret,
    });
    expect(msg).toMatch(/^This Preview deployment/);
    expect(msg).toMatch(/DATABASE_URL holds the Supabase project\/API URL/);
    expect(msg).toMatch(/POSTGRES_URL points to the embedded local-development database/);
    expect(msg).toMatch(/POSTGRES_PRISMA_URL starts with "mysql:"/);
    expect(msg).toMatch(/POSTGRES_PASSWORD/);
    expect(msg).not.toContain(secret);
    expect(msg).not.toContain('iqrmudlwstxmuaetmoat');
  });

  it('the specific message reaches the sign-in page / health hint', () => {
    const f = databaseFailureOf(new DatabaseConfigError('This Production deployment has no usable PostgreSQL connection string.'));
    expect(f).toEqual({ code: 'DB_CONFIG', hint: 'This Production deployment has no usable PostgreSQL connection string.' });
  });
});

describe('Database failure classification', () => {
  const pgErr = (code: string, message = 'x') => Object.assign(new Error(message), { code });

  it('maps driver errors (including wrapped causes) to stable codes', () => {
    expect(classifyDatabaseError(pgErr('SELF_SIGNED_CERT_IN_CHAIN'))?.code).toBe('DB_TLS');
    expect(classifyDatabaseError(pgErr('28P01', 'password authentication failed'))?.code).toBe('DB_AUTH');
    expect(classifyDatabaseError(new Error('Tenant or user not found'))?.code).toBe('DB_AUTH');
    expect(classifyDatabaseError(pgErr('ENOTFOUND'))?.code).toBe('DB_HOST');
    expect(classifyDatabaseError(pgErr('3D000'))?.code).toBe('DB_NOT_FOUND');
    expect(classifyDatabaseError(new Error('FATAL: MaxClientsInSessionMode: max clients reached'))?.code).toBe(
      'DB_TOO_MANY_CONNECTIONS'
    );
    expect(classifyDatabaseError(pgErr('EROFS'))?.code).toBe('DB_FILESYSTEM');
    expect(classifyDatabaseError(new DatabaseSchemaError('Migrations folder not found'))?.code).toBe('DB_SCHEMA');
    const wrapped = new Error('Failed query', { cause: pgErr('28P01') });
    expect(classifyDatabaseError(wrapped)?.code).toBe('DB_AUTH');
    expect(classifyDatabaseError(new Error('unrelated'))).toBeNull();
  });

  it('never leaks the connection string in public hints', () => {
    const e = new DatabaseUnavailableError(pgErr('28P01', `password authentication failed for ${SUPABASE}`));
    expect(e.failure.code).toBe('DB_AUTH');
    expect(e.failure.hint).not.toContain('pooler.supabase.com');
    expect(e.message).not.toContain('p%40ss');
  });
});

describe('getDb on serverless hosts', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    globalThis.__chalarDbInstance = undefined;
    globalThis.__chalarDbInitPromise = undefined;
  });

  it('refuses the embedded database on Vercel with an actionable error, and does not cache the failure', async () => {
    globalThis.__chalarDbInstance = undefined;
    globalThis.__chalarDbInitPromise = undefined;
    delete process.env.DATABASE_URL;
    process.env.VERCEL = '1';
    const err = await getDb().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DatabaseUnavailableError);
    expect((err as DatabaseUnavailableError).failure.code).toBe('DB_CONFIG');
    expect(globalThis.__chalarDbInitPromise).toBeUndefined();
  });
});

describe('Schema migrations', () => {
  const MIGRATION_FILES = fs.readdirSync(path.join(process.cwd(), 'drizzle', 'migrations')).filter((f) => f.endsWith('.sql')).length;
  const count = async (db: ChalarDatabase, q: ReturnType<typeof sql>) =>
    Number(((await db.execute(q)) as unknown as { rows: Array<{ n: number }> }).rows[0].n);

  it('applies every migration file once and records it', async () => {
    const db = drizzle(new PGlite(), { schema });
    await applySchemaMigrations(db);
    await applySchemaMigrations(db); // idempotent
    expect(await count(db, sql`SELECT count(*)::int AS n FROM chalar_schema_migrations`)).toBe(MIGRATION_FILES);
    expect(
      await count(db, sql`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'reefer_temp_max_c'`)
    ).toBe(1);
  });

  it('upgrades databases created before migration tracking (partial legacy schema)', async () => {
    const db = drizzle(new PGlite(), { schema });
    await applySchemaMigrations(db);
    // Simulate an older build: no tracking table and the later column missing
    await db.execute(sql`DROP TABLE chalar_schema_migrations`);
    await db.execute(sql`ALTER TABLE vehicles DROP COLUMN reefer_temp_max_c`);
    await applySchemaMigrations(db);
    expect(await count(db, sql`SELECT count(*)::int AS n FROM chalar_schema_migrations`)).toBe(MIGRATION_FILES);
    expect(
      await count(db, sql`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'reefer_temp_max_c'`)
    ).toBe(1);
  });
});
