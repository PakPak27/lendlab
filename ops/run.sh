#!/usr/bin/env bash
# Lab 6 Part D exercise: deploy the exercise branch as a TAGGED, NO-TRAFFIC revision.
# The live URL keeps 100% traffic on the current release.
set -euo pipefail
umask 022
R=asia-southeast1; P=cpe-se-course-2026; S=s07a7184d
REPO=$R-docker.pkg.dev/$P/$S/$S
rm -rf ~/ex && git clone -q -b exercise/lab6-reintroduce-defect https://github.com/PakPak27/lendlab ~/ex && cd ~/ex
SHA=$(git rev-parse HEAD); echo "exercise commit $SHA"
docker build -q -t $REPO:$SHA .
gcloud auth configure-docker $R-docker.pkg.dev --quiet >/dev/null 2>&1
docker push -q $REPO:$SHA
DIGEST=$(gcloud artifacts docker images describe $REPO:$SHA --format='value(image_summary.fully_qualified_digest)')
gcloud run services update $S --region $R --image "$DIGEST" --update-env-vars=GIT_SHA=$SHA \
  --no-traffic --tag uat-exercise --quiet
gcloud run services describe $S --region $R --format='yaml(status.traffic)'
echo "=== check"
for u in $(gcloud run services describe $S --region $R --format='value(status.traffic[].url)'); do echo "$u -> $(curl -s $u/api/health)"; done
curl -s https://s07a7184d-4d7hbszvwq-as.a.run.app/api/health; echo
