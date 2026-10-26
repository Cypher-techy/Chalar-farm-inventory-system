import fs from 'fs/promises';
import path from 'path';
import { createHash, randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import * as t from '@/db/schema';
import type { SessionUser } from './auth';

export type DocumentRecord = typeof t.documentRecords.$inferSelect;

/**
 * Private document storage.
 * Files live OUTSIDE the public web root and are only retrievable through
 * authorized, audit-logged endpoints (short-lived signed URLs in future).
 */

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/csv',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
]);

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_SIZE_BYTES || 10 * 1024 * 1024);

function storageRoot(): string {
  return path.resolve(
    process.cwd(),
    process.env.PRIVATE_STORAGE_PATH || './.storage/private-documents'
  );
}

function sanitizeFilename(name: string): string {
  const base = path.basename(name);
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

export interface StoredDocument {
  docCode: string;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256: string;
}

export async function storePrivateDocument(params: {
  uploader: SessionUser;
  title: string;
  category: string;
  filename: string;
  mimeType: string;
  data: Buffer;
  departmentId?: number | null;
  conversationId?: number | null;
  isConfidential?: boolean;
}): Promise<StoredDocument> {
  const { uploader, title, category, filename, mimeType, data } = params;

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(`File type ${mimeType} is not allowed.`);
  }
  if (data.length === 0) {
    throw new Error('Empty file.');
  }
  if (data.length > MAX_UPLOAD_BYTES) {
    throw new Error(
      `File exceeds the configured ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB upload limit.`
    );
  }

  const db = await getDb();
  const checksum = createHash('sha256').update(data).digest('hex');
  const docCode = `DOC-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
  const safeName = sanitizeFilename(filename);
  const storageKey = `${docCode}/${safeName}`;
  const fullPath = path.join(storageRoot(), storageKey);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, data);

  await db.insert(t.documentRecords).values({
    docCode,
    title,
    category,
    originalFilename: safeName,
    storageKey,
    mimeType,
    fileSizeBytes: data.length,
    checksumSha256: checksum,
    uploadedByUserId: uploader.id,
    departmentId: params.departmentId ?? uploader.departmentId,
    conversationId: params.conversationId ?? null,
    isConfidential: params.isConfidential ?? true,
  });

  return {
    docCode,
    storageKey,
    originalFilename: safeName,
    mimeType,
    fileSizeBytes: data.length,
    checksumSha256: checksum,
  };
}

/**
 * Authorization for private document access:
 * 1. Document must exist.
 * 2. Uploader always retains access.
 * 3. Super Admin may access operational documents (documented admin policy).
 * 4. If linked to a conversation, requester must be an ACTIVE member of that conversation.
 * 5. Otherwise: same-department users with SENSITIVE/VIEW permissions on HR-class documents;
 *    department-scoped operational documents require the requester be in that department
 *    (or a manager/supervisor role with cross-department reporting duties).
 */
export async function canAccessDocument(
  requester: SessionUser,
  docIdOrCode: number | string
): Promise<{ allowed: boolean; reason: string; document?: DocumentRecord }> {
  const db = await getDb();
  const docRows =
    typeof docIdOrCode === 'number'
      ? await db.select().from(t.documentRecords).where(eq(t.documentRecords.id, docIdOrCode)).limit(1)
      : await db.select().from(t.documentRecords).where(eq(t.documentRecords.docCode, docIdOrCode)).limit(1);
  const doc = docRows[0];
  if (!doc) return { allowed: false, reason: 'Document not found.' };

  if (doc.uploadedByUserId === requester.id) {
    return { allowed: true, reason: 'Owner access.', document: doc };
  }

  if (doc.conversationId) {
    const memberRows = await db
      .select()
      .from(t.conversationMembers)
      .where(
        eq(t.conversationMembers.conversationId, doc.conversationId)
      );
    const membership = memberRows.find(
      (m) => m.userId === requester.id && m.revokedAt === null
    );
    if (!membership) {
      return {
        allowed: false,
        reason: 'Conversation participants only.',
        document: doc,
      };
    }
    return { allowed: true, reason: 'Conversation member access.', document: doc };
  }

  if (requester.roleCodes.includes('SUPER_ADMIN')) {
    return { allowed: true, reason: 'Super Administrator access.', document: doc };
  }

  if (
    doc.departmentId &&
    doc.departmentId === requester.departmentId &&
    (requester.permissions.includes('workspace.supervisor') ||
      requester.permissions.includes('workspace.auditor') ||
      requester.permissions.includes('hr.sensitive'))
  ) {
    return { allowed: true, reason: 'Departmental authority access.', document: doc };
  }

  return { allowed: false, reason: 'Not authorized for this document.', document: doc };
}

export async function readDocumentBytes(doc: DocumentRecord): Promise<Buffer> {
  const fullPath = path.join(storageRoot(), doc.storageKey);
  const data = await fs.readFile(fullPath);
  const checksum = createHash('sha256').update(data).digest('hex');
  if (checksum !== doc.checksumSha256) {
    throw new Error('Document integrity check failed (checksum mismatch).');
  }
  return data;
}
