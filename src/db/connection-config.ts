import type { PoolConfig } from 'pg';

/**
 * Database connection configuration and failure classification.
 *
 * Kept free of database imports so it can be unit-tested and used by the
 * login page / API to turn low-level driver errors into actionable messages.
 */

export class DatabaseConfigError extends Error {
  readonly code = 'DB_CONFIG';
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseConfigError';
  }
}

/** True on hosts whose filesystem is read-only/ephemeral (embedded DB impossible). */
export function isServerlessHost(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME || env.NETLIFY);
}

export function isPostgresUrl(url: string | undefined): boolean {
  return Boolean(url && /^postgres(ql)?:\/\//i.test(url.trim()));
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const SSL_PARAMS = ['sslmode', 'ssl', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat', 'sslnegotiation'];

export type SslMode = 'disable' | 'require' | 'verify-full';

function normaliseSslMode(raw: string | null | undefined): SslMode | null {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'disable':
    case 'false':
    case 'off':
      return 'disable';
    // libpq semantics: encrypt, do not verify the certificate chain
    case 'allow':
    case 'prefer':
    case 'require':
    case 'no-verify':
    case 'true':
    case 'on':
      return 'require';
    case 'verify-ca':
    case 'verify-full':
      return 'verify-full';
    default:
      return null;
  }
}

/**
 * Builds a node-postgres pool config from DATABASE_URL.
 *
 * Why not pass the URL straight through: pg ≥ 8.13 treats `sslmode=require` as
 * `verify-full`, and managed providers such as Supabase sign server
 * certificates with their own root CA — so `?sslmode=require` fails with
 * "self-signed certificate in certificate chain". Here SSL modes follow libpq
 * semantics (`require` = encrypted, chain not verified) and full verification
 * is used whenever a CA is supplied via DATABASE_CA_CERT.
 *
 * Env overrides: DATABASE_SSL (disable | require | verify-full),
 * DATABASE_CA_CERT (PEM, literal "\n" accepted), DATABASE_POOL_MAX.
 */
export function buildPgPoolConfig(rawUrl: string, env: Record<string, string | undefined> = process.env): PoolConfig {
  const trimmed = rawUrl.trim();
  if (/\[?YOUR[-_ ]PASSWORD\]?/i.test(trimmed)) {
    throw new DatabaseConfigError(
      'DATABASE_URL still contains the "[YOUR-PASSWORD]" placeholder — paste your real database password.'
    );
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new DatabaseConfigError(
      'DATABASE_URL is not a valid connection URL. If the password contains characters such as @ # / ? : or %, percent-encode them (e.g. @ → %40).'
    );
  }
  if (!url.hostname) {
    throw new DatabaseConfigError('DATABASE_URL has no host name.');
  }

  const fromUrl = normaliseSslMode(url.searchParams.get('sslmode') ?? url.searchParams.get('ssl'));
  for (const p of SSL_PARAMS) url.searchParams.delete(p);

  const ca = env.DATABASE_CA_CERT?.trim() ? env.DATABASE_CA_CERT.replace(/\\n/g, '\n') : undefined;
  const isLocal = LOCAL_HOSTS.has(url.hostname.toLowerCase());
  const mode: SslMode =
    normaliseSslMode(env.DATABASE_SSL) ?? fromUrl ?? (ca ? 'verify-full' : isLocal ? 'disable' : 'require');

  let ssl: PoolConfig['ssl'];
  if (mode === 'disable') ssl = false;
  else if (mode === 'verify-full') ssl = ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true };
  else ssl = ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: false };

  const poolMax = Number(env.DATABASE_POOL_MAX);
  return {
    connectionString: url.toString(),
    ssl,
    // Serverless instances are many and short-lived: keep each one's footprint small
    // so a Supabase/pgBouncer client limit is not exhausted.
    max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : isServerlessHost(env) ? 3 : 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
  };
}

export type DatabaseFailureCode =
  | 'DB_CONFIG'
  | 'DB_TLS'
  | 'DB_SSL_REQUIRED'
  | 'DB_AUTH'
  | 'DB_HOST'
  | 'DB_NOT_FOUND'
  | 'DB_TOO_MANY_CONNECTIONS'
  | 'DB_FILESYSTEM'
  | 'DB_SCHEMA'
  | 'DB_UNKNOWN';

export interface DatabaseFailure {
  code: DatabaseFailureCode;
  /** Safe to show publicly (no hosts, users or secrets). */
  hint: string;
}

const HINTS: Record<DatabaseFailureCode, string> = {
  DB_CONFIG: 'DATABASE_URL is missing or invalid for this host. On Vercel it must be a PostgreSQL connection string (e.g. Supabase → Connect → Transaction pooler).',
  DB_TLS: 'The database TLS certificate could not be verified. Remove sslmode=verify-full / verify-ca, or set DATABASE_CA_CERT to the provider\'s CA certificate.',
  DB_SSL_REQUIRED: 'The database requires an encrypted connection. Remove sslmode=disable / DATABASE_SSL=disable.',
  DB_AUTH: 'The database rejected the user name or password in DATABASE_URL. Check it (Supabase pooler user names look like postgres.<project-ref>) and percent-encode special characters.',
  DB_HOST: 'The database host could not be reached. Check the host and port in DATABASE_URL and that the database is running (paused Supabase projects must be restored).',
  DB_NOT_FOUND: 'The database name in DATABASE_URL does not exist.',
  DB_TOO_MANY_CONNECTIONS: 'The database connection limit was reached. Use the Supabase transaction pooler (port 6543) or lower DATABASE_POOL_MAX.',
  DB_FILESYSTEM: 'The embedded database cannot write to this host\'s filesystem. Set DATABASE_URL to a PostgreSQL connection string.',
  DB_SCHEMA: 'The database schema is missing or out of date. Redeploy, or run `npm run db:migrate` against this DATABASE_URL.',
  DB_UNKNOWN: 'The database could not be initialised. See the server logs for the [chalar-db] entry.',
};

function causeChain(err: unknown): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  let cur: unknown = err;
  for (let i = 0; i < 6 && cur && typeof cur === 'object'; i++) {
    out.push(cur as Record<string, unknown>);
    cur = (cur as { cause?: unknown }).cause;
  }
  return out;
}

const TLS_CODES = new Set([
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);
const HOST_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH']);

/** Classifies a database failure, or returns null if the error is not database-related. */
export function classifyDatabaseError(err: unknown): DatabaseFailure | null {
  for (const e of causeChain(err)) {
    const code = typeof e.code === 'string' ? e.code : '';
    const msg = typeof e.message === 'string' ? e.message : '';
    let c: DatabaseFailureCode | null = null;
    if (e instanceof DatabaseConfigError || code === 'DB_CONFIG') c = 'DB_CONFIG';
    else if (TLS_CODES.has(code) || /certificate/i.test(msg)) c = 'DB_TLS';
    else if (/does not support SSL|no encryption|SSL off|SSL\/TLS required/i.test(msg)) c = 'DB_SSL_REQUIRED';
    else if (code === '28P01' || code === '28000' || /password authentication failed|Tenant or user not found/i.test(msg)) c = 'DB_AUTH';
    else if (HOST_CODES.has(code) || /timeout exceeded when trying to connect|Connection terminated/i.test(msg)) c = 'DB_HOST';
    else if (code === '3D000') c = 'DB_NOT_FOUND';
    else if (code === '53300' || /too many (clients|connections)|MaxClientsInSessionMode/i.test(msg)) c = 'DB_TOO_MANY_CONNECTIONS';
    else if (code === 'EROFS' || code === 'EACCES' || code === 'EPERM') c = 'DB_FILESYSTEM';
    else if (code === '42P01' || /migrations? (folder|directory)/i.test(msg)) c = 'DB_SCHEMA';
    if (c) return { code: c, hint: HINTS[c] };
  }
  return null;
}

/** Thrown by getDb() when the database cannot be initialised. */
export class DatabaseUnavailableError extends Error {
  readonly failure: DatabaseFailure;
  constructor(cause: unknown) {
    const failure = classifyDatabaseError(cause) ?? { code: 'DB_UNKNOWN' as const, hint: HINTS.DB_UNKNOWN };
    super(`Database unavailable (${failure.code})`, { cause });
    this.name = 'DatabaseUnavailableError';
    this.failure = failure;
  }
}

/** Database failure for an error thrown anywhere in a request, or null if unrelated. */
export function databaseFailureOf(err: unknown): DatabaseFailure | null {
  if (err instanceof DatabaseUnavailableError) return err.failure;
  return classifyDatabaseError(err);
}
