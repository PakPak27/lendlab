# Sprint 2 — Engineering Contracts Index

Version v0.1 — 2026-11-28. Sprint goal and scope: [plan.md](../plan.md) (Sprint 2: complete the core borrowing life cycle).

| Feature | Contract | Requirements |
|---|---|---|
| F-06 Request Rejection and Cancellation | [F-06-reject-cancel.md](F-06-reject-cancel.md) | FR-09, FR-10, BR-09 |
| F-07 Active Loans and Returns | [F-07-returns.md](F-07-returns.md) | FR-11, FR-19, BR-10 |
| F-08 Due Dates and Overdue Status | [F-08-overdue.md](F-08-overdue.md) | FR-12, BR-11, BR-12 |
| F-09 Borrowing Limit | [F-09-borrowing-limit.md](F-09-borrowing-limit.md) | BR-08 |
| F-10 Inventory Management | [F-10-inventory.md](F-10-inventory.md) | FR-13, FR-14, BR-05, BR-13 |
| SYS-03 (responsive part) | [SYS-03-responsive.md](SYS-03-responsive.md) | NFR-08 |

### Version history

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-11-28 | Contracts written and reviewed before implementation (Deliverable 2). |

## How the contracts are used

Same process as Sprint 1 ([sprint-1/README.md](../sprint-1/README.md)): the contract PR is reviewed by the teammate **before** the feature branches; each business rule gets a failing test commit (`test(F-0x): ... RED`) before the implementation commit (`feat(F-0x): ... GREEN`); contract changes found during implementation get a new version-history row; history is never rewritten.

## Order of checks when a borrower creates a request (F-04 with F-08 and F-09)

`401` (no session) → `403` (not a borrower) → `400` (input shape) → `404 ITEM_NOT_FOUND` → `400` (loan length above the category maximum, BR-04) → `409 OVERDUE_LOAN` (BR-12) → `409 BORROWING_LIMIT` (BR-08) → `409 ITEM_NOT_AVAILABLE` (BR-01). The first failing check decides the answer; a rejected request changes nothing.

## Changes to existing Sprint 1 behaviour

| Area | Change | Regression protection |
|---|---|---|
| `POST /api/requests` (F-04) | Two new `409` rules (BR-12, BR-08) before the availability check | All TEST-04-xx keep passing; their test borrowers have no overdue loan and fewer than 3 commitments |
| `GET /api/requests/mine` (F-04) | Each `loan` gains `isOverdue`; rejected requests show `decisionNote` | TEST-04-08 (own requests only) unchanged |
| Custodian navigation (F-02) | New pages Loans and Inventory | TEST-02-xx access tests unchanged; new access tests per feature |
| Catalog (F-03) | Retired items stay hidden (unchanged); items added in F-10 appear | TEST-03-xx unchanged |

## Test levels and locations

| Level | Tool | Location | Command |
|---|---|---|---|
| Unit | Vitest | `server/tests/unit/*.test.ts` | `npm run test:unit -w server` |
| API / integration (real PostgreSQL) | Vitest + Supertest | `server/tests/api/*.test.ts` | `npm run test:api -w server` |
| Component | Vitest + React Testing Library | `client/src/**/*.test.tsx` | `npm run test -w client` |
| End-to-end / viewport | Playwright | `client/e2e/*.spec.ts` | `npm run test:e2e -w client` |

## Sprint 2 integration checks (on `staging` before the release PR)

| ID | Level | Steps | Expected |
|---|---|---|---|
| SIT2-01 | Automated | All unit, API and component suites on the staging commit (CI `test-and-docker`) | All pass; counts recorded |
| SIT2-02 | E2E (local) | Full journey: request → reject; request → cancel; request → checkout → return with maintenance → custodian sets Available | Each state shown in the UI and confirmed by the API |
| SIT2-03 | Cross-feature (API) | Borrower with 3 commitments and an overdue loan requests an item | `409 OVERDUE_LOAN` (BR-12 checked before BR-08); nothing changes |
| SIT2-04 | Post-deploy (manual) | On the deployed release: reject, cancel, return, overdue badge, inventory add/status, forbidden role checks | Matches the AC; screenshots and API output kept |

## Product Definition of Done

The Sprint 1 Definition of Done ([sprint-1/README.md](../sprint-1/README.md), criteria 1–9) applies to every Sprint 2 feature, with the integration branch `staging`. In addition: every new endpoint has a forbidden-role test (wrong role → `403`) and an out-of-scope test (another custodian's location or another borrower's record → `404`), and every state change is checked in the database, not only in the response.
