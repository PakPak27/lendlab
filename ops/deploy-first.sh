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

echo "=== demo password -> $PREFIX-app-secret-1"
# Generated here and kept only in a private file in this Cloud Shell home
# (never printed). Set once: the seed uses it only when it creates the accounts.
PWFILE=~/lendlab-demo-password-PRIVATE.txt
MARK=~/.lendlab-demo-secret-added
if [ ! -f "$MARK" ]; then
  (umask 077; python3 -c 'import secrets,string; a=string.ascii_letters+string.digits; print("".join(secrets.choice(a) for _ in range(20)), end="")' > "$PWFILE")
  gcloud secrets versions add $PREFIX-app-secret-1 --data-file="$PWFILE" --quiet
  touch "$MARK"
  echo "new secret version added; password is in $PWFILE (not printed)"
else
  echo "already set; password is in $PWFILE"
fi

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
  --update-secrets=DEMO_USER_PASSWORD=$PREFIX-app-secret-1:latest \
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
