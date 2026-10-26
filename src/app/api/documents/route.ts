import { NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { requireAuth, jsonOk, jsonError, clientIp, rateLimit } from '@/lib/guards';
import { recordAuditLog } from '@/lib/auth';
import { storePrivateDocument } from '@/lib/documents';
import { assertConversationMember, ChatAccessError } from '@/lib/chat';

export const dynamic = 'force-dynamic';

const MAX_FORM_BYTES = 12 * 1024 * 1024;

/** Lists documents the caller is allowed to see (own uploads, own department, own conversations). */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const db = await getDb();
    const scope = req.nextUrl.searchParams.get('scope') ?? 'mine';

    const rows = (await db.execute(sql`
      SELECT dr.id, dr.doc_code AS "docCode", dr.title, dr.category,
             dr.original_filename AS "originalFilename", dr.mime_type AS "mimeType",
             dr.file_size_bytes AS "fileSizeBytes", dr.is_confidential AS "isConfidential",
             dr.conversation_id AS "conversationId", dr.department_id AS "departmentId",
             dr.created_at AS "createdAt", u.full_name AS "uploadedBy",
             c.title AS "conversationTitle"
      FROM document_records dr
      JOIN users u ON u.id = dr.uploaded_by_user_id
      LEFT JOIN conversations c ON c.id = dr.conversation_id
      WHERE ${
        scope === 'conversation'
          ? sql`dr.conversation_id IS NOT NULL`
          : sql`TRUE`
      }
      ORDER BY dr.created_at DESC
      LIMIT 100;
    `)) as unknown as { rows: Array<Record<string, unknown>> };

    // Filter to what this caller may actually access (membership / department / ownership)
    const visible: Array<Record<string, unknown>> = [];
    for (const row of rows.rows) {
      const conversationId = row.conversationId as number | null;
      if (conversationId) {
        try {
          await assertConversationMember(user.id, conversationId);
          visible.push(row);
        } catch {
          // not a participant — hidden entirely (existence is not disclosed)
        }
        continue;
      }
      const isOwner = Number(row.uploadedBy) === Number(user.id) || row.uploadedBy === user.fullName;
      const sameDept = row.departmentId != null && user.departmentId != null && Number(row.departmentId) === Number(user.departmentId);
      const privileged =
        user.permissions.includes('hr.sensitive') ||
        user.permissions.includes('audit.view') ||
        user.roleCodes.includes('SUPER_ADMIN');
      if (isOwner || sameDept || privileged) visible.push(row);
    }

    return jsonOk({ documents: visible, scope });
  } catch (e) {
    if (e instanceof ChatAccessError) return jsonError(e.status, e.message);
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    console.error('documents GET', e);
    return jsonError(500, 'Failed to list documents.');
  }
}

/**
 * Uploads a private document. Files never live in /public: they are written
 * under .storage/private-documents and can only be fetched through the
 * access-controlled download endpoint.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const ip = clientIp(req);
    rateLimit(`upload:${user.id}`, 20, 60_000);

    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
      return jsonError(400, 'Use multipart/form-data with a "file" field.');
    }
    if (Number(req.headers.get('content-length') ?? 0) > MAX_FORM_BYTES) {
      return jsonError(413, 'Upload exceeds the 12 MB limit.');
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return jsonError(400, 'No file was provided.');

    const title = String(form.get('title') ?? file.name).slice(0, 200);
    const category = String(form.get('category') ?? 'GENERAL').toUpperCase().slice(0, 48);
    const conversationIdRaw = form.get('conversationId');
    const conversationId = conversationIdRaw ? Number(conversationIdRaw) : null;
    const isConfidential = String(form.get('isConfidential') ?? 'true') !== 'false';

    if (conversationId) {
      // Membership is mandatory before a file can be attached to a conversation
      const { membership } = await assertConversationMember(user.id, conversationId);
      if (!membership.canSend) {
        return jsonError(403, 'You cannot attach files to this conversation.');
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storePrivateDocument({
      uploader: user,
      title,
      category,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      data: buffer,
      conversationId,
      isConfidential,
    });

    await recordAuditLog({
      actor: user,
      action: 'DOCUMENT_UPLOADED',
      module: 'DOCUMENTS',
      entityType: 'DOCUMENT',
      entityId: stored.docCode,
      summary: `Uploaded "${title}" (${stored.originalFilename}, ${stored.mimeType}, ${stored.fileSizeBytes} bytes, sha256 ${stored.checksumSha256.slice(0, 12)}…)${conversationId ? ` to conversation #${conversationId}` : ''}`,
      ipAddress: ip,
    });

    return jsonOk({
      docCode: stored.docCode,
      message: `Stored ${stored.originalFilename} (${(stored.fileSizeBytes / 1024).toFixed(1)} KB) in private storage.`,
      downloadUrl: `/api/documents/${stored.docCode}/download`,
    });
  } catch (e) {
    if (e instanceof ChatAccessError) return jsonError(e.status, e.message);
    const err = e as { status?: number; message?: string };
    if (err.status) return jsonError(err.status, err.message ?? 'Error');
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('not allowed') || msg.includes('exceeds') || msg.includes('Empty file')) {
      return jsonError(400, msg);
    }
    console.error('documents POST', e);
    return jsonError(500, 'Failed to store document.');
  }
}
