import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/lib/server-session';
import { hasPermission } from '@/lib/auth';
import { auditTrail, auditModules, many } from '@/lib/ops-queries';
import { sql } from 'drizzle-orm';
import { PageHeader, Card, DataTable, StatusBadge, KPICard, fmtDateTime } from '@/components/portal/ui';
import { DonutChart } from '@/components/portal/charts';

export const dynamic = 'force-dynamic';

export default async function AuditPage(props: {
  searchParams: Promise<{ module?: string; actor?: string; q?: string }>;
}) {
  const user = await getSessionFromCookies();
  if (!user) redirect('/login');
  if (!hasPermission(user, 'audit.view')) redirect('/portal');

  const params = await props.searchParams;
  const module = params.module?.trim() || undefined;
  const actor = params.actor?.trim() || undefined;

  const [trail, modules, totals] = await Promise.all([
    auditTrail(200, actor, module),
    auditModules(),
    many<{ events_24h: number; events_total: number; actors: number; failed_logins_24h: number; lockouts_24h: number }>(sql`
      SELECT
        (SELECT count(*)::int FROM audit_logs WHERE created_at > now() - interval '24 hours')::int AS events_24h,
        (SELECT count(*)::int FROM audit_logs)::int AS events_total,
        (SELECT count(DISTINCT actor_email)::int FROM audit_logs WHERE created_at > now() - interval '7 days')::int AS actors,
        (SELECT count(*)::int FROM security_events WHERE event_type = 'LOGIN_FAILED' AND created_at > now() - interval '24 hours')::int AS failed_logins_24h,
        (SELECT count(*)::int FROM security_events WHERE event_type LIKE 'LOGIN_BLOCKED%' AND created_at > now() - interval '24 hours')::int AS lockouts_24h;
    `),
  ]);
  const t = totals[0];

  const filtered = params.q
    ? trail.filter((r) => JSON.stringify(r).toLowerCase().includes(params.q!.toLowerCase()))
    : trail;

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: 'Portal', href: '/portal' },
          { label: 'Super Admin', href: '/portal/super-admin' },
          { label: 'Audit Log' },
        ]}
        title="Enterprise Audit Log"
        subtitle="Immutable record of authentication, authorization, data changes, approvals and exports. Viewing or exporting the audit log is itself audited."
        actions={<a href="/api/reports/export?type=audit-log" className="btn-secondary">Export full audit CSV</a>}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard label="Events (24h)" value={t?.events_24h ?? 0} delayIndex={0} />
        <KPICard label="Events (total)" value={t?.events_total ?? 0} delayIndex={1} />
        <KPICard label="Distinct actors (7d)" value={t?.actors ?? 0} delayIndex={2} />
        <KPICard label="Failed logins (24h)" value={t?.failed_logins_24h ?? 0} tone={(t?.failed_logins_24h ?? 0) > 5 ? 'warning' : 'neutral'} delayIndex={3} />
        <KPICard label="Lockouts (24h)" value={t?.lockouts_24h ?? 0} tone={(t?.lockouts_24h ?? 0) > 0 ? 'danger' : 'success'} delayIndex={4} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card title="Events by module">
          <div className="p-4">
            <DonutChart data={modules.map((m) => ({ name: m.name, value: m.value }))} height={230} />
          </div>
        </Card>

        <Card title="Filters" className="lg:col-span-2">
          <form className="grid gap-3 p-4 sm:grid-cols-3" method="GET">
            <div>
              <label className="label" htmlFor="f-module">Module</label>
              <select id="f-module" name="module" defaultValue={module ?? ''} className="input">
                <option value="">All modules</option>
                {modules.map((m) => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="f-actor">Actor email</label>
              <input id="f-actor" name="actor" defaultValue={actor ?? ''} className="input" placeholder="name@example.com" />
            </div>
            <div>
              <label className="label" htmlFor="f-q">Text search</label>
              <input id="f-q" name="q" defaultValue={params.q ?? ''} className="input" placeholder="action, entity, summary…" />
            </div>
            <div className="sm:col-span-3">
              <button type="submit" className="btn-primary">Apply filters</button>
              {(module || actor || params.q) && (
                <a href="/portal/super-admin/audit" className="btn-secondary ml-2">Clear</a>
              )}
            </div>
          </form>
        </Card>
      </div>

      <Card title={`Audit trail (${filtered.length} events)`}>
        <DataTable
          headers={['Timestamp', 'Actor', 'Role', 'Module', 'Action', 'Entity', 'Summary', 'IP']}
          emptyMessage="No audit events match these filters."
          rows={filtered.map((a) => [
            <span key="t" className="whitespace-nowrap text-[10px] text-stone-500">{fmtDateTime(String(a.createdAt))}</span>,
            <span key="ac" className="text-[10px]">{String(a.actor)}</span>,
            <span key="ro" className="text-[10px] text-stone-400">{String(a.actorRole ?? '—')}</span>,
            <span key="m"><StatusBadge status={String(a.module)} tone="neutral" /></span>,
            <span key="act" className="text-[10px] font-semibold text-chalar-700">{String(a.action).replace(/_/g, ' ')}</span>,
            <span key="e" className="font-mono text-[10px] text-stone-500">{String(a.entityType)} {String(a.entityId ?? '')}</span>,
            <span key="s" className="max-w-[420px] text-[11px] leading-relaxed text-stone-600">{String(a.summary)}</span>,
            <span key="ip" className="font-mono text-[10px] text-stone-400">{String(a.ip ?? '—')}</span>,
          ])}
        />
      </Card>
    </div>
  );
}
