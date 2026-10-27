CREATE TABLE "approval_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_code" text NOT NULL,
	"module" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"title" text NOT NULL,
	"amount_kes" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"submitted_by_user_id" integer NOT NULL,
	"assigned_role_code" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"decided_by_user_id" integer,
	"decision_comments" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_tag" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"department_id" integer,
	"custodian_user_id" integer,
	"purchase_date" text NOT NULL,
	"purchase_cost_kes" numeric(14, 2) NOT NULL,
	"warranty_expiry_date" text NOT NULL,
	"condition" text DEFAULT 'GOOD' NOT NULL,
	"last_service_date" text NOT NULL,
	"next_service_due_date" text NOT NULL,
	"downtime_hours_total" numeric(8, 2) DEFAULT '0.00' NOT NULL,
	"location" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"attendance_date" text NOT NULL,
	"shift_id" integer,
	"clock_in_at" text,
	"clock_out_at" text,
	"regular_hours" numeric(5, 2) DEFAULT '8.00' NOT NULL,
	"overtime_hours" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"late_minutes" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'PRESENT' NOT NULL,
	"timesheet_approved" boolean DEFAULT false NOT NULL,
	"approved_by_user_id" integer,
	"correction_reason" text,
	"corrected_by_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" integer,
	"actor_email" text NOT NULL,
	"actor_role" text NOT NULL,
	"action" text NOT NULL,
	"module" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"summary" text NOT NULL,
	"before_state_json" text,
	"after_state_json" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"vacancy_id" integer NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"stage" text DEFAULT 'APPLIED' NOT NULL,
	"interview_date" text,
	"interviewer_notes" text,
	"onboarding_checklist_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chart_of_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_code" text NOT NULL,
	"account_name" text NOT NULL,
	"account_type" text NOT NULL,
	"currency" text DEFAULT 'KES' NOT NULL,
	"balance_kes" numeric(16, 2) DEFAULT '0.00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"member_role" text DEFAULT 'PARTICIPANT' NOT NULL,
	"can_send" boolean DEFAULT true NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"conversation_type" text DEFAULT 'DIRECT_PRIVATE' NOT NULL,
	"target_dashboard_code" text,
	"history_sharing_policy" text DEFAULT 'FROM_JOIN_TIME' NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crop_catalog" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"variety" text NOT NULL,
	"scientific_name" text NOT NULL,
	"category" text DEFAULT 'Culinary Fresh Herb' NOT NULL,
	"cycle_days" integer NOT NULL,
	"expected_yield_kg_per_ha" numeric(12, 2) NOT NULL,
	"cold_chain_min_c" numeric(5, 2) NOT NULL,
	"cold_chain_max_c" numeric(5, 2) NOT NULL,
	"shelf_life_days" integer NOT NULL,
	"hs_code" text NOT NULL,
	"packaging_specs" text NOT NULL,
	"weekly_target_kg" numeric(12, 2) NOT NULL,
	"image_url" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crop_cycles" (
	"id" serial PRIMARY KEY NOT NULL,
	"cycle_code" text NOT NULL,
	"field_id" integer NOT NULL,
	"crop_id" integer NOT NULL,
	"planting_date" text NOT NULL,
	"expected_harvest_date" text NOT NULL,
	"actual_end_date" text,
	"planted_area_ha" numeric(10, 2) NOT NULL,
	"seed_lot_number" text NOT NULL,
	"seed_quantity_kg" numeric(10, 2) NOT NULL,
	"expected_yield_kg" numeric(12, 2) NOT NULL,
	"actual_harvested_kg" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"wastage_kg" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"production_cost_kes" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"status" text DEFAULT 'GROWING' NOT NULL,
	"supervisor_user_id" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_code" text NOT NULL,
	"name" text NOT NULL,
	"buyer_type" text NOT NULL,
	"country" text NOT NULL,
	"destination_airport_code" text NOT NULL,
	"contact_person" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"credit_limit_eur" numeric(14, 2) NOT NULL,
	"incoterms" text DEFAULT 'CIP' NOT NULL,
	"cold_chain_spec_c" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"cost_center_code" text NOT NULL,
	"budget_allocated_kes" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"manager_user_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"doc_code" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"original_filename" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"checksum_sha256" text NOT NULL,
	"uploaded_by_user_id" integer NOT NULL,
	"department_id" integer,
	"conversation_id" integer,
	"is_confidential" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_code" text NOT NULL,
	"user_id" integer,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"department_id" integer NOT NULL,
	"job_title" text NOT NULL,
	"employment_type" text NOT NULL,
	"employment_status" text DEFAULT 'ACTIVE' NOT NULL,
	"gender" text NOT NULL,
	"date_of_birth" text NOT NULL,
	"hire_date" text NOT NULL,
	"contract_end_date" text,
	"supervisor_user_id" integer,
	"basic_salary_kes" numeric(14, 2) NOT NULL,
	"pay_frequency" text DEFAULT 'MONTHLY' NOT NULL,
	"national_id_number" text NOT NULL,
	"kra_pin" text NOT NULL,
	"nssf_number" text NOT NULL,
	"shif_number" text NOT NULL,
	"bank_name" text NOT NULL,
	"bank_account_number" text NOT NULL,
	"emergency_contact_name" text NOT NULL,
	"emergency_contact_phone" text NOT NULL,
	"qualifications" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"expense_number" text NOT NULL,
	"department_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"category" text NOT NULL,
	"vendor_name" text NOT NULL,
	"description" text NOT NULL,
	"amount_kes" numeric(14, 2) NOT NULL,
	"tax_kes" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"expense_date" text NOT NULL,
	"payment_status" text DEFAULT 'PENDING_APPROVAL' NOT NULL,
	"submitted_by_user_id" integer,
	"approved_by_user_id" integer,
	"payment_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"doc_number" text NOT NULL,
	"sales_order_id" integer NOT NULL,
	"shipment_id" integer,
	"doc_type" text NOT NULL,
	"issuing_authority" text NOT NULL,
	"issue_date" text NOT NULL,
	"expiry_date" text NOT NULL,
	"status" text DEFAULT 'VERIFIED' NOT NULL,
	"verified_by_user_id" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "farms" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"county" text NOT NULL,
	"sub_county" text NOT NULL,
	"ward" text NOT NULL,
	"gps_coordinates" text NOT NULL,
	"total_area_hectares" numeric(10, 2) NOT NULL,
	"certification_global_gap" text NOT NULL,
	"certification_grasp" text NOT NULL,
	"certification_smeta" text NOT NULL,
	"manager_user_id" integer,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"crop_cycle_id" integer NOT NULL,
	"field_id" integer NOT NULL,
	"activity_type" text NOT NULL,
	"activity_date" text NOT NULL,
	"input_name" text,
	"input_lot_number" text,
	"input_quantity" numeric(12, 3),
	"input_unit" text,
	"phi_days" integer DEFAULT 0 NOT NULL,
	"labour_count" integer DEFAULT 1 NOT NULL,
	"labour_hours" numeric(8, 2) DEFAULT '8.00' NOT NULL,
	"cost_kes" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"pest_or_disease_finding" text,
	"recorded_by_user_id" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"farm_id" integer NOT NULL,
	"field_code" text NOT NULL,
	"name" text NOT NULL,
	"field_type" text NOT NULL,
	"area_hectares" numeric(10, 2) NOT NULL,
	"soil_type" text NOT NULL,
	"irrigation_type" text NOT NULL,
	"gps_coordinates" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goods_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"grn_number" text NOT NULL,
	"purchase_order_id" integer NOT NULL,
	"supplier_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"lot_created_id" integer,
	"received_qty" numeric(12, 2) NOT NULL,
	"accepted_qty" numeric(12, 2) NOT NULL,
	"rejected_qty" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"delivery_note_ref" text NOT NULL,
	"inspection_notes" text,
	"received_by_user_id" integer,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "harvest_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_number" text NOT NULL,
	"crop_cycle_id" integer NOT NULL,
	"field_id" integer NOT NULL,
	"crop_id" integer NOT NULL,
	"harvest_date" text NOT NULL,
	"harvested_weight_kg" numeric(12, 2) NOT NULL,
	"rejected_field_weight_kg" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"net_transferred_kg" numeric(12, 2) NOT NULL,
	"crates_count" integer DEFAULT 10 NOT NULL,
	"field_temp_c" numeric(5, 2) NOT NULL,
	"destination" text DEFAULT 'PACKHOUSE' NOT NULL,
	"status" text DEFAULT 'IN_PACKHOUSE' NOT NULL,
	"harvested_by_user_id" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"integration_code" text NOT NULL,
	"name" text NOT NULL,
	"mode" text DEFAULT 'SANDBOX' NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"config_summary_json" text NOT NULL,
	"last_tested_at" timestamp with time zone,
	"status_message" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_lots" (
	"id" serial PRIMARY KEY NOT NULL,
	"lot_number" text NOT NULL,
	"product_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"bin_code" text NOT NULL,
	"harvest_batch_id" integer,
	"supplier_id" integer,
	"physical_qty" numeric(14, 3) NOT NULL,
	"reserved_qty" numeric(14, 3) DEFAULT '0.000' NOT NULL,
	"available_qty" numeric(14, 3) NOT NULL,
	"unit_cost_kes" numeric(14, 2) NOT NULL,
	"received_date" text NOT NULL,
	"expiry_date" text,
	"quality_status" text DEFAULT 'AVAILABLE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"role_code" text NOT NULL,
	"department_id" integer,
	"token_hash" text NOT NULL,
	"invited_by_user_id" integer,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_number" text NOT NULL,
	"entry_date" text NOT NULL,
	"period_code" text NOT NULL,
	"description" text NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"total_debit_kes" numeric(16, 2) NOT NULL,
	"total_credit_kes" numeric(16, 2) NOT NULL,
	"status" text DEFAULT 'POSTED' NOT NULL,
	"created_by_user_id" integer,
	"approved_by_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"journal_entry_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"cost_center_code" text NOT NULL,
	"debit_kes" numeric(16, 2) DEFAULT '0.00' NOT NULL,
	"credit_kes" numeric(16, 2) DEFAULT '0.00' NOT NULL,
	"memo" text
);
--> statement-breakpoint
CREATE TABLE "leave_balances" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"leave_type_id" integer NOT NULL,
	"year" integer NOT NULL,
	"entitled_days" numeric(6, 2) NOT NULL,
	"used_days" numeric(6, 2) DEFAULT '0.00' NOT NULL,
	"pending_days" numeric(6, 2) DEFAULT '0.00' NOT NULL,
	"remaining_days" numeric(6, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_number" text NOT NULL,
	"employee_id" integer NOT NULL,
	"leave_type_id" integer NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"total_days" numeric(6, 2) NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"reviewed_by_user_id" integer,
	"review_comments" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"default_annual_days" integer NOT NULL,
	"is_paid" boolean DEFAULT true NOT NULL,
	"statutory_basis" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_work_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_order_no" text NOT NULL,
	"asset_id" integer NOT NULL,
	"maintenance_type" text NOT NULL,
	"priority" text DEFAULT 'MEDIUM' NOT NULL,
	"issue_description" text NOT NULL,
	"spare_part_product_id" integer,
	"spare_part_qty_used" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"labour_cost_kes" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"parts_cost_kes" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"downtime_hours" numeric(8, 2) DEFAULT '0.00' NOT NULL,
	"technician_name" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"scheduled_date" text NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"conversation_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"delivered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"sender_user_id" integer NOT NULL,
	"body" text NOT NULL,
	"message_type" text DEFAULT 'TEXT' NOT NULL,
	"attachment_doc_id" integer,
	"attachment_file_name" text,
	"is_edited" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nonconformities" (
	"id" serial PRIMARY KEY NOT NULL,
	"ncr_number" text NOT NULL,
	"inspection_id" integer,
	"severity" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"root_cause" text NOT NULL,
	"corrective_action" text NOT NULL,
	"preventive_action" text NOT NULL,
	"assigned_to_user_id" integer,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"due_date" text NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"link_url" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "overtime_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"work_date" text NOT NULL,
	"requested_hours" numeric(5, 2) NOT NULL,
	"reason" text NOT NULL,
	"rate_multiplier" numeric(4, 2) DEFAULT '1.50' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"approved_by_user_id" integer,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packing_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"packing_batch_code" text NOT NULL,
	"packing_order_id" integer NOT NULL,
	"harvest_batch_id" integer NOT NULL,
	"finished_product_id" integer NOT NULL,
	"inventory_lot_id" integer,
	"grade" text DEFAULT 'CLASS_I_EXPORT' NOT NULL,
	"net_weight_kg" numeric(12, 2) NOT NULL,
	"cartons_count" integer NOT NULL,
	"cold_room_temp_c" numeric(5, 2) NOT NULL,
	"qa_status" text DEFAULT 'PASSED' NOT NULL,
	"packed_date" text NOT NULL,
	"expiry_date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packing_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_code" text NOT NULL,
	"harvest_batch_id" integer NOT NULL,
	"crop_id" integer NOT NULL,
	"target_product_id" integer NOT NULL,
	"intake_weight_kg" numeric(12, 2) NOT NULL,
	"intake_temp_c" numeric(5, 2) NOT NULL,
	"graded_accepted_kg" numeric(12, 2) NOT NULL,
	"graded_rejected_kg" numeric(12, 2) NOT NULL,
	"washing_loss_kg" numeric(12, 2) NOT NULL,
	"packed_output_kg" numeric(12, 2) NOT NULL,
	"unaccounted_variance_kg" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"pack_format" text NOT NULL,
	"units_packed_count" integer NOT NULL,
	"packaging_product_id" integer,
	"packaging_qty_used" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"labour_count" integer DEFAULT 18 NOT NULL,
	"shift_code" text DEFAULT 'SHIFT-DAY' NOT NULL,
	"production_cost_kes" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"status" text DEFAULT 'COMPLETED' NOT NULL,
	"supervisor_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_code" text NOT NULL,
	"period_month" text NOT NULL,
	"pay_date" text NOT NULL,
	"statutory_version_code" text NOT NULL,
	"employee_count" integer NOT NULL,
	"total_gross_kes" numeric(16, 2) NOT NULL,
	"total_paye_kes" numeric(16, 2) NOT NULL,
	"total_nssf_employee_kes" numeric(16, 2) NOT NULL,
	"total_shif_kes" numeric(16, 2) NOT NULL,
	"total_housing_levy_kes" numeric(16, 2) NOT NULL,
	"total_other_deductions_kes" numeric(16, 2) NOT NULL,
	"total_net_pay_kes" numeric(16, 2) NOT NULL,
	"status" text DEFAULT 'APPROVED' NOT NULL,
	"prepared_by_user_id" integer,
	"approved_by_user_id" integer,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payslip_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"payslip_number" text NOT NULL,
	"payroll_run_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"period_month" text NOT NULL,
	"basic_pay_kes" numeric(14, 2) NOT NULL,
	"overtime_pay_kes" numeric(14, 2) NOT NULL,
	"allowances_kes" numeric(14, 2) NOT NULL,
	"gross_pay_kes" numeric(14, 2) NOT NULL,
	"nssf_employee_kes" numeric(14, 2) NOT NULL,
	"nssf_employer_kes" numeric(14, 2) NOT NULL,
	"shif_kes" numeric(14, 2) NOT NULL,
	"housing_levy_employee_kes" numeric(14, 2) NOT NULL,
	"housing_levy_employer_kes" numeric(14, 2) NOT NULL,
	"taxable_pay_kes" numeric(14, 2) NOT NULL,
	"paye_before_relief_kes" numeric(14, 2) NOT NULL,
	"personal_relief_kes" numeric(14, 2) NOT NULL,
	"paye_tax_kes" numeric(14, 2) NOT NULL,
	"other_deductions_kes" numeric(14, 2) NOT NULL,
	"net_pay_kes" numeric(14, 2) NOT NULL,
	"payment_status" text DEFAULT 'PAID' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"review_period" text NOT NULL,
	"reviewer_user_id" integer,
	"kpi_score" numeric(5, 2) NOT NULL,
	"rating" text NOT NULL,
	"objectives_summary" text NOT NULL,
	"supervisor_assessment" text NOT NULL,
	"development_plan" text NOT NULL,
	"status" text DEFAULT 'FINALIZED' NOT NULL,
	"review_date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"module" text NOT NULL,
	"action" text NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category_type" text NOT NULL,
	"costing_method" text DEFAULT 'FIFO' NOT NULL,
	"requires_lot_tracking" boolean DEFAULT true NOT NULL,
	"requires_expiry_date" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"barcode" text NOT NULL,
	"name" text NOT NULL,
	"category_id" integer NOT NULL,
	"uom_code" text NOT NULL,
	"unit_cost_kes" numeric(14, 2) NOT NULL,
	"selling_price_eur" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"reorder_level" numeric(12, 2) NOT NULL,
	"safety_stock_level" numeric(12, 2) NOT NULL,
	"physical_stock" numeric(14, 3) DEFAULT '0.000' NOT NULL,
	"reserved_stock" numeric(14, 3) DEFAULT '0.000' NOT NULL,
	"available_stock" numeric(14, 3) DEFAULT '0.000' NOT NULL,
	"crop_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_number" text NOT NULL,
	"requisition_id" integer,
	"supplier_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"ordered_qty" numeric(12, 2) NOT NULL,
	"received_qty" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"unit_price_kes" numeric(14, 2) NOT NULL,
	"total_amount_kes" numeric(14, 2) NOT NULL,
	"expected_delivery_date" text NOT NULL,
	"status" text DEFAULT 'APPROVED' NOT NULL,
	"created_by_user_id" integer,
	"approved_by_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_requisitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"req_number" text NOT NULL,
	"department_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"estimated_unit_cost_kes" numeric(14, 2) NOT NULL,
	"total_estimated_kes" numeric(14, 2) NOT NULL,
	"justification" text NOT NULL,
	"status" text DEFAULT 'PENDING_APPROVAL' NOT NULL,
	"requested_by_user_id" integer,
	"approved_by_user_id" integer,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quality_inspections" (
	"id" serial PRIMARY KEY NOT NULL,
	"inspection_code" text NOT NULL,
	"stage" text NOT NULL,
	"harvest_batch_id" integer,
	"packing_batch_id" integer,
	"inventory_lot_id" integer,
	"sample_weight_kg" numeric(10, 2) NOT NULL,
	"measured_temp_c" numeric(5, 2) NOT NULL,
	"max_allowed_temp_c" numeric(5, 2) NOT NULL,
	"moisture_status" text DEFAULT 'OPTIMAL' NOT NULL,
	"pest_free_status" boolean DEFAULT true NOT NULL,
	"pesticide_residue_compliant" boolean DEFAULT true NOT NULL,
	"packaging_integrity" text DEFAULT 'VERIFIED' NOT NULL,
	"defect_percent" numeric(5, 2) NOT NULL,
	"result" text NOT NULL,
	"quarantine_status" text DEFAULT 'NONE' NOT NULL,
	"inspector_user_id" integer,
	"released_by_user_id" integer,
	"released_at" timestamp with time zone,
	"notes" text,
	"inspected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recruitment_vacancies" (
	"id" serial PRIMARY KEY NOT NULL,
	"vacancy_code" text NOT NULL,
	"title" text NOT NULL,
	"department_id" integer NOT NULL,
	"employment_type" text NOT NULL,
	"positions_count" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"closing_date" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"default_dashboard" text NOT NULL,
	"is_system_role" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"customer_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"packing_batch_id" integer,
	"ordered_kg" numeric(12, 2) NOT NULL,
	"allocated_kg" numeric(12, 2) NOT NULL,
	"dispatched_kg" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"exchange_rate_to_kes" numeric(12, 4) NOT NULL,
	"total_currency_amount" numeric(14, 2) NOT NULL,
	"total_kes_amount" numeric(16, 2) NOT NULL,
	"requested_delivery_date" text NOT NULL,
	"status" text DEFAULT 'STOCK_RESERVED' NOT NULL,
	"payment_status" text DEFAULT 'UNPAID' NOT NULL,
	"approved_by_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"event_type" text NOT NULL,
	"severity" text DEFAULT 'INFO' NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"description" text NOT NULL,
	"metadata_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" integer NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"break_minutes" integer DEFAULT 60 NOT NULL,
	"standard_hours" numeric(5, 2) NOT NULL,
	"department_id" integer
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" serial PRIMARY KEY NOT NULL,
	"shipment_code" text NOT NULL,
	"sales_order_id" integer NOT NULL,
	"vehicle_id" integer,
	"packing_batch_id" integer,
	"origin_location" text NOT NULL,
	"destination_location" text NOT NULL,
	"air_waybill_no" text,
	"airline_name" text,
	"dispatched_kg" numeric(12, 2) NOT NULL,
	"cartons_count" integer NOT NULL,
	"departure_temp_c" numeric(5, 2) NOT NULL,
	"arrival_temp_c" numeric(5, 2),
	"transport_cost_kes" numeric(12, 2) NOT NULL,
	"dispatch_status" text DEFAULT 'PLANNED' NOT NULL,
	"dispatched_by_user_id" integer,
	"dispatched_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"proof_of_delivery_ref" text,
	"delivery_recipient_name" text,
	"delivery_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statutory_rule_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"version_code" text NOT NULL,
	"country_code" text DEFAULT 'KE' NOT NULL,
	"effective_from" text NOT NULL,
	"effective_to" text,
	"personal_relief_kes" numeric(10, 2) NOT NULL,
	"shif_rate_percent" numeric(6, 4) NOT NULL,
	"ahl_employee_rate_percent" numeric(6, 4) NOT NULL,
	"ahl_employer_rate_percent" numeric(6, 4) NOT NULL,
	"nssf_tier1_limit_kes" numeric(12, 2) NOT NULL,
	"nssf_tier2_limit_kes" numeric(12, 2) NOT NULL,
	"nssf_rate_percent" numeric(6, 4) NOT NULL,
	"paye_bands_json" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"adjustment_number" text NOT NULL,
	"product_id" integer NOT NULL,
	"lot_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"system_qty" numeric(14, 3) NOT NULL,
	"counted_qty" numeric(14, 3) NOT NULL,
	"variance_qty" numeric(14, 3) NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'PENDING_APPROVAL' NOT NULL,
	"requested_by_user_id" integer,
	"approved_by_user_id" integer,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"movement_number" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"movement_type" text NOT NULL,
	"product_id" integer NOT NULL,
	"lot_id" integer,
	"from_warehouse_id" integer,
	"to_warehouse_id" integer,
	"quantity" numeric(14, 3) NOT NULL,
	"uom_code" text NOT NULL,
	"unit_cost_kes" numeric(14, 2) NOT NULL,
	"total_cost_kes" numeric(14, 2) NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"reason" text NOT NULL,
	"performed_by_user_id" integer,
	"approved_by_user_id" integer,
	"reversal_of_movement_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_reservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"reservation_number" text NOT NULL,
	"product_id" integer NOT NULL,
	"lot_id" integer NOT NULL,
	"sales_order_id" integer,
	"reserved_qty" numeric(14, 3) NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"reserved_by_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storage_locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"warehouse_id" integer NOT NULL,
	"bin_code" text NOT NULL,
	"zone" text NOT NULL,
	"max_capacity_kg" numeric(12, 2) NOT NULL,
	"current_status" text DEFAULT 'ACTIVE' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"supplier_id" integer NOT NULL,
	"purchase_order_id" integer NOT NULL,
	"grn_id" integer,
	"invoice_amount_kes" numeric(14, 2) NOT NULL,
	"po_amount_kes" numeric(14, 2) NOT NULL,
	"grn_amount_kes" numeric(14, 2) NOT NULL,
	"three_way_match_status" text DEFAULT 'MATCHED' NOT NULL,
	"payment_status" text DEFAULT 'UNPAID' NOT NULL,
	"due_date" text NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"contact_person" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"kra_pin" text NOT NULL,
	"country" text DEFAULT 'Kenya' NOT NULL,
	"payment_terms_days" integer DEFAULT 30 NOT NULL,
	"qualification_status" text DEFAULT 'APPROVED' NOT NULL,
	"rating" numeric(3, 2) DEFAULT '4.80' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"updated_by_user_id" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"program_name" text NOT NULL,
	"category" text NOT NULL,
	"trainer_name" text NOT NULL,
	"training_date" text NOT NULL,
	"expiry_date" text,
	"employee_id" integer NOT NULL,
	"completion_status" text DEFAULT 'COMPLETED' NOT NULL,
	"certificate_number" text,
	"score_percent" integer DEFAULT 95 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_conversions" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_uom_code" text NOT NULL,
	"to_uom_code" text NOT NULL,
	"multiplier" numeric(14, 6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units_of_measure" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"precision_decimals" integer DEFAULT 2 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"assigned_by" integer,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"department_id" integer,
	"primary_role_code" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"password_reset_token_hash" text,
	"password_reset_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"registration_number" text NOT NULL,
	"vehicle_type" text NOT NULL,
	"make_model" text NOT NULL,
	"reefer_temp_min_c" numeric(5, 2) NOT NULL,
	"driver_name" text NOT NULL,
	"driver_phone" text NOT NULL,
	"driver_license_no" text NOT NULL,
	"status" text DEFAULT 'AVAILABLE' NOT NULL,
	"current_route" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"warehouse_type" text NOT NULL,
	"temperature_range_c" text NOT NULL,
	"capacity_kg" numeric(14, 2) NOT NULL,
	"manager_user_id" integer,
	"location" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_custodian_user_id_users_id_fk" FOREIGN KEY ("custodian_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_employee_profiles_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_corrected_by_user_id_users_id_fk" FOREIGN KEY ("corrected_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_vacancy_id_recruitment_vacancies_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."recruitment_vacancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crop_cycles" ADD CONSTRAINT "crop_cycles_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crop_cycles" ADD CONSTRAINT "crop_cycles_crop_id_crop_catalog_id_fk" FOREIGN KEY ("crop_id") REFERENCES "public"."crop_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crop_cycles" ADD CONSTRAINT "crop_cycles_supervisor_user_id_users_id_fk" FOREIGN KEY ("supervisor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_records" ADD CONSTRAINT "document_records_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_records" ADD CONSTRAINT "document_records_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_records" ADD CONSTRAINT "document_records_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_supervisor_user_id_users_id_fk" FOREIGN KEY ("supervisor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_records" ADD CONSTRAINT "expense_records_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_records" ADD CONSTRAINT "expense_records_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_records" ADD CONSTRAINT "expense_records_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_records" ADD CONSTRAINT "expense_records_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_documents" ADD CONSTRAINT "export_documents_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_documents" ADD CONSTRAINT "export_documents_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_documents" ADD CONSTRAINT "export_documents_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farms" ADD CONSTRAINT "farms_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_activities" ADD CONSTRAINT "field_activities_crop_cycle_id_crop_cycles_id_fk" FOREIGN KEY ("crop_cycle_id") REFERENCES "public"."crop_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_activities" ADD CONSTRAINT "field_activities_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_activities" ADD CONSTRAINT "field_activities_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_lot_created_id_inventory_lots_id_fk" FOREIGN KEY ("lot_created_id") REFERENCES "public"."inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_received_by_user_id_users_id_fk" FOREIGN KEY ("received_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvest_batches" ADD CONSTRAINT "harvest_batches_crop_cycle_id_crop_cycles_id_fk" FOREIGN KEY ("crop_cycle_id") REFERENCES "public"."crop_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvest_batches" ADD CONSTRAINT "harvest_batches_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvest_batches" ADD CONSTRAINT "harvest_batches_crop_id_crop_catalog_id_fk" FOREIGN KEY ("crop_id") REFERENCES "public"."crop_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvest_batches" ADD CONSTRAINT "harvest_batches_harvested_by_user_id_users_id_fk" FOREIGN KEY ("harvested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_harvest_batch_id_harvest_batches_id_fk" FOREIGN KEY ("harvest_batch_id") REFERENCES "public"."harvest_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_employee_profiles_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_employee_profiles_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_work_orders" ADD CONSTRAINT "maintenance_work_orders_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_work_orders" ADD CONSTRAINT "maintenance_work_orders_spare_part_product_id_products_id_fk" FOREIGN KEY ("spare_part_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_receipts" ADD CONSTRAINT "message_receipts_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_receipts" ADD CONSTRAINT "message_receipts_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_receipts" ADD CONSTRAINT "message_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nonconformities" ADD CONSTRAINT "nonconformities_inspection_id_quality_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."quality_inspections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nonconformities" ADD CONSTRAINT "nonconformities_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_records" ADD CONSTRAINT "notification_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_employee_id_employee_profiles_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_batches" ADD CONSTRAINT "packing_batches_packing_order_id_packing_orders_id_fk" FOREIGN KEY ("packing_order_id") REFERENCES "public"."packing_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_batches" ADD CONSTRAINT "packing_batches_harvest_batch_id_harvest_batches_id_fk" FOREIGN KEY ("harvest_batch_id") REFERENCES "public"."harvest_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_batches" ADD CONSTRAINT "packing_batches_finished_product_id_products_id_fk" FOREIGN KEY ("finished_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_batches" ADD CONSTRAINT "packing_batches_inventory_lot_id_inventory_lots_id_fk" FOREIGN KEY ("inventory_lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_orders" ADD CONSTRAINT "packing_orders_harvest_batch_id_harvest_batches_id_fk" FOREIGN KEY ("harvest_batch_id") REFERENCES "public"."harvest_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_orders" ADD CONSTRAINT "packing_orders_crop_id_crop_catalog_id_fk" FOREIGN KEY ("crop_id") REFERENCES "public"."crop_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_orders" ADD CONSTRAINT "packing_orders_target_product_id_products_id_fk" FOREIGN KEY ("target_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_orders" ADD CONSTRAINT "packing_orders_packaging_product_id_products_id_fk" FOREIGN KEY ("packaging_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packing_orders" ADD CONSTRAINT "packing_orders_supervisor_user_id_users_id_fk" FOREIGN KEY ("supervisor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_prepared_by_user_id_users_id_fk" FOREIGN KEY ("prepared_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslip_records" ADD CONSTRAINT "payslip_records_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslip_records" ADD CONSTRAINT "payslip_records_employee_id_employee_profiles_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_employee_id_employee_profiles_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_crop_id_crop_catalog_id_fk" FOREIGN KEY ("crop_id") REFERENCES "public"."crop_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_requisition_id_purchase_requisitions_id_fk" FOREIGN KEY ("requisition_id") REFERENCES "public"."purchase_requisitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_harvest_batch_id_harvest_batches_id_fk" FOREIGN KEY ("harvest_batch_id") REFERENCES "public"."harvest_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_packing_batch_id_packing_batches_id_fk" FOREIGN KEY ("packing_batch_id") REFERENCES "public"."packing_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_inventory_lot_id_inventory_lots_id_fk" FOREIGN KEY ("inventory_lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_inspector_user_id_users_id_fk" FOREIGN KEY ("inspector_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_inspections" ADD CONSTRAINT "quality_inspections_released_by_user_id_users_id_fk" FOREIGN KEY ("released_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruitment_vacancies" ADD CONSTRAINT "recruitment_vacancies_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_packing_batch_id_packing_batches_id_fk" FOREIGN KEY ("packing_batch_id") REFERENCES "public"."packing_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_packing_batch_id_packing_batches_id_fk" FOREIGN KEY ("packing_batch_id") REFERENCES "public"."packing_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_dispatched_by_user_id_users_id_fk" FOREIGN KEY ("dispatched_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_lot_id_inventory_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_lot_id_inventory_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_from_warehouse_id_warehouses_id_fk" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_to_warehouse_id_warehouses_id_fk" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_performed_by_user_id_users_id_fk" FOREIGN KEY ("performed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_lot_id_inventory_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_reserved_by_user_id_users_id_fk" FOREIGN KEY ("reserved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_grn_id_goods_receipts_id_fk" FOREIGN KEY ("grn_id") REFERENCES "public"."goods_receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_employee_id_employee_profiles_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "approval_requests_code_idx" ON "approval_requests" USING btree ("request_code");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_tag_idx" ON "assets" USING btree ("asset_tag");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chart_of_accounts_code_idx" ON "chart_of_accounts" USING btree ("account_code");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_members_unique_idx" ON "conversation_members" USING btree ("conversation_id","user_id");--> statement-breakpoint
CREATE INDEX "conversation_members_user_idx" ON "conversation_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_code_idx" ON "conversations" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "crop_catalog_code_idx" ON "crop_catalog" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "crop_cycles_code_idx" ON "crop_cycles" USING btree ("cycle_code");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_code_idx" ON "customers" USING btree ("customer_code");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_code_idx" ON "departments" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "document_records_code_idx" ON "document_records" USING btree ("doc_code");--> statement-breakpoint
CREATE UNIQUE INDEX "document_records_storage_key_idx" ON "document_records" USING btree ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_profiles_code_idx" ON "employee_profiles" USING btree ("employee_code");--> statement-breakpoint
CREATE INDEX "employee_profiles_dept_idx" ON "employee_profiles" USING btree ("department_id");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_records_number_idx" ON "expense_records" USING btree ("expense_number");--> statement-breakpoint
CREATE UNIQUE INDEX "export_documents_number_idx" ON "export_documents" USING btree ("doc_number");--> statement-breakpoint
CREATE UNIQUE INDEX "farms_code_idx" ON "farms" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "fields_code_idx" ON "fields" USING btree ("field_code");--> statement-breakpoint
CREATE UNIQUE INDEX "goods_receipts_number_idx" ON "goods_receipts" USING btree ("grn_number");--> statement-breakpoint
CREATE UNIQUE INDEX "harvest_batches_number_idx" ON "harvest_batches" USING btree ("batch_number");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_settings_code_idx" ON "integration_settings" USING btree ("integration_code");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_lots_number_idx" ON "inventory_lots" USING btree ("lot_number");--> statement-breakpoint
CREATE INDEX "inventory_lots_product_idx" ON "inventory_lots" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_hash_idx" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_number_idx" ON "journal_entries" USING btree ("entry_number");--> statement-breakpoint
CREATE UNIQUE INDEX "leave_balances_emp_type_year_idx" ON "leave_balances" USING btree ("employee_id","leave_type_id","year");--> statement-breakpoint
CREATE UNIQUE INDEX "leave_requests_number_idx" ON "leave_requests" USING btree ("request_number");--> statement-breakpoint
CREATE UNIQUE INDEX "leave_types_code_idx" ON "leave_types" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "maintenance_work_orders_no_idx" ON "maintenance_work_orders" USING btree ("work_order_no");--> statement-breakpoint
CREATE UNIQUE INDEX "message_receipts_unique_idx" ON "message_receipts" USING btree ("message_id","user_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "nonconformities_number_idx" ON "nonconformities" USING btree ("ncr_number");--> statement-breakpoint
CREATE INDEX "notification_records_user_idx" ON "notification_records" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "packing_batches_code_idx" ON "packing_batches" USING btree ("packing_batch_code");--> statement-breakpoint
CREATE UNIQUE INDEX "packing_orders_code_idx" ON "packing_orders" USING btree ("order_code");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_runs_code_idx" ON "payroll_runs" USING btree ("run_code");--> statement-breakpoint
CREATE UNIQUE INDEX "payslip_records_number_idx" ON "payslip_records" USING btree ("payslip_number");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_code_idx" ON "permissions" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_code_idx" ON "product_categories" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_idx" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE UNIQUE INDEX "products_barcode_idx" ON "products" USING btree ("barcode");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_number_idx" ON "purchase_orders" USING btree ("po_number");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_requisitions_number_idx" ON "purchase_requisitions" USING btree ("req_number");--> statement-breakpoint
CREATE UNIQUE INDEX "quality_inspections_code_idx" ON "quality_inspections" USING btree ("inspection_code");--> statement-breakpoint
CREATE UNIQUE INDEX "recruitment_vacancies_code_idx" ON "recruitment_vacancies" USING btree ("vacancy_code");--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_unique_idx" ON "role_permissions" USING btree ("role_id","permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_code_idx" ON "roles" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_orders_number_idx" ON "sales_orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "security_events_created_idx" ON "security_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_idx" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_code_idx" ON "shifts" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "shipments_code_idx" ON "shipments" USING btree ("shipment_code");--> statement-breakpoint
CREATE UNIQUE INDEX "statutory_rule_versions_code_idx" ON "statutory_rule_versions" USING btree ("version_code");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_adjustments_number_idx" ON "stock_adjustments" USING btree ("adjustment_number");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movements_number_idx" ON "stock_movements" USING btree ("movement_number");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movements_idempotency_idx" ON "stock_movements" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "stock_movements_product_idx" ON "stock_movements" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_reservations_number_idx" ON "stock_reservations" USING btree ("reservation_number");--> statement-breakpoint
CREATE UNIQUE INDEX "storage_locations_bin_idx" ON "storage_locations" USING btree ("bin_code");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_invoices_number_idx" ON "supplier_invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_code_idx" ON "suppliers" USING btree ("supplier_code");--> statement-breakpoint
CREATE UNIQUE INDEX "system_settings_key_idx" ON "system_settings" USING btree ("setting_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uom_code_idx" ON "units_of_measure" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_unique_idx" ON "user_roles" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_dept_idx" ON "users" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("primary_role_code");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_reg_idx" ON "vehicles" USING btree ("registration_number");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_code_idx" ON "warehouses" USING btree ("code");