import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';

// Lab 5 (R-08, Issue #38): show which release is running, from GET /api/health.
// Testers can match the short commit with the GitHub release and the Deploy run.
// A local run reports "local"; if the call fails the footer simply stays empty.
export default function ReleaseFooter() {
  const [commit, setCommit] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<{ status: string; commit?: string }>('/api/health')
      .then((h) => {
        if (active && h?.commit) setCommit(h.commit);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!commit) return null;
  const label = /^[0-9a-f]{40}$/.test(commit) ? commit.slice(0, 7) : commit;
  return (
    <footer className="container py-3 text-muted small border-top" data-testid="release-footer">
      LendLab release <code title={commit}>{label}</code>
    </footer>
  );
}
