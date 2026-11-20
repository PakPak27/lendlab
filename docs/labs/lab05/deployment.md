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
| CI (every PR into `staging` or `main`) | `.github/workflows/ci-docker.yml`, job `test-and-docker`: `npm ci`, Prisma client, `npm test` against a PostgreSQL service, type checks, `npm run build`, `docker build` |

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

The course runs one shared GCP project. Instead of a personal Free Trial (changed by the course announcement), the team activated its resources in the course Student Cloud portal, which created everything below under the team prefix `s07a7184d`. Students can update these resources but cannot create more or read secret values.

| Item | Value |
|---|---|
| Project ID | `cpe-se-course-2026` (course project) |
| Region | `asia-southeast1` |
| Public URL | https://s07a7184d-4d7hbszvwq-as.a.run.app |
| Cloud Run service | `s07a7184d` (min instances 0, scales to zero) |
| Migration job | `s07a7184d-migrate`: `prisma migrate deploy`, then the seed |
| Artifact Registry image | `asia-southeast1-docker.pkg.dev/cpe-se-course-2026/s07a7184d/s07a7184d`, tagged with the full commit SHA |
| Cloud SQL | instance `s07a7184d-pg` (PostgreSQL, `db-f1-micro`), database and user `s07a7184d`, reached through the Cloud SQL connector (`/cloudsql/...` socket) |
| Runtime identity | `s07a7184d-runner@cpe-se-course-2026.iam.gserviceaccount.com` |
| Secrets (Secret Manager) | `s07a7184d-database-url` → `DATABASE_URL` (service and job); `s07a7184d-app-secret-1` → `DEMO_USER_PASSWORD` (job only, used by the seed) |

**First deploy (Issue #26)** was run by hand from Cloud Shell with `bash deploy/deploy.sh` on 2026-11-20: commit `6a9882f354d98b255966020f8f27c9976a416230`, revision `s07a7184d-00002-bvj`; migration applied 2 migrations and seeded 10 items and 4 demo accounts; the smoke test passed and `/api/health` reported that commit. The demo-account password was generated inside Cloud Shell, stored only in Secret Manager and a private file, and is shared with testers privately.

## 5. Release procedure *(Issues #27, #28)*

Only `main` deploys, so every merge into `main` is a release.

1. Open an Issue (label `lab5` for Lab 5 work), branch from `staging` as `feat/<issue>-<name>` or `fix/<issue>-<name>`.
2. Open a PR into `staging`. CI (`test-and-docker`) runs; the teammate reviews with a specific check. The author never approves their own PR.
3. When `staging` is ready, open a release PR from `staging` into `main`. CI runs again and the teammate approves it.
4. Merging into `main` starts `.github/workflows/deploy.yml`:
   1. reruns CI; a failure stops the release;
   2. signs in to Google Cloud with Workload Identity Federation (no key file);
   3. builds the image and pushes it tagged with the full commit SHA;
   4. `deploy/release.sh` pins the image by digest, runs the migration job (`--wait`; a failed migration stops the release before the service changes), then points the Cloud Run service at the image and sets `GIT_SHA` with `--update-env-vars`;
   5. `deploy/smoke_test.py` checks `/api/health`, `/api/ready`, `/` and `/api/categories` on the live URL, and fails unless `/api/health` reports the commit that was just deployed.
5. The run's summary shows the commit, the image digest and the URL.

**Which commit is running (R-08):** open `<service URL>/api/health`; `commit` is the full SHA of the release. The footer of every page shows the same commit (first 7 characters), and the Cloud Run revision's image is tagged with the same SHA.

**Rollback:** Actions → Deploy → Run workflow, `image_tag` = the full SHA of an earlier release. CI, build and migration are skipped, and the service is pointed back to that image. Fix forward with a normal PR afterwards.

**GitHub settings used by the pipeline** (environment `demo`, the name the course portal links Workload Identity to; values from the course portal's "Team resources" tab): variables `GCP_PROJECT_ID`, `GCP_REGION`, `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT`, `CLOUD_RUN_SERVICE`, `MIGRATE_JOB`, `IMAGE_REPO`, and optionally `SMOKE_EMAIL` with the secret `SMOKE_PASSWORD`. None of the variables is a secret.

The course portal created the Cloud SQL instance, secrets, service account, registry, service and migration job. `deploy/deploy.sh` (first deploy) and the pipeline only update them; neither creates nor deletes cloud resources, and the starter kit's `teardown.sh` is not used, as the course announcement requires.
