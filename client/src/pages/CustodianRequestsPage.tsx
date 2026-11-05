import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch } from '../api/client';

interface QueueRow {
  id: number;
  purpose: string;
  requestedDays: number;
  createdAt: string;
  borrower: { id: number; name: string; email: string };
  item: { id: number; assetTag: string; name: string; location: { code: string } };
}

interface LoanResult {
  loan: { dueAt: string };
}

// Dates are shown in Bangkok time (SDS section 3).
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric',
});
const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});
const formatDate = (d: Date) => dateFormat.format(d);
const formatDateTime = (d: Date) => dateTimeFormat.format(d).replace(',', '');

// F-05: pending requests for the custodian's locations, with a confirm step before checkout.
export default function CustodianRequestsPage() {
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<QueueRow | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false); // synchronous guard: a double click must not send two checkouts

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await apiFetch<{ requests: QueueRow[] }>('/api/custodian/requests');
      setRows(res.requests);
    } catch (err) {
      setRows(null);
      setLoadError(err instanceof ApiError ? err.message : 'Cannot reach the server. Try again.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmCheckout() {
    if (!confirming || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setActionError(null);
    try {
      const { loan } = await apiFetch<LoanResult>(`/api/custodian/requests/${confirming.id}/checkout`, { method: 'POST' });
      setToast(`Checked out — due ${formatDate(new Date(loan.dueAt))}`);
      setConfirming(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Cannot reach the server. Try again.');
      setConfirming(null);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
    await load(); // the row leaves the queue; on a 409 the queue is refreshed to the real state
  }

  const dueFor = (row: QueueRow) => formatDateTime(new Date(Date.now() + row.requestedDays * 86_400_000));

  return (
    <div data-testid="page-custodian-requests">
      <h1 className="h3 mb-3">Requests</h1>

      {toast && (
        <div className="alert alert-success d-flex justify-content-between" role="status">
          <span>{toast}</span>
          <button type="button" className="btn-close" aria-label="Dismiss" onClick={() => setToast(null)} />
        </div>
      )}
      {actionError && (
        <div className="alert alert-danger" role="alert">
          {actionError}
        </div>
      )}

      {loadError && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
          <span>{loadError}</span>
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {!loadError && rows === null && <p role="status">Loading requests…</p>}

      {rows && rows.length === 0 && <p className="text-secondary">No pending requests for your locations.</p>}

      {rows && rows.length > 0 && (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>Requested on</th>
                <th>Borrower</th>
                <th>Asset tag</th>
                <th>Item</th>
                <th>Purpose</th>
                <th>Days</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(new Date(row.createdAt))}</td>
                  <td>{row.borrower.name}</td>
                  <td>{row.item.assetTag}</td>
                  <td>{row.item.name}</td>
                  <td>{row.purpose}</td>
                  <td>{row.requestedDays}</td>
                  <td className="text-end">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setConfirming(row)}>
                      Check out
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirming && (
        <>
          <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title h5" id="confirm-title">
                    Confirm checkout
                  </h2>
                </div>
                <div className="modal-body">
                  <p className="mb-1">
                    Hand over {confirming.item.assetTag} to {confirming.borrower.name} for {confirming.requestedDays} days?
                  </p>
                  <p className="mb-0 text-secondary">Due: {dueFor(confirming)}</p>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => setConfirming(null)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void confirmCheckout()}>
                    {busy ? 'Checking out…' : 'Confirm'}
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
