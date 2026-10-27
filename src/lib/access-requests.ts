import { randomBytes } from 'crypto';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { getDb, type ChalarDatabase } from '@/db';
import type * as schema from '@/db/schema';
import { hashPassword, recordAuditLog, recordSecurityEvent, type SessionUser } from './auth';
import { accountTypeName, isRequestableRole, passwordPolicyProblem } from './account-types';

/**
 * Self-service account requests.
 *
 * Security model:
 *  - Submitting a request never grants access; approval by a user holding
 *    `users.manage` creates the account.
 *  - Responses are identical whether or not the email already has an account
 *    or an open request (no account enumeration).
 *  - The applicant's password is bcrypt-hashed at submission and the hash is
 *    cleared from the request once it is decided.
 *  - Super Administrator can never be requested or granted through this flow.
 *  - No email provider is configured, so email ownership is NOT verified;
 *    approvers must confirm the person's identity out of band.
 */

export const GENERIC_SUBMIT_MESSAGE =
  'Request received. A Super Administrator will review it and confirm your identity. Once approved you can sign in with the email and password you chose.';

function rows<T>(result: unknown): T[] {
  const r = result as { rows?: T[] } | T[];
  return Array.isArray(r) ? r : (r.rows ?? []);
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const accessRequestSchema = z.object({
  fullName: z
    .string({ required_error: 'Enter your full name.' })
    .trim()
    .min(2, 'Enter your full name.')
    .max(120, 'Name is too long.'),
  email: z
    .string({ required_error: 'Enter your email address.' })
    .trim()
    .toLowerCase()
    .max(254, 'Enter a valid email address.')
    .email('Enter a valid email address.'),
  phone: optionalText(32).refine((v) => !v || /^[+0-9 ()-]{6,32}$/.test(v), 'Enter a valid phone number.'),
  jobTitle: optionalText(120),
  departmentId: z.number().int().positive().optional(),
  requestedRoleCode: z
    .string({ required_error: 'Choose the type of account you need.' })
    .refine(isRequestableRole, 'Choose a valid account type.'),
  message: optionalText(1000),
  password: z.string({ required_error: 'Choose a password.' }).max(256, 'Password is too long.'),
  /** Honeypot: hidden from people, filled in by naive bots. */
  website: z.string().max(200).optional(),
});

export type AccessRequestInput = z.infer<typeof accessRequestSchema>;

export interface SubmitMeta {
  ipAddress?: string;
  userAgent?: string;
}

/** Validates input beyond the schema. Returns a user-facing error, or null. */
export function accessRequestProblem(input: AccessRequestInput): string | null {
  const pw = passwordPolicyProblem(input.password);
  if (pw) return pw;
  const local = input.email.split('@')[0];
  if (local.length >= 4 && input.password.toLowerCase().includes(local.toLowerCase())) {
    return 'Password must not contain your email name.';
  }
  return null;
}

function newRequestCode(): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return `AR-${ymd}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  return domain ? `${name.slice(0, 2)}***@${domain}` : '***';
}

/**
 * Stores a request (unless it is a duplicate or a bot submission) and notifies
 * approvers. Always resolves to the same outcome for the caller.
 */
export async function submitAccessRequest(input: AccessRequestInput, meta: SubmitMeta = {}): Promise<{ stored: boolean }> {
  // Hash first so timing does not reveal whether the email is already known.
  const passwordHash = await hashPassword(input.password);
  if (input.website) {
    await recordSecurityEvent(null, null, 'ACCESS_REQUEST_HONEYPOT', 'WARNING', meta, 'Sign-up honeypot field filled; request discarded');
    return { stored: false };
  }

  const db = await getDb();
  if (input.departmentId) {
    const dep = rows<{ id: number }>(await db.execute(sql`SELECT id FROM departments WHERE id = ${input.departmentId} AND is_active = true`));
    if (!dep[0]) input = { ...input, departmentId: undefined };
  }

  const existingUser = rows<{ id: number }>(
    await db.execute(sql`SELECT id FROM users WHERE lower(email) = ${input.email} LIMIT 1`)
  );
  if (existingUser[0]) {
    await recordSecurityEvent(db, existingUser[0].id, 'ACCESS_REQUEST_EXISTING_ACCOUNT', 'INFO', meta,
      `Sign-up request for an email that already has an account (${maskEmail(input.email)}); not stored`);
    return { stored: false };
  }

  const code = newRequestCode();
  const inserted = rows<{ id: number }>(
    await db.execute(sql`
      INSERT INTO access_requests (request_code, email, full_name, phone, job_title, department_id,
        requested_role_code, message, password_hash, ip_address, user_agent)
      VALUES (${code}, ${input.email}, ${input.fullName}, ${input.phone ?? null}, ${input.jobTitle ?? null},
        ${input.departmentId ?? null}, ${input.requestedRoleCode}, ${input.message ?? null}, ${passwordHash},
        ${meta.ipAddress ?? null}, ${meta.userAgent?.slice(0, 300) ?? null})
      ON CONFLICT (email) WHERE status = 'PENDING' DO NOTHING
      RETURNING id
    `)
  );
  if (!inserted[0]) {
    await recordSecurityEvent(db, null, 'ACCESS_REQUEST_DUPLICATE', 'INFO', meta,
      `Duplicate sign-up request while one is pending (${maskEmail(input.email)}); not stored`);
    return { stored: false };
  }

  await recordSecurityEvent(db, null, 'ACCESS_REQUEST_SUBMITTED', 'INFO', meta,
    `Account request ${code}: ${maskEmail(input.email)} asked for ${accountTypeName(input.requestedRoleCode)}`);

  // Notify every active account that can approve (users.manage)
  const roleName = accountTypeName(input.requestedRoleCode);
  const title = `New account request: ${roleName}`;
  const summary = `${input.fullName} (${input.email}) requested a ${roleName} account. Verify their identity before approving.`;
  await db.execute(sql`
    INSERT INTO notification_records (user_id, category, title, summary, link_url)
    SELECT DISTINCT u.id, 'ACCESS_REQUEST', ${title}, ${summary}, '/portal/super-admin/users#access-requests'
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE p.code = 'users.manage' AND u.status = 'ACTIVE'
  `);
  return { stored: true };
}

export class AccessRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const decisionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('APPROVE'),
    roleCode: z.string().optional(),
    departmentId: z.number().int().positive().nullable().optional(),
    note: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal('REJECT'),
    note: z.string({ required_error: 'Give a reason for rejecting.' }).trim().min(3, 'Give a reason for rejecting.').max(500),
  }),
]);
export type AccessDecision = z.infer<typeof decisionSchema>;

interface PendingRow {
  id: number;
  request_code: string;
  email: string;
  full_name: string;
  phone: string | null;
  department_id: number | null;
  requested_role_code: string;
  password_hash: string | null;
  status: string;
}

/** Approves (creating the account) or rejects a pending request. Audited. */
export async function decideAccessRequest(
  actor: SessionUser,
  requestId: number,
  decision: AccessDecision,
  meta: SubmitMeta = {}
): Promise<{ message: string; userId?: number }> {
  const db = await getDb();
  type DecisionResult = { message: string; userId?: number; email: string; code: string; roleCode?: string; before: string };
  let result = null as DecisionResult | null;

  await (db as PgliteDatabase<typeof schema>).transaction(
    async (txRaw) => {
      const tx = txRaw as unknown as ChalarDatabase;
      const req = rows<PendingRow>(
        await tx.execute(sql`SELECT * FROM access_requests WHERE id = ${requestId} FOR UPDATE`)
      )[0];
      if (!req) throw new AccessRequestError(404, 'Account request not found.');
      if (req.status !== 'PENDING') {
        throw new AccessRequestError(409, `This request was already ${req.status.toLowerCase()}.`);
      }

      if (decision.action === 'REJECT') {
        await tx.execute(sql`
          UPDATE access_requests
          SET status = 'REJECTED', password_hash = NULL, decided_by_user_id = ${actor.id},
              decided_at = now(), decision_note = ${decision.note}, updated_at = now()
          WHERE id = ${req.id}
        `);
        result = { message: `Rejected request ${req.request_code} from ${req.email}.`, email: req.email, code: req.request_code, before: req.requested_role_code };
        return;
      }

      const roleCode = decision.roleCode ?? req.requested_role_code;
      if (!isRequestableRole(roleCode)) {
        throw new AccessRequestError(400, 'That account type cannot be granted from a request. Super Administrator access must be granted from Users & Roles.');
      }
      if (!req.password_hash) throw new AccessRequestError(409, 'This request has no password on file; ask the person to submit a new request.');

      const taken = rows<{ id: number }>(await tx.execute(sql`SELECT id FROM users WHERE lower(email) = ${req.email} LIMIT 1`));
      if (taken[0]) {
        throw new AccessRequestError(409, `An account for ${req.email} already exists. Reject this request instead.`);
      }

      const departmentId = decision.departmentId === undefined ? req.department_id : decision.departmentId;
      const created = rows<{ id: number }>(
        await tx.execute(sql`
          INSERT INTO users (email, password_hash, full_name, phone, department_id, primary_role_code, status)
          VALUES (${req.email}, ${req.password_hash}, ${req.full_name}, ${req.phone}, ${departmentId}, ${roleCode}, 'ACTIVE')
          RETURNING id
        `)
      )[0];
      await tx.execute(sql`
        INSERT INTO user_roles (user_id, role_id)
        SELECT ${created.id}, id FROM roles WHERE code = ${roleCode}
        ON CONFLICT DO NOTHING
      `);
      await tx.execute(sql`
        UPDATE access_requests
        SET status = 'APPROVED', password_hash = NULL, granted_role_code = ${roleCode},
            decided_by_user_id = ${actor.id}, decided_at = now(), decision_note = ${decision.note ?? null},
            created_user_id = ${created.id}, department_id = ${departmentId}, updated_at = now()
        WHERE id = ${req.id}
      `);
      await tx.execute(sql`
        INSERT INTO notification_records (user_id, category, title, summary, link_url)
        VALUES (${created.id}, 'ACCOUNT', 'Welcome to the Chalar Farms portal',
          ${`Your ${accountTypeName(roleCode)} account was approved.`}, '/portal')
      `);
      result = {
        message: `Approved ${req.email} as ${accountTypeName(roleCode)}. They can now sign in with the password they chose.`,
        userId: created.id,
        email: req.email,
        code: req.request_code,
        roleCode,
        before: req.requested_role_code,
      };
    }
  );

  const r = result as DecisionResult | null;
  if (!r) throw new AccessRequestError(500, 'Decision was not recorded.');
  const approved = decision.action === 'APPROVE';
  await recordSecurityEvent(null, r.userId ?? null, approved ? 'ACCESS_REQUEST_APPROVED' : 'ACCESS_REQUEST_REJECTED',
    approved ? 'WARNING' : 'INFO', meta,
    `${approved ? 'Approved' : 'Rejected'} account request ${r.code} by ${actor.email}${approved ? ` — role ${r.roleCode}` : ''}`);
  await recordAuditLog({
    actor,
    action: approved ? 'ACCESS_REQUEST_APPROVED' : 'ACCESS_REQUEST_REJECTED',
    module: 'ADMIN',
    entityType: 'ACCESS_REQUEST',
    entityId: r.code,
    summary: approved
      ? `Approved account request ${r.code} for ${r.email}: requested ${r.before}, granted ${r.roleCode}${decision.note ? ` — ${decision.note}` : ''}`
      : `Rejected account request ${r.code} for ${r.email} (requested ${r.before}) — ${decision.note}`,
    beforeState: { status: 'PENDING', requestedRoleCode: r.before },
    afterState: approved ? { status: 'APPROVED', grantedRoleCode: r.roleCode, userId: r.userId } : { status: 'REJECTED' },
    ipAddress: meta.ipAddress,
  });
  return { message: r.message, userId: r.userId };
}
