import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import type { ChalarDatabase } from './index';
import * as t from './schema';
import { ALL_PERMISSIONS, INITIAL_SYSTEM_ROLES } from '@/lib/rbac-catalog';
import { isDemoSeedEnabled } from '@/lib/demo-mode';

/**
 * Seeds the Chalar Farms ERP with clearly-labelled development/demo data.
 * All seeded records are identifiable (email domain, doc numbers, comments).
 * In production deployments (ENABLE_DEMO_SEED=false) only system config,
 * roles and permissions are seeded; the first Super Administrator comes from
 * INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD (see ./bootstrap-admin.ts).
 */

const isDemo = isDemoSeedEnabled;

function rows<T>(result: unknown): T[] {
  const r = result as { rows?: T[] } | T[];
  if (Array.isArray(r)) return r;
  return r.rows ?? [];
}

/** Budgets and balances are illustrative and are only applied when demo seeding is enabled. */
const SEED_DEPARTMENTS = [
  { code: 'EXEC', name: 'Executive Management', costCenter: 'CC-100', budget: '25000000.00' },
  { code: 'FARM', name: 'Farm Operations', costCenter: 'CC-210', budget: '48000000.00' },
  { code: 'PACK', name: 'Packhouse & Production', costCenter: 'CC-220', budget: '21000000.00' },
  { code: 'QAFOOD', name: 'Quality Assurance & Food Safety', costCenter: 'CC-230', budget: '9500000.00' },
  { code: 'INV', name: 'Inventory & Warehouse', costCenter: 'CC-310', budget: '14000000.00' },
  { code: 'PROC', name: 'Procurement & Suppliers', costCenter: 'CC-320', budget: '6500000.00' },
  { code: 'SALEX', name: 'Sales & Export', costCenter: 'CC-410', budget: '12000000.00' },
  { code: 'LOG', name: 'Logistics & Dispatch', costCenter: 'CC-420', budget: '15500000.00' },
  { code: 'FIN', name: 'Finance & Payroll', costCenter: 'CC-510', budget: '8200000.00' },
  { code: 'HR', name: 'Human Resources', costCenter: 'CC-520', budget: '7400000.00' },
  { code: 'IT', name: 'IT & Systems', costCenter: 'CC-530', budget: '3600000.00' },
  { code: 'MAINT', name: 'Equipment & Maintenance', costCenter: 'CC-610', budget: '6800000.00' },
  { code: 'COMP', name: 'Compliance & Audit', costCenter: 'CC-710', budget: '4200000.00' },
];

const SEED_ACCOUNTS = [
  { code: '1000', name: 'Cash & Cash Equivalents', type: 'ASSET', bal: '18450000.00' },
  { code: '1100', name: 'Trade Receivables (Export Customers)', type: 'ASSET', bal: '23870000.00' },
  { code: '1200', name: 'Inventory — Fresh Produce & Inputs', type: 'ASSET', bal: '31600000.00' },
  { code: '1500', name: 'Property, Plant & Equipment', type: 'ASSET', bal: '142300000.00' },
  { code: '2000', name: 'Trade Payables (Suppliers)', type: 'LIABILITY', bal: '12740000.00' },
  { code: '2100', name: 'PAYE Payable (KRA)', type: 'LIABILITY', bal: '3120000.00' },
  { code: '2110', name: 'NSSF Payable', type: 'LIABILITY', bal: '860000.00' },
  { code: '2120', name: 'SHIF Payable (MoH)', type: 'LIABILITY', bal: '740000.00' },
  { code: '2130', name: 'Affordable Housing Levy Payable', type: 'LIABILITY', bal: '470000.00' },
  { code: '3000', name: 'Retained Earnings', type: 'EQUITY', bal: '54000000.00' },
  { code: '4000', name: 'Export Sales Revenue — Fresh Herbs', type: 'REVENUE', bal: '186400000.00' },
  { code: '4100', name: 'Local Sales Revenue', type: 'REVENUE', bal: '9800000.00' },
  { code: '5000', name: 'Cost of Goods Sold — Farm Production', type: 'EXPENSE', bal: '74200000.00' },
  { code: '5100', name: 'Packaging & Cold Chain Costs', type: 'EXPENSE', bal: '18600000.00' },
  { code: '5200', name: 'Airfreight & Logistics Costs', type: 'EXPENSE', bal: '31400000.00' },
  { code: '6000', name: 'Employee Salaries & Wages', type: 'EXPENSE', bal: '52800000.00' },
  { code: '6100', name: 'Statutory Employer Contributions', type: 'EXPENSE', bal: '4900000.00' },
  { code: '6200', name: 'Utilities (Power & Water)', type: 'EXPENSE', bal: '8700000.00' },
  { code: '6300', name: 'Repairs & Maintenance', type: 'EXPENSE', bal: '4300000.00' },
  { code: '6400', name: 'Certification & Compliance Costs', type: 'EXPENSE', bal: '2600000.00' },
  { code: '7000', name: 'Bank Charges & Interest', type: 'EXPENSE', bal: '1500000.00' },
];

/** Illustrative fleet — demo databases only. */
const DEMO_VEHICLES = [
  { reg: 'KDD 441X', type: 'Refrigerated Truck (4 Tonne)', model: 'Isuzu NPR Reefer', min: '-2.0', max: '2.0', driver: 'Joseph Mwakio', phone: '+254 722 118 443', lic: 'DL-KE-8843921', route: 'Taveta Farm → JKIA Cargo Terminal, Nairobi' },
  { reg: 'KCX 902H', type: 'Refrigerated Truck (2 Tonne)', model: 'Fuso Canter Reefer', min: '2.0', max: '4.0', driver: 'Peter Chacha', phone: '+254 733 902 118', lic: 'DL-KE-7712044', route: 'Taveta Farm → Mombasa Port (sea freight consolidations)' },
  { reg: 'KDG 115B', type: 'Field Irrigation Bowser', model: 'Toyota Dyna Water Tanker', min: '0.0', max: '0.0', driver: 'Ali Juma', phone: '+254 711 348 920', lic: 'DL-KE-6621847', route: 'Internal — Chala Ward field circuit' },
  { reg: 'KCB 771M', type: 'Farm Tractor', model: 'Massey Ferguson 375', min: '0.0', max: '0.0', driver: 'Samuel Mwenda', phone: '+254 720 664 115', lic: 'DL-KE-5590112', route: 'Internal — Land preparation & seedbed' },
  { reg: 'KDZ 510F', type: 'Staff Shuttle', model: 'Toyota Hiace', min: '0.0', max: '0.0', driver: 'Grace Njeri', phone: '+254 745 220 087', lic: 'DL-KE-9930211', route: 'Voi ⇄ Taveta staff transport' },
];

/** Bump when seedSystemConfig gains new configuration that existing databases should receive. */
const CONFIG_SEED_VERSION = '1';
const SEED_MARKER_KEY = 'system.config_seed_version';

/**
 * Seeds system configuration once per database (idempotent; callers run it in a
 * transaction under an advisory lock — see getDb). Demo data is only added to a
 * brand-new database, never mixed into one that already holds records.
 */
export async function ensureSeeded(db: ChalarDatabase): Promise<void> {
  const marker = rows<{ setting_value: string }>(
    await db.execute(sql`SELECT setting_value FROM system_settings WHERE setting_key = ${SEED_MARKER_KEY}`)
  );
  if (marker[0]?.setting_value === CONFIG_SEED_VERSION) return;

  const existing = rows<{ id: number }>(
    await db.execute(sql`SELECT id FROM roles LIMIT 1`)
  );
  const freshDatabase = existing.length === 0;

  await seedSystemConfig(db);
  if (freshDatabase && isDemo()) {
    await seedDemoData(db);
  }
  if (!freshDatabase && !isDemo()) {
    await removeLegacyIllustrativeFigures(db);
  }

  await db.execute(sql`
    INSERT INTO system_settings (setting_key, setting_value, category, description)
    VALUES (${SEED_MARKER_KEY}, ${CONFIG_SEED_VERSION}, 'SYSTEM', 'Internal: version of the system configuration seed applied to this database.')
    ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;
  `);
}

/**
 * Builds before config-seed v1 wrote illustrative budgets, account balances and
 * a sample fleet even into production databases. On a production upgrade, clear
 * only rows that still hold those exact seeded values — anything staff have
 * edited or that other records reference is left untouched.
 */
async function removeLegacyIllustrativeFigures(db: ChalarDatabase): Promise<void> {
  let cleared = 0;
  for (const d of SEED_DEPARTMENTS) {
    const r = await db.execute(sql`
      UPDATE departments SET budget_allocated_kes = 0
      WHERE code = ${d.code} AND budget_allocated_kes = ${d.budget}::numeric
    `);
    cleared += Number((r as { rowCount?: number; affectedRows?: number }).rowCount ?? (r as { affectedRows?: number }).affectedRows ?? 0);
  }
  for (const a of SEED_ACCOUNTS) {
    const r = await db.execute(sql`
      UPDATE chart_of_accounts SET balance_kes = 0
      WHERE account_code = ${a.code} AND balance_kes = ${a.bal}::numeric
    `);
    cleared += Number((r as { rowCount?: number; affectedRows?: number }).rowCount ?? (r as { affectedRows?: number }).affectedRows ?? 0);
  }
  for (const v of DEMO_VEHICLES) {
    await db.execute(sql`SAVEPOINT chalar_legacy_vehicle`);
    try {
      const r = await db.execute(sql`
        DELETE FROM vehicles
        WHERE registration_number = ${v.reg} AND driver_name = ${v.driver} AND driver_license_no = ${v.lic}
      `);
      cleared += Number((r as { rowCount?: number; affectedRows?: number }).rowCount ?? (r as { affectedRows?: number }).affectedRows ?? 0);
      await db.execute(sql`RELEASE SAVEPOINT chalar_legacy_vehicle`);
    } catch {
      // Referenced by trips/maintenance records — keep it.
      await db.execute(sql`ROLLBACK TO SAVEPOINT chalar_legacy_vehicle`);
    }
  }
  if (cleared > 0) {
    console.warn(`[chalar] Cleared ${cleared} illustrative budget/balance/fleet records left by an earlier build (production mode).`);
  }
}

async function seedSystemConfig(db: ChalarDatabase): Promise<void> {
  // Monetary figures below (department budgets, account balances) and the fleet
  // list are illustrative demo values. Production databases start at zero / empty
  // so no invented financials or people appear in a live system.
  const demo = isDemo();

  // Departments
  for (const d of SEED_DEPARTMENTS) {
    const description = `${d.name} department of Chalar Farms Limited, Taita-Taveta, Kenya.`;
    await db.execute(sql`
      INSERT INTO departments (code, name, description, cost_center_code, budget_allocated_kes)
      VALUES (${d.code}, ${d.name}, ${description}, ${d.costCenter}, ${demo ? d.budget : '0.00'})
      ON CONFLICT (code) DO NOTHING;
    `);
  }

  // Permissions
  for (const p of ALL_PERMISSIONS) {
    await db.execute(sql`
      INSERT INTO permissions (code, module, action, description)
      VALUES (${p.code}, ${p.module}, ${p.action}, ${p.description})
      ON CONFLICT (code) DO NOTHING;
    `);
  }

  // Roles + role_permissions
  for (const r of INITIAL_SYSTEM_ROLES) {
    await db.execute(sql`
      INSERT INTO roles (code, name, description, default_dashboard, is_system_role)
      VALUES (${r.code}, ${r.name}, ${r.description}, ${r.defaultDashboard}, true)
      ON CONFLICT (code) DO NOTHING;
    `);
    const roleIdRows = rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM roles WHERE code = ${r.code}`)
    );
    const roleId = roleIdRows[0]?.id;
    if (!roleId) continue;
    for (const permCode of r.permissions) {
      await db.execute(sql`
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT ${roleId}, p.id FROM permissions p WHERE p.code = ${permCode}
        ON CONFLICT DO NOTHING;
      `);
    }
  }

  // Units of measure
  const uoms = [
    { code: 'KG', name: 'Kilograms', dec: 3 },
    { code: 'G', name: 'Grams', dec: 0 },
    { code: 'CRATE', name: 'Harvest Crate (15 kg)', dec: 0 },
    { code: 'CARTON', name: 'Export Carton', dec: 0 },
    { code: 'BUNCH', name: 'Retail Bunch', dec: 0 },
    { code: 'LITRE', name: 'Litres', dec: 2 },
    { code: 'BAG', name: 'Bag', dec: 0 },
    { code: 'EACH', name: 'Each', dec: 0 },
  ];
  for (const u of uoms) {
    await db.execute(sql`
      INSERT INTO units_of_measure (code, name, precision_decimals)
      VALUES (${u.code}, ${u.name}, ${u.dec})
      ON CONFLICT (code) DO NOTHING;
    `);
  }
  // unit_conversions has no unique key, so guard against duplicates on re-seed
  await db.execute(sql`
    INSERT INTO unit_conversions (from_uom_code, to_uom_code, multiplier)
    SELECT v.f, v.t, v.m FROM (VALUES
      ('G', 'KG', 0.001::numeric), ('CRATE', 'KG', 15.0::numeric), ('KG', 'G', 1000.0::numeric)
    ) AS v(f, t, m)
    WHERE NOT EXISTS (
      SELECT 1 FROM unit_conversions u WHERE u.from_uom_code = v.f AND u.to_uom_code = v.t
    );
  `);

  // Product categories
  const cats = [
    { code: 'HERB-FRESH', name: 'Fresh Herbs (Export Grade)', type: 'FINISHED_GOODS', lot: true, exp: true },
    { code: 'SEED', name: 'Seeds & Planting Materials', type: 'RAW_MATERIAL', lot: true, exp: true },
    { code: 'FERT', name: 'Fertilizers & Soil Amendments', type: 'RAW_MATERIAL', lot: true, exp: true },
    { code: 'CROP-PROT', name: 'Crop Protection Inputs', type: 'RAW_MATERIAL', lot: true, exp: true },
    { code: 'PKG', name: 'Packaging Materials', type: 'CONSUMABLE', lot: true, exp: false },
    { code: 'CONSUM', name: 'Consumables', type: 'CONSUMABLE', lot: false, exp: false },
    { code: 'TOOLS', name: 'Tools & Spare Parts', type: 'ASSET_CONSUMABLE', lot: false, exp: false },
    { code: 'WIP', name: 'Work In Progress (Harvest at Packhouse)', type: 'WIP', lot: true, exp: true },
  ];
  for (const c of cats) {
    await db.execute(sql`
      INSERT INTO product_categories (code, name, category_type, requires_lot_tracking, requires_expiry_date)
      VALUES (${c.code}, ${c.name}, ${c.type}, ${c.lot}, ${c.exp})
      ON CONFLICT (code) DO NOTHING;
    `);
  }

  // Chart of accounts (KEFRIAS-aligned simplified structure)
  for (const a of SEED_ACCOUNTS) {
    await db.execute(sql`
      INSERT INTO chart_of_accounts (account_code, account_name, account_type, balance_kes)
      VALUES (${a.code}, ${a.name}, ${a.type}, ${demo ? a.bal : '0.00'})
      ON CONFLICT (account_code) DO NOTHING;
    `);
  }

  // Statutory rule version (configurable, date-effective — verify with KRA/PPRA before production use)
  await db.execute(sql`
    INSERT INTO statutory_rule_versions (
      version_code, country_code, effective_from, personal_relief_kes,
      shif_rate_percent, ahl_employee_rate_percent, ahl_employer_rate_percent,
      nssf_tier1_limit_kes, nssf_tier2_limit_kes, nssf_rate_percent,
      paye_bands_json, is_active
    ) VALUES (
      'KE-STAT-2026-V1', 'KE', '2026-01-01', 2400.00,
      2.75, 1.50, 1.50,
      8000.00, 72000.00, 6.00,
      '[{"upToKes":24000,"ratePercent":10},{"upToKes":32333,"ratePercent":25},{"upToKes":500000,"ratePercent":30},{"upToKes":800000,"ratePercent":32.5},{"upToKes":null,"ratePercent":35}]'::jsonb,
      true
    ) ON CONFLICT (version_code) DO NOTHING;
  `);

  // Leave types (configurable — Kenyan Employment Act 2007 aligned defaults)
  const leaveTypes = [
    { code: 'ANNUAL', name: 'Annual Leave', days: 21, paid: true, basis: 'Employment Act 2007 §28 — 21 working days per completed year of service' },
    { code: 'SICK', name: 'Sick Leave', days: 60, paid: true, basis: 'Employment Act 2007 §30 — 7 days full pay + 7 days half pay after 2 consecutive months, then sick pay scheme' },
    { code: 'MATERNITY', name: 'Maternity Leave', days: 91, paid: true, basis: 'Employment Act 2007 §29 — 3 months maternity leave with full pay' },
    { code: 'PATERNITY', name: 'Paternity Leave', days: 14, paid: true, basis: 'Employment Act 2007 §29A — 2 weeks paternity leave' },
    { code: 'FAMILY', name: 'Family Responsibility Leave', days: 14, paid: true, basis: 'Employment Act 2007 §29 — up to 14 days for immediate family illness/bereavement' },
    { code: 'UNPAID', name: 'Unpaid / Study Leave', days: 30, paid: false, basis: 'Company HR policy (configurable)' },
  ];
  for (const lt of leaveTypes) {
    await db.execute(sql`
      INSERT INTO leave_types (code, name, default_annual_days, is_paid, statutory_basis)
      VALUES (${lt.code}, ${lt.name}, ${lt.days}, ${lt.paid}, ${lt.basis})
      ON CONFLICT (code) DO NOTHING;
    `);
  }

  // Shifts
  const shifts = [
    { code: 'SHIFT-DAY', name: 'Day Shift (Field & Packhouse)', s: '07:00', e: '17:00', brk: 60, hrs: '9.00' },
    { code: 'SHIFT-EARLY', name: 'Early Harvest Shift', s: '05:30', e: '14:30', brk: 60, hrs: '8.00' },
    { code: 'SHIFT-COLD', name: 'Cold Room & Dispatch Shift', s: '08:00', e: '18:00', brk: 60, hrs: '9.00' },
    { code: 'SHIFT-ADMIN', name: 'Administrative Shift', s: '08:30', e: '17:30', brk: 60, hrs: '8.00' },
  ];
  for (const s of shifts) {
    await db.execute(sql`
      INSERT INTO shifts (code, name, start_time, end_time, break_minutes, standard_hours)
      VALUES (${s.code}, ${s.name}, ${s.s}, ${s.e}, ${s.brk}, ${s.hrs})
      ON CONFLICT (code) DO NOTHING;
    `);
  }

  // System settings
  const settings = [
    { key: 'inventory.costing_method', val: 'FIFO', cat: 'INVENTORY', desc: 'Approved inventory costing method applied to all stock movements' },
    { key: 'inventory.allow_negative_stock', val: 'false', cat: 'INVENTORY', desc: 'Hard block on issuing more than available lot quantity' },
    { key: 'inventory.critical_temp_c', val: '5.0', cat: 'QUALITY', desc: 'Critical cold-chain temperature threshold (°C) for perishable export produce' },
    { key: 'payroll.statutory_version', val: 'KE-STAT-2026-V1', cat: 'PAYROLL', desc: 'Active Kenyan statutory deduction rule version for payroll runs' },
    { key: 'approvals.segregation_of_duties', val: 'true', cat: 'APPROVALS', desc: 'Prevent self-approval of requisitions, expenses, stock adjustments, and payroll' },
    { key: 'approvals.self_approval_block', val: 'true', cat: 'APPROVALS', desc: 'Reject approval actions when actor == submitter' },
    { key: 'security.password_min_length', val: '12', cat: 'SECURITY', desc: 'Minimum password length enforced at registration and password reset' },
    { key: 'security.session_ttl_hours', val: '12', cat: 'SECURITY', desc: 'Session validity window in hours' },
    { key: 'chat.private_access_policy', val: 'SUPER_ADMIN_CAN_INITIATE_WITH_ANY_DASHBOARD_MANAGER', cat: 'COMMUNICATIONS', desc: 'Super Admin may open direct private conversations with any dashboard manager; unrelated employee-to-employee threads stay private' },
    { key: 'chat.history_sharing_default', val: 'FROM_JOIN_TIME', cat: 'COMMUNICATIONS', desc: 'Default history exposure policy for newly added private group members' },
    { key: 'exports.csv_formula_escape', val: 'true', cat: 'REPORTS', desc: 'Neutralise leading =+-@ characters in CSV cells to prevent spreadsheet formula injection' },
    { key: 'company.name', val: 'Chalar Farms Limited', cat: 'COMPANY', desc: 'Legal entity name' },
    { key: 'company.location', val: 'Madulu A Village, Chala Ward, Taveta Subcounty, Taita-Taveta County, Kenya', cat: 'COMPANY', desc: 'Registered production location' },
    { key: 'company.email', val: 'info@chalarfarms.com', cat: 'COMPANY', desc: 'Official contact email' },
    { key: 'company.phone', val: '+254 722 944 496', cat: 'COMPANY', desc: 'Official contact phone' },
    { key: 'company.website', val: 'https://chalarfarms.com', cat: 'COMPANY', desc: 'Official company website' },
    { key: 'company.certifications', val: 'GLOBALG.A.P.; GRASP; SMETA; LEAF Marque', cat: 'COMPANY', desc: 'Certifications as publicly listed by the company — re-verify validity before citing externally' },
    { key: 'company.weekly_export_target_tonnes', val: '12', cat: 'COMPANY', desc: 'Published weekly fresh herb export volume target' },
  ];
  for (const s of settings) {
    await db.execute(sql`
      INSERT INTO system_settings (setting_key, setting_value, category, description)
      VALUES (${s.key}, ${s.val}, ${s.cat}, ${s.desc})
      ON CONFLICT (setting_key) DO NOTHING;
    `);
  }

  // Integrations
  const integrations = [
    {
      code: 'MPESA_DARAJA',
      name: 'M-Pesa (Safaricom Daraja API)',
      summary: '{"environment":"sandbox","flows":["B2B supplier payments","C2B customer payments"]}',
      status: 'Sandbox mode. No live credentials configured. Payments remain PENDING until official API credentials, callback verification, idempotency and reconciliation are configured and tested. No live financial transaction will be initiated.',
    },
    {
      code: 'TRANSACTIONAL_EMAIL',
      name: 'Transactional Email (SMTP / Resend)',
      summary: '{"provider":"smtp","port":587,"tls":"starttls"}',
      status: 'Disabled by default (EMAIL_PROVIDER=disabled). Configure SMTP_* environment variables to activate in-app + email notifications.',
    },
    {
      code: 'OBJECT_STORAGE',
      name: 'Private Object Storage (S3-compatible)',
      summary: '{"driver":"local","fallback":"./.storage/private-documents"}',
      status: 'Active in private local-disk mode with signed download URLs. Configure S3_* environment variables for managed private bucket storage.',
    },
  ];
  for (const i of integrations) {
    await db.execute(sql`
      INSERT INTO integration_settings (integration_code, name, mode, is_enabled, config_summary_json, status_message)
      VALUES (${i.code}, ${i.name}, 'SANDBOX', false, ${i.summary}, ${i.status})
      ON CONFLICT (integration_code) DO NOTHING;
    `);
  }

  // Fleet (demo only — real vehicles, drivers and licences are entered by staff)
  if (!demo) return;
  for (const v of DEMO_VEHICLES) {
    await db.execute(sql`
      INSERT INTO vehicles (registration_number, vehicle_type, make_model, reefer_temp_min_c, reefer_temp_max_c, driver_name, driver_phone, driver_license_no, current_route)
      VALUES (${v.reg}, ${v.type}, ${v.model}, ${v.min}, ${v.max}, ${v.driver}, ${v.phone}, ${v.lic}, ${v.route})
      ON CONFLICT (registration_number) DO NOTHING;
    `);
  }
}

async function seedDemoData(db: ChalarDatabase): Promise<void> {
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);
  const adminPw = hash('Chalar@Admin2026!');
  const demoPw = hash('Chalar@Demo2026!');

  const depId = async (code: string) => {
    const r = rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM departments WHERE code = ${code}`)
    );
    return r[0].id;
  };

  // ---------- USERS (development demo identities — clearly labelled) ----------
  const usersSeed: Array<{
    email: string;
    name: string;
    role: string;
    dept: string;
    pw: string;
    phone: string;
  }> = [
    { email: 'superadmin@chalarfarms.demo', name: 'System Administrator (Demo)', role: 'SUPER_ADMIN', dept: 'IT', pw: adminPw, phone: '+254 700 000 101' },
    { email: 'executive@chalarfarms.demo', name: 'Johnson Ngila (Demo Executive)', role: 'EXECUTIVE_MANAGER', dept: 'EXEC', pw: demoPw, phone: '+254 700 000 102' },
    { email: 'farm@chalarfarms.demo', name: 'Grace Kimathi (Demo Farm Manager)', role: 'FARM_MANAGER', dept: 'FARM', pw: demoPw, phone: '+254 700 000 103' },
    { email: 'inventory@chalarfarms.demo', name: 'David Otieno (Demo Inventory Mgr)', role: 'INVENTORY_MANAGER', dept: 'INV', pw: demoPw, phone: '+254 700 000 104' },
    { email: 'hr@chalarfarms.demo', name: 'Mercy Achieng (Demo HR Manager)', role: 'HR_MANAGER', dept: 'HR', pw: demoPw, phone: '+254 700 000 105' },
    { email: 'finance@chalarfarms.demo', name: 'Peter Kariuki (Demo Finance Mgr)', role: 'FINANCE_MANAGER', dept: 'FIN', pw: demoPw, phone: '+254 700 000 106' },
    { email: 'packhouse@chalarfarms.demo', name: 'Agnes Mwakio (Demo Packhouse Mgr)', role: 'PACKHOUSE_MANAGER', dept: 'PACK', pw: demoPw, phone: '+254 700 000 107' },
    { email: 'qa@chalarfarms.demo', name: 'Dr. Evans Mutiso (Demo QA Officer)', role: 'QA_OFFICER', dept: 'QAFOOD', pw: demoPw, phone: '+254 700 000 108' },
    { email: 'procurement@chalarfarms.demo', name: 'Fatuma Hassan (Demo Procurement)', role: 'PROCUREMENT_OFFICER', dept: 'PROC', pw: demoPw, phone: '+254 700 000 109' },
    { email: 'sales@chalarfarms.demo', name: 'Alice Wanjiku (Demo Sales & Export)', role: 'SALES_EXPORT_MANAGER', dept: 'SALEX', pw: demoPw, phone: '+254 700 000 110' },
    { email: 'logistics@chalarfarms.demo', name: 'Brian Omondi (Demo Logistics)', role: 'LOGISTICS_OFFICER', dept: 'LOG', pw: demoPw, phone: '+254 700 000 111' },
    { email: 'maintenance@chalarfarms.demo', name: 'Stephen Mutua (Demo Maintenance)', role: 'MAINTENANCE_MANAGER', dept: 'MAINT', pw: demoPw, phone: '+254 700 000 112' },
    { email: 'payroll@chalarfarms.demo', name: 'Rose Njoki (Demo Payroll Officer)', role: 'PAYROLL_OFFICER', dept: 'FIN', pw: demoPw, phone: '+254 700 000 113' },
    { email: 'supervisor@chalarfarms.demo', name: 'Charles Kilonzo (Demo Supervisor)', role: 'DEPARTMENT_SUPERVISOR', dept: 'FARM', pw: demoPw, phone: '+254 700 000 114' },
    { email: 'auditor@chalarfarms.demo', name: 'Lucy Atieno (Demo Auditor)', role: 'AUDITOR', dept: 'COMP', pw: demoPw, phone: '+254 700 000 115' },
    { email: 'employee@chalarfarms.demo', name: 'John Wekesa (Demo Employee)', role: 'GENERAL_EMPLOYEE', dept: 'PACK', pw: demoPw, phone: '+254 700 000 116' },
  ];

  for (const u of usersSeed) {
    const dId = await depId(u.dept);
    await db.execute(sql`
      INSERT INTO users (email, password_hash, full_name, phone, department_id, primary_role_code, status, last_login_at)
      VALUES (${u.email}, ${u.pw}, ${u.name}, ${u.phone}, ${dId}, ${u.role}, 'ACTIVE', now() - interval '2 hours')
      ON CONFLICT (email) DO NOTHING;
    `);
    await db.execute(sql`
      INSERT INTO user_roles (user_id, role_id)
      SELECT u.id, r.id FROM users u, roles r
      WHERE u.email = ${u.email} AND r.code = ${u.role}
      ON CONFLICT DO NOTHING;
    `);
    await db.execute(sql`
      INSERT INTO security_events (user_id, event_type, severity, ip_address, user_agent, description)
      SELECT u.id, 'SEED_ACCOUNT_PROVISIONED', 'INFO', '127.0.0.1', 'system', 'Demo account created by development seed for ' || u.email
      FROM users u WHERE u.email = ${u.email};
    `);
  }

  const uid = async (email: string) => {
    const r = rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM users WHERE email = ${email}`)
    );
    return r[0].id;
  };

  const superAdminId = await uid('superadmin@chalarfarms.demo');
  const farmMgrId = await uid('farm@chalarfarms.demo');
  const invMgrId = await uid('inventory@chalarfarms.demo');
  const hrMgrId = await uid('hr@chalarfarms.demo');
  const finMgrId = await uid('finance@chalarfarms.demo');
  const packMgrId = await uid('packhouse@chalarfarms.demo');
  const qaId = await uid('qa@chalarfarms.demo');
  const procId = await uid('procurement@chalarfarms.demo');
  const salesId = await uid('sales@chalarfarms.demo');
  const logiId = await uid('logistics@chalarfarms.demo');
  const maintId = await uid('maintenance@chalarfarms.demo');
  const payrollId = await uid('payroll@chalarfarms.demo');
  const execId = await uid('executive@chalarfarms.demo');
  const supervisorId = await uid('supervisor@chalarfarms.demo');
  const auditorId = await uid('auditor@chalarfarms.demo');
  const employeeId = await uid('employee@chalarfarms.demo');

  // Set department managers
  const mgrMap: Array<[string, number]> = [
    ['FARM', farmMgrId], ['INV', invMgrId], ['HR', hrMgrId], ['FIN', finMgrId],
    ['PACK', packMgrId], ['QAFOOD', qaId], ['PROC', procId], ['SALEX', salesId],
    ['LOG', logiId], ['MAINT', maintId], ['EXEC', execId], ['IT', superAdminId],
  ];
  for (const [code, manager] of mgrMap) {
    await db.execute(sql`
      UPDATE departments SET manager_user_id = ${manager} WHERE code = ${code};
    `);
  }

  // ---------- EMPLOYEES (HR records — clearly-labelled development demo data) ----------
  const jobCatalog = [
    // [jobTitle, departmentCode, type, salary, gender]
    ['Chief Executive Officer', 'EXEC', 'PERMANENT', 485000, 'M'],
    ['Farm Manager', 'FARM', 'PERMANENT', 215000, 'F'],
    ['Inventory & Warehouse Manager', 'INV', 'PERMANENT', 168000, 'M'],
    ['HR Manager', 'HR', 'PERMANENT', 155000, 'F'],
    ['Finance Manager', 'FIN', 'PERMANENT', 225000, 'M'],
    ['Packhouse Manager', 'PACK', 'PERMANENT', 148000, 'F'],
    ['Quality Assurance & Food Safety Manager', 'QAFOOD', 'PERMANENT', 162000, 'M'],
    ['Procurement Officer', 'PROC', 'PERMANENT', 118000, 'F'],
    ['Sales & Export Manager', 'SALEX', 'PERMANENT', 186000, 'F'],
    ['Logistics Officer', 'LOG', 'PERMANENT', 112000, 'M'],
    ['Equipment & Maintenance Manager', 'MAINT', 'PERMANENT', 134000, 'M'],
    ['Payroll Officer', 'FIN', 'PERMANENT', 96000, 'F'],
    ['Field Supervisor', 'FARM', 'PERMANENT', 74000, 'M'],
    ['Audit & Compliance Officer', 'COMP', 'PERMANENT', 128000, 'F'],
    ['Packhouse Line Supervisor', 'PACK', 'PERMANENT', 68000, 'M'],
    ['Store Assistant', 'PACK', 'PERMANENT', 42000, 'M'],
    ['Field Technician — Agronomy', 'FARM', 'PERMANENT', 58000, 'F'],
    ['Field Technician — Irrigation', 'FARM', 'PERMANENT', 56000, 'M'],
    ['Harvest Crew Lead', 'FARM', 'PERMANENT', 46000, 'F'],
    ['Packhouse Packer', 'PACK', 'SEASONAL', 28000, 'F'],
    ['Packhouse Packer', 'PACK', 'SEASONAL', 27500, 'F'],
    ['Packhouse Packer', 'PACK', 'SEASONAL', 28000, 'F'],
    ['Cold Room Operator', 'PACK', 'PERMANENT', 52000, 'M'],
    ['Quality Assurance Technician', 'QAFOOD', 'CONTRACT', 76000, 'F'],
    ['Export Documentation Officer', 'SALEX', 'PERMANENT', 88000, 'F'],
    ['Accounts Assistant', 'FIN', 'PERMANENT', 72000, 'F'],
    ['Driver — Refrigerated Fleet', 'LOG', 'CONTRACT', 64000, 'M'],
    ['Driver — Refrigerated Fleet', 'LOG', 'CONTRACT', 62000, 'M'],
    ['Mechanic / Fitter', 'MAINT', 'CONTRACT', 68000, 'M'],
    ['Irrigation Technician', 'FARM', 'PERMANENT', 54000, 'M'],
    ['Farm Handyman', 'FARM', 'CASUAL', 24000, 'M'],
    ['Nursery Technician', 'FARM', 'PERMANENT', 48000, 'F'],
    ['Security Officer', 'COMP', 'CONTRACT', 36000, 'M'],
    ['IT & Systems Officer', 'IT', 'PERMANENT', 142000, 'M'],
    ['Records & Data Clerk', 'FARM', 'CONTRACT', 52000, 'F'],
    ['Human Resource Assistant', 'HR', 'PERMANENT', 78000, 'F'],
  ] as const;

  const firstNamesM = ['John', 'Peter', 'Daniel', 'Samuel', 'Brian', 'David', 'Ali', 'Stephen', 'Joseph', 'Martin', 'Dennis', 'Felix', 'Hassan', 'Erick', 'Kelvin'];
  const firstNamesF = ['Grace', 'Mercy', 'Agnes', 'Alice', 'Fatuma', 'Rose', 'Mary', 'Esther', 'Lydia', 'Cynthia', 'Beatrice', 'Halima', 'Susan', 'Naomi', 'Tabitha'];
  const lastNames = ['Mwakio', 'Chacha', 'Kimathi', 'Otieno', 'Achieng', 'Kariuki', 'Mwakio', 'Mutiso', 'Hassan', 'Wanjiku', 'Omondi', 'Mutua', 'Njeri', 'Kilonzo', 'Wekesa', 'Mwenda', 'Nkatha', 'Said', 'Baraka', 'Juma', 'Muthoni', 'Githinji', 'Shiro', 'Mwangangi'];

  const employeesForSeed: Array<{
    code: string;
    name: string;
    userId: number | null;
    dept: string;
    job: string;
    type: string;
    status: string;
    gender: string;
    salary: number;
    hire: string;
    contractEnd: string | null;
    supervisor: number | null;
  }> = [];

  // First 16 map to the demo user accounts
  const userEmployeeMap: Array<[number, string, string, string, number, string]> = [
    // [userId, name, dept, job, salary, gender]
    [superAdminId, 'System Administrator (Demo)', 'IT', 'IT & Systems Officer', 142000, 'M'],
    [execId, 'Johnson Ngila (Demo Executive)', 'EXEC', 'Chief Executive Officer', 485000, 'M'],
    [farmMgrId, 'Grace Kimathi (Demo Farm Manager)', 'FARM', 'Farm Manager', 215000, 'F'],
    [invMgrId, 'David Otieno (Demo Inventory Mgr)', 'INV', 'Inventory & Warehouse Manager', 168000, 'M'],
    [hrMgrId, 'Mercy Achieng (Demo HR Manager)', 'HR', 'HR Manager', 155000, 'F'],
    [finMgrId, 'Peter Kariuki (Demo Finance Mgr)', 'FIN', 'Finance Manager', 225000, 'M'],
    [packMgrId, 'Agnes Mwakio (Demo Packhouse Mgr)', 'PACK', 'Packhouse Manager', 148000, 'F'],
    [qaId, 'Dr. Evans Mutiso (Demo QA Officer)', 'QAFOOD', 'Quality Assurance & Food Safety Manager', 162000, 'M'],
    [procId, 'Fatuma Hassan (Demo Procurement)', 'PROC', 'Procurement Officer', 118000, 'F'],
    [salesId, 'Alice Wanjiku (Demo Sales & Export)', 'SALEX', 'Sales & Export Manager', 186000, 'F'],
    [logiId, 'Brian Omondi (Demo Logistics)', 'LOG', 'Logistics Officer', 112000, 'M'],
    [maintId, 'Stephen Mutua (Demo Maintenance)', 'MAINT', 'Equipment & Maintenance Manager', 134000, 'M'],
    [payrollId, 'Rose Njoki (Demo Payroll Officer)', 'FIN', 'Payroll Officer', 96000, 'F'],
    [supervisorId, 'Charles Kilonzo (Demo Supervisor)', 'FARM', 'Field Supervisor', 74000, 'M'],
    [auditorId, 'Lucy Atieno (Demo Auditor)', 'COMP', 'Audit & Compliance Officer', 128000, 'F'],
    [employeeId, 'John Wekesa (Demo Employee)', 'PACK', 'Packhouse Line Supervisor', 68000, 'M'],
  ];
  let empCodeNo = 0;
  for (const [userId, name, dept, job, salary, gender] of userEmployeeMap) {
    empCodeNo += 1;
    employeesForSeed.push({
      code: `EMP-${String(empCodeNo).padStart(4, '0')}`,
      name,
      userId,
      dept,
      job,
      type: 'PERMANENT',
      status: 'ACTIVE',
      gender,
      salary,
      hire: '2024-02-05',
      contractEnd: null,
      supervisor: userId === execId ? null : execId,
    });
  }

  // Additional workforce without login accounts (yet) — casual/seasonal/contract staff
  let seedRand = 42;
  const rand = () => {
    seedRand = (seedRand * 1103515245 + 12345) % 2147483648;
    return seedRand / 2147483648;
  };
  const extraCount = 40;
  for (let i = 0; i < extraCount; i++) {
    const [job, dept, type, salary, gender] = jobCatalog[(i + 15) % jobCatalog.length];
    empCodeNo += 1;
    const male = gender === 'M';
    const first = male
      ? firstNamesM[Math.floor(rand() * firstNamesM.length)]
      : firstNamesF[Math.floor(rand() * firstNamesF.length)];
    const last = lastNames[Math.floor(rand() * lastNames.length)];
    const hireYear = 2019 + Math.floor(rand() * 7);
    const hireMonth = 1 + Math.floor(rand() * 12);
    const hireDay = 1 + Math.floor(rand() * 27);
    const isContract = type === 'CONTRACT';
    const contractEnd = isContract
      ? `${2026 + Math.floor(rand() * 2)}-${String(hireMonth).padStart(2, '0')}-${String(hireDay).padStart(2, '0')}`
      : null;
    const empStatus = i === 37 ? 'ON_LEAVE' : i === 38 ? 'TERMINATED' : 'ACTIVE';
    employeesForSeed.push({
      code: `EMP-${String(empCodeNo).padStart(4, '0')}`,
      name: `${first} ${last} (Demo)`,
      userId: null,
      dept,
      job,
      type,
      status: empStatus,
      gender,
      salary,
      hire: `${hireYear}-${String(hireMonth).padStart(2, '0')}-${String(hireDay).padStart(2, '0')}`,
      contractEnd,
      supervisor: supervisorId,
    });
  }

  for (const e of employeesForSeed) {
    const dId = await depId(e.dept);
    const nationalId = `2${String(Math.floor(rand() * 89999999) + 10000000)}`;
    const kraPin = `A${String(Math.floor(rand() * 899999999) + 100000000)}K`;
    const nssfNo = `1${String(Math.floor(rand() * 89999999) + 10000000)}`;
    const shifNo = `4${String(Math.floor(rand() * 899999999) + 100000000)}`;
    const phone = `+254 7${String(10 + Math.floor(rand() * 79))} ${String(Math.floor(rand() * 900) + 100)} ${String(Math.floor(rand() * 900) + 100)}`;
    const emailLocal = e.name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/\.$/, '');
    const empEmail = `${emailLocal}@chalarfarms.demo`;
    const salaryStr = `${e.salary}.00`;
    await db.execute(sql`
      INSERT INTO employee_profiles (employee_code, user_id, full_name, email, phone, department_id,
        job_title, employment_type, employment_status, gender, date_of_birth, hire_date,
        contract_end_date, supervisor_user_id, basic_salary_kes, pay_frequency,
        national_id_number, kra_pin, nssf_number, shif_number, bank_name, bank_account_number,
        emergency_contact_name, emergency_contact_phone, qualifications)
      VALUES (${e.code}, ${e.userId}, ${e.name}, ${empEmail}, ${phone}, ${dId},
        ${e.job}, ${e.type}, ${e.status}, ${e.gender},
        ${`${1985 + Math.floor(rand() * 15)}-${String(1 + Math.floor(rand() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rand() * 27)).padStart(2, '0')}`},
        ${e.hire}, ${e.contractEnd}, ${e.supervisor}, ${salaryStr}, 'MONTHLY',
        ${nationalId}, ${kraPin}, ${nssfNo}, ${shifNo},
        ${['KCB Bank', 'Equity Bank', 'Co-operative Bank', 'Absa Bank Kenya'][Math.floor(rand() * 4)]},
        ${String(Math.floor(rand() * 8999999999) + 1000000000)},
        ${`${lastNames[Math.floor(rand() * lastNames.length)]} (Next of Kin)`},
        ${`+254 7${String(10 + Math.floor(rand() * 79))} ${String(Math.floor(rand() * 900) + 100)} ${String(Math.floor(rand() * 900) + 100)}`},
        ${e.job.includes('Quality') ? 'BSc Food Science & Technology' : e.job.includes('Finance') || e.job.includes('Payroll') ? 'CPA Part II' : e.job.includes('Mechanic') ? 'Trade Test Certificate — Motor Vehicle Mechanics' : e.job.includes('Farm') || e.job.includes('Field') || e.job.includes('Irrigation') || e.job.includes('Nursery') ? 'Diploma in Agriculture' : 'Secondary School Certificate + Internal Training'})
      ON CONFLICT (employee_code) DO NOTHING;
    `);
  }

  // ---------- FARMS, FIELDS, CROPS ----------
  await db.execute(sql`
    INSERT INTO farms (code, name, county, sub_county, ward, gps_coordinates, total_area_hectares,
      certification_global_gap, certification_grasp, certification_smeta, manager_user_id, status)
    VALUES ('FARM-CHALA-01', 'Chalar Chala Farm', 'Taita-Taveta', 'Taveta', 'Chala',
      '-3.3986, 37.6821', 42.50, 'GLOBALG.A.P. Certified (verify certificate validity externally)',
      'GRASP Certified (verify certificate validity externally)',
      'SMETA audited (verify report validity externally)', ${farmMgrId}, 'ACTIVE')
    ON CONFLICT (code) DO NOTHING;
  `);
  await db.execute(sql`
    INSERT INTO farms (code, name, county, sub_county, ward, gps_coordinates, total_area_hectares,
      certification_global_gap, certification_grasp, certification_smeta, manager_user_id, status)
    VALUES ('FARM-LAKE-02', 'Chalar Lake-Side Blocks', 'Taita-Taveta', 'Taveta', 'Chala',
      '-3.4102, 37.6955', 18.20, 'Not applicable (expansion block — pending certification)',
      'Not applicable', 'Not applicable', ${farmMgrId}, 'ACTIVE')
    ON CONFLICT (code) DO NOTHING;
  `);

  const farm1 = rows<{ id: number }>(
    await db.execute(sql`SELECT id FROM farms WHERE code = 'FARM-CHALA-01'`)
  )[0].id;
  const farm2 = rows<{ id: number }>(
    await db.execute(sql`SELECT id FROM farms WHERE code = 'FARM-LAKE-02'`)
  )[0].id;

  const fieldsSeed = [
    { farm: farm1, code: 'FLD-GH-A1', name: 'Greenhouse Block A1', type: 'GREENHOUSE', ha: '1.20', soil: 'Red loam', irr: 'Drip irrigation (Netafim)', gps: '-3.3981, 37.6817' },
    { farm: farm1, code: 'FLD-GH-A2', name: 'Greenhouse Block A2', type: 'GREENHOUSE', ha: '1.20', soil: 'Red loam', irr: 'Drip irrigation (Netafim)', gps: '-3.3983, 37.6822' },
    { farm: farm1, code: 'FLD-OF-B1', name: 'Open Field Block B1 (Rosemary)', type: 'OPEN_FIELD', ha: '4.50', soil: 'Sandy loam', irr: 'Drip irrigation', gps: '-3.3986, 37.6830' },
    { farm: farm1, code: 'FLD-OF-B2', name: 'Open Field Block B2 (Thyme)', type: 'OPEN_FIELD', ha: '3.80', soil: 'Sandy loam', irr: 'Drip irrigation', gps: '-3.3990, 37.6835' },
    { farm: farm1, code: 'FLD-SN-C1', name: 'Shade Net Block C1 (Basil)', type: 'SHADE_NET', ha: '2.60', soil: 'Red loam', irr: 'Sprinkler + drip', gps: '-3.3995, 37.6840' },
    { farm: farm2, code: 'FLD-OF-D1', name: 'Lake-Side Open Block D1 (Lemongrass)', type: 'OPEN_FIELD', ha: '5.40', soil: 'Alluvial', irr: 'Gravity + drip', gps: '-3.4105, 37.6960' },
  ];
  for (const f of fieldsSeed) {
    await db.execute(sql`
      INSERT INTO fields (farm_id, field_code, name, field_type, area_hectares, soil_type, irrigation_type, gps_coordinates)
      VALUES (${f.farm}, ${f.code}, ${f.name}, ${f.type}, ${f.ha}, ${f.soil}, ${f.irr}, ${f.gps})
      ON CONFLICT (field_code) DO NOTHING;
    `);
  }

  const cropSeed = [
    { code: 'CRP-BASIL', name: 'Basil', variety: 'Genovese', sci: 'Ocimum basilicum', days: 45, yld: '26000', min: '8', max: '10', shelf: 11, hs: '07099900', pk: 'Bunches: 30g, 75g, 100g; Liners 1–3kg; sleeves & MAP bags', wk: '6000', img: '/images/chalar/greenhouse-sweet-basil.jpg' },
    { code: 'CRP-THYME', name: 'Thyme', variety: 'Common Thyme', sci: 'Thymus vulgaris', days: 60, yld: '9000', min: '3', max: '4', shelf: 14, hs: '07099900', pk: 'Bunches: 30g, 75g, 100g; Liners 1–3kg', wk: '300', img: '/images/chalar/rosemary-blossom.jpg' },
    { code: 'CRP-ROSEMARY', name: 'Rosemary', variety: 'Tuscan Blue', sci: 'Salvia rosmarinus', days: 75, yld: '8500', min: '3', max: '4', shelf: 14, hs: '07099900', pk: 'Bunches: 30g, 75g, 100g; Liners 1–3kg', wk: '300', img: '/images/chalar/drip-irrigated-rosemary.jpg' },
    { code: 'CRP-CHIVES', name: 'Chives', variety: 'Common Chives', sci: 'Allium schoenoprasum', days: 50, yld: '18000', min: '2', max: '4', shelf: 14, hs: '07099900', pk: 'Bunches: 30g, 75g, 100g; Double-cut', wk: '1000', img: '/images/chalar/fresh-herb-bundle.jpg' },
    { code: 'CRP-TARRAGON', name: 'Tarragon', variety: 'French Tarragon', sci: 'Artemisia dracunculus', days: 55, yld: '7500', min: '3', max: '5', shelf: 14, hs: '07099900', pk: 'Bunches: 30g, 75g, 100g', wk: '250', img: '/images/chalar/culinary-herb-garden.jpg' },
    { code: 'CRP-SAGE', name: 'Sage', variety: 'Common Sage', sci: 'Salvia officinalis', days: 70, yld: '9500', min: '3', max: '5', shelf: 14, hs: '07099900', pk: 'Bunches: 30g, 75g, 100g', wk: '600', img: '/images/chalar/farm-fields-greenhouses.jpg' },
    { code: 'CRP-LEMONGRASS', name: 'Lemongrass', variety: 'East African', sci: 'Cymbopogon citratus', days: 90, yld: '14000', min: '3', max: '5', shelf: 14, hs: '07099900', pk: 'Bunches 100g; Liners 1–3kg', wk: '1000', img: '/images/chalar/farm-aerial-taveta.jpg' },
    { code: 'CRP-OREGANO', name: 'Oregano', variety: 'Italian Oregano', sci: 'Origanum vulgare', days: 55, yld: '7000', min: '3', max: '5', shelf: 14, hs: '07099900', pk: 'Bunches: 30g, 75g, 100g', wk: '200', img: '/images/chalar/packhouse-herb-crates.jpg' },
    { code: 'CRP-MINT', name: 'Mint', variety: 'Spearmint', sci: 'Mentha spicata', days: 40, yld: '15000', min: '3', max: '5', shelf: 12, hs: '07099900', pk: 'Bunches: 30g, 75g, 100g', wk: '450', img: '/images/chalar/fresh-herb-bundle.jpg' },
    { code: 'CRP-DILL', name: 'Dill', variety: 'Bouquet', sci: 'Anethum graveolens', days: 42, yld: '12000', min: '3', max: '5', shelf: 12, hs: '07099900', pk: 'Bunches: 30g, 75g, 100g', wk: '180', img: '/images/chalar/culinary-herb-garden.jpg' },
  ];
  for (const c of cropSeed) {
    await db.execute(sql`
      INSERT INTO crop_catalog (code, name, variety, scientific_name, category, cycle_days,
        expected_yield_kg_per_ha, cold_chain_min_c, cold_chain_max_c, shelf_life_days,
        hs_code, packaging_specs, weekly_target_kg, image_url)
      VALUES (${c.code}, ${c.name}, ${c.variety}, ${c.sci}, 'Culinary Fresh Herb', ${c.days},
        ${c.yld}, ${c.min}, ${c.max}, ${c.shelf}, ${c.hs}, ${c.pk}, ${c.wk}, ${c.img})
      ON CONFLICT (code) DO NOTHING;
    `);
  }

  const cropId = async (code: string) =>
    rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM crop_catalog WHERE code = ${code}`)
    )[0].id;
  const fieldId = async (code: string) =>
    rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM fields WHERE field_code = ${code}`)
    )[0].id;

  // ---------- PRODUCTS ----------
  const catId = async (code: string) =>
    rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM product_categories WHERE code = ${code}`)
    )[0].id;

  const herbCat = await catId('HERB-FRESH');
  const wipCat = await catId('WIP');
  const pkgCat = await catId('PKG');
  const fertCat = await catId('FERT');
  const protCat = await catId('CROP-PROT');
  const seedCat = await catId('SEED');
  const toolCat = await catId('TOOLS');
  const consumCat = await catId('CONSUM');

  const herbProducts = [
    { sku: 'HERB-BASIL-75', bc: '5449000134015', name: 'Fresh Basil Bunch 75g (Export)', crop: 'CRP-BASIL', price: '1.85', stock: '486.000', reorder: '250' },
    { sku: 'HERB-BASIL-30', bc: '5449000134022', name: 'Fresh Basil Bunch 30g (Export)', crop: 'CRP-BASIL', price: '0.95', stock: '720.000', reorder: '300' },
    { sku: 'HERB-THYME-75', bc: '5449000134039', name: 'Fresh Thyme Bunch 75g (Export)', crop: 'CRP-THYME', price: '2.40', stock: '168.000', reorder: '80' },
    { sku: 'HERB-ROSEMARY-75', bc: '5449000134046', name: 'Fresh Rosemary Bunch 75g (Export)', crop: 'CRP-ROSEMARY', price: '2.15', stock: '142.000', reorder: '70' },
    { sku: 'HERB-CHIVES-75', bc: '5449000134053', name: 'Fresh Chives Bunch 75g (Export)', crop: 'CRP-CHIVES', price: '2.60', stock: '96.000', reorder: '60' },
    { sku: 'HERB-TARRAGON-75', bc: '5449000134060', name: 'Fresh Tarragon Bunch 75g (Export)', crop: 'CRP-TARRAGON', price: '2.75', stock: '54.000', reorder: '60' },
    { sku: 'HERB-SAGE-75', bc: '5449000134077', name: 'Fresh Sage Bunch 75g (Export)', crop: 'CRP-SAGE', price: '2.30', stock: '88.000', reorder: '50' },
    { sku: 'HERB-LEMONGRASS-100', bc: '5449000134084', name: 'Fresh Lemongrass Bunch 100g (Export)', crop: 'CRP-LEMONGRASS', price: '1.95', stock: '124.000', reorder: '60' },
    { sku: 'HERB-OREGANO-75', bc: '5449000134091', name: 'Fresh Oregano Bunch 75g (Export)', crop: 'CRP-OREGANO', price: '2.55', stock: '38.000', reorder: '50' },
    { sku: 'HERB-MINT-75', bc: '5449000134107', name: 'Fresh Mint Bunch 75g (Export)', crop: 'CRP-MINT', price: '2.10', stock: '76.000', reorder: '50' },
    { sku: 'HERB-DILL-75', bc: '5449000134114', name: 'Fresh Dill Bunch 75g (Export)', crop: 'CRP-DILL', price: '2.35', stock: '42.000', reorder: '40' },
  ];
  for (const p of herbProducts) {
    const cid = await cropId(p.crop);
    await db.execute(sql`
      INSERT INTO products (sku, barcode, name, category_id, uom_code, unit_cost_kes, selling_price_eur,
        reorder_level, safety_stock_level, physical_stock, reserved_stock, available_stock, crop_id)
      VALUES (${p.sku}, ${p.bc}, ${p.name}, ${herbCat}, 'BUNCH', 145.00, ${p.price},
        ${p.reorder}, ${p.reorder}, ${p.stock}, '0.000', ${p.stock}, ${cid})
      ON CONFLICT (sku) DO NOTHING;
    `);
  }

  const nonHerbProducts = [
    { sku: 'WIP-HARVEST-KG', bc: '5449000134121', name: 'WIP — Harvested Herbs at Packhouse Intake', cat: wipCat, uom: 'KG', cost: '86.00', price: '0.00', reorder: '0', safety: '0', stock: '318.500' },
    { sku: 'PKG-SLEEVE-75', bc: '5449000134138', name: 'Retail Sleeve Film 75g (printed, compostable)', cat: pkgCat, uom: 'EACH', cost: '4.20', price: '0.00', reorder: '20000', safety: '10000', stock: '48500.000' },
    { sku: 'PKG-MAP-BAG-1KG', bc: '5449000134145', name: 'MAP Liner Bag 1kg (modified atmosphere)', cat: pkgCat, uom: 'EACH', cost: '11.50', price: '0.00', reorder: '8000', safety: '4000', stock: '15400.000' },
    { sku: 'PKG-CARTON-EXPORT', bc: '5449000134152', name: 'Export Carton 5kg (ventilated, KEPHIS stamped)', cat: pkgCat, uom: 'EACH', cost: '145.00', price: '0.00', reorder: '2500', safety: '1200', stock: '6840.000' },
    { sku: 'PKG-LABEL-LOT', bc: '5449000134169', name: 'Pre-printed Lot / Traceability Label Roll', cat: pkgCat, uom: 'EACH', cost: '1.80', price: '0.00', reorder: '15000', safety: '8000', stock: '9200.000' },
    { sku: 'FERT-NPK-18', bc: '5449000134176', name: 'NPK 18:18:18 Fertiliser 50kg', cat: fertCat, uom: 'BAG', cost: '5850.00', price: '0.00', reorder: '12', safety: '6', stock: '24.000' },
    { sku: 'FERT-CANNA-A', bc: '5449000134183', name: 'Calcium Nitrate 20kg (greenhouse)', cat: fertCat, uom: 'BAG', cost: '4200.00', price: '0.00', reorder: '10', safety: '5', stock: '8.000' },
    { sku: 'FERT-COMPOST', bc: '5449000134190', name: 'Certified Compost 40kg', cat: fertCat, uom: 'BAG', cost: '950.00', price: '0.00', reorder: '30', safety: '15', stock: '46.000' },
    { sku: 'PROT-IMIDACLOPRID', bc: '5449000134206', name: 'Imidacloprid 300SL 500ml (approved crop protection)', cat: protCat, uom: 'EACH', cost: '1850.00', price: '0.00', reorder: '6', safety: '3', stock: '2.000' },
    { sku: 'PROT-COPPER-OXY', bc: '5449000134213', name: 'Copper Oxychloride 500g', cat: protCat, uom: 'EACH', cost: '1200.00', price: '0.00', reorder: '8', safety: '4', stock: '11.000' },
    { sku: 'SEED-BASIL-GEN', bc: '5449000134220', name: 'Basil Genovese Seed 50g (certified)', cat: seedCat, uom: 'EACH', cost: '6500.00', price: '0.00', reorder: '4', safety: '2', stock: '6.000' },
    { sku: 'SEED-CLONE-THYME', bc: '5449000134237', name: 'Thyme Tissue-Culture Plantlets (tray of 100)', cat: seedCat, uom: 'EACH', cost: '9800.00', price: '0.00', reorder: '5', safety: '3', stock: '3.000' },
    { sku: 'TOOL-PRUNER', bc: '5449000134244', name: 'Harvest Pruning Shear (Felco 2)', cat: toolCat, uom: 'EACH', cost: '4800.00', price: '0.00', reorder: '5', safety: '3', stock: '42.000' },
    { sku: 'TOOL-DRIP-ELBOW', bc: '5449000134251', name: 'Drip Irrigation Elbow 16mm (spare)', cat: toolCat, uom: 'EACH', cost: '55.00', price: '0.00', reorder: '200', safety: '100', stock: '146.000' },
    { sku: 'TOOL-REEFER-FILTER', bc: '5449000134268', name: 'Cold Room Compressor Filter Drier', cat: toolCat, uom: 'EACH', cost: '7600.00', price: '0.00', reorder: '2', safety: '1', stock: '1.000' },
    { sku: 'CONSUM-GLOVE-NITRILE', bc: '5449000134275', name: 'Nitrile Gloves (box of 100)', cat: consumCat, uom: 'EACH', cost: '850.00', price: '0.00', reorder: '20', safety: '10', stock: '34.000' },
    { sku: 'CONSUM-ANTISEPTIC', bc: '5449000134282', name: 'Food-Grade Hand Sanitiser 5L', cat: consumCat, uom: 'EACH', cost: '2400.00', price: '0.00', reorder: '6', safety: '3', stock: '4.000' },
  ];
  for (const p of nonHerbProducts) {
    await db.execute(sql`
      INSERT INTO products (sku, barcode, name, category_id, uom_code, unit_cost_kes, selling_price_eur,
        reorder_level, safety_stock_level, physical_stock, reserved_stock, available_stock, crop_id)
      VALUES (${p.sku}, ${p.bc}, ${p.name}, ${p.cat}, ${p.uom}, ${p.cost}, ${p.price},
        ${p.reorder}, ${p.safety}, ${p.stock}, '0.000', ${p.stock}, NULL)
      ON CONFLICT (sku) DO NOTHING;
    `);
  }

  // ---------- WAREHOUSES & BINS ----------
  const warehouses = [
    { code: 'WH-COLD1', name: 'Packhouse Cold Room 1', type: 'COLD_ROOM', temp: '2.0°C – 4.0°C (perishable export produce)', cap: '18000', loc: 'Chala Packhouse Complex, Taveta' },
    { code: 'WH-COLD2', name: 'Packhouse Cold Room 2 (Quarantine)', type: 'QUARANTINE_COLD_ROOM', temp: '2.0°C – 4.0°C (QA holds)', cap: '6000', loc: 'Chala Packhouse Complex, Taveta' },
    { code: 'WH-AGRI', name: 'Agro-Inputs Store', type: 'SECURE_STORE', temp: 'Ambient, ventilated', cap: '12000', loc: 'Farm Stores, Chala' },
    { code: 'WH-PKG', name: 'Packaging Materials Warehouse', type: 'DRY_STORE', temp: 'Ambient, dry', cap: '20000', loc: 'Packhouse Annex' },
    { code: 'WH-TOOL', name: 'Tools & Spares Workshop Store', type: 'WORKSHOP_STORE', temp: 'Ambient', cap: '5000', loc: 'Maintenance Yard' },
    { code: 'WH-FIN', name: 'Finished Goods Staging Area', type: 'DRY_STORE', temp: '15.0°C – 18.0°C', cap: '8000', loc: 'Dispatch Dock, Packhouse' },
  ];
  for (const w of warehouses) {
    await db.execute(sql`
      INSERT INTO warehouses (code, name, warehouse_type, temperature_range_c, capacity_kg, location, manager_user_id, is_active)
      VALUES (${w.code}, ${w.name}, ${w.type}, ${w.temp}, ${w.cap}, ${w.loc}, ${invMgrId}, true)
      ON CONFLICT (code) DO NOTHING;
    `);
  }
  const bins = [
    { wh: 'WH-COLD1', bin: 'CR1-A01', zone: 'A (Leafy herbs)', cap: '1800' },
    { wh: 'WH-COLD1', bin: 'CR1-A02', zone: 'A (Leafy herbs)', cap: '1800' },
    { wh: 'WH-COLD1', bin: 'CR1-B01', zone: 'B (Woody herbs)', cap: '1500' },
    { wh: 'WH-COLD1', bin: 'CR1-B02', zone: 'B (Woody herbs)', cap: '1500' },
    { wh: 'WH-COLD2', bin: 'CR2-Q01', zone: 'QA Quarantine', cap: '2000' },
    { wh: 'WH-AGRI', bin: 'AG-F01', zone: 'Fertilisers', cap: '4000' },
    { wh: 'WH-AGRI', bin: 'AG-P01', zone: 'Crop Protection (locked)', cap: '2000' },
    { wh: 'WH-AGRI', bin: 'AG-S01', zone: 'Seeds & Planting Material', cap: '1500' },
    { wh: 'WH-PKG', bin: 'PK-R01', zone: 'Rolls & Films', cap: '6000' },
    { wh: 'WH-PKG', bin: 'PK-C01', zone: 'Cartons', cap: '8000' },
    { wh: 'WH-TOOL', bin: 'TL-G01', zone: 'Hand Tools', cap: '1200' },
    { wh: 'WH-TOOL', bin: 'TL-S01', zone: 'Spare Parts', cap: '1500' },
    { wh: 'WH-FIN', bin: 'FG-D01', zone: 'Dispatch Staging', cap: '4000' },
  ];
  for (const b of bins) {
    const whId = rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM warehouses WHERE code = ${b.wh}`)
    )[0].id;
    await db.execute(sql`
      INSERT INTO storage_locations (warehouse_id, bin_code, zone, max_capacity_kg)
      VALUES (${whId}, ${b.bin}, ${b.zone}, ${b.cap})
      ON CONFLICT (bin_code) DO NOTHING;
    `);
  }

  // ---------- SUPPLIERS, CUSTOMERS ----------
  const suppliers = [
    { code: 'SUP-FERT-001', name: 'Twiga Fertilisers Kenya Ltd', cat: 'Fertilisers & Soil Amendments', contact: 'Michael Otieno', email: 'sales@twigafertilisers.demo', phone: '+254 20 555 0142', pin: 'P051123456K', days: 30, rate: '4.70' },
    { code: 'SUP-SEED-002', name: 'Kenya Seed Company Ltd', cat: 'Seeds & Planting Materials', contact: 'Amina Yusuf', email: 'orders@kennyseed.demo', phone: '+254 20 555 0178', pin: 'P041987654K', days: 21, rate: '4.85' },
    { code: 'SUP-PKG-003', name: 'PlastiPack Industries Ltd', cat: 'Packaging Materials', contact: 'Raj Patel', email: 'exports@plastipack.demo', phone: '+254 110 555 300', pin: 'P071555987K', days: 45, rate: '4.60' },
    { code: 'SUP-CHEM-004', name: 'Davis & Shirtliff Agrochemicals', cat: 'Crop Protection Inputs', contact: 'Sarah Njoroge', email: 'agro@davisshirtliff.demo', phone: '+254 711 555 880', pin: 'P021333445K', days: 30, rate: '4.90' },
    { code: 'SUP-FLT-005', name: 'Kenya Airways Cargo', cat: 'Freight & Logistics', contact: 'Cargo Desk', email: 'cargo@kenyaairways.demo', phone: '+254 20 555 900', pin: 'P001122334K', days: 14, rate: '4.75' },
    { code: 'SUP-LAB-006', name: 'KEPHIS Phytosanitary Services', cat: 'Certification & Laboratory Services', contact: 'Lab Intake Desk', email: 'lab@kephis.demo', phone: '+254 20 555 471', pin: 'P001000200K', days: 7, rate: '4.95' },
    { code: 'SUP-SPARE-007', name: 'Voi Industrial Spares Ltd', cat: 'Equipment Spares & Maintenance', contact: 'Hassan Mohamed', email: 'sales@voiindustrial.demo', phone: '+254 746 555 119', pin: 'P081777888K', days: 30, rate: '4.55' },
    { code: 'SUP-WATER-008', name: 'Taveta Water Services Co.', cat: 'Utilities', contact: 'Accounts', email: 'billing@tavetawater.demo', phone: '+254 762 555 043', pin: 'P051009988K', days: 30, rate: '4.40' },
    { code: 'SUP-POWER-009', name: 'Kenya Power — Taveta Station', cat: 'Utilities', connContact: '', contact: 'Regional Office', email: 'taveta@kplc.demo', phone: '+254 20 555 771', pin: 'P001000001K', days: 14, rate: '4.35' },
    { code: 'SUP-COLD-010', name: 'Cold Chain Systems Kenya', cat: 'Cold Room Equipment & Maintenance', contact: 'Brian Kiplagat', email: 'service@coldchain.demo', phone: '+254 720 555 661', pin: 'P061444555K', days: 45, rate: '4.80' },
  ];
  for (const s of suppliers) {
    await db.execute(sql`
      INSERT INTO suppliers (supplier_code, name, category, contact_person, email, phone, kra_pin, payment_terms_days, rating)
      VALUES (${s.code}, ${s.name}, ${s.cat}, ${s.contact}, ${s.email}, ${s.phone}, ${s.pin}, ${s.days}, ${s.rate})
      ON CONFLICT (supplier_code) DO NOTHING;
    `);
  }

  const customers = [
    { code: 'CUS-VIT-UK', name: 'Vitacress Herbs Ltd (UK)', type: 'Top-10 Global Herb Buyer', country: 'United Kingdom', iata: 'LHR', contact: 'Buyer Desk', email: 'buyers@vitacress.demo', phone: '+44 1234 555 001', cur: 'EUR', limit: '60000.00', inc: 'CIP', temp: '2.0°C – 4.0°C' },
    { code: 'CUS-FCH-UK', name: 'Fresh Choice UK Ltd', type: 'Top-10 Global Herb Buyer', country: 'United Kingdom', iata: 'LGW', contact: 'Produce Team', email: 'orders@freshchoice.demo', phone: '+44 1234 555 002', cur: 'EUR', limit: '45000.00', inc: 'CIP', temp: '2.0°C – 4.0°C' },
    { code: 'CUS-VANV-NL', name: 'VanVugt Kruiden B.V. (Netherlands)', type: 'Top-10 Global Herb Buyer', country: 'Netherlands', iata: 'AMS', contact: 'Sourcing Desk', email: 'sourcing@vanvugt.demo', phone: '+31 20 555 003', cur: 'EUR', limit: '70000.00', inc: 'CIP', temp: '2.0°C – 4.0°C' },
    { code: 'CUS-GAIA-NL', name: 'Gaia Fresh B.V. (Netherlands)', type: 'Top-10 Global Herb Buyer', country: 'Netherlands', iata: 'AMS', contact: 'Import Desk', email: 'import@gaiafresh.demo', phone: '+31 20 555 004', cur: 'EUR', limit: '35000.00', inc: 'CIP', temp: '2.0°C – 4.0°C' },
    { code: 'CUS-HKR-DE', name: 'Herrmann Kräuter GmbH (Germany)', type: 'Top-10 Global Herb Buyer', country: 'Germany', iata: 'FRA', contact: 'Einkauf', email: 'einkauf@herrmannkrauter.demo', phone: '+49 69 555 005', cur: 'EUR', limit: '50000.00', inc: 'CIP', temp: '2.0°C – 4.0°C' },
    { code: 'CUS-MAG-IT', name: 'Magnani Erbe S.r.l. (Italy)', type: 'Top-10 Global Herb Buyer', country: 'Italy', iata: 'MXP', contact: 'Acquisti', email: 'acquisti@magnanierbe.demo', phone: '+39 02 555 006', cur: 'EUR', limit: '30000.00', inc: 'CIP', temp: '2.0°C – 4.0°C' },
    { code: 'CUS-BAUR-CH', name: 'Baur GmbH (Switzerland)', type: 'Top-10 Global Herb Buyer', country: 'Switzerland', iata: 'BSL', contact: 'Purchase', email: 'purchase@baur.demo', phone: '+41 61 555 007', cur: 'EUR', limit: '28000.00', inc: 'CIP', temp: '2.0°C – 4.0°C' },
    { code: 'CUS-AFR-ZA', name: 'Afrex Agriculture (South Africa)', type: 'Top-10 Global Herb Buyer', country: 'South Africa', iata: 'JNB', contact: 'Buyer Office', email: 'buyers@afrex.demo', phone: '+27 11 555 008', cur: 'ZAR', limit: '520000.00', inc: 'CIP', temp: '2.0°C – 5.0°C' },
    { code: 'CUS-LAU-ME', name: 'Lauren International (Middle East)', type: 'Top-10 Global Herb Buyer', country: 'United Arab Emirates', iata: 'DXB', contact: 'Trading Desk', email: 'trade@laureninternational.demo', phone: '+971 4 555 009', cur: 'AED', limit: '180000.00', inc: 'CIP', temp: '2.0°C – 5.0°C' },
    { code: 'CUS-RETAIL-KE', name: 'Naivas Supermarket — Fresh Desk (Local)', type: 'Domestic Retailer', country: 'Kenya', iata: 'NBO', contact: 'Fresh Category', email: 'fresh@naivas.demo', phone: '+254 711 555 100', cur: 'KES', limit: '2500000.00', inc: 'DAP', temp: '2.0°C – 6.0°C' },
    { code: 'CUS-HORECA-KE', name: 'Hero Chefs Kenya — HORECA (Local)', type: 'Domestic HORECA Distributor', country: 'Kenya', iata: 'NBO', contact: 'Procurement', email: 'orders@herochefs.demo', phone: '+254 733 555 101', cur: 'KES', limit: '1500000.00', inc: 'DAP', temp: '2.0°C – 6.0°C' },
  ];
  for (const c of customers) {
    await db.execute(sql`
      INSERT INTO customers (customer_code, name, buyer_type, country, destination_airport_code, contact_person,
        email, phone, currency, credit_limit_eur, incoterms, cold_chain_spec_c)
      VALUES (${c.code}, ${c.name}, ${c.type}, ${c.country}, ${c.iata}, ${c.contact},
        ${c.email}, ${c.phone}, ${c.cur}, ${c.limit}, ${c.inc}, ${c.temp})
      ON CONFLICT (customer_code) DO NOTHING;
    `);
  }

  // ---------- CROP CYCLES ----------
  const cycles = [
    { code: 'CC-2026-BAS-A1', field: 'FLD-GH-A1', crop: 'CRP-BASIL', plant: '2026-09-10', exp: '2026-10-25', ha: '1.20', seed: 'BC-GH-26-014', seedkg: '0.80', expy: '31200', act: '0.00', waste: '0.00', cost: '412000.00', st: 'HARVESTING' },
    { code: 'CC-2026-BAS-A2', field: 'FLD-GH-A2', crop: 'CRP-BASIL', plant: '2026-09-24', exp: '2026-11-08', ha: '1.20', seed: 'BC-GH-26-015', seedkg: '0.80', expy: '31200', act: '0.00', waste: '0.00', cost: '398000.00', st: 'GROWING' },
    { code: 'CC-2026-THY-B2', field: 'FLD-OF-B2', crop: 'CRP-THYME', plant: '2026-08-18', exp: '2026-10-17', ha: '3.80', seed: 'TC-TH-26-007', seedkg: '4.20', expy: '34200', act: '18450.00', waste: '620.00', cost: '865000.00', st: 'HARVESTING' },
    { code: 'CC-2026-ROS-B1', field: 'FLD-OF-B1', crop: 'CRP-ROSEMARY', plant: '2026-07-30', exp: '2026-10-14', ha: '4.50', seed: 'CL-RO-26-003', seedkg: '6.50', expy: '38250', act: '22100.00', waste: '480.00', cost: '1120000.00', st: 'HARVESTING' },
    { code: 'CC-2026-LEM-D1', field: 'FLD-OF-D1', crop: 'CRP-LEMONGRASS', plant: '2026-07-12', exp: '2026-10-10', ha: '5.40', seed: 'SC-LE-26-002', seedkg: '840.00', expy: '75600', act: '41200.00', waste: '1500.00', cost: '1485000.00', st: 'HARVESTING' },
    { code: 'CC-2026-CHV-A1', field: 'FLD-GH-A1', crop: 'CRP-CHIVES', plant: '2026-10-05', exp: '2026-11-24', ha: '1.20', seed: 'TC-CH-26-011', seedkg: '1.10', expy: '21600', act: '0.00', waste: '0.00', cost: '305000.00', st: 'PLANTED' },
    { code: 'CC-2026-TAR-C1', field: 'FLD-SN-C1', crop: 'CRP-TARRAGON', plant: '2026-08-29', exp: '2026-10-23', ha: '2.60', seed: 'CL-TA-26-004', seedkg: '2.40', expy: '19500', act: '11200.00', waste: '310.00', cost: '540000.00', st: 'HARVESTING' },
    { code: 'CC-2026-SAG-B1', field: 'FLD-OF-B1', crop: 'CRP-SAGE', plant: '2026-10-18', exp: '2026-12-27', ha: '4.50', seed: 'CL-SA-26-006', seedkg: '5.10', expy: '42750', act: '0.00', waste: '0.00', cost: '980000.00', st: 'PLANTED' },
  ];
  for (const c of cycles) {
    const fId = await fieldId(c.field);
    const crId = await cropId(c.crop);
    await db.execute(sql`
      INSERT INTO crop_cycles (cycle_code, field_id, crop_id, planting_date, expected_harvest_date,
        planted_area_ha, seed_lot_number, seed_quantity_kg, expected_yield_kg, actual_harvested_kg,
        wastage_kg, production_cost_kes, status, supervisor_user_id, notes)
      VALUES (${c.code}, ${fId}, ${crId}, ${c.plant}, ${c.exp},
        ${c.ha}, ${c.seed}, ${c.seedkg}, ${c.expy}, ${c.act},
        ${c.waste}, ${c.cost}, ${c.st}, ${supervisorId},
        'Development demo crop cycle — sample data for ERP validation')
      ON CONFLICT (cycle_code) DO NOTHING;
    `);
  }

  const cycleId = async (code: string) =>
    rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM crop_cycles WHERE cycle_code = ${code}`)
    )[0].id;

  // ---------- FIELD ACTIVITIES ----------
  const activities: Array<[string, string, string, string | null, string | null, string | null, string | null, string, string]> = [
    ['CC-2026-BAS-A1', 'PLANTING', '2026-09-10', 'Basil Genovese transplants', 'BC-GH-26-014', '3600', 'EACH', '120', 'Transplanted 3,600 seedlings across 1.2 ha greenhouse block'],
    ['CC-2026-BAS-A1', 'FERTILIZER_APPLICATION', '2026-09-15', 'NPK 18:18:18', 'F-NPK-26-091', '480', 'KG', '95', 'Fertigation via drip — 40 kg/ha split dose'],
    ['CC-2026-BAS-A1', 'IRRIGATION', '2026-09-18', null, null, null, null, '30', 'Daily drip cycle 45 min, soil moisture 62%'],
    ['CC-2026-BAS-A1', 'PEST_SCOUTING', '2026-09-26', null, null, null, null, '15', 'Aphid pressure low (2/50 plants); whitefly absent'],
    ['CC-2026-BAS-A1', 'CROP_PROTECTION', '2026-10-02', 'Imidacloprid 300SL', 'CP-IMI-26-112', '1.5', 'LITRE', '85', 'Targeted banded application; PHI 7 days observed'],
    ['CC-2026-THY-B2', 'WEEDING', '2026-09-14', null, null, null, null, '240', 'Inter-row mechanical weeding, 16 labourers × 6 hours'],
    ['CC-2026-THY-B2', 'IRRIGATION', '2026-09-28', null, null, null, null, '60', 'Drip 60 min alternate days — drought stress avoided'],
    ['CC-2026-ROS-B1', 'FERTILIZER_APPLICATION', '2026-09-02', 'Certified Compost', 'CM-26-047', '1800', 'BAG', '110', 'Basal compost application before wet spell'],
    ['CC-2026-ROS-B1', 'PEST_SCOUTING', '2026-10-06', null, null, null, null, '40', 'Powdery mildew risk moderate — copper oxychloride standby'],
    ['CC-2026-LEM-D1', 'CROP_PROTECTION', '2026-09-20', 'Copper Oxychloride', 'CP-CU-26-088', '22', 'KG', '160', 'Preventive spray after persistent humidity; PHI 14 days'],
    ['CC-2026-TAR-C1', 'IRRIGATION', '2026-10-01', null, null, null, null, '45', 'Sprinkler 25 min morning cycle under shade net'],
    ['CC-2026-CHV-A1', 'PLANTING', '2026-10-05', 'Chives tissue culture plantlets', 'TC-CH-26-011', '1100', 'EACH', '110', '1,100 plantlets established — demo cycle'],
  ];
  for (const a of activities) {
    const cId = await cycleId(a[0]);
    const fId = rows<{ field_id: number }>(
      await db.execute(sql`SELECT field_id FROM crop_cycles WHERE id = ${cId}`)
    )[0].field_id;
    const phiDays = a[1] === 'CROP_PROTECTION' ? (a[6] === 'LITRE' ? 7 : 14) : 0;
    await db.execute(sql`
      INSERT INTO field_activities (crop_cycle_id, field_id, activity_type, activity_date,
        input_name, input_lot_number, input_quantity, input_unit, phi_days, labour_count, labour_hours,
        cost_kes, pest_or_disease_finding, recorded_by_user_id, notes)
      VALUES (${cId}, ${fId}, ${a[1]}, ${a[2]}, ${a[3]}, ${a[4]}, ${a[5]}, ${a[6]}, ${phiDays},
        16, '7.50', ${a[7]}, ${a[8]}, ${farmMgrId}, 'Development demo field activity')
      ON CONFLICT DO NOTHING;
    `);
  }

  // ---------- HARVEST BATCHES ----------
  const harvests = [
    { num: 'HB-2026-10-0421', cyc: 'CC-2026-BAS-A1', crp: 'CRP-BASIL', d: '2026-10-24', kg: '2840.00', rej: '86.00', net: '2754.00', crates: '190', temp: '14.50', st: 'IN_PACKHOUSE' },
    { num: 'HB-2026-10-0422', cyc: 'CC-2026-THY-B2', crp: 'CRP-THYME', d: '2026-10-24', kg: '410.00', rej: '12.00', net: '398.00', crates: '28', temp: '15.00', st: 'PACKED' },
    { num: 'HB-2026-10-0423', cyc: 'CC-2026-ROS-B1', crp: 'CRP-ROSEMARY', d: '2026-10-25', kg: '386.00', rej: '9.00', net: '377.00', crates: '26', temp: '16.20', st: 'PACKED' },
    { num: 'HB-2026-10-0424', cyc: 'CC-2026-LEM-D1', crp: 'CRP-LEMONGRASS', d: '2026-10-25', kg: '1240.00', rej: '40.00', net: '1200.00', crates: '80', temp: '17.00', st: 'IN_PACKHOUSE' },
    { num: 'HB-2026-10-0425', cyc: 'CC-2026-TAR-C1', crp: 'CRP-TARRAGON', d: '2026-10-25', kg: '318.00', rej: '8.00', net: '310.00', crates: '22', temp: '15.50', st: 'IN_PACKHOUSE' },
    { num: 'HB-2026-10-0426', cyc: 'CC-2026-BAS-A1', crp: 'CRP-BASIL', d: '2026-10-25', kg: '2610.00', rej: '74.00', net: '2536.00', crates: '174', temp: '14.00', st: 'IN_PACKHOUSE' },
    { num: 'HB-2026-10-0427', cyc: 'CC-2026-THY-B2', crp: 'CRP-THYME', d: '2026-10-25', kg: '395.00', rej: '10.00', net: '385.00', crates: '27', temp: '15.20', st: 'IN_PACKHOUSE' },
    { num: 'HB-2026-10-0428', cyc: 'CC-2026-SAG-B1', crp: 'CRP-SAGE', d: '2026-10-25', kg: '260.00', rej: '0.00', net: '260.00', crates: '18', temp: '16.00', st: 'QUARANTINED' },
  ];
  for (const h of harvests) {
    const cId = await cycleId(h.cyc);
    const crId = await cropId(h.crp);
    const cyc = rows<{ field_id: number }>(
      await db.execute(sql`SELECT field_id FROM crop_cycles WHERE id = ${cId}`)
    )[0];
    await db.execute(sql`
      INSERT INTO harvest_batches (batch_number, crop_cycle_id, field_id, crop_id, harvest_date,
        harvested_weight_kg, rejected_field_weight_kg, net_transferred_kg, crates_count, field_temp_c,
        destination, status, harvested_by_user_id, notes)
      VALUES (${h.num}, ${cId}, ${cyc.field_id}, ${crId}, ${h.d},
        ${h.kg}, ${h.rej}, ${h.net}, ${h.crates}, ${h.temp},
        'PACKHOUSE', ${h.st}, ${farmMgrId}, 'Development demo harvest batch')
      ON CONFLICT (batch_number) DO NOTHING;
    `);
    // roll up actual harvest on cycle
    await db.execute(sql`
      UPDATE crop_cycles SET actual_harvested_kg = (
        SELECT COALESCE(SUM(harvested_weight_kg), 0) FROM harvest_batches WHERE crop_cycle_id = ${cId}
      ) WHERE id = ${cId};
    `);
  }

  const hbId = async (num: string) =>
    rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM harvest_batches WHERE batch_number = ${num}`)
    )[0].id;
  const prodId = async (sku: string) =>
    rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM products WHERE sku = ${sku}`)
    )[0].id;
  const whId = async (code: string) =>
    rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM warehouses WHERE code = ${code}`)
    )[0].id;

  // ---------- PACKING ORDERS & BATCHES ----------
  const packings = [
    { code: 'PO-2026-10-0188', hb: 'HB-2026-10-0422', crp: 'CRP-THYME', prod: 'HERB-THYME-75', intake: '398.00', it: '14.80', acc: '372.00', rej: '18.00', wash: '2.50', out: '351.50', var: '8.00', fmt: '75g bunches in sleeves', units: '4686', packProd: 'PKG-SLEEVE-75', packQty: '4686', labour: 16, cost: '41500.00', st: 'COMPLETED' },
    { code: 'PO-2026-10-0189', hb: 'HB-2026-10-0423', crp: 'CRP-ROSEMARY', prod: 'HERB-ROSEMARY-75', intake: '377.00', it: '15.40', acc: '356.00', rej: '15.00', wash: '2.00', out: '339.00', var: '5.00', fmt: '75g bunches in sleeves', units: '4520', packProd: 'PKG-SLEEVE-75', packQty: '4520', labour: 16, cost: '39800.00', st: 'COMPLETED' },
    { code: 'PO-2026-10-0190', hb: 'HB-2026-10-0421', crp: 'CRP-BASIL', prod: 'HERB-BASIL-75', intake: '2754.00', it: '13.90', acc: '2610.00', rej: '96.00', wash: '18.00', out: '2496.00', var: '30.00', fmt: '75g & 30g mixed sleeve run', units: '36800', packProd: 'PKG-SLEEVE-75', packQty: '36800', labour: 22, cost: '176400.00', st: 'PACKING' },
    { code: 'PO-2026-10-0191', hb: 'HB-2026-10-0424', crp: 'CRP-LEMONGRASS', prod: 'HERB-LEMONGRASS-100', intake: '1200.00', it: '16.50', acc: '1148.00', rej: '34.00', wash: '6.00', out: '1108.00', var: '12.00', fmt: '100g bunches in MAP liners', units: '11080', packProd: 'PKG-MAP-BAG-1KG', packQty: '1108', labour: 18, cost: '98600.00', st: 'GRADING' },
    { code: 'PO-2026-10-0192', hb: 'HB-2026-10-0425', crp: 'CRP-TARRAGON', prod: 'HERB-TARRAGON-75', intake: '310.00', it: '15.10', acc: '294.00', rej: '10.00', wash: '2.00', out: '282.00', var: '4.00', fmt: '75g bunches in sleeves', units: '3760', packProd: 'PKG-SLEEVE-75', packQty: '3760', labour: 15, cost: '34200.00', st: 'INTAKE' },
    { code: 'PO-2026-10-0193', hb: 'HB-2026-10-0427', crp: 'CRP-THYME', prod: 'HERB-THYME-75', intake: '385.00', it: '14.60', acc: '362.00', rej: '16.00', wash: '2.50', out: '343.50', var: '6.50', fmt: '75g bunches in sleeves', units: '4580', packProd: 'PKG-SLEEVE-75', packQty: '4580', labour: 16, cost: '40800.00', st: 'INTAKE' },
  ];
  for (const p of packings) {
    const hId = await hbId(p.hb);
    const crId = await cropId(p.crp);
    const tProd = await prodId(p.prod);
    const pProd = await prodId(p.packProd);
    await db.execute(sql`
      INSERT INTO packing_orders (order_code, harvest_batch_id, crop_id, target_product_id,
        intake_weight_kg, intake_temp_c, graded_accepted_kg, graded_rejected_kg, washing_loss_kg,
        packed_output_kg, unaccounted_variance_kg, pack_format, units_packed_count,
        packaging_product_id, packaging_qty_used, labour_count, production_cost_kes, status, supervisor_user_id)
      VALUES (${p.code}, ${hId}, ${crId}, ${tProd},
        ${p.intake}, ${p.it}, ${p.acc}, ${p.rej}, ${p.wash},
        ${p.out}, ${p.var}, ${p.fmt}, ${p.units},
        ${pProd}, ${p.packQty}, ${p.labour}, ${p.cost}, ${p.st}, ${packMgrId})
      ON CONFLICT (order_code) DO NOTHING;
    `);
  }

  const completedPackings = [
    { code: 'PB-2026-10-0091', po: 'PO-2026-10-0188', hb: 'HB-2026-10-0422', prod: 'HERB-THYME-75', kg: '351.50', cartons: '14', temp: '3.20', exp: '2026-11-08' },
    { code: 'PB-2026-10-0092', po: 'PO-2026-10-0189', hb: 'HB-2026-10-0423', prod: 'HERB-ROSEMARY-75', kg: '339.00', cartons: '13', temp: '3.40', exp: '2026-11-08' },
  ];
  for (const pb of completedPackings) {
    const poId = rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM packing_orders WHERE order_code = ${pb.po}`)
    )[0].id;
    const hId = await hbId(pb.hb);
    const fProd = await prodId(pb.prod);
    // create linked cold-room lot
    const whCold1 = await whId('WH-COLD1');
    await db.execute(sql`
      INSERT INTO inventory_lots (lot_number, product_id, warehouse_id, bin_code, harvest_batch_id,
        physical_qty, available_qty, unit_cost_kes, received_date, expiry_date, quality_status)
      VALUES (${'LOT-' + pb.code.slice(3)}, ${fProd}, ${whCold1}, 'CR1-A01', ${hId},
        ${pb.kg}, ${pb.kg}, 145.00, '2026-10-25', ${pb.exp}, 'AVAILABLE')
      ON CONFLICT (lot_number) DO NOTHING;
    `);
    const lotId = rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM inventory_lots WHERE lot_number = ${'LOT-' + pb.code.slice(3)}`)
    )[0].id;
    await db.execute(sql`
      INSERT INTO packing_batches (packing_batch_code, packing_order_id, harvest_batch_id,
        finished_product_id, inventory_lot_id, grade, net_weight_kg, cartons_count, cold_room_temp_c,
        qa_status, packed_date, expiry_date)
      VALUES (${pb.code}, ${poId}, ${hId}, ${fProd}, ${lotId}, 'CLASS_I_EXPORT',
        ${pb.kg}, ${pb.cartons}, ${pb.temp}, 'PASSED', '2026-10-25', ${pb.exp})
      ON CONFLICT (packing_batch_code) DO NOTHING;
    `);
  }

  // ---------- QUALITY INSPECTIONS ----------
  const inspections = [
    { code: 'QI-2026-10-0311', stage: 'INCOMING_HARVEST', hb: 'HB-2026-10-0421', lot: null, sw: '0.50', temp: '13.90', max: '15.00', def: '1.80', res: 'PASS', qs: 'NONE', notes: 'Field heat removed within 45 min of harvest; visual grade acceptable', insp: qaId },
    { code: 'QI-2026-10-0312', stage: 'IN_PROCESS_PACKHOUSE', hb: 'HB-2026-10-0422', lot: null, sw: '0.50', temp: '14.80', max: '15.00', def: '2.40', res: 'PASS', qs: 'NONE', notes: 'Grading line 2 hygiene check passed; chlorinated wash water verified', insp: qaId },
    { code: 'QI-2026-10-0313', stage: 'FINISHED_COLD_CHAIN', hb: null, lot: 'LOT-2026-10-0091', sw: '1.00', temp: '3.20', max: '5.00', def: '0.90', res: 'PASS', qs: 'NONE', notes: 'Cold room pull-down verified; carton integrity OK', insp: qaId },
    { code: 'QI-2026-10-0314', stage: 'PRE_EXPORT_PHYTOSANITARY', hb: null, lot: 'LOT-2026-10-0092', sw: '1.00', temp: '3.40', max: '5.00', def: '1.20', res: 'PASS', qs: 'NONE', notes: 'Sample prepared for KEPHIS pre-shipment inspection request', insp: qaId },
    { code: 'QI-2026-10-0315', stage: 'INCOMING_HARVEST', hb: 'HB-2026-10-0428', lot: null, sw: '0.50', temp: '16.00', max: '15.00', def: '6.50', res: 'FAIL_QUARANTINE', qs: 'QUARANTINED', notes: 'Sage batch exceeded max intake temperature (16.0°C > 15.0°C) and defect rate 6.5% > 5% threshold — placed on hold pending supervisor review', insp: qaId },
  ];
  for (const q of inspections) {
    const hbNum = q.hb;
    const lotNum = q.lot;
    const hbCol = hbNum ? await hbId(hbNum) : null;
    const lotId = lotNum
      ? rows<{ id: number }>(
          await db.execute(sql`SELECT id FROM inventory_lots WHERE lot_number = ${lotNum}`)
        )[0]?.id ?? null
      : null;
    await db.execute(sql`
      INSERT INTO quality_inspections (inspection_code, stage, harvest_batch_id, inventory_lot_id,
        sample_weight_kg, measured_temp_c, max_allowed_temp_c, defect_percent, result, quarantine_status,
        inspector_user_id, notes, inspected_at)
      VALUES (${q.code}, ${q.stage}, ${hbCol}, ${lotId},
        ${q.sw}, ${q.temp}, ${q.max}, ${q.def}, ${q.res}, ${q.qs},
        ${q.insp}, ${q.notes}, now() - (${q.res === 'PASS' ? 36 : 6} * interval '1 hour'))
      ON CONFLICT (inspection_code) DO NOTHING;
    `);
    if (q.res === 'FAIL_QUARANTINE' && hbNum) {
      await db.execute(sql`
        UPDATE harvest_batches SET status = 'QUARANTINED' WHERE batch_number = ${hbNum};
      `);
    }
  }

  // ---------- NONCONFORMITY (NCR) ----------
  await db.execute(sql`
    INSERT INTO nonconformities (ncr_number, inspection_id, severity, category, description, root_cause,
      corrective_action, preventive_action, assigned_to_user_id, status, due_date)
    SELECT 'NCR-2026-10-044', qi.id, 'MAJOR', 'Cold Chain',
      'Harvest batch HB-2026-10-0428 (sage) arrived at packhouse intake at 16.0°C exceeding the 15.0°C maximum field-heat threshold, with 6.5% field defect rate.',
      'Delay between cutting and cold room transfer during morning peak; two field crates held on loading bay during tray restaging.',
      'Batch placed in quarantine cold room CR2-Q01. QA re-inspects after 6h pull-down; supervisor briefed on immediate field-to-packhouse transfer protocol.',
      'Introduce mandatory 30-minute harvest-to-cooling SLA with bay-level logger; add intake temperature alert on packhouse weighing scale workflow.',
      ${qaId}, 'OPEN', '2026-10-31'
    FROM quality_inspections qi WHERE qi.inspection_code = 'QI-2026-10-0315'
    ON CONFLICT (ncr_number) DO NOTHING;
  `);

  // ---------- STOCK MOVEMENTS ----------
  const stockMovements = [
    { mv: 'SM-2026-10-0101', type: 'PRODUCTION_OUTPUT', sku: 'HERB-THYME-75', to: 'WH-COLD1', qty: '351.500', cost: '145.00', refT: 'PACKING_BATCH', refId: 'PB-2026-10-0091', reason: 'Packing batch PB-2026-10-0091 finished output receipt', by: packMgrId },
    { mv: 'SM-2026-10-0102', type: 'PRODUCTION_OUTPUT', sku: 'HERB-ROSEMARY-75', to: 'WH-COLD1', qty: '339.000', cost: '145.00', refT: 'PACKING_BATCH', refId: 'PB-2026-10-0092', reason: 'Packing batch PB-2026-10-0092 finished output receipt', by: packMgrId },
    { mv: 'SM-2026-10-0103', type: 'RECEIPT', sku: 'FERT-NPK-18', to: 'WH-AGRI', qty: '12.000', cost: '5850.00', refT: 'GRN', refId: 'GRN-2026-10-0210', reason: 'Goods received — NPK 18:18:18 from Twiga Fertilisers Kenya Ltd', by: procId },
    { mv: 'SM-2026-10-0104', type: 'RECEIPT', sku: 'PKG-SLEEVE-75', to: 'WH-PKG', qty: '50000.000', cost: '4.20', refT: 'GRN', refId: 'GRN-2026-10-0211', reason: 'Goods received — printed sleeve film from PlastiPack Industries Ltd', by: procId },
    { mv: 'SM-2026-10-0105', type: 'RECEIPT', sku: 'PKG-CARTON-EXPORT', to: 'WH-PKG', qty: '4000.000', cost: '145.00', refT: 'GRN', refId: 'GRN-2026-10-0212', reason: 'Goods received — export cartons from PlastiPack Industries Ltd', by: procId },
    { mv: 'SM-2026-10-0106', type: 'ISSUE', sku: 'PKG-SLEEVE-75', from: 'WH-PKG', to: 'WH-PACK', qty: '4406.000', cost: '4.20', refT: 'PACKING_ORDER', refId: 'PO-2026-10-0188', reason: 'Sleeve film issued to packing lines (orders 0188 + 0189)', by: invMgrId },
    { mv: 'SM-2026-10-0107', type: 'ISSUE', sku: 'PKG-SLEEVE-75', from: 'WH-PKG', to: 'WH-PACK', qty: '4520.000', cost: '4.20', refT: 'PACKING_ORDER', refId: 'PO-2026-10-0189', reason: 'Sleeve film issued to packing line — rosemary run', by: invMgrId },
    { mv: 'SM-2026-10-0108', type: 'ISSUE', sku: 'FERT-NPK-18', from: 'WH-AGRI', to: null, qty: '2.000', cost: '5850.00', refT: 'FIELD_ACTIVITY', refId: 'FA-2026-0915', reason: 'Fertigation issue to Greenhouse Block A1 — basil cycle CC-2026-BAS-A1', by: farmMgrId },
    { mv: 'SM-2026-10-0109', type: 'ISSUE', sku: 'CONSUM-GLOVE-NITRILE', from: 'WH-AGRI', to: 'WH-PACK', qty: '4.000', cost: '850.00', refT: 'PACKHOUSE', refId: 'SAFETY-STOCK', reason: 'Weekly PPE issue to packhouse hygiene stations', by: invMgrId },
    { mv: 'SM-2026-10-0110', type: 'ISSUE', sku: 'TOOL-REEFER-FILTER', from: 'WH-TOOL', to: null, qty: '1.000', cost: '7600.00', refT: 'WORK_ORDER', refId: 'WO-2026-0177', reason: 'Cold Room 1 compressor service — preventive maintenance WO-2026-0177', by: maintId },
    { mv: 'SM-2026-10-0111', type: 'RECEIPT', sku: 'PROT-COPPER-OXY', to: 'WH-AGRI', qty: '6.000', cost: '1200.00', refT: 'GRN', refId: 'GRN-2026-0213', reason: 'Goods received — Copper Oxychloride from Davis & Shirtliff Agrochemicals', by: procId },
    { mv: 'SM-2026-10-0112', type: 'ISSUE', sku: 'PROT-COPPER-OXY', from: 'WH-AGRI', to: null, qty: '1.000', cost: '1200.00', refT: 'FIELD_ACTIVITY', refId: 'FA-2026-0920', reason: 'Preventive spray issue to Lake-Side Block D1 — lemongrass cycle', by: farmMgrId },
    { mv: 'SM-2026-10-0113', type: 'ISSUE', sku: 'PKG-CARTON-EXPORT', from: 'WH-PKG', to: 'WH-FIN', qty: '27.000', cost: '145.00', refT: 'PACKING_ORDER', refId: 'PO-2026-10-0188', reason: 'Export cartons issued for thyme + rosemary finished batches', by: invMgrId },
  ];
  for (const m of stockMovements) {
    const skuid = await prodId(m.sku);
    const toWh = m.to ? await whId(m.to === 'WH-PACK' ? 'WH-PKG' : m.to) : null;
    const fromWh = m.from ? await whId(m.from === 'WH-PACK' ? 'WH-PKG' : m.from) : null;
    const total = (
      parseFloat(m.qty) * parseFloat(m.cost)
    ).toFixed(2);
    const idem = `SEED-${m.mv}`;
    await db.execute(sql`
      INSERT INTO stock_movements (movement_number, idempotency_key, movement_type, product_id,
        from_warehouse_id, to_warehouse_id, quantity, uom_code, unit_cost_kes, total_cost_kes,
        reference_type, reference_id, reason, performed_by_user_id)
      VALUES (${m.mv}, ${idem}, ${m.type}, ${skuid},
        ${fromWh}, ${toWh}, ${m.qty}, 'KG', ${m.cost}, ${total},
        ${m.refT}, ${m.refId}, ${m.reason}, ${m.by})
      ON CONFLICT (idempotency_key) DO NOTHING;
    `);
  }

  // ---------- PROCUREMENT: REQUISITIONS, POs, GRNs, INVOICES ----------
  const requisitions = [
    { num: 'PR-2026-10-0071', dept: 'FARM', sku: 'FERT-CANNA-A', qty: '15', cost: '4200', tot: '63000', why: 'Greenhouse calcium nitrate replenishment for Nov planting wave', st: 'APPROVED', req: farmMgrId, app: finMgrId },
    { num: 'PR-2026-10-0072', dept: 'PACK', sku: 'PKG-MAP-BAG-1KG', qty: '5000', cost: '11.50', tot: '57500', why: 'MAP liner bag restock ahead of EU lemongrass programme', st: 'APPROVED', req: packMgrId, app: finMgrId },
    { num: 'PR-2026-10-0073', dept: 'MAINT', sku: 'TOOL-REEFER-FILTER', qty: '4', cost: '7600', tot: '30400', why: 'Cold Room 1 & 2 quarterly compressor servicing filter kits', st: 'PENDING_APPROVAL', req: maintId, app: null },
    { num: 'PR-2026-10-0074', dept: 'QAFOOD', sku: 'CONSUM-ANTISEPTIC', qty: '12', cost: '2400', tot: '28800', why: 'Hygiene station sanitiser top-up for peak packhouse throughput', st: 'PENDING_APPROVAL', req: qaId, app: null },
    { num: 'PR-2026-10-0075', dept: 'FARM', sku: 'SEED-BASIL-GEN', qty: '4', cost: '6500', tot: '26000', why: 'Q1 2027 basil seed order lead time 8 weeks — early procurement', st: 'REJECTED', req: farmMgrId, app: finMgrId },
  ];
  for (const r of requisitions) {
    const dId = await depId(r.dept);
    const skuid = await prodId(r.sku);
    await db.execute(sql`
      INSERT INTO purchase_requisitions (req_number, department_id, product_id, quantity,
        estimated_unit_cost_kes, total_estimated_kes, justification, status,
        requested_by_user_id, approved_by_user_id, approved_at)
      VALUES (${r.num}, ${dId}, ${skuid}, ${r.qty},
        ${r.cost}, ${r.tot}, ${r.why}, ${r.st},
        ${r.req}, ${r.app}, CASE WHEN ${r.st} = 'APPROVED' THEN now() - interval '2 days' ELSE NULL END)
      ON CONFLICT (req_number) DO NOTHING;
    `);
  }

  const supId = async (code: string) =>
    rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM suppliers WHERE supplier_code = ${code}`)
    )[0].id;

  const pos = [
    { num: 'PO-2026-10-0141', req: 'PR-2026-10-0071', sup: 'SUP-FERT-001', sku: 'FERT-CANNA-A', oq: '15', rq: '15', price: '4200', tot: '63000', exp: '2026-10-28', st: 'RECEIVED', app: finMgrId },
    { num: 'PO-2026-10-0142', req: 'PR-2026-10-0072', sup: 'SUP-PKG-003', sku: 'PKG-MAP-BAG-1KG', oq: '5000', rq: '5000', price: '11.50', tot: '57500', exp: '2026-10-30', st: 'RECEIVED', app: finMgrId },
    { num: 'PO-2026-10-0143', req: null, sup: 'SUP-CHEM-004', sku: 'PROT-COPPER-OXY', oq: '6', rq: '6', price: '1200', tot: '7200', exp: '2026-10-24', st: 'RECEIVED', app: finMgrId },
    { num: 'PO-2026-10-0144', req: null, sup: 'SUP-PKG-003', sku: 'PKG-SLEEVE-75', oq: '50000', rq: '50000', price: '4.20', tot: '210000', exp: '2026-10-22', st: 'INVOICED', app: finMgrId },
    { num: 'PO-2026-10-0145', req: null, sup: 'SUP-PKG-003', sku: 'PKG-CARTON-EXPORT', oq: '4000', rq: '4000', price: '145.00', tot: '580000', exp: '2026-10-23', st: 'INVOICED', app: finMgrId },
    { num: 'PO-2026-10-0146', req: null, sup: 'SUP-SPARE-007', sku: 'TOOL-REEFER-FILTER', oq: '2', rq: '0', price: '7600', tot: '15200', exp: '2026-11-05', st: 'APPROVED', app: null },
    { num: 'PO-2026-10-0147', req: null, sup: 'SUP-FERT-001', sku: 'FERT-NPK-18', oq: '12', rq: '12', price: '5850', tot: '70200', exp: '2026-10-21', st: 'RECEIVED', app: finMgrId },
    { num: 'PO-2026-10-0148', req: null, sup: 'SUP-SEED-002', sku: 'SEED-BASIL-GEN', oq: '4', rq: '0', price: '6500', tot: '26000', exp: '2026-11-15', st: 'APPROVED', app: null },
    { num: 'PO-2026-10-0149', req: null, sup: 'SUP-LAB-006', sku: 'CONSUM-ANTISEPTIC', oq: '6', rq: '0', price: '2400', tot: '14400', exp: '2026-11-02', st: 'APPROVED', app: null },
    { num: 'PO-2026-10-0150', req: null, sup: 'SUP-FLT-005', sku: 'CONSUM-GLOVE-NITRILE', oq: '40', rq: '40', price: '850.00', tot: '34000', exp: '2026-10-20', st: 'INVOICED', app: finMgrId },
    { num: 'PO-2026-10-0151', req: null, sup: 'SUP-SPARE-007', sku: 'TOOL-PRUNER', oq: '12', rq: '0', price: '4800', tot: '57600', exp: '2026-11-10', st: 'ISSUED', app: null },
    { num: 'PO-2026-10-0152', req: null, sup: 'SUP-COLD-010', sku: 'TOOL-DRIP-ELBOW', oq: '300', rq: '300', price: '55.00', tot: '16500', exp: '2026-10-19', st: 'RECEIVED', app: finMgrId },
    { num: 'PO-2026-10-0153', req: null, sup: 'SUP-FERT-001', sku: 'FERT-COMPOST', oq: '40', rq: '40', price: '950.00', tot: '38000', exp: '2026-10-18', st: 'RECEIVED', app: finMgrId },
    { num: 'PO-2026-10-0154', req: null, sup: 'SUP-WATER-008', sku: 'CONSUM-ANTISEPTIC', oq: '6', rq: '0', price: '2400', tot: '14400', exp: '2026-11-20', st: 'DRAFT', app: null },
    { num: 'PO-2026-10-0155', req: null, sup: 'SUP-SEED-002', sku: 'SEED-CLONE-THYME', oq: '8', rq: '0', price: '9800', tot: '78400', exp: '2026-11-25', st: 'DRAFT', app: null },
  ];
  for (const p of pos) {
    const sId = await supId(p.sup);
    const skuid = await prodId(p.sku);
    const reqId = p.req
      ? rows<{ id: number }>(
          await db.execute(sql`SELECT id FROM purchase_requisitions WHERE req_number = ${p.req}`)
        )[0].id
      : null;
    await db.execute(sql`
      INSERT INTO purchase_orders (po_number, requisition_id, supplier_id, product_id, ordered_qty,
        received_qty, unit_price_kes, total_amount_kes, expected_delivery_date, status,
        created_by_user_id, approved_by_user_id)
      VALUES (${p.num}, ${reqId}, ${sId}, ${skuid}, ${p.oq},
        ${p.rq}, ${p.price}, ${p.tot}, ${p.exp}, ${p.st},
        ${procId}, ${p.app})
      ON CONFLICT (po_number) DO NOTHING;
    `);
    if (p.st === 'RECEIVED' || p.st === 'INVOICED') {
    if (p.st === 'RECEIVED' || p.st === 'INVOICED') {
      if (p.req) {
        await db.execute(sql`
          UPDATE purchase_requisitions SET status = 'CONVERTED_TO_PO'
          WHERE req_number = ${p.req};
        `);
      }
    }
    }
  }

  const grns = [
    { num: 'GRN-2026-0210', po: 'PO-2026-10-0147', sup: 'SUP-FERT-001', sku: 'FERT-NPK-18', wh: 'WH-AGRI', rq: '12', aq: '12', rqj: '0', dn: 'TWF-DN-88214', insp: 'Seals intact; 2 bags minor outer damage — accepted with photo record', lot: 'LOT-FERT-NPK-2610' },
    { num: 'GRN-2026-0211', po: 'PO-2026-10-0144', sup: 'SUP-PKG-003', sku: 'PKG-SLEEVE-75', wh: 'WH-PKG', rq: '50000', aq: '50000', rqj: '0', dn: 'PP-DN-44901', insp: 'Print colour match approved by QA; roll gauge within spec', lot: null },
    { num: 'GRN-2026-0212', po: 'PO-2026-10-0145', sup: 'SUP-PKG-003', sku: 'PKG-CARTON-EXPORT', wh: 'WH-PKG', rq: '4000', aq: '3980', rqj: '20', dn: 'PP-DN-44902', insp: '20 crushed cartons rejected at receipt — credit note requested', lot: null },
    { num: 'GRN-2026-0213', po: 'PO-2026-10-0143', sup: 'SUP-CHEM-004', sku: 'PROT-COPPER-OXY', wh: 'WH-AGRI', rq: '6', aq: '6', rqj: '0', dn: 'DS-DN-77120', insp: 'Agrochemical store locked; KePhis registry numbers verified', lot: 'LOT-PROT-CU-2610' },
    { num: 'GRN-2026-0214', po: 'PO-2026-10-0141', sup: 'SUP-FERT-001', sku: 'FERT-CANNA-A', wh: 'WH-AGRI', rq: '15', aq: '15', rqj: '0', dn: 'TWF-DN-88231', insp: 'Lot numbers recorded; storage dry & ventilated', lot: 'LOT-FERT-CAN-2610' },
    { num: 'GRN-2026-0215', po: 'PO-2026-10-0142', sup: 'SUP-PKG-003', sku: 'PKG-MAP-BAG-1KG', wh: 'WH-PKG', rq: '5000', aq: '5000', rqj: '0', dn: 'PP-DN-44915', insp: 'Gas-permeability certificate attached to supplier file', lot: null },
    { num: 'GRN-2026-0216', po: 'PO-2026-10-0150', sup: 'SUP-FLT-005', sku: 'CONSUM-GLOVE-NITRILE', wh: 'WH-AGRI', rq: '40', aq: '40', rqj: '0', dn: 'KQ-DN-11902', insp: 'Food-contact certificates on file', lot: null },
    { num: 'GRN-2026-0217', po: 'PO-2026-10-0153', sup: 'SUP-FERT-001', sku: 'FERT-COMPOST', wh: 'WH-AGRI', rq: '40', aq: '40', rqj: '0', dn: 'TWF-DN-88250', insp: 'Organic certification copy verified', lot: 'LOT-FERT-CMP-2610' },
    { num: 'GRN-2026-0218', po: 'PO-2026-10-0152', sup: 'SUP-COLD-010', sku: 'TOOL-DRIP-ELBOW', wh: 'WH-TOOL', rq: '300', aq: '300', rqj: '0', dn: 'CCS-DN-66121', insp: 'Compatible with 16mm drip line standard', lot: null },
  ];
  for (const g of grns) {
    const pRow = rows<{ id: number; supplier_id: number; product_id: number; unit_price_kes: string }>(
      await db.execute(
        sql`SELECT id, supplier_id, product_id, unit_price_kes FROM purchase_orders WHERE po_number = ${g.po}`
      )
    )[0];
    const wId = await whId(g.wh);
    let lotId: number | null = null;
    if (g.lot) {
      await db.execute(sql`
        INSERT INTO inventory_lots (lot_number, product_id, warehouse_id, bin_code, supplier_id,
          physical_qty, available_qty, unit_cost_kes, received_date, quality_status)
        VALUES (${g.lot}, ${pRow.product_id}, ${wId}, ${g.wh === 'WH-AGRI' ? 'AG-F01' : (g.wh === 'WH-PKG' ? 'PK-R01' : 'TL-S01')},
          ${pRow.supplier_id}, ${g.aq}, ${g.aq}, ${pRow.unit_price_kes}, '2026-10-22', 'AVAILABLE')
        ON CONFLICT (lot_number) DO NOTHING;
      `);
      lotId = rows<{ id: number }>(
        await db.execute(sql`SELECT id FROM inventory_lots WHERE lot_number = ${g.lot}`)
      )[0].id;
    }
    await db.execute(sql`
      INSERT INTO goods_receipts (grn_number, purchase_order_id, supplier_id, product_id, warehouse_id,
        lot_created_id, received_qty, accepted_qty, rejected_qty, delivery_note_ref, inspection_notes,
        received_by_user_id)
      VALUES (${g.num}, ${pRow.id}, ${pRow.supplier_id}, ${pRow.product_id}, ${wId},
        ${lotId}, ${g.rq}, ${g.aq}, ${g.rqj}, ${g.dn}, ${g.insp},
        ${invMgrId})
      ON CONFLICT (grn_number) DO NOTHING;
    `);
    await db.execute(sql`
      UPDATE purchase_orders SET received_qty = ${g.aq} WHERE po_number = ${g.po};
    `);
  }

  const invoices = [
    { num: 'SINV-2026-1121', po: 'PO-2026-10-0144', sup: 'SUP-PKG-003', grn: 'GRN-2026-0211', inv: '210000', poA: '210000', grnA: '210000', ms: 'MATCHED', ps: 'UNPAID', due: '2026-11-06' },
    { num: 'SINV-2026-1122', po: 'PO-2026-10-0145', sup: 'SUP-PKG-003', grn: 'GRN-2026-0212', inv: '580000', poA: '580000', grnA: '577100', ms: 'VARIANCE_HOLD', ps: 'DISPUTED', due: '2026-11-07' },
    { num: 'SINV-2026-1123', po: 'PO-2026-10-0150', sup: 'SUP-FLT-005', grn: 'GRN-2026-0216', inv: '34000', poA: '34000', grnA: '34000', ms: 'MATCHED', ps: 'AUTHORIZED', due: '2026-11-03' },
    { num: 'SINV-2026-1124', po: 'PO-2026-10-0147', sup: 'SUP-FERT-001', grn: 'GRN-2026-0210', inv: '70200', poA: '70200', grnA: '70200', ms: 'MATCHED', ps: 'PAID', due: '2026-10-21' },
    { num: 'SINV-2026-1125', po: 'PO-2026-10-0153', sup: 'SUP-FERT-001', grn: 'GRN-2026-0217', inv: '38000', poA: '38000', grnA: '38000', ms: 'MATCHED', ps: 'UNPAID', due: '2026-11-17' },
    { num: 'SINV-2026-1126', po: 'PO-2026-10-0152', sup: 'SUP-COLD-010', grn: 'GRN-2026-0218', inv: '16500', poA: '16500', grnA: '16500', ms: 'MATCHED', ps: 'UNPAID', due: '2026-11-18' },
    { num: 'SINV-2026-1127', po: 'PO-2026-10-0141', sup: 'SUP-FERT-001', grn: 'GRN-2026-0214', inv: '63000', poA: '63000', grnA: '63000', ms: 'MATCHED', ps: 'UNPAID', due: '2026-10-28' },
    { num: 'SINV-2026-1128', po: 'PO-2026-10-0142', sup: 'SUP-PKG-003', grn: 'GRN-2026-0215', inv: '57500', poA: '57500', grnA: '57500', ms: 'MATCHED', ps: 'UNPAID', due: '2026-11-14' },
    { num: 'SINV-2026-1129', po: 'PO-2026-10-0143', sup: 'SUP-CHEM-004', grn: 'GRN-2026-0213', inv: '7200', poA: '7200', grnA: '7200', ms: 'MATCHED', ps: 'PAID', due: '2026-10-24' },
    { num: 'SINV-2026-1130', po: 'PO-2026-10-0146', sup: 'SUP-SPARE-007', grn: null, inv: '15200', poA: '15200', grnA: '0', ms: 'PENDING_GRN', ps: 'UNPAID', due: '2026-11-05' },
  ];
  for (const iv of invoices) {
    const pRow = rows<{ id: number; supplier_id: number; total_amount_kes: number }>(
      await db.execute(sql`SELECT id, supplier_id, total_amount_kes FROM purchase_orders WHERE po_number = ${iv.po}`)
    )[0];
    const grnRow = iv.grn
      ? rows<{ id: number }>(
          await db.execute(sql`SELECT id FROM goods_receipts WHERE grn_number = ${iv.grn}`)
        )[0]
      : null;
    await db.execute(sql`
      INSERT INTO supplier_invoices (invoice_number, supplier_id, purchase_order_id, grn_id,
        invoice_amount_kes, po_amount_kes, grn_amount_kes, three_way_match_status, payment_status,
        due_date, paid_at)
      VALUES (${iv.num}, ${pRow.supplier_id}, ${pRow.id}, ${grnRow?.id ?? null},
        ${iv.inv}, ${iv.poA}, ${iv.grnA}, ${iv.ms}, ${iv.ps},
        ${iv.due}, CASE WHEN ${iv.ps} = 'PAID' THEN now() - interval '3 days' ELSE NULL END)
      ON CONFLICT (invoice_number) DO NOTHING;
    `);
    if (iv.ps === 'PAID' || iv.ps === 'AUTHORIZED') {
      await db.execute(sql`
        UPDATE purchase_orders SET status = 'INVOICED' WHERE po_number = ${iv.po};
      `);
    }
  }

  // ---------- SALES ORDERS ----------
  const custId = async (code: string) =>
    rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM customers WHERE customer_code = ${code}`)
    )[0].id;
  const hbLot = async (lotNum: string) =>
    rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM inventory_lots WHERE lot_number = ${lotNum}`)
    )[0]?.id ?? null;

  const sales = [
    { num: 'SO-2026-10-0231', cust: 'CUS-VIT-UK', sku: 'HERB-THYME-75', lot: 'LOT-2026-10-0091', og: '351.50', ag: '351.50', dg: '351.50', cur: 'EUR', price: '2.40', fx: '147.3000', totC: '843.60', totK: '124262.28', req: '2026-10-28', st: 'DISPATCHED', ps: 'UNPAID' },
    { num: 'SO-2026-10-0232', cust: 'CUS-VANV-NL', sku: 'HERB-ROSEMARY-75', lot: 'LOT-2026-10-0092', og: '339.00', ag: '339.00', dg: '0.00', cur: 'EUR', price: '2.15', fx: '147.3000', totC: '728.85', totK: '107359.61', req: '2026-10-29', st: 'PACKED', ps: 'UNPAID' },
    { num: 'SO-2026-10-0233', cust: 'CUS-FCH-UK', sku: 'HERB-BASIL-75', lot: null, og: '1200.00', ag: '0.00', dg: '0.00', cur: 'EUR', price: '1.85', fx: '147.3000', totC: '2220.00', totK: '326006.00', req: '2026-10-31', st: 'STOCK_RESERVED', ps: 'UNPAID' },
    { num: 'SO-2026-10-0234', cust: 'CUS-HKR-DE', sku: 'HERB-LEMONGRASS-100', lot: null, og: '800.00', ag: '0.00', dg: '0.00', cur: 'EUR', price: '1.95', fx: '147.3000', totC: '1560.00', totK: '229788.00', req: '2026-11-02', st: 'APPROVED', ps: 'UNPAID' },
    { num: 'SO-2026-10-0235', cust: 'CUS-MAG-IT', sku: 'HERB-TARRAGON-75', lot: null, og: '450.00', ag: '0.00', dg: '0.00', cur: 'EUR', price: '2.75', fx: '147.3000', totC: '1237.50', totK: '182283.75', req: '2026-11-03', st: 'APPROVED', ps: 'UNPAID' },
    { num: 'SO-2026-10-0236', cust: 'CUS-AFR-ZA', sku: 'HERB-CHIVES-75', lot: null, og: '300.00', ag: '0.00', dg: '0.00', cur: 'ZAR', price: '46.50', fx: '7.9500', totC: '13950.00', totK: '110902.50', req: '2026-11-04', st: 'APPROVED', ps: 'UNPAID' },
    { num: 'SO-2026-10-0237', cust: 'CUS-BAUR-CH', sku: 'HERB-SAGE-75', lot: null, og: '500.00', ag: '0.00', dg: '0.00', cur: 'EUR', price: '2.30', fx: '147.3000', totC: '1150.00', totK: '169395.00', req: '2026-11-05', st: 'APPROVED', ps: 'UNPAID' },
    { num: 'SO-2026-10-0238', cust: 'CUS-LAU-ME', sku: 'HERB-MINT-75', lot: null, og: '600.00', ag: '0.00', dg: '0.00', cur: 'AED', price: '7.80', fx: '40.1000', totC: '4680.00', totK: '187668.00', req: '2026-11-06', st: 'APPROVED', ps: 'UNPAID' },
    { num: 'SO-2026-10-0239', cust: 'CUS-GAIA-NL', sku: 'HERB-OREGANO-75', lot: null, og: '400.00', ag: '0.00', dg: '0.00', cur: 'EUR', price: '2.55', fx: '147.3000', totC: '1020.00', totK: '150246.00', req: '2026-11-07', st: 'APPROVED', ps: 'UNPAID' },
    { num: 'SO-2026-10-0240', cust: 'CUS-RETAIL-KE', sku: 'HERB-BASIL-30', lot: null, og: '350.00', ag: '0.00', dg: '0.00', cur: 'KES', price: '95.00', fx: '1.0000', totC: '33250.00', totK: '33250.00', req: '2026-10-30', st: 'APPROVED', ps: 'UNPAID' },
    { num: 'SO-2026-10-0241', cust: 'CUS-HORECA-KE', sku: 'HERB-BASIL-75', lot: null, og: '250.00', ag: '0.00', dg: '0.00', cur: 'KES', price: '185.00', fx: '1.0000', totC: '46250.00', totK: '46250.00', req: '2026-10-31', st: 'APPROVED', ps: 'UNPAID' },
    { num: 'SO-2026-10-0242', cust: 'CUS-VIT-UK', sku: 'HERB-DILL-75', lot: null, og: '150.00', ag: '0.00', dg: '0.00', cur: 'EUR', price: '2.35', fx: '147.3000', totC: '352.50', totK: '51923.25', req: '2026-11-08', st: 'DRAFT', ps: 'UNPAID' },
  ];
  for (const s of sales) {
    const cId = await custId(s.cust);
    const pId = await prodId(s.sku);
    const lId = s.lot ? await hbLot(s.lot) : null;
    const pbId = lId
      ? rows<{ id: number }>(
          await db.execute(
            sql`SELECT id FROM packing_batches WHERE inventory_lot_id = ${lId} LIMIT 1`
          )
        )[0]?.id ?? null
      : null;
    const approvedBy = [
      'APPROVED',
      'STOCK_RESERVED',
      'PACKED',
      'DISPATCHED',
      'DELIVERED',
      'INVOICED',
      'PAID',
    ].includes(s.st)
      ? salesId
      : null;
    await db.execute(sql`
      INSERT INTO sales_orders (order_number, customer_id, product_id, packing_batch_id, ordered_kg,
        allocated_kg, dispatched_kg, currency, unit_price, exchange_rate_to_kes,
        total_currency_amount, total_kes_amount, requested_delivery_date, status, payment_status,
        approved_by_user_id)
      VALUES (${s.num}, ${cId}, ${pId}, ${pbId},
        ${s.og}, ${s.ag}, ${s.dg}, ${s.cur}, ${s.price}, ${s.fx},
        ${s.totC}, ${s.totK}, ${s.req}, ${s.st}, ${s.ps}, ${approvedBy})
      ON CONFLICT (order_number) DO NOTHING;
    `);
  }

  const soId = async (num: string) =>
    rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM sales_orders WHERE order_number = ${num}`)
    )[0].id;

  // ---------- SHIPMENTS ----------
  const shipments = [
    { code: 'SHP-2026-10-0071', so: 'SO-2026-10-0231', veh: 'KDD 441X', pb: 'PB-2026-10-0091', orig: 'Chalar Cold Room 1, Taveta', dest: 'JKIA Cargo Terminal → London Heathrow (Vitacress Herbs)', awb: 'KQ-703-44829105', airline: 'Kenya Airways Cargo (KQ)', kg: '351.50', cart: '14', dTemp: '3.20', aTemp: null, tc: '48500', st: 'IN_TRANSIT_TO_JKIA', by: logiId, pod: null, rcpt: null, notes: null },
    { code: 'SHP-2026-10-0072', so: 'SO-2026-10-0232', veh: 'KCX 902H', pb: 'PB-2026-10-0092', orig: 'Chalar Cold Room 1, Taveta', dest: 'JKIA Cargo Terminal → Amsterdam Schiphol (VanVugt Kruiden)', awb: null, airline: 'Kenya Airways Cargo (KQ)', kg: '339.00', cart: '13', dTemp: '3.40', aTemp: null, tc: '46200', st: 'PICK_PACK_VERIFIED', by: logiId, pod: null, rcpt: null, notes: null },
    { code: 'SHP-2026-10-0073', so: 'SO-2026-10-0240', veh: 'KCX 902H', pb: null, orig: 'Chalar Dispatch Dock, Taveta', dest: 'Naivas DC — Nairobi (local retail delivery)', awb: null, airline: null, kg: '0.00', cart: '0', dTemp: '4.50', aTemp: null, tc: '12000', st: 'PLANNED', by: null, pod: null, rcpt: null, notes: null },
    { code: 'SHP-2026-09-0064', so: 'SO-2026-10-0231', veh: 'KDD 441X', pb: null, orig: 'Chalar Cold Room 1, Taveta', dest: 'JKIA Cargo Terminal → London Heathrow (Vitacress Herbs)', awb: 'KQ-703-44710021', airline: 'Kenya Airways Cargo (KQ)', kg: '186.00', cart: '8', dTemp: '3.10', aTemp: '3.80', tc: '39800', st: 'DELIVERED', by: logiId, pod: 'POD-KQ-44710021.pdf', rcpt: 'S. Whitfield — Vitacress Goods-In', notes: 'Delivered 2026-10-18 09:12 BST, all cartons accepted, no rejection' },
  ];
  for (const s of shipments) {
    const soDb = await soId(s.so);
    const vehRow = s.veh
      ? rows<{ id: number }>(
          await db.execute(sql`SELECT id FROM vehicles WHERE registration_number = ${s.veh}`)
        )[0]?.id ?? null
      : null;
    const pbRow = s.pb
      ? rows<{ id: number }>(
          await db.execute(sql`SELECT id FROM packing_batches WHERE packing_batch_code = ${s.pb}`)
        )[0]?.id ?? null
      : null;
    await db.execute(sql`
      INSERT INTO shipments (shipment_code, sales_order_id, vehicle_id, packing_batch_id,
        origin_location, destination_location, air_waybill_no, airline_name, dispatched_kg,
        cartons_count, departure_temp_c, arrival_temp_c, transport_cost_kes, dispatch_status,
        dispatched_by_user_id, dispatched_at, delivered_at, proof_of_delivery_ref,
        delivery_recipient_name, delivery_notes)
      VALUES (${s.code}, ${soDb}, ${vehRow}, ${pbRow},
        ${s.orig}, ${s.dest}, ${s.awb}, ${s.airline}, ${s.kg},
        ${s.cart}, ${s.dTemp}, ${s.aTemp}, ${s.tc}, ${s.st},
        ${s.by},
        CASE WHEN ${s.st} != 'PLANNED' THEN now() - interval '20 hours' ELSE NULL END,
        CASE WHEN ${s.st} = 'DELIVERED' THEN now() - interval '5 days' ELSE NULL END,
        ${s.pod}, ${s.rcpt}, ${s.notes})
      ON CONFLICT (shipment_code) DO NOTHING;
    `);
    if (s.st === 'DELIVERED') {
      await db.execute(sql`
        UPDATE sales_orders SET status = 'DELIVERED' WHERE id = ${soDb};
      `);
    }
  }

  // ---------- EXPORT DOCUMENTS ----------
  const exportDocs = [
    { num: 'EXP-DOC-2026-0181', so: 'SO-2026-10-0231', sh: 'SHP-2026-10-0071', type: 'PHYTOSANITARY_CERTIFICATE', auth: 'Kenya Plant Health Inspectorate Service (KEPHIS)', issue: '2026-10-26', exp: '2026-11-09', st: 'VERIFIED', notes: 'Pre-shipment inspection request lodged; certificate number issued by KEPHIS upon physical inspection (not recorded here until received)' },
    { num: 'EXP-DOC-2026-0182', so: 'SO-2026-10-0231', sh: 'SHP-2026-10-0071', type: 'COMMERCIAL_INVOICE', auth: 'Chalar Farms Limited (in-house)', issue: '2026-10-26', exp: '2026-11-09', st: 'VERIFIED', notes: 'Pro-forma awaiting Finance Manager sign-off before airwaybill attachment' },
    { num: 'EXP-DOC-2026-0183', so: 'SO-2026-10-0231', sh: 'SHP-2026-10-0071', type: 'PACKING_LIST', auth: 'Chalar Farms Limited (in-house)', issue: '2026-10-26', exp: '2026-11-09', st: 'VERIFIED', notes: '14 cartons, 351.50 kg net, batch PB-2026-10-0091 / HB-2026-10-0422' },
    { num: 'EXP-DOC-2026-0184', so: 'SO-2026-10-0231', sh: 'SHP-2026-10-0071', type: 'AIR_WAYBILL', auth: 'Kenya Airways Cargo (KQ)', issue: '2026-10-26', exp: '2026-11-02', st: 'SUBMITTED', notes: 'AWB KQ-703-44829105 pending airline acceptance scan' },
    { num: 'EXP-DOC-2026-0185', so: 'SO-2026-10-0231', sh: null, type: 'EUR1_MOVEMENT_CERTIFICATE', auth: 'Kenya Association of Manufacturers (KAM) — ACP/EU rules of origin', issue: '2026-10-25', exp: '2026-11-25', st: 'VERIFIED', notes: 'EUR.1 application approved; blank certificate serial retained by compliance office' },
    { num: 'EXP-DOC-2026-0186', so: 'SO-2026-10-0231', sh: null, type: 'GLOBALGAP_COC', auth: 'GLOBALG.A.P. Certification Body (via farmer group)', issue: '2026-04-14', exp: '2027-04-13', st: 'VERIFIED', notes: 'Certificate of conformity reference — validity to be re-verified with certification body before each shipment' },
    { num: 'EXP-DOC-2026-0187', so: 'SO-2026-10-0232', sh: 'SHP-2026-10-0072', type: 'PHYTOSANITARY_CERTIFICATE', auth: 'Kenya Plant Health Inspectorate Service (KEPHIS)', issue: '2026-10-27', exp: '2026-11-10', st: 'DRAFT', notes: 'Awaiting shipment date confirmation before KEPHIS request' },
    { num: 'EXP-DOC-2026-0188', so: 'SO-2026-10-0232', sh: 'SHP-2026-10-0072', type: 'COMMERCIAL_INVOICE', auth: 'Chalar Farms Limited (in-house)', issue: '2026-10-27', exp: '2026-11-10', st: 'DRAFT', notes: 'Draft created from SO-2026-10-0232 — Finance review pending' },
    { num: 'EXP-DOC-2026-0189', so: 'SO-2026-10-0231', sh: null, type: 'SMETA_AUDIT_SUMMARY', auth: 'SMETA audit (ethical trade)', issue: '2026-03-30', exp: '2027-03-29', st: 'VERIFIED', notes: 'Summary statement held by Compliance — full report restricted to authorized reviewers' },
    { num: 'EXP-DOC-2026-0190', so: 'SO-2026-10-0232', sh: null, type: 'LEAF_MARQUE_CERTIFICATE', auth: 'LEAF Marque (environmental assurance)', issue: '2026-05-20', exp: '2027-05-19', st: 'VERIFIED', notes: 'Environmental assurance certificate — confirm current status with scheme before customer submission' },
    { num: 'EXP-DOC-2026-0191', so: 'SO-2026-10-0232', sh: null, type: 'CERTIFICATE_OF_ORIGIN', auth: 'Kenya National Chamber of Commerce & Industry (KNCCI)', issue: '2026-10-27', exp: '2026-11-27', st: 'SUBMITTED', notes: 'Application lodged — awaiting KNCCI issuance' },
    { num: 'EXP-DOC-2026-0192', so: 'SO-2026-10-0240', sh: null, type: 'COMMERCIAL_INVOICE', auth: 'Chalar Farms Limited (in-house)', issue: '2026-10-26', exp: '2026-11-09', st: 'VERIFIED', notes: 'Local retail invoice in KES — Naivas DC delivery' },
  ];
  for (const d of exportDocs) {
    const soDb = await soId(d.so);
    const shId = d.sh
      ? rows<{ id: number }>(
          await db.execute(sql`SELECT id FROM shipments WHERE shipment_code = ${d.sh}`)
        )[0]?.id ?? null
      : null;
    const verifiedBy = d.st === 'VERIFIED' ? salesId : null;
    await db.execute(sql`
      INSERT INTO export_documents (doc_number, sales_order_id, shipment_id, doc_type,
        issuing_authority, issue_date, expiry_date, status, verified_by_user_id, notes)
      VALUES (${d.num}, ${soDb}, ${shId}, ${d.type},
        ${d.auth}, ${d.issue}, ${d.exp}, ${d.st}, ${verifiedBy}, ${d.notes})
      ON CONFLICT (doc_number) DO NOTHING;
    `);
  }

  // ---------- STOCK ADJUSTMENTS (pending approval) ----------
  const adjustments = [
    { num: 'SA-2026-10-0021', sku: 'HERB-OREGANO-75', wh: 'WH-COLD1', sys: '38.000', cnt: '34.500', varr: '-3.500', why: 'Nightly cycle count variance — 3 bunches found wilted beyond grade, 0.5 bunches unexplained scale drift; recorded for QA disposition', st: 'PENDING_APPROVAL', req: invMgrId },
    { num: 'SA-2026-10-0022', sku: 'TOOL-DRIP-ELBOW', wh: 'WH-TOOL', sys: '146.000', cnt: '152.000', varr: '6.000', why: 'Six elbows found in unmarked repair kit returned from field — added to system stock', st: 'APPROVED', req: maintId, app: invMgrId },
    { num: 'SA-2026-10-0023', sku: 'CONSUM-GLOVE-NITRILE', wh: 'WH-AGRI', sys: '34.000', cnt: '30.000', varr: '-4.000', why: 'Four boxes issued to packhouse hygiene lead without requisition slip during night shift — backdated issue pending manager confirmation', st: 'PENDING_APPROVAL', req: invMgrId },
    { num: 'SA-2026-10-0024', sku: 'PKG-CARTON-EXPORT', wh: 'WH-PKG', sys: '6840.000', cnt: '6810.000', varr: '-30.000', why: 'Thirty cartons water-damaged by roof leak above PK-C01 bay — written off with photo evidence', st: 'REJECTED', req: invMgrId, app: finMgrId },
    { num: 'SA-2026-10-0025', sku: 'FERT-COMPOST', wh: 'WH-AGRI', sys: '46.000', cnt: '44.000', varr: '-2.000', why: 'Two bags split during forklift handling — usable portion recovered in field, remainder recorded as loss', st: 'APPROVED', req: farmMgrId, app: invMgrId },
    { num: 'SA-2026-10-0026', sku: 'HERB-CHIVES-75', wh: 'WH-COLD1', sys: '96.000', cnt: '96.000', varr: '0.000', why: 'Weekly full stocktake verification count — zero variance, count recorded for reconciliation evidence', st: 'APPROVED', req: invMgrId, app: invMgrId },
    { num: 'SA-2026-10-0027', sku: 'SEED-BASIL-GEN', wh: 'WH-AGRI', sys: '6.000', cnt: '5.000', varr: '-1.000', why: 'One seed packet opened for germination test by QA — consumption not previously posted', st: 'PENDING_APPROVAL', req: qaId },
    { num: 'SA-2026-10-0028', sku: 'PROT-IMIDACLOPRID', wh: 'WH-AGRI', sys: '2.000', cnt: '3.000', varr: '1.000', why: 'One bottle returned from field team in sealed condition but never unposted from issue — suspected duplicate issue posting', st: 'PENDING_APPROVAL', req: farmMgrId },
    { num: 'SA-2026-10-0029', sku: 'HERB-DILL-75', wh: 'WH-COLD1', sys: '42.000', cnt: '40.000', varr: '-2.000', why: 'Two bunches removed by QA for residue re-test sampling under QI protocol', st: 'APPROVED', req: qaId, app: invMgrId },
    { num: 'SA-2026-10-0030', sku: 'PKG-MAP-BAG-1KG', wh: 'WH-PKG', sys: '15400.000', cnt: '15400.000', varr: '0.000', why: 'Quarterly packaging stocktake — roll/bag count verified, zero variance recorded', st: 'APPROVED', req: invMgrId, app: invMgrId },
  ];
  for (const a of adjustments) {
    const pId = await prodId(a.sku);
    const wId = await whId(a.wh);
    // Ensure an inventory lot exists for the adjustment (system-count baseline lot)
    const existingLot = rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM inventory_lots WHERE product_id = ${pId} ORDER BY id LIMIT 1`)
    );
    let adjLotId = existingLot[0]?.id;
    if (!adjLotId) {
      const lotNum = `LOT-ADJ-${a.sku}`;
      await db.execute(sql`
        INSERT INTO inventory_lots (lot_number, product_id, warehouse_id, bin_code,
          physical_qty, available_qty, unit_cost_kes, received_date, quality_status)
        VALUES (${lotNum}, ${pId}, ${wId}, 'CR1-A01',
          ${a.sys}, ${a.sys}, 100.00, '2026-10-01', 'AVAILABLE')
        ON CONFLICT (lot_number) DO NOTHING;
      `);
      adjLotId = rows<{ id: number }>(
        await db.execute(sql`SELECT id FROM inventory_lots WHERE lot_number = ${lotNum}`)
      )[0].id;
    }
    await db.execute(sql`
      INSERT INTO stock_adjustments (adjustment_number, product_id, lot_id, warehouse_id,
        system_qty, counted_qty, variance_qty, reason, status, requested_by_user_id,
        approved_by_user_id, approved_at)
      VALUES (${a.num}, ${pId}, ${adjLotId}, ${wId}, ${a.sys}, ${a.cnt}, ${a.varr}, ${a.why}, ${a.st},
        ${a.req}, ${a.app ?? null},
        CASE WHEN ${a.st} = 'APPROVED' THEN now() - interval '1 day' ELSE NULL END)
      ON CONFLICT (adjustment_number) DO NOTHING;
    `);
    // enforce self-approval block demo: SA-2026-10-0026 was requested and approved by same user
    if (a.num === 'SA-2026-10-0026') {
      await db.execute(sql`
        UPDATE stock_adjustments SET status = 'PENDING_APPROVAL', approved_by_user_id = NULL, approved_at = NULL
        WHERE adjustment_number = ${a.num};
      `);
      await db.execute(sql`
        INSERT INTO approval_requests (request_code, module, entity_type, entity_id, title, amount_kes,
          submitted_by_user_id, assigned_role_code, status)
        SELECT 'APR-' || ${a.num}, 'INVENTORY', 'STOCK_ADJUSTMENT', sa.id,
          'Stock adjustment ' || ${a.num} || ' — chives cycle count', 0, sa.requested_by_user_id,
          'INVENTORY_MANAGER', 'PENDING'
        FROM stock_adjustments sa WHERE sa.adjustment_number = ${a.num}
        ON CONFLICT (request_code) DO NOTHING;
      `);
    }
  }

  // ---------- EXPENSES ----------
  const expenses = [
    { num: 'EXP-2026-10-0301', dept: 'PACK', acct: '6200', cat: 'Utilities (Power & Water)', vendor: 'Kenya Power — Taveta Station', desc: 'Packhouse & cold room electricity — October 2026 billing period', amt: '642000', tax: '83026.09', d: '2026-10-24', ps: 'PENDING_APPROVAL', sub: packMgrId },
    { num: 'EXP-2026-10-0302', dept: 'LOG', acct: '5200', cat: 'Airfreight & Logistics Costs', vendor: 'Kenya Airways Cargo', desc: 'Airfreight charges — JKIA to LHR shipments week 42-43', amt: '418500', tax: '0', d: '2026-10-23', ps: 'PENDING_APPROVAL', sub: logiId },
    { num: 'EXP-2026-10-0303', dept: 'QAFOOD', acct: '6400', cat: 'Certification & Compliance Costs', vendor: 'KEPHIS Phytosanitary Services', desc: 'Pre-shipment phytosanitary inspections & certificate fees — October', amt: '128400', tax: '16638.26', d: '2026-10-22', ps: 'APPROVED', sub: qaId, app: finMgrId },
    { num: 'EXP-2026-10-0304', dept: 'FARM', acct: '6200', cat: 'Utilities (Power & Water)', vendor: 'Taveta Water Services Co.', desc: 'Irrigation water abstraction — October 2026', amt: '96500', tax: '12521.74', d: '2026-10-21', ps: 'PAID', sub: farmMgrId, app: finMgrId, ref: 'BNK-KCB-8891002' },
    { num: 'EXP-2026-10-0305', dept: 'MAINT', acct: '6300', cat: 'Repairs & Maintenance', vendor: 'Cold Chain Systems Kenya', desc: 'Cold Room 2 condenser overhaul labour and call-out', amt: '187000', tax: '24234.78', d: '2026-10-20', ps: 'PAID', sub: maintId, app: finMgrId, ref: 'BNK-KCB-8891045' },
    { num: 'EXP-2026-10-0306', dept: 'HR', acct: '6100', cat: 'Statutory Employer Contributions', vendor: 'NSSF / SHIF / Housing Levy Funds', desc: 'Employer statutory contributions — September 2026 remittance', amt: '412300', tax: '0', d: '2026-10-18', ps: 'PAID', sub: hrMgrId, app: finMgrId, ref: 'BNK-KCB-8890977' },
    { num: 'EXP-2026-10-0307', dept: 'FARM', acct: '5100', cat: 'Packaging & Cold Chain Costs', vendor: 'Voi Industrial Spares Ltd', desc: 'Post-harvest crate replacements (200 units)', amt: '164000', tax: '21252.17', d: '2026-10-19', ps: 'PENDING_APPROVAL', sub: farmMgrId },
    { num: 'EXP-2026-10-0308', dept: 'EXEC', acct: '7000', cat: 'Bank Charges & Interest', vendor: 'KCB Bank Kenya', desc: 'Banking facility charges and FX conversion fees — October', amt: '38400', tax: '0', d: '2026-10-17', ps: 'APPROVED', sub: finMgrId, app: execId },
    { num: 'EXP-2026-10-0309', dept: 'PROC', acct: '6300', cat: 'Repairs & Maintenance', vendor: 'Multiple (petty cash)', desc: 'Farm petty cash — fuel, small tools and sundry repairs week 42', amt: '57300', tax: '0', d: '2026-10-16', ps: 'PAID', sub: procId, app: finMgrId, ref: 'CASH-PETTY-42' },
    { num: 'EXP-2026-10-0310', dept: 'SALEX', acct: '6400', cat: 'Certification & Compliance Costs', vendor: 'SMETA Audit Consultancy', desc: 'SMETA 6-pillar follow-up actions — corrective action support', amt: '245000', tax: '31826.09', d: '2026-10-15', ps: 'REJECTED', sub: salesId, app: finMgrId },
    { num: 'EXP-2026-10-0311', dept: 'INV', acct: '6300', cat: 'Repairs & Maintenance', vendor: 'Voi Industrial Spares Ltd', desc: 'Forklift hydraulic hose replacement', amt: '72800', tax: '9452.17', d: '2026-10-14', ps: 'PAID', sub: invMgrId, app: finMgrId, ref: 'BNK-KCB-8890901' },
    { num: 'EXP-2026-10-0312', dept: 'COMP', acct: '6400', cat: 'Certification & Compliance Costs', vendor: 'External Audit Firm', desc: 'Q3 spot audit fieldwork support', amt: '165000', tax: '21369.57', d: '2026-10-13', ps: 'PAID', sub: auditorId, app: finMgrId, ref: 'BNK-KCB-8890888' },
    { num: 'EXP-2026-10-0313', dept: 'PACK', acct: '5100', cat: 'Packaging & Cold Chain Costs', vendor: 'PlastiPack Industries Ltd', desc: 'Additional export carton order — EU rosemary programme surge', amt: '290000', tax: '37652.17', d: '2026-10-12', ps: 'PENDING_APPROVAL', sub: packMgrId },
    { num: 'EXP-2026-10-0314', dept: 'MAINT', acct: '6300', cat: 'Repairs & Maintenance', vendor: 'Cold Chain Systems Kenya', desc: 'Quarterly cold room calibration and door seal replacement', amt: '89500', tax: '11613.04', d: '2026-10-11', ps: 'PAID', sub: maintId, app: finMgrId, ref: 'BNK-KCB-8890812' },
    { num: 'EXP-2026-10-0315', dept: 'LOG', acct: '5200', cat: 'Airfreight & Logistics Costs', vendor: 'Kenya Airways Cargo', desc: 'Pre-cooling and terminal handling — week 41', amt: '143700', tax: '0', d: '2026-10-10', ps: 'APPROVED', sub: logiId, app: finMgrId },
    { num: 'EXP-2026-10-0316', dept: 'IT', acct: '6300', cat: 'Repairs & Maintenance', vendor: 'Safaricom PLC', desc: 'Farm connectivity — dedicated fibre link monthly', amt: '24800', tax: '3217.39', d: '2026-10-09', ps: 'PAID', sub: superAdminId, app: finMgrId, ref: 'BNK-KCB-8890755' },
    { num: 'EXP-2026-10-0317', dept: 'HR', acct: '6000', cat: 'Employee Salaries & Wages', vendor: 'Casual labour agencies (Taveta)', desc: 'Casual harvest crews — week 41 & 42 top-up beyond payroll headcount', amt: '318600', tax: '0', d: '2026-10-08', ps: 'APPROVED', sub: hrMgrId, app: finMgrId },
    { num: 'EXP-2026-10-0318', dept: 'PROC', acct: '5000', cat: 'Cost of Goods Sold — Farm Production', vendor: 'Twiga Fertilisers Kenya Ltd', desc: 'Bulk compound fertiliser top-dress application — Oct cycles', amt: '234000', tax: '30365.22', d: '2026-10-07', ps: 'PAID', sub: procId, app: finMgrId, ref: 'BNK-KCB-8890701' },
    { num: 'EXP-2026-10-0319', dept: 'EXEC', acct: '6400', cat: 'Certification & Compliance Costs', vendor: 'IPD / Trade promotion (event)', desc: 'Fruit Logistica 2027 pre-registration and booth deposit', amt: '460000', tax: '59652.17', d: '2026-10-06', ps: 'PENDING_APPROVAL', sub: execId },
    { num: 'EXP-2026-10-0320', dept: 'INV', acct: '6200', cat: 'Utilities (Power & Water)', vendor: 'Kenya Power — Taveta Station', desc: 'Packhouse compressor auxiliary power — October period 2', amt: '286400', tax: '37182.61', d: '2026-10-05', ps: 'PENDING_APPROVAL', sub: invMgrId },
  ];
  for (const e of expenses) {
    const dId = await depId(e.dept);
    await db.execute(sql`
      INSERT INTO expense_records (expense_number, department_id, account_id, category, vendor_name,
        description, amount_kes, tax_kes, expense_date, payment_status, submitted_by_user_id,
        approved_by_user_id, payment_ref)
      VALUES (${e.num}, ${dId},
        (SELECT id FROM chart_of_accounts WHERE account_code = ${e.acct}),
        ${e.cat}, ${e.vendor}, ${e.desc}, ${e.amt}, ${e.tax}, ${e.d}, ${e.ps},
        ${e.sub}, ${e.app ?? null}, ${e.ref ?? null})
      ON CONFLICT (expense_number) DO NOTHING;
    `);
    if (e.ps === 'PENDING_APPROVAL') {
      await db.execute(sql`
        INSERT INTO approval_requests (request_code, module, entity_type, entity_id, title, amount_kes,
          submitted_by_user_id, assigned_role_code, status)
        VALUES ('APR-' || ${e.num}, 'FINANCE', 'EXPENSE_RECORD',
          (SELECT id FROM expense_records WHERE expense_number = ${e.num}),
          'Expense ' || ${e.num} || ' — ' || ${e.desc}, ${e.amt}, ${e.sub}, 'FINANCE_MANAGER', 'PENDING')
        ON CONFLICT (request_code) DO NOTHING;
      `);
    }
  }

  // ---------- JOURNAL ENTRIES (balanced double-entry) ----------
  const journals = [
    { num: 'JE-2026-10-0041', d: '2026-10-24', desc: 'October packhouse electricity accrual (EXP-2026-10-0301)', refT: 'EXPENSE', refId: 'EXP-2026-10-0301', lines: [['6200', '725026.09', '0'], ['2000', '0', '725026.09']] },
    { num: 'JE-2026-10-0042', d: '2026-10-23', desc: 'Airfreight cost recognition — JKIA-LHR week 42-43 (EXP-2026-10-0302)', refT: 'EXPENSE', refId: 'EXP-2026-10-0302', lines: [['5200', '418500.00', '0'], ['2000', '0', '418500.00']] },
    { num: 'JE-2026-10-0043', d: '2026-10-22', desc: 'Export sales invoice — Vitacress thyme shipment SHP-2026-10-0071', refT: 'SALES_ORDER', refId: 'SO-2026-10-0231', lines: [['1100', '124262.28', '0'], ['4000', '0', '124262.28']] },
    { num: 'JE-2026-10-0044', d: '2026-10-22', desc: 'Export sales invoice — VanVugt rosemary shipment SO-2026-10-0232', refT: 'SALES_ORDER', refId: 'SO-2026-10-0232', lines: [['1100', '107359.61', '0'], ['4000', '0', '107359.61']] },
    { num: 'JE-2026-10-0045', d: '2026-10-21', desc: 'Fertiliser purchase settlement — SINV-2026-1124 paid via KCB', refT: 'SUPPLIER_INVOICE', refId: 'SINV-2026-1124', lines: [['2000', '70200.00', '0'], ['1000', '0', '70200.00']] },
    { num: 'JE-2026-10-0046', d: '2026-10-20', desc: 'Cold room overhaul payment — EXP-2026-10-0305', refT: 'EXPENSE', refId: 'EXP-2026-10-0305', lines: [['6300', '211234.78', '0'], ['1000', '0', '211234.78']] },
    { num: 'JE-2026-10-0047', d: '2026-10-19', desc: 'CRATE procurement capitalisation (post-harvest crates EXP-2026-10-0307)', refT: 'EXPENSE', refId: 'EXP-2026-10-0307', lines: [['1500', '185252.17', '0'], ['2000', '0', '185252.17']] },
    { num: 'JE-2026-10-0048', d: '2026-10-18', desc: 'September statutory employer contributions remittance (EXP-2026-10-0306)', refT: 'EXPENSE', refId: 'EXP-2026-10-0306', lines: [['6100', '412300.00', '0'], ['1000', '0', '412300.00']] },
    { num: 'JE-2026-10-0049', d: '2026-10-17', desc: 'October bank charges (EXP-2026-10-0308)', refT: 'EXPENSE', refId: 'EXP-2026-10-0308', lines: [['7000', '38400.00', '0'], ['1000', '0', '38400.00']] },
    { num: 'JE-2026-10-0050', d: '2026-10-15', desc: 'PAYE remittance to KRA — September 2026 payroll (statutory liability settlement)', refT: 'PAYROLL', refId: 'PAY-2026-09', lines: [['2100', '3120000.00', '0'], ['1000', '0', '3120000.00']] },
    { num: 'JE-2026-10-0051', d: '2026-10-14', desc: 'Forklift repair (EXP-2026-10-0311)', refT: 'EXPENSE', refId: 'EXP-2026-10-0311', lines: [['6300', '82252.17', '0'], ['1000', '0', '82252.17']] },
    { num: 'JE-2026-10-0052', d: '2026-10-13', desc: 'Q3 audit support fee (EXP-2026-10-0312)', refT: 'EXPENSE', refId: 'EXP-2026-10-0312', lines: [['6400', '186369.57', '0'], ['1000', '0', '186369.57']] },
    { num: 'JE-2026-10-0053', d: '2026-10-12', desc: 'Carton surge order accrual (EXP-2026-10-0313)', refT: 'EXPENSE', refId: 'EXP-2026-10-0313', lines: [['5100', '327652.17', '0'], ['2000', '0', '327652.17']] },
    { num: 'JE-2026-10-0054', d: '2026-10-11', desc: 'Cold room calibration (EXP-2026-10-0314)', refT: 'EXPENSE', refId: 'EXP-2026-10-0314', lines: [['6300', '101113.04', '0'], ['1000', '0', '101113.04']] },
    { num: 'JE-2026-10-0055', d: '2026-10-10', desc: 'Pre-cooling & terminal handling week 41 (EXP-2026-10-0315)', refT: 'EXPENSE', refId: 'EXP-2026-10-0315', lines: [['5200', '143700.00', '0'], ['2000', '0', '143700.00']] },
    { num: 'JE-2026-10-0056', d: '2026-10-09', desc: 'Fibre link monthly charge (EXP-2026-10-0316)', refT: 'EXPENSE', refId: 'EXP-2026-10-0316', lines: [['6300', '28017.39', '0'], ['1000', '0', '28017.39']] },
    { num: 'JE-2026-10-0057', d: '2026-10-08', desc: 'Casual harvest labour week 41-42 (EXP-2026-10-0317)', refT: 'EXPENSE', refId: 'EXP-2026-10-0317', lines: [['6000', '318600.00', '0'], ['2000', '0', '318600.00']] },
    { num: 'JE-2026-10-0058', d: '2026-10-07', desc: 'Bulk fertiliser top-dress settlement (EXP-2026-10-0318)', refT: 'EXPENSE', refId: 'EXP-2026-10-0318', lines: [['5000', '264365.22', '0'], ['1000', '0', '264365.22']] },
    { num: 'JE-2026-10-0059', d: '2026-10-06', desc: 'Fruit Logistica 2027 booth deposit (EXP-2026-10-0319)', refT: 'EXPENSE', refId: 'EXP-2026-10-0319', lines: [['1500', '519652.17', '0'], ['2000', '0', '519652.17']] },
    { num: 'JE-2026-10-0060', d: '2026-10-05', desc: 'Compressor auxiliary power period 2 (EXP-2026-10-0320)', refT: 'EXPENSE', refId: 'EXP-2026-10-0320', lines: [['6200', '323582.61', '0'], ['2000', '0', '323582.61']] },
  ];
  for (const j of journals) {
    const drTotal = j.lines
      .reduce((s, l) => s + parseFloat(l[1]), 0)
      .toFixed(2);
    const crTotal = j.lines
      .reduce((s, l) => s + parseFloat(l[2]), 0)
      .toFixed(2);
    await db.execute(sql`
      INSERT INTO journal_entries (entry_number, entry_date, period_code, description, reference_type,
        reference_id, total_debit_kes, total_credit_kes, status, created_by_user_id, approved_by_user_id)
      VALUES (${j.num}, ${j.d}, '2026-10', ${j.desc}, ${j.refT}, ${j.refId},
        ${drTotal}, ${crTotal}, 'POSTED', ${finMgrId}, ${finMgrId})
      ON CONFLICT (entry_number) DO NOTHING;
    `);
    const jeId = rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM journal_entries WHERE entry_number = ${j.num}`)
    )[0].id;
    let lineNo = 0;
    for (const l of j.lines) {
      lineNo += 1;
      const memo = `Line ${lineNo} — ${j.desc}`;
      await db.execute(sql`
        INSERT INTO journal_lines (journal_entry_id, account_id, cost_center_code, debit_kes, credit_kes, memo)
        SELECT ${jeId}, a.id, 'CC-CORE', ${l[1]}, ${l[2]}, ${memo}
        FROM chart_of_accounts a WHERE a.account_code = ${l[0]};
      `);
    }
    // roll account balances
    for (const l of j.lines) {
      await db.execute(sql`
        UPDATE chart_of_accounts SET balance_kes = balance_kes + (${l[1]}::numeric - ${l[2]}::numeric)
        WHERE account_code = ${l[0]};
      `);
    }
  }

  // ---------- PAYROLL (uses real statutory calculator) ----------
  const { calculateKenyanPayroll } = await import('@/lib/payroll-calculator');
  const empRows = rows<{
    id: number;
    full_name: string;
    employee_code: string;
    basic_salary_kes: string;
    employment_type: string;
    department_id: number;
    job_title: string;
  }>(
    await db.execute(sql`
      SELECT id, full_name, employee_code, basic_salary_kes, employment_type, department_id, job_title
      FROM employee_profiles ORDER BY id
    `)
  );

  const periodMonth = '2026-10';
  const runCode = 'PAY-2026-10';
  const payDate = '2026-10-31';

  const empPay = empRows.map((e) => {
    const basic = parseFloat(e.basic_salary_kes);
    const isField = [
      'Field Supervisor',
      'Field Technician',
      'Harvest Crew Lead',
      'Packhouse Packer',
      'Irrigation Technician',
      'Farm Handyman',
      'Cold Room Operator',
      'Store Assistant',
    ].includes(e.job_title ?? '');
    const isCasual = e.employment_type === 'CASUAL' || e.employment_type === 'SEASONAL';
    const overtime = isField ? Math.round(basic * 0.05 * 100) / 100 : 0;
    const transport = isField ? 4000 : 6000;
    const housing = isField ? 3000 : 5000;
    const allowances = transport + housing;
    const calc = calculateKenyanPayroll({
      basicPayKes: basic,
      overtimePayKes: overtime,
      allowancesKes: allowances,
      otherDeductionsKes: isCasual ? 0 : 1500,
    });
    return { ...e, overtime, allowances, calc };
  });

  const totals = empPay.reduce(
    (acc, e) => ({
      gross: acc.gross + e.calc.grossPayKes,
      paye: acc.paye + e.calc.payeTaxKes,
      nssfE: acc.nssfE + e.calc.nssfEmployeeKes,
      shif: acc.shif + e.calc.shifKes,
      ahl: acc.ahl + e.calc.housingLevyEmployeeKes,
      other: acc.other + e.calc.otherDeductionsKes,
      net: acc.net + e.calc.netPayKes,
    }),
    { gross: 0, paye: 0, nssfE: 0, shif: 0, ahl: 0, other: 0, net: 0 }
  );

  await db.execute(sql`
    INSERT INTO payroll_runs (run_code, period_month, pay_date, statutory_version_code, employee_count,
      total_gross_kes, total_paye_kes, total_nssf_employee_kes, total_shif_kes, total_housing_levy_kes,
      total_other_deductions_kes, total_net_pay_kes, status, prepared_by_user_id, approved_by_user_id, approved_at)
    VALUES (${runCode}, ${periodMonth}, ${payDate}, 'KE-STAT-2026-V1', ${empPay.length},
      ${totals.gross.toFixed(2)}, ${totals.paye.toFixed(2)}, ${totals.nssfE.toFixed(2)},
      ${totals.shif.toFixed(2)}, ${totals.ahl.toFixed(2)}, ${totals.other.toFixed(2)},
      ${totals.net.toFixed(2)}, 'APPROVED', ${payrollId}, ${finMgrId}, now() - interval '5 days')
    ON CONFLICT (run_code) DO NOTHING;
  `);
  const runId = rows<{ id: number }>(
    await db.execute(sql`SELECT id FROM payroll_runs WHERE run_code = ${runCode}`)
  )[0].id;

  for (const e of empPay) {
    const psNum = `PS-${periodMonth}-${e.employee_code}`;
    await db.execute(sql`
      INSERT INTO payslip_records (payslip_number, payroll_run_id, employee_id, period_month,
        basic_pay_kes, overtime_pay_kes, allowances_kes, gross_pay_kes, nssf_employee_kes,
        nssf_employer_kes, shif_kes, housing_levy_employee_kes, housing_levy_employer_kes,
        taxable_pay_kes, paye_before_relief_kes, personal_relief_kes, paye_tax_kes,
        other_deductions_kes, net_pay_kes, payment_status)
      VALUES (${psNum}, ${runId}, ${e.id}, ${periodMonth},
        ${e.calc.basicPayKes.toFixed(2)}, ${e.calc.overtimePayKes.toFixed(2)}, ${e.calc.allowancesKes.toFixed(2)},
        ${e.calc.grossPayKes.toFixed(2)}, ${e.calc.nssfEmployeeKes.toFixed(2)}, ${e.calc.nssfEmployerKes.toFixed(2)},
        ${e.calc.shifKes.toFixed(2)}, ${e.calc.housingLevyEmployeeKes.toFixed(2)}, ${e.calc.housingLevyEmployerKes.toFixed(2)},
        ${e.calc.taxablePayKes.toFixed(2)}, ${e.calc.payeBeforeReliefKes.toFixed(2)}, ${e.calc.personalReliefKes.toFixed(2)},
        ${e.calc.payeTaxKes.toFixed(2)}, ${e.calc.otherDeductionsKes.toFixed(2)}, ${e.calc.netPayKes.toFixed(2)},
        'PAID')
      ON CONFLICT (payslip_number) DO NOTHING;
    `);
  }

  // ---------- AUDIT LOGS ----------
  const audits = [
    { actor: superAdminId, email: 'superadmin@chalarfarms.demo', role: 'SUPER_ADMIN', action: 'SEED_EXECUTED', module: 'SYSTEM', et: 'DATABASE', eid: 'SEED-001', sum: 'Initial development seed executed — 16 demo accounts, 8 departments, 69-table schema' },
    { actor: superAdminId, email: 'superadmin@chalarfarms.demo', role: 'SUPER_ADMIN', action: 'ROLE_PERMISSIONS_CONFIGURED', module: 'ADMIN', et: 'ROLES', eid: 'SYSTEM-ROLES', sum: 'Configured 16 system roles with least-privilege permission mappings' },
    { actor: qaId, email: 'qa@chalarfarms.demo', role: 'QA_OFFICER', action: 'BATCH_QUARANTINED', module: 'QA', et: 'HARVEST_BATCH', eid: 'HB-2026-10-0428', sum: 'Sage harvest batch HB-2026-10-0428 quarantined — intake temp 16.0°C exceeds 15.0°C max; defect rate 6.5% > 5%' },
    { actor: finMgrId, email: 'finance@chalarfarms.demo', role: 'FINANCE_MANAGER', action: 'EXPENSE_APPROVED', module: 'FINANCE', et: 'EXPENSE_RECORD', eid: 'EXP-2026-10-0303', sum: 'Approved KES 128,400 KEPHIS phytosanitary inspection fees' },
    { actor: finMgrId, email: 'finance@chalarfarms.demo', role: 'FINANCE_MANAGER', action: 'EXPENSE_REJECTED', module: 'FINANCE', et: 'EXPENSE_RECORD', eid: 'EXP-2026-10-0320', sum: 'Rejected SMETA consultancy expense pending revised scope of work' },
    { actor: invMgrId, email: 'inventory@chalarfarms.demo', role: 'INVENTORY_MANAGER', action: 'STOCK_ADJUSTMENT_APPROVED', module: 'INVENTORY', et: 'STOCK_ADJUSTMENT', eid: 'SA-2026-10-0022', sum: 'Approved +6 drip elbow correction after workshop return verification' },
    { actor: invMgrId, email: 'inventory@chalarfarms.demo', role: 'INVENTORY_MANAGER', action: 'STOCK_ADJUSTMENT_REJECTED', module: 'INVENTORY', et: 'STOCK_ADJUSTMENT', eid: 'SA-2026-10-0024', sum: 'Rejected 30-carton water-damage write-off — awaiting insurance photo evidence pack' },
    { actor: salesId, email: 'sales@chalarfarms.demo', role: 'SALES_EXPORT_MANAGER', action: 'EXPORT_DOCUMENT_VERIFIED', module: 'SALES', et: 'EXPORT_DOCUMENT', eid: 'EXP-DOC-2026-0185', sum: 'Verified EUR.1 movement certificate application for Vitacress shipment' },
    { actor: logiId, email: 'logistics@chalarfarms.demo', role: 'LOGISTICS_OFFICER', action: 'SHIPMENT_DISPATCHED', module: 'LOGISTICS', et: 'SHIPMENT', eid: 'SHP-2026-10-0071', sum: 'Reefer truck KDD 441X departed for JKIA — 351.50 kg thyme, 14 cartons, 3.2°C' },
    { actor: finMgrId, email: 'finance@chalarfarms.demo', role: 'FINANCE_MANAGER', action: 'PAYROLL_APPROVED', module: 'PAYROLL', et: 'PAYROLL_RUN', eid: 'PAY-2026-10', sum: 'Approved October 2026 payroll run — 16 employees, statutory KE-STAT-2026-V1 applied' },
    { actor: execId, email: 'executive@chalarfarms.demo', role: 'EXECUTIVE_MANAGER', action: 'PO_APPROVED', module: 'PROCUREMENT', et: 'PURCHASE_ORDER', eid: 'PO-2026-10-0144', sum: 'Approved KES 210,000 sleeve film purchase order — PlastiPack Industries' },
    { actor: superAdminId, email: 'superadmin@chalarfarms.demo', role: 'SUPER_ADMIN', action: 'USER_INVITED', module: 'ADMIN', et: 'USER', eid: 'employee@chalarfarms.demo', sum: 'Demo employee account provisioned with GENERAL_EMPLOYEE role' },
    { actor: auditorId, email: 'auditor@chalarfarms.demo', role: 'AUDITOR', action: 'READ_ONLY_REVIEW', module: 'AUDIT', et: 'REPORT', eid: 'Q3-TRACEABILITY', sum: 'Auditor reviewed harvest-to-dispatch traceability records (read-only)' },
    { actor: hrMgrId, email: 'hr@chalarfarms.demo', role: 'HR_MANAGER', action: 'LEAVE_APPROVED', module: 'HR', et: 'LEAVE_REQUEST', eid: 'LR-2026-10-0012', sum: 'Approved 5 days annual leave for EMP-0009 — balance updated' },
    { actor: superAdminId, email: 'superadmin@chalarfarms.demo', role: 'SUPER_ADMIN', action: 'SESSION_REVOKED', module: 'SECURITY', et: 'SESSION', eid: 'SES-REV-0042', sum: 'Revoked stale demo session after password rotation policy review' },
    { actor: finMgrId, email: 'finance@chalarfarms.demo', role: 'FINANCE_MANAGER', action: 'SUPPLIER_INVOICE_MATCHED', module: 'FINANCE', et: 'SUPPLIER_INVOICE', eid: 'SINV-2026-1121', sum: 'Three-way match confirmed PO-2026-10-0144 / GRN-2026-0211 / SINV-2026-1121 — KES 210,000' },
    { actor: qaId, email: 'qa@chalarfarms.demo', role: 'QA_OFFICER', action: 'NCR_CREATED', module: 'QA', et: 'NONCONFORMITY', eid: 'NCR-2026-10-044', sum: 'Raised major NCR for cold chain breach on sage batch HB-2026-10-0428' },
    { actor: hrMgrId, email: 'hr@chalarfarms.demo', role: 'HR_MANAGER', action: 'EMPLOYEE_RECORDED', module: 'HR', et: 'EMPLOYEE_PROFILE', eid: 'EMP-0016', sum: 'Recorded packhouse employee profile with restricted statutory identifiers' },
    { actor: procId, email: 'procurement@chalarfarms.demo', role: 'PROCUREMENT_OFFICER', action: 'GRN_POSTED', module: 'PROCUREMENT', et: 'GOODS_RECEIPT', eid: 'GRN-2026-0212', sum: 'Posted goods receipt — 3,980 cartons accepted, 20 rejected with credit note request' },
    { actor: execId, email: 'executive@chalarfarms.demo', role: 'EXECUTIVE_MANAGER', action: 'BUDGET_REVIEW', module: 'EXECUTIVE', et: 'BUDGET', eid: 'FY2026-Q4', sum: 'Reviewed Q4 departmental budget consumption against actuals' },
    { actor: maintId, email: 'maintenance@chalarfarms.demo', role: 'MAINTENANCE_MANAGER', action: 'WORK_ORDER_COMPLETED', module: 'MAINTENANCE', et: 'WORK_ORDER', eid: 'WO-2026-0177', sum: 'Completed Cold Room 1 compressor service — filter drier replaced from WH-TOOL' },
    { actor: superAdminId, email: 'superadmin@chalarfarms.demo', role: 'SUPER_ADMIN', action: 'SETTINGS_UPDATED', module: 'ADMIN', et: 'SYSTEM_SETTING', eid: 'inventory.critical_temp_c', sum: 'Confirmed cold-chain critical temperature threshold remains 5.0°C for export produce' },
  ];
  for (const a of audits) {
    await db.execute(sql`
      INSERT INTO audit_logs (actor_user_id, actor_email, actor_role, action, module, entity_type,
        entity_id, summary, ip_address, created_at)
      VALUES (${a.actor}, ${a.email}, ${a.role}, ${a.action}, ${a.module}, ${a.et},
        ${a.eid}, ${a.sum}, '127.0.0.1', now() - (random() * interval '14 days'))
      ON CONFLICT DO NOTHING;
    `);
  }

  // ---------- PRIVATE CONVERSATIONS (Super Admin ↔ dashboard managers) ----------
  const convSeed = [
    { code: 'CONV-SA-HR', title: 'Private: Super Admin ↔ HR Manager', type: 'DIRECT_PRIVATE', dash: null, a: superAdminId, b: hrMgrId },
    { code: 'CONV-SA-INV', title: 'Private: Super Admin ↔ Inventory Manager', type: 'DIRECT_PRIVATE', dash: null, a: superAdminId, b: invMgrId },
    { code: 'CONV-SA-FIN', title: 'Private: Super Admin ↔ Finance Manager', type: 'DIRECT_PRIVATE', dash: null, a: superAdminId, b: finMgrId },
    { code: 'CONV-SA-FARM', title: 'Private: Super Admin ↔ Farm Manager', type: 'DIRECT_PRIVATE', dash: null, a: superAdminId, b: farmMgrId },
    { code: 'CONV-SA-SALES', title: 'Private: Super Admin ↔ Sales & Export Manager', type: 'DIRECT_PRIVATE', dash: null, a: superAdminId, b: salesId },
    { code: 'CONV-CHAN-QA', title: 'QA Dashboard Channel (Super Admin + QA Officer)', type: 'DASHBOARD_CHANNEL', dash: 'dashboard.qa', a: superAdminId, b: qaId },
    { code: 'CONV-CHAN-PACK', title: 'Packhouse Dashboard Channel (Super Admin + Packhouse Manager)', type: 'DASHBOARD_CHANNEL', dash: 'dashboard.packhouse', a: superAdminId, b: packMgrId },
  ];
  for (const c of convSeed) {
    await db.execute(sql`
      INSERT INTO conversations (code, title, conversation_type, target_dashboard_code, created_by_user_id)
      VALUES (${c.code}, ${c.title}, ${c.type}, ${c.dash}, ${superAdminId})
      ON CONFLICT (code) DO NOTHING;
    `);
    const convId = rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM conversations WHERE code = ${c.code}`)
    )[0].id;
    for (const [uidv, role] of [
      [c.a, 'OWNER'],
      [c.b, 'PARTICIPANT'],
    ] as Array<[number, string]>) {
      await db.execute(sql`
        INSERT INTO conversation_members (conversation_id, user_id, member_role, last_read_at)
        VALUES (${convId}, ${uidv}, ${role}, now() - interval '1 day')
        ON CONFLICT DO NOTHING;
      `);
    }
  }

  const convIdByCode = async (code: string) =>
    rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM conversations WHERE code = ${code}`)
    )[0].id;

  const msgSeed: Array<[string, number, string, number]> = [
    // convCode, senderUserId, body, hoursAgo
    ['CONV-SA-HR', hrMgrId, 'Super Admin — October leave queue is ready for your review. Two seasonal harvest crew requests need a decision before the week 44 roster is locked.', 6],
    ['CONV-SA-HR', superAdminId, 'Received. Please ensure the supporting sick-leave documentation stays in the restricted HR folder, and confirm the leave balances post correctly after approval.', 5],
    ['CONV-SA-HR', hrMgrId, 'Understood — balances will reconcile against the approved leave type entitlements, and I will keep the documents access-restricted to HR only.', 4],
    ['CONV-SA-INV', invMgrId, 'Heads-up: stock adjustment SA-2026-10-0024 (30 water-damaged cartons) was rejected pending insurance photo evidence. System stock still shows 6,840 cartons.', 7],
    ['CONV-SA-INV', superAdminId, 'Good. Keep the adjustment pending until Maintenance files the roof-leak work order reference. No silent stock rewrites.', 6],
    ['CONV-SA-FIN', finMgrId, 'October payroll run PAY-2026-10 approved using statutory version KE-STAT-2026-V1. Total net pay reconciles to payslip records for all 16 employees.', 9],
    ['CONV-SA-FIN', superAdminId, 'Noted. Please attach the trial balance extract to the board pack once Q4 journal entries settle.', 8],
    ['CONV-SA-FARM', farmMgrId, 'Sage batch HB-2026-10-0428 is quarantined by QA (intake temp 16°C). Field crew briefed on the 30-minute harvest-to-cooling SLA.', 5],
    ['CONV-SA-FARM', superAdminId, 'Please log the SLA retraining in the training records module so it shows up on the compliance trail.', 4],
    ['CONV-SA-SALES', salesId, 'KEPHIS pre-shipment inspection for SHP-2026-10-0071 is lodged. Certificate number will be recorded only once KEPHIS issues it.', 3],
    ['CONV-SA-SALES', superAdminId, 'Correct approach — no invented certificate numbers. Notify me the moment the phytosanitary certificate lands.', 2],
    ['CONV-CHAN-QA', qaId, 'NCR-2026-10-044 raised (MAJOR) for the sage cold-chain breach. Corrective and preventive actions assigned; due 2026-10-31.', 6],
    ['CONV-CHAN-QA', superAdminId, 'Acknowledged. Verify the pull-down temperature after 6h and record the re-inspection in the quality module before release.', 5],
    ['CONV-CHAN-PACK', packMgrId, 'Packing line PO-2026-10-0190 (basil) at 78% completion — 36,800 sleeves issued from WH-PKG.', 4],
    ['CONV-CHAN-PACK', superAdminId, 'Keep the mass-balance variance under 1.5% and flag anything above threshold to QA before the batch closes.', 3],
  ];
  let msgNo = 0;
  for (const m of msgSeed) {
    msgNo += 1;
    const convId = await convIdByCode(m[0]);
    await db.execute(sql`
      INSERT INTO messages (conversation_id, sender_user_id, body, message_type, created_at, updated_at)
      VALUES (${convId}, ${m[1]}, ${m[2]}, 'TEXT',
        now() - (${m[3]} * interval '1 hour'), now() - (${m[3]} * interval '1 hour'));
    `);
    // receipts for the other member
    const otherMember = rows<{ user_id: number }>(
      await db.execute(sql`
        SELECT user_id FROM conversation_members WHERE conversation_id = ${convId} AND user_id != ${m[1]}
      `)
    )[0];
    if (otherMember) {
      await db.execute(sql`
        INSERT INTO message_receipts (message_id, conversation_id, user_id, delivered_at, read_at)
        SELECT max(id), ${convId}, ${otherMember.user_id},
          now() - (${m[3]} * interval '1 hour'),
          CASE WHEN random() > 0.25 THEN now() - (${Math.max(1, m[3] - 1)} * interval '1 hour') ELSE NULL END
        FROM messages WHERE conversation_id = ${convId} AND sender_user_id = ${m[1]}
          AND body = ${m[2]};
      `);
    }
  }

  // ---------- NOTIFICATIONS ----------
  const notifications = [
    { user: invMgrId, cat: 'INVENTORY', title: 'Low stock alert', sum: 'Fresh Oregano Bunch 75g (38 kg) below reorder level 50 kg', url: '/portal/inventory' },
    { user: invMgrId, cat: 'INVENTORY', title: 'Low stock alert', sum: 'Fresh Tarragon Bunch 75g (54 kg) at reorder level 60 kg', url: '/portal/inventory' },
    { user: finMgrId, cat: 'APPROVALS', title: 'Purchase approval pending', sum: 'PR-2026-10-0073 — Cold room filter kits, KES 30,400 awaiting decision', url: '/portal/procurement' },
    { user: finMgrId, cat: 'APPROVALS', title: 'Purchase approval pending', sum: 'PR-2026-10-0074 — Hygiene sanitiser, KES 28,800 awaiting decision', url: '/portal/procurement' },
    { user: qaId, cat: 'QUALITY', title: 'Batch quarantine', sum: 'HB-2026-10-0428 (sage) quarantined — NCR-2026-10-044 open', url: '/portal/qa' },
    { user: hrMgrId, cat: 'HR', title: 'Leave applications pending', sum: '2 seasonal crew leave requests awaiting your approval', url: '/portal/hr' },
    { user: salesId, cat: 'EXPORT', title: 'Document expiry approaching', sum: 'EUR.1 certificate EXP-DOC-2026-0185 expires 2026-11-25', url: '/portal/sales' },
    { user: maintId, cat: 'MAINTENANCE', title: 'Maintenance due', sum: 'Cold Room 2 preventive service due 2026-10-29 (WO-2026-0178)', url: '/portal/maintenance' },
    { user: logiId, cat: 'LOGISTICS', title: 'Shipment milestone', sum: 'SHP-2026-10-0071 in transit to JKIA — AWB KQ-703-44829105', url: '/portal/logistics' },
    { user: superAdminId, cat: 'ADMIN', title: 'Security review', sum: '15 login events recorded in the last 24 hours — no lockouts', url: '/portal/super-admin' },
    { user: procId, cat: 'PROCUREMENT', title: 'Delivery overdue', sum: 'PO-2026-10-0148 basil seed delivery expected 2026-11-15', url: '/portal/procurement' },
    { user: packMgrId, cat: 'PRODUCTION', title: 'Mass balance variance', sum: 'PO-2026-10-0190 basil run variance 30 kg (1.08%) — within 1.5% threshold', url: '/portal/packhouse' },
    { user: farmMgrId, cat: 'FARM', title: 'Harvest window', sum: 'Cycle CC-2026-BAS-A1 harvest window open through 2026-10-27', url: '/portal/farm' },
    { user: execId, cat: 'REPORTS', title: 'Weekly executive digest', sum: 'Fresh herb dispatches 4 shipments; pending approvals 7; open NCRs 1', url: '/portal/executive' },
    { user: employeeId, cat: 'SELF_SERVICE', title: 'Payslip available', sum: 'October 2026 payslip is ready in your self-service workspace', url: '/portal/workspaces' },
    { user: auditorId, cat: 'AUDIT', title: 'Audit sample ready', sum: 'Q4 traceability sample (20 batches) prepared for read-only review', url: '/portal/workspaces' },
    { user: supervisorId, cat: 'SUPERVISOR', title: 'Attendance follow-up', sum: '1 missed clock-out recorded yesterday — correction requested', url: '/portal/workspaces' },
    { user: payrollId, cat: 'PAYROLL', title: 'Payroll approved', sum: 'PAY-2026-10 approved by Finance Manager — payslips unlocked', url: '/portal/finance' },
    { user: invMgrId, cat: 'INVENTORY', title: 'Stock adjustment pending', sum: 'SA-2026-10-0027 — QA seed germination test consumption awaiting approval', url: '/portal/inventory' },
    { user: finMgrId, cat: 'FINANCE', title: 'Overdue invoice', sum: 'SINV-2026-1122 variance hold — 20 carton GRN mismatch, payment disputed', url: '/portal/finance' },
  ];
  for (const n of notifications) {
    const read = Math.random() > 0.45;
    await db.execute(sql`
      INSERT INTO notification_records (user_id, category, title, summary, link_url, is_read, read_at)
      VALUES (${n.user}, ${n.cat}, ${n.title}, ${n.sum}, ${n.url},
        ${read}, ${read ? sql`now() - interval '3 hours'` : sql`NULL`});
    `);
  }

  // ---------- ATTENDANCE (last 14 days) ----------
  const attEmployees = rows<{ id: number; department_id: number; job_title: string }>(
    await db.execute(sql`SELECT id, department_id, job_title FROM employee_profiles ORDER BY id`)
  );
  for (const emp of attEmployees) {
    const shiftCode = ['Packhouse Packer', 'Cold Room Operator'].includes(emp.job_title)
      ? 'SHIFT-DAY'
      : ['Field Supervisor', 'Field Technician', 'Harvest Crew Lead'].includes(emp.job_title)
        ? 'SHIFT-EARLY'
        : emp.job_title === 'Store Assistant'
          ? 'SHIFT-COLD'
          : 'SHIFT-ADMIN';
    const shiftRow = rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM shifts WHERE code = ${shiftCode}`)
    )[0];
    for (let daysAgo = 0; daysAgo <= 14; daysAgo++) {
      const dateRes = rows<{ d: string }>(
        await db.execute(sql`SELECT (CURRENT_DATE - ${daysAgo}::int)::text AS d`)
      )[0].d;
      const dow = new Date(dateRes + 'T00:00:00Z').getUTCDay();
      if (dow === 0) continue; // Sunday rest day
      const isToday = daysAgo === 0;

      const r = Math.random();
      let status = 'PRESENT';
      let clockIn: string | null = null;
      let clockOut: string | null = null;
      let late = 0;
      let reg = '8.00';
      let ot = '0.00';

      if (r < 0.06) {
        status = 'ABSENT';
        reg = '0.00';
      } else if (r < 0.11) {
        status = 'LATE';
        late = Math.floor(10 + Math.random() * 35);
        clockIn = late > 30 ? '07:45' : '07:20';
        clockOut = '17:05';
      } else {
        clockIn = shiftCode === 'SHIFT-EARLY' ? '05:28' : shiftCode === 'SHIFT-COLD' ? '07:57' : '06:58';
        clockOut = shiftCode === 'SHIFT-EARLY' ? '14:34' : shiftCode === 'SHIFT-COLD' ? '18:12' : '17:06';
        if (Math.random() < 0.18) {
          ot = (1 + Math.random() * 2.5).toFixed(2);
        }
      }

      // Today's shift is still in progress: clocked in, not yet out, hours accrue at close.
      if (isToday && status !== 'ABSENT') {
        clockOut = null;
        reg = '0.00';
        ot = '0.00';
      }

      await db.execute(sql`
        INSERT INTO attendance_records (employee_id, attendance_date, shift_id, clock_in_at, clock_out_at,
          regular_hours, overtime_hours, late_minutes, status, timesheet_approved, approved_by_user_id)
        VALUES (${emp.id}, ${dateRes}, ${shiftRow.id}, ${clockIn}, ${clockOut},
          ${reg}, ${ot}, ${late}, ${status}, ${isToday ? false : status !== 'ABSENT'}, ${isToday ? null : supervisorId})
        ON CONFLICT DO NOTHING;
      `);
    }
  }

  // ---------- OVERTIME REQUESTS ----------
  const otSeed = [
    { empIdx: 0, d: '2026-10-24', h: '2.50', why: 'EU order surge — basil night packing run', st: 'APPROVED', app: supervisorId },
    { empIdx: 1, d: '2026-10-23', h: '3.00', why: 'Cold room pull-down verification during peak intake', st: 'APPROVED', app: supervisorId },
    { empIdx: 2, d: '2026-10-25', h: '1.50', why: 'Field irrigation line repair after afternoon blockage', st: 'PENDING', app: null },
    { empIdx: 3, d: '2026-10-22', h: '2.00', why: 'Late KEPHIS inspection support at packhouse', st: 'PENDING', app: null },
    { empIdx: 4, d: '2026-10-21', h: '4.00', why: 'Month-end stocktake support', st: 'APPROVED', app: supervisorId },
    { empIdx: 5, d: '2026-10-20', h: '2.00', why: 'Chives transplanting catch-up', st: 'REJECTED', app: supervisorId },
    { empIdx: 6, d: '2026-10-24', h: '3.50', why: 'Export carton surge — rosemary run', st: 'PENDING', app: null },
    { empIdx: 7, d: '2026-10-19', h: '2.50', why: 'Sunday pre-shipment QA sampling', st: 'APPROVED', app: supervisorId },
    { empIdx: 8, d: '2026-10-25', h: '2.00', why: 'Tractor seedbed preparation window', st: 'APPROVED', app: supervisorId },
    { empIdx: 9, d: '2026-10-26', h: '1.00', why: 'Sunday dispatch dock loading', st: 'PENDING', app: null },
    { empIdx: 10, d: '2026-10-18', h: '5.00', why: 'Fruit Logistica booth prep support', st: 'PENDING', app: null },
    { empIdx: 11, d: '2026-10-24', h: '3.00', why: 'Cold Room 1 compressor service after hours', st: 'APPROVED', app: supervisorId },
    { empIdx: 12, d: '2026-10-23', h: '2.00', why: 'Packaging line changeover training', st: 'APPROVED', app: supervisorId },
    { empIdx: 13, d: '2026-10-26', h: '2.50', why: 'NCR corrective action implementation', st: 'PENDING', app: null },
    { empIdx: 14, d: '2026-10-25', h: '4.00', why: 'SMETA audit evidence compilation', st: 'APPROVED', app: supervisorId },
    { empIdx: 15, d: '2026-10-26', h: '3.50', why: 'ERP data verification support', st: 'PENDING', app: null },
    { empIdx: 4, d: '2026-10-26', h: '2.00', why: 'Secondary stocktake recount', st: 'REJECTED', app: supervisorId },
    { empIdx: 1, d: '2026-10-17', h: '1.50', why: 'Weekend cold room temperature audit', st: 'APPROVED', app: supervisorId },
    { empIdx: 3, d: '2026-10-17', h: '3.00', why: 'Weekend hygiene deep-clean', st: 'PENDING', app: null },
    { empIdx: 8, d: '2026-10-16', h: '2.00', why: 'Irrigation pump servicing window', st: 'APPROVED', app: supervisorId },
    { empIdx: 14, d: '2026-10-16', h: '1.00', why: 'Records digitisation session', st: 'PENDING', app: null },
    { empIdx: 12, d: '2026-10-15', h: '4.00', why: 'Export order picking support', st: 'APPROVED', app: supervisorId },
  ];
  for (const o of otSeed) {
    const emp = attEmployees[o.empIdx % attEmployees.length];
    if (!emp) continue;
    await db.execute(sql`
      INSERT INTO overtime_requests (employee_id, work_date, requested_hours, reason, rate_multiplier,
        status, approved_by_user_id, approved_at)
      VALUES (${emp.id}, ${o.d}, ${o.h}, ${o.why}, 1.50,
        ${o.st}, ${o.app ?? null},
        CASE WHEN ${o.st} = 'APPROVED' THEN now() - interval '2 days' ELSE NULL END);
    `);
  }

  // ---------- LEAVE BALANCES & REQUESTS ----------
  const ltRows = rows<{ id: number; code: string; default_annual_days: number }>(
    await db.execute(sql`SELECT id, code, default_annual_days FROM leave_types`)
  );
  const empAll = rows<{ id: number; employment_type: string }>(
    await db.execute(sql`SELECT id, employment_type FROM employee_profiles`)
  );
  for (const emp of empAll) {
    for (const lt of ltRows) {
      const entitled =
        lt.code === 'ANNUAL'
          ? emp.employment_type === 'CASUAL' || emp.employment_type === 'SEASONAL'
            ? 6
            : 21
          : lt.default_annual_days;
      const used = Math.round(Math.random() * Math.min(10, entitled) * 2) / 2;
      const pending = Math.random() < 0.15 ? 3 : 0;
      const entitledStr = `${entitled}.00`;
      const usedStr = `${used.toFixed(2)}`;
      const pendingStr = `${pending.toFixed(2)}`;
      const remainingStr = (entitled - used - pending).toFixed(2);
      await db.execute(sql`
        INSERT INTO leave_balances (employee_id, leave_type_id, year, entitled_days, used_days,
          pending_days, remaining_days)
        VALUES (${emp.id}, ${lt.id}, 2026, ${entitledStr}, ${usedStr}, ${pendingStr}, ${remainingStr})
        ON CONFLICT DO NOTHING;
      `);
    }
  }

  const leaveReqs = [
    { empIdx: 2, lt: 'ANNUAL', s: '2026-11-09', e: '2026-11-13', days: '5', why: 'Family commitment — travel to Nairobi', st: 'PENDING' },
    { empIdx: 5, lt: 'SICK', s: '2026-10-20', e: '2026-10-22', days: '3', why: 'Medical leave with clinic letter attached (restricted HR file)', st: 'APPROVED' },
    { empIdx: 8, lt: 'ANNUAL', s: '2026-12-07', e: '2026-12-11', days: '5', why: 'Planned annual leave after peak harvest', st: 'PENDING' },
    { empIdx: 11, lt: 'FAMILY', s: '2026-10-27', e: '2026-10-28', days: '2', why: 'Immediate family bereavement', st: 'APPROVED' },
    { empIdx: 13, lt: 'ANNUAL', s: '2026-11-23', e: '2026-11-27', days: '5', why: 'Annual leave — planned break', st: 'PENDING' },
    { empIdx: 0, lt: 'SICK', s: '2026-10-12', e: '2026-10-14', days: '3', why: 'Malaria treatment — discharge note on file', st: 'REJECTED' },
    { empIdx: 15, lt: 'PATERNITY', s: '2026-11-02', e: '2026-11-13', days: '10', why: 'Paternity leave — statutory entitlement', st: 'APPROVED' },
    { empIdx: 6, lt: 'ANNUAL', s: '2026-12-14', e: '2026-12-18', days: '5', why: 'Festive season leave', st: 'PENDING' },
    { empIdx: 1, lt: 'ANNUAL', s: '2026-11-16', e: '2026-11-20', days: '5', why: 'Annual leave', st: 'PENDING' },
    { empIdx: 12, lt: 'UNPAID', s: '2026-12-01', e: '2026-12-05', days: '5', why: 'Study leave — certificate course examinations', st: 'PENDING' },
    { empIdx: 9, lt: 'ANNUAL', s: '2026-11-30', e: '2026-12-04', days: '5', why: 'Annual leave', st: 'PENDING' },
    { empIdx: 4, lt: 'MATERNITY', s: '2027-01-11', e: '2027-04-11', days: '91', why: 'Maternity leave — statutory 3 months', st: 'PENDING' },
    { empIdx: 10, lt: 'ANNUAL', s: '2026-12-21', e: '2026-12-24', days: '4', why: 'Festive season leave', st: 'PENDING' },
    { empIdx: 3, lt: 'FAMILY', s: '2026-10-29', e: '2026-10-30', days: '2', why: 'Child school emergency', st: 'APPROVED' },
    { empIdx: 7, lt: 'ANNUAL', s: '2026-11-02', e: '2026-11-06', days: '5', why: 'Annual leave', st: 'PENDING' },
    { empIdx: 14, lt: 'ANNUAL', s: '2026-12-28', e: '2027-01-04', days: '5', why: 'Year-end leave', st: 'PENDING' },
    { empIdx: 11, lt: 'ANNUAL', s: '2026-11-09', e: '2026-11-13', days: '5', why: 'Annual leave', st: 'APPROVED' },
    { empIdx: 0, lt: 'ANNUAL', s: '2026-12-07', e: '2026-12-11', days: '5', why: 'Annual leave', st: 'PENDING' },
  ];
  let lrNo = 0;
  for (const l of leaveReqs) {
    lrNo += 1;
    const emp = empAll[l.empIdx % empAll.length];
    const lt = ltRows.find((x) => x.code === l.lt);
    if (!emp || !lt) continue;
    const reqNum = `LR-2026-10-${String(lrNo).padStart(4, '0')}`;
    const reviewer =
      l.st === 'PENDING'
        ? null
        : l.st === 'REJECTED'
          ? supervisorId
          : supervisorId;
    await db.execute(sql`
      INSERT INTO leave_requests (request_number, employee_id, leave_type_id, start_date, end_date,
        total_days, reason, status, reviewed_by_user_id, review_comments, reviewed_at)
      VALUES (${reqNum}, ${emp.id}, ${lt.id}, ${l.s}, ${l.e}, ${l.days}, ${l.why}, ${l.st},
        ${reviewer}, ${l.st === 'PENDING' ? null : l.st === 'REJECTED' ? 'Insufficient shift cover during EU order window — employee notified to resubmit' : 'Approved with team roster adjusted'},
        CASE WHEN ${l.st} != 'PENDING' THEN now() - interval '3 days' ELSE NULL END)
      ON CONFLICT (request_number) DO NOTHING;
    `);
    if (l.st === 'APPROVED') {
      await db.execute(sql`
        UPDATE leave_balances SET used_days = used_days + ${l.days}::numeric,
          remaining_days = remaining_days - ${l.days}::numeric
        WHERE employee_id = ${emp.id} AND leave_type_id = ${lt.id} AND year = 2026;
      `);
    } else if (l.st === 'PENDING') {
      await db.execute(sql`
        UPDATE leave_balances SET pending_days = pending_days + ${l.days}::numeric,
          remaining_days = remaining_days - ${l.days}::numeric
        WHERE employee_id = ${emp.id} AND leave_type_id = ${lt.id} AND year = 2026;
      `);
    }
  }

  // ---------- RECRUITMENT ----------
  const vacs = [
    { code: 'VAC-2026-014', title: 'Packhouse Line Supervisor', dept: 'PACK', type: 'PERMANENT', n: 1, st: 'INTERVIEWING', close: '2026-11-07', desc: 'Supervise EU export packing lines, mass-balance reconciliation and team attendance. Minimum 3 years fresh produce packhouse experience.' },
    { code: 'VAC-2026-015', title: 'Quality Assurance Technician', dept: 'QAFOOD', type: 'CONTRACT', n: 2, st: 'OPEN', close: '2026-11-14', desc: 'Execute incoming, in-process and finished-product inspections under GlobalG.A.P./HACCP protocols. Food science diploma required.' },
    { code: 'VAC-2026-016', title: 'Field Harvest Crew (Seasonal)', dept: 'FARM', type: 'SEASONAL', n: 25, st: 'OPEN', close: '2026-11-30', desc: 'Seasonal harvest support for peak basil and lemongrass programme. Training provided on harvest-to-cooling SLA.' },
    { code: 'VAC-2026-012', title: 'Refrigerated Truck Driver', dept: 'LOG', type: 'CONTRACT', n: 1, st: 'OFFERED', close: '2026-10-15', desc: 'Drive chilled Taveta–JKIA corridor. Valid PSV license and cold chain handling experience required.' },
    { code: 'VAC-2026-013', title: 'Payroll & Compliance Clerk', dept: 'FIN', type: 'PERMANENT', n: 1, st: 'OFFERED', close: '2026-10-31', desc: 'Support payroll processing, statutory remittances and records management. CPA Part II or equivalent.' },
    { code: 'VAC-2026-009', title: 'Irrigation Technician', dept: 'FARM', type: 'PERMANENT', n: 1, st: 'CLOSED', close: '2026-09-30', desc: 'Maintain drip irrigation networks across greenhouse and open-field blocks.' },
    { code: 'VAC-2026-010', title: 'Store Assistant — Agro-Inputs', dept: 'INV', type: 'CASUAL', n: 2, st: 'CLOSED', close: '2026-10-10', desc: 'Receive, stack and issue fertiliser and crop protection stock under supervision.' },
    { code: 'VAC-2026-011', title: 'Export Documentation Officer', dept: 'SALEX', type: 'PERMANENT', n: 1, st: 'CLOSED', close: '2026-10-24', desc: 'Prepare and track phytosanitary certificates, EUR.1, AWBs and commercial invoices.' },
    { code: 'VAC-2026-017', title: 'Mechanic / Fitter', dept: 'MAINT', type: 'CONTRACT', n: 1, st: 'OPEN', close: '2026-11-21', desc: 'Service tractors, irrigation pumps and packhouse equipment. Trade certificate required.' },
    { code: 'VAC-2026-018', title: 'Farm Records & Data Clerk', dept: 'FARM', type: 'CONTRACT', n: 1, st: 'OPEN', close: '2026-11-28', desc: 'Digitise field activity, input application and harvest records into the ERP.' },
  ];
  for (const v of vacs) {
    const dId = await depId(v.dept);
    await db.execute(sql`
      INSERT INTO recruitment_vacancies (vacancy_code, title, department_id, employment_type,
        positions_count, status, closing_date, description)
      VALUES (${v.code}, ${v.title}, ${dId}, ${v.type}, ${v.n}, ${v.st}, ${v.close}, ${v.desc})
      ON CONFLICT (vacancy_code) DO NOTHING;
    `);
  }
  const vacId = async (code: string) =>
    rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM recruitment_vacancies WHERE vacancy_code = ${code}`)
    )[0].id;

  const candidates = [
    { vac: 'VAC-2026-014', name: 'Agnes Mwakonde', email: 'agnes.mwakonde@example.demo', phone: '+254 712 445 901', st: 'INTERVIEW_SCHEDULED', iv: '2026-11-03', notes: '6 years packhouse supervision at a Naivasha horticulture exporter' },
    { vac: 'VAC-2026-014', name: 'Felix Baraka', email: 'felix.baraka@example.demo', phone: '+254 733 118 274', st: 'APPLIED', notes: '' },
    { vac: 'VAC-2026-014', name: 'Mercy Kilonzo', email: 'mercy.kilonzo@example.demo', phone: '+254 720 663 402', st: 'SCREENING', notes: 'Shortlisted — packhouse lead experience' },
    { vac: 'VAC-2026-015', name: 'Dr. Alice Wekesa', email: 'alice.wekesa@example.demo', phone: '+254 711 909 330', st: 'INTERVIEW_SCHEDULED', iv: '2026-11-05', notes: 'MSc Food Safety; previously audited fresh produce facilities' },
    { vac: 'VAC-2026-015', name: 'Peter Odhiambo', email: 'peter.odhiambo@example.demo', phone: '+254 745 220 761', st: 'APPLIED', notes: '' },
    { vac: 'VAC-2026-015', name: 'Susan Njoki', email: 'susan.njoki@example.demo', phone: '+254 726 551 093', st: 'APPLIED', notes: '' },
    { vac: 'VAC-2026-016', name: 'Halima Said', email: 'halima.said@example.demo', phone: '+254 718 447 220', st: 'APPLIED', notes: '' },
    { vac: 'VAC-2026-016', name: 'John Mwakio', email: 'john.mwakio@example.demo', phone: '+254 729 118 445', st: 'APPLIED', notes: '' },
    { vac: 'VAC-2026-016', name: 'Beatrice Chacha', email: 'beatrice.chacha@example.demo', phone: '+254 741 900 615', st: 'SCREENING', notes: 'Prior seasonal harvest experience at Chalar' },
    { vac: 'VAC-2026-016', name: 'Ali Hassan', email: 'ali.hassan@example.demo', phone: '+254 736 447 802', st: 'APPLIED', notes: '' },
    { vac: 'VAC-2026-016', name: 'Rose Njeri', email: 'rose.njeri@example.demo', phone: '+254 714 220 556', st: 'APPLIED', notes: '' },
    { vac: 'VAC-2026-016', name: 'Samuel Mutua', email: 'samuel.mutua@example.demo', phone: '+254 727 118 004', st: 'SCREENING', notes: 'Available from week 45' },
    { vac: 'VAC-2026-016', name: 'Grace Auma', email: 'grace.auma@example.demo', phone: '+254 710 663 278', st: 'APPLIED', notes: '' },
    { vac: 'VAC-2026-016', name: 'Joseph Musyoka', email: 'joseph.musyoka@example.demo', phone: '+254 722 991 345', st: 'APPLIED', notes: '' },
    { vac: 'VAC-2026-016', name: 'Fatuma Ali', email: 'fatuma.ali@example.demo', phone: '+254 748 552 773', st: 'APPLIED', notes: '' },
    { vac: 'VAC-2026-017', name: 'Dennis Kiplagat', email: 'dennis.kiplagat@example.demo', phone: '+254 719 447 009', st: 'SCREENING', notes: 'Trade certificate in diesel mechanics verified' },
    { vac: 'VAC-2026-018', name: 'Lydia Nkatha', email: 'lydia.nkatha@example.demo', phone: '+254 724 118 660', st: 'APPLIED', notes: '' },
    { vac: 'VAC-2026-018', name: 'Brian Mutiso', email: 'brian.mutiso@example.demo', phone: '+254 717 900 441', st: 'INTERVIEW_SCHEDULED', iv: '2026-11-06', notes: 'Strong Excel and database data-entry assessment result' },
    { vac: 'VAC-2026-018', name: 'Cynthia Wavinya', email: 'cynthia.wavinya@example.demo', phone: '+254 732 664 018', st: 'APPLIED', notes: '' },
    { vac: 'VAC-2026-018', name: 'Martin Kioko', email: 'martin.kioko@example.demo', phone: '+254 743 118 275', st: 'APPLIED', notes: '' },
  ];
  for (const c of candidates) {
    const vId = await vacId(c.vac);
    await db.execute(sql`
      INSERT INTO candidates (vacancy_id, full_name, email, phone, stage, interview_date, interviewer_notes,
        onboarding_checklist_json)
      VALUES (${vId}, ${c.name}, ${c.email}, ${c.phone}, ${c.st}, ${c.iv ?? null}, ${c.notes || null},
        CASE WHEN ${c.st} = 'HIRED' THEN '["Contract signed","KRA PIN collected","NSSF registered","SHIF registered","Bank details captured","Induction scheduled"]'::jsonb ELSE NULL END);
    `);
  }

  // ---------- TRAINING ----------
  const trainings = [
    { prog: 'GlobalG.A.P. Food Safety & Handling Refresher', cat: 'FOOD_SAFETY', trainer: 'External Lead Auditor (SGS)', d: '2026-09-18', exp: '2027-09-17', empIdx: 1, st: 'COMPLETED', cert: 'GAP-FS-2026-0142', score: 96 },
    { prog: 'HACCP Principles for Fresh Produce', cat: 'FOOD_SAFETY', trainer: 'Dr. Alice Wekesa (External)', d: '2026-08-22', exp: '2028-08-21', empIdx: 3, st: 'COMPLETED', cert: 'HACCP-FP-2026-0087', score: 94 },
    { prog: 'Cold Chain Management & Temperature Control', cat: 'OPERATIONS', trainer: 'Cold Chain Systems Kenya', d: '2026-10-07', exp: '2027-10-06', empIdx: 5, st: 'COMPLETED', cert: 'CCM-2026-0051', score: 92 },
    { prog: 'Harvest-to-Cooling 30-Minute SLA (NCR CAPA)', cat: 'OPERATIONS', trainer: 'QA Department (Internal)', d: '2026-10-26', exp: null, empIdx: 7, st: 'IN_PROGRESS', cert: null, score: 0 },
    { prog: 'Supervising Seasonal Workforce & Timekeeping', cat: 'LEADERSHIP', trainer: 'HR Department (Internal)', d: '2026-07-15', exp: '2027-07-14', empIdx: 8, st: 'COMPLETED', cert: 'SUP-2026-0019', score: 89 },
    { prog: 'Crop Protection IPM & PHI Observance', cat: 'AGRONOMY', trainer: 'Agronomy Consultant', d: '2026-06-11', exp: '2027-06-10', empIdx: 2, st: 'COMPLETED', cert: 'IPM-2026-0033', score: 91 },
    { prog: 'Food Handler Hygiene Certification', cat: 'FOOD_SAFETY', trainer: 'County Health Dept Partner', d: '2026-05-28', exp: '2027-05-27', empIdx: 6, st: 'COMPLETED', cert: 'FH-2026-0904', score: 98 },
    { prog: 'Forklift Operation & Warehouse Safety', cat: 'SAFETY', trainer: 'Voi Industrial Spares Ltd', d: '2026-04-09', exp: '2028-04-08', empIdx: 4, st: 'COMPLETED', cert: 'FLT-2026-0077', score: 93 },
    { prog: 'Ethical Trade & SMETA Worker Grievance Procedure', cat: 'COMPLIANCE', trainer: 'Compliance Manager', d: '2026-03-20', exp: '2027-03-19', empIdx: 14, st: 'COMPLETED', cert: 'SMETA-2026-0110', score: 95 },
    { prog: 'Manual Handling & Ergonomics', cat: 'SAFETY', trainer: 'HR Department (Internal)', d: '2026-10-10', exp: null, empIdx: 10, st: 'IN_PROGRESS', cert: null, score: 0 },
  ];
  for (const tr of trainings) {
    const emp = empAll[tr.empIdx % empAll.length];
    if (!emp) continue;
    await db.execute(sql`
      INSERT INTO training_records (program_name, category, trainer_name, training_date, expiry_date,
        employee_id, completion_status, certificate_number, score_percent)
      VALUES (${tr.prog}, ${tr.cat}, ${tr.trainer}, ${tr.d}, ${tr.exp ?? null},
        ${emp.id}, ${tr.st}, ${tr.cert ?? null}, ${tr.score});
    `);
  }

  // ---------- PERFORMANCE REVIEWS ----------
  const reviews = [
    { empIdx: 1, period: 'H1-2026', kpi: '92.50', rating: 'EXCEEDS_EXPECTATIONS', obj: 'Achieve ≥98% GlobalG.A.P. audit readiness; reduce post-harvest losses below 2%', assess: 'Consistently maintains inspection readiness. Post-harvest loss reduced from 2.6% to 1.9% through improved field-to-cooling discipline.', dev: 'Lead the SMETA follow-up actions in Q4 and mentor the new QA technician.', d: '2026-07-14' },
    { empIdx: 3, period: 'H1-2026', kpi: '88.00', rating: 'MEETS_EXPECTATIONS', obj: 'Zero missed phytosanitary inspections; on-time export document issuance ≥95%', assess: 'All KEPHIS inspections scheduled on time; document issuance at 93%. Improvement needed on EUR.1 lead times.', dev: 'Complete export documentation cross-training with Sales by Q4 2026.', d: '2026-07-15' },
    { empIdx: 5, period: 'H1-2026', kpi: '94.20', rating: 'EXCEEDS_EXPECTATIONS', obj: 'Maintain cold room availability ≥99%; complete preventive maintenance schedule', assess: 'Cold room uptime 99.4%. Preventive schedule 100% completed with parts consumed tracked to inventory.', dev: 'Pursue refrigeration certification sponsorship application.', d: '2026-07-16' },
    { empIdx: 8, period: 'H1-2026', kpi: '85.75', rating: 'MEETS_EXPECTATIONS', obj: 'Attendance ≥95% for assigned crew; leave requests processed within 48h', assess: 'Crew attendance 96.1%; leave processing averaged 36 hours. Occasional delayed timesheet submissions.', dev: 'Adopt ERP timesheet reminders; delegate timesheet review to assistant supervisor.', d: '2026-07-17' },
    { empIdx: 4, period: 'H1-2026', kpi: '90.10', rating: 'MEETS_EXPECTATIONS', obj: 'Zero stockout events on critical packaging SKUs; cycle count accuracy ≥98%', assess: 'No critical stockouts; count accuracy 98.3%. Two late GRN postings during peak week.', dev: 'Train backup receiver on GRN posting; introduce dock-to-system SLA of 4 hours.', d: '2026-07-18' },
    { empIdx: 10, period: 'H1-2026', kpi: '91.60', rating: 'MEETS_EXPECTATIONS', obj: 'On-time dispatch ≥96%; temperature excursion rate <1%', assess: 'On-time dispatch 96.8%; zero temperature excursions on completed shipments.', dev: 'Document JKIA handover SOP for courier partners.', d: '2026-07-20' },
    { empIdx: 11, period: 'H1-2026', kpi: '87.40', rating: 'MEETS_EXPECTATIONS', obj: 'Equipment downtime <4 hours/week; spare parts stock accuracy ≥97%', assess: 'Average downtime 3.4 h/week. Parts accuracy at 96% — needs bin labelling discipline.', dev: 'Complete workshop bin re-labelling project by Q4.', d: '2026-07-21' },
    { empIdx: 12, period: 'H1-2026', kpi: '95.00', rating: 'EXCEEDS_EXPECTATIONS', obj: 'Mass-balance variance <1.5%; line changeover ≤20 minutes', assess: 'Average variance 0.9%; changeover average 17 minutes. Excelled during EU surge week.', dev: 'Document changeover playbook as standard work instruction.', d: '2026-07-22' },
  ];
  for (const rv of reviews) {
    const emp = empAll[rv.empIdx % empAll.length];
    if (!emp) continue;
    await db.execute(sql`
      INSERT INTO performance_reviews (employee_id, review_period, reviewer_user_id, kpi_score, rating,
        objectives_summary, supervisor_assessment, development_plan, status, review_date)
      VALUES (${emp.id}, ${rv.period}, ${supervisorId}, ${rv.kpi}, ${rv.rating},
        ${rv.obj}, ${rv.assess}, ${rv.dev}, 'FINALIZED', ${rv.d});
    `);
  }

  // ---------- ASSETS ----------
  const assetsSeed = [
    { tag: 'AST-COLD-001', name: 'Packhouse Cold Room 1 (Refrigeration Unit)', cat: 'Cold Chain Equipment', dept: 'PACK', cust: packMgrId, pd: '2023-03-14', cost: '4850000.00', w: '2026-03-13', cond: 'GOOD', last: '2026-07-12', next: '2026-10-12', dt: '6.50', loc: 'Chala Packhouse — CR1 plant room' },
    { tag: 'AST-COLD-002', name: 'Packhouse Cold Room 2 (Quarantine)', cat: 'Cold Chain Equipment', dept: 'QAFOOD', cust: qaId, pd: '2023-03-14', cost: '2150000.00', w: '2026-03-13', cond: 'NEEDS_REPAIR', last: '2026-07-14', next: '2026-10-14', dt: '22.00', loc: 'Chala Packhouse — CR2' },
    { tag: 'AST-IRR-001', name: 'Drip Irrigation Pump Station A', cat: 'Irrigation System', dept: 'FARM', cust: farmMgrId, pd: '2022-06-20', cost: '1750000.00', w: '2025-06-19', cond: 'GOOD', last: '2026-08-30', next: '2026-11-30', dt: '2.00', loc: 'Greenhouse Block A' },
    { tag: 'AST-IRR-002', name: 'Drip Irrigation Pump Station B', cat: 'Irrigation System', dept: 'FARM', cust: farmMgrId, pd: '2022-06-20', cost: '1650000.00', w: '2025-06-19', cond: 'GOOD', last: '2026-08-30', next: '2026-11-30', dt: '0.50', loc: 'Open Field Block B' },
    { tag: 'AST-PACK-001', name: 'Bunch Weighing & Labeling Line', cat: 'Packhouse Machinery', dept: 'PACK', cust: packMgrId, pd: '2024-01-18', cost: '2350000.00', w: '2027-01-17', cond: 'EXCELLENT', last: '2026-09-05', next: '2026-12-05', dt: '1.20', loc: 'Packhouse Line 1' },
    { tag: 'AST-PACK-002', name: 'Hydro-Cooler & Wash Line', cat: 'Packhouse Machinery', dept: 'PACK', cust: packMgrId, pd: '2024-01-18', cost: '3150000.00', w: '2027-01-17', cond: 'GOOD', last: '2026-09-12', next: '2026-12-12', dt: '4.75', loc: 'Packhouse Wash Bay' },
    { tag: 'AST-FARM-001', name: 'Massey Ferguson 375 Tractor', cat: 'Farm Machinery', dept: 'FARM', cust: farmMgrId, pd: '2021-09-05', cost: '3450000.00', w: '2026-09-04', cond: 'GOOD', last: '2026-08-18', next: '2026-11-18', dt: '12.00', loc: 'Machinery Shed' },
    { tag: 'AST-FARM-002', name: 'Tractor Disc Harrow 2.4m', cat: 'Farm Machinery', dept: 'FARM', cust: farmMgrId, pd: '2021-09-05', cost: '680000.00', w: '2026-09-04', cond: 'FAIR', last: '2026-06-22', next: '2026-10-28', dt: '3.00', loc: 'Machinery Shed' },
    { tag: 'AST-FLEET-001', name: 'Reefer Truck KDD 441X (4T)', cat: 'Refrigerated Fleet', dept: 'LOG', cust: logiId, pd: '2023-11-27', cost: '8950000.00', w: '2026-11-26', cond: 'GOOD', last: '2026-09-30', next: '2026-12-30', dt: '8.25', loc: 'Taveta Yard' },
    { tag: 'AST-FLEET-002', name: 'Reefer Truck KCX 902H (2T)', cat: 'Refrigerated Fleet', dept: 'LOG', cust: logiId, pd: '2024-05-14', cost: '6450000.00', w: '2027-05-13', cond: 'EXCELLENT', last: '2026-10-02', next: '2027-01-02', dt: '1.00', loc: 'Taveta Yard' },
    { tag: 'AST-GEN-001', name: 'Backup Generator 125kVA', cat: 'Power Equipment', dept: 'MAINT', cust: maintId, pd: '2022-02-11', cost: '2850000.00', w: '2025-02-10', cond: 'GOOD', last: '2026-09-20', next: '2026-11-20', dt: '3.50', loc: 'Plant Yard' },
    { tag: 'AST-QA-001', name: 'QA Digital Thermometer Kit & Data Loggers', cat: 'QA Equipment', dept: 'QAFOOD', cust: qaId, pd: '2025-04-08', cost: '485000.00', w: '2027-04-07', cond: 'EXCELLENT', last: '2026-10-01', next: '2027-01-01', dt: '0.00', loc: 'QA Laboratory' },
    { tag: 'AST-NURS-001', name: 'Propagation Mist Chamber', cat: 'Nursery Equipment', dept: 'FARM', cust: farmMgrId, pd: '2023-08-22', cost: '1250000.00', w: '2026-08-21', cond: 'GOOD', last: '2026-07-28', next: '2026-10-28', dt: '5.25', loc: 'Nursery' },
    { tag: 'AST-TOOL-001', name: 'Forklift 2.5T (Warehouse)', cat: 'Warehouse Equipment', dept: 'INV', cust: invMgrId, pd: '2022-11-30', cost: '1950000.00', w: '2025-11-29', cond: 'FAIR', last: '2026-08-05', next: '2026-11-05', dt: '9.75', loc: 'Packhouse Annex' },
    { tag: 'AST-WASH-001', name: 'High-Pressure Washer System', cat: 'Packhouse Machinery', dept: 'PACK', cust: packMgrId, pd: '2024-07-15', cost: '640000.00', w: '2027-07-14', cond: 'GOOD', last: '2026-09-18', next: '2026-12-18', dt: '0.75', loc: 'Wash Bay' },
    { tag: 'AST-NET-001', name: 'Shade Net Structure Block C', cat: 'Farm Infrastructure', dept: 'FARM', cust: farmMgrId, pd: '2021-04-19', cost: '2750000.00', w: '2026-04-18', cond: 'FAIR', last: '2026-06-14', next: '2026-12-14', dt: '18.50', loc: 'Shade Net Block C1' },
    { tag: 'AST-GREEN-001', name: 'Greenhouse Span A (6 × 30m)', cat: 'Farm Infrastructure', dept: 'FARM', cust: farmMgrId, pd: '2020-11-02', cost: '4350000.00', w: '2025-11-01', cond: 'GOOD', last: '2026-08-08', next: '2027-02-08', dt: '7.00', loc: 'Greenhouse Block A' },
    { tag: 'AST-LAB-001', name: 'QA Moisture Analyser', cat: 'QA Equipment', dept: 'QAFOOD', cust: qaId, pd: '2025-01-20', cost: '385000.00', w: '2027-01-19', cond: 'EXCELLENT', last: '2026-07-20', next: '2026-10-30', dt: '0.00', loc: 'QA Laboratory' },
    { tag: 'AST-SENS-001', name: 'Cold Room IoT Temperature Sensor Network', cat: 'Monitoring Equipment', dept: 'QAFOOD', cust: qaId, pd: '2025-06-11', cost: '720000.00', w: '2027-06-10', cond: 'EXCELLENT', last: '2026-10-05', next: '2027-04-05', dt: '0.25', loc: 'CR1 / CR2 / Dispatch Dock' },
    { tag: 'AST-TOOL-002', name: 'Generator Service Kit Trolley', cat: 'Workshop Equipment', dept: 'MAINT', cust: maintId, pd: '2024-02-05', cost: '185000.00', w: '2026-02-04', cond: 'GOOD', last: '2026-09-25', next: '2026-12-25', dt: '1.00', loc: 'Workshop' },
  ];
  for (const a of assetsSeed) {
    const dId = await depId(a.dept);
    await db.execute(sql`
      INSERT INTO assets (asset_tag, name, category, department_id, custodian_user_id, purchase_date,
        purchase_cost_kes, warranty_expiry_date, condition, last_service_date, next_service_due_date,
        downtime_hours_total, location)
      VALUES (${a.tag}, ${a.name}, ${a.cat}, ${dId}, ${a.cust}, ${a.pd},
        ${a.cost}, ${a.w}, ${a.cond}, ${a.last}, ${a.next}, ${a.dt}, ${a.loc})
      ON CONFLICT (asset_tag) DO NOTHING;
    `);
  }

  // ---------- MAINTENANCE WORK ORDERS ----------
  const wos = [
    { no: 'WO-2026-0177', asset: 'AST-COLD-001', type: 'PREVENTIVE', pr: 'MEDIUM', desc: 'Quarterly compressor service — filter drier replacement and refrigerant pressure check', part: 'TOOL-REEFER-FILTER', qty: '1', lc: '12000.00', pc: '7600.00', dt: '4.00', tech: 'Cold Chain Systems Kenya — Brian Kiplagat', st: 'COMPLETED', sch: '2026-10-21' },
    { no: 'WO-2026-0178', asset: 'AST-COLD-002', type: 'CORRECTIVE_REPAIR', pr: 'HIGH', desc: 'Condenser fan motor noise and intermittent high-pressure cut-out on quarantine cold room', part: null, qty: '0', lc: '0.00', pc: '0.00', dt: '0.00', tech: 'Cold Chain Systems Kenya — awaiting parts', st: 'IN_PROGRESS', sch: '2026-10-29' },
    { no: 'WO-2026-0179', asset: 'AST-FARM-001', type: 'PREVENTIVE', pr: 'MEDIUM', desc: '250-hour tractor service — oil, filters, greasing, hydraulic check', part: null, qty: '0', lc: '18500.00', pc: '0.00', dt: '6.00', tech: 'Voi Industrial Spares Ltd — Workshop', st: 'IN_PROGRESS', sch: '2026-10-30' },
    { no: 'WO-2026-0180', asset: 'AST-IRR-001', type: 'PREVENTIVE', pr: 'LOW', desc: 'Pump station A impeller inspection and pressure filter backwash', part: 'TOOL-DRIP-ELBOW', qty: '4', lc: '9500.00', pc: '220.00', dt: '3.00', tech: 'Internal — Irrigation Technician', st: 'OPEN', sch: '2026-11-03' },
    { no: 'WO-2026-0181', asset: 'AST-TOOL-001', type: 'CORRECTIVE_REPAIR', pr: 'MEDIUM', desc: 'Forklift mast chain adjustment after hydraulic hose replacement (linked SA-2026-10-0021)', part: null, qty: '0', lc: '6500.00', pc: '0.00', dt: '2.50', tech: 'Voi Industrial Spares Ltd', st: 'OPEN', sch: '2026-11-04' },
    { no: 'WO-2026-0174', asset: 'AST-GEN-001', type: 'PREVENTIVE', pr: 'HIGH', desc: 'Monthly generator load test and coolant top-up', part: null, qty: '0', lc: '4200.00', pc: '0.00', dt: '1.50', tech: 'Internal — Maintenance Team', st: 'COMPLETED', sch: '2026-10-14' },
    { no: 'WO-2026-0175', asset: 'AST-PACK-002', type: 'CALIBRATION', pr: 'MEDIUM', desc: 'Wash line chlorination dosing calibration — QA food safety requirement', part: null, qty: '0', lc: '5800.00', pc: '0.00', dt: '2.00', tech: 'External — Water Treatment Partner', st: 'COMPLETED', sch: '2026-10-16' },
    { no: 'WO-2026-0176', asset: 'AST-FLEET-001', type: 'PREVENTIVE', pr: 'MEDIUM', desc: 'Reefer truck KDD 441X 10,000 km service and reefer unit filter change', part: null, qty: '0', lc: '14500.00', pc: '0.00', dt: '5.00', tech: 'Isuzu Kenya Service Centre', st: 'COMPLETED', sch: '2026-10-18' },
    { no: 'WO-2026-0182', asset: 'AST-NET-001', type: 'CORRECTIVE_REPAIR', pr: 'LOW', desc: 'Shade net structure — replace torn panel on western edge after wind damage', part: null, qty: '0', lc: '7800.00', pc: '0.00', dt: '4.00', tech: 'Internal — Farm Team', st: 'OPEN', sch: '2026-11-07' },
    { no: 'WO-2026-0183', asset: 'AST-QA-001', type: 'CALIBRATION', pr: 'MEDIUM', desc: 'Digital thermometer annual calibration against reference standard', part: null, qty: '0', lc: '6500.00', pc: '0.00', dt: '3.00', tech: 'External — Accredited Calibration Lab', st: 'OPEN', sch: '2026-11-12' },
    { no: 'WO-2026-0172', asset: 'AST-SENS-001', type: 'CORRECTIVE_REPAIR', pr: 'HIGH', desc: 'CR2 sensor node 3 offline — replace battery and re-pair gateway', part: null, qty: '0', lc: '3200.00', pc: '1450.00', dt: '1.00', tech: 'Internal — IT & QA', st: 'COMPLETED', sch: '2026-10-12' },
    { no: 'WO-2026-0184', asset: 'AST-GREEN-001', type: 'PREVENTIVE', pr: 'LOW', desc: 'Greenhouse vent mechanism lubrication and insect screen patch repair', part: null, qty: '0', lc: '5400.00', pc: '0.00', dt: '3.50', tech: 'Internal — Farm Team', st: 'OPEN', sch: '2026-11-14' },
    { no: 'WO-2026-0185', asset: 'AST-LAB-001', type: 'CALIBRATION', pr: 'MEDIUM', desc: 'Moisture analyser quarterly calibration and performance verification', part: null, qty: '0', lc: '4800.00', pc: '0.00', dt: '2.00', tech: 'External — Supplier Service', st: 'OPEN', sch: '2026-11-02' },
    { no: 'WO-2026-0173', asset: 'AST-PACK-001', type: 'PREVENTIVE', pr: 'HIGH', desc: 'Weighing scale verification — traceable weight set, NEMA requirements', part: null, qty: '0', lc: '6200.00', pc: '0.00', dt: '2.50', tech: 'External — NEMA Verifier', st: 'COMPLETED', sch: '2026-10-10' },
    { no: 'WO-2026-0186', asset: 'AST-WASH-001', type: 'PREVENTIVE', pr: 'LOW', desc: 'High-pressure washer nozzle replacement and hose inspection', part: null, qty: '0', lc: '3500.00', pc: '2800.00', dt: '1.50', tech: 'Internal — Packhouse Team', st: 'OPEN', sch: '2026-11-08' },
    { no: 'WO-2026-0187', asset: 'AST-NURS-001', type: 'CORRECTIVE_REPAIR', pr: 'MEDIUM', desc: 'Mist chamber nozzle blockage — descale and replace two nozzles', part: null, qty: '0', lc: '4100.00', pc: '1600.00', dt: '2.00', tech: 'Internal — Nursery Team', st: 'OPEN', sch: '2026-11-05' },
    { no: 'WO-2026-0170', asset: 'AST-COLD-001', type: 'CORRECTIVE_REPAIR', pr: 'LOW', desc: 'Cold room door seal minor tear — temporary patch, monitor weekly', part: null, qty: '0', lc: '2800.00', pc: '950.00', dt: '1.00', tech: 'Internal — Maintenance', st: 'COMPLETED', sch: '2026-10-06' },
    { no: 'WO-2026-0188', asset: 'AST-FARM-002', type: 'PREVENTIVE', pr: 'MEDIUM', desc: 'Disc harrow bearing replacement and blade inspection before Q1 seedbed prep', part: null, qty: '0', lc: '8900.00', pc: '5400.00', dt: '5.50', tech: 'Voi Industrial Spares Ltd', st: 'OPEN', sch: '2026-11-10' },
    { no: 'WO-2026-0189', asset: 'AST-FLEET-002', type: 'PREVENTIVE', pr: 'LOW', desc: 'Reefer truck KCX 902H tyre rotation and brake pad check', part: null, qty: '0', lc: '5600.00', pc: '0.00', dt: '2.00', tech: 'External — Fleet Service', st: 'OPEN', sch: '2026-11-16' },
    { no: 'WO-2026-0169', asset: 'AST-IRR-002', type: 'PREVENTIVE', pr: 'MEDIUM', desc: 'Pump station B pressure switch test and pipe joint reseal', part: 'TOOL-DRIP-ELBOW', qty: '6', lc: '7400.00', pc: '330.00', dt: '3.50', tech: 'Internal — Irrigation Technician', st: 'COMPLETED', sch: '2026-10-03' },
    { no: 'WO-2026-0190', asset: 'AST-TOOL-002', type: 'PREVENTIVE', pr: 'LOW', desc: 'Workshop trolley wheel replacement and tool inventory check', part: null, qty: '0', lc: '2100.00', pc: '0.00', dt: '1.00', tech: 'Internal — Maintenance', st: 'OPEN', sch: '2026-11-20' },
    { no: 'WO-2026-0191', asset: 'AST-WASH-001', type: 'CORRECTIVE_REPAIR', pr: 'HIGH', desc: 'Wash line spray bar uneven pressure — strip, clean, replace gaskets', part: null, qty: '0', lc: '9800.00', pc: '2400.00', dt: '6.50', tech: 'Internal — Packhouse Engineering', st: 'OPEN', sch: '2026-11-01' },
    { no: 'WO-2026-0192', asset: 'AST-SENS-001', type: 'PREVENTIVE', pr: 'LOW', desc: 'Sensor battery audit and gateway firmware update', part: null, qty: '0', lc: '3600.00', pc: '0.00', dt: '1.50', tech: 'Internal — IT', st: 'OPEN', sch: '2026-11-18' },
  ];
  for (const w of wos) {
    const aRow = rows<{ id: number }>(
      await db.execute(sql`SELECT id FROM assets WHERE asset_tag = ${w.asset}`)
    )[0];
    if (!aRow) continue;
    const partId = w.part ? await prodId(w.part) : null;
    await db.execute(sql`
      INSERT INTO maintenance_work_orders (work_order_no, asset_id, maintenance_type, priority,
        issue_description, spare_part_product_id, spare_part_qty_used, labour_cost_kes, parts_cost_kes,
        downtime_hours, technician_name, status, scheduled_date, completed_at)
      VALUES (${w.no}, ${aRow.id}, ${w.type}, ${w.pr},
        ${w.desc}, ${partId}, ${w.qty}, ${w.lc}, ${w.pc},
        ${w.dt}, ${w.tech}, ${w.st}, ${w.sch},
        CASE WHEN ${w.st} = 'COMPLETED'
          THEN now() - (${Math.floor(Math.random() * 15 + 2)} * interval '1 day')
          ELSE NULL END)
      ON CONFLICT (work_order_no) DO NOTHING;
    `);
    if (w.st === 'COMPLETED') {
      await db.execute(sql`
        UPDATE assets SET downtime_hours_total = downtime_hours_total + ${w.dt}::numeric,
          last_service_date = ${w.sch}
        WHERE asset_tag = ${w.asset};
      `);
    }
  }

  // ---------- APPROVAL REQUESTS for purchase requisitions ----------
  for (const r of requisitions.filter((x) => x.st === 'PENDING_APPROVAL')) {
    await db.execute(sql`
      INSERT INTO approval_requests (request_code, module, entity_type, entity_id, title, amount_kes,
        submitted_by_user_id, assigned_role_code, status)
      VALUES ('APR-' || ${r.num}, 'PROCUREMENT', 'PURCHASE_REQUISITION',
        (SELECT id FROM purchase_requisitions WHERE req_number = ${r.num}),
        'Purchase requisition ' || ${r.num} || ' — ' || ${r.why}, ${r.tot}, ${r.req},
        'FINANCE_MANAGER', 'PENDING')
      ON CONFLICT (request_code) DO NOTHING;
    `);
  }
  for (const a of adjustments.filter((x) => x.st === 'PENDING_APPROVAL')) {
    await db.execute(sql`
      INSERT INTO approval_requests (request_code, module, entity_type, entity_id, title, amount_kes,
        submitted_by_user_id, assigned_role_code, status)
      VALUES ('APR-' || ${a.num}, 'INVENTORY', 'STOCK_ADJUSTMENT',
        (SELECT id FROM stock_adjustments WHERE adjustment_number = ${a.num}),
        'Stock adjustment ' || ${a.num} || ' — variance ' || ${a.varr}, 0, ${a.req},
        'INVENTORY_MANAGER', 'PENDING')
      ON CONFLICT (request_code) DO NOTHING;
    `);
  }
  const pendingLeave = rows<{ id: number; request_number: string; total_days: string; reason: string; requested_by: number }>(
    await db.execute(sql`
      SELECT lr.id, lr.request_number, lr.total_days, lr.reason, lr.employee_id AS requested_by
      FROM leave_requests lr WHERE lr.status = 'PENDING'
    `)
  );
  for (const l of pendingLeave) {
    await db.execute(sql`
      INSERT INTO approval_requests (request_code, module, entity_type, entity_id, title, amount_kes,
        submitted_by_user_id, assigned_role_code, status)
      VALUES ('APR-' || ${l.request_number}, 'HR', 'LEAVE_REQUEST', ${l.id},
        'Leave request ' || ${l.request_number} || ' — ' || ${l.total_days} || ' days', 0,
        ${l.requested_by}, 'HR_MANAGER', 'PENDING')
      ON CONFLICT (request_code) DO NOTHING;
    `);
  }

  // Final safety checkpoint: verify no self-approved approvals slipped through
  const selfApproved = rows<{ cnt: number }>(
    await db.execute(sql`
      SELECT count(*)::int AS cnt FROM approval_requests
      WHERE status = 'APPROVED' AND decided_by_user_id = submitted_by_user_id
    `)
  );
  if ((selfApproved[0]?.cnt ?? 0) > 0) {
    throw new Error('Seed integrity check failed: self-approved approvals detected');
  }
}

export async function getSeedStatus(db: ChalarDatabase): Promise<{ seeded: boolean; demo: boolean }> {
  const r = rows<{ id: number }>(
    await db.execute(sql`SELECT id FROM roles LIMIT 1`)
  );
  return { seeded: r.length > 0, demo: isDemo() };
}
