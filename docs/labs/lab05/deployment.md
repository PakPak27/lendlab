# LendLab — Deployment (Lab 5)

How LendLab is configured, built, tested and released to Google Cloud. This file is updated by each Lab 5 Issue (#22 to #30); sections marked *(Issue #NN)* are completed by that Issue.

## 1. Stack

| Layer | Choice | Change from the Lab 5 reference stack |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite + Bootstrap | none |
| API | Node.js + Express + TypeScript | none |
| Database | PostgreSQL 16 + Prisma 5.22 | none |
| Container | One image: Express serves the API and the built React app on one port | none |
| Cloud | Artifact Registry, Cloud Run, Cloud SQL for PostgreSQL, Secret Manager | none |
| CI/CD | GitHub Actions with Workload Identity Federation (no JSON keys) | none |

The app is one container. In production Express serves `client/dist` and the `/api` routes from the same origin, so the browser needs no CORS and the client is built with `VITE_API_URL=""`.

## 2. Environment variables

Every setting comes from the environment. The server validates them at startup (`server/src/config.ts`) and refuses to start if a required value is missing. Placeholders are in `server/.env.example` and `client/.env.example`; real `.env` files are git-ignored and never committed.

| Variable | Read by | Purpose | Secret? | Where the value comes from (local / Cloud Run) |
|---|---|---|---|---|
| `DATABASE_URL` | server | PostgreSQL connection string | **Yes** | local: `server/.env` / cloud: Secret Manager |
| `PORT` | server | HTTP port (default 3000) | No | local: `.env` / cloud: set by Cloud Run |
| `NODE_ENV` | server | `development`, `test` or `production` | No | local: `.env` / cloud: service setting `production` |
| `SESSION_TTL_HOURS` | server | Session lifetime in hours (default 8) | No | `.env` / service setting |
| `CORS_ORIGIN` | server | Allowed browser origin for the Vite dev server; unset in production (same origin) | No | local only |
| `GIT_SHA` | server | Full commit SHA of the running release, shown by `GET /api/health` (R-08) | No | local: empty (reports `local`) / cloud: set by the deploy pipeline |
| `DEMO_USER_PASSWORD` | seed | Password for the seeded demo accounts (8+ characters) | **Yes** | local: `server/.env` / cloud: Secret Manager, used only by the migration job |
| `VITE_API_URL` | client build | API origin; empty means same origin | No | empty in both |

No secret is in the repository, the image, the logs or the evidence PDF. Sessions are stored in the database (`Session` table), and the app writes nothing to the container's disk, so a restart or a redeploy loses nothing (R-04).

## 3. Commands

All from the repository root.

| Task | Command |
|---|---|
| Install | `npm ci` |
| Build (server + client) | `npm run build` |
| Unit + API tests (server), component tests (client) | `npm test` |
| Create / update tables | `npm run db:migrate` (dev) · `npm run db:deploy -w server` (production) |
| Load demo data | `npm run db:seed` (needs `DEMO_USER_PASSWORD`) |
| Run locally | `npm run dev:server` and `npm run dev:client` |
| Run in containers | `docker compose up --build` (see 3.1) |
| Build the production image only | `docker build -t lendlab .` |

### 3.1 Run from a fresh clone with Docker (R-01, C-03)

```bash
git clone https://github.com/PakPak27/lendlab.git && cd lendlab
cp .env.example .env          # then set DEMO_USER_PASSWORD (8+ characters)
docker compose up --build     # app on http://localhost:3000
```

| Service | What it does |
|---|---|
| `db` | PostgreSQL 16 with a named volume `pgdata`, so data survives `docker compose down` and a rebuild (`down -v` deletes it) |
| `migrate` | One-off job from the app image: `prisma migrate deploy`, then the seed. It must exit 0 before `app` starts. Cloud Run runs the same command as a job before each release |
| `app` | The production image: Express serves `/api` and the built React app on port 3000 |

The root `.env.example` holds only the compose settings (`DEMO_USER_PASSWORD`, and `DB_PORT` / `APP_PORT` if 5432 or 3000 is already used). The `lendlab`/`lendlab` database login is for this local container only.

The `Dockerfile` has two stages: `build` installs the npm workspaces from the root lock file and builds the server and client; `runtime` (node:22-alpine) keeps the compiled server, the built client, `prisma/` and `node_modules` (the migration job needs the Prisma CLI and `tsx` for the seed). It runs as the unprivileged `node` user, and `.dockerignore` keeps `.env` files, `.git`, and local builds out of the image.

## 4. GCP project and resources *(Issues #22, #26)*

| Item | Value |
|---|---|
| Project ID | *(Issue #22)* |
| Region | `asia-southeast1` |
| Cloud Run service | *(Issue #26)* |
| Migration job | *(Issue #26)* |
| Artifact Registry repository | *(Issue #26)* |
| Cloud SQL instance / database | *(Issue #26)* |
| Secrets | *(Issue #26)* |

## 5. Release procedure *(Issues #27, #28)*

To be written with the deploy workflow: how a change goes from a feature branch through `staging` into `main`, how the pipeline deploys it, and how to find the commit that is running (`GET /api/health` returns `commit`).
