import { NextRequest } from 'next/server';
import { ApiError, clientIp, jsonError, jsonOk, rateLimit, requirePermission } from '@/lib/guards';
import { AccessRequestError, decideAccessRequest, decisionSchema } from '@/lib/access-requests';

export const dynamic = 'force-dynamic';

/** Approve (creates the account) or reject an account request. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission(req, 'users.manage');
    rateLimit(`access-decide:${actor.id}`, 30, 60_000);
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id) || id <= 0) return jsonError(400, 'Invalid request id.');

    const body = await req.json().catch(() => null);
    const parsed = decisionSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? 'Invalid decision.');

    const result = await decideAccessRequest(actor, id, parsed.data, {
      ipAddress: clientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    });
    return jsonOk(result);
  } catch (e) {
    if (e instanceof ApiError || e instanceof AccessRequestError) return jsonError(e.status, e.message);
    console.error('access request PATCH', e);
    return jsonError(500, 'Failed to update the account request.');
  }
}
