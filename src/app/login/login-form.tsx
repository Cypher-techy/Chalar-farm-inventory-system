'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowUpRight, Eye, EyeOff, Info, Loader2, UserPlus } from 'lucide-react';
import { LogoLockup } from '@/components/brand/logo';
import { AuthVisualPanel } from './auth-visual-panel';
import { useScrollReveal } from '@/components/motion';
import { safeNextPath } from '@/lib/safe-redirect';
import type { DatabaseFailure } from '@/db/connection-config';

const DEMO_ACCOUNTS = [
  ['superadmin@chalarfarms.demo', 'Super Administrator', 'Chalar@Admin2026!'],
  ['hr@chalarfarms.demo', 'HR Manager', 'Chalar@Demo2026!'],
  ['inventory@chalarfarms.demo', 'Inventory Manager', 'Chalar@Demo2026!'],
  ['finance@chalarfarms.demo', 'Finance Manager', 'Chalar@Demo2026!'],
  ['qa@chalarfarms.demo', 'Quality Assurance Officer', 'Chalar@Demo2026!'],
  ['sales@chalarfarms.demo', 'Sales & Export Manager', 'Chalar@Demo2026!'],
];

export interface LoginFormProps {
  /** Sanitised post-login destination (already validated on the server). */
  next: string;
  /** True only when the *.demo seed accounts actually exist in this database. */
  showDemoAccounts: boolean;
  /** True when the database has no staff accounts at all (fresh production install). */
  setupRequired: boolean;
  /** Set when the server could not reach / initialise its database. */
  databaseIssue?: DatabaseFailure | null;
}

export function LoginForm({ next, showDemoAccounts, setupRequired, databaseIssue = null }: LoginFormProps) {
  const router = useRouter();
  const rootRef = useScrollReveal<HTMLDivElement>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      if (!res.ok) {
        setError(
          (data.error && data.code ? `${data.error} (${data.code})` : data.error) ??
            (res.status === 429
              ? 'Too many sign-in attempts. Wait a minute and try again.'
              : 'Sign-in failed. Please try again.')
        );
        setPassword('');
        setLoading(false);
        return;
      }
      // Re-validate client-side too: never follow an off-site `next`.
      router.replace(safeNextPath(next));
      router.refresh();
    } catch {
      setError('Network error — please try again.');
      setLoading(false);
    }
  }

  return (
    <div ref={rootRef} className="flex min-h-screen bg-cream-100">
      <AuthVisualPanel />

      {/* ============ Form panel ============ */}
      <div className="flex w-full items-center justify-center px-4 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <Link href="/" className="group mb-10 flex items-center lg:hidden" aria-label="Chalar Farms home">
            <LogoLockup tone="light" size={44} subtitle="Staff Portal" />
          </Link>

          <div className="reveal">
            <p className="kicker flex items-center gap-2.5 text-rust-500">
              <span className="h-px w-8 bg-rust-400/60" aria-hidden />
              Staff portal
            </p>
            <h2 className="display display-md mt-4 text-stone-900">Sign in</h2>
            <p className="mt-2 text-sm text-stone-500">
              Use your organization account to reach the dashboard your role authorizes.
            </p>
          </div>

          {databaseIssue && (
            <div
              className="reveal mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-900"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                <span className="block font-semibold">
                  Sign-in is unavailable — the server can&apos;t reach its database.
                </span>
                {databaseIssue.hint}{' '}
                <span className="font-mono text-xs text-red-700">({databaseIssue.code})</span>
              </span>
            </div>
          )}

          {setupRequired && (
            <div
              className="reveal mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-900"
              role="status"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                <span className="block font-semibold">No staff accounts exist yet.</span>
                A server administrator must set <code className="font-mono text-xs">INITIAL_ADMIN_EMAIL</code> and{' '}
                <code className="font-mono text-xs">INITIAL_ADMIN_PASSWORD</code>, then restart the app to create the first
                Super Administrator.
              </span>
            </div>
          )}

          <form onSubmit={onSubmit} className="reveal mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="input h-11 rounded-lg"
                placeholder={showDemoAccounts ? 'you@chalarfarms.demo' : 'you@chalarfarms.com'}
                autoFocus
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="input h-11 rounded-lg pr-10"
                  placeholder="••••••••••••"
                  maxLength={256}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 transition-colors hover:text-chalar-700"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
                role="alert"
                aria-live="assertive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || setupRequired || Boolean(databaseIssue)}
              aria-busy={loading}
              className="btn-primary h-11 w-full rounded-lg text-[15px] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </button>

            <p className="text-center text-xs leading-relaxed text-stone-400">
              Forgotten your password? Contact your Super Administrator to trigger a secure password
              reset — reset links are single-use and expire automatically.
            </p>
          </form>

          <div className="reveal mt-6 flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white/70 px-4 py-3.5 text-sm">
            <span className="text-stone-600">
              <span className="block font-semibold text-stone-800">New staff member?</span>
              Request an account for your department&apos;s dashboard.
            </span>
            <Link
              href="/signup"
              className="btn-secondary shrink-0 rounded-full px-4 py-2 text-xs hover:border-clay-300 hover:text-clay-700"
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden />
              Request account
            </Link>
          </div>

          {showDemoAccounts && (
          <details className="group reveal mt-8 rounded-xl border border-stone-200 bg-white p-5 text-sm shadow-card transition-colors open:border-clay-200">
            <summary className="cursor-pointer list-none">
              <span className="flex items-center justify-between gap-3">
                <span>
                  <span className="block font-semibold text-stone-700">
                    Development demo accounts
                  </span>
                  <span className="mt-0.5 block text-xs text-stone-400">
                    Non-production seed data
                  </span>
                </span>
                <span className="kicker shrink-0 text-[9px] text-clay-600" aria-hidden>
                  <span className="group-open:hidden">Show</span>
                  <span className="hidden group-open:inline">Hide</span>
                </span>
              </span>
            </summary>
            <ul className="mt-4 space-y-1 border-t border-stone-100 pt-3">
              {DEMO_ACCOUNTS.map(([em, role, pw]) => (
                <li
                  key={em}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-stone-50"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-stone-700">{role}</span>
                    <span className="block truncate font-mono text-xs text-stone-500">{em}</span>
                  </span>
                  <button
                    type="button"
                    className="btn-secondary shrink-0 rounded-full px-3 py-1 text-xs hover:border-clay-300 hover:text-clay-700"
                    onClick={() => {
                      setEmail(em);
                      setPassword(pw);
                    }}
                  >
                    Use
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-stone-400">
              Demo seed is enabled only when <code className="font-mono">ENABLE_DEMO_SEED</code> is
              not disabled outside production. Change all default passwords before any real
              deployment.
            </p>
          </details>
          )}
        </div>
      </div>
    </div>
  );
}
