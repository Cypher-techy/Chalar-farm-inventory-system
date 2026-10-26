'use client';

import { useState, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Leaf, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';

const DEMO_ACCOUNTS = [
  ['superadmin@chalarfarms.demo', 'Super Administrator', 'Chalar@Admin2026!'],
  ['hr@chalarfarms.demo', 'HR Manager', 'Chalar@Demo2026!'],
  ['inventory@chalarfarms.demo', 'Inventory Manager', 'Chalar@Demo2026!'],
  ['finance@chalarfarms.demo', 'Finance Manager', 'Chalar@Demo2026!'],
  ['qa@chalarfarms.demo', 'Quality Assurance Officer', 'Chalar@Demo2026!'],
  ['sales@chalarfarms.demo', 'Sales & Export Manager', 'Chalar@Demo2026!'],
];

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
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
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Sign-in failed.');
        setLoading(false);
        return;
      }
      const next = params.get('next');
      router.push(next && next.startsWith('/') ? next : data.user?.primaryRoleCode ? '/portal' : '/portal');
      router.refresh();
    } catch {
      setError('Network error — please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Visual panel */}
      <div className="relative hidden w-1/2 lg:block">
        <Image
          src="/images/chalar/greenhouse-sweet-basil.jpg"
          alt="Rows of sweet basil growing under greenhouse cover at Chalar Farms"
          fill
          priority
          className="object-cover"
          sizes="50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-chalar-950 via-chalar-950/60 to-chalar-950/20" />
        <div className="absolute bottom-0 left-0 right-0 p-10">
          <p className="font-serif text-3xl font-bold text-white">
            Chalar Farms ERP &amp; Inventory Portal
          </p>
          <p className="mt-2 max-w-md text-sm text-stone-300">
            Secure, role-based access to farm operations, inventory, packhouse, quality, finance,
            HR and private internal communications.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center bg-stone-50 px-4 lg:w-1/2">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-chalar-700 text-white">
              <Leaf className="h-5 w-5" aria-hidden />
            </span>
            <span>
              <span className="block font-serif text-xl font-bold text-stone-900">Chalar Farms</span>
              <span className="block text-[10px] uppercase tracking-[0.18em] text-chalar-600">
                Staff Portal
              </span>
            </span>
          </Link>

          <h1 className="font-serif text-2xl font-bold text-stone-900">Sign in</h1>
          <p className="mt-1 text-sm text-stone-500">
            Use your organization account to access your authorized dashboard.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="input"
                placeholder="you@chalarfarms.demo"
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
                  className="input pr-10"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>

            <p className="text-center text-xs text-stone-400">
              Forgotten your password? Contact your Super Administrator to trigger a secure password
              reset — reset links are single-use and expire automatically.
            </p>
          </form>

          <details className="mt-6 rounded-lg border border-stone-200 bg-white p-4 text-sm">
            <summary className="cursor-pointer font-semibold text-stone-600">
              Development demo accounts (non-production seed)
            </summary>
            <ul className="mt-3 space-y-2">
              {DEMO_ACCOUNTS.map(([em, role, pw]) => (
                <li key={em} className="flex items-center justify-between gap-2">
                  <span>
                    <span className="block font-medium text-stone-700">{role}</span>
                    <span className="block text-xs text-stone-500">{em}</span>
                  </span>
                  <button
                    type="button"
                    className="btn-secondary px-2 py-1 text-xs"
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
            <p className="mt-3 text-xs text-stone-400">
              Demo seed is enabled only when <code>ENABLE_DEMO_SEED</code> is not disabled outside
              production. Change all default passwords before any real deployment.
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
