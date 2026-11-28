#!/usr/bin/env bash
# Lab 7 CHG-01 pre-release check (read-only): requests whose length is above the
# new per-category maximum (Laptop 7, Camera 3, Projector 3, Microcontroller Kit 14).
# Prints counts only; changes nothing.
set -euo pipefail
R=asia-southeast1; J=s07a7184d-migrate
read -r -d '' JS <<'EOF' || true
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const MAX = { 'Laptop': 7, 'Camera': 3, 'Projector': 3, 'Microcontroller Kit': 14 };
(async () => {
  const rows = await p.borrowRequest.findMany({ select: { id: true, status: true, requestedDays: true, item: { select: { assetTag: true, category: { select: { name: true } } } } } });
  const over = rows.filter((r) => r.requestedDays > (MAX[r.item.category.name] ?? 14));
  const by = {};
  for (const r of rows) by[r.status] = (by[r.status] || 0) + 1;
  console.log('CHECK total=' + rows.length + ' byStatus=' + JSON.stringify(by));
  console.log('CHECK overLimit=' + JSON.stringify(over.map((r) => ({ id: r.id, status: r.status, days: r.requestedDays, item: r.item.assetTag, cat: r.item.category.name }))));
})().catch((e) => { console.error('ERROR ' + e.message); process.exitCode = 1; }).finally(() => p.$disconnect());
EOF
B64=$(printf '%s' "$JS" | base64 -w0)
gcloud config set project cpe-se-course-2026 >/dev/null 2>&1
echo "=== read-only check in job $J"
gcloud run jobs execute $J --region $R --wait --args="^~^-c~cd /app/server && node -e \"\$(echo $B64 | base64 -d)\"" --format='value(metadata.name)' | tee /tmp/exec.txt
EX=$(tail -1 /tmp/exec.txt)
sleep 20
gcloud logging read "resource.type=cloud_run_job AND labels.\"run.googleapis.com/execution_name\"=\"$EX\"" --limit 30 --format='value(textPayload)' --freshness=30m | grep -E 'CHECK|ERROR' || echo "(no logs readable)"
echo "=== done"
