# Deployment Guide — Chalar Farms ERP

Target stack: **Next.js (App Router) + PostgreSQL**. The repository runs on embedded PGlite for local
development and switches to a real PostgreSQL server when `DATABASE_URL` is a `postgres://`/`postgresql://`
connection string — no code changes required.

---

## 1. Prerequisites

- Node.js 20+ (tested on Node 22)
- PostgreSQL 14+ (managed: Neon, Supabase, AWS RDS, Azure Database for PostgreSQL, or self-hosted)
- A writable volume for private document storage (or S3-compatible storage — see §6)
- TLS termination in front of the app (Caddy, Nginx, or the platform's own load balancer)

## 2. Environment

```bash
cp .env.example .env.production
```

Required in production:

| Variable | Example | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Disables the demo seed automatically |
| `DATABASE_URL` | `postgresql://chalar:***@db.internal:5432/chalar_erp?sslmode=require` | Must use TLS |
| `SESSION_SECRET` | 64 random bytes | `openssl rand -base64 48` |
| `SESSION_TTL_HOURS` | `12` | Lower for shared devices |
| `AUTH_MAX_LOGIN_ATTEMPTS` | `5` | |
| `AUTH_LOCKOUT_MINUTES` | `15` | |
| `ENABLE_DEMO_SEED` | `false` | **Must be false in production** |
| `INITIAL_ADMIN_EMAIL` | `it.admin@chalarfarms.com` | First Super Administrator — used only while no active Super Admin exists |
| `INITIAL_ADMIN_PASSWORD` | strong, unique | 12+ chars, three character classes. **Remove after first sign-in** |
| `INITIAL_ADMIN_NAME` | `System Administrator` | Optional display name |
| `PRIVATE_STORAGE_PATH` | `/var/lib/chalar/documents` | Outside the web root, backed up |
| `MAX_UPLOAD_SIZE_BYTES` | `10485760` | |
| `NEXT_PUBLIC_APP_URL` | `https://erp.chalarfarms.com` | Used for links in notifications |

Never commit real values. `.env*` files are git-ignored; only `.env.example` (placeholders) is tracked.

## 3. Database provisioning

```bash
# 1. Create the database and a least-privilege role
psql "$DATABASE_URL" -c "CREATE DATABASE chalar_erp;"
psql "$DATABASE_URL" -c "CREATE ROLE chalar_app LOGIN PASSWORD 'replace-me';"
psql "$DATABASE_URL" -c "GRANT CONNECT ON DATABASE chalar_erp TO chalar_app;"

# 2. Apply migrations (idempotent; also runs automatically on first connection)
npm run db:migrate

# 3. Seed system configuration ONLY (roles, permissions, departments, chart of accounts,
#    statutory rule version, leave types, warehouses). In production keep ENABLE_DEMO_SEED=false,
#    which seeds configuration without demo operational records.
ENABLE_DEMO_SEED=false npm run db:seed

# 4. Create the first Super Administrator: set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD,
#    then start (or restart) the app. On first database connection, if no active Super Admin
#    exists, one is created and a BOOTSTRAP_ADMIN_CREATED security event is recorded.
#    It never modifies an existing account. Sign in, rotate the password under
#    Super Admin → Users, then remove INITIAL_ADMIN_PASSWORD from the environment.
#    Without these variables a production database has NO accounts and the login page
#    shows a "No staff accounts exist yet" notice.

# 5. Verify
npx tsx scripts/check-db.ts
npx tsx scripts/check-integrity.ts
```

`check-integrity.ts` exits non-zero if the trial balance does not balance, payroll totals do not
reconcile, or any approval was self-approved. Wire it into your deployment pipeline as a gate.

### Creating the first Super Administrator
The configuration seed creates no user accounts when demo seeding is disabled. Create the first
administrator directly:

```sql
-- password_hash must be a bcrypt hash (cost 10) of the chosen password
INSERT INTO users (email, password_hash, full_name, phone, primary_role_code, status)
VALUES ('it.admin@chalarfarms.co.ke', '$2a$10$...', 'IT Administrator', '+2547…', 'SUPER_ADMIN', 'ACTIVE');
INSERT INTO user_roles (user_id, role_id) SELECT 1, id FROM roles WHERE code = 'SUPER_ADMIN';
```

Then use **Super Admin → Users & Roles** to create every other account; each new user receives a
temporary password that must be changed, and the action is audited.

## 4. Build and run

```bash
npm ci
npm run build
NODE_ENV=production npm start        # binds 0.0.0.0:3000
```

Process supervision examples:

```ini
# systemd
[Unit]
Description=Chalar Farms ERP
After=network.target postgresql.service

[Service]
WorkingDirectory=/opt/chalar-erp
EnvironmentFile=/opt/chalar-erp/.env.production
ExecStart=/usr/bin/npm start
Restart=always
User=chalar
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/opt/chalar-erp/.storage /opt/chalar-erp/.data

[Install]
WantedBy=multi-user.target
```

Container deployments: copy `.next/standalone` (enable `output: 'standalone'` in `next.config.mjs` if
you need it), mount `PRIVATE_STORAGE_PATH` as a persistent volume, and run as a non-root user.

## 5. Deployment checklist

- [ ] `ENABLE_DEMO_SEED=false` and no demo accounts exist (`SELECT count(*) FROM users WHERE email LIKE '%.demo';` → 0)
- [ ] First Super Administrator signed in, password rotated, and `INITIAL_ADMIN_PASSWORD` removed from the environment
- [ ] All seeded/initial passwords rotated; MFA plan documented (see limitation in `FEATURE-REPORT.md`)
- [ ] `DATABASE_URL` uses TLS (`sslmode=require`) and a least-privilege role
- [ ] `SESSION_SECRET` is unique per environment and stored in a secrets manager
- [ ] Cookies are `Secure` (automatic when `NODE_ENV=production`) and the site is HTTPS-only
- [ ] Private storage path is outside the web root, not world-readable, and included in backups
- [ ] Database backups scheduled and a restore has been rehearsed (`docs/DATABASE.md`)
- [ ] `scripts/check-integrity.ts` passes in the target environment
- [ ] Log aggregation captures stdout (audit events are in the database; application errors go to stdout)
- [ ] Monitoring alerts on: 5xx rate, login lockouts, failed approvals, trial-balance drift
- [ ] Statutory rates verified against current KRA/NSSF/SHA guidance (`docs/STATUTORY-NOTES.md`)

## 6. Optional integrations (disabled by default)

| Integration | Variables | Status in this repository |
|---|---|---|
| M-Pesa (Daraja) | `MPESA_ENVIRONMENT`, `MPESA_CONSUMER_KEY/SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_SECRET` | Configuration placeholders only — **no credentials supplied**, so no payment calls are made and nothing is simulated as successful |
| Email/SMTP | `EMAIL_PROVIDER`, `SMTP_HOST/PORT/USER/PASSWORD`, `EMAIL_FROM` | `EMAIL_PROVIDER=disabled`; in-app notifications are used instead |
| S3-compatible storage | `PRIVATE_STORAGE_DRIVER=s3`, `S3_BUCKET_NAME`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Local driver is implemented; the S3 driver is a documented extension point (see `FEATURE-REPORT.md`) |

When you add credentials, keep them out of Git and out of client-side code. Any integration must be
exercised in a sandbox first, and its callbacks must be signature-verified before mutating records.

## 7. Upgrades

```bash
git fetch && git checkout <release-tag>
npm ci
npm run db:generate      # only if src/db/schema.ts changed
npm run db:migrate
npm test                 # must pass before switching traffic
npm run build
npx tsx scripts/check-integrity.ts
sudo systemctl restart chalar-erp
```

Migrations are additive SQL files in `drizzle/migrations/`. Take a database backup immediately before
applying migrations, and never edit an applied migration file — add a new one.
