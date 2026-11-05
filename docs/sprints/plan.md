# LendLab — Three-Sprint Plan

Version v0.1 — 2026-11-05. Feature IDs refer to [features.md](../features.md).

### Version history

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-11-05 | Baseline plan for Sprints 1–3 |

## Overview

| Sprint | Dates | Goal | Features | Checkpoint |
|---|---|---|---|---|
| **1** | 5–8 Nov 2026 | Small working domain slice with authentication, permissions, and persistence: a borrower requests an item and a custodian checks it out. | SYS-01, F-01, F-02, F-03, F-04, F-05 | Deliverable 1 — 8 Nov (release `v0.1.0` on `main`) |
| Lab 5 | 9–15 Nov | Package and deploy the Sprint 1 release; CI quality gate; repeatable release pipeline. | SYS-02 | Lab 5 — 15 Nov |
| **2** | 9–29 Nov | Complete the core borrowing life cycle: reject/cancel, returns, due dates and overdue, borrowing limit, inventory management. | F-06, F-07, F-08, F-09, F-10, SYS-03 (responsive) | Deliverable 2 — 29 Nov (release `v0.2.0`, deployed) |
| **3** | 23 Nov – 13 Dec | Finish remaining features and harden the product: search/filter, reports, item history, accessibility, performance, regression and defect fixes. | F-11, F-12, F-13, SYS-03 (accessibility), NFR-07 | Progress at 29 Nov; final release `v1.0.0` — 13 Dec |

Lab 6 (UAT) and Lab 7 (maintenance change) run on the deployed release during Sprint 2. Defect fixes and the Lab 7 change go through the same Issue → branch → PR → staging → `main` workflow and are labelled `lab6` / `lab7`.

## Sprint 1 — scope and reasoning

**Why this slice.** F-01 to F-05 form the smallest end-to-end journey that meets every Sprint 1 requirement in the Group Work Specification for Theme 2:

| Spec requirement (Theme 2, Sprint 1) | Covered by |
|---|---|
| Seed a small catalog | SYS-01 seed, F-03 |
| Borrower logs in, requests one available item, sees their request | F-01, F-03, F-04 |
| Custodian logs in and records checkout, creating an active loan and updating availability | F-01, F-05 |
| Reject checkout of an unavailable item and duplicate active loans for the same item | BR-01, BR-02, BR-03 (F-04, F-05), concurrency tests |
| Borrower and Custodian roles; borrowers see only their own requests/loans and cannot check out | F-02 |
| Custodians manage authorized inventory and loans | F-02 location scope, F-05 |
| Test cross-borrower access and borrower attempts to change checkout status | TEST-02-02, TEST-02-04 |

**Explicitly deferred from Sprint 1:** returns, rejection/cancellation, overdue, borrowing limit, inventory editing (Sprint 2); search, reports, history (Sprint 3).

**Dependencies within Sprint 1:** SYS-01 → F-01 → F-02 → F-03 → F-04 → F-05. F-03 (catalog UI) can start in parallel with F-02 once F-01's `authenticate` middleware exists.

### Sprint 1 Issues and branches

Both members take part in specification, implementation, testing, and review. Each PR is reviewed by the member who did not author it.

| Issue | Title | Branch | Author | Reviewer | Labels |
|---|---|---|---|---|---|
| #1 | Product baseline docs (SRS, features, traceability, SDS, plan) | `docs/1-baseline` | Pair (@PakPak27 + @Sirazaza) | Each reviews the other's sections | `docs`, `sprint-1` |
| #2 | Sprint 1 feature contracts F-01…F-05 | `docs/2-sprint1-contracts` | Pair (@PakPak27 + @Sirazaza) | Pair | `docs`, `sprint-1` |
| #3 | SYS-01 Project scaffold, Prisma schema, migrations, seed, health | `feat/3-foundation` | @PakPak27 | @Sirazaza | `sprint-1` |
| #4 | F-01 Authentication and session | `feat/4-auth` | @Sirazaza | @PakPak27 | `sprint-1` |
| #5 | F-02 Role and location access control | `feat/5-access-control` | @Sirazaza | @PakPak27 | `sprint-1` |
| #6 | F-03 Equipment catalog | `feat/6-catalog` | @PakPak27 | @Sirazaza | `sprint-1` |
| #7 | F-04 Borrow request and My Borrowing | `feat/7-borrow-request` | @PakPak27 | @Sirazaza | `sprint-1` |
| #8 | F-05 Request queue and checkout | `feat/8-checkout` | @Sirazaza | @PakPak27 | `sprint-1` |
| #9 | Sprint 1 integration tests, E2E journey, README, release | `release/9-sprint1` | Pair | Pair | `sprint-1`, `release` |

Branches start from `sprint-1-staging`. After Issue #9 passes, a release PR `sprint-1-staging → main` is reviewed, merged, and tagged `v0.1.0`.

### Sprint 1 completion outcome

- `main` at tag `v0.1.0` runs locally from the README.
- Demo: borrower signs in → requests `LAP-001` → sees it Pending → custodian of HW-LAB signs in → checks it out → borrower sees On Loan with a due date; requesting `ARD-003` (Maintenance) is rejected; borrower cannot open the custodian queue.
- All Sprint 1 AC have passing automated tests; results recorded with the tested commit.

## Sprint 2 — core expansion

| Feature | Completion outcome | Depends on |
|---|---|---|
| F-06 Rejection and cancellation | Custodian rejects with reason; borrower cancels; item back to Available. | F-04, F-05 |
| F-07 Active loans and returns | Custodian sees active loans and records returns (Available or Maintenance). | F-05 |
| F-08 Due dates and overdue | Overdue badges; overdue borrowers blocked from new requests. | F-07 |
| F-09 Borrowing limit | 4th open commitment rejected. | F-04 |
| F-10 Inventory management | Custodian adds/edits items and changes status within rules. | F-02, F-03 |
| SYS-03 (responsive) | All Sprint 1–2 pages pass 375 px / 1280 px checks. | — |

## Sprint 3 — completion and hardening

| Feature | Completion outcome | Depends on |
|---|---|---|
| F-11 Search and filter | Text search and filters with pagination; NFR-07 timing met. | F-03, F-10 |
| F-12 Reports | Inventory summary and loan report by date range. | F-07, F-08 |
| F-13 Item loan history | Per-item history for custodians. | F-07 |
| SYS-03 (accessibility) | Keyboard and contrast checks pass on all pages. | — |
| Hardening | Regression suite green, UAT defects closed or documented, final README and demo video. | All |

## Risks

| Risk | Mitigation |
|---|---|
| Sprint 1 has only 3–4 days | Smallest slice that meets the spec; reuse Labs 1–4 project structure and test setup. |
| Concurrency tests are flaky | Use a real database, `fileParallelism: false`, and `Promise.all` on two requests; assert final DB state, not timing. |
| Cloud cost (Lab 5 onward) | Budget alert first; Cloud SQL smallest tier; pause when idle. |
