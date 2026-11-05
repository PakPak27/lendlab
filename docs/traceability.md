# LendLab — Requirements-to-Feature Traceability

Version v0.1 — 2026-11-05. Sources: [srs.md](srs.md), [features.md](features.md), Sprint 1 contracts in [sprints/sprint-1/](sprints/sprint-1/).

Sprint 1 rows link to acceptance criteria (AC) and tests (TEST). Later-sprint rows have a feature and sprint allocation now; their AC and tests are written in the Sprint 2/3 contracts.

### Version history

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-11-05 | Baseline matrix; Sprint 1 AC/TEST links added |

## 1. Functional requirements

| Requirement | Statement (short) | Feature(s) | Sprint | AC / planned verification |
|---|---|---|---|---|
| FR-01 | Sign in | F-01 | 1 | AC-01-01, AC-01-02, AC-01-03, AC-01-07 / TEST-01-01…04, TEST-01-09, TEST-01-10 |
| FR-02 | Sign out | F-01 | 1 | AC-01-05 / TEST-01-06, TEST-01-10 |
| FR-03 | Show identity and role home | F-01, F-02 | 1 | AC-01-04, AC-01-08, AC-02-07 / TEST-01-05, TEST-01-10, TEST-02-08 |
| FR-04 | View catalog | F-03 | 1 | AC-03-01…05 / TEST-03-01…06 |
| FR-05 | Request an available item | F-04 | 1 | AC-04-01, AC-04-04, AC-04-07 / TEST-04-01, TEST-04-05…08, TEST-04-11, TEST-04-12 |
| FR-06 | View own requests and loans | F-04 | 1 | AC-04-05, AC-04-06 / TEST-04-09, TEST-04-10 |
| FR-07 | Custodian views pending requests | F-05 | 1 | AC-05-01 / TEST-05-01 |
| FR-08 | Custodian checks out | F-05 | 1 | AC-05-02, AC-05-06, AC-05-07 / TEST-05-02, TEST-05-07, TEST-05-08 |
| FR-09 | Custodian rejects with reason | F-06 | 2 | Sprint 2 contract |
| FR-10 | Borrower cancels | F-06 | 2 | Sprint 2 contract |
| FR-11 | Record return | F-07 | 2 | Sprint 2 contract |
| FR-12 | Overdue display | F-08 | 2 | Sprint 2 contract |
| FR-13 | Add / edit items | F-10 | 2 | Sprint 2 contract |
| FR-14 | Change item status | F-10 | 2 | Sprint 2 contract |
| FR-15 | Search and filter catalog | F-11 | 3 | Sprint 3 contract |
| FR-16 | Inventory summary | F-12 | 3 | Sprint 3 contract |
| FR-17 | Loan report | F-12 | 3 | Sprint 3 contract |
| FR-18 | Item loan history | F-13 | 3 | Sprint 3 contract |
| FR-19 | Custodian views active loans | F-07 | 2 | Sprint 2 contract |

## 2. Business rules

| Rule | Statement (short) | Feature(s) | Sprint | AC / planned verification |
|---|---|---|---|---|
| BR-01 | Only Available items can be requested | F-04 | 1 | AC-04-02 / TEST-04-02 |
| BR-02 | One open commitment per item; request reserves item | F-04, F-05 | 1 | AC-04-01, AC-04-03, AC-05-04 / TEST-04-01, TEST-04-03, TEST-04-04, TEST-05-04, TEST-05-06 |
| BR-03 | Checkout only for Pending + Reserved; atomic; once | F-05 | 1 | AC-05-02, AC-05-03, AC-05-05 / TEST-05-02, TEST-05-03, TEST-05-05 |
| BR-04 | Loan length 1–14 days; due date = checkout + days | F-04, F-05 | 1 | AC-04-04, AC-05-02 / TEST-04-05, TEST-04-06, TEST-05-02, TEST-05-09 |
| BR-05 | Custodian acts only in assigned locations | F-02, F-05, F-10 | 1 (F-10 in 2) | AC-02-05, AC-02-06 / TEST-02-05, TEST-02-06 |
| BR-06 | Borrower sees only own records | F-02, F-04 | 1 | AC-02-04, AC-04-05 / TEST-02-04, TEST-04-09 |
| BR-07 | Role restrictions on operations | F-02 | 1 | AC-02-02, AC-02-03 / TEST-02-02, TEST-02-03, TEST-02-07 |
| BR-08 | Max 3 open commitments per borrower | F-09 | 2 | Sprint 2 contract |
| BR-09 | Rejection reason; release item | F-06 | 2 | Sprint 2 contract |
| BR-10 | Return sets loan Returned and item Available/Maintenance | F-07 | 2 | Sprint 2 contract |
| BR-11 | Overdue definition | F-08 | 2 | Sprint 2 contract |
| BR-12 | Overdue borrowers cannot request | F-08 | 2 | Sprint 2 contract |
| BR-13 | Status change restrictions | F-10 | 2 | Sprint 2 contract |
| BR-14 | Purpose 5–200 characters | F-04 | 1 | AC-04-04 / TEST-04-07 |

## 3. Non-functional requirements

| NFR | Statement (short) | Feature / responsibility | Sprint | AC / planned verification |
|---|---|---|---|---|
| NFR-01 | bcrypt; never return hash | F-01 | 1 | AC-01-01, AC-01-06 / TEST-01-01, TEST-01-08 |
| NFR-02 | 401 without session, no data | F-01, F-02 | 1 | AC-01-04, AC-02-01 / TEST-01-05, TEST-02-01 |
| NFR-03 | Backend authorization; 403/404, no change | F-02 | 1 | AC-02-02…06 / TEST-02-02…06 |
| NFR-04 | 8 h expiry; logout revokes | F-01 | 1 | AC-01-04, AC-01-05 / TEST-01-05, TEST-01-06, TEST-01-07 |
| NFR-05 | No double reservation / loan under concurrency | F-04, F-05 | 1 | AC-04-03, AC-05-04 / TEST-04-03, TEST-04-04, TEST-05-04, TEST-05-06 |
| NFR-06 | Data survives restart and redeploy | SYS-01, SYS-02 | 1 / Lab 5 | SIT-02 (manual, Sprint 1); Lab 5 C-05 |
| NFR-07 | Catalog p95 < 500 ms at 200 items | F-11 | 3 | Sprint 3 contract |
| NFR-08 | Usable at 375 px and 1280 px | SYS-03 | 2 / 3 | Sprint 2/3 contracts |
| NFR-09 | Settings from environment; no secrets in Git | SYS-01, SYS-02 | 1 / Lab 5 | SDS §8 review; `.env.example`; Lab 5 C-03 |
| NFR-10 | Keyboard and contrast | SYS-03 | 3 | Sprint 3 contract |
| NFR-11 | Standard JSON error shape | SYS-01 | 1 | Asserted in every negative API test (e.g. TEST-01-02, TEST-04-02) |
| NFR-12 | Docker image on Cloud Run + Cloud SQL | SYS-02 | Lab 5 | Lab 5 evidence |

## 4. Coverage check

| Check | Result (v0.1) |
|---|---|
| Every FR (19), BR (14), and NFR (12) is mapped to at least one feature or system responsibility | ✅ Yes |
| Every Sprint 1 requirement has at least one AC and one planned automated test | ✅ Yes (NFR-06 and NFR-09 are also checked manually / by review in Sprint 1) |
| Requirements without a feature | None |
| Approved changes since baseline | None yet. Changes will be added here as `CHG-nn` rows with date and reason. |
