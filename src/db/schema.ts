import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ============================================================================
// 1. IDENTITY, ACCESS & SECURITY
// ============================================================================

export const departments = pgTable(
  'departments',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    costCenterCode: text('cost_center_code').notNull(),
    budgetAllocatedKes: numeric('budget_allocated_kes', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    managerUserId: integer('manager_user_id'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('departments_code_idx').on(table.code)]
);

export const roles = pgTable(
  'roles',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    defaultDashboard: text('default_dashboard').notNull(),
    isSystemRole: boolean('is_system_role').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('roles_code_idx').on(table.code)]
);

export const permissions = pgTable(
  'permissions',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    module: text('module').notNull(),
    action: text('action').notNull(),
    description: text('description').notNull(),
  },
  (table) => [uniqueIndex('permissions_code_idx').on(table.code)]
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: serial('id').primaryKey(),
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: integer('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('role_permissions_unique_idx').on(table.roleId, table.permissionId),
  ]
);

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    fullName: text('full_name').notNull(),
    phone: text('phone'),
    departmentId: integer('department_id').references(() => departments.id),
    primaryRoleCode: text('primary_role_code').notNull(),
    status: text('status').notNull().default('ACTIVE'), // ACTIVE | INACTIVE | LOCKED | INVITED
    mfaEnabled: boolean('mfa_enabled').notNull().default(false),
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    passwordResetTokenHash: text('password_reset_token_hash'),
    passwordResetExpiresAt: timestamp('password_reset_expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_email_idx').on(table.email),
    index('users_dept_idx').on(table.departmentId),
    index('users_role_idx').on(table.primaryRoleCode),
  ]
);

export const userRoles = pgTable(
  'user_roles',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    assignedBy: integer('assigned_by'),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('user_roles_unique_idx').on(table.userId, table.roleId)]
);

export const sessions = pgTable(
  'sessions',
  {
    id: serial('id').primaryKey(),
    tokenHash: text('token_hash').notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: text('revoked_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_idx').on(table.tokenHash),
    index('sessions_user_id_idx').on(table.userId),
  ]
);

export const invitations = pgTable(
  'invitations',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull(),
    fullName: text('full_name').notNull(),
    roleCode: text('role_code').notNull(),
    departmentId: integer('department_id').references(() => departments.id),
    tokenHash: text('token_hash').notNull(),
    invitedByUserId: integer('invited_by_user_id').references(() => users.id),
    status: text('status').notNull().default('PENDING'), // PENDING | ACCEPTED | EXPIRED | REVOKED
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('invitations_token_hash_idx').on(table.tokenHash)]
);

/**
 * Self-service account requests from the public sign-up page. A request grants
 * NO access: a user with `users.manage` must approve it, which creates the user
 * with the (possibly adjusted) role. The applicant's chosen password is stored
 * only as a bcrypt hash and is cleared once the request is decided.
 */
export const accessRequests = pgTable(
  'access_requests',
  {
    id: serial('id').primaryKey(),
    requestCode: text('request_code').notNull(),
    email: text('email').notNull(), // lower-cased
    fullName: text('full_name').notNull(),
    phone: text('phone'),
    jobTitle: text('job_title'),
    departmentId: integer('department_id').references(() => departments.id),
    requestedRoleCode: text('requested_role_code').notNull(),
    message: text('message'),
    passwordHash: text('password_hash'),
    status: text('status').notNull().default('PENDING'), // PENDING | APPROVED | REJECTED
    grantedRoleCode: text('granted_role_code'),
    decidedByUserId: integer('decided_by_user_id').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNote: text('decision_note'),
    createdUserId: integer('created_user_id').references(() => users.id),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('access_requests_code_idx').on(table.requestCode),
    // At most one open request per email address
    uniqueIndex('access_requests_pending_email_idx').on(table.email).where(sql`status = 'PENDING'`),
    index('access_requests_status_idx').on(table.status),
  ]
);

export const securityEvents = pgTable(
  'security_events',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id),
    eventType: text('event_type').notNull(),
    severity: text('severity').notNull().default('INFO'), // INFO | WARNING | CRITICAL
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    description: text('description').notNull(),
    metadataJson: text('metadata_json'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('security_events_created_idx').on(table.createdAt)]
);

// ============================================================================
// 2. FARM OPERATIONS
// ============================================================================

export const farms = pgTable(
  'farms',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    county: text('county').notNull(),
    subCounty: text('sub_county').notNull(),
    ward: text('ward').notNull(),
    gpsCoordinates: text('gps_coordinates').notNull(),
    totalAreaHectares: numeric('total_area_hectares', { precision: 10, scale: 2 }).notNull(),
    certificationGlobalGap: text('certification_global_gap').notNull(),
    certificationGrasp: text('certification_grasp').notNull(),
    certificationSmeta: text('certification_smeta').notNull(),
    managerUserId: integer('manager_user_id').references(() => users.id),
    status: text('status').notNull().default('ACTIVE'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('farms_code_idx').on(table.code)]
);

export const fields = pgTable(
  'fields',
  {
    id: serial('id').primaryKey(),
    farmId: integer('farm_id')
      .notNull()
      .references(() => farms.id),
    fieldCode: text('field_code').notNull(),
    name: text('name').notNull(),
    fieldType: text('field_type').notNull(), // GREENHOUSE | OPEN_FIELD | SHADE_NET
    areaHectares: numeric('area_hectares', { precision: 10, scale: 2 }).notNull(),
    soilType: text('soil_type').notNull(),
    irrigationType: text('irrigation_type').notNull(),
    gpsCoordinates: text('gps_coordinates'),
    status: text('status').notNull().default('ACTIVE'), // ACTIVE | FALLOW | MAINTENANCE
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('fields_code_idx').on(table.fieldCode)]
);

export const cropCatalog = pgTable(
  'crop_catalog',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    variety: text('variety').notNull(),
    scientificName: text('scientific_name').notNull(),
    category: text('category').notNull().default('Culinary Fresh Herb'),
    cycleDays: integer('cycle_days').notNull(),
    expectedYieldKgPerHa: numeric('expected_yield_kg_per_ha', {
      precision: 12,
      scale: 2,
    }).notNull(),
    coldChainMinC: numeric('cold_chain_min_c', { precision: 5, scale: 2 }).notNull(),
    coldChainMaxC: numeric('cold_chain_max_c', { precision: 5, scale: 2 }).notNull(),
    shelfLifeDays: integer('shelf_life_days').notNull(),
    hsCode: text('hs_code').notNull(),
    packagingSpecs: text('packaging_specs').notNull(),
    weeklyTargetKg: numeric('weekly_target_kg', { precision: 12, scale: 2 }).notNull(),
    imageUrl: text('image_url').notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [uniqueIndex('crop_catalog_code_idx').on(table.code)]
);

export const cropCycles = pgTable(
  'crop_cycles',
  {
    id: serial('id').primaryKey(),
    cycleCode: text('cycle_code').notNull(),
    fieldId: integer('field_id')
      .notNull()
      .references(() => fields.id),
    cropId: integer('crop_id')
      .notNull()
      .references(() => cropCatalog.id),
    plantingDate: text('planting_date').notNull(),
    expectedHarvestDate: text('expected_harvest_date').notNull(),
    actualEndDate: text('actual_end_date'),
    plantedAreaHa: numeric('planted_area_ha', { precision: 10, scale: 2 }).notNull(),
    seedLotNumber: text('seed_lot_number').notNull(),
    seedQuantityKg: numeric('seed_quantity_kg', { precision: 10, scale: 2 }).notNull(),
    expectedYieldKg: numeric('expected_yield_kg', { precision: 12, scale: 2 }).notNull(),
    actualHarvestedKg: numeric('actual_harvested_kg', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    wastageKg: numeric('wastage_kg', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    productionCostKes: numeric('production_cost_kes', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    status: text('status').notNull().default('GROWING'), // PLANNED | PLANTED | GROWING | HARVESTING | COMPLETED
    supervisorUserId: integer('supervisor_user_id').references(() => users.id),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('crop_cycles_code_idx').on(table.cycleCode)]
);

export const fieldActivities = pgTable('field_activities', {
  id: serial('id').primaryKey(),
  cropCycleId: integer('crop_cycle_id')
    .notNull()
    .references(() => cropCycles.id),
  fieldId: integer('field_id')
    .notNull()
    .references(() => fields.id),
  activityType: text('activity_type').notNull(), // PLANTING | IRRIGATION | FERTILIZER_APPLICATION | CROP_PROTECTION | PEST_SCOUTING | WEEDING
  activityDate: text('activity_date').notNull(),
  inputName: text('input_name'),
  inputLotNumber: text('input_lot_number'),
  inputQuantity: numeric('input_quantity', { precision: 12, scale: 3 }),
  inputUnit: text('input_unit'),
  phiDays: integer('phi_days').notNull().default(0),
  labourCount: integer('labour_count').notNull().default(1),
  labourHours: numeric('labour_hours', { precision: 8, scale: 2 }).notNull().default('8.00'),
  costKes: numeric('cost_kes', { precision: 12, scale: 2 }).notNull().default('0.00'),
  pestOrDiseaseFinding: text('pest_or_disease_finding'),
  recordedByUserId: integer('recorded_by_user_id').references(() => users.id),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const harvestBatches = pgTable(
  'harvest_batches',
  {
    id: serial('id').primaryKey(),
    batchNumber: text('batch_number').notNull(),
    cropCycleId: integer('crop_cycle_id')
      .notNull()
      .references(() => cropCycles.id),
    fieldId: integer('field_id')
      .notNull()
      .references(() => fields.id),
    cropId: integer('crop_id')
      .notNull()
      .references(() => cropCatalog.id),
    harvestDate: text('harvest_date').notNull(),
    harvestedWeightKg: numeric('harvested_weight_kg', { precision: 12, scale: 2 }).notNull(),
    rejectedFieldWeightKg: numeric('rejected_field_weight_kg', {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    netTransferredKg: numeric('net_transferred_kg', { precision: 12, scale: 2 }).notNull(),
    cratesCount: integer('crates_count').notNull().default(10),
    fieldTempC: numeric('field_temp_c', { precision: 5, scale: 2 }).notNull(),
    destination: text('destination').notNull().default('PACKHOUSE'),
    status: text('status').notNull().default('IN_PACKHOUSE'), // HARVESTED | IN_PACKHOUSE | PACKED | QUARANTINED | RELEASED
    harvestedByUserId: integer('harvested_by_user_id').references(() => users.id),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('harvest_batches_number_idx').on(table.batchNumber)]
);

// ============================================================================
// 3. INVENTORY & WAREHOUSE
// ============================================================================

export const unitsOfMeasure = pgTable(
  'units_of_measure',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    precisionDecimals: integer('precision_decimals').notNull().default(2),
  },
  (table) => [uniqueIndex('uom_code_idx').on(table.code)]
);

export const unitConversions = pgTable('unit_conversions', {
  id: serial('id').primaryKey(),
  fromUomCode: text('from_uom_code').notNull(),
  toUomCode: text('to_uom_code').notNull(),
  multiplier: numeric('multiplier', { precision: 14, scale: 6 }).notNull(),
});

export const productCategories = pgTable(
  'product_categories',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    categoryType: text('category_type').notNull(),
    costingMethod: text('costing_method').notNull().default('FIFO'), // FIFO | WEIGHTED_AVERAGE
    requiresLotTracking: boolean('requires_lot_tracking').notNull().default(true),
    requiresExpiryDate: boolean('requires_expiry_date').notNull().default(false),
  },
  (table) => [uniqueIndex('product_categories_code_idx').on(table.code)]
);

export const warehouses = pgTable(
  'warehouses',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    warehouseType: text('warehouse_type').notNull(),
    temperatureRangeC: text('temperature_range_c').notNull(),
    capacityKg: numeric('capacity_kg', { precision: 14, scale: 2 }).notNull(),
    managerUserId: integer('manager_user_id').references(() => users.id),
    location: text('location').notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [uniqueIndex('warehouses_code_idx').on(table.code)]
);

export const storageLocations = pgTable(
  'storage_locations',
  {
    id: serial('id').primaryKey(),
    warehouseId: integer('warehouse_id')
      .notNull()
      .references(() => warehouses.id),
    binCode: text('bin_code').notNull(),
    zone: text('zone').notNull(),
    maxCapacityKg: numeric('max_capacity_kg', { precision: 12, scale: 2 }).notNull(),
    currentStatus: text('current_status').notNull().default('ACTIVE'),
  },
  (table) => [uniqueIndex('storage_locations_bin_idx').on(table.binCode)]
);

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    sku: text('sku').notNull(),
    barcode: text('barcode').notNull(),
    name: text('name').notNull(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => productCategories.id),
    uomCode: text('uom_code').notNull(),
    unitCostKes: numeric('unit_cost_kes', { precision: 14, scale: 2 }).notNull(),
    sellingPriceEur: numeric('selling_price_eur', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    reorderLevel: numeric('reorder_level', { precision: 12, scale: 2 }).notNull(),
    safetyStockLevel: numeric('safety_stock_level', { precision: 12, scale: 2 }).notNull(),
    physicalStock: numeric('physical_stock', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    reservedStock: numeric('reserved_stock', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    availableStock: numeric('available_stock', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    cropId: integer('crop_id').references(() => cropCatalog.id),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('products_sku_idx').on(table.sku),
    uniqueIndex('products_barcode_idx').on(table.barcode),
  ]
);

export const inventoryLots = pgTable(
  'inventory_lots',
  {
    id: serial('id').primaryKey(),
    lotNumber: text('lot_number').notNull(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    warehouseId: integer('warehouse_id')
      .notNull()
      .references(() => warehouses.id),
    binCode: text('bin_code').notNull(),
    harvestBatchId: integer('harvest_batch_id').references(() => harvestBatches.id),
    supplierId: integer('supplier_id'),
    physicalQty: numeric('physical_qty', { precision: 14, scale: 3 }).notNull(),
    reservedQty: numeric('reserved_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    availableQty: numeric('available_qty', { precision: 14, scale: 3 }).notNull(),
    unitCostKes: numeric('unit_cost_kes', { precision: 14, scale: 2 }).notNull(),
    receivedDate: text('received_date').notNull(),
    expiryDate: text('expiry_date'),
    qualityStatus: text('quality_status').notNull().default('AVAILABLE'), // AVAILABLE | QUARANTINED | BLOCKED | EXPIRED | RELEASED
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('inventory_lots_number_idx').on(table.lotNumber),
    index('inventory_lots_product_idx').on(table.productId),
  ]
);

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: serial('id').primaryKey(),
    movementNumber: text('movement_number').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    movementType: text('movement_type').notNull(), // RECEIPT | ISSUE | TRANSFER | ADJUSTMENT | PRODUCTION_CONSUME | PRODUCTION_OUTPUT | SUPPLIER_RETURN | CUSTOMER_RETURN | REVERSAL
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    lotId: integer('lot_id').references(() => inventoryLots.id),
    fromWarehouseId: integer('from_warehouse_id').references(() => warehouses.id),
    toWarehouseId: integer('to_warehouse_id').references(() => warehouses.id),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
    uomCode: text('uom_code').notNull(),
    unitCostKes: numeric('unit_cost_kes', { precision: 14, scale: 2 }).notNull(),
    totalCostKes: numeric('total_cost_kes', { precision: 14, scale: 2 }).notNull(),
    referenceType: text('reference_type'),
    referenceId: text('reference_id'),
    reason: text('reason').notNull(),
    performedByUserId: integer('performed_by_user_id').references(() => users.id),
    approvedByUserId: integer('approved_by_user_id').references(() => users.id),
    reversalOfMovementId: integer('reversal_of_movement_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('stock_movements_number_idx').on(table.movementNumber),
    uniqueIndex('stock_movements_idempotency_idx').on(table.idempotencyKey),
    index('stock_movements_product_idx').on(table.productId),
  ]
);

export const stockReservations = pgTable(
  'stock_reservations',
  {
    id: serial('id').primaryKey(),
    reservationNumber: text('reservation_number').notNull(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    lotId: integer('lot_id')
      .notNull()
      .references(() => inventoryLots.id),
    salesOrderId: integer('sales_order_id'),
    reservedQty: numeric('reserved_qty', { precision: 14, scale: 3 }).notNull(),
    status: text('status').notNull().default('ACTIVE'), // ACTIVE | FULFILLED | RELEASED | CANCELLED
    reservedByUserId: integer('reserved_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('stock_reservations_number_idx').on(table.reservationNumber)]
);

export const stockAdjustments = pgTable(
  'stock_adjustments',
  {
    id: serial('id').primaryKey(),
    adjustmentNumber: text('adjustment_number').notNull(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    lotId: integer('lot_id')
      .notNull()
      .references(() => inventoryLots.id),
    warehouseId: integer('warehouse_id')
      .notNull()
      .references(() => warehouses.id),
    systemQty: numeric('system_qty', { precision: 14, scale: 3 }).notNull(),
    countedQty: numeric('counted_qty', { precision: 14, scale: 3 }).notNull(),
    varianceQty: numeric('variance_qty', { precision: 14, scale: 3 }).notNull(),
    reason: text('reason').notNull(),
    status: text('status').notNull().default('PENDING_APPROVAL'), // PENDING_APPROVAL | APPROVED | REJECTED
    requestedByUserId: integer('requested_by_user_id').references(() => users.id),
    approvedByUserId: integer('approved_by_user_id').references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('stock_adjustments_number_idx').on(table.adjustmentNumber)]
);

// ============================================================================
// 4. HUMAN RESOURCES
// ============================================================================

export const employeeProfiles = pgTable(
  'employee_profiles',
  {
    id: serial('id').primaryKey(),
    employeeCode: text('employee_code').notNull(),
    userId: integer('user_id').references(() => users.id),
    fullName: text('full_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    departmentId: integer('department_id')
      .notNull()
      .references(() => departments.id),
    jobTitle: text('job_title').notNull(),
    employmentType: text('employment_type').notNull(), // PERMANENT | CONTRACT | SEASONAL | CASUAL
    employmentStatus: text('employment_status').notNull().default('ACTIVE'), // ACTIVE | ON_LEAVE | SUSPENDED | TERMINATED
    gender: text('gender').notNull(),
    dateOfBirth: text('date_of_birth').notNull(),
    hireDate: text('hire_date').notNull(),
    contractEndDate: text('contract_end_date'),
    supervisorUserId: integer('supervisor_user_id').references(() => users.id),
    basicSalaryKes: numeric('basic_salary_kes', { precision: 14, scale: 2 }).notNull(),
    payFrequency: text('pay_frequency').notNull().default('MONTHLY'), // MONTHLY | DAILY | HOURLY | PIECE_RATE
    nationalIdNumber: text('national_id_number').notNull(),
    kraPin: text('kra_pin').notNull(),
    nssfNumber: text('nssf_number').notNull(),
    shifNumber: text('shif_number').notNull(),
    bankName: text('bank_name').notNull(),
    bankAccountNumber: text('bank_account_number').notNull(),
    emergencyContactName: text('emergency_contact_name').notNull(),
    emergencyContactPhone: text('emergency_contact_phone').notNull(),
    qualifications: text('qualifications'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('employee_profiles_code_idx').on(table.employeeCode),
    index('employee_profiles_dept_idx').on(table.departmentId),
  ]
);

export const shifts = pgTable(
  'shifts',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    breakMinutes: integer('break_minutes').notNull().default(60),
    standardHours: numeric('standard_hours', { precision: 5, scale: 2 }).notNull(),
    departmentId: integer('department_id').references(() => departments.id),
  },
  (table) => [uniqueIndex('shifts_code_idx').on(table.code)]
);

export const attendanceRecords = pgTable('attendance_records', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id')
    .notNull()
    .references(() => employeeProfiles.id),
  attendanceDate: text('attendance_date').notNull(),
  shiftId: integer('shift_id').references(() => shifts.id),
  clockInAt: text('clock_in_at'),
  clockOutAt: text('clock_out_at'),
  regularHours: numeric('regular_hours', { precision: 5, scale: 2 })
    .notNull()
    .default('8.00'),
  overtimeHours: numeric('overtime_hours', { precision: 5, scale: 2 })
    .notNull()
    .default('0.00'),
  lateMinutes: integer('late_minutes').notNull().default(0),
  status: text('status').notNull().default('PRESENT'), // PRESENT | LATE | ABSENT | ON_LEAVE
  timesheetApproved: boolean('timesheet_approved').notNull().default(false),
  approvedByUserId: integer('approved_by_user_id').references(() => users.id),
  correctionReason: text('correction_reason'),
  correctedByUserId: integer('corrected_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const overtimeRequests = pgTable('overtime_requests', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id')
    .notNull()
    .references(() => employeeProfiles.id),
  workDate: text('work_date').notNull(),
  requestedHours: numeric('requested_hours', { precision: 5, scale: 2 }).notNull(),
  reason: text('reason').notNull(),
  rateMultiplier: numeric('rate_multiplier', { precision: 4, scale: 2 })
    .notNull()
    .default('1.50'),
  status: text('status').notNull().default('PENDING'), // PENDING | APPROVED | REJECTED
  approvedByUserId: integer('approved_by_user_id').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const leaveTypes = pgTable(
  'leave_types',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    defaultAnnualDays: integer('default_annual_days').notNull(),
    isPaid: boolean('is_paid').notNull().default(true),
    statutoryBasis: text('statutory_basis').notNull(),
  },
  (table) => [uniqueIndex('leave_types_code_idx').on(table.code)]
);

export const leaveBalances = pgTable(
  'leave_balances',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id')
      .notNull()
      .references(() => employeeProfiles.id),
    leaveTypeId: integer('leave_type_id')
      .notNull()
      .references(() => leaveTypes.id),
    year: integer('year').notNull(),
    entitledDays: numeric('entitled_days', { precision: 6, scale: 2 }).notNull(),
    usedDays: numeric('used_days', { precision: 6, scale: 2 }).notNull().default('0.00'),
    pendingDays: numeric('pending_days', { precision: 6, scale: 2 }).notNull().default('0.00'),
    remainingDays: numeric('remaining_days', { precision: 6, scale: 2 }).notNull(),
  },
  (table) => [
    uniqueIndex('leave_balances_emp_type_year_idx').on(
      table.employeeId,
      table.leaveTypeId,
      table.year
    ),
  ]
);

export const leaveRequests = pgTable(
  'leave_requests',
  {
    id: serial('id').primaryKey(),
    requestNumber: text('request_number').notNull(),
    employeeId: integer('employee_id')
      .notNull()
      .references(() => employeeProfiles.id),
    leaveTypeId: integer('leave_type_id')
      .notNull()
      .references(() => leaveTypes.id),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    totalDays: numeric('total_days', { precision: 6, scale: 2 }).notNull(),
    reason: text('reason').notNull(),
    status: text('status').notNull().default('PENDING'), // PENDING | APPROVED | REJECTED | CANCELLED
    reviewedByUserId: integer('reviewed_by_user_id').references(() => users.id),
    reviewComments: text('review_comments'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('leave_requests_number_idx').on(table.requestNumber)]
);

export const recruitmentVacancies = pgTable(
  'recruitment_vacancies',
  {
    id: serial('id').primaryKey(),
    vacancyCode: text('vacancy_code').notNull(),
    title: text('title').notNull(),
    departmentId: integer('department_id')
      .notNull()
      .references(() => departments.id),
    employmentType: text('employment_type').notNull(),
    positionsCount: integer('positions_count').notNull().default(1),
    status: text('status').notNull().default('OPEN'), // OPEN | INTERVIEWING | OFFERED | CLOSED
    closingDate: text('closing_date').notNull(),
    description: text('description').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('recruitment_vacancies_code_idx').on(table.vacancyCode)]
);

export const candidates = pgTable('candidates', {
  id: serial('id').primaryKey(),
  vacancyId: integer('vacancy_id')
    .notNull()
    .references(() => recruitmentVacancies.id),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  stage: text('stage').notNull().default('APPLIED'), // APPLIED | SCREENING | INTERVIEW_SCHEDULED | OFFER_EXTENDED | HIRED | REJECTED
  interviewDate: text('interview_date'),
  interviewerNotes: text('interviewer_notes'),
  onboardingChecklistJson: text('onboarding_checklist_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const trainingRecords = pgTable('training_records', {
  id: serial('id').primaryKey(),
  programName: text('program_name').notNull(),
  category: text('category').notNull(),
  trainerName: text('trainer_name').notNull(),
  trainingDate: text('training_date').notNull(),
  expiryDate: text('expiry_date'),
  employeeId: integer('employee_id')
    .notNull()
    .references(() => employeeProfiles.id),
  completionStatus: text('completion_status').notNull().default('COMPLETED'),
  certificateNumber: text('certificate_number'),
  scorePercent: integer('score_percent').notNull().default(95),
});

export const performanceReviews = pgTable('performance_reviews', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id')
    .notNull()
    .references(() => employeeProfiles.id),
  reviewPeriod: text('review_period').notNull(),
  reviewerUserId: integer('reviewer_user_id').references(() => users.id),
  kpiScore: numeric('kpi_score', { precision: 5, scale: 2 }).notNull(),
  rating: text('rating').notNull(), // EXCEEDS_EXPECTATIONS | MEETS_EXPECTATIONS | NEEDS_IMPROVEMENT
  objectivesSummary: text('objectives_summary').notNull(),
  supervisorAssessment: text('supervisor_assessment').notNull(),
  developmentPlan: text('development_plan').notNull(),
  status: text('status').notNull().default('FINALIZED'),
  reviewDate: text('review_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 5. FINANCE & KENYAN STATUTORY PAYROLL
// ============================================================================

export const chartOfAccounts = pgTable(
  'chart_of_accounts',
  {
    id: serial('id').primaryKey(),
    accountCode: text('account_code').notNull(),
    accountName: text('account_name').notNull(),
    accountType: text('account_type').notNull(), // ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE
    currency: text('currency').notNull().default('KES'),
    balanceKes: numeric('balance_kes', { precision: 16, scale: 2 })
      .notNull()
      .default('0.00'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [uniqueIndex('chart_of_accounts_code_idx').on(table.accountCode)]
);

export const journalEntries = pgTable(
  'journal_entries',
  {
    id: serial('id').primaryKey(),
    entryNumber: text('entry_number').notNull(),
    entryDate: text('entry_date').notNull(),
    periodCode: text('period_code').notNull(),
    description: text('description').notNull(),
    referenceType: text('reference_type'),
    referenceId: text('reference_id'),
    totalDebitKes: numeric('total_debit_kes', { precision: 16, scale: 2 }).notNull(),
    totalCreditKes: numeric('total_credit_kes', { precision: 16, scale: 2 }).notNull(),
    status: text('status').notNull().default('POSTED'), // DRAFT | POSTED | REVERSED
    createdByUserId: integer('created_by_user_id').references(() => users.id),
    approvedByUserId: integer('approved_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('journal_entries_number_idx').on(table.entryNumber)]
);

export const journalLines = pgTable('journal_lines', {
  id: serial('id').primaryKey(),
  journalEntryId: integer('journal_entry_id')
    .notNull()
    .references(() => journalEntries.id, { onDelete: 'cascade' }),
  accountId: integer('account_id')
    .notNull()
    .references(() => chartOfAccounts.id),
  costCenterCode: text('cost_center_code').notNull(),
  debitKes: numeric('debit_kes', { precision: 16, scale: 2 }).notNull().default('0.00'),
  creditKes: numeric('credit_kes', { precision: 16, scale: 2 }).notNull().default('0.00'),
  memo: text('memo'),
});

export const expenseRecords = pgTable(
  'expense_records',
  {
    id: serial('id').primaryKey(),
    expenseNumber: text('expense_number').notNull(),
    departmentId: integer('department_id')
      .notNull()
      .references(() => departments.id),
    accountId: integer('account_id')
      .notNull()
      .references(() => chartOfAccounts.id),
    category: text('category').notNull(),
    vendorName: text('vendor_name').notNull(),
    description: text('description').notNull(),
    amountKes: numeric('amount_kes', { precision: 14, scale: 2 }).notNull(),
    taxKes: numeric('tax_kes', { precision: 14, scale: 2 }).notNull().default('0.00'),
    expenseDate: text('expense_date').notNull(),
    paymentStatus: text('payment_status').notNull().default('PENDING_APPROVAL'), // PENDING_APPROVAL | APPROVED | PAID | REJECTED
    submittedByUserId: integer('submitted_by_user_id').references(() => users.id),
    approvedByUserId: integer('approved_by_user_id').references(() => users.id),
    paymentRef: text('payment_ref'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('expense_records_number_idx').on(table.expenseNumber)]
);

export const statutoryRuleVersions = pgTable(
  'statutory_rule_versions',
  {
    id: serial('id').primaryKey(),
    versionCode: text('version_code').notNull(),
    countryCode: text('country_code').notNull().default('KE'),
    effectiveFrom: text('effective_from').notNull(),
    effectiveTo: text('effective_to'),
    personalReliefKes: numeric('personal_relief_kes', {
      precision: 10,
      scale: 2,
    }).notNull(),
    shifRatePercent: numeric('shif_rate_percent', { precision: 6, scale: 4 }).notNull(),
    ahlEmployeeRatePercent: numeric('ahl_employee_rate_percent', {
      precision: 6,
      scale: 4,
    }).notNull(),
    ahlEmployerRatePercent: numeric('ahl_employer_rate_percent', {
      precision: 6,
      scale: 4,
    }).notNull(),
    nssfTier1LimitKes: numeric('nssf_tier1_limit_kes', {
      precision: 12,
      scale: 2,
    }).notNull(),
    nssfTier2LimitKes: numeric('nssf_tier2_limit_kes', {
      precision: 12,
      scale: 2,
    }).notNull(),
    nssfRatePercent: numeric('nssf_rate_percent', { precision: 6, scale: 4 }).notNull(),
    payeBandsJson: text('paye_bands_json').notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [uniqueIndex('statutory_rule_versions_code_idx').on(table.versionCode)]
);

export const payrollRuns = pgTable(
  'payroll_runs',
  {
    id: serial('id').primaryKey(),
    runCode: text('run_code').notNull(),
    periodMonth: text('period_month').notNull(),
    payDate: text('pay_date').notNull(),
    statutoryVersionCode: text('statutory_version_code').notNull(),
    employeeCount: integer('employee_count').notNull(),
    totalGrossKes: numeric('total_gross_kes', { precision: 16, scale: 2 }).notNull(),
    totalPayeKes: numeric('total_paye_kes', { precision: 16, scale: 2 }).notNull(),
    totalNssfEmployeeKes: numeric('total_nssf_employee_kes', {
      precision: 16,
      scale: 2,
    }).notNull(),
    totalShifKes: numeric('total_shif_kes', { precision: 16, scale: 2 }).notNull(),
    totalHousingLevyKes: numeric('total_housing_levy_kes', {
      precision: 16,
      scale: 2,
    }).notNull(),
    totalOtherDeductionsKes: numeric('total_other_deductions_kes', {
      precision: 16,
      scale: 2,
    }).notNull(),
    totalNetPayKes: numeric('total_net_pay_kes', { precision: 16, scale: 2 }).notNull(),
    status: text('status').notNull().default('APPROVED'), // DRAFT | REVIEWED | APPROVED | DISBURSED
    preparedByUserId: integer('prepared_by_user_id').references(() => users.id),
    approvedByUserId: integer('approved_by_user_id').references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('payroll_runs_code_idx').on(table.runCode)]
);

export const payslipRecords = pgTable(
  'payslip_records',
  {
    id: serial('id').primaryKey(),
    payslipNumber: text('payslip_number').notNull(),
    payrollRunId: integer('payroll_run_id')
      .notNull()
      .references(() => payrollRuns.id, { onDelete: 'cascade' }),
    employeeId: integer('employee_id')
      .notNull()
      .references(() => employeeProfiles.id),
    periodMonth: text('period_month').notNull(),
    basicPayKes: numeric('basic_pay_kes', { precision: 14, scale: 2 }).notNull(),
    overtimePayKes: numeric('overtime_pay_kes', { precision: 14, scale: 2 }).notNull(),
    allowancesKes: numeric('allowances_kes', { precision: 14, scale: 2 }).notNull(),
    grossPayKes: numeric('gross_pay_kes', { precision: 14, scale: 2 }).notNull(),
    nssfEmployeeKes: numeric('nssf_employee_kes', { precision: 14, scale: 2 }).notNull(),
    nssfEmployerKes: numeric('nssf_employer_kes', { precision: 14, scale: 2 }).notNull(),
    shifKes: numeric('shif_kes', { precision: 14, scale: 2 }).notNull(),
    housingLevyEmployeeKes: numeric('housing_levy_employee_kes', {
      precision: 14,
      scale: 2,
    }).notNull(),
    housingLevyEmployerKes: numeric('housing_levy_employer_kes', {
      precision: 14,
      scale: 2,
    }).notNull(),
    taxablePayKes: numeric('taxable_pay_kes', { precision: 14, scale: 2 }).notNull(),
    payeBeforeReliefKes: numeric('paye_before_relief_kes', {
      precision: 14,
      scale: 2,
    }).notNull(),
    personalReliefKes: numeric('personal_relief_kes', {
      precision: 14,
      scale: 2,
    }).notNull(),
    payeTaxKes: numeric('paye_tax_kes', { precision: 14, scale: 2 }).notNull(),
    otherDeductionsKes: numeric('other_deductions_kes', {
      precision: 14,
      scale: 2,
    }).notNull(),
    netPayKes: numeric('net_pay_kes', { precision: 14, scale: 2 }).notNull(),
    paymentStatus: text('payment_status').notNull().default('PAID'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('payslip_records_number_idx').on(table.payslipNumber)]
);

// ============================================================================
// 6. PACKHOUSE & PRODUCTION
// ============================================================================

export const packingOrders = pgTable(
  'packing_orders',
  {
    id: serial('id').primaryKey(),
    orderCode: text('order_code').notNull(),
    harvestBatchId: integer('harvest_batch_id')
      .notNull()
      .references(() => harvestBatches.id),
    cropId: integer('crop_id')
      .notNull()
      .references(() => cropCatalog.id),
    targetProductId: integer('target_product_id')
      .notNull()
      .references(() => products.id),
    intakeWeightKg: numeric('intake_weight_kg', { precision: 12, scale: 2 }).notNull(),
    intakeTempC: numeric('intake_temp_c', { precision: 5, scale: 2 }).notNull(),
    gradedAcceptedKg: numeric('graded_accepted_kg', { precision: 12, scale: 2 }).notNull(),
    gradedRejectedKg: numeric('graded_rejected_kg', { precision: 12, scale: 2 }).notNull(),
    washingLossKg: numeric('washing_loss_kg', { precision: 12, scale: 2 }).notNull(),
    packedOutputKg: numeric('packed_output_kg', { precision: 12, scale: 2 }).notNull(),
    unaccountedVarianceKg: numeric('unaccounted_variance_kg', {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    packFormat: text('pack_format').notNull(),
    unitsPackedCount: integer('units_packed_count').notNull(),
    packagingProductId: integer('packaging_product_id').references(() => products.id),
    packagingQtyUsed: numeric('packaging_qty_used', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    labourCount: integer('labour_count').notNull().default(18),
    shiftCode: text('shift_code').notNull().default('SHIFT-DAY'),
    productionCostKes: numeric('production_cost_kes', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    status: text('status').notNull().default('COMPLETED'), // INTAKE | GRADING | WASHING | PACKING | COMPLETED
    supervisorUserId: integer('supervisor_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('packing_orders_code_idx').on(table.orderCode)]
);

export const packingBatches = pgTable(
  'packing_batches',
  {
    id: serial('id').primaryKey(),
    packingBatchCode: text('packing_batch_code').notNull(),
    packingOrderId: integer('packing_order_id')
      .notNull()
      .references(() => packingOrders.id),
    harvestBatchId: integer('harvest_batch_id')
      .notNull()
      .references(() => harvestBatches.id),
    finishedProductId: integer('finished_product_id')
      .notNull()
      .references(() => products.id),
    inventoryLotId: integer('inventory_lot_id').references(() => inventoryLots.id),
    grade: text('grade').notNull().default('CLASS_I_EXPORT'), // CLASS_I_EXPORT | CLASS_II_LOCAL | REJECT
    netWeightKg: numeric('net_weight_kg', { precision: 12, scale: 2 }).notNull(),
    cartonsCount: integer('cartons_count').notNull(),
    coldRoomTempC: numeric('cold_room_temp_c', { precision: 5, scale: 2 }).notNull(),
    qaStatus: text('qa_status').notNull().default('PASSED'), // PENDING_QA | PASSED | QUARANTINED | REJECTED
    packedDate: text('packed_date').notNull(),
    expiryDate: text('expiry_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('packing_batches_code_idx').on(table.packingBatchCode)]
);

// ============================================================================
// 7. QUALITY ASSURANCE
// ============================================================================

export const qualityInspections = pgTable(
  'quality_inspections',
  {
    id: serial('id').primaryKey(),
    inspectionCode: text('inspection_code').notNull(),
    stage: text('stage').notNull(), // INCOMING_HARVEST | IN_PROCESS_PACKHOUSE | FINISHED_COLD_CHAIN | PRE_EXPORT_PHYTOSANITARY
    harvestBatchId: integer('harvest_batch_id').references(() => harvestBatches.id),
    packingBatchId: integer('packing_batch_id').references(() => packingBatches.id),
    inventoryLotId: integer('inventory_lot_id').references(() => inventoryLots.id),
    sampleWeightKg: numeric('sample_weight_kg', { precision: 10, scale: 2 }).notNull(),
    measuredTempC: numeric('measured_temp_c', { precision: 5, scale: 2 }).notNull(),
    maxAllowedTempC: numeric('max_allowed_temp_c', { precision: 5, scale: 2 }).notNull(),
    moistureStatus: text('moisture_status').notNull().default('OPTIMAL'),
    pestFreeStatus: boolean('pest_free_status').notNull().default(true),
    pesticideResidueCompliant: boolean('pesticide_residue_compliant')
      .notNull()
      .default(true),
    packagingIntegrity: text('packaging_integrity').notNull().default('VERIFIED'),
    defectPercent: numeric('defect_percent', { precision: 5, scale: 2 }).notNull(),
    result: text('result').notNull(), // PASS | CONDITIONAL_PASS | FAIL_QUARANTINE
    quarantineStatus: text('quarantine_status').notNull().default('NONE'), // NONE | QUARANTINED | RELEASED | DESTROYED
    inspectorUserId: integer('inspector_user_id').references(() => users.id),
    releasedByUserId: integer('released_by_user_id').references(() => users.id),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    notes: text('notes'),
    inspectedAt: timestamp('inspected_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('quality_inspections_code_idx').on(table.inspectionCode)]
);

export const nonconformities = pgTable(
  'nonconformities',
  {
    id: serial('id').primaryKey(),
    ncrNumber: text('ncr_number').notNull(),
    inspectionId: integer('inspection_id').references(() => qualityInspections.id),
    severity: text('severity').notNull(), // MINOR | MAJOR | CRITICAL
    category: text('category').notNull(),
    description: text('description').notNull(),
    rootCause: text('root_cause').notNull(),
    correctiveAction: text('corrective_action').notNull(),
    preventiveAction: text('preventive_action').notNull(),
    assignedToUserId: integer('assigned_to_user_id').references(() => users.id),
    status: text('status').notNull().default('OPEN'), // OPEN | CAPA_IN_PROGRESS | VERIFIED_CLOSED
    dueDate: text('due_date').notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('nonconformities_number_idx').on(table.ncrNumber)]
);

// ============================================================================
// 8. PROCUREMENT & SUPPLIERS
// ============================================================================

export const suppliers = pgTable(
  'suppliers',
  {
    id: serial('id').primaryKey(),
    supplierCode: text('supplier_code').notNull(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    contactPerson: text('contact_person').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    kraPin: text('kra_pin').notNull(),
    country: text('country').notNull().default('Kenya'),
    paymentTermsDays: integer('payment_terms_days').notNull().default(30),
    qualificationStatus: text('qualification_status').notNull().default('APPROVED'),
    rating: numeric('rating', { precision: 3, scale: 2 }).notNull().default('4.80'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('suppliers_code_idx').on(table.supplierCode)]
);

export const purchaseRequisitions = pgTable(
  'purchase_requisitions',
  {
    id: serial('id').primaryKey(),
    reqNumber: text('req_number').notNull(),
    departmentId: integer('department_id')
      .notNull()
      .references(() => departments.id),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    quantity: numeric('quantity', { precision: 12, scale: 2 }).notNull(),
    estimatedUnitCostKes: numeric('estimated_unit_cost_kes', {
      precision: 14,
      scale: 2,
    }).notNull(),
    totalEstimatedKes: numeric('total_estimated_kes', {
      precision: 14,
      scale: 2,
    }).notNull(),
    justification: text('justification').notNull(),
    status: text('status').notNull().default('PENDING_APPROVAL'), // PENDING_APPROVAL | APPROVED | REJECTED | CONVERTED_TO_PO
    requestedByUserId: integer('requested_by_user_id').references(() => users.id),
    approvedByUserId: integer('approved_by_user_id').references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('purchase_requisitions_number_idx').on(table.reqNumber)]
);

export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    id: serial('id').primaryKey(),
    poNumber: text('po_number').notNull(),
    requisitionId: integer('requisition_id').references(() => purchaseRequisitions.id),
    supplierId: integer('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    orderedQty: numeric('ordered_qty', { precision: 12, scale: 2 }).notNull(),
    receivedQty: numeric('received_qty', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    unitPriceKes: numeric('unit_price_kes', { precision: 14, scale: 2 }).notNull(),
    totalAmountKes: numeric('total_amount_kes', { precision: 14, scale: 2 }).notNull(),
    expectedDeliveryDate: text('expected_delivery_date').notNull(),
    status: text('status').notNull().default('APPROVED'), // DRAFT | APPROVED | ISSUED | PARTIALLY_RECEIVED | RECEIVED | INVOICED | CANCELLED
    createdByUserId: integer('created_by_user_id').references(() => users.id),
    approvedByUserId: integer('approved_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('purchase_orders_number_idx').on(table.poNumber)]
);

export const goodsReceipts = pgTable(
  'goods_receipts',
  {
    id: serial('id').primaryKey(),
    grnNumber: text('grn_number').notNull(),
    purchaseOrderId: integer('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id),
    supplierId: integer('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    warehouseId: integer('warehouse_id')
      .notNull()
      .references(() => warehouses.id),
    lotCreatedId: integer('lot_created_id').references(() => inventoryLots.id),
    receivedQty: numeric('received_qty', { precision: 12, scale: 2 }).notNull(),
    acceptedQty: numeric('accepted_qty', { precision: 12, scale: 2 }).notNull(),
    rejectedQty: numeric('rejected_qty', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    deliveryNoteRef: text('delivery_note_ref').notNull(),
    inspectionNotes: text('inspection_notes'),
    receivedByUserId: integer('received_by_user_id').references(() => users.id),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('goods_receipts_number_idx').on(table.grnNumber)]
);

export const supplierInvoices = pgTable(
  'supplier_invoices',
  {
    id: serial('id').primaryKey(),
    invoiceNumber: text('invoice_number').notNull(),
    supplierId: integer('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    purchaseOrderId: integer('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id),
    grnId: integer('grn_id').references(() => goodsReceipts.id),
    invoiceAmountKes: numeric('invoice_amount_kes', { precision: 14, scale: 2 }).notNull(),
    poAmountKes: numeric('po_amount_kes', { precision: 14, scale: 2 }).notNull(),
    grnAmountKes: numeric('grn_amount_kes', { precision: 14, scale: 2 }).notNull(),
    threeWayMatchStatus: text('three_way_match_status').notNull().default('MATCHED'), // MATCHED | VARIANCE_HOLD | PENDING_GRN
    paymentStatus: text('payment_status').notNull().default('UNPAID'), // UNPAID | AUTHORIZED | PAID | DISPUTED
    dueDate: text('due_date').notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('supplier_invoices_number_idx').on(table.invoiceNumber)]
);

// ============================================================================
// 9. SALES, EXPORT & LOGISTICS
// ============================================================================

export const customers = pgTable(
  'customers',
  {
    id: serial('id').primaryKey(),
    customerCode: text('customer_code').notNull(),
    name: text('name').notNull(),
    buyerType: text('buyer_type').notNull(),
    country: text('country').notNull(),
    destinationAirportCode: text('destination_airport_code').notNull(),
    contactPerson: text('contact_person').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    currency: text('currency').notNull().default('EUR'),
    creditLimitEur: numeric('credit_limit_eur', { precision: 14, scale: 2 }).notNull(),
    incoterms: text('incoterms').notNull().default('CIP'),
    coldChainSpecC: text('cold_chain_spec_c').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('customers_code_idx').on(table.customerCode)]
);

export const salesOrders = pgTable(
  'sales_orders',
  {
    id: serial('id').primaryKey(),
    orderNumber: text('order_number').notNull(),
    customerId: integer('customer_id')
      .notNull()
      .references(() => customers.id),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    packingBatchId: integer('packing_batch_id').references(() => packingBatches.id),
    orderedKg: numeric('ordered_kg', { precision: 12, scale: 2 }).notNull(),
    allocatedKg: numeric('allocated_kg', { precision: 12, scale: 2 }).notNull(),
    dispatchedKg: numeric('dispatched_kg', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    currency: text('currency').notNull().default('EUR'),
    unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
    exchangeRateToKes: numeric('exchange_rate_to_kes', {
      precision: 12,
      scale: 4,
    }).notNull(),
    totalCurrencyAmount: numeric('total_currency_amount', {
      precision: 14,
      scale: 2,
    }).notNull(),
    totalKesAmount: numeric('total_kes_amount', { precision: 16, scale: 2 }).notNull(),
    requestedDeliveryDate: text('requested_delivery_date').notNull(),
    status: text('status').notNull().default('STOCK_RESERVED'), // DRAFT | APPROVED | STOCK_RESERVED | PACKED | DISPATCHED | DELIVERED | INVOICED | PAID
    paymentStatus: text('payment_status').notNull().default('UNPAID'), // UNPAID | PARTIAL | PAID
    approvedByUserId: integer('approved_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('sales_orders_number_idx').on(table.orderNumber)]
);

export const vehicles = pgTable(
  'vehicles',
  {
    id: serial('id').primaryKey(),
    registrationNumber: text('registration_number').notNull(),
    vehicleType: text('vehicle_type').notNull(),
    makeModel: text('make_model').notNull(),
    reeferTempMinC: numeric('reefer_temp_min_c', { precision: 5, scale: 2 }).notNull(),
    reeferTempMaxC: numeric('reefer_temp_max_c', { precision: 5, scale: 2 })
      .notNull()
      .default('4.00'),
    driverName: text('driver_name').notNull(),
    driverPhone: text('driver_phone').notNull(),
    driverLicenseNo: text('driver_license_no').notNull(),
    status: text('status').notNull().default('AVAILABLE'), // AVAILABLE | IN_TRANSIT | MAINTENANCE
    currentRoute: text('current_route').notNull(),
  },
  (table) => [uniqueIndex('vehicles_reg_idx').on(table.registrationNumber)]
);

export const shipments = pgTable(
  'shipments',
  {
    id: serial('id').primaryKey(),
    shipmentCode: text('shipment_code').notNull(),
    salesOrderId: integer('sales_order_id')
      .notNull()
      .references(() => salesOrders.id),
    vehicleId: integer('vehicle_id').references(() => vehicles.id),
    packingBatchId: integer('packing_batch_id').references(() => packingBatches.id),
    originLocation: text('origin_location').notNull(),
    destinationLocation: text('destination_location').notNull(),
    airWaybillNo: text('air_waybill_no'),
    airlineName: text('airline_name'),
    dispatchedKg: numeric('dispatched_kg', { precision: 12, scale: 2 }).notNull(),
    cartonsCount: integer('cartons_count').notNull(),
    departureTempC: numeric('departure_temp_c', { precision: 5, scale: 2 }).notNull(),
    arrivalTempC: numeric('arrival_temp_c', { precision: 5, scale: 2 }),
    transportCostKes: numeric('transport_cost_kes', { precision: 12, scale: 2 }).notNull(),
    dispatchStatus: text('dispatch_status').notNull().default('PLANNED'), // PLANNED | PICK_PACK_VERIFIED | IN_TRANSIT_TO_JKIA | AIRFREIGHT_DEPARTED | DELIVERED | EXCEPTION
    dispatchedByUserId: integer('dispatched_by_user_id').references(() => users.id),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    proofOfDeliveryRef: text('proof_of_delivery_ref'),
    deliveryRecipientName: text('delivery_recipient_name'),
    deliveryNotes: text('delivery_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('shipments_code_idx').on(table.shipmentCode)]
);

export const exportDocuments = pgTable(
  'export_documents',
  {
    id: serial('id').primaryKey(),
    docNumber: text('doc_number').notNull(),
    salesOrderId: integer('sales_order_id')
      .notNull()
      .references(() => salesOrders.id),
    shipmentId: integer('shipment_id').references(() => shipments.id),
    docType: text('doc_type').notNull(), // PHYTOSANITARY_CERTIFICATE | EUR1_MOVEMENT_CERT | COMMERCIAL_INVOICE | PACKING_LIST | AIR_WAYBILL | GLOBALGAP_COC
    issuingAuthority: text('issuing_authority').notNull(),
    issueDate: text('issue_date').notNull(),
    expiryDate: text('expiry_date').notNull(),
    status: text('status').notNull().default('VERIFIED'), // DRAFT | VERIFIED | SUBMITTED | EXPIRED
    verifiedByUserId: integer('verified_by_user_id').references(() => users.id),
    notes: text('notes'),
  },
  (table) => [uniqueIndex('export_documents_number_idx').on(table.docNumber)]
);

// ============================================================================
// 10. EQUIPMENT & MAINTENANCE
// ============================================================================

export const assets = pgTable(
  'assets',
  {
    id: serial('id').primaryKey(),
    assetTag: text('asset_tag').notNull(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    departmentId: integer('department_id').references(() => departments.id),
    custodianUserId: integer('custodian_user_id').references(() => users.id),
    purchaseDate: text('purchase_date').notNull(),
    purchaseCostKes: numeric('purchase_cost_kes', { precision: 14, scale: 2 }).notNull(),
    warrantyExpiryDate: text('warranty_expiry_date').notNull(),
    condition: text('condition').notNull().default('GOOD'), // EXCELLENT | GOOD | FAIR | NEEDS_REPAIR
    lastServiceDate: text('last_service_date').notNull(),
    nextServiceDueDate: text('next_service_due_date').notNull(),
    downtimeHoursTotal: numeric('downtime_hours_total', {
      precision: 8,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    location: text('location').notNull(),
  },
  (table) => [uniqueIndex('assets_tag_idx').on(table.assetTag)]
);

export const maintenanceWorkOrders = pgTable(
  'maintenance_work_orders',
  {
    id: serial('id').primaryKey(),
    workOrderNo: text('work_order_no').notNull(),
    assetId: integer('asset_id')
      .notNull()
      .references(() => assets.id),
    maintenanceType: text('maintenance_type').notNull(), // PREVENTIVE | CORRECTIVE_REPAIR | CALIBRATION
    priority: text('priority').notNull().default('MEDIUM'), // LOW | MEDIUM | HIGH | CRITICAL
    issueDescription: text('issue_description').notNull(),
    sparePartProductId: integer('spare_part_product_id').references(() => products.id),
    sparePartQtyUsed: numeric('spare_part_qty_used', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    labourCostKes: numeric('labour_cost_kes', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    partsCostKes: numeric('parts_cost_kes', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    downtimeHours: numeric('downtime_hours', { precision: 8, scale: 2 })
      .notNull()
      .default('0.00'),
    technicianName: text('technician_name').notNull(),
    status: text('status').notNull().default('OPEN'), // OPEN | IN_PROGRESS | COMPLETED | CANCELLED
    scheduledDate: text('scheduled_date').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('maintenance_work_orders_no_idx').on(table.workOrderNo)]
);

// ============================================================================
// 11. PRIVATE INTERNAL COMMUNICATIONS
// ============================================================================

export const conversations = pgTable(
  'conversations',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull(),
    title: text('title').notNull(),
    conversationType: text('conversation_type').notNull().default('DIRECT_PRIVATE'), // DIRECT_PRIVATE | DASHBOARD_CHANNEL | PRIVATE_GROUP
    targetDashboardCode: text('target_dashboard_code'),
    historySharingPolicy: text('history_sharing_policy')
      .notNull()
      .default('FROM_JOIN_TIME'), // FROM_JOIN_TIME | FULL_HISTORY
    createdByUserId: integer('created_by_user_id')
      .notNull()
      .references(() => users.id),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
    isArchived: boolean('is_archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('conversations_code_idx').on(table.code)]
);

export const conversationMembers = pgTable(
  'conversation_members',
  {
    id: serial('id').primaryKey(),
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    memberRole: text('member_role').notNull().default('PARTICIPANT'), // OWNER | PARTICIPANT
    canSend: boolean('can_send').notNull().default(true),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('conversation_members_unique_idx').on(table.conversationId, table.userId),
    index('conversation_members_user_idx').on(table.userId),
  ]
);

export const messages = pgTable(
  'messages',
  {
    id: serial('id').primaryKey(),
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderUserId: integer('sender_user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    messageType: text('message_type').notNull().default('TEXT'), // TEXT | ATTACHMENT | URGENT_DIRECTIVE
    attachmentDocId: integer('attachment_doc_id'),
    attachmentFileName: text('attachment_file_name'),
    isEdited: boolean('is_edited').notNull().default(false),
    isDeleted: boolean('is_deleted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('messages_conversation_idx').on(table.conversationId)]
);

export const messageReceipts = pgTable(
  'message_receipts',
  {
    id: serial('id').primaryKey(),
    messageId: integer('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (table) => [uniqueIndex('message_receipts_unique_idx').on(table.messageId, table.userId)]
);

export const notificationRecords = pgTable(
  'notification_records',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    linkUrl: text('link_url').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('notification_records_user_idx').on(table.userId)]
);

// ============================================================================
// 12. SHARED SYSTEM RECORDS (APPROVALS, DOCUMENTS, AUDIT, SETTINGS)
// ============================================================================

export const approvalRequests = pgTable(
  'approval_requests',
  {
    id: serial('id').primaryKey(),
    requestCode: text('request_code').notNull(),
    module: text('module').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: integer('entity_id').notNull(),
    title: text('title').notNull(),
    amountKes: numeric('amount_kes', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    submittedByUserId: integer('submitted_by_user_id')
      .notNull()
      .references(() => users.id),
    assignedRoleCode: text('assigned_role_code').notNull(),
    status: text('status').notNull().default('PENDING'), // PENDING | APPROVED | REJECTED | RETURNED
    decidedByUserId: integer('decided_by_user_id').references(() => users.id),
    decisionComments: text('decision_comments'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (table) => [uniqueIndex('approval_requests_code_idx').on(table.requestCode)]
);

export const documentRecords = pgTable(
  'document_records',
  {
    id: serial('id').primaryKey(),
    docCode: text('doc_code').notNull(),
    title: text('title').notNull(),
    category: text('category').notNull(),
    originalFilename: text('original_filename').notNull(),
    storageKey: text('storage_key').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSizeBytes: integer('file_size_bytes').notNull(),
    checksumSha256: text('checksum_sha256').notNull(),
    uploadedByUserId: integer('uploaded_by_user_id')
      .notNull()
      .references(() => users.id),
    departmentId: integer('department_id').references(() => departments.id),
    conversationId: integer('conversation_id').references(() => conversations.id),
    isConfidential: boolean('is_confidential').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('document_records_code_idx').on(table.docCode),
    uniqueIndex('document_records_storage_key_idx').on(table.storageKey),
  ]
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    actorUserId: integer('actor_user_id').references(() => users.id),
    actorEmail: text('actor_email').notNull(),
    actorRole: text('actor_role').notNull(),
    action: text('action').notNull(),
    module: text('module').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    summary: text('summary').notNull(),
    beforeStateJson: text('before_state_json'),
    afterStateJson: text('after_state_json'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('audit_logs_created_idx').on(table.createdAt)]
);

export const systemSettings = pgTable(
  'system_settings',
  {
    id: serial('id').primaryKey(),
    settingKey: text('setting_key').notNull(),
    settingValue: text('setting_value').notNull(),
    category: text('category').notNull(),
    description: text('description').notNull(),
    updatedByUserId: integer('updated_by_user_id').references(() => users.id),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('system_settings_key_idx').on(table.settingKey)]
);

export const integrationSettings = pgTable(
  'integration_settings',
  {
    id: serial('id').primaryKey(),
    integrationCode: text('integration_code').notNull(),
    name: text('name').notNull(),
    mode: text('mode').notNull().default('SANDBOX'), // SANDBOX | DISABLED | LIVE
    isEnabled: boolean('is_enabled').notNull().default(false),
    configSummaryJson: text('config_summary_json').notNull(),
    lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
    statusMessage: text('status_message').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('integration_settings_code_idx').on(table.integrationCode)]
);
