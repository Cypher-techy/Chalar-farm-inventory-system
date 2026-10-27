'use client';

import { useState } from 'react';
import { visibleNav } from '@/lib/portal-nav';
import { Sidebar, Topbar } from '@/components/portal/shell';

/**
 * Client bridge that receives only serializable props from the server layout
 * (navigation filtering happens here so icon components never cross the
 * server → client serialization boundary).
 */
export default function PortalClientBridge({
  permissions,
  user,
  unreadMessages,
  unreadNotifications,
  children,
}: {
  permissions: string[];
  user: {
    id: number;
    fullName: string;
    email: string;
    primaryRoleCode: string;
    departmentName: string | null;
  };
  unreadMessages: number;
  unreadNotifications: number;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const groups = visibleNav(permissions);

  return (
    <div className="min-h-screen bg-stone-100">
      <Sidebar
        groups={groups}
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="transition-all duration-300">
        <div className={collapsed ? 'lg:pl-[68px]' : 'lg:pl-60'}>
          <Topbar
            user={user}
            unreadMessages={unreadMessages}
            unreadNotifications={unreadNotifications}
            onOpenMobileNav={() => setMobileOpen(true)}
          />
          <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
