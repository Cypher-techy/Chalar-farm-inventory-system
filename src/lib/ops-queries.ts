import { sql, type SQL } from 'drizzle-orm';
import { getDb } from '@/db';

type Rows<T> = { rows: T[] };

export async function many<T>(query: SQL): Promise<T[]> {
  const db = await getDb();
  const res = (await db.execute(query)) as unknown as Rows<T>;
  return res.rows;
}

export async function one<T extends Record<string, unknown>>(query: SQL): Promise<T> {
  const rows = await many<T>(query);
  return rows[0] ?? ({} as T);
}

/* ============================ PACKHOUSE ============================ */

export async function packhouseKpis() {
  return one<Record<string, string | number>>(sql`
    SELECT
      (SELECT count(*)::int FROM packing_orders WHERE created_at > now() - interval '7 days')::int AS orders_7d,
      (SELECT count(*)::int FROM packing_orders WHERE status NOT IN ('COMPLETED','CANCELLED'))::int AS orders_open,
      (SELECT COALESCE(SUM(intake_weight_kg),0) FROM packing_orders WHERE created_at > now() - interval '7 days')::text AS intake_7d,
      (SELECT COALESCE(SUM(packed_output_kg),0) FROM packing_orders WHERE created_at > now() - interval '7 days')::text AS packed_7d,
      (SELECT COALESCE(SUM(graded_rejected_kg),0) FROM packing_orders WHERE created_at > now() - interval '7 days')::text AS rejected_7d,
      (SELECT COALESCE(SUM(washing_loss_kg),0) FROM packing_orders WHERE created_at > now() - interval '7 days')::text AS washing_loss_7d,
      (SELECT COALESCE(SUM(unaccounted_variance_kg),0) FROM packing_orders WHERE created_at > now() - interval '7 days')::text AS variance_7d,
      (SELECT COALESCE(SUM(production_cost_kes),0) FROM packing_orders WHERE created_at > now() - interval '7 days')::text AS cost_7d,
      (SELECT count(*)::int FROM packing_batches WHERE qa_status = 'PENDING_QA')::int AS pending_qa,
      (SELECT count(*)::int FROM packing_batches WHERE qa_status = 'QUARANTINED')::int AS quarantined,
      (SELECT count(*)::int FROM packing_batches WHERE qa_status = 'REJECTED')::int AS rejected_batches,
      (SELECT count(*)::int FROM packing_batches WHERE expiry_date::date <= CURRENT_DATE + 3 AND qa_status = 'PASSED')::int AS expiring_3d,
      (SELECT COALESCE(AVG(cold_room_temp_c),0) FROM packing_batches WHERE created_at > now() - interval '7 days')::text AS avg_cold_room_c,
      (SELECT COALESCE(AVG(intake_temp_c),0) FROM packing_orders WHERE created_at > now() - interval '7 days')::text AS avg_intake_c,
      (SELECT count(*)::int FROM harvest_batches WHERE status IN ('HARVESTED','IN_PACKHOUSE'))::int AS awaiting_intake;
  `);
}

export async function packingOrders(limit = 12) {
  return many<Record<string, string | number | null>>(sql`
    SELECT po.order_code AS "orderCode", hb.batch_number AS "harvestBatch", c.name AS crop,
           po.intake_weight_kg AS intake, po.graded_accepted_kg AS accepted,
           po.graded_rejected_kg AS rejected, po.washing_loss_kg AS washing,
           po.packed_output_kg AS packed, po.unaccounted_variance_kg AS variance,
           po.pack_format AS "packFormat", po.units_packed_count AS units,
           po.labour_count AS labour, po.shift_code AS shift, po.production_cost_kes AS cost,
           po.status, po.intake_temp_c AS "intakeTemp", u.full_name AS supervisor,
           po.created_at AS "createdAt"
    FROM packing_orders po
    LEFT JOIN harvest_batches hb ON hb.id = po.harvest_batch_id
    LEFT JOIN crop_catalog c ON c.id = po.crop_id
    LEFT JOIN users u ON u.id = po.supervisor_user_id
    ORDER BY po.created_at DESC
    LIMIT ${limit}::int;
  `);
}

export async function packingBatches(limit = 12) {
  return many<Record<string, string | number | null>>(sql`
    SELECT pb.packing_batch_code AS "batchCode", p.sku, p.name AS product, pb.grade,
           pb.net_weight_kg AS "netWeight", pb.cartons_count AS cartons,
           pb.cold_room_temp_c AS "coldRoomTemp", pb.qa_status AS "qaStatus",
           pb.packed_date AS "packedDate", pb.expiry_date AS "expiryDate",
           l.lot_number AS "lotNumber", l.quality_status AS "lotStatus"
    FROM packing_batches pb
    LEFT JOIN products p ON p.id = pb.finished_product_id
    LEFT JOIN inventory_lots l ON l.id = pb.inventory_lot_id
    ORDER BY pb.created_at DESC
    LIMIT ${limit}::int;
  `);
}

export async function packhouseYieldByCrop() {
  return many<{ name: string; intake: number; packed: number; rejected: number }>(sql`
    SELECT c.name,
           COALESCE(SUM(po.intake_weight_kg),0)::numeric AS intake,
           COALESCE(SUM(po.packed_output_kg),0)::numeric AS packed,
           COALESCE(SUM(po.graded_rejected_kg),0)::numeric AS rejected
    FROM packing_orders po
    JOIN crop_catalog c ON c.id = po.crop_id
    GROUP BY c.name
    ORDER BY intake DESC;
  `);
}

export async function packhouseDailyThroughput(days = 14) {
  return many<{ name: string; value: number }>(sql`
    SELECT to_char(created_at, 'DD Mon') AS name,
           COALESCE(SUM(packed_output_kg),0)::numeric AS value
    FROM packing_orders
    WHERE created_at > now() - (${days} || ' days')::interval
    GROUP BY to_char(created_at, 'DD Mon'), date_trunc('day', created_at)
    ORDER BY date_trunc('day', created_at);
  `);
}

/* ============================ QUALITY ============================ */

export async function qaKpis() {
  return one<Record<string, string | number>>(sql`
    SELECT
      (SELECT count(*)::int FROM quality_inspections WHERE inspected_at > now() - interval '30 days')::int AS inspections_30d,
      (SELECT count(*)::int FROM quality_inspections WHERE result = 'PASS' AND inspected_at > now() - interval '30 days')::int AS passed_30d,
      (SELECT count(*)::int FROM quality_inspections WHERE result = 'CONDITIONAL_PASS' AND inspected_at > now() - interval '30 days')::int AS conditional_30d,
      (SELECT count(*)::int FROM quality_inspections WHERE result = 'FAIL_QUARANTINE' AND inspected_at > now() - interval '30 days')::int AS failed_30d,
      (SELECT count(*)::int FROM quality_inspections WHERE quarantine_status = 'QUARANTINED')::int AS in_quarantine,
      (SELECT count(*)::int FROM nonconformities WHERE status != 'VERIFIED_CLOSED')::int AS open_ncr,
      (SELECT count(*)::int FROM nonconformities WHERE status != 'VERIFIED_CLOSED' AND severity = 'CRITICAL')::int AS critical_ncr,
      (SELECT count(*)::int FROM nonconformities WHERE status != 'VERIFIED_CLOSED' AND due_date::date < CURRENT_DATE)::int AS overdue_ncr,
      (SELECT COALESCE(AVG(defect_percent),0) FROM quality_inspections WHERE inspected_at > now() - interval '30 days')::text AS avg_defect_pct,
      (SELECT count(*)::int FROM quality_inspections
        WHERE measured_temp_c > max_allowed_temp_c AND inspected_at > now() - interval '30 days')::int AS temp_excursions,
      (SELECT count(*)::int FROM inventory_lots WHERE quality_status IN ('QUARANTINED','BLOCKED','EXPIRED'))::int AS held_lots;
  `);
}

export async function inspections(limit = 15) {
  return many<Record<string, string | number | boolean | null>>(sql`
    SELECT qi.inspection_code AS "inspectionCode", qi.stage, qi.sample_weight_kg AS sample,
           qi.measured_temp_c AS "measuredTemp", qi.max_allowed_temp_c AS "maxTemp",
           qi.moisture_status AS moisture, qi.pest_free_status AS "pestFree",
           qi.pesticide_residue_compliant AS "residueOk", qi.packaging_integrity AS packaging,
           qi.defect_percent AS defects, qi.result, qi.quarantine_status AS quarantine,
           qi.inspected_at AS "inspectedAt", qi.notes,
           COALESCE(pb.packing_batch_code, hb.batch_number, l.lot_number, '—') AS subject,
           u.full_name AS inspector, ru.full_name AS "releasedBy"
    FROM quality_inspections qi
    LEFT JOIN packing_batches pb ON pb.id = qi.packing_batch_id
    LEFT JOIN harvest_batches hb ON hb.id = qi.harvest_batch_id
    LEFT JOIN inventory_lots l ON l.id = qi.inventory_lot_id
    LEFT JOIN users u ON u.id = qi.inspector_user_id
    LEFT JOIN users ru ON ru.id = qi.released_by_user_id
    ORDER BY qi.inspected_at DESC
    LIMIT ${limit}::int;
  `);
}

export async function nonconformities(limit = 15) {
  return many<Record<string, string | number | null>>(sql`
    SELECT n.ncr_number AS "ncrNumber", n.severity, n.category, n.description,
           n.root_cause AS "rootCause", n.corrective_action AS "correctiveAction",
           n.preventive_action AS "preventiveAction", n.status, n.due_date AS "dueDate",
           n.closed_at AS "closedAt", u.full_name AS "assignedTo"
    FROM nonconformities n
    LEFT JOIN users u ON u.id = n.assigned_to_user_id
    ORDER BY (n.status = 'VERIFIED_CLOSED'), n.due_date::date
    LIMIT ${limit}::int;
  `);
}

export async function qaResultsTrend() {
  return many<{ name: string; pass: number; conditional: number; fail: number }>(sql`
    SELECT to_char(date_trunc('day', inspected_at), 'DD Mon') AS name,
           count(*) FILTER (WHERE result = 'PASS')::int AS pass,
           count(*) FILTER (WHERE result = 'CONDITIONAL_PASS')::int AS conditional,
           count(*) FILTER (WHERE result = 'FAIL_QUARANTINE')::int AS fail
    FROM quality_inspections
    WHERE inspected_at > now() - interval '14 days'
    GROUP BY date_trunc('day', inspected_at)
    ORDER BY date_trunc('day', inspected_at);
  `);
}

/* ============================ PROCUREMENT ============================ */

export async function procurementKpis() {
  return one<Record<string, string | number>>(sql`
    SELECT
      (SELECT count(*)::int FROM purchase_requisitions WHERE status = 'PENDING_APPROVAL')::int AS reqs_pending,
      (SELECT COALESCE(SUM(total_estimated_kes),0) FROM purchase_requisitions WHERE status = 'PENDING_APPROVAL')::text AS reqs_pending_value,
      (SELECT count(*)::int FROM purchase_requisitions WHERE status = 'APPROVED')::int AS reqs_approved,
      (SELECT count(*)::int FROM purchase_orders WHERE status IN ('APPROVED','ISSUED','PARTIALLY_RECEIVED'))::int AS pos_open,
      (SELECT COALESCE(SUM(total_amount_kes),0) FROM purchase_orders WHERE status IN ('APPROVED','ISSUED','PARTIALLY_RECEIVED'))::text AS pos_open_value,
      (SELECT count(*)::int FROM purchase_orders WHERE status = 'RECEIVED' AND created_at > now() - interval '30 days')::int AS pos_received_30d,
      (SELECT count(*)::int FROM supplier_invoices WHERE three_way_match_status != 'MATCHED')::int AS match_exceptions,
      (SELECT count(*)::int FROM supplier_invoices WHERE payment_status = 'UNPAID' AND due_date::date < CURRENT_DATE)::int AS overdue_invoices,
      (SELECT COALESCE(SUM(invoice_amount_kes),0) FROM supplier_invoices WHERE payment_status IN ('UNPAID','DISPUTED'))::text AS payables_value,
      (SELECT count(*)::int FROM suppliers WHERE qualification_status = 'APPROVED')::int AS active_suppliers,
      (SELECT count(*)::int FROM goods_receipts WHERE rejected_qty > 0 AND received_at > now() - interval '30 days')::int AS receipts_with_rejects;
  `);
}

export async function requisitions(limit = 12) {
  return many<Record<string, string | number | null>>(sql`
    SELECT pr.req_number AS "reqNumber", d.name AS department, p.name AS product, p.sku,
           pr.quantity, pr.estimated_unit_cost_kes AS "unitCost", pr.total_estimated_kes AS total,
           pr.justification, pr.status, u.full_name AS "requestedBy",
           au.full_name AS "approvedBy", pr.approved_at AS "approvedAt", pr.created_at AS "createdAt",
           (SELECT ar.request_code FROM approval_requests ar
             WHERE ar.entity_type = 'PURCHASE_REQUISITION' AND ar.entity_id = pr.id
             ORDER BY ar.id DESC LIMIT 1) AS "approvalCode"
    FROM purchase_requisitions pr
    JOIN departments d ON d.id = pr.department_id
    JOIN products p ON p.id = pr.product_id
    LEFT JOIN users u ON u.id = pr.requested_by_user_id
    LEFT JOIN users au ON au.id = pr.approved_by_user_id
    ORDER BY (pr.status = 'PENDING_APPROVAL') DESC, pr.created_at DESC
    LIMIT ${limit}::int;
  `);
}

export async function purchaseOrders(limit = 12) {
  return many<Record<string, string | number | null>>(sql`
    SELECT po.po_number AS "poNumber", s.name AS supplier, s.supplier_code AS "supplierCode",
           p.name AS product, po.ordered_qty AS ordered, po.received_qty AS received,
           po.unit_price_kes AS "unitPrice", po.total_amount_kes AS total,
           po.expected_delivery_date AS expected, po.status, u.full_name AS "createdBy"
    FROM purchase_orders po
    JOIN suppliers s ON s.id = po.supplier_id
    JOIN products p ON p.id = po.product_id
    LEFT JOIN users u ON u.id = po.created_by_user_id
    ORDER BY po.created_at DESC
    LIMIT ${limit}::int;
  `);
}

export async function supplierInvoices(limit = 12) {
  return many<Record<string, string | number | null>>(sql`
    SELECT si.invoice_number AS "invoiceNumber", s.name AS supplier, po.po_number AS "poNumber",
           si.invoice_amount_kes AS invoice, si.po_amount_kes AS po_amount,
           si.grn_amount_kes AS grn_amount, si.three_way_match_status AS "matchStatus",
           si.payment_status AS "paymentStatus", si.due_date AS "dueDate", si.paid_at AS "paidAt"
    FROM supplier_invoices si
    JOIN suppliers s ON s.id = si.supplier_id
    JOIN purchase_orders po ON po.id = si.purchase_order_id
    ORDER BY (si.payment_status = 'PAID'), si.due_date::date
    LIMIT ${limit}::int;
  `);
}

export async function spendBySupplier() {
  return many<{ name: string; value: number }>(sql`
    SELECT s.name, COALESCE(SUM(po.total_amount_kes),0)::numeric AS value
    FROM purchase_orders po
    JOIN suppliers s ON s.id = po.supplier_id
    WHERE po.status != 'CANCELLED'
    GROUP BY s.name
    ORDER BY value DESC
    LIMIT 8;
  `);
}

/* ============================ SALES & EXPORT ============================ */

export async function salesKpis() {
  return one<Record<string, string | number>>(sql`
    SELECT
      (SELECT count(*)::int FROM sales_orders WHERE status NOT IN ('PAID','CANCELLED','DELIVERED'))::int AS orders_open,
      (SELECT count(*)::int FROM sales_orders WHERE created_at > now() - interval '30 days')::int AS orders_30d,
      (SELECT COALESCE(SUM(total_kes_amount),0) FROM sales_orders WHERE created_at > now() - interval '30 days' AND status != 'CANCELLED')::text AS revenue_30d,
      (SELECT COALESCE(SUM(total_currency_amount),0) FROM sales_orders WHERE created_at > now() - interval '30 days' AND status != 'CANCELLED')::text AS revenue_eur_30d,
      (SELECT COALESCE(SUM(ordered_kg),0) FROM sales_orders WHERE created_at > now() - interval '30 days')::text AS ordered_kg_30d,
      (SELECT COALESCE(SUM(allocated_kg),0) FROM sales_orders WHERE created_at > now() - interval '30 days')::text AS allocated_kg_30d,
      (SELECT COALESCE(SUM(dispatched_kg),0) FROM sales_orders WHERE created_at > now() - interval '30 days')::text AS dispatched_kg_30d,
      (SELECT count(*)::int FROM sales_orders WHERE allocated_kg < ordered_kg AND status NOT IN ('CANCELLED','DELIVERED','PAID'))::int AS under_allocated,
      (SELECT count(*)::int FROM customers WHERE is_active)::int AS active_customers,
      (SELECT count(*)::int FROM export_documents WHERE status IN ('DRAFT','SUBMITTED'))::int AS docs_in_progress,
      (SELECT count(*)::int FROM export_documents WHERE expiry_date::date <= CURRENT_DATE + 7)::int AS docs_expiring,
      (SELECT COALESCE(SUM(total_kes_amount),0) FROM sales_orders WHERE payment_status != 'PAID' AND status != 'CANCELLED')::text AS receivables_open;
  `);
}

export async function salesOrders(limit = 15) {
  return many<Record<string, string | number | null>>(sql`
    SELECT so.order_number AS "orderNumber", c.name AS customer, c.country, c.buyer_type AS "buyerType",
           p.name AS product, p.sku, so.ordered_kg AS ordered, so.allocated_kg AS allocated,
           so.dispatched_kg AS dispatched, so.currency, so.unit_price AS "unitPrice",
           so.total_currency_amount AS "totalForeign", so.total_kes_amount AS "totalKes",
           so.requested_delivery_date AS "deliveryDate", so.status, so.payment_status AS "paymentStatus",
           pb.packing_batch_code AS "packingBatch", u.full_name AS "approvedBy"
    FROM sales_orders so
    JOIN customers c ON c.id = so.customer_id
    JOIN products p ON p.id = so.product_id
    LEFT JOIN packing_batches pb ON pb.id = so.packing_batch_id
    LEFT JOIN users u ON u.id = so.approved_by_user_id
    ORDER BY so.created_at DESC
    LIMIT ${limit}::int;
  `);
}

export async function revenueByMarket() {
  return many<{ name: string; value: number }>(sql`
    SELECT c.country AS name, COALESCE(SUM(so.total_kes_amount),0)::numeric AS value
    FROM sales_orders so
    JOIN customers c ON c.id = so.customer_id
    WHERE so.status != 'CANCELLED'
    GROUP BY c.country
    ORDER BY value DESC;
  `);
}

export async function revenueByCustomer() {
  return many<{ name: string; value: number }>(sql`
    SELECT c.name, COALESCE(SUM(so.total_kes_amount),0)::numeric AS value
    FROM sales_orders so
    JOIN customers c ON c.id = so.customer_id
    WHERE so.status != 'CANCELLED'
    GROUP BY c.name
    ORDER BY value DESC
    LIMIT 10;
  `);
}

export async function exportDocuments(limit = 15) {
  return many<Record<string, string | number | null>>(sql`
    SELECT ed.doc_number AS "docNumber", ed.doc_type AS "docType", ed.issuing_authority AS authority,
           ed.issue_date AS "issueDate", ed.expiry_date AS "expiryDate", ed.status, ed.notes,
           so.order_number AS "orderNumber", sh.shipment_code AS "shipmentCode",
           u.full_name AS "verifiedBy"
    FROM export_documents ed
    LEFT JOIN sales_orders so ON so.id = ed.sales_order_id
    LEFT JOIN shipments sh ON sh.id = ed.shipment_id
    LEFT JOIN users u ON u.id = ed.verified_by_user_id
    ORDER BY ed.issue_date::date DESC
    LIMIT ${limit}::int;
  `);
}

/* ============================ LOGISTICS ============================ */

export async function logisticsKpis() {
  return one<Record<string, string | number>>(sql`
    SELECT
      (SELECT count(*)::int FROM shipments WHERE dispatch_status IN ('PLANNED','PICK_PACK_VERIFIED','IN_TRANSIT_TO_JKIA'))::int AS active_shipments,
      (SELECT count(*)::int FROM shipments WHERE dispatch_status = 'AIRFREIGHT_DEPARTED')::int AS in_air,
      (SELECT count(*)::int FROM shipments WHERE dispatch_status = 'DELIVERED')::int AS delivered,
      (SELECT count(*)::int FROM shipments WHERE dispatch_status = 'EXCEPTION')::int AS exceptions,
      (SELECT COALESCE(SUM(dispatched_kg),0) FROM shipments WHERE dispatched_at > now() - interval '30 days')::text AS kg_30d,
      (SELECT COALESCE(SUM(transport_cost_kes),0) FROM shipments WHERE dispatched_at > now() - interval '30 days')::text AS cost_30d,
      (SELECT COALESCE(AVG(departure_temp_c),0) FROM shipments WHERE dispatched_at > now() - interval '30 days')::text AS avg_departure_c,
      (SELECT count(*)::int FROM shipments
        WHERE arrival_temp_c IS NOT NULL AND dispatched_at > now() - interval '30 days' AND arrival_temp_c > 8)::int AS temp_excursions,
      (SELECT count(*)::int FROM vehicles WHERE status = 'AVAILABLE')::int AS vehicles_available,
      (SELECT count(*)::int FROM vehicles WHERE status = 'IN_TRANSIT')::int AS vehicles_in_transit,
      (SELECT count(*)::int FROM vehicles WHERE status = 'MAINTENANCE')::int AS vehicles_down;
  `);
}

export async function shipments(limit = 15) {
  return many<Record<string, string | number | null>>(sql`
    SELECT sh.shipment_code AS "shipmentCode", so.order_number AS "orderNumber", c.name AS customer,
           c.destination_airport_code AS destination, v.registration_number AS vehicle,
           v.driver_name AS driver, sh.origin_location AS origin, sh.destination_location AS dest_location,
           sh.air_waybill_no AS awb, sh.airline_name AS airline, sh.dispatched_kg AS kg,
           sh.cartons_count AS cartons, sh.departure_temp_c AS "departureTemp",
           sh.arrival_temp_c AS "arrivalTemp", sh.transport_cost_kes AS cost,
           sh.dispatch_status AS status, sh.dispatched_at AS "dispatchedAt",
           sh.delivered_at AS "deliveredAt", sh.proof_of_delivery_ref AS pod,
           sh.delivery_recipient_name AS recipient
    FROM shipments sh
    LEFT JOIN sales_orders so ON so.id = sh.sales_order_id
    LEFT JOIN customers c ON c.id = so.customer_id
    LEFT JOIN vehicles v ON v.id = sh.vehicle_id
    ORDER BY sh.created_at DESC
    LIMIT ${limit}::int;
  `);
}

export async function fleet() {
  return many<Record<string, string | number | null>>(sql`
    SELECT v.registration_number AS registration, v.vehicle_type AS type, v.make_model AS model,
           v.reefer_temp_min_c AS "tempMin", v.reefer_temp_max_c AS "tempMax",
           v.driver_name AS driver, v.driver_phone AS phone, v.status, v.current_route AS route,
           (SELECT count(*)::int FROM shipments s WHERE s.vehicle_id = v.id AND s.dispatch_status = 'IN_TRANSIT_TO_JKIA')::int AS "activeLoads"
    FROM vehicles v
    ORDER BY v.status, v.registration_number;
  `);
}

export async function shipmentsByStatus() {
  return many<{ name: string; value: number }>(sql`
    SELECT dispatch_status AS name, count(*)::int AS value
    FROM shipments
    GROUP BY dispatch_status
    ORDER BY value DESC;
  `);
}

/* ============================ MAINTENANCE ============================ */

export async function maintenanceKpis() {
  return one<Record<string, string | number>>(sql`
    SELECT
      (SELECT count(*)::int FROM assets)::int AS assets_total,
      (SELECT COALESCE(SUM(purchase_cost_kes),0) FROM assets)::text AS asset_value,
      (SELECT count(*)::int FROM assets WHERE condition IN ('FAIR','NEEDS_REPAIR'))::int AS assets_degraded,
      (SELECT count(*)::int FROM assets WHERE next_service_due_date::date <= CURRENT_DATE + 7)::int AS service_due_7d,
      (SELECT count(*)::int FROM assets WHERE next_service_due_date::date < CURRENT_DATE)::int AS service_overdue,
      (SELECT count(*)::int FROM maintenance_work_orders WHERE status IN ('OPEN','IN_PROGRESS'))::int AS wos_open,
      (SELECT count(*)::int FROM maintenance_work_orders WHERE status IN ('OPEN','IN_PROGRESS') AND priority IN ('HIGH','CRITICAL'))::int AS wos_critical,
      (SELECT count(*)::int FROM maintenance_work_orders WHERE status = 'COMPLETED' AND completed_at > now() - interval '30 days')::int AS wos_done_30d,
      (SELECT COALESCE(SUM(COALESCE(labour_cost_kes,0) + COALESCE(parts_cost_kes,0)),0) FROM maintenance_work_orders WHERE completed_at > now() - interval '90 days')::text AS cost_90d,
      (SELECT COALESCE(SUM(downtime_hours),0) FROM maintenance_work_orders WHERE completed_at > now() - interval '90 days')::text AS downtime_90d,
      (SELECT count(*)::int FROM vehicles WHERE status = 'MAINTENANCE')::int AS vehicles_down;
  `);
}

export async function workOrders(limit = 15) {
  return many<Record<string, string | number | null>>(sql`
    SELECT wo.work_order_no AS "workOrderNo", a.asset_tag AS "assetTag", a.name AS asset,
           a.category AS "assetCategory", wo.maintenance_type AS "type", wo.priority,
           wo.issue_description AS issue, wo.technician_name AS technician,
           wo.labour_cost_kes AS labour, wo.parts_cost_kes AS parts,
           wo.downtime_hours AS downtime, wo.status, wo.scheduled_date AS scheduled,
           wo.completed_at AS "completedAt", p.name AS "sparePart"
    FROM maintenance_work_orders wo
    JOIN assets a ON a.id = wo.asset_id
    LEFT JOIN products p ON p.id = wo.spare_part_product_id
    ORDER BY (wo.status = 'COMPLETED'),
             CASE wo.priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
             wo.scheduled_date::date
    LIMIT ${limit}::int;
  `);
}

export async function assetsNeedingAttention(limit = 12) {
  return many<Record<string, string | number | null>>(sql`
    SELECT a.asset_tag AS "assetTag", a.name, a.category, a.location, a.condition,
           a.last_service_date AS "lastService", a.next_service_due_date AS "nextService",
           a.warranty_expiry_date AS warranty, a.downtime_hours_total AS downtime,
           a.purchase_cost_kes AS cost, d.name AS department, u.full_name AS custodian
    FROM assets a
    LEFT JOIN departments d ON d.id = a.department_id
    LEFT JOIN users u ON u.id = a.custodian_user_id
    WHERE a.condition IN ('FAIR','NEEDS_REPAIR')
       OR a.next_service_due_date::date <= CURRENT_DATE + 14
    ORDER BY a.next_service_due_date::date
    LIMIT ${limit}::int;
  `);
}

export async function maintenanceCostByType() {
  return many<{ name: string; value: number }>(sql`
    SELECT maintenance_type AS name,
           COALESCE(SUM(COALESCE(labour_cost_kes,0) + COALESCE(parts_cost_kes,0)),0)::numeric AS value
    FROM maintenance_work_orders
    GROUP BY maintenance_type
    ORDER BY value DESC;
  `);
}

/* ============================ EXECUTIVE ============================ */

export async function executiveKpis() {
  return one<Record<string, string | number>>(sql`
    SELECT
      (SELECT COALESCE(SUM(total_kes_amount),0) FROM sales_orders WHERE status NOT IN ('DRAFT','CANCELLED'))::text AS revenue_total,
      (SELECT COALESCE(SUM(total_kes_amount),0) FROM sales_orders WHERE status NOT IN ('DRAFT','CANCELLED') AND created_at > now() - interval '30 days')::text AS revenue_30d,
      (SELECT COALESCE(SUM(amount_kes + tax_kes),0) FROM expense_records WHERE payment_status IN ('APPROVED','PAID'))::text AS opex_total,
      (SELECT COALESCE(SUM(total_gross_kes),0) FROM payroll_runs)::text AS payroll_total,
      (SELECT COALESCE(SUM(physical_qty * unit_cost_kes),0) FROM inventory_lots)::text AS inventory_value,
      (SELECT COALESCE(balance_kes,0) FROM chart_of_accounts WHERE account_code = '1000')::text AS cash,
      (SELECT COALESCE(balance_kes,0) FROM chart_of_accounts WHERE account_code = '1100')::text AS receivables,
      (SELECT COALESCE(balance_kes,0) FROM chart_of_accounts WHERE account_code = '2000')::text AS payables,
      (SELECT count(*)::int FROM employee_profiles WHERE employment_status = 'ACTIVE')::int AS headcount,
      (SELECT COALESCE(SUM(harvested_weight_kg),0) FROM harvest_batches WHERE harvest_date::date >= CURRENT_DATE - 7)::text AS harvest_7d,
      (SELECT COALESCE(SUM(packed_output_kg),0) FROM packing_orders WHERE created_at > now() - interval '7 days')::text AS packed_7d,
      (SELECT COALESCE(SUM(dispatched_kg),0) FROM shipments WHERE dispatched_at > now() - interval '7 days')::text AS dispatched_7d,
      (SELECT count(*)::int FROM nonconformities WHERE status != 'VERIFIED_CLOSED')::int AS open_ncr,
      (SELECT count(*)::int FROM approval_requests WHERE status = 'PENDING')::int AS pending_approvals,
      (SELECT count(*)::int FROM shipments WHERE dispatch_status = 'EXCEPTION')::int AS logistics_exceptions,
      (SELECT count(*)::int FROM products WHERE is_active AND physical_stock <= reorder_level)::int AS stock_alerts;
  `);
}

export async function executiveValueChain() {
  return many<{ name: string; harvested: number; packed: number; dispatched: number }>(sql`
    SELECT to_char(d.day, 'DD Mon') AS name,
           COALESCE(h.kg, 0)::numeric AS harvested,
           COALESCE(p.kg, 0)::numeric AS packed,
           COALESCE(s.kg, 0)::numeric AS dispatched
    FROM (SELECT generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day')::date AS day) d
    LEFT JOIN (SELECT harvest_date::date AS day, SUM(harvested_weight_kg) AS kg FROM harvest_batches GROUP BY 1) h ON h.day = d.day
    LEFT JOIN (SELECT created_at::date AS day, SUM(packed_output_kg) AS kg FROM packing_orders GROUP BY 1) p ON p.day = d.day
    LEFT JOIN (SELECT dispatched_at::date AS day, SUM(dispatched_kg) AS kg FROM shipments WHERE dispatched_at IS NOT NULL GROUP BY 1) s ON s.day = d.day
    ORDER BY d.day;
  `);
}

export async function exportMarketMix() {
  return many<{ name: string; value: number }>(sql`
    SELECT c.country AS name, COALESCE(SUM(so.ordered_kg),0)::numeric AS value
    FROM sales_orders so
    JOIN customers c ON c.id = so.customer_id
    WHERE so.status != 'CANCELLED'
    GROUP BY c.country
    ORDER BY value DESC;
  `);
}

export async function departmentSpend() {
  return many<{ name: string; payroll: number; expenses: number }>(sql`
    SELECT d.name,
           COALESCE((SELECT SUM(ps.gross_pay_kes) FROM payslip_records ps
                     JOIN employee_profiles e ON e.id = ps.employee_id
                     WHERE e.department_id = d.id), 0)::numeric AS payroll,
           COALESCE((SELECT SUM(er.amount_kes + er.tax_kes) FROM expense_records er
                     WHERE er.department_id = d.id AND er.payment_status IN ('APPROVED','PAID')), 0)::numeric AS expenses
    FROM departments d
    ORDER BY payroll DESC;
  `);
}

/* ============================ WORKSPACES ============================ */

export async function myWorkspace(userId: number) {
  const db = await getDb();
  const me = (await db.execute(sql`
    SELECT e.id, e.employee_code AS "employeeCode", e.full_name AS "fullName", e.job_title AS "jobTitle",
           e.employment_type AS "employmentType", e.employment_status AS "employmentStatus",
           e.hire_date AS "hireDate", e.pay_frequency AS "payFrequency", d.name AS department,
           s.full_name AS supervisor
    FROM employee_profiles e
    JOIN departments d ON d.id = e.department_id
    LEFT JOIN users s ON s.id = e.supervisor_user_id
    WHERE e.user_id = ${userId}
    LIMIT 1;
  `)) as unknown as Rows<Record<string, string | number | null>>;
  const profile = me.rows[0] ?? null;
  const employeeId = profile ? Number(profile.id) : null;

  if (!employeeId) {
    return { profile: null, employeeId: null, balances: [], leave: [], attendance: [], payslips: [], overtime: [], tasks: [] };
  }

  const [balances, leave, attendance, payslips, overtime, tasks] = await Promise.all([
    many<Record<string, string | number | null>>(sql`
      SELECT lt.name AS "leaveType", lt.code, lb.entitled_days AS entitled, lb.used_days AS used,
             lb.pending_days AS pending, lb.remaining_days AS remaining, lt.statutory_basis AS basis
      FROM leave_balances lb JOIN leave_types lt ON lt.id = lb.leave_type_id
      WHERE lb.employee_id = ${employeeId} AND lb.year = EXTRACT(YEAR FROM CURRENT_DATE)::int
      ORDER BY lt.id;
    `),
    many<Record<string, string | number | null>>(sql`
      SELECT lr.request_number AS "requestNumber", lt.name AS "leaveType", lr.start_date AS "startDate",
             lr.end_date AS "endDate", lr.total_days AS "totalDays", lr.status,
             lr.review_comments AS "reviewComments", lr.created_at AS "createdAt"
      FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id
      WHERE lr.employee_id = ${employeeId}
      ORDER BY lr.created_at DESC LIMIT 12;
    `),
    many<Record<string, string | number | null>>(sql`
      SELECT attendance_date AS date, shift_id AS "shiftId", clock_in_at AS "clockIn",
             clock_out_at AS "clockOut", regular_hours AS regular, overtime_hours AS overtime,
             late_minutes AS late, status, timesheet_approved AS approved
      FROM attendance_records
      WHERE employee_id = ${employeeId}
      ORDER BY attendance_date::date DESC LIMIT 14;
    `),
    many<Record<string, string | number | null>>(sql`
      SELECT ps.payslip_number AS "payslipNumber", pr.period_month AS period, pr.pay_date AS "payDate",
             ps.basic_pay_kes AS basic, ps.overtime_pay_kes AS overtime, ps.gross_pay_kes AS gross,
             ps.paye_tax_kes AS paye, ps.nssf_employee_kes AS nssf, ps.shif_kes AS shif,
             ps.housing_levy_employee_kes AS housing, ps.net_pay_kes AS net,
             ps.payment_status AS "paymentStatus", pr.status AS "runStatus"
      FROM payslip_records ps JOIN payroll_runs pr ON pr.id = ps.payroll_run_id
      WHERE ps.employee_id = ${employeeId}
      ORDER BY pr.period_month DESC LIMIT 12;
    `),
    many<Record<string, string | number | null>>(sql`
      SELECT work_date AS date, requested_hours AS hours, rate_multiplier AS multiplier,
             reason, status FROM overtime_requests
      WHERE employee_id = ${employeeId}
      ORDER BY work_date::date DESC LIMIT 10;
    `),
    many<Record<string, string | number | null>>(sql`
      SELECT ar.request_code AS code, ar.title, ar.module, ar.status, ar.submitted_at AS "submittedAt"
      FROM approval_requests ar
      JOIN leave_requests lr ON lr.id = ar.entity_id AND ar.entity_type = 'LEAVE_REQUEST'
      WHERE lr.employee_id = ${employeeId}
      ORDER BY ar.submitted_at DESC LIMIT 10;
    `),
  ]);

  return { profile, employeeId, balances, leave, attendance, payslips, overtime, tasks };
}

export async function teamWorkspace(userId: number) {
  const db = await getDb();
  const team = (await db.execute(sql`
    SELECT e.id, e.employee_code AS "employeeCode", e.full_name AS "fullName", e.job_title AS "jobTitle",
           e.employment_status AS "employmentStatus",
           (SELECT ar.status FROM attendance_records ar WHERE ar.employee_id = e.id AND ar.attendance_date::date = CURRENT_DATE LIMIT 1) AS "todayStatus",
           (SELECT count(*)::int FROM leave_requests lr WHERE lr.employee_id = e.id AND lr.status = 'PENDING')::int AS "pendingLeave",
           (SELECT count(*)::int FROM overtime_requests o WHERE o.employee_id = e.id AND o.status = 'PENDING')::int AS "pendingOvertime"
    FROM employee_profiles e
    WHERE e.supervisor_user_id = ${userId}
    ORDER BY e.full_name;
  `)) as unknown as Rows<Record<string, string | number | null>>;
  return team.rows;
}

export async function auditTrail(limit = 60, actorEmail?: string, module?: string) {
  const db = await getDb();
  const res = (await db.execute(sql`
    SELECT al.created_at AS "createdAt", al.actor_email AS actor, al.actor_role AS "actorRole",
           al.action, al.module,
           al.entity_type AS "entityType", al.entity_id AS "entityId", al.summary,
           al.ip_address AS ip
    FROM audit_logs al
    WHERE ${actorEmail ? sql`al.actor_email = ${actorEmail}` : sql`TRUE`}
      AND ${module ? sql`al.module = ${module}` : sql`TRUE`}
    ORDER BY al.created_at DESC
    LIMIT ${limit}::int;
  `)) as unknown as Rows<Record<string, string | null>>;
  return res.rows;
}

export async function auditModules() {
  return many<{ name: string; value: number }>(sql`
    SELECT module AS name, count(*)::int AS value FROM audit_logs GROUP BY module ORDER BY value DESC;
  `);
}
