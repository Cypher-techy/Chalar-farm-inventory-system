CREATE TABLE "access_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_code" text NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"job_title" text,
	"department_id" integer,
	"requested_role_code" text NOT NULL,
	"message" text,
	"password_hash" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"granted_role_code" text,
	"decided_by_user_id" integer,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_user_id" integer,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_created_user_id_users_id_fk" FOREIGN KEY ("created_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_requests_code_idx" ON "access_requests" USING btree ("request_code");--> statement-breakpoint
CREATE UNIQUE INDEX "access_requests_pending_email_idx" ON "access_requests" USING btree ("email") WHERE status = 'PENDING';--> statement-breakpoint
CREATE INDEX "access_requests_status_idx" ON "access_requests" USING btree ("status");