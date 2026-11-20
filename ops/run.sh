#!/usr/bin/env bash
# Dispatcher for the Cloud Shell launcher.
# Redeploy the current main with deploy/deploy.sh, then check that request #1
# (created before the restart on 2026-11-20) survived the redeploy (C-05).
set -uo pipefail
umask 022
rm -rf ~/main && git clone -q -b main https://github.com/PakPak27/lendlab ~/main && cd ~/main || exit 1
echo "=== main is $(git rev-parse HEAD)"
bash deploy/deploy.sh || exit 1
URL=$(gcloud run services describe s07a7184d --region asia-southeast1 --format='value(status.url)')
PW=$(cat ~/lendlab-demo-password-PRIVATE.txt)
TOKEN=$(curl -s -H 'Content-Type: application/json' -d "{\"email\":\"borrower1@lendlab.test\",\"password\":\"$PW\"}" "$URL/api/auth/login" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')
echo "=== AFTER redeploy, revision $(gcloud run services describe s07a7184d --region asia-southeast1 --format='value(status.latestReadyRevisionName)')"
curl -s -H "Authorization: Bearer $TOKEN" "$URL/api/requests/mine" | python3 -c '
import json,sys
for r in json.load(sys.stdin)["requests"]:
    print("found request", r["id"], r["status"], r["item"]["assetTag"], r["item"]["status"], repr(r["purpose"]), r["createdAt"])'
curl -s "$URL/api/health"; echo
