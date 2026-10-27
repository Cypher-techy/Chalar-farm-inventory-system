export interface SystemRoleDefinition {
  code: string;
  name: string;
  description: string;
  defaultDashboard: string;
  permissions: string[];
}

export interface PermissionDefinition {
  code: string;
  module: string;
  action: string;
  description: string;
}

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  // Super Admin & System
  { code: 'dashboard.super_admin', module: 'ADMIN', action: 'VIEW', description: 'Access Super Administrator Dashboard' },
  { code: 'users.manage', module: 'ADMIN', action: 'MANAGE_USERS', description: 'Create, edit, activate/deactivate users and assign roles' },
  { code: 'roles.manage', module: 'ADMIN', action: 'MANAGE_SETTINGS', description: 'Create custom roles and modify permission mappings' },
  { code: 'departments.manage', module: 'ADMIN', action: 'MANAGE_SETTINGS', description: 'Manage departments, budgets, and cost centers' },
  { code: 'system.settings', module: 'ADMIN', action: 'MANAGE_SETTINGS', description: 'Configure system settings, units, categories, and integrations' },
  { code: 'audit.view', module: 'AUDIT', action: 'VIEW', description: 'View system-wide audit trails and security events' },

  // Executive
  { code: 'dashboard.executive', module: 'EXECUTIVE', action: 'VIEW', description: 'Access Consolidated Executive Management Dashboard' },
  { code: 'reports.export', module: 'REPORTS', action: 'EXPORT', description: 'Export authorized business reports to CSV and print/PDF' },

  // Farm Operations
  { code: 'dashboard.farm', module: 'FARM', action: 'VIEW', description: 'Access Farm Operations Dashboard' },
  { code: 'farm.create', module: 'FARM', action: 'CREATE', description: 'Register farms, fields, crop cycles, field activities, and harvests' },
  { code: 'farm.edit', module: 'FARM', action: 'EDIT', description: 'Update crop cycles, yield records, and field status' },

  // Inventory & Warehouse
  { code: 'dashboard.inventory', module: 'INVENTORY', action: 'VIEW', description: 'Access Inventory & Warehouse Dashboard' },
  { code: 'inventory.create', module: 'INVENTORY', action: 'CREATE', description: 'Receive goods, issue stock, transfer lots, and create SKUs' },
  { code: 'inventory.edit', module: 'INVENTORY', action: 'EDIT', description: 'Submit stock adjustments and update reorder thresholds' },
  { code: 'inventory.approve', module: 'INVENTORY', action: 'APPROVE', description: 'Approve stock adjustments and reconciliations' },

  // Human Resources
  { code: 'dashboard.hr', module: 'HR', action: 'VIEW', description: 'Access Human Resources Dashboard' },
  { code: 'hr.manage', module: 'HR', action: 'EDIT', description: 'Create and edit employees, shifts, attendance, leave, recruitment, and training' },
  { code: 'hr.sensitive', module: 'HR', action: 'SENSITIVE', description: 'Access sensitive HR records (National ID, KRA PIN, bank details, contracts)' },
  { code: 'hr.approve', module: 'HR', action: 'APPROVE', description: 'Approve leave applications, timesheets, and overtime requests' },

  // Finance & Payroll
  { code: 'dashboard.finance', module: 'FINANCE', action: 'VIEW', description: 'Access Finance & Accounting Dashboard' },
  { code: 'finance.create', module: 'FINANCE', action: 'CREATE', description: 'Record expenses, journal entries, and invoices' },
  { code: 'finance.approve', module: 'FINANCE', action: 'APPROVE', description: 'Approve expenses, budgets, and supplier payment authorizations' },
  { code: 'payroll.view', module: 'PAYROLL', action: 'VIEW', description: 'View payroll runs, statutory calculations, and payslips' },
  { code: 'payroll.manage', module: 'PAYROLL', action: 'CREATE', description: 'Prepare payroll runs and configure statutory rule versions' },
  { code: 'payroll.approve', module: 'PAYROLL', action: 'APPROVE', description: 'Approve payroll runs for disbursement' },

  // Packhouse & Production
  { code: 'dashboard.packhouse', module: 'PACKHOUSE', action: 'VIEW', description: 'Access Packhouse & Production Dashboard' },
  { code: 'packhouse.manage', module: 'PACKHOUSE', action: 'CREATE', description: 'Record produce intake, grading, washing, packing orders, and finished batches' },

  // Quality Assurance
  { code: 'dashboard.qa', module: 'QA', action: 'VIEW', description: 'Access Quality Assurance & Food Safety Dashboard' },
  { code: 'qa.inspect', module: 'QA', action: 'CREATE', description: 'Record quality inspections, non-conformities (NCR), and CAPA' },
  { code: 'qa.release', module: 'QA', action: 'APPROVE', description: 'Quarantine or release held harvest and packing batches' },

  // Procurement & Suppliers
  { code: 'dashboard.procurement', module: 'PROCUREMENT', action: 'VIEW', description: 'Access Procurement & Suppliers Dashboard' },
  { code: 'procurement.create', module: 'PROCUREMENT', action: 'CREATE', description: 'Register suppliers, purchase requisitions, POs, GRNs, and 3-way invoice match' },
  { code: 'procurement.approve', module: 'PROCUREMENT', action: 'APPROVE', description: 'Approve purchase requisitions and purchase orders' },

  // Sales & Export
  { code: 'dashboard.sales', module: 'SALES', action: 'VIEW', description: 'Access Sales & Export Operations Dashboard' },
  { code: 'sales.manage', module: 'SALES', action: 'CREATE', description: 'Manage export customers, quotations, sales orders, stock reservations, and export docs' },
  { code: 'sales.approve', module: 'SALES', action: 'APPROVE', description: 'Approve export sales orders and commercial invoices' },

  // Logistics & Dispatch
  { code: 'dashboard.logistics', module: 'LOGISTICS', action: 'VIEW', description: 'Access Logistics & Dispatch Dashboard' },
  { code: 'logistics.manage', module: 'LOGISTICS', action: 'CREATE', description: 'Manage refrigerated fleet, dispatch verification, shipments, and proof of delivery' },

  // Equipment & Maintenance
  { code: 'dashboard.maintenance', module: 'MAINTENANCE', action: 'VIEW', description: 'Access Equipment & Maintenance Dashboard' },
  { code: 'maintenance.manage', module: 'MAINTENANCE', action: 'CREATE', description: 'Register assets, preventive schedules, work orders, and spare part consumption' },

  // Private Communications
  { code: 'dashboard.communications', module: 'COMMUNICATIONS', action: 'MESSAGE', description: 'Access Private Internal Communications and send/receive authorized messages' },
  { code: 'communications.initiate_any', module: 'COMMUNICATIONS', action: 'MESSAGE', description: 'Initiate direct private or dashboard-manager conversations across departments' },

  // Workspaces (Self-Service, Supervisor, Auditor)
  { code: 'workspace.self_service', module: 'SELF_SERVICE', action: 'VIEW', description: 'Access personal profile, attendance, shifts, leave, training, and own payslips' },
  { code: 'workspace.supervisor', module: 'SUPERVISOR', action: 'VIEW', description: 'Access department team attendance, shift assignments, and team leave approvals' },
  { code: 'workspace.auditor', module: 'AUDIT', action: 'VIEW', description: 'Read-only compliance & audit inspection workspace' },
];

export const INITIAL_SYSTEM_ROLES: SystemRoleDefinition[] = [
  {
    code: 'SUPER_ADMIN',
    name: 'Super Administrator',
    description: 'Full enterprise administration, security governance, cross-dashboard oversight, and direct private messaging with any dashboard manager.',
    defaultDashboard: '/portal/super-admin',
    permissions: ALL_PERMISSIONS.map((p) => p.code),
  },
  {
    code: 'EXECUTIVE_MANAGER',
    name: 'Executive Manager',
    description: 'Executive oversight of production, exports, financials, margins, and enterprise KPIs.',
    defaultDashboard: '/portal/executive',
    permissions: [
      'dashboard.executive',
      'dashboard.farm',
      'dashboard.inventory',
      'dashboard.hr',
      'dashboard.finance',
      'dashboard.packhouse',
      'dashboard.qa',
      'dashboard.procurement',
      'dashboard.sales',
      'dashboard.logistics',
      'dashboard.maintenance',
      'dashboard.communications',
      'communications.initiate_any',
      'reports.export',
      'audit.view',
      'finance.approve',
      'procurement.approve',
      'sales.approve',
      'payroll.view',
      ' payroll.approve'.trim(),
      'workspace.self_service',
    ],
  },
  {
    code: 'FARM_MANAGER',
    name: 'Farm Manager',
    description: 'Manages Taveta herb fields, greenhouses, planting schedules, input applications, irrigation, and harvest batches.',
    defaultDashboard: '/portal/farm',
    permissions: [
      'dashboard.farm',
      'farm.create',
      'farm.edit',
      'dashboard.inventory',
      'dashboard.packhouse',
      'dashboard.communications',
      'reports.export',
      'workspace.supervisor',
      'workspace.self_service',
    ],
  },
  {
    code: 'INVENTORY_MANAGER',
    name: 'Inventory Manager',
    description: 'Controls cold rooms, agro-input stores, packaging stores, lot traceability, stock movements, and stock reconciliations.',
    defaultDashboard: '/portal/inventory',
    permissions: [
      'dashboard.inventory',
      'inventory.create',
      'inventory.edit',
      'inventory.approve',
      'dashboard.procurement',
      'dashboard.communications',
      'reports.export',
      'workspace.supervisor',
      'workspace.self_service',
    ],
  },
  {
    code: 'HR_MANAGER',
    name: 'HR Manager',
    description: 'Manages employee records, contracts, shifts, attendance, leave workflows, recruitment, training, and performance reviews.',
    defaultDashboard: '/portal/hr',
    permissions: [
      'dashboard.hr',
      'hr.manage',
      'hr.sensitive',
      'hr.approve',
      'dashboard.communications',
      'reports.export',
      'workspace.supervisor',
      'workspace.self_service',
    ],
  },
  {
    code: 'PAYROLL_OFFICER',
    name: 'Payroll Officer',
    description: 'Manages salary structures, Kenyan statutory deductions (PAYE, NSSF, SHIF, Housing Levy), payroll previews, and payslip generation.',
    defaultDashboard: '/portal/finance',
    permissions: [
      'dashboard.finance',
      'payroll.view',
      'payroll.manage',
      'hr.sensitive',
      'dashboard.communications',
      'reports.export',
      'workspace.self_service',
    ],
  },
  {
    code: 'FINANCE_MANAGER',
    name: 'Finance Manager',
    description: 'Oversees chart of accounts, general ledger journals, budgets, AP/AR invoices, expenses, and payroll approvals.',
    defaultDashboard: '/portal/finance',
    permissions: [
      'dashboard.finance',
      'finance.create',
      'finance.approve',
      'payroll.view',
      'payroll.approve',
      'procurement.approve',
      'dashboard.communications',
      'reports.export',
      'workspace.self_service',
    ],
  },
  {
    code: 'PACKHOUSE_MANAGER',
    name: 'Packhouse Manager',
    description: 'Manages harvest intake, grading, washing, sleeve/MAP packing orders, mass-balance reconciliation, and finished export cartons.',
    defaultDashboard: '/portal/packhouse',
    permissions: [
      'dashboard.packhouse',
      'packhouse.manage',
      'dashboard.inventory',
      'inventory.create',
      'dashboard.communications',
      'reports.export',
      'workspace.supervisor',
      'workspace.self_service',
    ],
  },
  {
    code: 'QA_OFFICER',
    name: 'Quality Assurance Officer',
    description: 'Executes GlobalG.A.P., HACCP, and phytosanitary inspections, cold-chain monitoring, batch quarantine/release, and CAPA.',
    defaultDashboard: '/portal/qa',
    permissions: [
      'dashboard.qa',
      'qa.inspect',
      'qa.release',
      'dashboard.packhouse',
      'dashboard.farm',
      'dashboard.communications',
      'reports.export',
      'workspace.self_service',
    ],
  },
  {
    code: 'PROCUREMENT_OFFICER',
    name: 'Procurement Officer',
    description: 'Manages supplier qualification, purchase requisitions, RFQs, purchase orders, goods receipt notes, and 3-way matching.',
    defaultDashboard: '/portal/procurement',
    permissions: [
      'dashboard.procurement',
      'procurement.create',
      'dashboard.inventory',
      'inventory.create',
      'dashboard.communications',
      'reports.export',
      'workspace.self_service',
    ],
  },
  {
    code: 'SALES_EXPORT_MANAGER',
    name: 'Sales and Export Manager',
    description: 'Manages international herb buyers (EU, UK, Middle East), export sales orders, KEPHIS phytosanitary certificates, EUR.1, and air waybills.',
    defaultDashboard: '/portal/sales',
    permissions: [
      'dashboard.sales',
      'sales.manage',
      'sales.approve',
      'dashboard.logistics',
      'dashboard.communications',
      'reports.export',
      'workspace.self_service',
    ],
  },
  {
    code: 'LOGISTICS_OFFICER',
    name: 'Logistics Officer',
    description: 'Manages refrigerated cold-chain trucks from Taveta to JKIA Nairobi, pick-and-pack verification, dispatch notes, and proof of delivery.',
    defaultDashboard: '/portal/logistics',
    permissions: [
      'dashboard.logistics',
      'logistics.manage',
      'dashboard.sales',
      'dashboard.communications',
      'reports.export',
      'workspace.self_service',
    ],
  },
  {
    code: 'MAINTENANCE_MANAGER',
    name: 'Equipment and Maintenance Manager',
    description: 'Manages cold room refrigeration units, drip irrigation pumps, tractors, preventive schedules, repair work orders, and spare parts.',
    defaultDashboard: '/portal/maintenance',
    permissions: [
      'dashboard.maintenance',
      'maintenance.manage',
      'dashboard.inventory',
      'dashboard.communications',
      'reports.export',
      'workspace.self_service',
    ],
  },
  {
    code: 'DEPARTMENT_SUPERVISOR',
    name: 'Department Supervisor',
    description: 'Supervises assigned field or packhouse team shifts, daily attendance, leave recommendations, and work execution.',
    defaultDashboard: '/portal/workspaces',
    permissions: [
      'workspace.supervisor',
      'workspace.self_service',
      'hr.approve',
      'dashboard.communications',
    ],
  },
  {
    code: 'GENERAL_EMPLOYEE',
    name: 'General Employee',
    description: 'Accesses personal employee self-service workspace: profile, attendance clock-in/out, shifts, leave applications, payslips, and training.',
    defaultDashboard: '/portal/workspaces',
    permissions: [
      'workspace.self_service',
      'dashboard.communications',
    ],
  },
  {
    code: 'AUDITOR',
    name: 'Auditor / Compliance Officer',
    description: 'Read-only access to approved operational, financial, GlobalG.A.P./SMETA traceability, and audit log records.',
    defaultDashboard: '/portal/workspaces',
    permissions: [
      'workspace.auditor',
      'audit.view',
      'dashboard.executive',
      'dashboard.farm',
      'dashboard.inventory',
      'dashboard.packhouse',
      'dashboard.qa',
      'dashboard.procurement',
      'dashboard.sales',
      'dashboard.logistics',
      'dashboard.maintenance',
      'reports.export',
      'workspace.self_service',
    ],
  },
];
