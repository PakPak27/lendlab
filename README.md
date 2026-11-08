# LendLab

CPE Department Equipment Lending System — CPE 334 Group Project, Theme 2 (Inventory and Borrowing System).

Borrowers request specific equipment items; custodians check them out and track loans. See [docs/srs.md](docs/srs.md) for requirements and [docs/system-sds.md](docs/system-sds.md) for the design.

## Stack

React 18 + TypeScript + Vite + Bootstrap (client) · Node.js + Express + TypeScript (server) · PostgreSQL 16 + Prisma 5.22 · Vitest, Supertest, React Testing Library, Playwright.

## Prerequisites

- Node.js 20 or newer (`node -v`)
- PostgreSQL 16 — either Docker Desktop (recommended) or a local PostgreSQL installation

## Setup (first time)

All commands run from the repository root unless stated otherwise.

**1. Install dependencies**

```bash
npm install
```

**2. Start PostgreSQL**

With Docker (creates the `lendlab` and `lendlab_test` databases automatically):

```bash
docker compose up -d db
```

Without Docker: create a user `lendlab` (password `lendlab`) and two databases owned by it, `lendlab` and `lendlab_test`.

If port 5432 is already used on your machine (for example by a local PostgreSQL service), change the left side of the port mapping in `docker-compose.yml` (for example `127.0.0.1:55432:5432`) and use the same port in the `DATABASE_URL` of both env files in step 3.

**3. Create the environment files** (never commit these)

```bash
cp server/.env.example server/.env
cp server/.env.example server/.env.test
```

Windows PowerShell: use `Copy-Item` instead of `cp`.

Then edit them:

| File | Change |
|---|---|
| `server/.env` | Set `DEMO_USER_PASSWORD` to a password of your choice (8+ characters). |
| `server/.env.test` | Change the database name in `DATABASE_URL` from `/lendlab?` to `/lendlab_test?` and set `NODE_ENV=test`. |

**4. Create the tables and load demo data**

```bash
npm run db:migrate
npm run db:seed
```

## Run

Use two terminals:

| Terminal | Command | URL |
|---|---|---|
| Terminal 1 | `npm run dev:server` | API at http://localhost:3000/api/health |
| Terminal 2 | `npm run dev:client` | App at http://localhost:5173 |

## Test

| Level | Command |
|---|---|
| Server unit tests | `npm run test:unit -w server` |
| Server API/integration tests (uses `lendlab_test`) | `npm run test:api -w server` |
| Client component tests | `npm run test -w client` |
| End-to-end (both servers running; first time: `npx playwright install chromium`) | `npm run test:e2e -w client` (Terminal 3) |
| Everything except E2E | `npm test` |

The API tests empty and re-seed `lendlab_test` before each test file. They refuse to run against a database whose name does not end in `_test`.

### End-to-end tests (Playwright)

The E2E specs sign in through the real UI, so they need both servers running (`npm run dev:server`, `npm run dev:client`) against a **freshly migrated and seeded** database, and two environment variables:

| Variable | Value |
|---|---|
| `E2E_PASSWORD` | The `DEMO_USER_PASSWORD` you gave to `npm run db:seed`. |
| `E2E_DATABASE_URL` | The `DATABASE_URL` the running server uses (`server/.env`). The specs use it to put the borrowing data back to the seeded state before each test, so they do not depend on the order they run in. |

```bash
# from the repository root (Git Bash / macOS / Linux)
E2E_PASSWORD="<your seed password>" E2E_DATABASE_URL="<DATABASE_URL from server/.env>" npm run test:e2e -w client
```

PowerShell: set `$env:E2E_PASSWORD` and `$env:E2E_DATABASE_URL` first, then run `npm run test:e2e -w client`.

**A spec is skipped, not failed, when `E2E_PASSWORD` is missing** (the specs that reset data are also skipped without `E2E_DATABASE_URL`). A run without them can therefore look green, so check the summary: the full suite is **13 tests, 0 skipped**. To save screenshots for the report, also set `E2E_EVIDENCE_DIR` to an existing folder.

## Demo accounts

Created by the seed. The password for all of them is the `DEMO_USER_PASSWORD` you set in `server/.env` (it is not stored in the repository).

| E-mail | Role | Locations |
|---|---|---|
| `borrower1@lendlab.test` | Borrower | — |
| `borrower2@lendlab.test` | Borrower | — |
| `custodian.hw@lendlab.test` | Custodian | HW-LAB (CPE Hardware Lab) |
| `custodian.media@lendlab.test` | Custodian | MEDIA (CPE Media Room) |

## Demo sequence (about 3 minutes)

1. Sign in as `borrower1@lendlab.test` → **Catalog** shows items and their status; `ARD-003` is in Maintenance and cannot be requested.
2. **Request** `LAP-001` (purpose, 5 days) → **My Borrowing** shows it as *Pending*. The catalog now shows `LAP-001` as *Reserved*.
3. Sign out. Sign in as `borrower2@lendlab.test` and open the request form for `LAP-001` → "no longer available" (rule rejection).
4. Sign out. Sign in as `custodian.hw@lendlab.test` → **Requests** lists the pending request → **Check out** → confirm → the toast shows the due date. A borrower who opens `/custodian/requests` sees the "no access" page, and the API answers 403 (forbidden operation).
5. Sign out. Sign in as `custodian.media@lendlab.test`: the HW-LAB request is not in this queue (location scope).
6. Sign in again as `borrower1` → **My Borrowing** shows *On loan* with the due date.

## Sprint integration checks

[docs/sprints/sprint-1/README.md](docs/sprints/sprint-1/README.md) lists SIT-01 to SIT-03. Results and screenshots are in [docs/evidence/SIT](docs/evidence/SIT) (E2E run, journey screenshots, and the restart check SIT-02 with before/after screenshots).

## Environment variables

See `server/.env.example` and `client/.env.example`, and the full table in [docs/system-sds.md §8](docs/system-sds.md#8-configuration).

## Project documents

| Document | Path |
|---|---|
| SRS (Part A) | [docs/srs.md](docs/srs.md) |
| Feature inventory and traceability (Part B) | [docs/features.md](docs/features.md), [docs/traceability.md](docs/traceability.md) |
| System-Level SDS (Part C) | [docs/system-sds.md](docs/system-sds.md) |
| Three-sprint plan (Part D) | [docs/sprints/plan.md](docs/sprints/plan.md) |
| Sprint 1 contracts (Part E) | [docs/sprints/sprint-1/](docs/sprints/sprint-1/) |
