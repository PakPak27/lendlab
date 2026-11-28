import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { cancelBorrowRequest, fetchMyRequests, type BorrowRequest } from '../api/requests';
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

// F-09 BR-08: what counts toward the borrowing limit of 3.
export const openCommitments = (requests: BorrowRequest[]) =>
  requests.filter((r) => r.status === 'PENDING' || r.loan?.status === 'ACTIVE').length;

export default function MyBorrowingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [flash, setFlash] = useState<string | null>((location.state as { flash?: string } | null)?.flash ?? null);
  const [state, setState] = useState<State>({ kind: 'loading' });
  // F-06: cancel a Pending request after confirmation.
  const [cancelling, setCancelling] = useState<BorrowRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  async function confirmCancel() {
    if (!cancelling || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await cancelBorrowRequest(cancelling.id);
      setFlash('Request cancelled.');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Cannot reach the server. Try again.');
    } finally {
      setBusy(false);
      setCancelling(null);
    }
    await load();
  }

  return (
    <div data-testid="page-my-borrowing">
      <h1 className="h3 mb-3">My Borrowing</h1>

      {flash && (
        <div className="alert alert-success" role="status">
          {flash}
        </div>
      )}

      {actionError && (
        <div className="alert alert-danger" role="alert">
          {actionError}
        </div>
      )}

      {state.kind === 'loaded' && (
        <p className="text-secondary small mb-2" data-testid="open-count">
          {/* F-09 BR-08: open commitments = Pending requests + Active loans */}
          Open requests and loans: {openCommitments(state.requests)} of 3
        </p>
      )}

      {state.kind === 'loaded' && state.requests.some((r) => r.loan?.isOverdue) && (
        <div className="alert alert-danger" role="alert">
          You have an overdue loan. Return it before requesting another item.
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
                <span className="borrow-name">
                  {r.item.name}
                  {r.status === 'REJECTED' && r.decisionNote && (
                    <span className="d-block small text-danger">Reason: {r.decisionNote}</span>
                  )}
                  {r.status === 'PENDING' && (
                    <button type="button" className="btn btn-link btn-sm text-danger p-0 d-block" onClick={() => setCancelling(r)}>
                      Cancel request
                    </button>
                  )}
                </span>
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
                      <span className={r.loan.isOverdue ? 'text-danger fw-semibold' : undefined}>
                        {formatDateTime(r.loan.dueAt)}
                      </span>
                      {r.loan.isOverdue && <span className="badge text-bg-danger ms-2">Overdue</span>}
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

      {cancelling && (
        <>
          <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="cancel-title">
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title h5" id="cancel-title">
                    Cancel request
                  </h2>
                </div>
                <div className="modal-body">
                  <p className="mb-0">Cancel your request for {cancelling.item.assetTag}?</p>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => setCancelling(null)}>
                    Keep request
                  </button>
                  <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void confirmCancel()}>
                    Cancel request
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      )}
    </div>
  );
}
