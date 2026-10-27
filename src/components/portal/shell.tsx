'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  Search,
  LogOut,
  UserCircle2,
  MessagesSquare,
  ChevronDown,
} from 'lucide-react';
import type { NavGroup } from '@/lib/portal-nav';
import { LogoMark } from '@/components/brand/logo';

interface TopbarUser {
  id: number;
  fullName: string;
  email: string;
  primaryRoleCode: string;
  departmentName: string | null;
}

interface NotificationItem {
  id: number;
  category: string;
  title: string;
  summary: string;
  linkUrl: string;
  isRead: boolean;
  createdAt: string;
}

export function Sidebar({
  groups,
  collapsed,
  onToggle,
  mobileOpen,
  onCloseMobile,
}: {
  groups: NavGroup[];
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden
        />
      )}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/10 bg-gradient-to-b from-chalar-950 via-chalar-950 to-[#0a1a12] text-stone-200 transition-all duration-300 ease-editorial lg:translate-x-0',
          collapsed ? 'lg:w-[68px]' : 'lg:w-60',
          mobileOpen ? 'w-60 translate-x-0' : 'w-60 -translate-x-full',
        ].join(' ')}
      >
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
          <Link href="/portal" className="flex items-center gap-2 overflow-hidden" aria-label="Chalar Farms portal home">
            <LogoMark variant="compact" size={34} decorative />
            {!collapsed && (
              <span className="whitespace-nowrap font-serif text-sm font-bold text-white">
                Chalar Farms
              </span>
            )}
          </Link>
          <button
            onClick={onToggle}
            className="hidden text-stone-400 hover:text-white lg:block"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <nav className="thin-scrollbar flex-1 overflow-y-auto px-2 py-4" aria-label="Portal navigation">
          {groups.map((group) => (
            <div key={group.label} className="mb-4">
              {!collapsed && (
                <p className="kicker px-3 pb-1.5 text-[9px] text-clay-300/60">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onCloseMobile}
                        title={item.label}
                        className={[
                          'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 ease-editorial',
                          active
                            ? 'bg-white/10 font-semibold text-white'
                            : 'text-stone-300 hover:bg-white/[0.06] hover:text-white',
                          collapsed ? 'lg:justify-center lg:px-0' : '',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-clay-400 transition-opacity duration-300 ease-editorial',
                            active ? 'opacity-100' : 'opacity-0',
                          ].join(' ')}
                          aria-hidden
                        />
                        <item.icon
                          className={[
                            'h-4 w-4 shrink-0 transition-colors',
                            active ? 'text-clay-300' : 'text-stone-400 group-hover:text-clay-300',
                          ].join(' ')}
                          aria-hidden
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3 font-mono text-[10px] text-stone-500">
          {collapsed ? 'ERP' : 'Chalar Farms ERP · v1.0'}
        </div>
      </aside>
    </>
  );
}

export function Topbar({
  user,
  unreadMessages,
  unreadNotifications,
  onOpenMobileNav,
}: {
  user: TopbarUser;
  unreadMessages: number;
  unreadNotifications: number;
  onOpenMobileNav: () => void;
}) {
  const router = useRouter();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ title: string; subtitle: string; href: string }>>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [, startTransition] = useTransition();

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
      }
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Close popovers on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotifOpen(false);
        setProfileOpen(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Global search (permission-scoped server side)
  useEffect(() => {
    if (!searchOpen || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
        }
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [searchOpen, query]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH', body: JSON.stringify({ action: 'mark_all' }) });
    startTransition(() => loadNotifications());
  };

  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-stone-200/80 bg-white/85 px-4 shadow-[0_1px_2px_rgba(16,24,20,0.04)] backdrop-blur-xl">
      <button
        onClick={onOpenMobileNav}
        className="text-stone-500 hover:text-stone-800 lg:hidden"
        aria-label="Open navigation"
      >
        <PanelLeftOpen className="h-5 w-5" />
      </button>

      {/* Global search */}
      <div className="relative flex-1 max-w-md">
        <button
          onClick={() => setSearchOpen((v) => !v)}
          className="flex w-full items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2 text-sm text-stone-400 transition-all duration-200 ease-editorial hover:border-stone-300 hover:bg-white hover:text-stone-500"
        >
          <Search className="h-4 w-4" aria-hidden />
          <span>Search records you are authorized to view…</span>
        </button>
        {searchOpen && (
          <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-xl border border-stone-200/80 bg-white shadow-lift">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Batch, PO, employee, supplier, shipment…"
              className="w-full border-b border-stone-100 px-4 py-3 text-sm outline-none"
            />
            <ul className="max-h-72 overflow-y-auto">
              {query.trim().length >= 2 && results.length === 0 && (
                <li className="px-4 py-3 text-sm text-stone-400">No authorized matches.</li>
              )}
              {results.map((r) => (
                <li key={r.href + r.title}>
                  <button
                    className="block w-full px-4 py-2.5 text-left text-sm hover:bg-chalar-50"
                    onClick={() => {
                      setSearchOpen(false);
                      setQuery('');
                      router.push(r.href);
                    }}
                  >
                    <span className="font-medium text-stone-800">{r.title}</span>
                    <span className="block text-xs text-stone-400">{r.subtitle}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/portal/communications"
          className="relative rounded-md p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-chalar-700"
          aria-label={`Private messages${unreadMessages > 0 ? `, ${unreadMessages} unread` : ''}`}
        >
          <MessagesSquare className="h-5 w-5" />
          {unreadMessages > 0 && (
            <span className="animate-badge-pop absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {unreadMessages > 99 ? '99+' : unreadMessages}
            </span>
          )}
        </Link>

        <div className="relative">
          <button
            onClick={() => {
              setNotifOpen((v) => !v);
              setProfileOpen(false);
              if (!notifOpen) loadNotifications();
            }}
            className="relative rounded-md p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-chalar-700"
            aria-label={`Notifications${unreadNotifCount > 0 ? `, ${unreadNotifCount} unread` : ''}`}
          >
            <Bell className="h-5 w-5" />
            {unreadNotifCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-96 overflow-hidden rounded-xl border border-stone-200/80 bg-white shadow-lift">
              <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                <p className="text-sm font-semibold text-stone-800">Notifications</p>
                <button onClick={markAllRead} className="text-xs font-medium text-chalar-700 hover:underline">
                  Mark all read
                </button>
              </div>
              <ul className="max-h-96 overflow-y-auto divide-y divide-stone-100">
                {notifications.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-stone-400">You are all caught up.</li>
                )}
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => {
                        setNotifOpen(false);
                        router.push(n.linkUrl);
                      }}
                      className={`block w-full px-4 py-3 text-left hover:bg-stone-50 ${n.isRead ? 'opacity-70' : ''}`}
                    >
                      <span className="flex items-start gap-2">
                        {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-chalar-600" />}
                        <span className={!n.isRead ? '' : 'pl-4'}>
                          <span className="block text-xs font-bold uppercase tracking-wide text-chalar-700">
                            {n.category}
                          </span>
                          <span className="block text-sm font-medium text-stone-800">{n.title}</span>
                          <span className="block text-xs leading-relaxed text-stone-500">{n.summary}</span>
                          <span className="mt-0.5 block text-[10px] text-stone-400">
                            {new Date(n.createdAt).toLocaleString('en-KE')}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Profile menu */}
        <div className="relative">
          <button
            onClick={() => {
              setProfileOpen((v) => !v);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-stone-100"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-chalar-700 text-xs font-bold text-white">
              {user.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('')}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-xs font-semibold leading-tight text-stone-800">{user.fullName}</span>
              <span className="block text-[10px] leading-tight text-stone-400">
                {user.primaryRoleCode.replace(/_/g, ' ').toLowerCase()}
              </span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-stone-400" aria-hidden />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-xl border border-stone-200/80 bg-white shadow-lift">
              <div className="border-b border-stone-100 px-4 py-3">
                <p className="text-sm font-semibold text-stone-800">{user.fullName}</p>
                <p className="text-xs text-stone-500">{user.email}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-chalar-700">
                  {user.departmentName ?? 'No department'} · {user.primaryRoleCode.replace(/_/g, ' ')}
                </p>
              </div>
              <Link
                href="/portal/workspaces"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50"
              >
                <UserCircle2 className="h-4 w-4" aria-hidden /> Account &amp; self-service
              </Link>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 border-t border-stone-100 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" aria-hidden /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
