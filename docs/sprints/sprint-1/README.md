# Sprint 1 — Engineering Contracts Index

Version v0.1 — 2026-11-05. Sprint goal and scope: [plan.md](../plan.md).

| Feature | Contract | Issue |
|---|---|---|
| SYS-01 Platform Foundation | Described in [system-sds.md](../../system-sds.md) §2, §4, §7, §8 | #3 |
| F-01 Authentication and Session | [F-01-authentication.md](F-01-authentication.md) | #4 |
| F-02 Role and Location Access Control | [F-02-access-control.md](F-02-access-control.md) | #5 |
| F-03 Equipment Catalog | [F-03-catalog.md](F-03-catalog.md) | #6 |
| F-04 Borrow Request and My Borrowing | [F-04-borrow-request.md](F-04-borrow-request.md) | #7 |
| F-05 Request Queue and Checkout | [F-05-checkout.md](F-05-checkout.md) | #8 |

## How the contracts are used

1. A contract is committed and reviewed on `docs/2-sprint1-contracts` **before** the feature branch starts.
2. For each business rule, the test is written first and committed while it fails (commit message `test(F-0x): ... [red]`), then the implementation is committed and the test passes (`feat(F-0x): ... [green]`). Both commit SHAs are recorded in the PR description as TDD evidence.
3. If implementation shows that a contract must change, the contract is edited in the same PR with a new row in its version history explaining why. History is never rewritten.

## Test levels and locations

| Level | Tool | Location | Command |
|---|---|---|---|
| Unit | Vitest | `server/tests/unit/*.test.ts` | `npm run test:unit -w server` |
| API / integration (real test DB) | Vitest + Supertest | `server/tests/api/*.test.ts` | `npm run test:api -w server` |
| Component | Vitest + React Testing Library | `client/src/**/*.test.tsx` | `npm run test -w client` |
| End-to-end | Playwright | `client/e2e/*.spec.ts` | `npm run test:e2e -w client` |

## Sprint integration tests (run on `sprint-1-staging` before the release PR)

| ID | Level | Steps | Expected result |
|---|---|---|---|
| SIT-01 | E2E (automated) | Run the full Playwright suite against a freshly migrated and seeded database. | All E2E tests pass, including TEST-05-08 (full journey). |
| SIT-02 | System (manual) | Create a request and a checkout; stop the server; start it again; sign in again. | The request and loan are still shown (NFR-06, local). Screenshot before/after. |
| SIT-03 | System (automated) | Run all unit, API, component, and E2E suites from a clean clone following the README. | All pass; counts and commit SHA recorded in the Deliverable 1 PDF. |

## Product Definition of Done (applies to every Sprint 1 feature)

A feature is **Done** only when all of the following are true and the evidence exists:

| # | Criterion | Evidence |
|---|---|---|
| 1 | The contract (feature SDS, API/UI/data spec, AC, STS) was committed before the implementation. | Commit history of `docs/sprints/sprint-1/` |
| 2 | Every AC in the contract is implemented. | Demo screenshot or test name per AC |
| 3 | Every planned test in the STS exists, runs, and passes; no test was skipped, deleted, or weakened. | Test output with counts and commit SHA |
| 4 | Business-rule tests show red-then-green TDD history. | Red and green commit SHAs in the PR |
| 5 | Negative tests check status code, error body, **and** that the database did not change. | Test code |
| 6 | No secret, `.env`, or real password is in the diff. | `git status` / diff check in the PR |
| 7 | The PR into `sprint-1-staging` was reviewed and approved by the teammate, with a specific comment (check, question, or finding). | PR link |
| 8 | README and docs are updated if setup, commands, or behavior changed. | PR diff |
| 9 | Known limitations or unfinished parts are written in the PR description. | PR description |
