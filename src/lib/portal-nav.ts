import {
  LayoutDashboard,
  Users,
  Sprout,
  Warehouse,
  UserCog,
  Wallet,
  PackageCheck,
  BadgeCheck,
  ShoppingCart,
  Globe2,
  Truck,
  Wrench,
  Building2,
  MessagesSquare,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Role-appropriate navigation. Note: hiding navigation is a UX convenience
 * only — every route and API endpoint re-checks permissions server-side.
 */
export const PORTAL_NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/portal/super-admin', label: 'Super Admin', icon: LayoutDashboard, permission: 'dashboard.super_admin' },
      { href: '/portal/executive', label: 'Executive', icon: Building2, permission: 'dashboard.executive' },
      { href: '/portal/workspaces', label: 'My Workspace', icon: ClipboardList, permission: 'workspace.self_service' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/portal/farm', label: 'Farm Operations', icon: Sprout, permission: 'dashboard.farm' },
      { href: '/portal/inventory', label: 'Inventory', icon: Warehouse, permission: 'dashboard.inventory' },
      { href: '/portal/packhouse', label: 'Packhouse', icon: PackageCheck, permission: 'dashboard.packhouse' },
      { href: '/portal/qa', label: 'Quality Assurance', icon: BadgeCheck, permission: 'dashboard.qa' },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { href: '/portal/procurement', label: 'Procurement', icon: ShoppingCart, permission: 'dashboard.procurement' },
      { href: '/portal/sales', label: 'Sales & Export', icon: Globe2, permission: 'dashboard.sales' },
      { href: '/portal/logistics', label: 'Logistics', icon: Truck, permission: 'dashboard.logistics' },
    ],
  },
  {
    label: 'Corporate',
    items: [
      { href: '/portal/hr', label: 'Human Resources', icon: UserCog, permission: 'dashboard.hr' },
      { href: '/portal/finance', label: 'Finance & Payroll', icon: Wallet, permission: 'dashboard.finance' },
      { href: '/portal/maintenance', label: 'Maintenance', icon: Wrench, permission: 'dashboard.maintenance' },
      { href: '/portal/communications', label: 'Private Messages', icon: MessagesSquare, permission: 'dashboard.communications' },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/portal/supervisor', label: 'Supervisor Team', icon: Users, permission: 'workspace.supervisor' },
      { href: '/portal/auditor', label: 'Audit Workspace', icon: ClipboardList, permission: 'workspace.auditor' },
    ],
  },
];

export function visibleNav(userPermissions: string[]): NavGroup[] {
  return PORTAL_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => userPermissions.includes(item.permission)),
  })).filter((group) => group.items.length > 0);
}
