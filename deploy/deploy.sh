#!/usr/bin/env bash
# LendLab first (manual) deploy to the course-managed GCP project (Lab 5 #26, Student Guide Ep. 5).
#
# Run from the repository root in Google Cloud Shell, signed in with the team's
# portal Gmail:   bash deploy/deploy.sh
#
# The course portal already created every resource (registry, Cloud SQL,
# secrets, runtime identity, Cloud Run service and migration job). This script
# only UPDATES them; it never creates or deletes cloud resources.
#
#   1. demo password: generated once in Cloud Shell, stored in the team's own
#      secret slot <prefix>-app-secret-1 and in a private file in $HOME; never printed
#   2. build the image from this checkout, tag it with the full commit SHA, push it
#   3. point the migration job at that image (pinned by digest) with the
#      migrate + seed command and the secrets it needs; run it and wait
#   4. update the service to the same digest, set GIT_SHA and NODE_ENV with
#      --update-env-vars (keeps the portal's DATABASE_URL secret reference)
#   5. smoke test the live URL, including that it reports this commit
#
# After this first deploy, releases go through .github/workflows/deploy.yml.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-cpe-se-course-2026}"
REGION="${REGION:-asia-southeast1}"
PREFIX="${PREFIX:-s07a7184d}"
IMAGE_REPO="$REGION-docker.pkg.dev/$PROJECT_ID/$PREFIX/$PREFIX"
DEMO_SECRET="$PREFIX-app-secret-1"
PWFILE="$HOME/lendlab-demo-password-PRIVATE.txt"
MARK="$HOME/.lendlab-demo-secret-added"
MIGRATE_CMD='/app/node_modules/.bin/prisma migrate deploy && /app/node_modules/.bin/tsx prisma/seed.ts'

echo "=== 1. demo password ($DEMO_SECRET)"
if [ ! -f "$MARK" ]; then
  (umask 077; python3 -c 'import secrets,string; a=string.ascii_letters+string.digits; print("".join(secrets.choice(a) for _ in range(20)), end="")' > "$PWFILE")
  gcloud secrets versions add "$DEMO_SECRET" --data-file="$PWFILE" --project="$PROJECT_ID" --quiet
  touch "$MARK"
  echo "stored; the password is in $PWFILE (share it with testers privately)"
else
  echo "already stored; see $PWFILE"
fi

echo "=== 2. build and push"
SHA="$(git rev-parse HEAD)"
echo "commit $SHA"
docker build -q -t "$IMAGE_REPO:$SHA" .
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet >/dev/null 2>&1
docker push -q "$IMAGE_REPO:$SHA"
DIGEST="$(gcloud artifacts docker images describe "$IMAGE_REPO:$SHA" --project="$PROJECT_ID" \
  --format='value(image_summary.fully_qualified_digest)')"
echo "digest $DIGEST"

echo "=== 3. migrate and seed"
gcloud run jobs update "$PREFIX-migrate" --project="$PROJECT_ID" --region="$REGION" --image="$DIGEST" \
  --command=sh --args="-c,$MIGRATE_CMD" \
  --update-secrets="DEMO_USER_PASSWORD=$DEMO_SECRET:latest" \
  --update-env-vars=NODE_ENV=production --quiet
gcloud run jobs execute "$PREFIX-migrate" --project="$PROJECT_ID" --region="$REGION" --wait --quiet

echo "=== 4. deploy the service"
gcloud run services update "$PREFIX" --project="$PROJECT_ID" --region="$REGION" --image="$DIGEST" \
  --update-env-vars="NODE_ENV=production,GIT_SHA=$SHA" --quiet
URL="$(gcloud run services describe "$PREFIX" --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)')"
echo "url $URL"

echo "=== 5. smoke test"
python3 deploy/smoke_test.py "$URL" "$SHA"
echo "=== deployed $SHA"
