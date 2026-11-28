# F-12 Inventory and Loan Reports — Engineering Contract

| Item | Value |
|---|---|
| Feature | F-12 Inventory and Loan Reports |
| Requirements | FR-16, FR-17, BR-05, BR-11 |
| Sprint | Sprint 3 |
| Depends on | F-07, F-08 |

### Version history

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-11-28 | Contract written before implementation |

## 1. Purpose and scope

A custodian sees (1) item counts by status for each of their locations and (2) a loan report for a date range: loans created (checked out), loans returned, and loans currently overdue. Read-only; no export in this release.

## 2. Workflow

`/custodian/reports` shows the inventory summary table and a date-range form (From, To; default the last 30 days) → **Show report** → three tables with counts and rows.

## 3. Business rules and validation

| Rule | Implementation |
|---|---|
| FR-16 | Group `Item` by `locationId, status` for the custodian's locations; every status column appears, with 0 where empty; Retired counted separately |
| FR-17 | Dates `from`, `to` as `YYYY-MM-DD` in Asia/Bangkok, `from ≤ to`, range ≤ 366 days (`400` otherwise); "created" = `checkedOutAt` in `[from 00:00, to 23:59:59.999]`; "returned" = `returnedAt` in range; "overdue" = BR-11 at the time of the request (not limited by the range) |
| BR-05 | Only the custodian's locations |

## 4. Data model changes

None.

## 5. API specification

`GET /api/custodian/reports/inventory` → `200 { "locations": [ { id, code, name, counts: { AVAILABLE, RESERVED, ON_LOAN, MAINTENANCE, RETIRED }, total } ] }`.
`GET /api/custodian/reports/loans?from=2026-11-01&to=2026-11-30` → `200 { from, to, created: { count, loans: [...] }, returned: { count, loans: [...] }, overdue: { count, loans: [...] } }`; loan rows: `{ id, item: { assetTag, name }, borrower: { name }, checkedOutAt, dueAt, returnedAt }`.
Errors: `400 VALIDATION_ERROR` (dates), `401`, `403`.

## 6. UI behavior

Nav link **Reports** for custodians; tables become cards below 768 px (SYS-03); counts in a summary row.

## 7. Permissions

Custodians, own locations. Borrowers `403`.

## 8. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-12-01 | For custodian.hw, the inventory report lists HW-LAB with the counts that match the seeded items per status and a total; MEDIA is absent. |
| AC-12-02 | Given loans checked out on 5, 15 and 25 Nov and one returned on 20 Nov, the range 10–20 Nov returns created = 1 (15 Nov) and returned = 1. |
| AC-12-03 | An Active loan past its due date appears in `overdue` whatever the range. |
| AC-12-04 | `from > to`, a bad date, and a range over 366 days are `400`; borrowers get `403`. |
| AC-12-05 | In the UI the custodian picks a range and sees the three counts and rows. |

## 9. Software Test Specification

| Test ID | AC | Level | File › test | Setup | Action | Expected |
|---|---|---|---|---|---|---|
| TEST-12-01 | AC-12-01 | API | `server/tests/api/reports.test.ts` › "inventory summary" | Seed | GET inventory | counts per status, MEDIA absent |
| TEST-12-02 | AC-12-02 | API | › "loan report range" | Loans with fixed dates | GET loans 10–20 Nov | created 1, returned 1 |
| TEST-12-03 | AC-12-03 | API | › "overdue in any range" | Overdue loan | GET with a past range | overdue contains it |
| TEST-12-04 | AC-12-04 | API | › "validation and role" | — | bad ranges; borrower | 400; 403 |
| TEST-12-05 | AC-12-02 | Unit | `server/tests/unit/reportRange.test.ts` › "Bangkok day bounds" | — | 2026-11-10…2026-11-20 | UTC bounds 2026-11-09T17:00Z … 2026-11-20T16:59:59.999Z |
| TEST-12-06 | AC-12-05 | Component | `client/src/pages/ReportsPage.test.tsx` | Mocked API | choose range | tables and counts |

## 10. Definition of Done

Sprint 2 DoD ([../sprint-2/README.md](../sprint-2/README.md)) applies. Status at Deliverable 2: **planned**.
