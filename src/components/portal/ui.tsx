import Link from 'next/link';
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumb?: Array<{ label: string; href?: string }>;
}) {
  return (
    <div className="mb-6">
      {breadcrumb && (
        <nav className="mb-2 flex items-center gap-1.5 text-xs text-stone-400" aria-label="Breadcrumb">
          {breadcrumb.map((b, i) => (
            <span key={b.label + i} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden>›</span>}
              {b.href ? (
                <Link href={b.href} className="hover:text-chalar-700">{b.label}</Link>
              ) : (
                <span className="text-stone-600">{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-[1.75rem] text-stone-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

const TONE_STYLES: Record<string, string> = {
  success: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  warning: 'bg-amber-100 text-amber-800 ring-amber-200',
  danger: 'bg-red-100 text-red-800 ring-red-200',
  info: 'bg-sky-100 text-sky-800 ring-sky-200',
  neutral: 'bg-stone-100 text-stone-600 ring-stone-200',
  purple: 'bg-violet-100 text-violet-800 ring-violet-200',
};

export function StatusBadge({ status, tone }: { status: string; tone?: string }) {
  const normalized = status?.replace(/_/g, ' ') ?? '—';
  const autoTone =
    /APPROVED|ACTIVE|PAID|PASS|COMPLETED|DELIVERED|RELEASED|MATCHED|POSTED|EXCELLENT|VERIFIED|PICK_PACK|IN_TRANSIT|PRESENT|HIRED|OPEN_VACANCY/i.test(status)
      ? 'success'
      : /PENDING|PLANNED|GROWING|PLANTED|IN_PROGRESS|IN_PACKHOUSE|PACKING|GRADING|INTAKE|ISSUED|AUTHORISED|AUTHORIZED|PARTIAL|SEASONAL|CONTRACT|IN_REVIEW|SCREENING|INTERVIEW|LATE|STOCK_RESERVED/i.test(status)
        ? 'warning'
        : /REJECT|FAIL|QUARANTIN|BLOCK|EXPIRE|LOCKED|INACTIVE|TERMINAT|DISPUTED|VARIANCE|NEEDS_REPAIR|ABSENT|CANCELLED|CRITICAL/i.test(status)
          ? 'danger'
          : /DRAFT|NEW|INFO|FAIR|ON_LEAVE|RETURNED/i.test(status)
            ? 'neutral'
            : 'info';
  const cls = TONE_STYLES[tone ?? autoTone] ?? TONE_STYLES.neutral;
  return (
    <span className={`badge ring-1 ring-inset ${cls}`} title={status}>
      {normalized}
    </span>
  );
}

export function KPICard({
  label,
  value,
  sub,
  tone = 'neutral',
  href,
  delayIndex = 0,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  href?: string;
  delayIndex?: number;
}) {
  const toneRing = {
    success: 'border-l-emerald-500',
    warning: 'border-l-amber-500',
    danger: 'border-l-red-500',
    info: 'border-l-sky-500',
    neutral: 'border-l-chalar-600',
  }[tone];
  const inner = (
    <div className={`kpi-card animate-kpi border-l-4 ${toneRing}`} style={{ animationDelay: `${delayIndex * 60}ms` }}>
      <p className="kicker text-[10px] text-stone-500">{label}</p>
      <p className="display mt-2 text-[1.75rem] text-stone-900 tnum">{value}</p>
      {sub && <p className="mt-1 text-xs text-stone-400">{sub}</p>}
    </div>
  );
  return href ? <Link href={href} className="block transition-transform hover:-translate-y-0.5">{inner}</Link> : inner;
}

export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          {title && <h2 className="text-sm font-semibold tracking-tight text-stone-800">{title}</h2>}
          {action}
        </header>
      )}
      <div>{children}</div>
    </section>
  );
}

export function DataTable({
  headers,
  rows,
  emptyMessage = 'No records found.',
  caption,
}: {
  headers: string[];
  rows: ReactNode[][];
  emptyMessage?: string;
  caption?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-stone-400">
        <p className="font-medium text-stone-500">Nothing to show</p>
        <p className="mt-1">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm font-medium text-stone-600">{title}</p>
      {hint && <p className="mt-1 text-xs text-stone-400">{hint}</p>}
    </div>
  );
}

export function fmtKes(v: string | number | null | undefined): string {
  const n = Number(v ?? 0);
  return `KES ${n.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

export function fmtNum(v: string | number | null | undefined, dp = 1): string {
  const n = Number(v ?? 0);
  return n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: dp });
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
