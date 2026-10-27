import { sql, type SQL } from 'drizzle-orm';
import { getDb } from '@/db';

type Rows<T> = { rows: T[] };

async function many<T>(query: SQL): Promise<T[]> {
  const db = await getDb();
  const res = (await db.execute(query)) as unknown as Rows<T>;
  return res.rows;
}

async function one<T extends Record<string, unknown>>(query: SQL): Promise<T> {
  const rows = await many<T>(query);
  return rows[0] ?? ({} as T);
}

export async function farmKpis() {
  return one<{
    active_cycles: number;
    growing: number;
    harvesting: number;
    planned: number;
    hectares_active: string;
    greenhouses: number;
    open_fields: number;
    today_harvest_kg: string;
    week_harvest_kg: string;
    month_harvest_kg: string;
    field_rejects_kg: string;
    open_batches: number;
    quarantined_batches: number;
    pending_activities: number;
    yield_vs_target_pct: string;
  }>(sql`
    SELECT
      (SELECT count(*)::int FROM crop_cycles WHERE status NOT IN ('COMPLETED','CANCELLED'))::int AS active_cycles,
      (SELECT count(*)::int FROM crop_cycles WHERE status = 'GROWING')::int AS growing,
      (SELECT count(*)::int FROM crop_cycles WHERE status = 'HARVESTING')::int AS harvesting,
      (SELECT count(*)::int FROM crop_cycles WHERE status IN ('PLANNED','PLANTED'))::int AS planned,
      (SELECT COALESCE(SUM(cc.planted_area_ha),0) FROM crop_cycles cc WHERE cc.status NOT IN ('COMPLETED','CANCELLED'))::text AS hectares_active,
      (SELECT count(*)::int FROM fields WHERE field_type = 'GREENHOUSE' AND status = 'ACTIVE')::int AS greenhouses,
      (SELECT count(*)::int FROM fields WHERE field_type != 'GREENHOUSE' AND status = 'ACTIVE')::int AS open_fields,
      (SELECT COALESCE(SUM(harvested_weight_kg),0) FROM harvest_batches WHERE harvest_date::date = CURRENT_DATE)::text AS today_harvest_kg,
      (SELECT COALESCE(SUM(harvested_weight_kg),0) FROM harvest_batches WHERE harvest_date::date >= CURRENT_DATE - 7)::text AS week_harvest_kg,
      (SELECT COALESCE(SUM(harvested_weight_kg),0) FROM harvest_batches WHERE harvest_date::date >= CURRENT_DATE - 30)::text AS month_harvest_kg,
      (SELECT COALESCE(SUM(rejected_field_weight_kg),0) FROM harvest_batches WHERE harvest_date::date >= CURRENT_DATE - 30)::text AS field_rejects_kg,
      (SELECT count(*)::int FROM harvest_batches WHERE status IN ('HARVESTED','IN_PACKHOUSE'))::int AS open_batches,
      (SELECT count(*)::int FROM harvest_batches WHERE status = 'QUARANTINED')::int AS quarantined_batches,
      (SELECT count(*)::int FROM crop_cycles WHERE expected_harvest_date::date <= CURRENT_DATE + 3 AND status NOT IN ('COMPLETED','CANCELLED'))::int AS pending_activities,
      (SELECT CASE
         WHEN COALESCE(SUM(cc.expected_yield_kg),0) = 0 THEN '0'
         ELSE round(100.0 * COALESCE(SUM(cc.actual_harvested_kg),0) / SUM(cc.expected_yield_kg), 1)::text
       END
       FROM crop_cycles cc WHERE cc.actual_harvested_kg IS NOT NULL)::text AS yield_vs_target_pct;
  `);
}

export async function cropCycleList(limit = 12) {
  return many<{
    cycleCode: string;
    crop: string;
    field: string;
    fieldType: string;
    status: string;
    plantedAreaHa: string;
    plantingDate: string;
    expectedHarvestDate: string;
    expectedYieldKg: string;
    actualHarvestedKg: string | null;
    supervisor: string | null;
  }>(sql`
    SELECT cc.cycle_code AS "cycleCode", c.name AS crop, f.name AS field, f.field_type AS "fieldType",
           cc.status, cc.planted_area_ha AS "plantedAreaHa", cc.planting_date AS "plantingDate",
           cc.expected_harvest_date AS "expectedHarvestDate", cc.expected_yield_kg AS "expectedYieldKg",
           cc.actual_harvested_kg AS "actualHarvestedKg", u.full_name AS supervisor
    FROM crop_cycles cc
    JOIN crop_catalog c ON c.id = cc.crop_id
    JOIN fields f ON f.id = cc.field_id
    LEFT JOIN users u ON u.id = cc.supervisor_user_id
    WHERE cc.status NOT IN ('COMPLETED','CANCELLED')
    ORDER BY cc.expected_harvest_date::date
    LIMIT ${limit}::int;
  `);
}

export async function recentHarvestBatches(limit = 12) {
  return many<{
    batchNumber: string;
    crop: string;
    field: string;
    harvestDate: string;
    harvestedWeightKg: string;
    rejectedFieldWeightKg: string;
    netTransferredKg: string;
    cratesCount: number;
    fieldTempC: string;
    status: string;
    harvestedBy: string | null;
  }>(sql`
    SELECT hb.batch_number AS "batchNumber", c.name AS crop, f.name AS field,
           hb.harvest_date AS "harvestDate", hb.harvested_weight_kg AS "harvestedWeightKg",
           hb.rejected_field_weight_kg AS "rejectedFieldWeightKg",
           hb.net_transferred_kg AS "netTransferredKg", hb.crates_count AS "cratesCount",
           hb.field_temp_c AS "fieldTempC", hb.status, u.full_name AS "harvestedBy"
    FROM harvest_batches hb
    JOIN crop_catalog c ON c.id = hb.crop_id
    JOIN fields f ON f.id = hb.field_id
    LEFT JOIN users u ON u.id = hb.harvested_by_user_id
    ORDER BY hb.harvest_date::date DESC, hb.id DESC
    LIMIT ${limit}::int;
  `);
}

export async function harvestByCrop(days = 30) {
  return many<{ name: string; value: number }>(sql`
    SELECT c.name, COALESCE(SUM(hb.harvested_weight_kg),0)::numeric AS value
    FROM harvest_batches hb
    JOIN crop_catalog c ON c.id = hb.crop_id
    WHERE hb.harvest_date::date >= CURRENT_DATE - ${days}::int
    GROUP BY c.name
    ORDER BY value DESC;
  `);
}

export async function harvestDailySeries(days = 14) {
  return many<{ name: string; value: number }>(sql`
    SELECT to_char(harvest_date::date, 'DD Mon') AS name,
           COALESCE(SUM(harvested_weight_kg),0)::numeric AS value
    FROM harvest_batches
    WHERE harvest_date::date >= CURRENT_DATE - ${days}::int
    GROUP BY harvest_date::date
    ORDER BY harvest_date::date;
  `);
}

export async function weeklyTargetsVsActual() {
  return many<{ name: string; target: number; actual: number }>(sql`
    SELECT c.name,
           c.weekly_target_kg::numeric AS target,
           COALESCE((
             SELECT SUM(hb.harvested_weight_kg)
             FROM harvest_batches hb
             WHERE hb.crop_id = c.id AND hb.harvest_date::date >= CURRENT_DATE - 7
           ), 0)::numeric AS actual
    FROM crop_catalog c
    WHERE c.is_active
    ORDER BY c.weekly_target_kg DESC;
  `);
}

export async function fieldActivityLog(limit = 14) {
  return many<{
    activityDate: string;
    activityType: string;
    field: string;
    crop: string;
    inputName: string | null;
    inputQuantity: string | null;
    inputUnit: string | null;
    phiDays: number;
    labourHours: string;
    costKes: string;
    recordedBy: string | null;
    finding: string | null;
  }>(sql`
    SELECT fa.activity_date AS "activityDate", fa.activity_type AS "activityType",
           f.name AS field, c.name AS crop, fa.input_name AS "inputName",
           fa.input_quantity AS "inputQuantity", fa.input_unit AS "inputUnit",
           fa.phi_days AS "phiDays", fa.labour_hours AS "labourHours", fa.cost_kes AS "costKes",
           u.full_name AS "recordedBy", fa.pest_or_disease_finding AS finding
    FROM field_activities fa
    JOIN fields f ON f.id = fa.field_id
    LEFT JOIN crop_cycles cc ON cc.id = fa.crop_cycle_id
    LEFT JOIN crop_catalog c ON c.id = cc.crop_id
    LEFT JOIN users u ON u.id = fa.recorded_by_user_id
    ORDER BY fa.activity_date::date DESC, fa.id DESC
    LIMIT ${limit}::int;
  `);
}

export async function fieldUtilisation() {
  return many<{ name: string; status: string; areaHa: string; crop: string | null; cycleCode: string | null }>(sql`
    SELECT f.name, f.status, f.area_hectares AS "areaHa", f.field_type AS "fieldType",
           c.name AS crop, cc.cycle_code AS "cycleCode"
    FROM fields f
    LEFT JOIN crop_cycles cc ON cc.field_id = f.id AND cc.status NOT IN ('COMPLETED','CANCELLED')
    LEFT JOIN crop_catalog c ON c.id = cc.crop_id
    ORDER BY f.field_code
    LIMIT 24;
  `);
}

export async function phiWarnings() {
  return many<{ field: string; crop: string; activityType: string; inputName: string; activityDate: string; phiDays: number; clearDate: string }>(sql`
    SELECT f.name AS field, c.name AS crop, fa.activity_type AS "activityType",
           COALESCE(fa.input_name, '—') AS "inputName", fa.activity_date AS "activityDate",
           fa.phi_days AS "phiDays",
           to_char(fa.activity_date::date + fa.phi_days, 'YYYY-MM-DD') AS "clearDate"
    FROM field_activities fa
    JOIN fields f ON f.id = fa.field_id
    LEFT JOIN crop_cycles cc ON cc.id = fa.crop_cycle_id
    LEFT JOIN crop_catalog c ON c.id = cc.crop_id
    WHERE fa.phi_days > 0
      AND fa.activity_date::date + fa.phi_days >= CURRENT_DATE
    ORDER BY "clearDate"
    LIMIT 10;
  `);
}

export async function farmOptions() {
  const [fields, crops, cycles] = await Promise.all([
    many<{ id: number; label: string }>(sql`
      SELECT id, field_code || ' — ' || name AS label FROM fields WHERE status = 'ACTIVE' ORDER BY field_code;
    `),
    many<{ id: number; label: string }>(sql`
      SELECT id, name || ' (' || variety || ')' AS label FROM crop_catalog WHERE is_active ORDER BY name;
    `),
    many<{ id: number; label: string; cropId: number; fieldId: number }>(sql`
      SELECT cc.id, cc.cycle_code || ' — ' || c.name || ' @ ' || f.name AS label,
             cc.crop_id AS "cropId", cc.field_id AS "fieldId"
      FROM crop_cycles cc
      JOIN crop_catalog c ON c.id = cc.crop_id
      JOIN fields f ON f.id = cc.field_id
      WHERE cc.status NOT IN ('COMPLETED','CANCELLED')
      ORDER BY cc.cycle_code;
    `),
  ]);
  return { fields, crops, cycles };
}
