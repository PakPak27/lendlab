# Lab 7 — CHG-01 impact analysis (BR-04 maximum loan length per category)

Version v0.1 — 2026-11-26. Change request: Issue #50. Written before any code change.

## 1. Versions

| Role | Commit / version |
|---|---|
| Accepted Sprint 1 baseline (old behavior first released) | tag `v0.1.0` = `00ee8601a32f6b1fda8455816da051b6fdad8741` |
| Accepted release used for Lab 6 UAT (deployed) | `main` = `1bc5b4f819a1e07c0ae8930cfa902ca3cea11265` |
| Pre-change implementation (branch point of this change) | `staging` = `271a5e9153b651ed966a5d19ea3ac9bf2f9a770b` |
| Development between `1bc5b4f` and `271a5e9` | Lab 6 only: PR #35 (UAT documents) and PR #49 (Lab 6 Part D controlled defect on BR-14, not related to BR-04). BR-04 code is identical in the two commits. |

## 2. Old and new rule

| | Rule |
|---|---|
| Old (SRS v0.1 BR-04) | The requested loan length is a whole number of days from **1 to 14**. |
| New (SRS v0.2 BR-04) | Each category has `maxLoanDays` (1–14): Laptop 7, Camera 3, Projector 3, Microcontroller Kit 14. The requested length is a whole number from **1 to the item category's maximum**. Due date unchanged. Older requests keep their length. |

## 3. Impact table

| Requirement | Feature | SRS / Feature SDS / System SDS section | AC | STS tests | Code modules | Impact |
|---|---|---|---|---|---|---|
| BR-04 | F-04 | SRS §5 BR-04, §8 D-07, D-09 (new); F-04 §2 step 3.2, §3, §4, §5, §6; System SDS §2 Category, BorrowRequest | AC-04-04 (revised), AC-04-08 (new) | TEST-04-05, TEST-04-06 (unchanged, Kit item); TEST-04-13, TEST-04-14, TEST-04-15, TEST-04-19 (new) | `server/src/services/requestService.ts` (check in transaction), new `server/src/lib/loanLength.ts` (pure function), `server/src/schemas/requestSchemas.ts` (unchanged 1–14 shape check) | Changed rule, server-side authority |
| BR-04 / FR-05 | F-04 UI, F-03 item detail | F-04 §6; F-03 §5 `GET /api/items/:id` (v0.3) | AC-04-09 (new), AC-04-07 | TEST-04-12 (expected message revised), TEST-04-16, TEST-04-17 (new) | `server/src/services/itemService.ts` (detail select), `client/src/api/items.ts` (type), `client/src/pages/RequestPage.tsx` (label, default, `max`, validation) | UI mirrors the server; server stays the authority |
| BR-04 (historical data) | F-05 | F-05 v0.3 history; F-04 §4 migration note | AC-04-10 (new), AC-05-02 | TEST-04-18 (new), TEST-05-02, TEST-05-09 | `server/src/services/checkoutService.ts` — no change (uses stored `requestedDays`) | Old Pending/Fulfilled requests are not re-checked |
| Persistence | SYS-01 | System SDS §2 Category | AC-04-08 | TEST-04-19 | `server/prisma/schema.prisma`, new migration `category_max_loan_days`, `server/prisma/seed.ts` | New column + CHECK + values in one migration; seed sets the same values on create and update |

## 4. Checklist of affected areas

| Area | Affected? | Reason / action |
|---|---|---|
| Callers / dependencies | Yes | `createRequest` is the only writer of `BorrowRequest`. Checkout reads `requestedDays` and is unchanged. The catalog list and `GET /api/categories` do not expose the new field, so the Lab 5 smoke test and TEST-03-01 are unaffected. |
| API validation | Yes | Zod keeps the 1–14 shape check; the category check runs in the service because it needs the item. Same `400 VALIDATION_ERROR` shape (NFR-11) with `field: "requestedDays"`. |
| UI validation | Yes | Form reads `category.maxLoanDays` from item detail; client check mirrors the server. |
| Roles / ownership | No change | Only Borrowers create requests (BR-07); the check runs after authentication and role checks. No endpoint lets anyone change `maxLoanDays`. Regression: TEST-02-02, TEST-02-03 (`access.test.ts`). |
| Persistence / migration | Yes | Additive column with default 14, so the migration is safe on the live database; values set by name. |
| Historical data | Yes | Rows above the new maximum stay valid and can be checked out (AC-04-10). Before release we count live Pending requests above their new maximum and record the number. |
| Concurrency (NFR-05) | No change | The check happens before the conditional update in the same transaction; a `400` reserves nothing. Regression: TEST-04-03, TEST-04-04. |
| Calculation precision | No change | Whole days only; `computeDueDate` is unchanged (TEST-05-09). |
| Security / secrets | Not applicable | No new configuration or secret. |
| Deployment | Yes | The migration job runs before the service update (`deploy/release.sh`); a failed migration stops the release. |

## 5. Behavior that must not change, and its regression tests

| Preserved behavior | Regression tests |
|---|---|
| Purpose 5–200 characters (BR-14) | TEST-04-07 (`requestInput.test.ts`, `requests.test.ts`), RequestPage component tests |
| Only Available items; one open commitment; concurrency (BR-01, BR-02, NFR-05) | TEST-04-02, TEST-04-03, TEST-04-04 |
| Loan length shape: 0, 15, 2.5, "7" rejected; 1 and 14 accepted for a Kit | TEST-04-05, TEST-04-06 (unchanged, ARD items) |
| Checkout and due date (BR-03, BR-04 due date) | TEST-05-02…09 |
| Access rules (BR-05, BR-06, BR-07, NFR-02, NFR-03) | TEST-02-01…08, TEST-04-09, TEST-04-10 |
| Catalog list and categories response shape | TEST-03-01, TEST-03-04 |

The whole server and client suites run in CI on every PR (`test-and-docker`). Old tests are only changed where the requirement changed (TEST-04-12's Laptop message and the `validateRequestForm` signature), and each change is listed in the code PR.
