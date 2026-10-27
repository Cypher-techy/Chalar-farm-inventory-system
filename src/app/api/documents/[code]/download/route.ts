import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, jsonError, clientIp } from '@/lib/guards';
import { recordAuditLog } from '@/lib/auth';
import { canAccessDocument, readDocumentBytes } from '@/lib/documents';

export const dynamic = 'force-dynamic';

/**
 * Streams a private document after re-checking authorization on every request.
 * Integrity is verified against the stored SHA-256 checksum before serving;
 * unauthorized callers receive a 404 so existence is not disclosed.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const user = await requireAuth(req).catch(() => null);
  if (!user) return jsonError(401, 'Authentication required.');

  const ip = clientIp(req);
  const { code } = await ctx.params;

  const { allowed, reason, document: doc } = await canAccessDocument(user, code);

  if (!allowed || !doc) {
    await recordAuditLog({
      actor: user,
      action: 'DOCUMENT_ACCESS_DENIED',
      module: 'DOCUMENTS',
      entityType: 'DOCUMENT',
      entityId: code,
      summary: `Denied download of document ${code} — ${reason}`,
      ipAddress: ip,
    });
    return jsonError(404, 'Document not found.');
  }

  try {
    const bytes = await readDocumentBytes(doc);

    await recordAuditLog({
      actor: user,
      action: 'DOCUMENT_DOWNLOADED',
      module: 'DOCUMENTS',
      entityType: 'DOCUMENT',
      entityId: doc.docCode,
      summary: `Downloaded "${doc.title}" (${doc.originalFilename}, ${doc.fileSizeBytes} bytes, sha256 verified)`,
      ipAddress: ip,
    });

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': doc.mimeType,
        'Content-Length': String(doc.fileSizeBytes),
        'Content-Disposition': `attachment; filename="${doc.originalFilename.replace(/["\r\n]/g, '')}"`,
        'Cache-Control': 'no-store, private',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Read failure';
    await recordAuditLog({
      actor: user,
      action: 'DOCUMENT_INTEGRITY_FAILURE',
      module: 'DOCUMENTS',
      entityType: 'DOCUMENT',
      entityId: doc.docCode,
      summary: `Download blocked for "${doc.title}": ${msg}`,
      ipAddress: ip,
    });
    return jsonError(500, msg.includes('checksum') ? 'Document integrity check failed — the stored file does not match its checksum.' : 'Failed to read document.');
  }
}
