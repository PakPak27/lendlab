import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { fetchMyRequests, type BorrowRequest } from '../api/requests';
import { formatDateTime } from '../lib/format';

// F-04 My Borrowing (/my): the signed-in borrower's own requests and loans (FR-06, BR-06).

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; requests: BorrowRequest[] };

// Status text shown to the borrower (contract section 6).
export function borrowingStatus(r: BorrowRequest): { label: string; className: string } {
  if (r.status === 'PENDING') return { label: 'Pending', className: 'text-bg-warning' };
  if (r.status === 'FULFILLED' && r.loan?.status === 'ACTIVE') return { label: 'On loan', className: 'text-bg-primary' };
  if (r.status === 'FULFILLED' && r.loan?.status === 'RETURNED') return { label: 'Returned', className: 'text-bg-secondary' };
  if (r.status === 'REJECTED') return { label: 'Rejected', className: 'text-bg-danger' };
  if (r.status === 'CANCELLED') return { label: 'Cancelled', className: 'text-bg-secondary' };
  return { label: r.status, className: 'text-bg-dark' };
}

export default function MyBorrowingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [flash, setFlash] = useState<string | null>((location.state as { flash?: string } | null)?.flash ?? null);
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      setState({ kind: 'loaded', requests: await fetchMyRequests() });
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'An unexpected error occurred.' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Show the success message once, then clear it from history so a reload does not repeat it.
  useEffect(() => {
    if (!flash) return;
    navigate(location.pathname, { replace: true, state: null });
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div data-testid="page-my-borrowing">
      <h1 className="h3 mb-3">My Borrowing</h1>

      {flash && (
        <div className="alert alert-success" role="status">
          {flash}
        </div>
      )}

      {state.kind === 'loading' && (
        <div className="d-flex align-items-center gap-2 py-4" role="status">
          <span className="spinner-border spinner-border-sm" aria-hidden="true" />
          <span>Loading your requests…</span>
        </div>
      )}

      {state.kind === 'error' && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
          <span>{state.message}</span>
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {state.kind === 'loaded' && state.requests.length === 0 && (
        <p className="text-secondary py-4">
          You have no requests yet. <Link to="/catalog">Browse the catalog</Link>
        </p>
      )}

      {state.kind === 'loaded' && state.requests.length > 0 && (
        <div className="borrow-list">
          <div className="borrow-head text-secondary small fw-semibold border-bottom pb-2">
            <span className="borrow-tag">Asset tag</span>
            <span className="borrow-name">Item</span>
            <span className="borrow-date">Requested on</span>
            <span className="borrow-days">Days</span>
            <span className="borrow-status">Status</span>
            <span className="borrow-due">Due date</span>
          </div>
          {state.requests.map((r) => {
            const status = borrowingStatus(r);
            return (
              <div key={r.id} data-testid="borrow-row" className="borrow-row border-bottom py-2">
                <span className="borrow-tag fw-semibold font-monospace">{r.item.assetTag}</span>
                <span className="borrow-name">{r.item.name}</span>
                <span className="borrow-date text-secondary small">{formatDateTime(r.createdAt)}</span>
                <span className="borrow-days text-secondary small">
                  {r.requestedDays} {r.requestedDays === 1 ? 'day' : 'days'}
                </span>
                <span className="borrow-status">
                  <span className={`badge status-badge ${status.className}`}>{status.label}</span>
                </span>
                <span className="borrow-due small">
                  {r.loan ? (
                    <>
                      <span className="d-md-none text-secondary">Due </span>
                      {formatDateTime(r.loan.dueAt)}
                    </>
                  ) : (
                    <span className="text-secondary" aria-label="No due date yet">—</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
