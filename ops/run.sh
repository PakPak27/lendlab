#!/usr/bin/env bash
# Cloud Shell helper for the first manual deploy (Lab 5 #26). Read-only step: inspect.
set -uo pipefail
R=asia-southeast1
echo "=== account/project"; gcloud config list --format='value(core.account,core.project)'
echo "=== job"
gcloud run jobs describe s07a7184d-migrate --region $R --format=json | python3 -c '
import json,sys; j=json.load(sys.stdin); c=j["spec"]["template"]["spec"]["template"]["spec"]["containers"][0]
print("image:", c.get("image")); print("command:", c.get("command")); print("args:", c.get("args"))
for e in c.get("env",[]):
    v=e.get("valueFrom",{}).get("secretKeyRef")
    print("  env", e["name"], "-> secret "+v["name"]+":"+v.get("key","") if v else "= (plain value hidden)")
print("annotations:", {k:v for k,v in j["spec"]["template"]["metadata"].get("annotations",{}).items() if "cloudsql" in k})'
echo "=== service"
gcloud run services describe s07a7184d --region $R --format=json | python3 -c '
import json,sys; j=json.load(sys.stdin); t=j["spec"]["template"]; c=t["spec"]["containers"][0]
print("image:", c.get("image")); print("command:", c.get("command"), "args:", c.get("args")); print("ports:", c.get("ports"))
for e in c.get("env",[]):
    v=e.get("valueFrom",{}).get("secretKeyRef")
    print("  env", e["name"], "-> secret "+v["name"]+":"+v.get("key","") if v else "= "+(e.get("value","") if e["name"] in ("NODE_ENV","PORT","GIT_SHA","SESSION_TTL_HOURS") else "(hidden)"))
print("annotations:", {k:v for k,v in t["metadata"].get("annotations",{}).items() if "cloudsql" in k or "scale" in k})
print("url:", j["status"].get("url"))'
echo "=== images"; gcloud artifacts docker images list asia-southeast1-docker.pkg.dev/cpe-se-course-2026/s07a7184d --format='value(package,version)' 2>&1 | tail -3
echo "=== docker"; docker version --format '{{.Server.Version}}' 2>&1 | tail -1
