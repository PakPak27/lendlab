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

## Demo accounts

Created by the seed. The password for all of them is the `DEMO_USER_PASSWORD` you set in `server/.env` (it is not stored in the repository).

| E-mail | Role | Locations |
|---|---|---|
| `borrower1@lendlab.test` | Borrower | — |
| `borrower2@lendlab.test` | Borrower | — |
| `custodian.hw@lendlab.test` | Custodian | HW-LAB (CPE Hardware Lab) |
| `custodian.media@lendlab.test` | Custodian | MEDIA (CPE Media Room) |

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
