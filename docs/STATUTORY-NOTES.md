# Kenyan Statutory & Employment-Law Notes

This document records the rules the ERP implements, where they are configured, and what must be
verified before the system is relied on for statutory filing.

> **Important.** The rates, bands and thresholds below are stored as *configurable, date-effective
> data* — not hardcoded logic — because Kenyan statutory parameters change through Finance Acts,
> NSSF/SHA notices and court decisions. Before using this system for real payroll or statutory
> remittance, confirm the current figures with KRA, NSSF, SHA (formerly NHIF), the Affordable Housing
> Programme secretariat, and a qualified Kenyan payroll practitioner or advocate. Nothing here is
> legal or tax advice.

---

## 1. Where the rules live

Table `statutory_rule_versions` (one row per effective period):

| Column | Meaning |
|---|---|
| `version_code` | Human reference, e.g. `KE-STAT-2026-V1` |
| `effective_from` / `effective_to` | Inclusive validity window (`NULL` end = open-ended) |
| `personal_relief_kes` | Monthly PAYE personal relief |
| `paye_bands_json` | Ordered graduated bands `[{upToKes, ratePercent}, …]`, last band `upToKes: null` |
| `nssf_rate_percent`, `nssf_tier1_limit_kes`, `nssf_tier2_limit_kes` | NSSF contribution rate and pensionable ceiling |
| `shif_rate_percent` | Social Health Insurance Fund rate on gross pay |
| `ahl_employee_rate_percent`, `ahl_employer_rate_percent` | Affordable Housing Levy shares |
| `is_active` | Allows retiring a version without deleting history |

`src/lib/payroll-service.ts → loadStatutoryRules(asOfDate)` selects the newest version whose
`effective_from <= asOfDate <= effective_to`. Payroll runs store the `version_code` they used, so a
historical run can be recomputed or audited under the rules that applied at the time. If no version
covers the pay date, payroll **refuses to run** rather than silently falling back to defaults.

`src/lib/payroll-calculator.ts` holds the arithmetic. Its `DEFAULT_KENYA_2026_STATUTORY_RULES`
constant exists for unit tests and offline estimation only — production runs always load the database
version.

## 2. Implemented payroll computation

Order of operations (see `calculateKenyanPayroll`):

1. **Gross pay** = basic pay + approved overtime pay + allowances.
   Overtime pay is derived from `overtime_requests` (status `APPROVED`, work date inside the period)
   as `hours × (basic ÷ 208) × multiplier`, where 208 is the standard monthly hours constant
   (`STANDARD_MONTHLY_HOURS`) and the multiplier comes from the request (typically 1.5 weekday /
   2.0 rest day).
2. **NSSF** = `min(gross, nssf_tier2_limit) × nssf_rate%`, employee share; employer contributes the
   same amount (equal-share scheme). Tier I/II split is represented by the ceiling; the seeded version
   uses Tier I 8,000 / Tier II 72,000 with 6% each side.
3. **SHIF** = `gross × shif_rate%`, floored at **KES 300** whenever gross pay is greater than zero
   (2.75% in the seeded 2026 version).
4. **Affordable Housing Levy** = `gross × 1.5%` employee **and** `gross × 1.5%` employer.
5. **Taxable pay** = `gross − NSSF(employee) − SHIF − Housing Levy(employee)`.
6. **PAYE** = graduated bands applied to taxable pay, then less **personal relief** (KES 2,400/month in
   the seeded version). Where taxable pay does not exceed the first band ceiling (24,000), PAYE is
   zero, which reproduces the effect of relief for low earners.
7. **Net pay** = `gross − (NSSF + SHIF + AHL + PAYE + other deductions)`, floored at zero.

Seeded 2026 bands (`KE-STAT-2026-V1`):

| Band | Rate |
|---|---|
| Up to 24,000 | 10% |
| 24,001 – 32,333 | 25% |
| 32,334 – 500,000 | 30% |
| 500,001 – 800,000 | 32.5% |
| Above 800,000 | 35% |

Worked examples (also asserted in `tests/payroll.test.ts`):

| Gross | NSSF | SHIF | AHL | Taxable | PAYE | Net |
|---|---|---|---|---|---|---|
| 10,000 | 600.00 | 300.00 (floor) | 150.00 | 8,950.00 | 0.00 | 8,950.00 |
| 30,000 | 1,800.00 | 825.00 | 450.00 | 26,925.00 | 731.25 | 26,193.75 |
| 250,000 | 4,320.00 (ceiling) | 6,875.00 | 3,750.00 | 235,055.00 | 62,899.85 | 172,155.15 |

### Ledger treatment on approval
Approving a payroll run posts a balanced journal:
- **Debit** `6000 Employee Salaries & Wages` (gross) and `6100 Statutory Employer Contributions`
  (employer NSSF + employer housing levy)
- **Credit** `2100 PAYE Payable`, `2110 NSSF Payable` (both shares), `2120 SHIF Payable`,
  `2130 Affordable Housing Levy Payable` (both shares), and `1000 Cash` (net pay plus other deductions)

Approval is refused if the payslip totals do not reconcile with the run header, or if the resulting
journal would not balance. The preparer cannot approve their own run.

### What is *not* computed
- PAYE on benefits-in-kind, non-cash allowances or per-diem rules
- Proration for mid-month joiners/leavers, unpaid leave deductions, or salary advances/loans
- NSSF voluntary/opt-out elections and Tier I vs Tier II split reporting per member
- Statutory *remittance* filing (P9/P10 forms, eTIMS, iTax returns) — the ERP records liabilities and
  produces registers; filing remains a human/agent step
- Piece-rate wage computation for casual labour (see the payroll frequency note below)

## 3. Employment Act 2007 — leave configuration

Leave types are data (`leave_types`) with an explicit `statutory_basis` string shown in the UI:

| Code | Days (default) | Basis recorded in the system |
|---|---|---|
| `ANNUAL` | 21 | Employment Act 2007 §28 — 21 working days after 12 consecutive months of service |
| `SICK` | 60 | Employment Act 2007 §30 — 7 days full pay then 7 days half pay per year, after 2 consecutive months of service; extended schemes are contractual |
| `MATERNITY` | 91 | Employment Act 2007 §29 — 3 months with full pay |
| `PATERNITY` | 14 | Employment Act 2007 §29A — 2 weeks |
| `FAMILY` | 14 | Employment Act 2007 §29 — family responsibility leave (bereavement/illness of immediate family) |
| `UNPAID` | 30 | Company policy (configurable, not statutory) |

Implementation notes:
- Entitlements are per employee per year in `leave_balances` (`entitled`, `used`, `pending`,
  `remaining`). Submitting a request moves days into `pending`; approval moves them to `used`;
  rejection returns them. Overdraw is refused with the exact arithmetic in the error message.
- The `default_annual_days` figures are *defaults for configuration*, not legal advice. Sick leave in
  particular is expressed by the Act in two tiers (full pay then half pay) — this system models a
  single configurable day bank and flags the statutory basis; a pay-tiered sick-leave engine is not
  implemented (see `FEATURE-REPORT.md`).
- Working-day counting excludes **Sundays** (the customary rest day). Public holidays are *not*
  excluded automatically because a gazetted holiday calendar is not configured — see limitations.
- Overlapping requests for the same employee are rejected.

## 4. Working hours, overtime and attendance

- Shifts are data (`shifts`: start/end time, break minutes, standard hours).
- `attendance_records` stores clock-in/out, regular hours, overtime hours, late minutes, status
  (`PRESENT`/`LATE`/`ABSENT`/`ON_LEAVE`) and timesheet approval with the approving user.
- `overtime_requests` carry `requested_hours`, `rate_multiplier` and an approval workflow; only
  approved overtime enters payroll.
- The Employment Act's 52-hour weekly limit and rest-day/night-work premiums are *not* automatically
  enforced — the multiplier on each overtime request is the control point, and supervisors set it.

## 5. Food-safety and export compliance touchpoints

The system records, but does not certify:
- **GLOBALG.A.P. / GRASP / SMETA / LEAF Marque** status is stored on the `farms` record as text claims
  sourced from the company's public marketing material. Certificate numbers are intentionally absent —
  they must be entered when the issuing body provides them.
- **Export documents** (`export_documents`) track type, issuing authority, issue/expiry dates and a
  verification status. Where a number has not been issued, the record shows `pending` rather than a
  fabricated value.
- **Phytosanitary and EUR.1** workflows are represented as document records attached to shipments; the
  ERP does not integrate with KEPHIS or customs systems.
- **Maximum residue limits (MRLs)** appear as a boolean compliance flag on inspections, set by the QA
  officer from laboratory results. Lab result ingestion is not implemented.
- **Cold chain**: crop catalogue stores per-crop temperature ranges and shelf life (most herbs 2–4 °C,
  basil 8–10 °C). Dispatch is blocked when the load temperature or vehicle reefer range cannot meet the
  customer's specification; arrival temperatures outside range raise an exception on the shipment.

## 6. Currency and tax on purchases/sales

- Sales orders store currency, unit price, an explicit `exchange_rate_to_kes`, and both foreign and KES
  totals. Exchange rates are entered per order — there is no live rate feed.
- Supplier invoices support three-way matching (invoice vs PO vs GRN value) with a
  `three_way_match_status` that holds payment when variances exist.
- VAT on expenses is captured as a separate `tax_kes` amount; VAT return preparation, withholding tax
  on payments to suppliers, and eTIMS invoicing are **not** implemented.

## 7. Change control for statutory parameters

1. Finance/HR prepares the new version row with the correct `effective_from` (and closes the previous
   version's `effective_to` if the change is retroactive-by-period).
2. Run a draft payroll for an affected period and compare against a manual calculation.
3. Approve through the normal segregation-of-duties workflow; the run stores the version code used.
4. Keep the superseded version row — historical payslips must remain reproducible.

Every change to `statutory_rule_versions` should be recorded in the audit log with the authority
document (Finance Act section, NSSF/SHA notice, or gazetted regulation) referenced in the change note.
