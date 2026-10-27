# Database — Migrations, Seeding, Backup and Restore

## 1. Drivers

| Mode | `DATABASE_URL` | Use case |
|---|---|---|
| Embedded | `pglite://./.data/chalar-pg` (default) | Local development, demos, tests (`memory://` under vitest) |
| Server | `postgresql://user:pass@host:5432/db` | Staging and production (required on Vercel — see `DEPLOYMENT.md` §3a) |

Both paths share the same Drizzle schema and the same generated SQL migrations.

> **PGlite is single-process.** Stop the dev server before running `npm test`, `npm run db:*` or the
> `scripts/*.ts` checks, otherwise the second process cannot open the data directory. If a process is
> killed mid-write, `src/db/index.ts` clears the stale postmaster lock on the next start; if the data
> directory is corrupted, delete `.data/` and let it re-create and re-seed (development only — never
> do this to a production volume).

## 2. Schema

`src/db/schema.ts` defines 69 tables grouped as:

1. **Identity & RBAC** — `departments`, `roles`, `permissions`, `role_permissions`, `users`,
   `user_roles`, `sessions`, `invitations`, `security_events`
2. **Farm operations** — `farms`, `fields`, `crop_catalog`, `crop_cycles`, `field_activities`,
   `harvest_batches`
3. **Inventory** — `units_of_measure`, `unit_conversions`, `product_categories`, `warehouses`,
   `storage_locations`, `products`, `inventory_lots`, `stock_movements`, `stock_reservations`,
   `stock_adjustments`
4. **HR** — `employee_profiles`, `shifts`, `attendance_records`, `overtime_requests`, `leave_types`,
   `leave_balances`, `leave_requests`, `recruitment_vacancies`, `candidates`, `training_records`,
   `performance_reviews`
5. **Finance & payroll** — `chart_of_accounts`, `journal_entries`, `journal_lines`, `expense_records`,
   `statutory_rule_versions`, `payroll_runs`, `payslip_records`
6. **Packhouse & QA** — `packing_orders`, `packing_batches`, `quality_inspections`, `nonconformities`
7. **Procurement** — `suppliers`, `purchase_requisitions`, `purchase_orders`, `goods_receipts`,
   `supplier_invoices`
8. **Sales & logistics** — `customers`, `sales_orders`, `vehicles`, `shipments`, `export_documents`
9. **Maintenance** — `assets`, `maintenance_work_orders`
10. **Communications & governance** — `conversations`, `conversation_members`, `messages`,
    `message_receipts`, `notification_records`, `approval_requests`, `document_records`, `audit_logs`,
    `system_settings`, `integration_settings`

Design invariants worth preserving:

- Quantity and money columns are `numeric` with explicit scale — never `float`.
- Date-only columns are stored as ISO-8601 `text` (`YYYY-MM-DD`) and cast with `::date` in queries so
  they behave identically on PGlite and PostgreSQL.
- Every stock movement carries an idempotency key, actor, reason, reference and cost, so the ledger can
  be replayed and audited.
- `inventory_lots` holds lot-level truth (`physical_qty`, `reserved_qty`, `available_qty`,
  `quality_status`, expiry); `products` holds rolled-up buckets used for fast reorder alerts.
- `approval_requests.decided_by_user_id` must never equal `submitted_by_user_id` (verified by
  `scripts/check-integrity.ts`).

## 3. Migrations

```bash
npm run db:generate     # drizzle-kit generates drizzle/migrations/000N_*.sql from schema.ts
npm run db:migrate      # applies pending migrations
```

Migrations also apply automatically when the app first connects. Applied files are recorded in
`chalar_schema_migrations`; pending ones run in a single transaction under a PostgreSQL advisory lock,
so concurrent serverless cold starts cannot race and a failure leaves no partial schema. Databases
created before tracking existed are brought up to date idempotently. Rules:

- Never edit a migration that has been applied anywhere — add a new one.
- Review generated SQL before committing; add `USING` casts when changing column types.
- Take a backup before applying migrations to staging/production.
- Current migration set: `0000_thick_the_executioner.sql` (initial 69 tables),
  `0001_serious_sage.sql` (`vehicles.reefer_temp_max_c`).

## 4. Seeding

`src/db/seed.ts` writes two layers:

1. **System configuration** (always): departments with cost centres (budgets only in demo mode), roles and permission
   mappings, chart of accounts, warehouses, units of measure, product categories, leave types with
   their Employment Act 2007 basis, shifts, the current Kenyan statutory rule version, crop catalogue,
   customers, suppliers and system settings.
2. **Demo operational data** (only when `ENABLE_DEMO_SEED` is not `false` and `NODE_ENV` is not
   `production`): 16 labelled demo users, 56 employees, 14 days of attendance, crop cycles, harvest
   batches, packing runs, QA inspections, requisitions/POs/GRNs/invoices, sales orders, shipments,
   export documents, assets and work orders, expenses, balanced journals, a complete payroll run with
   56 payslips, conversations with messages, notifications and audit history.

Chart-of-accounts balances and the sample fleet are likewise demo-only; production databases start at
zero. Seeding is idempotent (`ON CONFLICT DO NOTHING` on natural keys), runs in a locked transaction,
and is recorded by the `system.config_seed_version` setting. Demo operational data is only ever added
to a brand-new database. When a production database seeded by an older build is upgraded, any budget,
balance or vehicle row that still holds the old illustrative value is reset/removed (edited rows are kept).

```bash
npm run db:seed                          # migrate + configuration + demo data (dev default)
ENABLE_DEMO_SEED=false npm run db:seed   # migrate + configuration only (production)
```

## 5. Verification scripts

```bash
npx tsx scripts/check-db.ts          # counts: users, products, orders, messages, payslips, seeded flag
npx tsx scripts/check-integrity.ts   # invariants, exits non-zero on failure
```

`check-integrity.ts` asserts:
- trial balance: `SUM(total_debit_kes) = SUM(total_credit_kes)` over posted journals;
- payroll: `SUM(payslip net pay) = payroll_runs.total_net_pay_kes`;
- governance: zero approvals where submitter = decider;
- plus counts of employees, attendance, leave balances, assets, work orders, conversations, audit logs
  and pending approvals.

Run it after seeding, after migrations, and as a deployment gate.

## 6. Backup

### PostgreSQL (production)

```bash
# Nightly custom-format dump (compressed, selective restore possible)
pg_dump "$DATABASE_URL" --format=custom --file=/var/backups/chalar/chalar-erp-$(date +%F).dump

# Retention: 14 daily, 8 weekly, 12 monthly (example)
find /var/backups/chalar -name '*.dump' -mtime +14 -delete

# Also back up private documents (they are NOT in the database)
tar -czf /var/backups/chalar/documents-$(date +%F).tar.gz -C /var/lib/chalar documents
```

Example systemd timer:

```ini
# /etc/systemd/system/chalar-backup.service
[Unit]
Description=Chalar Farms ERP backup
[Service]
Type=oneshot
EnvironmentFile=/opt/chalar-erp/.env.production
ExecStart=/usr/local/bin/chalar-backup.sh
```
```ini
# /etc/systemd/system/chalar-backup.timer
[Unit]
Description=Nightly Chalar Farms ERP backup
[Timer]
OnCalendar=*-*-* 02:30:00
Persistent=true
[Install]
WantedBy=timers.target
```

Store at least one copy off-host (object storage with versioning and object lock, or a separate
backup server). Encrypt backups at rest and restrict decryption keys.

### PGlite (development)

The database is the directory `.data/chalar-pg` and documents live in `.storage/private-documents`:

```bash
tar -czf chalar-dev-snapshot.tar.gz .data .storage
```

This is a convenience snapshot for development only — it is not a supported production backup method.

## 7. Restore

```bash
# 1. Stop the application
sudo systemctl stop chalar-erp

# 2. Create a fresh database (never restore over a live one)
psql "$ADMIN_URL" -c "CREATE DATABASE chalar_erp_restored;"

# 3. Restore the dump
pg_restore --dbname="$RESTORE_URL" --no-owner --role=chalar_app /var/backups/chalar/chalar-erp-2026-10-26.dump

# 4. Restore private documents
tar -xzf /var/backups/chalar/documents-2026-10-26.tar.gz -C /var/lib/chalar

# 5. Verify integrity before switching traffic
DATABASE_URL="$RESTORE_URL" npx tsx scripts/check-integrity.ts

# 6. Point the app at the restored database and restart
sudo systemctl start chalar-erp
```

Rehearse a restore at least quarterly — an untested backup is not a backup. After restoring, confirm
that document downloads still succeed, which proves the SHA-256 checksums match the restored files.

## 8. Operational queries

```sql
-- Pending approvals by module
SELECT module, count(*) FROM approval_requests WHERE status = 'PENDING' GROUP BY module;

-- Lots blocked from issue
SELECT lot_number, quality_status, physical_qty, expiry_date
FROM inventory_lots WHERE quality_status IN ('QUARANTINED','BLOCKED','EXPIRED');

-- Statutory liabilities withheld to date
SELECT SUM(total_paye_kes) paye, SUM(total_nssf_employee_kes) nssf,
       SUM(total_shif_kes) shif, SUM(total_housing_levy_kes) housing_levy
FROM payroll_runs;

-- Active sessions
SELECT u.email, s.ip_address, s.expires_at FROM sessions s
JOIN users u ON u.id = s.user_id WHERE s.revoked_at IS NULL AND s.expires_at > now();
```
