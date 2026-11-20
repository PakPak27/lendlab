#!/usr/bin/env bash
# Dispatcher for the Cloud Shell launcher; edit the last line to choose a step.
set -uo pipefail
gcloud iam workload-identity-pools providers describe s07a7184d-provider \
  --workload-identity-pool=s07a7184d-pool --location=global \
  --format='yaml(attributeCondition,attributeMapping)' 2>&1 | head -20
