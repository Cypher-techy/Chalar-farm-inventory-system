'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Info,
  LayoutDashboard,
  Loader2,
} from 'lucide-react';
import { LogoLockup } from '@/components/brand/logo';
import { useScrollReveal } from '@/components/motion';
import { ACCOUNT_TYPE_GROUPS, type AccountType } from '@/lib/account-types';
import type { DatabaseFailure } from '@/db/connection-config';
import { AuthVisualPanel } from '../login/auth-visual-panel';

interface SignupFormProps {
  accountTypes: AccountType[];
  departments: Array<{ id: number; code: string; name: string }>;
  /** No active account can approve requests yet (fresh install). */
  noApprover: boolean;
  databaseIssue: DatabaseFailure | null;
}

const PASSWORD_RULES: Array<{ label: string; test: (pw: string) => boolean }> = [
  { label: 'At least 12 characters', test: (pw) => pw.length >= 12 },
  {
    label: 'Three of: lowercase, uppercase, number, symbol',
    test: (pw) => [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length >= 3,
  },
];

export function SignupForm({ accountTypes, departments, noApprover, databaseIssue }: SignupFormProps) {
  const rootRef = useScrollReveal<HTMLDivElement>();
  const [roleCode, setRoleCode] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departmentTouched, setDepartmentTouched] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const grouped = useMemo(
    () =>
      ACCOUNT_TYPE_GROUPS.map((g) => ({ group: g, types: accountTypes.filter((a) => a.group === g) })).filter(
        (g) => g.types.length > 0
      ),
    [accountTypes]
  );
  const selected = accountTypes.find((a) => a.code === roleCode) ?? null;

  function chooseRole(a: AccountType) {
    setRoleCode(a.code);
    // Pre-select the usual department unless the person already picked one
    if (!departmentTouched && a.suggestedDepartmentCode) {
      const d = departments.find((x) => x.code === a.suggestedDepartmentCode);
      if (d) setDepartmentId(String(d.id));
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!roleCode) {
      setError('Choose the type of account you need.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: String(fd.get('fullName') ?? ''),
          email: String(fd.get('email') ?? ''),
          phone: String(fd.get('phone') ?? '') || undefined,
          jobTitle: String(fd.get('jobTitle') ?? '') || undefined,
          departmentId: departmentId ? Number(departmentId) : undefined,
          requestedRoleCode: roleCode,
          message: String(fd.get('message') ?? '') || undefined,
          password,
          website: String(fd.get('website') ?? '') || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string; code?: string };
      if (!res.ok) {
        setError(
          (data.error && data.code ? `${data.error} (${data.code})` : data.error) ??
            (res.status === 429 ? 'Too many requests. Please wait a few minutes and try again.' : 'Could not submit your request.')
        );
        setLoading(false);
        return;
      }
      setPassword('');
      setConfirm('');
      setDone(data.message ?? 'Request received.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('Network error — please try again.');
    }
    setLoading(false);
  }

  const blocked = Boolean(databaseIssue);

  return (
    <div ref={rootRef} className="flex min-h-screen bg-cream-100">
      <AuthVisualPanel
        headline={['Your role,', 'your dashboard.']}
        blurb="Request the account your job needs — finance, HR, inventory, packhouse, QA and more. A Super Administrator verifies every request before access is granted."
      />

      <div className="flex w-full justify-center px-4 py-12 lg:w-1/2">
        <div className="w-full max-w-lg">
          <Link href="/" className="group mb-10 flex items-center lg:hidden" aria-label="Chalar Farms home">
            <LogoLockup tone="light" size={44} subtitle="Staff Portal" />
          </Link>

          <div className="reveal">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 transition-colors hover:text-chalar-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Back to sign in
            </Link>
            <p className="kicker mt-6 flex items-center gap-2.5 text-rust-500">
              <span className="h-px w-8 bg-rust-400/60" aria-hidden />
              Staff portal
            </p>
            <h2 className="display display-md mt-4 text-stone-900">Request an account</h2>
            <p className="mt-2 text-sm text-stone-500">
              Choose the type of account you need. Nothing is unlocked until a Super Administrator reviews and
              approves your request.
            </p>
          </div>

          {databaseIssue && (
            <div
              className="reveal mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-900"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                <span className="block font-semibold">Sign-up is unavailable — the server can&apos;t reach its database.</span>
                {databaseIssue.hint} <span className="font-mono text-xs text-red-700">({databaseIssue.code})</span>
              </span>
            </div>
          )}

          {done ? (
            <div className="mt-8 rounded-2xl border border-chalar-200 bg-white p-6 shadow-card animate-kpi" role="status">
              <CheckCircle2 className="h-8 w-8 text-chalar-600" aria-hidden />
              <h3 className="mt-4 text-lg font-semibold text-stone-900">Request submitted</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{done}</p>
              <p className="mt-3 text-xs leading-relaxed text-stone-400">
                If you already have an account, use it to sign in instead — contact your Super Administrator if you
                have forgotten the password.
              </p>
              <Link href="/login" className="btn-primary mt-6 h-11 w-full rounded-lg text-[15px]">
                Go to sign in
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="reveal mt-8 space-y-6" noValidate={false}>
              {noApprover && !blocked && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-900" role="status">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    No administrator account exists yet, so requests cannot be reviewed until the first Super
                    Administrator is set up.
                  </span>
                </div>
              )}

              {/* ---- Account type ---- */}
              <fieldset disabled={blocked}>
                <legend className="label">Account type</legend>
                <p className="-mt-0.5 mb-3 text-xs text-stone-500">Pick the dashboard your job needs.</p>
                <div className="space-y-5" role="radiogroup" aria-label="Account type">
                  {grouped.map(({ group, types }) => (
                    <div key={group}>
                      <p className="kicker mb-2 text-[10px] text-stone-400">{group}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {types.map((a) => {
                          const active = a.code === roleCode;
                          return (
                            <label
                              key={a.code}
                              className={`relative flex cursor-pointer flex-col rounded-xl border bg-white px-3.5 py-3 text-left transition-all focus-within:ring-2 focus-within:ring-chalar-500/40 ${
                                active
                                  ? 'border-chalar-600 shadow-card ring-1 ring-chalar-600'
                                  : 'border-stone-200 hover:border-clay-300'
                              }`}
                            >
                              <input
                                type="radio"
                                name="requestedRoleCode"
                                value={a.code}
                                checked={active}
                                onChange={() => chooseRole(a)}
                                className="sr-only"
                                required
                              />
                              <span className="flex items-start justify-between gap-2">
                                <span className="text-sm font-semibold text-stone-800">{a.name}</span>
                                {active ? (
                                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-chalar-600" aria-hidden />
                                ) : (
                                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-stone-300" aria-hidden />
                                )}
                              </span>
                              <span className="mt-1 line-clamp-2 text-[11px] leading-snug text-stone-500">
                                {a.dashboards.slice(0, 3).join(' · ')}
                                {a.dashboards.length > 3 ? ` +${a.dashboards.length - 3}` : ''}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {selected && (
                  <div className="mt-4 rounded-xl border border-chalar-100 bg-chalar-50/60 px-4 py-3.5 text-sm" aria-live="polite">
                    <p className="flex items-center gap-2 font-semibold text-chalar-800">
                      <LayoutDashboard className="h-4 w-4" aria-hidden />
                      {selected.name}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-stone-600">{selected.description}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {selected.dashboards.map((d) => (
                        <span key={d} className="rounded-full border border-chalar-200 bg-white px-2 py-0.5 text-[10px] font-medium text-chalar-700">
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </fieldset>

              {/* ---- About you ---- */}
              <fieldset disabled={blocked} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="fullName" className="label">Full name</label>
                    <input id="fullName" name="fullName" required minLength={2} maxLength={120} autoComplete="name" className="input h-11 rounded-lg" />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="email" className="label">Work email</label>
                    <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" className="input h-11 rounded-lg" placeholder="you@chalarfarms.com" />
                  </div>
                  <div>
                    <label htmlFor="phone" className="label">Phone <span className="font-normal normal-case text-stone-400">(optional)</span></label>
                    <input id="phone" name="phone" type="tel" maxLength={32} autoComplete="tel" className="input h-11 rounded-lg" placeholder="+254 7…" />
                  </div>
                  <div>
                    <label htmlFor="jobTitle" className="label">Job title <span className="font-normal normal-case text-stone-400">(optional)</span></label>
                    <input id="jobTitle" name="jobTitle" maxLength={120} autoComplete="organization-title" className="input h-11 rounded-lg" />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="departmentId" className="label">Department <span className="font-normal normal-case text-stone-400">(optional)</span></label>
                    <select
                      id="departmentId"
                      className="input h-11 rounded-lg"
                      value={departmentId}
                      onChange={(e) => {
                        setDepartmentId(e.target.value);
                        setDepartmentTouched(true);
                      }}
                    >
                      <option value="">Not sure / other</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="message" className="label">Note for the administrator <span className="font-normal normal-case text-stone-400">(optional)</span></label>
                    <textarea id="message" name="message" maxLength={1000} rows={3} className="input rounded-lg py-2.5" placeholder="e.g. your manager's name or staff number, to help verify you" />
                  </div>
                </div>
              </fieldset>

              {/* ---- Password ---- */}
              <fieldset disabled={blocked} className="space-y-4">
                <div>
                  <label htmlFor="password" className="label">Choose a password</label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPw ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={12}
                      maxLength={128}
                      className="input h-11 rounded-lg pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-describedby="password-rules"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 transition-colors hover:text-chalar-700"
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <ul id="password-rules" className="mt-2 space-y-1">
                    {PASSWORD_RULES.map((r) => {
                      const ok = r.test(password);
                      return (
                        <li key={r.label} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-chalar-700' : 'text-stone-400'}`}>
                          {ok ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Circle className="h-3 w-3" aria-hidden />}
                          {r.label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div>
                  <label htmlFor="confirm" className="label">Confirm password</label>
                  <input
                    id="confirm"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    maxLength={128}
                    className="input h-11 rounded-lg"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                  {confirm && confirm !== password && <p className="mt-1.5 text-xs text-red-600">Passwords do not match.</p>}
                </div>
              </fieldset>

              {/* Honeypot — invisible to people */}
              <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden>
                <label htmlFor="website">Website</label>
                <input id="website" name="website" tabIndex={-1} autoComplete="off" />
              </div>

              {error && (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700" role="alert">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || blocked}
                aria-busy={loading}
                className="btn-primary h-11 w-full rounded-lg text-[15px] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Submitting…
                  </>
                ) : (
                  <>
                    Submit request
                    <ArrowUpRight className="h-4 w-4" aria-hidden />
                  </>
                )}
              </button>
              <p className="text-center text-xs leading-relaxed text-stone-400">
                Your request and IP address are recorded for security review. Already have an account?{' '}
                <Link href="/login" className="font-medium text-chalar-700 hover:underline">Sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
