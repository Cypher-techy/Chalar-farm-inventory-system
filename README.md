# Chalar Farms — Inventory & Farm Management Portal

A working, database-backed farm ERP for **Chalar Farms Limited** (Madulu A Village, Chala Ward,
Taveta, Taita-Taveta County, Kenya) — growers, packers and exporters of fresh herbs to the EU, UK and
Middle East.

This is **not a mockup**. Every dashboard reads live PostgreSQL records, every mutation passes
server-side validation, role-based authorization and an audit trail, and stock, payroll and ledger
effects are written inside database transactions.

`Next.js App Router · React 19 · TypeScript (strict) · Tailwind · Drizzle ORM · PostgreSQL/PGlite · Zod · Recharts · Lucide · Vitest`

---

## Quick start

```bash
npm install
cp .env.example .env.local       # placeholders only — see docs/DEPLOYMENT.md
npm run dev                      # http://localhost:3000 (binds 0.0.0.0)
```

On first connection the app applies `drizzle/migrations/*.sql` (70 tables) and seeds system
configuration only — a real, empty system. Set `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` in
`.env.local` to create the first Super Administrator. To explore with clearly-labelled sample data on
your own machine instead, set `ENABLE_DEMO_SEED=true` (never available on the live site).

```bash
npm test                            # 100 tests: auth, RBAC, chat privacy, inventory, payroll, deployment
npx tsx scripts/check-db.ts         # seeded-record report
npx tsx scripts/check-integrity.ts  # trial balance, per-run payroll reconciliation, SoD check
npm run build && npm start          # production
```

> **PGlite is single-process.** The default `pglite://./.data/chalar-pg` driver embeds PostgreSQL in
> the Node process, so stop the dev server before running tests or CLI scripts. Point `DATABASE_URL`
> at a real PostgreSQL server (`postgresql://…`) for concurrent access — the same migrations and code
> path are used.

### Demo accounts (development seed only)

| Role | Email | Password |
|---|---|---|
| Super Administrator | `superadmin@chalarfarms.demo` | `Chalar@Admin2026!` |
| Executive, Farm, Inventory, HR, Finance, Payroll, Packhouse, QA, Procurement, Sales, Logistics, Maintenance, Supervisor, Auditor, Employee | `<role>@chalarfarms.demo` — e.g. `hr@chalarfarms.demo`, `qa@chalarfarms.demo` | `Chalar@Demo2026!` |

Every demo record is labelled `(Demo)` and uses the non-routable `.demo` TLD. **Rotate all credentials
— demo data is off by default, only loads when `ENABLE_DEMO_SEED=true`, and is never available on the
live (Vercel Production) site.**

Production databases contain **no demo accounts**. Create the first Super Administrator by setting
`INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` before the first start (see `docs/DEPLOYMENT.md`).
A local database first created in production mode (`npm start`) has no demo accounts either — delete
`.data/chalar-pg` and start with `npm run dev` to recreate it with demo data.

---

## What is implemented

### Public site
`/` — landing page built from authentic Chalar Farms marketing imagery (`public/images/chalar/`), with
restrained `IntersectionObserver` scroll reveals, image clip-path reveals, staggered card entrances and
KPI count-ups — all disabled under `prefers-reduced-motion`.

### ERP portal — 14 dashboards across 20 pages

| Area | Routes | Highlights |
|---|---|---|
| Governance | `/portal/super-admin`, `…/users`, `…/audit`, `…/approvals` | Enterprise KPIs, user & role administration, filterable audit explorer, approval queue with segregation-of-duties verification |
| Executive | `/portal/executive` | Revenue vs opex, cash/receivables/payables, field→packhouse→dispatch throughput, quality exposure, governance queue |
| Farm | `/portal/farm` | Crop cycles, harvest batches, field activity log, pre-harvest-interval watchlist, **harvest recording** that creates a traceable quarantined lot |
| Inventory | `/portal/inventory` | Lot valuation, reorder alerts, lot watchlist, **receipt / issue / transfer desk** with transactional guards |
| Packhouse | `/portal/packhouse` | Yield and variance accounting, cold-room temperatures, **packhouse run recording** (consumes the harvest lot, creates the finished lot, posts production movements) |
| Quality | `/portal/qa` | Inspection register with **server-decided outcomes**, NCR/CAPA capture, quarantine, **release authority separated from inspection** |
| Procurement | `/portal/procurement` | Requisitions with value-based approval routing, purchase orders, **goods receipting into lots**, three-way match exceptions |
| Sales & export | `/portal/sales` | Order book, allocation against QA-released stock, market/customer revenue, export document register, **order state machine** |
| Logistics | `/portal/logistics` | Refrigerated fleet and reefer ranges, **temperature-gated dispatch**, airwaybills, arrival/POD events, cold-chain exceptions |
| Maintenance | `/portal/maintenance` | Asset register, service dues, **work order raising and completion** with FIFO spare-part consumption |
| HR | `/portal/hr` | Headcount and composition, attendance, statutory leave types, **leave submission with entitlement/overlap guards**, overtime, recruitment, training compliance |
| Finance & payroll | `/portal/finance` | Trial balance, payables ageing, expense register, **payroll computation with Kenyan statutory deductions**, approval posting a balanced journal, date-effective statutory rule versions |
| Workspaces | `/portal/workspaces` | Employee self-service (payslips + PDF, balances, attendance), supervisor team view and approval queue, auditor read-only trail |
| Communications | `/portal/communications` | Private conversations with unread badges, delivery/read receipts, **private file attachments**, initiation policy |

### Cross-cutting capabilities

- **Authentication** — bcrypt hashing, hashed opaque session tokens in `httpOnly`/`SameSite=Lax`
  cookies (`Secure` in production), sliding TTL, failed-attempt lockout, security event register,
  server-side revocation on logout/deactivation/admin action.
- **RBAC** — 16 system roles, 45 permission codes (`src/lib/rbac-catalog.ts`). Every route handler and
  server component re-checks permissions; sidebar filtering is a convenience, never the control.
- **Approvals** — requisitions, expenses, stock adjustments, leave and payroll runs are role-routed;
  the submitter can never decide their own request; decisions cascade to the underlying record and post
  stock/ledger effects.
- **Audit log** — authentication, authorization denials, data changes, approvals, exports and document
  downloads, with actor, module, entity, before/after state and IP. Message bodies and payslip contents
  are deliberately excluded from logs and notifications.
- **Private documents** — stored outside the web root (`.storage/private-documents`), MIME allowlist,
  10 MB cap, SHA-256 verified on every read, conversation/department-scoped access, `404` (not `403`)
  for unauthorized callers so existence is not disclosed.
- **Exports** — 15 report types as CSV (UTF-8 BOM, formula-injection escaping) or genuine PDF from a
  dependency-free writer, plus per-employee payslip PDFs. Every export is audited.
- **Kenyan statutory payroll** — graduated PAYE with personal relief, NSSF Tier I/II, SHIF 2.75%
  (KES 300 floor), Affordable Housing Levy 1.5% + 1.5%, all read from **date-effective rule versions**
  stored in the database, never hardcoded at call sites.

---

## Repository layout

```
src/app            20 pages + 29 API route handlers (all permission-checked)
src/components     motion primitives, ERP shell, KPI/table/badge kit, chart wrappers, record forms
src/db             schema.ts (69 tables), index.ts (drivers, auto-migration, lock recovery), seed.ts
src/lib            auth, guards, rbac-catalog, chat, documents, payroll calculator/service, pdf, queries
drizzle/migrations generated SQL migrations
scripts            check-db.ts, check-integrity.ts
tests              5 vitest suites (61 tests) running against a real in-memory PostgreSQL
docs               DEPLOYMENT · DATABASE · STATUTORY-NOTES · FEATURE-REPORT
public/images      Chalar Farms imagery (© Chalar Farms and partners)
```

**Integrity rules enforced in code:** stock can never go negative; quarantined/blocked/expired lots
cannot be issued; packhouse runs must balance (accepted + rejected ≤ intake, packed ≤ accepted −
washing loss) with unexplained variance recorded explicitly; QA outcomes derive from measurements;
leave is validated against entitlement less used less pending with overlap detection and Sunday rest
days excluded; payroll approval reconciles payslips to the run header and aborts on an unbalanced
journal; dispatch is blocked when temperature or reefer range cannot meet the customer specification;
idempotency keys make retries safe.

---

## Documentation

- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — production deployment, environment, hardening checklist
- [`docs/DATABASE.md`](docs/DATABASE.md) — schema, migrations, seeding, backup and rehearsed restore
- [`docs/STATUTORY-NOTES.md`](docs/STATUTORY-NOTES.md) — Kenyan payroll and leave rules, where they are
  configured, worked examples, and what is *not* computed
- [`docs/FEATURE-REPORT.md`](docs/FEATURE-REPORT.md) — honest completion report: verification results,
  smoke-test matrix, 20 known limitations, missing credentials, prioritised next steps

---

## Data honesty

- Company facts on the landing page (founding year, location, weekly volumes, markets, workforce
  composition, certifications) reflect Chalar Farms' published marketing material. Certification marks
  are shown as company claims; **no certificate numbers are invented anywhere** — export documents read
  `pending` until an issuing authority provides one.
- All seeded operational data is synthetic and labelled. No real employee, customer order, payroll or
  financial figure is included, and no dashboard total is hardcoded.
- Photographs come from Chalar Farms' public marketing material and are credited as
  © Chalar Farms and partners; confirm licensing before external deployment.
