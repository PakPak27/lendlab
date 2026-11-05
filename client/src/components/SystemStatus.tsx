import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../api/client';

type State =
  | { kind: 'loading' }
  | { kind: 'ok' }
  | { kind: 'error'; message: string };

// Shows whether the API and database are reachable (calls GET /api/ready).
export default function SystemStatus() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  async function check() {
    setState({ kind: 'loading' });
    try {
      await apiFetch<{ db: string }>('/api/ready');
      setState({ kind: 'ok' });
    } catch (err) {
      setState({ kind: 'error', message: err instanceof ApiError ? err.message : 'Unknown error' });
    }
  }

  useEffect(() => {
    void check();
  }, []);

  if (state.kind === 'loading') {
    return (
      <div className="d-flex align-items-center gap-2" role="status">
        <span className="spinner-border spinner-border-sm" aria-hidden="true" />
        <span>Checking system status…</span>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
        <span>System unavailable: {state.message}</span>
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => void check()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="alert alert-success mb-0" role="status">
      API and database are connected.
    </div>
  );
}
