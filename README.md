# Chalar Farms — Inventory & Farm Management Portal (ERP)

A production-oriented, database-backed farm ERP for **Chalar Farms Limited** (Taveta, Taita-Taveta
County, Kenya) — growers and exporters of fresh herbs to the EU, UK and Middle East.

This is a working system, not a mockup: every dashboard reads live PostgreSQL records, every write
goes through server-side validation, authorization and an audit trail, and stock, payroll and ledger
operations run inside database transactions.

![Stack](https://img.shields.io/badge/Next.js-App%20Router%20%2B%20React%2019-black) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue) ![Database](https://img.shields.io/badge/PostgreSQL-Drizzle%20ORM-blue) ![Tests](https://img.shields.io/badge/tests-61%20passing-brightgreen)

---

## 1. What is implemented

### Public site
- `/` — premium landing page using authentic Chalar Farms imagery (`public/images/chalar/`), with
  restrained scroll-reveal and count-up animation driven by `IntersectionObserver`, and full
  `prefers-reduced-motion` fallbacks.

### ERP portal (14 dashboards, all permission-gated server-side)
| Route | Dashboard | Core content |
|---|---|---|
| `/portal/super-admin` | Super Administrator | Enterprise KPIs, budget vs actual, approval queue, audit activity |
| `/portal/super-admin/users` | User & role administration | Create/reset accounts, assign roles, lock/unlock, revoke sessions |
| `/portal/super-admin/audit` | Audit explorer | Filterable immutable audit trail, security event register |
| `/portal/super-admin/approvals` | Approval governance | Segregation-of-duties verification across all modules |
| `/portal/executive` | Executive | Revenue, opex, value-chain throughput, quality exposure, governance queue |
| `/portal/farm` | Farm operations | Crop cycles, harvest batches, field activities, PHI watchlist, harvest recording |
| `/portal/inventory` | Inventory & warehouse | Valuation, reorder alerts, lot watchlist, receipt/issue/transfer desk |
| `/portal/packhouse` | Packhouse & production | Intake → grading → washing → packing with yield and variance accounting |
| `/portal/qa` | Quality assurance | Inspections with server-decided outcomes, quarantine, NCR/CAPA, release authority |
| `/portal/procurement` | Procurement | Requisitions with value-based routing, POs, goods receipts, three-way match |
| `/portal/sales` | Sales & export | Order book, allocation against QA-released stock, export documentation |
| `/portal/logistics` | Logistics & cold chain | Fleet, dispatch with temperature gating, airwaybills, proof of delivery |
| `/portal/maintenance` | Maintenance & assets | Asset register, work orders, spare-part consumption, service scheduling |
| `/portal/hr` | Human resources | Headcount, attendance, statutory leave, overtime, recruitment, training |
| `/portal/finance` | Finance & payroll | Trial balance, payables ageing, expenses, payroll runs and statutory rules |
| `/portal/workspaces` | Employee / supervisor / auditor workspace | Self-service payslips, leave, attendance; team view; audit view |
| `/portal/communications` | Private messaging | Conversation-isolated private chat with delivery/read receipts |

### Cross-cutting capabilities
- **Authentication** — bcrypt password hashing, hashed opaque session tokens in `httpOnly` cookies,
  sliding expiry, failed-attempt counters with lockout, security event register, logout with
  server-side revocation, admin "revoke all sessions".
- **RBAC** — 16 system roles and 44 permission codes (`src/lib/rbac-catalog.ts`). Every API route and
  page re-checks permissions server-side; navigation hiding is a convenience only.
- **Approvals with segregation of duties** — requisitions, expenses, stock adjustments, leave requests
  and payroll runs are routed to a role; the submitter can never decide their own request. Decisions
  cascade to the underlying record and post ledger/stock effects.
- **Audit logging** — authentication, authorization denials, data changes, approvals, exports and
  document downloads are logged with actor, module, entity, before/after state and IP address.
  Message bodies and payslip contents are deliberately never written to logs or notifications.
- **Private documents** — uploads are stored outside the web root under `.storage/private-documents`,
  with a MIME/size allowlist, SHA-256 integrity verification on read, conversation/department-scoped
  access control, and a 404 (not 403) response for unauthorized callers so existence is not disclosed.
- **Exports** — CSV (UTF-8 BOM, formula-injection escaping on every cell) and genuine PDF output from
  a dependency-free writer (`src/lib/pdf.ts`) for 15 report types plus individual payslips.
- **Kenyan statutory payroll** — graduated PAYE bands with personal relief, NSSF Tier I/II, SHIF
  2.75% (KES 300 minimum), and the 1.5% + 1.5% Affordable Housing Levy, all read from
  **date-effective rule versions** in the database rather than hardcoded.

---

## 2. Quick start

```bash
npm install
cp .env.example .env.local      # then edit values (see §5)
npm run dev                     # http://localhost:3000 (binds 0.0.0.0)
```

On first connection the app:
1. creates the schema by applying `drizzle/migrations/*.sql` (69 tables), and
2. seeds system configuration plus clearly-labelled **demo** data (`ENABLE_DEMO_SEED=true`).

No manual migration or seed step is required for local development.

```bash
npm test                        # 61 tests: auth, RBAC, chat privacy, inventory, payroll
npm run db:generate             # generate SQL migrations after schema.ts changes
npm run db:migrate              # apply migrations (also automatic on first connection)
npm run db:seed                 # seed configuration + demo data (idempotent)
npm run build && npm start      # production build
npx tsx scripts/check-db.ts     # DB sanity report
npx tsx scripts/check-integrity.ts  # trial balance, payroll reconciliation, SoD check
```

> **Note on PGlite:** the default `pglite://./.data/chalar-pg` driver embeds PostgreSQL in the Node
> process and supports only **one process at a time**. Stop the dev server before running CLI scripts
> or tests, or point `DATABASE_URL` at a real PostgreSQL server for concurrent access.

### Demo accounts (development seed only — not production credentials)
| Role | Email | Password |
|---|---|---|
| Super Administrator | `superadmin@chalarfarms.demo` | `Chalar@Admin2026!` |
| Executive, Farm, Inventory, HR, Finance, Payroll, Packhouse, QA, Procurement, Sales, Logistics, Maintenance, Supervisor, Auditor, Employee | `<role>@chalarfarms.demo` (e.g. `hr@chalarfarms.demo`) | `Chalar@Demo2026!` |

All demo records are labelled `(Demo)` and use the non-routable `.demo` TLD. **Change every password
and set `ENABLE_DEMO_SEED=false` before any real deployment.**

---

## 3. Architecture

```
src/
  app/
    page.tsx                    public landing page
    login/page.tsx              authentication UI
    api/                        21 route handlers (all permission-checked)
    portal/                     14 dashboards + chat workspace + admin pages
  components/
    motion.tsx                  IntersectionObserver reveal + count-up (reduced-motion aware)
    portal/                     ERP shell (sidebar, topbar, KPI/table/badge kit, Recharts wrappers)
  db/
    schema.ts                   69 Drizzle tables
    index.ts                    PGlite or node-postgres driver, auto-migration, stale-lock recovery
    seed.ts                     system config + labelled demo data
  lib/
    auth.ts                     passwords, sessions, lockout, permissions, audit + security events
    guards.ts                   requireAuth/requirePermission, rate limits, idempotency, CSV escaping
    rbac-catalog.ts             roles, permissions, default dashboards
    chat.ts                     conversation membership gate, initiation policy, notifications
    documents.ts                private storage, integrity checks, scoped access control
    payroll-calculator.ts       Kenyan statutory computation engine
    payroll-service.ts          date-effective rule loading + full run computation
    pdf.ts                      dependency-free PDF 1.4 writer
    *-queries.ts                read models per domain (farm, HR, finance, operations)
drizzle/migrations/             generated SQL migrations
scripts/                        check-db.ts, check-integrity.ts
tests/                          vitest suites (node environment, in-memory PostgreSQL)
docs/                           deployment, backup/restore, statutory notes, feature report
```

**Data-integrity rules enforced in code**
- Stock can never go negative; issues from quarantined, blocked or expired lots are refused.
- Every stock change writes a ledger row with actor, reason, reference and cost; corrections are
  posted as adjustments after approval, never as silent rewrites.
- Packhouse runs must balance (accepted + rejected ≤ intake; packed ≤ accepted − washing loss) and
  unexplained variance is recorded explicitly.
- QA outcomes are computed from measurements (temperature limits, defect thresholds, pest/residue
  flags) — an inspector cannot simply declare a pass; release requires a second authorized user.
- Leave is validated against entitlement less used less pending, with overlap detection and Sunday
  rest days excluded per the Employment Act 2007.
- Payroll approval reconciles payslip totals against the run header and posts a balanced journal;
  an unbalanced journal aborts the approval.
- Dispatch is blocked when load temperature or vehicle reefer range cannot meet the customer's
  cold-chain specification.
- Retries are safe: idempotency keys prevent duplicate movements, receipts, runs and messages.

---

## 4. Security model

- Passwords: bcrypt (cost 10), never logged, never returned by any API.
- Sessions: 256-bit random tokens, stored **hashed** (SHA-256), `httpOnly` + `SameSite=Lax` cookies,
  `Secure` in production, sliding TTL, revocation on logout/deactivation/admin action.
- Lockout: configurable failed-attempt threshold and lockout window; every attempt writes a security
  event with IP and user agent.
- Authorization: permission checks in every route handler *and* every server component; unauthorized
  document requests return 404; unauthorized approval attempts are audited.
- Rate limiting: in-process token buckets on login, chat, uploads and write endpoints.
- Uploads: MIME allowlist, 10 MB cap, filename sanitisation, storage outside the web root, SHA-256
  verification before serving, `X-Content-Type-Options: nosniff`, `Content-Disposition: attachment`.
- Exports: CSV cells beginning with `=`, `+`, `-`, `@`, tab or CR are apostrophe-escaped to prevent
  spreadsheet formula injection.
- Headers: CSP, `X-Frame-Options`, `Referrer-Policy` and related headers set in `next.config.mjs`.
- Privacy: private message content is excluded from global search, notifications and audit summaries;
  payslips are visible only to the employee concerned or holders of `payroll.view` / `hr.sensitive`.

---

## 5. Environment variables

See `.env.example` for the full annotated list. Minimum for local development:

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | `pglite://./.data/chalar-pg` (embedded) or `postgresql://…` (server) | PGlite |
| `SESSION_SECRET` | Reserved for future signed payloads / CSRF tokens | placeholder |
| `SESSION_TTL_HOURS` | Session lifetime | 12 |
| `AUTH_MAX_LOGIN_ATTEMPTS` / `AUTH_LOCKOUT_MINUTES` | Lockout policy | 5 / 15 |
| `ENABLE_DEMO_SEED` | Seed labelled demo data outside production | `true` |
| `PRIVATE_STORAGE_PATH` | Private upload directory | `./.storage/private-documents` |
| `MAX_UPLOAD_SIZE_BYTES` | Upload cap | 10485760 |

Optional integrations (M-Pesa Daraja, SMTP/email) are configured but **disabled by default**: no
credentials are present in this repository, and the app never fabricates a successful integration
call. See `docs/DEPLOYMENT.md`.

---

## 6. Documentation

- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — production deployment, environment, hardening checklist
- [`docs/DATABASE.md`](docs/DATABASE.md) — migrations, seeding, backup and restore procedures
- [`docs/STATUTORY-NOTES.md`](docs/STATUTORY-NOTES.md) — Kenyan payroll/leave rules, sources, and the
  verification caveat before relying on them for filing
- [`docs/FEATURE-REPORT.md`](docs/FEATURE-REPORT.md) — honest feature-completion report: what is
  implemented, what is deferred, test and build results, and known limitations

---

## 7. Legal and data honesty notes

- Company facts on the landing page (founding year, location, weekly volumes, markets, certifications,
  workforce composition) reflect publicly published Chalar Farms marketing information. Certification
  marks (GLOBALG.A.P., GRASP, SMETA, LEAF Marque) are shown as company claims — verify current
  certificate validity with the issuing bodies before external reliance. No certificate numbers are
  invented anywhere in this system; export documents display "pending" until an authority issues one.
- All seeded operational data is **synthetic demo data**, labelled as such. No real employee, customer
  order, payroll or financial figure is included.
- Photographs in `public/images/chalar/` were sourced from Chalar Farms' public marketing material and
  are credited as © Chalar Farms and partners. Replace or re-license them if this repository is used
  outside that context.
