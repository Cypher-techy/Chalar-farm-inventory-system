'use client';

import { useState } from 'react';
import { Loader2, UserPlus, KeyRound, ShieldOff, ShieldCheck, Unlock, LogOut } from 'lucide-react';
import { StatusBadge, fmtDateTime } from '@/components/portal/ui';

interface UserRow {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  status: string;
  primaryRoleCode: string;
  lastLoginAt: string | null;
  failedAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
  department: string | null;
  roles: string;
  employeeCode: string | null;
}

export function UserAdminDesk({
  users,
  roles,
  departments,
  isSuperAdmin,
}: {
  users: UserRow[];
  roles: Array<{ code: string; name: string; permissionCount: number | string }>;
  departments: Array<{ id: number; code: string; name: string }>;
  isSuperAdmin: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState('');

  async function post(endpoint: string, payload: Record<string, unknown>, init?: RequestInit) {
    const res = await fetch(endpoint, {
      method: init?.method ?? 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
    return data;
  }

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setNotice(null);
    try {
      const data = (await fn()) as { message?: string };
      setNotice({ kind: 'ok', text: data.message ?? 'Done.' });
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : 'Action failed.' });
    } finally {
      setBusy(null);
    }
  }

  async function createUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const roleCodes = String(fd.get('roleCodes'))
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    setBusy('create');
    setNotice(null);
    try {
      const data = (await post('/api/admin/users', {
        email: String(fd.get('email')),
        fullName: String(fd.get('fullName')),
        phone: String(fd.get('phone') || '') || undefined,
        departmentId: fd.get('departmentId') ? Number(fd.get('departmentId')) : undefined,
        roleCodes,
        temporaryPassword: String(fd.get('temporaryPassword')),
        employeeCode: String(fd.get('employeeCode') || '') || undefined,
      })) as { message?: string };
      setNotice({ kind: 'ok', text: data.message ?? 'User created.' });
      (e.target as HTMLFormElement).reset();
      setFormOpen(false);
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Failed.' });
    } finally {
      setBusy(null);
    }
  }

  const filtered = users.filter(
    (u) =>
      !search.trim() ||
      [u.email, u.fullName, u.roles, u.department ?? '', u.employeeCode ?? ''].join(' ')
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={() => setFormOpen((v) => !v)}>
          <UserPlus className="h-4 w-4" /> {formOpen ? 'Close form' : 'Create / reset user'}
        </button>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by name, email, role, department…"
          className="input w-72"
        />
        <span className="ml-auto text-xs text-stone-400">{filtered.length} of {users.length} accounts</span>
      </div>

      {notice && (
        <div className={`rounded-md px-3 py-2 text-sm ${notice.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {notice.text}
        </div>
      )}

      {formOpen && (
        <form onSubmit={createUser} className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label" htmlFor="u-email">Email</label>
            <input id="u-email" name="email" type="email" required className="input" placeholder="name@chalarfarms.co.ke" />
          </div>
          <div>
            <label className="label" htmlFor="u-name">Full name</label>
            <input id="u-name" name="fullName" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="u-phone">Phone</label>
            <input id="u-phone" name="phone" className="input" placeholder="+254…" />
          </div>
          <div>
            <label className="label" htmlFor="u-dept">Department</label>
            <select id="u-dept" name="departmentId" className="input">
              <option value="">Unassigned</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="u-roles">Role codes (comma separated)</label>
            <input id="u-roles" name="roleCodes" required className="input font-mono text-xs" placeholder="FARM_MANAGER, DEPARTMENT_SUPERVISOR" />
            <p className="mt-1 text-[10px] text-stone-400">
              First role becomes the primary role and default dashboard. Available:{' '}
              {roles.map((r) => r.code).join(', ')}
            </p>
          </div>
          <div>
            <label className="label" htmlFor="u-emp">Employee code (optional link)</label>
            <input id="u-emp" name="employeeCode" className="input font-mono text-xs" placeholder="EMP-…" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label" htmlFor="u-pw">Temporary password (min 10 characters)</label>
            <input id="u-pw" name="temporaryPassword" required minLength={10} className="input font-mono" />
            <p className="mt-1 text-[10px] text-stone-400">
              Share out of band and require the user to change it at first login. Creating an account
              for an existing email resets its password and reactivates it — both are audited.
              {!isSuperAdmin && ' Only a Super Administrator may grant the SUPER_ADMIN role.'}
            </p>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <button type="submit" disabled={busy === 'create'} className="btn-primary">
              {busy === 'create' && <Loader2 className="h-4 w-4 animate-spin" />} Save user
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>User</th>
              <th>Roles</th>
              <th>Department</th>
              <th>Employee</th>
              <th>Status</th>
              <th>Last login</th>
              <th>Failed attempts</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const locked = u.lockedUntil && new Date(u.lockedUntil) > new Date();
              return (
                <tr key={u.id}>
                  <td>
                    <span className="block text-sm font-medium text-stone-800">{u.fullName}</span>
                    <span className="block text-[10px] text-stone-400">{u.email}</span>
                  </td>
                  <td>
                    <span className="block text-[10px] text-stone-600">{u.roles || '—'}</span>
                    <span className="block text-[10px] text-stone-400">primary: {u.primaryRoleCode}</span>
                  </td>
                  <td className="text-xs text-stone-600">{u.department ?? '—'}</td>
                  <td className="font-mono text-[10px] text-stone-500">{u.employeeCode ?? '—'}</td>
                  <td>
                    <StatusBadge status={locked ? 'LOCKED' : u.status} />
                  </td>
                  <td className="whitespace-nowrap text-[10px] text-stone-500">
                    {u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : 'never'}
                  </td>
                  <td className="tabular-nums text-xs">{u.failedAttempts}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <button
                        className="btn-secondary px-2 py-1 text-[10px]"
                        disabled={busy === `unlock-${u.id}`}
                        onClick={() => run(`unlock-${u.id}`, () => post(`/api/admin/users/${u.id}`, { action: 'UNLOCK', reason: 'Administrator unlock' }, { method: 'PATCH' }))}
                        title="Unlock account and revoke sessions"
                      >
                        {busy === `unlock-${u.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlock className="h-3 w-3" />} Unlock
                      </button>
                      <button
                        className="btn-secondary px-2 py-1 text-[10px]"
                        disabled={busy === `revoke-${u.id}`}
                        onClick={() => run(`revoke-${u.id}`, () => post(`/api/admin/users/${u.id}`, { action: 'REVOKE_SESSIONS', reason: 'Administrator revoked sessions' }, { method: 'PATCH' }))}
                        title="Revoke all active sessions"
                      >
                        {busy === `revoke-${u.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3 w-3" />} Sessions
                      </button>
                      {u.status === 'ACTIVE' ? (
                        <button
                          className="btn bg-amber-600 px-2 py-1 text-[10px] text-white hover:bg-amber-700"
                          disabled={busy === `deact-${u.id}`}
                          onClick={() => {
                            const reason = window.prompt(`Reason for deactivating ${u.email}:`) ?? '';
                            if (reason.trim().length < 3) return;
                            run(`deact-${u.id}`, () => post(`/api/admin/users/${u.id}`, { action: 'DEACTIVATE', reason }, { method: 'PATCH' }));
                          }}
                        >
                          {busy === `deact-${u.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldOff className="h-3 w-3" />} Deactivate
                        </button>
                      ) : (
                        <button
                          className="btn bg-emerald-600 px-2 py-1 text-[10px] text-white hover:bg-emerald-700"
                          disabled={busy === `act-${u.id}`}
                          onClick={() => run(`act-${u.id}`, () => post(`/api/admin/users/${u.id}`, { action: 'ACTIVATE', reason: 'Administrator reactivation' }, { method: 'PATCH' }))}
                        >
                          {busy === `act-${u.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />} Activate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-stone-400">
        <KeyRound className="mr-1 inline h-3 w-3" />
        Password resets use the same create/reset form: submitting an existing email sets a new
        temporary password, clears the lockout counter and revokes live sessions. Deactivating the
        last active Super Administrator is refused to prevent lockout.
      </p>
    </div>
  );
}
