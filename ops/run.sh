#!/usr/bin/env bash
# Dispatcher for the Cloud Shell launcher; edit the last line to choose a step.
set -uo pipefail
cd ~/lendlab
logs() {
  gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=s07a7184d-migrate" \
    --limit 40 --freshness 30m --format='value(timestamp,textPayload)' --order=asc 2>&1 \
    | sed -E 's/(postgres(ql)?:\/\/[^:]*:)[^@]*@/\1****@/g' | tail -40
}
logs
