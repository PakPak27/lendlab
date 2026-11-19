#!/usr/bin/env bash
# LendLab release script, called by .github/workflows/deploy.yml (Lab 5, R-07/R-08).
# Adapted from the Lab 5 starter kit for the course-managed GCP project.
#
# Updates resources the course portal already created; it never creates or
# deletes Cloud SQL, IAM, secrets or registries.
#   Normal release : pin image by digest -> run migration job -> update service
#   Rollback       : pin image by digest -> update service (no migration, no seed)
#
# Inputs (environment):
#   PROJECT_ID, REGION        GCP project and region
#   IMAGE_REPO                <region>-docker.pkg.dev/<project>/<repo>/<image> (no tag)
#   IMAGE_TAG                 full 40-character commit SHA
#   SERVICE_NAME              Cloud Run service from the portal
#   MIGRATE_JOB_NAME          Cloud Run migration job from the portal
#   ROLLBACK                  true | false (default false)
#   GITHUB_ENV                when set, SERVICE_URL and DEPLOYED_IMAGE are exported
set -euo pipefail

: "${PROJECT_ID:?Required}" "${REGION:?Required}" "${IMAGE_REPO:?Required}" "${IMAGE_TAG:?Required}"
: "${SERVICE_NAME:?Required}" "${MIGRATE_JOB_NAME:?Required}"
ROLLBACK="${ROLLBACK:-false}"
[[ "$IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]] || { echo 'Image tag must be a full 40-character commit SHA.' >&2; exit 1; }
[[ "$ROLLBACK" == true || "$ROLLBACK" == false ]] || { echo 'Invalid rollback mode.' >&2; exit 1; }

# Pin the image by digest so the job and the service run exactly the same image.
DIGEST_IMAGE="$(gcloud artifacts docker images describe "$IMAGE_REPO:$IMAGE_TAG" \
  --project="$PROJECT_ID" --format='value(image_summary.fully_qualified_digest)')"
[[ "$DIGEST_IMAGE" == "$IMAGE_REPO@sha256:"* ]] || { echo 'Image digest not found.' >&2; exit 1; }

# Migration first. With set -e a failed migration stops here, so the service
# never runs code against a schema it does not match.
if [[ "$ROLLBACK" == false ]]; then
  gcloud run jobs update "$MIGRATE_JOB_NAME" --image="$DIGEST_IMAGE" \
    --project="$PROJECT_ID" --region="$REGION" --quiet
  gcloud run jobs execute "$MIGRATE_JOB_NAME" --wait \
    --project="$PROJECT_ID" --region="$REGION" --quiet
else
  echo 'Rollback: reuse the existing image; skip build, migration and seed.'
fi

# GIT_SHA lets GET /api/health report the running commit (R-08).
# --update-env-vars changes only GIT_SHA; --set-env-vars would wipe the
# variables and secret references the portal configured.
gcloud run services update "$SERVICE_NAME" --image="$DIGEST_IMAGE" \
  --update-env-vars="GIT_SHA=$IMAGE_TAG" \
  --project="$PROJECT_ID" --region="$REGION" --quiet
gcloud run services update-traffic "$SERVICE_NAME" --to-latest \
  --project="$PROJECT_ID" --region="$REGION" --quiet

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" \
  --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)')"
echo "Service URL: $SERVICE_URL"
if [[ -n "${GITHUB_ENV:-}" ]]; then
  printf 'SERVICE_URL=%s\nDEPLOYED_IMAGE=%s\n' "$SERVICE_URL" "$DIGEST_IMAGE" >> "$GITHUB_ENV"
fi
