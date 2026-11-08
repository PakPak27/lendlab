# Sprint 1 integration test results (Issue #9)

Run on 2026-11-08 on a copy of `sprint-1-staging` at `5667f7a` (merge of #18) plus the Issue #9 branch (E2E journey spec, shared E2E reset helper, README). PostgreSQL 16 in Docker, Node 24, Windows 11.

| ID | What was run | Result | Evidence |
|---|---|---|---|
| SIT-01 | Full Playwright suite on a freshly migrated (`prisma migrate reset`) and seeded database, both dev servers running | **13 passed, 0 failed, 0 skipped**, including TEST-05-08 (full journey) | [e2e.txt](e2e.txt), screenshots `journey-1..4-*.png`, `confirm-dialog.png`, `checked-out-toast.png` |
| SIT-02 | Request + checkout, stop the API server, start it again, sign in again | **Pass.** Same request (FULFILLED), same loan (ACTIVE) and same due date before and after the restart | [sit02-log.txt](sit02-log.txt), [before](sit02-before-restart.png), [after](sit02-after-restart.png) |
| SIT-03 | Server unit, server API (real test database) and client component suites | **All pass:** unit 52, API 141, component 52 (245 tests, 0 failed, 0 skipped) | [unit-api-component.txt](unit-api-component.txt) |

## Commands

```bash
# SIT-01 (both servers running, fresh DB, from the repository root)
E2E_PASSWORD="<seed password>" E2E_DATABASE_URL="<server DATABASE_URL>" E2E_EVIDENCE_DIR="docs/evidence/SIT" npm run test:e2e -w client

# SIT-03
npm run test:unit -w server
npm run test:api -w server
npm run test -w client
```

## Notes and limits

- SIT-02 was driven by a script (API calls plus Playwright screenshots) for the sign-in and the restart; the server was stopped by killing its process and started again with `npm run dev:server`. It is a local check (NFR-06, local), not a redeploy.
- SIT-03 was run in the working clone, not in a second clean clone, because the clone already had `node_modules` and the seeded databases. A clean-clone run following the README is still worth repeating on the release commit.
- The E2E specs skip, rather than fail, when `E2E_PASSWORD` is missing. This run had both variables set, and the summary shows 0 skipped.
- Known limitation carried to the report: no login rate limiting (out of scope in F-01), header overflows at 375 px (tracked for Sprint 2 responsive work).
