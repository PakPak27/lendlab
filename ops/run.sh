#!/usr/bin/env bash
# Cloud Shell helper: first manual deploy of LendLab (Lab 5 #26).
# Builds feat/28-deploy, pushes it tagged with the full commit SHA, points the
# portal's migration job at it, runs migrate + seed, then updates the service.
# Updates only this team's resources; creates and deletes nothing.
set -euo pipefail
R=asia-southeast1
P=cpe-se-course-2026
PREFIX=s07a7184d
REPO=$R-docker.pkg.dev/$P/$PREFIX/$PREFIX

echo "=== DATABASE_URL format (password masked)"
gcloud secrets versions access latest --secret=$PREFIX-database-url | python3 -c '
import sys,urllib.parse as u; s=sys.stdin.read().strip(); p=u.urlsplit(s)
print("scheme:", p.scheme, "| user:", p.username, "| host:", repr(p.hostname), "| port:", p.port, "| db:", p.path, "| query:", p.query, "| has password:", bool(p.password))
sys.exit(0 if p.scheme in ("postgresql","postgres") else 3)'
echo "=== demo password secret exists"; gcloud secrets describe $PREFIX-demo-password --format='value(name)'

echo "=== build"
rm -rf ~/src && git clone -q -b feat/28-deploy https://github.com/PakPak27/lendlab ~/src
cd ~/src
SHA=$(git rev-parse HEAD); echo "commit $SHA"
docker build -q -t $REPO:$SHA .
gcloud auth configure-docker $R-docker.pkg.dev --quiet >/dev/null 2>&1
docker push -q $REPO:$SHA
DIGEST=$(gcloud artifacts docker images describe $REPO:$SHA --format='value(image_summary.fully_qualified_digest)')
echo "digest $DIGEST"

echo "=== migrate + seed"
gcloud run jobs update $PREFIX-migrate --region $R --image "$DIGEST" \
  --command=sh --args='-c,/app/node_modules/.bin/prisma migrate deploy && /app/node_modules/.bin/tsx prisma/seed.ts' \
  --update-secrets=DEMO_USER_PASSWORD=$PREFIX-demo-password:latest \
  --update-env-vars=NODE_ENV=production --quiet
gcloud run jobs execute $PREFIX-migrate --region $R --wait --quiet

echo "=== deploy service"
gcloud run services update $PREFIX --region $R --image "$DIGEST" \
  --update-env-vars=NODE_ENV=production,GIT_SHA=$SHA --quiet
URL=$(gcloud run services describe $PREFIX --region $R --format='value(status.url)')
echo "url $URL"
echo "=== smoke"
python3 deploy/smoke_test.py "$URL" "$SHA"
echo "=== DONE $SHA"
