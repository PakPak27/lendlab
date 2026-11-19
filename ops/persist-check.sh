#!/usr/bin/env bash
# C-05 (R-04): a record created before a restart is still there afterwards.
# Signs in with the demo password from the private file (never printed).
set -euo pipefail
R=asia-southeast1; S=s07a7184d
URL=$(gcloud run services describe $S --region $R --format='value(status.url)')
PW=$(cat ~/lendlab-demo-password-PRIVATE.txt)
api() { curl -s -H 'Content-Type: application/json' ${TOKEN:+-H "Authorization: Bearer $TOKEN"} "$@"; }
TOKEN=$(api -d "{\"email\":\"borrower1@lendlab.test\",\"password\":\"$PW\"}" "$URL/api/auth/login" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')
echo "signed in as borrower1 (token not shown)"
ITEM=$(api "$URL/api/items" | python3 -c 'import json,sys; d=json.load(sys.stdin); d=d.get("items",d); print([i["id"] for i in d if i["assetTag"]=="PRJ-002"][0])')
STAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "=== BEFORE restart ($STAMP), revision $(gcloud run services describe $S --region $R --format='value(status.latestReadyRevisionName)')"
api -d "{\"itemId\":$ITEM,\"requestedDays\":3,\"purpose\":\"C-05 persistence check $STAMP\"}" "$URL/api/requests" \
  | python3 -c 'import json,sys; r=json.load(sys.stdin)["request"]; print("created request", r["id"], r["status"], r["item"]["assetTag"], r["item"]["status"], repr(r["purpose"]))'
echo "=== restart: new revision of the same image"
gcloud run services update $S --region $R --update-env-vars=RESTARTED_AT=$(date +%s) --quiet 2>&1 | grep -E 'revision|Done' || true
echo "=== AFTER restart, revision $(gcloud run services describe $S --region $R --format='value(status.latestReadyRevisionName)')"
echo "old session still valid: HTTP $(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" $URL/api/auth/me)"
api "$URL/api/requests/mine" | python3 -c '
import json,sys
for r in json.load(sys.stdin)["requests"]:
    print("found request", r["id"], r["status"], r["item"]["assetTag"], r["item"]["status"], repr(r["purpose"]), r["createdAt"])'
api "$URL/api/health"; echo
