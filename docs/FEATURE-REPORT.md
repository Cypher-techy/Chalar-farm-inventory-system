# Feature Completion Report — Chalar Farms ERP

Honest status of the system as delivered on branch
`arena/bfe2c71b-chalar-farm-inventory-system`. Everything below was verified by running the code, not
by reading it.

**Verification date:** 2026-10-26 · **Node:** v22 · **Database driver used for verification:** embedded
PGlite (PostgreSQL 16 in WASM)

---

## 1. Build and test results

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | **Pass** — 0 errors (strict mode) |
| Unit + integration tests | `npm test` | **Pass — 61/61 tests, 5 files** (auth 8, authz 10, chat privacy 12, inventory 10, payroll 21) |
| Production build | `npm run build` | **Pass** — compiled successfully, 20 pages + 29 API route handlers emitted |
| Database integrity | `npx tsx scripts/check-integrity.ts` | **Pass** on a freshly seeded database — trial balance Dr = Cr, payroll reconciles per run (drift KES 0.00, 0 orphan payslips), **0** self-approved approvals |
| Seed sanity | `npx tsx scripts/check-db.ts` | **Pass** — 16 users, 56 employees, 28 products, 12 sales orders, 56 payslips |

Build warnings (6) are Turbopack notices about dynamic filesystem access from the PGlite/migration
loader and Drizzle's `require` of `pg`. They do not affect the emitted output.

### End-to-end smoke checks performed against the running server
| Flow | Result |
|---|---|
| Landing page, login page | 200 |
| Login (valid / invalid / locked) | 200 with session cookie / 401 / 423 |
| Role redirect on `/portal` | 307 → role's own dashboard |
| Cross-dashboard access (HR → Super Admin page) | 307 redirect away |
| All 14 dashboards as Super Admin | 200 each |
| All 16 demo roles: login → own dashboard | 200 for every role (farm, inventory, HR, finance, payroll, packhouse, QA, procurement, sales, logistics, maintenance, executive, supervisor, auditor, employee, super admin) |
| Cross-module access matrix (7 probes: farm→finance, inventory→HR, QA→user admin, employee→inventory, auditor→finance, supervisor→sales, logistics→packhouse) | 307 redirect on all 7 |
| Login rate limiting | 429 with a clear retry message after the configured window |
| Invalid credentials | 401; unknown email 401 (no account enumeration); locked account 423 |
| Stock receipt → issue → transfer, over-issue | Posted; over-issue refused 409, stock unchanged |
| Idempotent replay of a receipt | Same movement number, no double-post |
| Harvest recorded → packhouse run → QA inspection → QA release | Lot chain created; quarantined until released |
| Packhouse mass-balance violations | 400/409 refused |
| QA officer releasing their own inspection | 403 (segregation of duties) |
| Leave request: self-service, on-behalf, overlap, overdraw, Sunday-only | Correct 200/409/400 outcomes |
| Payroll: draft run → preparer approval → second-user approval | 201 → 403 SoD → 200 with balanced journal (Dr = Cr = 6,680,242.50) |
| Duplicate payroll period | 409 |
| Private chat: non-member read attempt | 403, no content leaked |
| Private document: member download / non-member download | 200 / 404 (existence not disclosed) |
| Chat attachment across conversations | 403 refused |
| CSV and PDF exports | 200; CSV cells escaped, PDF opens (`%PDF-1.4`) |

---

## 2. Dashboards implemented (14 routes, 17 pages)

| # | Dashboard | Route | Real data + actions |
|---|---|---|---|
| 1 | Super Administrator | `/portal/super-admin` | Enterprise KPIs, budget vs actual, approval queue, live audit activity |
| 2 | ├ User & role admin | `/portal/super-admin/users` | Create/reset accounts, role assignment, lock/unlock, deactivate, revoke sessions, security event register |
| 3 | ├ Audit explorer | `/portal/super-admin/audit` | Filterable audit trail (module, actor, text), KPI counters, CSV export |
| 4 | └ Approval governance | `/portal/super-admin/approvals` | Pending queue with role check, decision history, SoD verification column |
| 5 | Executive | `/portal/executive` | Revenue, opex, cash, value-chain throughput, quality exposure, department cost structure |
| 6 | Farm Operations | `/portal/farm` | Crop cycles, harvest batches, field activity log, PHI watchlist, **harvest recording** (creates traceable lot) |
| 7 | Inventory | `/portal/inventory` | Valuation, reorder alerts, lot watchlist, **receipt/issue/transfer desk** with transactional guards |
| 8 | Packhouse | `/portal/packhouse` | Yield and variance accounting, cold-room temps, **packhouse run recording** (consumes harvest lot, creates quarantined finished lot) |
| 9 | Quality Assurance | `/portal/qa` | Inspection register, outcome trend, NCR/CAPA, **inspection recording** (server-decided outcome) and **release/hold/destroy** |
| 10 | Procurement | `/portal/procurement` | Requisitions, POs, GRNs, three-way match, spend by supplier, **requisition raising** (value-routed approval) and **goods receipting** |
| 11 | Sales & Export | `/portal/sales` | Order book, allocation fill rate, market/customer revenue, export document register, **order state machine** |
| 12 | Logistics | `/portal/logistics` | Fleet and reefer ranges, shipment register, cold-chain exceptions, **dispatch** (temperature-gated) and **POD/arrival events** |
| 13 | Maintenance | `/portal/maintenance` | Asset register, service dues, work orders, cost by type, **work order raising** and **completion** (consumes spares FIFO) |
| 14 | Human Resources | `/portal/hr` | Headcount, attendance, leave queue, overtime, recruitment funnel, training compliance, **leave submission** and **approval decisions** |
| 15 | Finance & Payroll | `/portal/finance` | Trial balance, payables ageing, expense register, payroll runs, statutory rule versions, **payroll computation** and **approval/posting** |
| 16 | Workspaces | `/portal/workspaces` | Employee self-service (payslips + PDF, leave balances, attendance, requests), supervisor team view + approval queue, auditor read-only trail |
| 17 | Private Communications | `/portal/communications` | Conversation list with unread badges, message thread, receipts, **attachments**, start-conversation policy |

Navigation is filtered by permission in the shell, but **every** page re-checks permissions server-side
and redirects unauthorized users; every API route re-checks independently.

---

## 3. Security, privacy and integrity controls (implemented and tested)

- bcrypt password hashing (cost 10); hashed opaque session tokens; `httpOnly`/`SameSite=Lax` cookies,
  `Secure` in production; lockout after configured failures; security event register.
- 16 roles / 45 permission codes; permission resolution from the database (custom roles supported).
- Approvals: role-routed, **submitter can never decide their own request**; decisions cascade to the
  underlying record and post stock/ledger effects; unauthorized attempts are audited.
- Payroll: preparer ≠ approver; payslip-to-header reconciliation required; unbalanced journal aborts
  approval; statutory liabilities credited to distinct control accounts.
- Inventory: no negative stock; quarantined/blocked/expired lots cannot be issued; corrections are
  posted as approved adjustments with a ledger movement, never silent edits; idempotency keys.
- QA: outcome derived from measurements (temperature limits, defect thresholds, pest/residue flags);
  release authority separated from inspection authority; failed batches cannot be released while an
  NCR is open.
- Chat: conversation membership gate on every read/write/mark-read/attachment call; non-members get
  403 and see no content; message bodies never appear in notifications, audit summaries or global
  search; revoked members lose access immediately; cross-conversation attachments refused.
- Documents: stored outside the web root, MIME allowlist, 10 MB cap, SHA-256 verified on every read,
  404 (not 403) for unauthorized callers, downloads audited.
- Exports: CSV formula-injection escaping, BOM, `no-store`; PDF generated server-side; every export
  writes an audit entry naming the actor and row count.
- Self-service sign-up (`/signup`): applicants choose an account type mapped to the real roles and
  dashboards (Finance, HR, Inventory, …; **Super Administrator is never requestable**). A request grants
  no access until a `users.manage` holder approves it under Super Admin → Users & Roles (they may grant a
  narrower type, or reject with a recorded reason). Identical responses for new / duplicate / existing
  emails (no enumeration), honeypot, per-IP rate limit, applicant password stored only as a bcrypt hash
  and cleared on decision, approvers notified, every decision audited. Email ownership is **not**
  verified (no email provider configured) — approvers must confirm identity out of band.
- Rate limiting on login, chat sends, uploads and write endpoints; input validation with Zod on every
  mutation. `ApiError` status codes (429 rate limit, 423 lockout, 409 conflict) propagate to the
  client instead of collapsing into a 500.

---

## 4. Known limitations and deferred work

**Deliberate omissions (no fake behaviour anywhere):**

1. **No production PostgreSQL was available in this environment.** The `pg` driver path
   (`DATABASE_URL=postgresql://…`) is implemented and shares the same migrations, but all verification
   ran on embedded PGlite. Run `npm run db:migrate` + `scripts/check-integrity.ts` against your real
   server before go-live.
2. **PGlite is single-process.** The dev server must be stopped before running CLI scripts or tests.
   This is a development-driver constraint, not an application limitation.
3. **No MFA/TOTP flow.** `users.mfa_enabled` exists as a column and is surfaced nowhere; implementing
   TOTP enrolment + verification is outstanding.
4. **Email is not sent.** `EMAIL_PROVIDER=disabled`; all notifications are in-app. Password reset is
   an administrator action (temporary password + audit), not a self-service emailed link.
5. **M-Pesa is configuration only.** No credentials exist in this environment, so no payment code path
   runs and nothing is simulated as successful.
6. **S3 storage driver not implemented.** `PRIVATE_STORAGE_DRIVER=local` is the working path; the S3
   variables are placeholders for a documented extension point.
7. **Chat updates poll every 8 seconds.** No WebSocket/SSE channel; unread counts refresh on poll and
   on navigation.
8. **Rate limiting and idempotency caches are in-process.** Correct for a single instance; a
   multi-instance deployment needs a shared store (Redis/Upstash). Database-level idempotency
   (unique index on `stock_movements.idempotency_key`) still prevents duplicate postings.
9. **Public holidays are not excluded from leave day counts** — only Sundays. A gazetted holiday
   calendar table has not been added.
10. **Sick leave is a single day bank.** The Act's two-tier pay (7 days full, 7 days half) is recorded
    as the statutory basis text but not modelled in pay computation.
11. **Payroll uses `basic_salary_kes` as the period gross base for every pay frequency.** Overtime is
    computed from approved requests, but daily/hourly/piece-rate proration from timesheets is not
    implemented — casual labour paid per day will be overstated or understated until this is added.
    This is the single most important payroll gap before real use.
12. **No browser/E2E test suite and no CI workflow file.** The 61 tests are Vitest integration tests
    that call real route handlers and a real database; UI interaction is not covered automatically.
13. **PDF output is text-only** (Helvetica tables, A4 landscape) from a dependency-free writer — no
    letterhead, logo, charts or digital signatures.
14. **Audit log is append-only by convention**, not cryptographically chained. A database superuser
    could alter rows; consider a hash chain or WORM storage for statutory evidence.
15. **Exchange rates are entered per order**; no live rate feed and no revaluation of open balances.
16. **Landing-page imagery** comes from Chalar Farms' public marketing material and is credited as
    such. Confirm licensing (or replace with owned photography) before public deployment. The company
    logo is rendered as an inline mark because the logo file could not be retrieved.
17. **Certification claims are stored as text** (GLOBALG.A.P., GRASP, SMETA, LEAF Marque) with no
    certificate numbers, because inventing them would be fabrication. Enter real numbers when issued.
18. **Timezone handling** assumes server-local dates for "today" KPIs; there is no per-user timezone
    preference.
19. **Dependency advisories remain open** where upgrades are breaking: `tailwindcss@3`
    (postcss-selector-parser, moderate), `zod@3` (high, needs zod 4), `vitest`/`tinypool` (needs
    vitest 5). `next` and `drizzle-orm` were updated to current patched releases. Plan these upgrades
    deliberately rather than mid-delivery.
20. **No barcode/QR label printing or scanner integration** in the packhouse flow; batch codes are
    typed or selected.

---

## 5. Missing environment credentials

Nothing in this repository contains real secrets. `.env.example` holds placeholders only. Before
production you must supply:

| Variable | Needed for |
|---|---|
| `DATABASE_URL` (postgres://…) | Production database |
| `SESSION_SECRET` | Reserved for signed payloads/CSRF tokens (generate with `openssl rand -base64 48`) |
| `SMTP_*` / `EMAIL_PROVIDER` | Email notifications and reset links |
| `MPESA_*` | M-Pesa reconciliation (currently unused) |
| `S3_*` | Object storage for private documents (currently local disk) |
| `NEXT_PUBLIC_APP_URL` | Canonical links in notifications |

---

## 6. Demo data disclosure

All seeded operational records are synthetic and labelled `(Demo)`, using the non-routable
`.demo` TLD (e.g. `hr@chalarfarms.demo` with password `Chalar@Demo2026!`;
`superadmin@chalarfarms.demo` / `Chalar@Admin2026!`). Volumes, yields, prices and customer names
reflect Chalar Farms' publicly stated product mix and markets so the dashboards are plausible, but
**no figure is a real financial or production record**. Set `ENABLE_DEMO_SEED=false` (automatic when
`NODE_ENV=production`) to seed configuration only, then create real accounts through
**Super Admin → Users & Roles**.

---

## 7. Recommended next steps (priority order)

1. Point `DATABASE_URL` at a managed PostgreSQL instance, run migrations, seed configuration only,
   and re-run `scripts/check-integrity.ts`.
2. Implement pay-frequency-aware payroll (daily/hourly/piece-rate from approved timesheets) — the
   largest functional gap for a 150-person farm workforce.
3. Add a gazetted public-holiday calendar and tiered sick-leave pay.
4. Add TOTP MFA for administrators and finance roles.
5. Move rate limiting and idempotency to Redis before running more than one app instance.
6. Add CI (typecheck → tests → build → integrity script) and a Playwright suite for the login,
   chat-privacy and payroll-approval journeys.
7. Configure SMTP so approvals and QA escalations reach people outside the portal.
8. Rotate all demo credentials, disable the demo seed, and rehearse a database + documents restore.
