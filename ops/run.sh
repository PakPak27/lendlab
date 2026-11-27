#!/usr/bin/env bash
# Lab 6 cleanup: cancel request #7 (ARD-002) created by team Frenchies' UAT on the
# exercise version. Runs once in the migration job's image with overridden args.
# It only changes the rows when request 7 is PENDING on ARD-002 and ARD-002 is RESERVED.
set -euo pipefail
R=asia-southeast1; J=s07a7184d-migrate
read -r -d '' JS <<'EOF' || true
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const it = await p.item.findUnique({ where: { assetTag: 'ARD-002' } });
  const r = await p.borrowRequest.findUnique({ where: { id: 7 } });
  console.log('BEFORE ' + JSON.stringify({ item: it && { id: it.id, status: it.status }, request: r && { id: r.id, itemId: r.itemId, status: r.status, purpose: r.purpose, days: r.requestedDays } }));
  if (!it || !r || r.itemId !== it.id || r.status !== 'PENDING' || it.status !== 'RESERVED') { console.log('SKIP state not as expected'); return; }
  await p.$transaction(async (tx) => {
    const a = await tx.borrowRequest.updateMany({ where: { id: 7, status: 'PENDING' }, data: { status: 'CANCELLED', decidedAt: new Date(), decisionNote: 'Cancelled by the team after the Lab 6 UAT exercise test (partner asked to remove it)' } });
    const b = await tx.item.updateMany({ where: { id: it.id, status: 'RESERVED' }, data: { status: 'AVAILABLE' } });
    if (a.count !== 1 || b.count !== 1) throw new Error('unexpected row count');
  });
  const it2 = await p.item.findUnique({ where: { id: it.id } });
  const r2 = await p.borrowRequest.findUnique({ where: { id: 7 } });
  console.log('AFTER ' + JSON.stringify({ item: { id: it2.id, status: it2.status }, request: { id: r2.id, status: r2.status } }));
})().catch((e) => { console.error('ERROR ' + e.message); process.exitCode = 1; }).finally(() => p.$disconnect());
EOF
B64=$(printf '%s' "$JS" | base64 -w0)
echo "=== executing cleanup in job $J"
gcloud run jobs execute $J --region $R --wait --args="^~^-c~cd /app/server && node -e \"\$(echo $B64 | base64 -d)\"" --format='value(metadata.name)' | tee /tmp/exec.txt
EX=$(tail -1 /tmp/exec.txt)
sleep 20
echo "=== logs for $EX"
gcloud logging read "resource.type=cloud_run_job AND labels.\"run.googleapis.com/execution_name\"=\"$EX\"" --limit 30 --format='value(textPayload)' --freshness=30m | grep -E 'BEFORE|AFTER|SKIP|ERROR' || echo "(no logs readable)"
echo "=== done"
