import { INITIAL_SYSTEM_ROLES } from './rbac-catalog';

/**
 * Account types a person may request on the public sign-up page, derived from
 * the real system roles so the list always matches what the portal enforces.
 *
 * Super Administrator is deliberately NOT requestable: it can only be granted
 * by an existing Super Administrator from Users & Roles.
 */

export const NON_REQUESTABLE_ROLE_CODES = new Set(['SUPER_ADMIN']);

/** Human labels for the dashboards / workspaces unlocked by each permission. */
export const DASHBOARD_LABELS: Record<string, string> = {
  'dashboard.executive': 'Executive',
  'dashboard.farm': 'Farm Operations',
  'dashboard.inventory': 'Inventory & Warehouse',
  'dashboard.hr': 'Human Resources',
  'dashboard.finance': 'Finance & Payroll',
  'dashboard.packhouse': 'Packhouse',
  'dashboard.qa': 'Quality Assurance',
  'dashboard.procurement': 'Procurement',
  'dashboard.sales': 'Sales & Export',
  'dashboard.logistics': 'Logistics',
  'dashboard.maintenance': 'Maintenance',
  'dashboard.communications': 'Communications',
  'workspace.self_service': 'My Workspace',
  'workspace.supervisor': 'Supervisor Workspace',
  'workspace.auditor': 'Audit Workspace',
};

export type AccountTypeGroup = 'Management' | 'Operations' | 'Commercial' | 'Finance & people' | 'Staff & compliance';

const GROUP_BY_ROLE: Record<string, AccountTypeGroup> = {
  EXECUTIVE_MANAGER: 'Management',
  FARM_MANAGER: 'Operations',
  PACKHOUSE_MANAGER: 'Operations',
  QA_OFFICER: 'Operations',
  INVENTORY_MANAGER: 'Operations',
  MAINTENANCE_MANAGER: 'Operations',
  LOGISTICS_OFFICER: 'Operations',
  SALES_EXPORT_MANAGER: 'Commercial',
  PROCUREMENT_OFFICER: 'Commercial',
  FINANCE_MANAGER: 'Finance & people',
  PAYROLL_OFFICER: 'Finance & people',
  HR_MANAGER: 'Finance & people',
  DEPARTMENT_SUPERVISOR: 'Staff & compliance',
  GENERAL_EMPLOYEE: 'Staff & compliance',
  AUDITOR: 'Staff & compliance',
};

/** Department usually associated with each account type (pre-selected, editable). */
const DEPARTMENT_BY_ROLE: Record<string, string> = {
  EXECUTIVE_MANAGER: 'EXEC',
  FARM_MANAGER: 'FARM',
  PACKHOUSE_MANAGER: 'PACK',
  QA_OFFICER: 'QAFOOD',
  INVENTORY_MANAGER: 'INV',
  MAINTENANCE_MANAGER: 'MAINT',
  LOGISTICS_OFFICER: 'LOG',
  SALES_EXPORT_MANAGER: 'SALEX',
  PROCUREMENT_OFFICER: 'PROC',
  FINANCE_MANAGER: 'FIN',
  PAYROLL_OFFICER: 'FIN',
  HR_MANAGER: 'HR',
  AUDITOR: 'COMP',
};

export const ACCOUNT_TYPE_GROUPS: AccountTypeGroup[] = [
  'Management',
  'Operations',
  'Commercial',
  'Finance & people',
  'Staff & compliance',
];

export interface AccountType {
  code: string;
  name: string;
  description: string;
  group: AccountTypeGroup;
  /** Route the account lands on after sign-in. */
  defaultDashboard: string;
  /** Labels of every dashboard/workspace the role can open. */
  dashboards: string[];
  suggestedDepartmentCode: string | null;
}

export const REQUESTABLE_ACCOUNT_TYPES: AccountType[] = INITIAL_SYSTEM_ROLES.filter(
  (r) => !NON_REQUESTABLE_ROLE_CODES.has(r.code)
).map((r) => ({
  code: r.code,
  name: r.name,
  description: r.description,
  group: GROUP_BY_ROLE[r.code] ?? 'Staff & compliance',
  defaultDashboard: r.defaultDashboard,
  dashboards: r.permissions.filter((p) => p in DASHBOARD_LABELS).map((p) => DASHBOARD_LABELS[p]),
  suggestedDepartmentCode: DEPARTMENT_BY_ROLE[r.code] ?? null,
}));

export function isRequestableRole(code: string): boolean {
  return REQUESTABLE_ACCOUNT_TYPES.some((a) => a.code === code);
}

export function accountTypeName(code: string): string {
  return INITIAL_SYSTEM_ROLES.find((r) => r.code === code)?.name ?? code;
}

/** Shared password policy for self-chosen passwords (same as the bootstrap admin). */
export function passwordPolicyProblem(password: string): string | null {
  if (password.length < 12) return 'Password must be at least 12 characters.';
  if (password.length > 128) return 'Password must be at most 128 characters.';
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3) return 'Password must mix at least three of: lowercase, uppercase, digits, symbols.';
  return null;
}
