import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';
import { and, eq, isNull, gt, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import * as t from '@/db/schema';
import { ALL_PERMISSIONS, INITIAL_SYSTEM_ROLES } from './rbac-catalog';

export const SESSION_COOKIE_NAME = 'chalar_session';
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 12);
const MAX_ATTEMPTS = Number(process.env.AUTH_MAX_LOGIN_ATTEMPTS || 5);
const LOCKOUT_MINUTES = Number(process.env.AUTH_LOCKOUT_MINUTES || 15);

export type PermissionAction =
  | 'VIEW'
  | 'CREATE'
  | 'EDIT'
  | 'DELETE'
  | 'APPROVE'
  | 'EXPORT'
  | 'MANAGE_USERS'
  | 'MANAGE_SETTINGS'
  | 'SENSITIVE'
  | 'MESSAGE';

export interface SessionUser {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  departmentId: number | null;
  departmentName: string | null;
  primaryRoleCode: string;
  roleCodes: string[];
  permissions: string[];
  status: string;
  mfaEnabled: boolean;
  lastLoginAt: Date | null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export interface LoginResult {
  ok: boolean;
  token?: string;
  user?: SessionUser;
  error?: string;
  lockoutMinutes?: number;
}

export async function login(
  email: string,
  password: string,
  meta: { ipAddress?: string; userAgent?: string } = {}
): Promise<LoginResult> {
  const db = await getDb();
  const normalizedEmail = email.trim().toLowerCase();

  const userRows = await db
    .select()
    .from(t.users)
    .where(eq(t.users.email, normalizedEmail))
    .limit(1);
  const user = userRows[0];

  if (!user) {
    await recordSecurityEvent(db, null, 'LOGIN_FAILED_UNKNOWN_EMAIL', 'WARNING', meta, `Login attempt for unknown email ${maskEmail(normalizedEmail)}`);
    return { ok: false, error: 'Invalid email or password.' };
  }

  if (user.status === 'INACTIVE') {
    await recordSecurityEvent(db, user.id, 'LOGIN_BLOCKED_INACTIVE', 'WARNING', meta, 'Login blocked — account deactivated');
    return { ok: false, error: 'This account has been deactivated. Contact your administrator.' };
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    await recordSecurityEvent(db, user.id, 'LOGIN_BLOCKED_LOCKED', 'WARNING', meta, `Login blocked — account locked for ${mins} more minutes`);
    return { ok: false, error: 'Account temporarily locked due to repeated failed attempts.', lockoutMinutes: mins };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= MAX_ATTEMPTS;
    await db
      .update(t.users)
      .set({
        failedLoginAttempts: attempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60000)
          : user.lockedUntil,
        updatedAt: new Date(),
      })
      .where(eq(t.users.id, user.id));
    await recordSecurityEvent(
      db,
      user.id,
      shouldLock ? 'LOGIN_ACCOUNT_LOCKED' : 'LOGIN_FAILED_BAD_PASSWORD',
      shouldLock ? 'CRITICAL' : 'WARNING',
      meta,
      shouldLock
        ? `Account locked after ${attempts} failed login attempts`
        : `Failed login attempt ${attempts}/${MAX_ATTEMPTS}`
    );
    if (shouldLock) {
      return {
        ok: false,
        error: `Account locked for ${LOCKOUT_MINUTES} minutes after ${MAX_ATTEMPTS} failed attempts.`,
        lockoutMinutes: LOCKOUT_MINUTES,
      };
    }
    return { ok: false, error: 'Invalid email or password.' };
  }

  // Successful authentication — issue session
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000);
  await db.insert(t.sessions).values({
    tokenHash: sha256(token),
    userId: user.id,
    ipAddress: meta.ipAddress ?? null,
    userAgent: meta.userAgent ?? null,
    expiresAt,
  });
  await db
    .update(t.users)
    .set({
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(t.users.id, user.id));

  await recordSecurityEvent(db, user.id, 'LOGIN_SUCCESS', 'INFO', meta, 'Successful login');
  const sessionUser = await getSessionUser(token);
  return { ok: true, token, user: sessionUser ?? undefined };
}

export async function getSessionUser(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  const db = await getDb();
  const tokenHash = sha256(token);

  const sessionRows = await db
    .select()
    .from(t.sessions)
    .where(
      and(
        eq(t.sessions.tokenHash, tokenHash),
        isNull(t.sessions.revokedAt),
        gt(t.sessions.expiresAt, new Date())
      )
    )
    .limit(1);
  const session = sessionRows[0];
  if (!session) return null;

  const userRows = await db
    .select({
      user: t.users,
      departmentName: t.departments.name,
    })
    .from(t.users)
    .leftJoin(t.departments, eq(t.users.departmentId, t.departments.id))
    .where(eq(t.users.id, session.userId))
    .limit(1);
  const row = userRows[0];
  if (!row || row.user.status !== 'ACTIVE') return null;

  const roleRows = await db
    .select({ code: t.roles.code })
    .from(t.userRoles)
    .innerJoin(t.roles, eq(t.userRoles.roleId, t.roles.id))
    .where(eq(t.userRoles.userId, session.userId));
  const roleCodes = roleRows.map((r) => r.code);
  if (!roleCodes.includes(row.user.primaryRoleCode)) {
    roleCodes.unshift(row.user.primaryRoleCode);
  }

  const permissionSet = new Set<string>();
  for (const roleCode of roleCodes) {
    const def = INITIAL_SYSTEM_ROLES.find((r) => r.code === roleCode);
    if (def) {
      def.permissions.forEach((p) => permissionSet.add(p));
      continue;
    }
    // Custom database-defined role
    const roleRow = await db
      .select({ id: t.roles.id })
      .from(t.roles)
      .where(eq(t.roles.code, roleCode))
      .limit(1);
    if (!roleRow[0]) continue;
    const permRows = await db
      .select({ code: t.permissions.code })
      .from(t.rolePermissions)
      .innerJoin(t.permissions, eq(t.rolePermissions.permissionId, t.permissions.id))
      .where(eq(t.rolePermissions.roleId, roleRow[0].id));
    permRows.forEach((p) => permissionSet.add(p.code));
  }

  return {
    id: row.user.id,
    email: row.user.email,
    fullName: row.user.fullName,
    phone: row.user.phone,
    departmentId: row.user.departmentId,
    departmentName: row.departmentName,
    primaryRoleCode: row.user.primaryRoleCode,
    roleCodes,
    permissions: Array.from(permissionSet),
    status: row.user.status,
    mfaEnabled: row.user.mfaEnabled,
    lastLoginAt: row.user.lastLoginAt,
  };
}

export async function revokeSession(token: string, reason = 'USER_LOGOUT'): Promise<void> {
  const db = await getDb();
  await db
    .update(t.sessions)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(eq(t.sessions.tokenHash, sha256(token)));
}

export async function revokeAllUserSessions(userId: number, reason: string): Promise<number> {
  const db = await getDb();
  const res = await db
    .update(t.sessions)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(and(eq(t.sessions.userId, userId), isNull(t.sessions.revokedAt)));
  // node-postgres reports rowCount; PGlite reports affectedRows
  const r = res as { rowCount?: number; affectedRows?: number };
  return r.rowCount ?? r.affectedRows ?? 0;
}

export function hasPermission(user: SessionUser | null, permissionCode: string): boolean {
  if (!user) return false;
  return user.permissions.includes(permissionCode);
}

export function hasAnyPermission(user: SessionUser | null, codes: string[]): boolean {
  if (!user) return false;
  return codes.some((c) => user.permissions.includes(c));
}

export function isSuperAdmin(user: SessionUser | null): boolean {
  return !!user && user.roleCodes.includes('SUPER_ADMIN');
}

/** Default landing dashboard for a user's primary role */
export function defaultDashboardFor(user: SessionUser): string {
  const role = INITIAL_SYSTEM_ROLES.find((r) => r.code === user.primaryRoleCode);
  return role?.defaultDashboard ?? '/portal/workspaces';
}

export async function recordSecurityEvent(
  dbOrUndefined: Awaited<ReturnType<typeof getDb>> | null,
  userId: number | null,
  eventType: string,
  severity: 'INFO' | 'WARNING' | 'CRITICAL',
  meta: { ipAddress?: string; userAgent?: string },
  description: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const db = dbOrUndefined ?? (await getDb());
    await db.insert(t.securityEvents).values({
      userId,
      eventType,
      severity,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
      description,
      metadataJson: metadata ? JSON.stringify(metadata) : null,
    });
  } catch {
    // Security event logging must never break the main flow
  }
}

export async function recordAuditLog(entry: {
  actor: SessionUser;
  action: string;
  module: string;
  entityType: string;
  entityId: string;
  summary: string;
  beforeState?: unknown;
  afterState?: unknown;
  ipAddress?: string;
}): Promise<void> {
  const db = await getDb();
  await db.insert(t.auditLogs).values({
    actorUserId: entry.actor.id,
    actorEmail: entry.actor.email,
    actorRole: entry.actor.primaryRoleCode,
    action: entry.action,
    module: entry.module,
    entityType: entry.entityType,
    entityId: entry.entityId,
    summary: entry.summary,
    beforeStateJson: entry.beforeState ? JSON.stringify(entry.beforeState) : null,
    afterStateJson: entry.afterState ? JSON.stringify(entry.afterState) : null,
    ipAddress: entry.ipAddress ?? null,
  });
}

function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return '***';
  const visible = name.slice(0, 2);
  return `${visible}***@${domain}`;
}

/** Constant-time string compare for optional tokens (invitations, reset links). */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** List of permission codes available in the system (for admin permission pickers). */
export function catalogPermissions() {
  return ALL_PERMISSIONS;
}
